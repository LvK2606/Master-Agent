import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generate, stages } from '@/lib/agents';
export const runtime='nodejs'; export const maxDuration=60;
export async function POST(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params; if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid id'},{status:400});
 const sql=db();
 try {
  const claim=await sql`UPDATE projects SET status='running',updated_at=now() WHERE id=${id}::uuid AND status IN ('queued','paused','failed') AND stage<5 RETURNING id,prompt,stage,artifact`;
  if(!claim.length)return NextResponse.json({error:'Already running or complete'},{status:409});
  const p=claim[0], step=Number(p.stage), artifacts=typeof p.artifact==='object'&&p.artifact?p.artifact:{};
  try {
   const result=await generate(step,p.prompt,artifacts);
   const next={...artifacts,[stages[step].name]:result};
   const last=step===4;
   await sql`UPDATE projects SET stage=${step+1},status=${last?'completed':'paused'},artifact=${JSON.stringify(next)}::jsonb,report=${last?JSON.stringify(result):null}::jsonb,error=NULL,updated_at=now() WHERE id=${id}::uuid`;
   return NextResponse.json({stage:step+1,completed:last,result});
  }catch(e){
   const error=(e as Error).message.slice(0,500);
   await sql`UPDATE projects SET status='failed',error=${error},updated_at=now() WHERE id=${id}::uuid`;
   return NextResponse.json({error},{status:502});
  }
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:500});}
}
