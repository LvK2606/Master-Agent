import { NextResponse } from 'next/server';
import { availableProviders,providerList } from '@/lib/providers';
export const runtime='nodejs';
export async function GET(){
  return NextResponse.json({ready:Boolean(process.env.DATABASE_URL && availableProviders().length),databaseConfigured:Boolean(process.env.DATABASE_URL),aiConfigured:availableProviders().length>0,providers:providerList().map(p=>({id:p.id,label:p.label,model:p.model,configured:p.configured})),githubWriteConfigured:false,mode:'free-only / manual deployment approval'},{headers:{'Cache-Control':'no-store'}});
}
