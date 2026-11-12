import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { limits } from '@/lib/budget';
import { providerList } from '@/lib/providers';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET() {
  try {
    const sql=db();const l=limits();
    const used=await sql`SELECT calls FROM ai_daily_gate WHERE day=(now() AT TIME ZONE 'UTC')::date`;
    const perProvider=await sql`SELECT provider,calls,prompt_tokens,completion_tokens,blocked_until FROM ai_usage WHERE day=(now() AT TIME ZONE 'UTC')::date`;
    const data=providerList().map(p=>{
      const row=perProvider.find(r=>r.provider===p.id);
      return {id:p.id,label:p.label,model:p.model,configured:p.configured,limit:l[p.id],calls:Number(row?.calls||0),inputTokens:Number(row?.prompt_tokens||0),outputTokens:Number(row?.completion_tokens||0),blockedUntil:row?.blocked_until||null};
    });
    return NextResponse.json({dateUTC:new Date().toISOString().slice(0,10),resetAt:'00:00 UTC',dailyLimit:l.total,dailyUsed:Number(used[0]?.calls||0),providers:data,freeOnly:true,automaticDeployments:false},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Usage unavailable'},{status:500});}
}
