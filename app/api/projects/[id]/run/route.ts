import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generate, stages } from '@/lib/agents';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  if(!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({error:'Invalid id'},{status:400});
  const sql=db();
  try {
    // Stage claim is atomic across concurrent users and API invocations.
    // Stale leases recover only after two minutes; each retry consumes quota.
    const rows=await sql`UPDATE projects SET status='running',updated_at=now()
      WHERE id=${id}::uuid AND stage < 5 AND
      (status IN ('queued','paused','failed') OR (status='running' AND updated_at < now() - interval '2 minutes'))
      RETURNING id,prompt,stage,artifact`;
    if(!rows.length)return NextResponse.json({error:'This stage is running or already completed'},{status:409});
    const project=rows[0];
    const step=Number(project.stage);
    const previous=(project.artifact && typeof project.artifact==='object' && !Array.isArray(project.artifact))?project.artifact:{};
    try {
      const generation=await generate(step,project.prompt,previous);
      const next={...previous,[stages[step].name]:{result:generation.output,model:generation.model,provider:generation.provider,usage:generation.usage}};
      const last=step===4;
      await sql`UPDATE projects SET stage=${step+1}, status=${last?'completed':'paused'},
        artifact=${JSON.stringify(next)}::jsonb,
        report=${last?JSON.stringify(next[stages[step].name]):null}::jsonb,
        error=NULL,updated_at=now() WHERE id=${id}::uuid AND status='running'`;
      return NextResponse.json({stage:step+1,completed:last,provider:generation.provider,model:generation.model});
    }catch(e){
      const message=e instanceof Error?e.message:'Unknown error';
      await sql`UPDATE projects SET status='failed',error=${message.slice(0,450)},updated_at=now() WHERE id=${id}::uuid AND status='running'`;
      return NextResponse.json({error:message.slice(0,450)},{status:message.includes('quota')||message.includes('No free provider')?429:502});
    }
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Database error'},{status:500});
  }
}
