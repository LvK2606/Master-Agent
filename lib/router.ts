import { cooldown, QuotaDenied, recordTokens, reserve } from '@/lib/budget';
import { decryptCredential, getConnections, type ProviderId, type StoredConnection } from '@/lib/vault';

export type RoleId='pm'|'ba'|'architect'|'ux'|'fe'|'be'|'qa'|'security'|'devops';
export const ROLE_INFO:{id:RoleId,name:string,specialty:string}[]=[
 {id:'pm',name:'Project Manager',specialty:'Điều phối, quản lý tiến độ'},
 {id:'ba',name:'Business Analyst',specialty:'Phân tích yêu cầu'},
 {id:'architect',name:'Solution Architect',specialty:'Kiến trúc hệ thống'},
 {id:'ux',name:'UI/UX Designer',specialty:'Thiết kế trải nghiệm'},
 {id:'fe',name:'Frontend Engineer',specialty:'Giao diện và tương tác'},
 {id:'be',name:'Backend Engineer',specialty:'API và cơ sở dữ liệu'},
 {id:'qa',name:'QA Engineer',specialty:'Kiểm thử và chất lượng'},
 {id:'security',name:'Security Engineer',specialty:'Rà soát bảo mật'},
 {id:'devops',name:'DevOps Engineer',specialty:'Vận hành và triển khai'}
];
export const PROVIDER_META:{id:ProviderId,label:string,model:string,paid:boolean,url:string}[]=[
 {id:'openrouter',label:'OpenRouter Free',model:'openrouter/free',paid:false,url:'https://openrouter.ai/settings/keys'},
 {id:'gemini',label:'Google Gemini',model:'gemini-3.5-flash-lite',paid:false,url:'https://aistudio.google.com/app/apikey'},
 {id:'deepseek',label:'DeepSeek API',model:'deepseek-flash',paid:true,url:'https://platform.deepseek.com/api_keys'},
 {id:'openai',label:'OpenAI API',model:'gpt-4.1-mini',paid:true,url:'https://platform.openai.com/api-keys'}
];
// Heuristic preferences, not audited benchmarks. Available, free, quota, then role score decide.
const SCORES:Record<RoleId,Record<ProviderId,number>>={
 pm:{gemini:96,openai:92,deepseek:83,openrouter:72},
 ba:{gemini:98,openai:92,deepseek:86,openrouter:74},
 architect:{deepseek:98,openai:94,gemini:87,openrouter:73},
 ux:{gemini:97,openai:95,deepseek:76,openrouter:75},
 fe:{openai:97,deepseek:94,gemini:89,openrouter:76},
 be:{deepseek:99,openai:93,gemini:84,openrouter:74},
 qa:{openai:97,deepseek:94,gemini:90,openrouter:74},
 security:{openai:97,deepseek:95,gemini:86,openrouter:70},
 devops:{deepseek:95,openai:94,gemini:86,openrouter:74}
};
type Credential={id:ProviderId,secret:string,mode:'free'|'paid',source:'vault'|'environment'};
async function credentials(){
 const saved=await getConnections();
 const available:Credential[]=[];
 for(const meta of PROVIDER_META) {
  const row=saved.find(x=>x.id===meta.id);
  if(row){
   if(!row.enabled)continue;
   if(meta.paid&&!row.allowPaid)continue;
   if(meta.id==='gemini'&&!row.freeTierConfirmed)continue;
   available.push({id:meta.id,secret:decryptCredential(row),mode:meta.paid?'paid':'free',source:'vault'});
   continue;
  }
  if(meta.id==='openrouter'&&process.env.OPENROUTER_API_KEY){
   available.push({id:meta.id,secret:process.env.OPENROUTER_API_KEY,mode:'free',source:'environment'});
  }
  if(meta.id==='gemini'&&process.env.GEMINI_API_KEY&&process.env.GEMINI_FREE_TIER_CONFIRMED==='true'){
   available.push({id:meta.id,secret:process.env.GEMINI_API_KEY,mode:'free',source:'environment'});
  }
 }
 return available;
}
export async function listProviderStatus(){
 const saved=await getConnections();
 return PROVIDER_META.map(meta=>{
  const row=saved.find(x=>x.id===meta.id);
  const fallback=meta.id==='openrouter'?Boolean(process.env.OPENROUTER_API_KEY):meta.id==='gemini'?Boolean(process.env.GEMINI_API_KEY):false;
  const connected=Boolean(row||fallback);
  const enabled=row?row.enabled:(meta.id==='openrouter'?fallback:meta.id==='gemini'?fallback&&process.env.GEMINI_FREE_TIER_CONFIRMED==='true':false);
  const freeConfirmed=row?row.freeTierConfirmed:(meta.id==='gemini'&&process.env.GEMINI_FREE_TIER_CONFIRMED==='true');
  const paidAllowed=row?row.allowPaid:false;
  const available=connected&&enabled&&(meta.paid?paidAllowed:meta.id==='gemini'?freeConfirmed:true);
  return {...meta,connected,enabled,available,allowPaid:paidAllowed,freeTierConfirmed:freeConfirmed,
    keyHint:row?.keyHint||'',source:row?'vault':fallback?'environment':'none',updatedAt:row?.updatedAt||null};
 });
}
export async function getRolePlan(){
 const status=await listProviderStatus();
 return ROLE_INFO.map(role=>{
  const priority=PROVIDER_META.filter(p=>status.some(s=>s.id===p.id&&s.available)).sort((a,b)=>{
   // Default zero-cost preference. Paid models are used only when a key is explicitly opted in.
   if(a.paid!==b.paid) return a.paid?1:-1; // prefer free providers when possible
   return SCORES[role.id][b.id]-SCORES[role.id][a.id];
  });
  return {...role,preferred:priority[0]?.id||null,fallbacks:priority.slice(1).map(p=>p.id),
     rationale:priority.length?'Ưu tiên theo vai trò và các API đã được cho phép':'Chưa có API khả dụng'};
 });
}
function decodeJson(text:string):unknown{
 const clean=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();
 try{return JSON.parse(clean)}catch{
  const start=clean.indexOf('{'),end=clean.lastIndexOf('}');
  if(start>=0&&end>start)return JSON.parse(clean.slice(start,end+1));
  throw new Error('AI trả về JSON chưa hợp lệ. Hãy thử lại nhiệm vụ.');
 }
}
function maxTokens(){const n=Number(process.env.AI_MAX_OUTPUT_TOKENS);return Number.isInteger(n)&&n>=512?Math.min(n,4096):3000;}
class UpstreamError extends Error {
 constructor(public provider:ProviderId,public status:number){
  super(provider+' API returned HTTP '+status);this.name='UpstreamError';
 }
}
async function callChat(endpoint:string,provider:ProviderId,secret:string,model:string,system:string,user:string) {
 const res=await fetch(endpoint,{method:'POST',cache:'no-store',signal:AbortSignal.timeout(23000),
  headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret,...(provider==='openrouter'?{'X-Title':'Master-Agent'}:{})},
  body:JSON.stringify({model,max_tokens:maxTokens(),temperature:0.2,
    ...(provider==='deepseek'?{thinking:{type:'disabled'},response_format:{type:'json_object'}}:{}),
    messages:[{role:'system',content:system},{role:'user',content:user}]})});
 if(!res.ok)throw new UpstreamError(provider,res.status);
 const json=await res.json();
 const content=json.choices?.[0]?.message?.content;
 if(typeof content!=='string'||!content.trim())throw new Error('AI did not return usable text');
 return {output:decodeJson(content),model:String(json.model||model).slice(0,80),input:Number(json.usage?.prompt_tokens||0),outputTokens:Number(json.usage?.completion_tokens||0)};
}
async function callGemini(secret:string,system:string,user:string){
 const res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
 {method:'POST',cache:'no-store',signal:AbortSignal.timeout(23000),
 headers:{'Content-Type':'application/json','x-goog-api-key':secret},
 body:JSON.stringify({systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts:[{text:user}]}],
 generationConfig:{responseMimeType:'application/json',temperature:0.2,maxOutputTokens:maxTokens()}})});
 if(!res.ok)throw new UpstreamError('gemini',res.status);
 const data=await res.json();
 const content=(data.candidates?.[0]?.content?.parts||[]).map((x:{text?:string})=>x.text||'').join('');
 if(!content)throw new Error('Gemini did not return usable text');
 return {output:decodeJson(content),model:'gemini-3.5-flash-lite',
 input:Number(data.usageMetadata?.promptTokenCount||0),outputTokens:Number(data.usageMetadata?.candidatesTokenCount||0)};
}
export async function runRole(role:RoleId,system:string,user:string){
 const ready=await credentials();
 if(!ready.length)throw new Error('Chưa có API khả dụng. Vào Kết nối AI để thêm khóa. Tài khoản ChatGPT hoặc DeepSeek Chat không tự cấp quyền API.');
 const candidates=ready.sort((a,b)=>{
  if(a.mode!==b.mode) return a.mode==='free'?-1:1;
  return SCORES[role][b.id]-SCORES[role][a.id];
 });
 const problems:string[]=[];
 for(const candidate of candidates){
  try{
   await reserve(candidate.id);
   const outcome=candidate.id==='gemini'?await callGemini(candidate.secret,system,user)
    :await callChat(candidate.id==='openrouter'?'https://openrouter.ai/api/v1/chat/completions':
      candidate.id==='deepseek'?'https://api.deepseek.com/chat/completions':'https://api.openai.com/v1/chat/completions',
      candidate.id,candidate.secret,PROVIDER_META.find(p=>p.id===candidate.id)!.model,system,user);
   await recordTokens(candidate.id,outcome.input,outcome.outputTokens);
   return {output:outcome.output,provider:candidate.id,model:outcome.model,usage:{inputTokens:outcome.input,outputTokens:outcome.outputTokens}};
  }catch(e){
   if(e instanceof QuotaDenied){problems.push(e.message);continue;}
   if(e instanceof UpstreamError&&e.status===404){
    problems.push(e.provider==='gemini'
      ?'Gemini model không khả dụng với project này (HTTP 404). Đã chuyển sang Gemini 3.5 Flash-Lite; kiểm tra Free Tier và API Key nếu lỗi tiếp diễn.'
      :e.provider+' model/endpoint returned HTTP 404');
    continue;
   }
   if(e instanceof UpstreamError&&(e.status===429||e.status===503)){
    await cooldown(candidate.id,e.status===429?900:120);
    problems.push(e.message);continue;
   }
   // Authorization errors are not treated as a successful connection or silently retried.
   if(e instanceof UpstreamError && (e.status===401||e.status===403||e.status===402)){
    problems.push(e.message);continue;
   }
   throw e;
  }
 }
 throw new Error('Không có AI nào hoàn thành lượt này. '+problems.join(' | '));
}
