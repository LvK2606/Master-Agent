import { db } from '@/lib/db';

export type FreeProvider = 'openrouter' | 'gemini';
function safeLimit(value: string | undefined, fallback: number, hardMaximum: number) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(n, hardMaximum) : fallback;
}

export function limits() {
  return {
    total: safeLimit(process.env.AI_DAILY_LIMIT, 15, 50),
    openrouter: safeLimit(process.env.OPENROUTER_DAILY_LIMIT, 12, 50),
    gemini: safeLimit(process.env.GEMINI_DAILY_LIMIT, 5, 25),
  };
}

export class QuotaDenied extends Error {
  readonly reason: string;
  constructor(provider: string, reason: string) {
    super(provider + ': quota blocked (' + reason + '). See your usage dashboard.');
    this.name = 'QuotaDenied';
    this.reason = reason;
  }
}

export async function reserve(provider: FreeProvider) {
  const l = limits();
  const sql = db();
  const rows = await sql`SELECT reserve_ai_call(${provider},${l.total},${l[provider]}) AS verdict`;
  const verdict = rows[0]?.verdict as {allowed?:boolean, reason?:string};
  if (!verdict?.allowed) throw new QuotaDenied(provider, verdict?.reason || 'unknown');
}

export async function recordTokens(provider: FreeProvider, input: number, output: number) {
  const sql = db();
  await sql`SELECT record_ai_usage(${provider},${Math.max(0,Math.floor(input))},${Math.max(0,Math.floor(output))})`;
}
export async function cooldown(provider: FreeProvider, seconds: number) {
  const sql = db();
  await sql`SELECT cooldown_ai_provider(${provider},${Math.floor(seconds)})`;
}
