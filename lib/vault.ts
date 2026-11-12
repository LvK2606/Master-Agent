import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { db } from '@/lib/db';

export const PROVIDERS=['openrouter','gemini','deepseek','openai'] as const;
export type ProviderId=typeof PROVIDERS[number];
export function providerId(value:unknown):value is ProviderId {
 return typeof value==='string' && PROVIDERS.some(id=>id===value);
}
export type Connection={id:ProviderId,enabled:boolean,allowPaid:boolean,freeTierConfirmed:boolean,keyHint:string,updatedAt:string};
export type StoredConnection=Connection&{secretCipher:string};
function masterKey(){
 const raw=process.env.AGENT_VAULT_KEY||'';
 if(!/^[0-9a-f]{64}$/i.test(raw)) throw new Error('AGENT_VAULT_KEY must be configured as 64 hex characters in Vercel');
 return Buffer.from(raw,'hex');
}
function seal(value:string){
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',masterKey(),iv);
 const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join('.');
}
function open(value:string){
 const parts=value.split('.');
 if(parts.length!==3) throw new Error('Invalid encrypted credential');
 const decipher=createDecipheriv('aes-256-gcm',masterKey(),Buffer.from(parts[0],'base64'));
 decipher.setAuthTag(Buffer.from(parts[1],'base64'));
 return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64')),decipher.final()]).toString('utf8');
}
export async function getConnections():Promise<StoredConnection[]>{
 const sql=db();
 const rows=await sql`SELECT provider,secret_cipher,key_hint,enabled,allow_paid,free_tier_confirmed,updated_at FROM agent_credentials ORDER BY provider`;
 return rows.map(row=>({
  id:row.provider as ProviderId,secretCipher:String(row.secret_cipher),keyHint:String(row.key_hint),
  enabled:Boolean(row.enabled),allowPaid:Boolean(row.allow_paid),
  freeTierConfirmed:Boolean(row.free_tier_confirmed),
  updatedAt:String(row.updated_at)
 }));
}
export function redactConnection(item:StoredConnection):Connection {
 const {secretCipher:_secret,...safe}=item;
 void _secret;
 return safe;
}
export function decryptCredential(item:StoredConnection):string{return open(item.secretCipher);}
export async function saveCredential(id:ProviderId,apiKey:string,freeTierConfirmed:boolean){
 const sql=db();
 const cipher=seal(apiKey);
 const hint=apiKey.slice(-4).replace(/[^a-zA-Z0-9]/g,'*');
 await sql`INSERT INTO agent_credentials(provider,secret_cipher,key_hint,enabled,allow_paid,free_tier_confirmed)
 VALUES(${id},${cipher},${hint},true,false,${id==='gemini'&&freeTierConfirmed})
 ON CONFLICT(provider) DO UPDATE SET secret_cipher=EXCLUDED.secret_cipher,key_hint=EXCLUDED.key_hint,
 enabled=true,allow_paid=false,free_tier_confirmed=EXCLUDED.free_tier_confirmed,updated_at=now()`;
}
export async function updateCredential(id:ProviderId,enabled:boolean,allowPaid:boolean,freeTierConfirmed:boolean){
 const sql=db();
 const rows=await sql`UPDATE agent_credentials SET enabled=${enabled},allow_paid=${allowPaid},free_tier_confirmed=${freeTierConfirmed},updated_at=now() WHERE provider=${id} RETURNING provider`;
 return rows.length>0;
}
export async function removeCredential(id:ProviderId){
 const sql=db();
 await sql`DELETE FROM agent_credentials WHERE provider=${id}`;
}
