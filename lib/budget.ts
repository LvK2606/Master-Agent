import { db } from '@/lib/db';
import type { ProviderId } from './vault';
function limit(value:string|undefined,defaultValue:number,ceiling:number) {
 const n=Number(value);
 return Number.isInteger(n)&&n>0?Math.min(n,ceiling):defaultValue;
}
export function limits(){
 return {
  total:limit(process.env.AI_DAILY_LIMIT,15,50),
  openrouter:limit(process.env.OPENROUTER_DAILY_LIMIT,12,50),
  gemini:limit(process.env.GEMINI_DAILY_LIMIT,5,25),
  deepseek:limit(process.env.DEEPSEEK_DAILY_LIMIT,3,10),
  openai:limit(process.env.OPENAI_DAILY_LIMIT,3,10)
 };
}
export class QuotaDenied extends Error {
 constructor(public provider:ProviderId,public reason:string){
  super(provider+': quota unavailable ('+reason+')');this.name='QuotaDenied';
 }
}
export async function reserve(provider:ProviderId){
 const caps=limits();const sql=db();
 const result=await sql`SELECT reserve_agent_call(${provider},${caps.total},${caps[provider]}) AS verdict`;
 const verdict=result[0]?.verdict as {allowed?:boolean,reason?:string}|undefined;
 if(!verdict?.allowed)throw new QuotaDenied(provider,verdict?.reason||'unknown');
}
export async function recordTokens(provider:ProviderId,input:number,output:number){
 const sql=db();
 await sql`SELECT record_agent_tokens(${provider},${Math.max(0,Math.floor(input))},${Math.max(0,Math.floor(output))})`;
}
export async function cooldown(provider:ProviderId,seconds:number){
 const sql=db();await sql`SELECT cooldown_agent_provider(${provider},${Math.floor(seconds)})`;
}
