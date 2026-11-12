import { NextRequest, NextResponse } from 'next/server';
export function middleware(req: NextRequest) {
  const password = process.env.MASTER_PASSWORD;
  if (!password) return new NextResponse('MASTER_PASSWORD must be configured.', { status: 503 });
  const token = req.headers.get('authorization') || '';
  if (!token.startsWith('Basic ')) return unauthorized();
  let creds = '';
  try { creds = atob(token.slice(6)); } catch { return unauthorized(); }
  const split = creds.indexOf(':');
  if (split < 0 || creds.slice(split + 1) !== password) return unauthorized();
  return NextResponse.next();
}
function unauthorized() { return new NextResponse('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Master Agent"', 'Cache-Control':'no-store' } }); }
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
