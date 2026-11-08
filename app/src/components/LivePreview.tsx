'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, ExternalLink, ShieldCheck, AlertTriangle, Bug } from 'lucide-react';
import { VFSMap } from '@/lib/vfs';
import { generatePreviewHtml } from '@/lib/preview-generator';

interface LivePreviewProps {
  files: VFSMap;
  onFixError?: (errorText: string) => void;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ files, onFixError }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  // Listen for watchdog errors from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'WATCHDOG_ERROR') {
        const errMsg = event.data.message || 'Unknown runtime error';
        setRuntimeError(errMsg);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleRefresh = () => {
    setRuntimeError(null);
    setReloadKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    const srcDoc = generatePreviewHtml(files);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(srcDoc);
      win.document.close();
    }
  };

  const srcDoc = generatePreviewHtml(files);

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-l border-[#30363d] overflow-hidden">
      {/* Browser Navigation Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#161b22] border-b border-[#30363d] h-9">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-[11px] text-gray-400 font-mono ml-2 bg-[#0d1117] px-2.5 py-0.5 rounded border border-[#30363d]">
            http://localhost:5173/
          </span>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          {runtimeError ? (
            <div className="flex items-center text-amber-400 space-x-1 text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>報錯看門狗已觸發</span>
            </div>
          ) : (
            <div className="flex items-center text-emerald-400 space-x-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>沙盒即時預覽正常</span>
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#21262d] transition"
            title="重新整理預覽"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleOpenExternal}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#21262d] transition"
            title="在新標籤開啟"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Runtime Error Banner with Self-Healing Trigger */}
      {runtimeError && (
        <div className="bg-red-950/80 border-b border-red-800 text-red-200 px-3 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <Bug className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate font-mono">{runtimeError}</span>
          </div>
          {onFixError && (
            <button
              onClick={() => onFixError(runtimeError)}
              className="bg-red-700 hover:bg-red-600 text-white font-medium px-2 py-0.5 rounded text-[11px] shrink-0 ml-2"
            >
              一鍵 AI 修復
            </button>
          )}
        </div>
      )}

      {/* Sandboxed Iframe Container: Strictly isolated with no allow-same-origin to prevent parent window access */}
      <div className="flex-1 bg-white relative">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          srcDoc={srcDoc}
          title="Sandbox Preview"
          sandbox="allow-scripts allow-modals allow-forms"
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
};
