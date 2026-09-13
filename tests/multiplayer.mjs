import assert from 'node:assert/strict';
const origin=process.env.PLAYROOM_TEST_URL||'http://localhost:5173';
const config=(game,capacity=2)=>({game,capacity,rounds:2,boardSize:9});
class Client{cookie='';user=null;async call(action,room){const res=await fetch(origin+'/api/play'+(room?'?room='+room:''),{method:action?'POST':'GET',headers:{Cookie:this.cookie,...(action?{'Content-Type':'application/json',Origin:origin}:{})},...(action?{body:JSON.stringify(action)}:{})});const c=res.headers.get('set-cookie');if(c)this.cookie=c.split(';')[0];const d=await res.json();if(!res.ok)throw new Error(d.error);this.user=d.user;return d;}}
const clients=Array.from({length:8},()=>new Client());let id;
try{
 for(let i=0;i<clients.length;i++){await clients[i].call();await clients[i].call({type:'profile',name:'联机测试'+(i+1)});}
 const initial=await clients[0].call({type:'create',name:'自动验证房间',config:config('werewolf',8)});id=initial.room.id;
 await Promise.all(clients.slice(1).map(c=>c.call({type:'join',room:id})));
 let r=(await clients[0].call(undefined,id)).room;assert.equal(r.members.length,8);
 await assert.rejects(clients[1].call({type:'configure',room:id,name:'越权',config:config('go')}),/房主/);
 await clients[0].call({type:'configure',room:id,name:'超员保留验证',config:config('tictactoe')});
 r=(await clients[7].call(undefined,id)).room;assert.equal(r.members.length,8);assert.equal(r.members.filter(p=>p.seat===null).length,6);
 const p0=clients.find(c=>c.user.id===r.members.find(p=>p.seat===0).id),p1=clients.find(c=>c.user.id===r.members.find(p=>p.seat===1).id);
 await p1.call({type:'ready',room:id});await clients[0].call({type:'start',room:id});
 const competing=await Promise.allSettled([p0.call({type:'move',room:id,index:0}),p0.call({type:'move',room:id,index:1})]);assert.equal(competing.filter(v=>v.status==='fulfilled').length,1);
 r=(await p1.call(undefined,id)).room;assert.equal(r.match.board.filter(Boolean).length,1);
 await assert.rejects(clients.find(c=>r.members.some(p=>p.id===c.user.id&&p.seat===null)).call({type:'move',room:id,index:8}),/旁观/);
 await p1.call({type:'resign',room:id});assert.equal((await p0.call(undefined,id)).room.match.phase,'finished');
 await clients[0].call({type:'configure',room:id,name:'身份隔离验证',config:config('undercover',8)});
 for(const c of clients.slice(1))await c.call({type:'ready',room:id});await clients[0].call({type:'start',room:id});
 const states=await Promise.all(clients.map(c=>c.call(undefined,id)));states.forEach(({room})=>{assert.ok(room.secret.word);assert.equal(room.secret.role,null);assert.equal(room.match.words,undefined);assert.equal(room.match.roles,undefined);});
 const observer=new Client();await observer.call();await observer.call({type:'join',room:id});assert.equal((await observer.call(undefined,id)).room.secret,null);await observer.call({type:'leave',room:id});
 await clients[0].call({type:'profile',room:id,name:'已更新名称'});assert.equal((await clients[1].call(undefined,id)).room.members.find(p=>p.id===clients[0].user.id).name,'已更新名称');
 console.log('PASS: 8 independent sessions, concurrent joins, server authorization, 6 overflow spectators, atomic moves, shared results, hidden roles, profile sync.');
}finally{if(id)for(const c of clients){try{await c.call({type:'leave',room:id});}catch{}}}
