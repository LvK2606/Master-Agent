import { NextResponse } from 'next/server';
import { listProviderStatus } from '@/lib/router';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(){
 try{
  const providers=await listProviderStatus();
  return NextResponse.json({ready:Boolean(process.env.DATABASE_URL&&providers.some(p=>p.available)),
   databaseConfigured:!!process.env.DATABASE_URL,aiConfigured:providers.some(p=>p.available),
   providers:providers.map(({id,label,model,available,connected})=>({id,label,model,available,connected})),
   vaultReady:!!process.env.AGENT_VAULT_KEY,mode:'BYOK, free-first, paid opt-in, manual deploy'},
   {headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({ready:false,aiConfigured:false,databaseConfigured:!!process.env.DATABASE_URL,error:'Unable to inspect providers'},{status:503});}
}
