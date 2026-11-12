'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,Check,ExternalLink,KeyRound,Lock,RefreshCw,ShieldCheck,Trash2,Workflow} from 'lucide-react';
type Id='openrouter'|'gemini'|'deepseek'|'openai';
type Provider={id:Id,label:string,model:string,url:string,paid:boolean,connected:boolean,enabled:boolean,available:boolean,allowPaid:boolean,freeTierConfirmed:boolean,keyHint:string,source:string};
type Role={id:string,name:string,specialty:string,preferred:Id|null,fallbacks:Id[],rationale:string};
type Data={providers:Provider[],roles:Role[],vaultReady:boolean};
const details:Record<Id,string>={
 openrouter:'Model miễn phí openrouter/free; hạn mức do nhà cung cấp áp dụng.',
 gemini:'Gemini 2.5 Flash-Lite. Cần xác nhận project Google AI Studio đang ở Free tier.',
 deepseek:'DeepSeek Flash dùng API tính phí theo token, độc lập với tài khoản DeepSeek Chat.',
 openai:'OpenAI API tính phí riêng với ChatGPT Plus/Pro. Lưu khóa không tự bật trả phí.'
};
export default function Connections(){
 const [data,setData]=useState<Data|null>(null),[keys,setKeys]=useState<Partial<Record<Id,string>>>({});
 const [show,setShow]=useState<Partial<Record<Id,boolean>>>({}),[confirmed,setConfirmed]=useState(false);
 const [working,setWorking]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');const [testResult,setTestResult]=useState<Partial<Record<Id,string>>>({});
 const load=useCallback(async()=>{try{const r=await fetch('/api/connections',{cache:'no-store'});const j=await r.json();
  if(!r.ok)throw Error(j.error||'Cannot load connections');setData(j);
 }catch(e){setError((e as Error).message)}},[]);
 useEffect(()=>{void load()},[load]);
 async function act(name:string,method:string,url:string,body?:unknown){
  setWorking(name);setError('');setMessage('');
  try{const r=await fetch(url,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
    const json=await r.json();if(!r.ok)throw Error(json.error||'Request failed');
    await load();setMessage('Đã lưu. Thay đổi khóa không cần tạo Vercel deployment.');return true;
  }catch(e){setError((e as Error).message);return false}
  finally{setWorking('')}
 }
 async function save(id:Id){
  const key=(keys[id]||'').trim();
  if(key.length<12){setError('API Key phải có ít nhất 12 ký tự');return}
  const ok=await act('save-'+id,'POST','/api/connections',{provider:id,key,freeTierConfirmed:id==='gemini'&&confirmed});
  if(ok){setKeys(k=>({...k,[id]:''}));setConfirmed(false)}
 }
 async function update(p:Provider,change:object,paid=false){
  if(paid&&!window.confirm('Cho phép API tính phí? Giới hạn số lượt gọi KHÔNG phải giới hạn số tiền và có thể phát sinh phí theo token.'))return;
  await act('edit-'+p.id,'PATCH','/api/connections/'+p.id,{...change,...(paid?{confirm:'I_ACCEPT_API_CHARGES'}:{})});
 }
 async function test(p:Provider){
  setWorking('test-'+p.id);setError('');
  try{
    const r=await fetch('/api/connections/'+p.id+'/test',{method:'POST'});
    const j=await r.json();
    setTestResult(current=>({...current,[p.id]:(j.valid?'✓ ':'✕ ')+(j.message||'Không có kết quả')}));
  }catch{setTestResult(current=>({...current,[p.id]:'✕ Không thể kết nối đến API'})}
  finally{setWorking('')}
 }
 async function remove(p:Provider){
  if(!window.confirm('Xóa API Key của '+p.label+' khỏi kho mã hóa?'))return;
  await act('remove-'+p.id,'DELETE','/api/connections/'+p.id);
 }
 return <div className="connectionsPage"><div className="connectionsContainer">
   <header className="connectionsHeader"><a href="/" className="secondary" style={{display:'inline-flex',alignItems:'center',gap:8}}><ArrowLeft size={16}/>Dashboard</a><span className="tag"><Lock size={13}/> API Vault</span></header>
   <p className="tiny" style={{letterSpacing:2,color:'#aefa83'}}>MASTER-AGENT / AI CONNECTIONS</p>
   <h1>Kết nối các AI của bạn<span style={{color:'#b3f58c'}}>.</span></h1>
   <p className="lead">Thêm API Key chính thức từ DeepSeek, OpenAI, Gemini hoặc OpenRouter. Master-Agent phân chia công việc theo điểm mạnh đề xuất, tình trạng kết nối và giới hạn quota.</p>
   <div className="notice" style={{margin:'18px 0'}}><ShieldCheck size={17} style={{verticalAlign:'middle',marginRight:8}}/> Không nhập mật khẩu tài khoản ChatGPT, DeepSeek Chat hay Gemini. Gói chat không mặc nhiên cung cấp API. API trả phí luôn tắt mặc định.</div>
   {data&&!data.vaultReady&&<p className="error">AGENT_VAULT_KEY chưa được cấu hình; không thể lưu API Key.</p>}
   <div className="providerCards">
     {(data?.providers||[]).map(p=><section className="panel providerCard" key={p.id}>
       <div className="providerTitle"><div><h2 style={{margin:'0 0 8px'}}>{p.label}</h2><span className="tiny">{p.model}</span></div><span className={'status '+(p.available?'completed':'')}>{p.available?'Đã bật · Chưa xác minh':p.connected?'Đã lưu · Chưa bật':'Chưa kết nối'}</span></div>
       <p className="tiny" style={{lineHeight:1.7,minHeight:49,marginTop:15}}>{details[p.id]}</p>
       {p.connected&&<p className="tiny" style={{color:'#b4ed9d'}}>✓ Đã lưu {p.keyHint?' · cuối '+p.keyHint:''} · Nguồn {p.source==='vault'?'kho mã hóa':'Vercel'}</p>}
       <div className="keyField"><input aria-label={'API Key '+p.id} type={show[p.id]?'text':'password'} value={keys[p.id]||''}
         placeholder={p.connected?'Dán khóa mới để thay thế':'Dán API Key tại đây'}
         autoComplete="off" spellCheck={false} onChange={e=>setKeys(k=>({...k,[p.id]:e.target.value}))}/>
         <button aria-label="Ẩn/hiện API Key" className="secondary" onClick={()=>setShow(s=>({...s,[p.id]:!s[p.id]}))}>{show[p.id]?'Ẩn':'Hiện'}</button></div>
       {p.id==='gemini'&&<label className="tiny freeConfirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Tôi xác nhận project Gemini này dùng Free tier và không bật billing tính phí.</label>}
       <div className="connectBtns"><button className="primary" disabled={!!working||!data?.vaultReady||!(keys[p.id]||'').trim()} onClick={()=>void save(p.id)}><KeyRound size={15}/>{p.connected?'Thay API Key':'Lưu API Key'}</button>
         <a href={p.url} target="_blank" rel="noopener noreferrer" className="secondary" style={{display:'inline-flex',alignItems:'center',gap:6}}>Tạo Key <ExternalLink size={13}/></a></div>
       {p.connected&&p.source==='vault'&&<div className="providerAdmin">
         <button className="secondary" disabled={!!working} onClick={()=>void test(p)}>Kiểm tra API Key</button>
         <button className="secondary" disabled={!!working} onClick={()=>void update(p,{enabled:!p.enabled})}>{p.enabled?'Tạm dừng':'Bật lại'}</button>
         {p.paid&&<button className="secondary" disabled={!!working} onClick={()=>void update(p,{allowPaid:!p.allowPaid},!p.allowPaid)}>{p.allowPaid?'Khóa API trả phí':'Cho phép dùng API trả phí'}</button>}
         {p.id==='gemini'&&<button className="secondary" disabled={!!working} onClick={()=>void update(p,{freeTierConfirmed:!p.freeTierConfirmed})}>{p.freeTierConfirmed?'Bỏ xác nhận free':'Xác nhận Free tier'}</button>}
         <button className="secondary" disabled={!!working} aria-label="Xóa API Key" onClick={()=>void remove(p)}><Trash2 size={15}/></button>
       </div>}{testResult[p.id]&&<p className="tiny" role="status" style={{lineHeight:1.7,marginTop:10}}>{testResult[p.id]}</p>}
     </section>)}
   </div>
   <section className="panel" style={{marginTop:22}}>
    <div className="panelHead"><h2><Workflow size={19} style={{verticalAlign:'middle',color:'#b3f58c',marginRight:8}}/> Phân công tự động</h2><button className="secondary" onClick={()=>void load()}><RefreshCw size={15}/></button></div>
    <p className="tiny" style={{lineHeight:1.7}}>Bảng ưu tiên dùng đánh giá theo vai trò được cấu hình trong hệ thống, không phải kết quả benchmark tuyệt đối. Khi provider ưu tiên hết quota, agent thử các provider khác đã được cấp phép.</p>
    <div className="roleTable"><div className="roleRow roleHeader"><span>Vai trò</span><span>Chuyên môn</span><span>AI ưu tiên</span></div>
    {(data?.roles||[]).map(role=><div className="roleRow" key={role.id}><span><span className="roleBadge">{role.id.toUpperCase()}</span> {role.name}</span><span className="tiny">{role.specialty}</span><span>{role.preferred?<strong>{data?.providers.find(p=>p.id===role.preferred)?.label||role.preferred}</strong>:<span className="tiny">Chưa có API</span>}</span></div>)}</div>
   </section>
   {error&&<div className="notice" role="alert" style={{borderColor:'#8e4444',marginTop:17,color:'#ffb4b4'}}>{error}</div>}
   {message&&<p style={{color:'#bcf58f',marginTop:18}}><Check size={15} style={{verticalAlign:'middle',marginRight:7}}/>{message}</p>}
   <div className="footer" style={{padding:'28px 0'}}>API Key lưu dưới dạng mã hóa AES-256-GCM trên server. Kho kết nối hiện dùng chung cho một quản trị viên Master-Agent.</div>
  </div></div>;
}
