"use client";
import { Grid3X3, CircleDot, Hash, Fingerprint, Moon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GAME_META, type Config, type GameType } from '@/lib/game-engine';
export const games = [
  {id:'gomoku' as const,name:'五子棋',en:'GOMOKU',desc:'落子之间，五连制胜',people:'2 人',icon:Grid3X3,color:'mint'},
  {id:'go' as const,name:'围棋',en:'GO',desc:'黑白交错，方寸天地',people:'2 人',icon:CircleDot,color:'sand'},
  {id:'tictactoe' as const,name:'井字棋',en:'TIC TAC TOE',desc:'三步一线，即刻开局',people:'2 人',icon:Hash,color:'blue'},
  {id:'undercover' as const,name:'谁是卧底',en:'UNDERCOVER',desc:'藏好身份，找出不同',people:'3–12 人',icon:Fingerprint,color:'purple'},
  {id:'werewolf' as const,name:'狼人杀',en:'WEREWOLF',desc:'天黑请闭眼，好戏开场',people:'6–12 人',icon:Moon,color:'rose'},
];
export function Picker({value,onChange,options,label}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string}){
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="picker"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem value={o.value} key={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}
export const initialConfig:Config={game:'gomoku',capacity:2,rounds:3,boardSize:9};
export function ConfigFields({name,setName,config,setConfig}:{name:string;setName:(v:string)=>void;config:Config;setConfig:(v:Config)=>void}){
 const game=GAME_META[config.game];
 return <div className="config-fields"><label>房间名称<input required value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="给这张桌子起个名字"/></label><label>游戏类型<Picker label="游戏类型" value={config.game} onChange={v=>setConfig({...config,game:v as GameType,capacity:GAME_META[v as GameType].default})} options={games.map(g=>({value:g.id,label:g.name}))}/></label><div className="field-row"><label>玩家人数<Picker label="玩家人数" value={String(config.capacity)} onChange={v=>setConfig({...config,capacity:+v})} options={Array.from({length:game.max-game.min+1},(_,i)=>({value:String(i+game.min),label:`${i+game.min} 人`}))}/></label><label>对局局数<Picker label="对局局数" value={String(config.rounds)} onChange={v=>setConfig({...config,rounds:+v})} options={Array.from({length:9},(_,i)=>({value:String(i+1),label:`${i+1} 局`}))}/></label></div>{config.game==='go'&&<label>棋盘大小<Picker label="棋盘大小" value={String(config.boardSize)} onChange={v=>setConfig({...config,boardSize:+v})} options={[9,13,19].map(n=>({value:String(n),label:`${n} 路棋盘`}))}/></label>}<p className="form-note">房间最多容纳 40 人。超过玩家人数的成员会留在旁观席，不会被移出房间。</p></div>;
}
export const rules:Record<GameType,string[]>={
  gomoku:['两人轮流落子，先手执黑。横、竖或斜向连成五子或更多即获胜。','采用自由五子棋，不设禁手；棋盘填满且无人获胜则平局。下一局交换先手。'],
  go:['两人轮流落子，黑先白后。无气的棋子被提走，禁止自杀落子和全局同形。','请先吃净死子再结束。双方连续停一手后，按盘面活子加独占空点数子，白贴 7.5 目；此版本不包含死子协商。','可选择 9、13 或 19 路棋盘。下一局交换先手。'],
  tictactoe:['两人轮流选择空格，先手为 X，后手为 O。','横、竖或斜向先连成三个获胜。棋盘填满则平局，下一局交换先手。'],
  undercover:['每人仅能看到自己的词语。3–6 人设 1 名卧底，7–12 人设 2 名卧底；卧底的词语与平民相近。','按顺序描述词语，不要直接说出词语。所有存活玩家发言后投票，最高票且不并列者出局，平票则继续下一轮。','卧底全部出局，平民获胜；卧底人数达到平民人数，卧底获胜。出局者和旁观者在本局结束前不能发言。'],
  werewolf:['采用 6–12 人简化角色局：6–8 人为 2 狼，9–12 人为 3 狼，另有 1 预言家、1 女巫，其余为村民。','夜间依次为狼人投票、预言家查验、女巫用药。狼人可看到队友；狼票并列则无人被袭击。','女巫整局各有一瓶解药和毒药，每晚最多使用一瓶，可自救；解药用完后不再获知受袭者。','天亮公布出局者，存活玩家依次发言后投票，平票则无人出局，进入下一夜。','狼人全部出局则好人获胜；狼人人数达到好人人数则狼人获胜。此版本无警长、猎人和语音，使用文字发言。'],
};
