import { NextResponse } from 'next/server';
import { db } from '@/lib/db';import { generateRole, stages } from '@/lib/agents';
import { requireSameOrigin } from '@/lib/security';
export const runtime='nodejs';export const maxDuration=60;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!requireSameOrigin(request))return NextResponse.json({error:'Invalid request origin'},{status:403});
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid id'},{status:400});
 const sql=db();
 try{
  const claimed=await sql`UPDATE projects SET status='running',updated_at=now()
   WHERE id=${id}::uuid AND stage<5 AND (status IN ('queued','paused','failed') OR
   (status='running' AND updated_at < now()-interval '2 minutes')) RETURNING id,prompt,stage,artifact`;
  if(!claimed.length)return NextResponse.json({error:'Mission already running or complete'},{status:409});
  const p=claimed[0],step=Number(p.stage);
  const stage=stages[step];if(!stage)throw new Error('Invalid stage');
  const artifacts:Record<string,unknown>=p.artifact&&typeof p.artifact==='object'&&!Array.isArray(p.artifact)?p.artifact:{};
  const results:Record<string,unknown>={};
  try{
   for(const role of stage.roles){
    const existing=await sql`SELECT status,output,provider,model FROM agent_role_runs
      WHERE project_id=${id}::uuid AND stage=${step} AND role=${role}`;
    if(existing[0]?.status==='completed'){
      results[role]=existing[0].output;continue;
    }
    await sql`INSERT INTO agent_role_runs(project_id,stage,role,status) VALUES(${id}::uuid,${step},${role},'running')
     ON CONFLICT(project_id,stage,role) DO UPDATE SET status='running',error=NULL,started_at=now()`;
    const previous={...artifacts,completedRoles:results};
    try{
      const generation=await generateRole(step,role,String(p.prompt),previous);
      const payload={role,result:generation.output,provider:generation.provider,model:generation.model,usage:generation.usage};
      await sql`UPDATE agent_role_runs SET status='completed',provider=${generation.provider},
       model=${generation.model},output=${JSON.stringify(payload)}::jsonb,error=NULL,finished_at=now()
       WHERE project_id=${id}::uuid AND stage=${step} AND role=${role}`;
      results[role]=payload;
    }catch(err){
      await sql`UPDATE agent_role_runs SET status='failed',error=${(err instanceof Error?err.message:'Agent failed').slice(0,400)},finished_at=now()
       WHERE project_id=${id}::uuid AND stage=${step} AND role=${role}`;
      throw err;
    }
   }
   const last=step===stages.length-1;
   const next={...artifacts,[stage.name]:{roles:results,completed:true}};
   await sql`UPDATE projects SET stage=${step+1},status=${last?'completed':'paused'},
    artifact=${JSON.stringify(next)}::jsonb,report=${last?JSON.stringify(results):null}::jsonb,
    error=NULL,updated_at=now() WHERE id=${id}::uuid AND status='running'`;
   return NextResponse.json({stage:step+1,completed:last,roles:results},{headers:{'Cache-Control':'no-store'}});
  }catch(err){
   const message=err instanceof Error?err.message:'Agent failed';
   await sql`UPDATE projects SET status='failed',error=${message.slice(0,400)},updated_at=now() WHERE id=${id}::uuid AND status='running'`;
   return NextResponse.json({error:message.slice(0,400)},{status:message.includes('quota')?429:502,headers:{'Cache-Control':'no-store'}});
  }
 }catch{
  return NextResponse.json({error:'Unable to start stage'},{status:500});
 }
}
