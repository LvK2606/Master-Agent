import './globals.css';
import type { Metadata } from 'next';
export const metadata:Metadata={title:'Master-Agent | AI Software Company',description:'An AI agent control center to orchestrate software teams.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}