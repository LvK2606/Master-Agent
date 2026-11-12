export const agents = [
 {id:'pm',name:'Project Manager',short:'PM',mission:'Break work into stages, assign owners, define acceptance gates.',color:'#3b82f6'},
 {id:'ba',name:'Business Analyst',short:'BA',mission:'Convert the business request into user stories and measurable acceptance criteria.',color:'#a78bfa'},
 {id:'architect',name:'Solution Architect',short:'ARCH',mission:'Design architecture, data model, security and integrations.',color:'#f59e0b'},
 {id:'ux',name:'Product Designer',short:'UX',mission:'Specify accessible responsive UX and design language.',color:'#ec4899'},
 {id:'fe',name:'Frontend Engineer',short:'FE',mission:'Implement accessible functional UI.',color:'#06b6d4'},
 {id:'be',name:'Backend Engineer',short:'BE',mission:'Implement endpoints, validation, persistence.',color:'#10b981'},
 {id:'qa',name:'QA Engineer',short:'QA',mission:'Review tests, defects and acceptance criteria.',color:'#f97316'},
 {id:'security',name:'Security Engineer',short:'SEC',mission:'Audit credentials, injections, permissions and risk.',color:'#ef4444'},
 {id:'devops',name:'DevOps Engineer',short:'OPS',mission:'Review CI and deployment plan. Never deploy without explicit approval.',color:'#64748b'}
] as const;
export const stages = [
 {name:'Discovery & Requirements',roles:['pm','ba'],instruction:'Create a product requirements document, user stories, MVP scope and acceptance criteria.'},
 {name:'Architecture & UX',roles:['architect','ux'],instruction:'Create a technical architecture with interfaces, database schema and concise UI/UX specification.'},
 {name:'Implementation',roles:['fe','be'],instruction:'Produce implementation file manifest and code files for the requested MVP. Return JSON with files array of {path,content} for a compact runnable application; max 8 files, no secrets.'},
 {name:'Quality & Security',roles:['qa','security'],instruction:'Review previous generated artifacts for bugs, missing tests, injection and security risks. List unresolved items without falsely claiming tests ran.'},
 {name:'Delivery Review',roles:['pm','devops'],instruction:'Create an accurate delivery report, instructions, actual limitations and a manual deployment checklist. Do not claim the app was deployed.'}
] as const;
export async function generate(step:number,prompt:string,prior:unknown) {
 if(!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured. Add it to Vercel environment variables.');
 const stage=stages[step];
 const ctrl=new AbortController(); const timeout=setTimeout(()=>ctrl.abort(),45000);
 try {
  const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',temperature:0.3,response_format:{type:'json_object'},messages:[{role:'system',content:'You are a professional software team with specialists: '+stage.roles.join(', ')+'. Execute this stage: '+stage.instruction+' Respond with a JSON object. Never claim code executed, tested or deployed unless evidence is given. Implement defensively, do not include passwords, production credentials or personal data.'},{role:'user',content:JSON.stringify({request:prompt,previous:prior}).slice(0,16000)}]}),signal:ctrl.signal,cache:'no-store'});
  const value=await res.json();
  if(!res.ok) throw new Error(value.error?.message||'AI request failed');
  const content=value.choices?.[0]?.message?.content;
  if(!content) throw new Error('AI returned no content');
  return JSON.parse(content);
 } finally {clearTimeout(timeout);}
}
