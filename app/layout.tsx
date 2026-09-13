import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'同桌 Playroom · 好友联机游戏大厅',description:'一张桌子，几个朋友。一起玩五子棋、围棋、井字棋、谁是卧底和狼人杀。',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN" className="dark"><body>{children}</body></html>}
