'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Terminal, Activity, Download, Cpu } from 'lucide-react';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string) => void;
  isLoading: boolean;
  onDownloadZip: () => void;
  hasFiles: boolean;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onDownloadZip,
  hasFiles,
}) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleSuggestion = (prompt: string) => {
    if (isLoading) return;
    onSendMessage(prompt);
  };

  return (
    <div className="w-80 h-full bg-[#0d1117] border-r border-[#30363d] flex flex-col text-sm select-none">
      {/* Platform & Status Header */}
      <div className="p-3 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="font-bold text-white text-xs tracking-wide">HK AI AGENT WORKSPACE</span>
          </div>
          <span className="text-[10px] bg-blue-900/60 text-blue-300 border border-blue-700/50 px-1.5 py-0.5 rounded font-mono">
            HK ~15ms
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-400 font-mono mt-2">
          <div className="bg-[#0d1117] p-1.5 rounded border border-[#30363d]/80 flex items-center space-x-1">
            <Cpu className="w-3 h-3 text-purple-400 shrink-0" />
            <span className="truncate">DeepSeek-Flash</span>
          </div>
          <div className="bg-[#0d1117] p-1.5 rounded border border-[#30363d]/80 flex items-center space-x-1">
            <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">gVisor Sandbox</span>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#161b22] text-gray-200 border border-[#30363d]'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans">{msg.text}</div>
            </div>
            <span className="text-[9px] text-gray-500 mt-1 px-1">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-gray-400 italic bg-[#161b22] border border-[#30363d] p-2.5 rounded-lg">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            <span>AI 正在香港邊緣生成代碼並同步至沙盒...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar */}
      <div className="px-3 py-2 border-t border-[#30363d]/50 bg-[#161b22]/50">
        <div className="text-[10px] text-gray-400 mb-1.5">快速體驗指令：</div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => handleSuggestion('build me a todo app')}
            disabled={isLoading}
            className="text-[11px] bg-[#21262d] hover:bg-[#30363d] text-gray-200 px-2 py-1 rounded transition border border-[#30363d]"
          >
            📋 build me a todo app
          </button>
          <button
            onClick={() => handleSuggestion('寫一個香港的士分賬計算器')}
            disabled={isLoading}
            className="text-[11px] bg-[#21262d] hover:bg-[#30363d] text-gray-200 px-2 py-1 rounded transition border border-[#30363d]"
          >
            🚕 的士分賬器
          </button>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#30363d] bg-[#161b22]">
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="描述你想構建的應用（如：build me a todo app）..."
            rows={2}
            className="w-full bg-[#0d1117] border border-[#30363d] rounded-md p-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none font-sans"
          />

          <div className="flex items-center justify-between">
            {hasFiles ? (
              <button
                type="button"
                onClick={onDownloadZip}
                className="flex items-center space-x-1 text-[11px] text-gray-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] px-2 py-1 rounded border border-[#30363d]"
                title="導出為標準 ZIP 專案包"
              >
                <Download className="w-3 h-3" />
                <span>下載 ZIP</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded font-medium transition"
            >
              <span>生成代碼</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
