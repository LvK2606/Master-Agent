import { runFreeModel } from './providers';

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
 {name:'Discovery & Requirements',roles:['pm','ba'],instruction:'Create a concise product requirements document, user stories, MVP scope and measurable acceptance criteria.'},
 {name:'Architecture & UX',roles:['architect','ux'],instruction:'Create a practical technical architecture with API definitions, database schema and responsive accessible UI/UX specification.'},
 {name:'Implementation',roles:['fe','be'],instruction:'Generate a compact runnable MVP file manifest in the JSON property files: [{path,content}]. Up to 8 source files, concise and secure, no secrets.'},
 {name:'Quality & Security',roles:['qa','security'],instruction:'Review previous generated artifacts for bugs, missing tests, injections, authorization risks. Explicitly distinguish review findings from tests actually executed.'},
 {name:'Delivery Review',roles:['pm','devops'],instruction:'Create an accurate handoff report, steps to build, remaining tasks and a manual deployment checklist. Never claim code was executed or deployed.'}
] as const;

export async function generate(step:number,prompt:string,prior:unknown) {
  const stage=stages[step];
  if(!stage) throw new Error('Unknown stage');
  const instructions='You are an expert software delivery team. Specialist roles: '+stage.roles.join(', ')+'. Current step: '+stage.name+'. '+stage.instruction+' Reply with exactly ONE JSON object. Do not add markdown fences. Do not claim tests, deployments, commits, integrations or execution happened without evidence. Never output credentials. Be concise and pragmatic.';
  const user=JSON.stringify({request:prompt,previous:prior}).slice(0,14500);
  return runFreeModel(instructions,user);
}
