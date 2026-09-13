export type GameType = 'gomoku' | 'go' | 'tictactoe' | 'undercover' | 'werewolf';
export const GAME_META: Record<GameType, {name:string;min:number;max:number;default:number}> = {
  gomoku:{name:'五子棋',min:2,max:2,default:2}, go:{name:'围棋',min:2,max:2,default:2},
  tictactoe:{name:'井字棋',min:2,max:2,default:2}, undercover:{name:'谁是卧底',min:3,max:12,default:6},
  werewolf:{name:'狼人杀',min:6,max:12,default:8},
};
export type Config = {game:GameType;capacity:number;rounds:number;boardSize:number};
export type Member = {id:string;name:string;seat:number|null;ready:boolean;watch:boolean};
type Message = {id:string;name:string;text:string;system:boolean};
export type Match = {
  phase:'board'|'discussion'|'vote'|'wolves'|'seer'|'witch'|'finished';
  players:string[];turn:string;board:number[];size:number;history:string[];passes:number;captures:number[];
  roles:Record<string,string>;words:Record<string,string>;notes:Record<string,string[]>;alive:string[];
  votes:Record<string,string>;spoken:string[];day:number;victim:string|null;potions:{save:boolean;poison:boolean};
  result:string;winners:string[];lastMove:number|null;
};
export type Room = {id:string;name:string;host:string;config:Config;members:Member[];created:number;round:number;scores:Record<string,number>;match:Match|null;messages:Message[]};
export type Action = {type:string;[key:string]:unknown};
export function insist(value:unknown,message:string):asserts value {if(!value)throw new Error(message)}
export function cleanText(v:unknown,max=24){insist(typeof v==='string','请输入文字');const text=v.trim().replace(/[\u0000-\u001f\u007f]/g,'');insist(text.length>0 && text.length<=max,`请输入 1–${max} 个字符`);return text;}
export function configFrom(value:unknown):Config{
  insist(value && typeof value==='object','房间配置不正确');const c=value as Config;
  insist(Object.hasOwn(GAME_META,c.game),'请选择有效游戏');const g=GAME_META[c.game];
  insist(Number.isInteger(c.capacity)&&c.capacity>=g.min&&c.capacity<=g.max,`人数范围为 ${g.min}–${g.max}`);
  insist(Number.isInteger(c.rounds)&&c.rounds>=1&&c.rounds<=9,'局数范围为 1–9');
  insist([9,13,19].includes(c.boardSize),'请选择 9、13 或 19 路棋盘');
  return {game:c.game,capacity:c.capacity,rounds:c.rounds,boardSize:c.boardSize};
}
function shuffle<T>(list:T[]){const a=[...list];for(let i=a.length-1;i>0;i--){const j=crypto.getRandomValues(new Uint32Array(1))[0]%(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function announce(r:Room,text:string,name='同桌',system=true){r.messages.push({id:crypto.randomUUID(),name,text,system});r.messages=r.messages.slice(-80);}
export function rebalance(r:Room){let seat=0;for(const p of r.members){p.seat=!p.watch&&seat<r.config.capacity?seat++:null;p.ready=p.id===r.host;}}
export function newRoom(id:string,name:string,config:Config,user:{id:string;name:string}):Room{
  const r:Room={id,name,host:user.id,config,members:[{...user,seat:0,ready:true,watch:false}],created:Date.now(),round:0,scores:{},match:null,messages:[]};
  announce(r,`${user.name} 创建了房间`);return r;
}
function playerName(r:Room,id:string){return r.members.find(p=>p.id===id)?.name??'已离开玩家';}
function finish(r:Room,result:string,winners:string[]){const m=r.match!;m.phase='finished';m.result=result;m.winners=winners;winners.forEach(id=>r.scores[id]=(r.scores[id]??0)+1);announce(r,result);}
function checkPartyWin(r:Room){const m=r.match!;const evil=m.alive.filter(id=>m.roles[id]===(r.config.game==='undercover'?'卧底':'狼人'));const good=m.alive.filter(id=>!evil.includes(id));
  if(!evil.length){finish(r,r.config.game==='undercover'?'平民获胜！所有卧底已出局。':'好人阵营获胜！所有狼人已出局。',m.players.filter(id=>m.roles[id]!== (r.config.game==='undercover'?'卧底':'狼人')));return true;}
  if(evil.length>=good.length){finish(r,r.config.game==='undercover'?'卧底获胜！卧底人数已达到平民人数。':'狼人阵营获胜！狼人人数已达到好人人数。',m.players.filter(id=>m.roles[id]===(r.config.game==='undercover'?'卧底':'狼人')));return true;}return false;
}
function morning(r:Room,poison:string|null=null){const m=r.match!;const dead=[...new Set([m.victim,poison].filter(Boolean))] as string[];m.alive=m.alive.filter(id=>!dead.includes(id));announce(r,dead.length?`天亮了，${dead.map(id=>playerName(r,id)).join('、')} 出局。`:'天亮了，昨夜是平安夜。');m.victim=null;m.votes={};m.spoken=[];m.phase='discussion';m.turn=m.alive[0];checkPartyWin(r);}
function afterWolves(r:Room){const m=r.match!;m.votes={};if(m.alive.some(id=>m.roles[id]==='预言家')){m.phase='seer';}else afterSeer(r);}
function afterSeer(r:Room){const m=r.match!;if(m.alive.some(id=>m.roles[id]==='女巫')&&(m.potions.save||m.potions.poison)){m.phase='witch';}else morning(r);}
function majority(votes:Record<string,string>){const counts:Record<string,number>={};for(const v of Object.values(votes))counts[v]=(counts[v]??0)+1;const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);return sorted.length&&(!sorted[1]||sorted[0][1]>sorted[1][1])?sorted[0][0]:null;}
function start(r:Room){rebalance(r);const players=r.members.filter(p=>p.seat!==null).map(p=>p.id);const party=['undercover','werewolf'].includes(r.config.game);if(r.round>=r.config.rounds){r.round=0;r.scores={};}r.round++;
  const size=r.config.game==='tictactoe'?3:r.config.game==='go'?r.config.boardSize:15;
  const order=r.round%2===0&&!party?[...players].reverse():players;
  const m:Match={phase:party?'discussion':'board',players:order,turn:order[0],board:party?[]:Array(size*size).fill(0),size,history:[],passes:0,captures:[0,0],roles:{},words:{},notes:{},alive:[...players],votes:{},spoken:[],day:1,victim:null,potions:{save:true,poison:true},result:'',winners:[],lastMove:null};
  r.match=m;
  if(r.config.game==='undercover'){
    const pairs=[['豆浆','牛奶'],['游泳','潜水'],['高铁','地铁'],['饺子','馄饨'],['月亮','太阳'],['钢琴','吉他'],['咖啡','奶茶'],['枕头','抱枕'],['橙子','橘子'],['电梯','扶梯'],['书店','图书馆'],['雪糕','冰淇淋']];
    const pair=shuffle(pairs)[0];const spies=shuffle(players).slice(0,players.length>=7?2:1);players.forEach(id=>{m.roles[id]=spies.includes(id)?'卧底':'平民';m.words[id]=pair[spies.includes(id)?1:0];});
  }else if(r.config.game==='werewolf'){
    const deck=shuffle(players);const wolves=players.length>=9?3:2;deck.forEach((id,i)=>m.roles[id]=i<wolves?'狼人':i===wolves?'预言家':i===wolves+1?'女巫':'村民');m.phase='wolves';
  }else m.history=[m.board.join(',')];
  announce(r,`第 ${r.round} / ${r.config.rounds} 局 ${GAME_META[r.config.game].name} 开始${party?'，请查看自己的秘密卡片':'，'+playerName(r,m.turn)+' 先手'}。`);
}
const neighbors=(i:number,n:number)=>[i%n>0?i-1:-1,i%n<n-1?i+1:-1,i>=n?i-n:-1,i<n*(n-1)?i+n:-1].filter(x=>x>=0);
function group(board:number[],index:number,n:number){const cells=new Set<number>([index]);const liberties=new Set<number>();const queue=[index];for(const i of queue){for(const k of neighbors(i,n)){if(board[k]===0)liberties.add(k);else if(board[k]===board[index]&&!cells.has(k)){cells.add(k);queue.push(k);}}}return {cells,liberties};}
export function goMove(board:number[],index:number,color:number,n:number,history:string[]){insist(board[index]===0,'这里已经有棋子了');const next=[...board];next[index]=color;let taken=0;for(const k of neighbors(index,n)){if(next[k]===3-color){const g=group(next,k,n);if(!g.liberties.size){taken+=g.cells.size;g.cells.forEach(p=>next[p]=0);}}}insist(group(next,index,n).liberties.size>0,'此处无气，不能自杀落子');const key=next.join(',');insist(!history.includes(key),'禁止全局同形，不能立即回提');return {board:next,taken,key};}
export function goScore(board:number[],n:number){const scores=[0,7.5];const seen=new Set<number>();for(let i=0;i<board.length;i++){if(board[i]){scores[board[i]-1]++;continue;}if(seen.has(i))continue;const queue=[i];seen.add(i);const borders=new Set<number>();for(const p of queue){for(const k of neighbors(p,n)){if(board[k])borders.add(board[k]);else if(!seen.has(k)){seen.add(k);queue.push(k);}}}if(borders.size===1)scores[[...borders][0]-1]+=queue.length;}return scores;}
export function lineWin(board:number[],i:number,n:number,target:number){const color=board[i];return [[1,0],[0,1],[1,1],[1,-1]].some(([dx,dy])=>{let count=1;for(const sign of [-1,1]){let x=i%n+dx*sign,y=Math.floor(i/n)+dy*sign;while(x>=0&&x<n&&y>=0&&y<n&&board[y*n+x]===color){count++;x+=dx*sign;y+=dy*sign;}}return count>=target;});}
export function applyAction(r:Room,user:{id:string;name:string},a:Action){
  let p=r.members.find(p=>p.id===user.id);const running=r.match&&r.match.phase!=='finished';
  if(a.type==='join'){
    if(p)return r;insist(r.members.length<40,'房间已达到 40 人上限');
    const free=Array.from({length:r.config.capacity},(_,i)=>i).find(i=>!r.members.some(p=>p.seat===i));
    p={...user,seat:running||a.watch===true?null:free??null,ready:false,watch:a.watch===true};r.members.push(p);announce(r,`${user.name} 加入房间${p.seat===null?'，正在旁观':''}`);return r;
  }
  insist(p,'你还没有加入这个房间');p.name=user.name;
  if(a.type==='rename')return r;
  if(a.type==='leave'){
    if(running&&p.seat!==null){r.match=null;r.round=Math.max(0,r.round-1);announce(r,`${user.name} 离开，本局取消，等待重新准备。`);}
    r.members=r.members.filter(x=>x.id!==user.id);if(r.host===user.id&&r.members.length){r.host=r.members[0].id;announce(r,`${r.members[0].name} 成为新房主`);}if(!r.match||r.match.phase==='finished')rebalance(r);announce(r,`${user.name} 离开房间`);return r;
  }
  if(a.type==='configure'){
    insist(r.host===user.id,'只有房主可以修改房间配置');r.config=configFrom(a.config);r.name=cleanText(a.name);r.match=null;r.round=0;r.scores={};rebalance(r);announce(r,`房主将游戏设为 ${GAME_META[r.config.game].name} · ${r.config.capacity} 人 · ${r.config.rounds} 局，超员玩家保留在旁观席。`);return r;
  }
  if(a.type==='cancel'){
    insist(r.host===user.id,'只有房主可以结束本局');insist(running,'当前没有正在进行的对局');r.match=null;r.round=Math.max(0,r.round-1);rebalance(r);announce(r,'房主结束了本局，比分不变，请重新准备。');return r;
  }
  if(a.type==='seat'){
    insist(!running,'请等待本局结束后切换座位');p.watch=a.watch===true;rebalance(r);return r;
  }
  if(a.type==='ready'){insist(!running&&p.seat!==null,'当前无法准备');p.ready=!p.ready;return r;}
  if(a.type==='start'){
    insist(r.host===user.id,'只有房主可以开始游戏');insist(!running,'对局正在进行');
    const seated=r.members.filter(p=>p.seat!==null);insist(seated.length>=GAME_META[r.config.game].min,`至少需要 ${GAME_META[r.config.game].min} 位玩家入座`);insist(seated.every(p=>p.id===r.host||p.ready),'请等待所有入座玩家准备');start(r);return r;
  }
  if(a.type==='chat'){
    insist(!running||(p.seat!==null&&r.match!.alive.includes(p.id)),'本局结束后旁观和出局玩家可以聊天');
    insist(!running||r.match!.phase==='board'||r.match!.phase==='discussion'||r.match!.phase==='vote','夜间请保持安静');
    announce(r,cleanText(a.text,200),user.name,false);return r;
  }
  insist(running,'请先开始新的一局');const m=r.match!;insist(p.seat!==null&&m.players.includes(p.id),'旁观者不能操作对局');
  if(a.type==='move'||a.type==='pass'||a.type==='resign'){
    insist(m.phase==='board','当前不是棋类对局');const color=m.players.indexOf(user.id)+1;
    if(a.type==='resign'){const winner=m.players.find(id=>id!==user.id)!;finish(r,`${user.name} 认输，${playerName(r,winner)} 获胜。`,[winner]);return r;}
    insist(m.turn===user.id,'还没轮到你');
    if(a.type==='pass'){
      insist(r.config.game==='go','只有围棋可以停一手');m.passes++;announce(r,`${user.name} 停一手`);
      if(m.passes>=2){const scores=goScore(m.board,m.size);const winner=m.players[scores[0]>scores[1]?0:1];finish(r,`数子结束：黑 ${scores[0]}，白 ${scores[1]}（含贴目）。${playerName(r,winner)} 获胜。`,[winner]);return r;}
    }else{
      const i=a.index;insist(typeof i==='number'&&Number.isInteger(i)&&i>=0&&i<m.board.length,'落子坐标无效');insist(m.board[i]===0,'这里已经有棋子了');
      if(r.config.game==='go'){const next=goMove(m.board,i,color,m.size,m.history);m.board=next.board;m.captures[color-1]+=next.taken;m.history.push(next.key);}else m.board[i]=color;
      m.lastMove=i;m.passes=0;
      if(r.config.game!=='go'&&lineWin(m.board,i,m.size,r.config.game==='gomoku'?5:3)){finish(r,`${playerName(r,user.id)} 获胜！`,[user.id]);return r;}
      if(r.config.game!=='go'&&m.board.every(Boolean)){finish(r,'棋盘已满，本局平局。',[]);return r;}
    }
    m.turn=m.players.find(id=>id!==user.id)!;return r;
  }
  insist(m.alive.includes(user.id),'你已出局，请等待下一局');
  if(a.type==='speak'){
    insist(m.phase==='discussion'&&m.turn===user.id,'请等待你的发言回合');announce(r,cleanText(a.text,200),user.name,false);m.spoken.push(user.id);const next=m.alive.find(id=>!m.spoken.includes(id));
    if(next)m.turn=next;else{m.phase='vote';m.votes={};announce(r,'发言结束，请选择一位玩家投票。');}return r;
  }
  if(a.type==='vote'){
    insist(m.phase==='vote'||m.phase==='wolves','当前不是投票阶段');insist(!m.votes[user.id],'你已经提交了选择');
    const target=a.target;insist(typeof target==='string'&&m.alive.includes(target)&&target!==user.id,'请选择其他存活玩家');
    if(m.phase==='wolves'){insist(m.roles[user.id]==='狼人','请等待狼人行动');insist(m.roles[target]!=='狼人','不能选择狼人队友');}
    m.votes[user.id]=target;const voters=m.phase==='wolves'?m.alive.filter(id=>m.roles[id]==='狼人'):m.alive;
    if(voters.every(id=>m.votes[id])){
      const victim=majority(m.votes);
      if(m.phase==='wolves'){m.victim=victim;afterWolves(r);}
      else{announce(r,'投票结果：'+Object.entries(m.votes).map(([id,v])=>`${playerName(r,id)} → ${playerName(r,v)}`).join('；'));
        if(victim){m.alive=m.alive.filter(id=>id!==victim);announce(r,`${playerName(r,victim)} 被投票出局${r.config.game==='undercover'?'，身份是'+m.roles[victim]:''}。`);}else announce(r,'票数相同，本轮无人出局。');
        if(!checkPartyWin(r)){m.day++;m.votes={};m.spoken=[];m.turn=m.alive[0];m.phase=r.config.game==='werewolf'?'wolves':'discussion';}
      }
    }return r;
  }
  if(a.type==='inspect'){
    insist(m.phase==='seer'&&m.roles[user.id]==='预言家','当前无法查验');const target=a.target;insist(typeof target==='string'&&m.alive.includes(target)&&target!==user.id,'请选择其他存活玩家');
    (m.notes[user.id]??=[]).push(`第 ${m.day} 夜：${playerName(r,target)} 是${m.roles[target]==='狼人'?'狼人':'好人'}。`);afterSeer(r);return r;
  }
  if(a.type==='witch'){
    insist(m.phase==='witch'&&m.roles[user.id]==='女巫','当前无法使用药剂');let poison:string|null=null;
    if(a.choice==='save'){insist(m.potions.save&&m.victim,'本夜没有可救的玩家或解药已用完');m.potions.save=false;m.victim=null;}
    else if(a.choice==='poison'){insist(m.potions.poison,'毒药已经用完');insist(typeof a.target==='string'&&m.alive.includes(a.target)&&a.target!==user.id,'请选择其他存活玩家');poison=a.target;m.potions.poison=false;}
    else insist(a.choice==='skip','请选择使用药剂或跳过');morning(r,poison);return r;
  }
  throw new Error('不支持的操作');
}
export function publicRoom(r:Room,id:string){
  const {match,...room}=r;if(!match)return {...room,match:null,secret:null};
  const {roles,words,notes,votes,history,victim,potions,...m}=match;
  const member=r.members.find(p=>p.id===id);const owns=member&&member.seat!==null&&m.players.includes(id);
  return {...room,match:{...m,submitted:!!votes[id],voteCount:m.phase==='vote'?Object.keys(votes).length:undefined,reveal:m.phase==='finished'?m.players.map(id=>({id,role:roles[id],word:words[id]})):null},
    secret:owns?{role:r.config.game==='undercover'&&m.phase!=='finished'?null:roles[id]??null,word:words[id]??null,notes:notes[id]??[],teammates:roles[id]==='狼人'?m.players.filter(p=>roles[p]==='狼人'):[],victim:roles[id]==='女巫'&&m.phase==='witch'&&potions.save?victim:null,potions:roles[id]==='女巫'?potions:null}:null};
}
export function roomSummary(r:Room){return {id:r.id,name:r.name,config:r.config,created:r.created,hostName:playerName(r,r.host),players:r.members.filter(p=>p.seat!==null).length,watchers:r.members.filter(p=>p.seat===null).length,playing:!!r.match&&r.match.phase!=='finished',round:r.round};}
export type PublicRoom=ReturnType<typeof publicRoom>;
export type RoomSummary=ReturnType<typeof roomSummary>;
