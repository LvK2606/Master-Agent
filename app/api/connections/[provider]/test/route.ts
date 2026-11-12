import {NextResponse} from 'next/server';
import {getConnections,providerId,decryptCredential} from '@/lib/vault';
import {requireSameOrigin} from '@/lib/security';
export const runtime='nodejs';export const maxDuration=15;
export async function POST(req:Request,{params}:{params:Promise<{provider:string}>}){
 if(!requireSameOrigin(req))return NextResponse.json({error:'Invalid origin'},{status:403});
 const {provider}=await params;
 if(!providerId(provider))return NextResponse.json({error:'Invalid provider'},{status:400});
 try{
  const saved=(await getConnections()).find(x=>x.id===provider);
  if(!saved)return NextResponse.json({error:'No stored API Key. Keys set in Vercel are managed there.'},{status:404});
  const key=decryptCredential(saved);
  const endpoint=provider==='openrouter'?'https://openrouter.ai/api/v1/key':
    provider==='gemini'?'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1':
    provider==='deepseek'?'https://api.deepseek.com/models':'https://api.openai.com/v1/models';
  const res=await fetch(endpoint,{method:'GET',cache:'no-store',signal:AbortSignal.timeout(8500),
   headers:provider==='gemini'?{'x-goog-api-key':key}:{Authorization:'Bearer '+key}});
  if(!res.ok)return NextResponse.json({valid:false,status:res.status,message:res.status===401||res.status===403?
   'Khóa bị từ chối hoặc thiếu quyền.':'Nhà cung cấp trả về HTTP '+res.status},{headers:{'Cache-Control':'no-store'}});
  return NextResponse.json({valid:true,message:'Xác thực API Key thành công. Chưa thử sinh nội dung hoặc kiểm tra credit.'},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({valid:false,message:'Không thể xác minh khóa lúc này. Kiểm tra mạng, quota hoặc thử lại.'},{status:502});}
}
