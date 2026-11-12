import { NextResponse } from 'next/server';
import { db } from '@/lib/db';import { limits } from '@/lib/budget';
import { listProviderStatus } from '@/lib/router';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const sql=db();const caps=limits();
  const [total,usage,providers]=await Promise.all([
   sql`SELECT calls FROM ai_daily_gate WHERE day=(now() AT TIME ZONE 'UTC')::date`,
   sql`SELECT provider,calls,prompt_tokens,completion_tokens,blocked_until FROM agent_provider_daily WHERE day=(now() AT TIME ZONE 'UTC')::date`,
   listProviderStatus()
  ]);
  return NextResponse.json({dateUTC:new Date().toISOString().slice(0,10),resetAt:'00:00 UTC',
   dailyLimit:caps.total,dailyUsed:Number(total[0]?.calls||0),freeOnly:!providers.some(p=>p.paid&&p.available),
   automaticDeployments:false,providers:providers.map(p=>{
    const row=usage.find(x=>x.provider===p.id);
    return {id:p.id,label:p.label,model:p.model,configured:p.available,connected:p.connected,paid:p.paid,
     limit:caps[p.id],calls:Number(row?.calls||0),
     inputTokens:Number(row?.prompt_tokens||0),outputTokens:Number(row?.completion_tokens||0),
     blockedUntil:row?.blocked_until||null};
   })},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Unable to load quota data'},{status:500});}
}
