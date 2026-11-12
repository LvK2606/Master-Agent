import { runRole, type RoleId } from './router';
export const agents=[
 {id:'pm',name:'Project Manager'}, {id:'ba',name:'Business Analyst'}, {id:'architect',name:'Solution Architect'},
 {id:'ux',name:'Product Designer'}, {id:'fe',name:'Frontend Engineer'}, {id:'be',name:'Backend Engineer'},
 {id:'qa',name:'QA Engineer'}, {id:'security',name:'Security Engineer'}, {id:'devops',name:'DevOps Engineer'}
] as const;
export const stages=[
 {name:'Discovery & Requirements',roles:['pm','ba'] as RoleId[],instruction:'Define requirements, scope, acceptance criteria and clear user stories.'},
 {name:'Architecture & UX',roles:['architect','ux'] as RoleId[],instruction:'Propose architecture, data model, and accessible responsive interface design.'},
 {name:'Implementation',roles:['fe','be'] as RoleId[],instruction:'Produce concise implementation source file manifest in JSON key files as [{path,content}]; maximum 6 files per role. Never include secrets.'},
 {name:'Quality & Security',roles:['qa','security'] as RoleId[],instruction:'Audit generated artifacts and identify issues, necessary tests and security gaps. Do not claim tests were run.'},
 {name:'Delivery Review',roles:['devops','pm'] as RoleId[],instruction:'Provide precise handoff report and deployment instructions. Do not claim anything was deployed.'}
] as const;
export async function generateRole(step:number,role:RoleId,prompt:string,prior:unknown){
 const stage=stages[step];if(!stage||!stage.roles.includes(role))throw new Error('Invalid stage or agent role');
 const instructions='You are a senior '+(agents.find(x=>x.id===role)?.name||role)+
 '. You are ONE agent in a multi-agent software company. Stage: '+stage.name+
 '. Your task: '+stage.instruction+' Focus only on responsibilities for '+role+
 '. Coordinate with prior outputs, avoid repeating completed work. Return exactly ONE JSON object. '+
 'Do not invent tests, executed code, commits, deployments, or credentials. Keep output compact and specific.';
 const user=JSON.stringify({request:prompt,context:prior}).slice(0,14000);
 return runRole(role,instructions,user);
}
