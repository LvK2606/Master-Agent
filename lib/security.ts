export function requireSameOrigin(request:Request):boolean{
 const origin=request.headers.get('origin');
 if(!origin)return false;
 try{
  const source=new URL(origin),dest=new URL(request.url);
  return source.protocol===dest.protocol&&source.host===dest.host;
 }catch{return false;}
}
