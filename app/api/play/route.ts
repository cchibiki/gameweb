import { store } from '@/db/store';
import { applyAction, cleanText, configFrom, insist, newRoom, publicRoom, roomSummary, type Room, type Action } from '@/lib/game-engine';
export const dynamic='force-dynamic';
type User={id:string;name:string;updated:number};
const cookieName='playroom_session';
async function hash(token:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),x=>x.toString(16).padStart(2,'0')).join('');}
async function session(request:Request,db:ReturnType<typeof store>){
  const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(token&&/^[a-f0-9]{64}$/.test(token)){const user=await db.prepare('SELECT id,name,updated FROM players WHERE token_hash=?').bind(await hash(token)).first<User>();if(user)return {user,cookie:null};}
  const bytes=crypto.getRandomValues(new Uint8Array(32));const fresh=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
  const user:User={id:crypto.randomUUID(),name:'快乐玩家'+String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0'),updated:Date.now()};
  await db.prepare('INSERT INTO players (id,token_hash,name,updated) VALUES (?,?,?,?)').bind(user.id,await hash(fresh),user.name,user.updated).run();
  return {user,cookie:`${cookieName}=${fresh}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${new URL(request.url).protocol==='https:'?'; Secure':''}`};
}
function response(body:unknown,cookie:string|null=null,status=200){return Response.json(body,{status,headers:{'Cache-Control':'no-store',...(cookie?{'Set-Cookie':cookie}:{})}});}
async function handle(request:Request){let cookie:string|null=null;try{
  const db=store();const auth=await session(request,db);cookie=auth.cookie;const user=auth.user;
  if(request.method==='GET'){
    const roomId=new URL(request.url).searchParams.get('room');
    if(roomId){const row=await db.prepare('SELECT payload FROM rooms WHERE id=?').bind(roomId).first<{payload:string}>();insist(row,'房间不存在或已经关闭');const r=JSON.parse(row.payload) as Room;insist(r.members.some(p=>p.id===user.id),'请先加入这个房间');return response({user,room:publicRoom(r,user.id)},cookie);}
    const rows=await db.prepare('SELECT payload FROM rooms WHERE updated>? ORDER BY updated DESC LIMIT 100').bind(Date.now()-7*86400000).all<{payload:string}>();
    return response({user,rooms:rows.results.map(row=>JSON.parse(row.payload) as Room).filter(r=>r.members.length).map(roomSummary)},cookie);
  }
  const origin=request.headers.get('origin');insist(!origin||origin===new URL(request.url).origin,'请求来源无效');
  insist(request.headers.get('content-type')?.includes('application/json'),'请求格式无效');
  const raw=await request.text();insist(raw.length<8192,'请求内容过长');const a=JSON.parse(raw) as Action;insist(a&&typeof a==='object'&&typeof a.type==='string','请求内容无效');
  if(a.type==='profile'){user.name=cleanText(a.name,16);await db.prepare('UPDATE players SET name=?,updated=? WHERE id=?').bind(user.name,Date.now(),user.id).run();
    if(typeof a.room!=='string')return response({user},cookie);
    a.type='rename';
  }
  if(a.type==='create'){
    const config=configFrom(a.config);const name=cleanText(a.name);const owned=await db.prepare('SELECT payload FROM rooms WHERE updated>?').bind(Date.now()-7*86400000).all<{payload:string}>();
    insist(owned.results.filter(row=>(JSON.parse(row.payload) as Room).host===user.id).length<5,'你已有 5 个房间，请先离开旧房间');
    const id=crypto.randomUUID().slice(0,8).toUpperCase();const r=newRoom(id,name,config,user);
    await db.prepare('INSERT INTO rooms (id,payload,revision,updated) VALUES (?,?,0,?)').bind(id,JSON.stringify(r),Date.now()).run();return response({user,room:publicRoom(r,user.id)},cookie);
  }
  insist(typeof a.room==='string'&&/^[A-F0-9]{8}$/.test(a.room),'房间编号无效');
  for(let attempt=0;attempt<6;attempt++){
    const row=await db.prepare('SELECT payload,revision FROM rooms WHERE id=?').bind(a.room).first<{payload:string;revision:number}>();insist(row,'房间不存在或已经关闭');const r=applyAction(JSON.parse(row.payload) as Room,user,a);
    const result=r.members.length?await db.prepare('UPDATE rooms SET payload=?,revision=revision+1,updated=? WHERE id=? AND revision=?').bind(JSON.stringify(r),Date.now(),a.room,row.revision).run():await db.prepare('DELETE FROM rooms WHERE id=? AND revision=?').bind(a.room,row.revision).run();
    if(result.meta.changes)return response({user,room:a.type==='leave'?null:publicRoom(r,user.id)},cookie);
  }
  return response({error:'房间状态刚刚更新，请重试本次操作'},cookie,409);
}catch(error){const message=error instanceof Error?error.message:'联机服务暂时不可用';const storage=/D1|SQLITE|binding|database|JSON/i.test(message);if(storage)console.error('Playroom request failed',message);return response({error:storage?'联机服务暂时不可用，请稍后重试':message},cookie,storage?503:400);}}
export const GET=handle;
export const POST=handle;
