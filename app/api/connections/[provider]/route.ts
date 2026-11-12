import { NextResponse } from 'next/server';
import { getConnections,providerId,removeCredential,updateCredential } from '@/lib/vault';
import { requireSameOrigin } from '@/lib/security';
export const runtime='nodejs';
type Ctx={params:Promise<{provider:string}>};
const headers={'Cache-Control':'no-store'};
export async function PATCH(req:Request,{params}:Ctx){
 if(!requireSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 const {provider}=await params;
 if(!providerId(provider))return NextResponse.json({error:'Invalid provider'},{status:400,headers});
 try{
  const body=await req.json();const saved=(await getConnections()).find(x=>x.id===provider);
  if(!saved)return NextResponse.json({error:'No stored key for this provider'},{status:404,headers});
  const enabled=typeof body.enabled==='boolean'?body.enabled:saved.enabled;
  const allowPaid=typeof body.allowPaid==='boolean'?body.allowPaid:saved.allowPaid;
  const freeTierConfirmed=typeof body.freeTierConfirmed==='boolean'?body.freeTierConfirmed:saved.freeTierConfirmed;
  if((provider==='deepseek'||provider==='openai')&&allowPaid&&body.confirm!=='I_ACCEPT_API_CHARGES')
   return NextResponse.json({error:'Paid API must be explicitly approved with confirmation'},{status:400,headers});
  const updated=await updateCredential(provider,enabled,allowPaid,freeTierConfirmed);
  return NextResponse.json({ok:updated},{headers});
 }catch{return NextResponse.json({error:'Failed to update provider'},{status:500,headers});}
}
export async function DELETE(req:Request,{params}:Ctx){
 if(!requireSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403,headers});
 const {provider}=await params;
 if(!providerId(provider))return NextResponse.json({error:'Invalid provider'},{status:400,headers});
 try{await removeCredential(provider);return NextResponse.json({ok:true},{headers});}
 catch{return NextResponse.json({error:'Failed to disconnect provider'},{status:500,headers});}
}
