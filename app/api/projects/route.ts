import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
export const runtime='nodejs'; export const dynamic='force-dynamic';
export async function GET(){
 try {const sql=db();const rows=await sql`SELECT id,title,prompt,status,stage,plan,artifact,report,error,created_at FROM projects ORDER BY created_at DESC LIMIT 50`;return NextResponse.json({projects:rows});}
 catch(e){return NextResponse.json({error:(e as Error).message},{status:500});}
}
export async function POST(req:Request){
 try{
  const body=await req.json();const prompt=typeof body.prompt==='string'?body.prompt.trim():'';
  if(prompt.length<15||prompt.length>7000)return NextResponse.json({error:'Prompt must be between 15 and 7000 characters'},{status:400});
  const title=prompt.slice(0,72);const sql=db();
  const rows=await sql`INSERT INTO projects(title,prompt,status) VALUES(${title},${prompt},'queued') RETURNING id,title,status,stage,created_at`;
  return NextResponse.json({project:rows[0]},{status:201});
 }catch(e){return NextResponse.json({error:(e as Error).message},{status:500});}
}
