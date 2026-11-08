import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HK AI Agent Workspace - 在線 AI 代碼工作台',
  description: '類 Bolt.new / Claude Artifacts / Replit Agent 的香港在線 AI 智能體代碼工作台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK" className="dark">
      <body className="bg-[#0d1117] text-[#c9d1d9] antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
