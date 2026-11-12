import { NextResponse } from 'next/server';
import { getConnections, providerId, redactConnection, saveCredential } from '@/lib/vault';
import { getRolePlan, listProviderStatus } from '@/lib/router';
import { requireSameOrigin } from '@/lib/security';
export const runtime='nodejs';export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
export async function GET(){
 try{
  const [connections,providers,roles]=await Promise.all([getConnections(),listProviderStatus(),getRolePlan()]);
  return NextResponse.json({connections:connections.map(redactConnection),providers,roles,vaultReady:!!process.env.AGENT_VAULT_KEY,
   note:'Personal ChatGPT/DeepSeek/Gemini accounts do not automatically provide API access.'},{headers});
 }catch{return NextResponse.json({error:'Cannot load saved connections'},{status:500,headers});}
}
export async function POST(req:Request){
 if(!requireSameOrigin(req))return NextResponse.json({error:'Invalid request origin'},{status:403,headers});
 try{
  const body=await req.json();
  if(!providerId(body.provider)||typeof body.key!=='string'||body.key.length<12||body.key.length>512||/\s/.test(body.key))
   return NextResponse.json({error:'Provider or API key is invalid'},{status:400,headers});
  await saveCredential(body.provider,body.key,body.freeTierConfirmed===true);
  return NextResponse.json({ok:true,provider:body.provider,saved:true,verified:false},{headers});
 }catch{return NextResponse.json({error:'Could not save key. Check that AGENT_VAULT_KEY is configured.'},{status:500,headers});}
}
