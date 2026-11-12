import { cooldown, QuotaDenied, recordTokens, reserve, type FreeProvider } from '@/lib/budget';

export type ProviderConfiguration = {id: FreeProvider, label: string, model: string, configured: boolean, freeOnly: boolean};
const MODEL = {openrouter: 'openrouter/free', gemini: 'gemini-2.5-flash-lite'} as const;

export function providerList(): ProviderConfiguration[] {
  return [
    {id:'openrouter',label:'OpenRouter Free',model:MODEL.openrouter,configured:Boolean(process.env.OPENROUTER_API_KEY),freeOnly:true},
    {id:'gemini',label:'Gemini 2.5 Flash-Lite',model:MODEL.gemini,configured:Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_FREE_TIER_CONFIRMED === 'true'),freeOnly:true},
  ];
}
export function availableProviders() {
  // OpenRouter is free-only by model ID; Gemini requires explicit free-tier confirmation.
  return providerList().filter(p => p.configured);
}
class ProviderError extends Error {
  constructor(public provider: FreeProvider, public status: number) {
    super(provider + ': API failed with HTTP ' + status + (status===429?' (free-tier rate limit)':''));
    this.name = 'ProviderError';
  }
}
function parseJson(text: string): unknown {
  const stripped = text.trim().replace(/^\`\`\`(?:json)?\s*/i,'').replace(/\s*\`\`\`$/,'').trim();
  try { return JSON.parse(stripped); } catch {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start>=0 && end>start) return JSON.parse(stripped.slice(start,end+1));
    throw new Error('The free model returned invalid JSON; retry this stage manually.');
  }
}
function clampTokens() {
  const raw = Number(process.env.AI_MAX_OUTPUT_TOKENS);
  return Number.isInteger(raw)&&raw>=512 ? Math.min(raw,4096) : 3500;
}
async function callOpenRouter(system: string, prompt: string) {
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',cache:'no-store',signal:AbortSignal.timeout(24000),
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.OPENROUTER_API_KEY,'X-Title':'Master-Agent Free'},
    body:JSON.stringify({model:MODEL.openrouter,max_tokens:clampTokens(),temperature:0.2,messages:[{role:'system',content:system},{role:'user',content:prompt}]})
  });
  if(!response.ok) throw new ProviderError('openrouter',response.status);
  const data=await response.json();
  const content=data.choices?.[0]?.message?.content;
  if(!content || typeof content!=='string') throw new Error('OpenRouter returned no usable text.');
  return {data:parseJson(content),model:String(data.model||MODEL.openrouter).slice(0,120),input:Number(data.usage?.prompt_tokens||0),output:Number(data.usage?.completion_tokens||0)};
}
async function callGemini(system:string,prompt:string) {
  const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',{
    method:'POST',cache:'no-store',signal:AbortSignal.timeout(24000),
    headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY||''},
    body:JSON.stringify({
      systemInstruction:{parts:[{text:system}]},
      contents:[{role:'user',parts:[{text:prompt}]}],
      generationConfig:{responseMimeType:'application/json',maxOutputTokens:clampTokens(),temperature:0.2}
    })
  });
  if(!response.ok) throw new ProviderError('gemini',response.status);
  const data=await response.json();
  const content=(data.candidates?.[0]?.content?.parts||[]).map((p:{text?:string})=>p.text||'').join('');
  if(!content) throw new Error('Gemini returned no usable text.');
  return {data:parseJson(content),model:MODEL.gemini,input:Number(data.usageMetadata?.promptTokenCount||0),output:Number(data.usageMetadata?.candidatesTokenCount||0)};
}
export async function runFreeModel(system:string,prompt:string) {
  const providers=availableProviders();
  if(!providers.length) throw new Error('Configure OPENROUTER_API_KEY in Vercel. Optional Gemini fallback requires GEMINI_API_KEY and GEMINI_FREE_TIER_CONFIRMED=true. Paid OpenAI is disabled.');
  const failures:string[]=[];
  for(const p of providers){
    try {
      // Atomic reservation is BEFORE every remote attempt. Failed attempts still consume a reservation.
      await reserve(p.id);
      const result=p.id==='openrouter'?await callOpenRouter(system,prompt):await callGemini(system,prompt);
      await recordTokens(p.id,result.input,result.output);
      return {output:result.data,provider:p.id,model:result.model,usage:{inputTokens:result.input,outputTokens:result.output}};
    } catch(e){
      if(e instanceof QuotaDenied){failures.push(e.message);continue;}
      if(e instanceof ProviderError && (e.status===429||e.status===503)){
        await cooldown(p.id,e.status===429?900:120);
        failures.push(e.message);
        continue; // At most one try per configured free provider.
      }
      throw e;
    }
  }
  throw new Error('No free provider available. '+failures.join(' | '));
}
