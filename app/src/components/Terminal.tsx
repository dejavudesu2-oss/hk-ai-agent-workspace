'use client';

import React from 'react';
import { Terminal as TerminalIcon, Shield, Trash2 } from 'lucide-react';

interface TerminalProps {
  logs: string[];
  onClear: () => void;
  isolation?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ logs, onClear, isolation = 'gVisor-runsc' }) => {
  return (
    <div className="h-44 bg-[#0d1117] border-t border-[#30363d] flex flex-col font-mono text-xs select-none">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-b border-[#30363d]">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-gray-300 font-semibold text-[11px]">沙盒終端與執行日誌 (SANDBOX LOGS)</span>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <div className="flex items-center space-x-1 text-emerald-400">
            <Shield className="w-3 h-3" />
            <span>隔離運行時: {isolation}</span>
          </div>
          <button
            onClick={onClear}
            className="text-gray-400 hover:text-gray-200 p-0.5 rounded"
            title="清空終端日誌"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-2.5 overflow-y-auto text-gray-300 space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-600 italic">終端就緒。沙盒執行指令與編譯訊息將即時顯示於此。</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="whitespace-pre-wrap leading-relaxed">
              {log.startsWith('[error]') ? (
                <span className="text-red-400">{log}</span>
              ) : log.startsWith('[cmd]') ? (
                <span className="text-blue-400 font-bold">{log}</span>
              ) : log.startsWith('[gVisor') ? (
                <span className="text-emerald-400">{log}</span>
              ) : (
                <span>{log}</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
