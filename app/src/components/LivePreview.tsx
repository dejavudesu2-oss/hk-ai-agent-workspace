'use client';

import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, ExternalLink, ShieldCheck, AlertTriangle, Bug } from 'lucide-react';
import { VFSMap, normalizePath } from '@/lib/vfs';

interface LivePreviewProps {
  files: VFSMap;
  onFixError?: (errorText: string) => void;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeReplace(str: string, pattern: RegExp | string, replacement: string): string {
  return str.replace(pattern, () => replacement);
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

  const generateSrcDoc = (): string => {
    // Normalize file dictionary keys
    const normalizedFiles: VFSMap = {};
    for (const [key, val] of Object.entries(files)) {
      const norm = normalizePath(key || val.path);
      if (norm) {
        normalizedFiles[norm] = { path: norm, content: val.content };
      }
    }

    const hasAnyFiles = Object.keys(normalizedFiles).length > 0;
    const indexHtml =
      normalizedFiles['index.html']?.content ||
      normalizedFiles['public/index.html']?.content ||
      normalizedFiles['index.htm']?.content;

    if (!hasAnyFiles) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              background: #0d1117;
              color: #8b949e;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
            }
            .spinner {
              border: 3px solid rgba(255,255,255,0.1);
              border-top: 3px solid #58a6ff;
              border-radius: 50%;
              width: 28px;
              height: 28px;
              animation: spin 1s linear infinite;
              margin-bottom: 16px;
            }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="spinner"></div>
          <p>正在等待代碼流式寫入完成...</p>
        </body>
        </html>
      `;
    }

    // Check if project has React/JSX/TSX files
    const hasReactFiles = Object.keys(normalizedFiles).some((p) =>
      /\.(jsx|tsx|ts)$/i.test(p)
    );

    let html = indexHtml || `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"></script>
  ${
    hasReactFiles
      ? `
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>`
      : ''
  }
</head>
<body class="bg-[#0f172a] text-slate-100 min-h-screen">
  <div id="root"></div>
</body>
</html>`;

    // Watchdog script to capture errors inside the iframe and report back
    const watchdogScript = `
      <script>
        (function() {
          window.onerror = function(msg, url, line, col, error) {
            window.parent.postMessage({
              type: 'WATCHDOG_ERROR',
              message: String(msg) + ' (line ' + line + ':' + col + ')'
            }, '*');
          };
          window.onunhandledrejection = function(event) {
            window.parent.postMessage({
              type: 'WATCHDOG_ERROR',
              message: 'Unhandled Promise: ' + (event.reason ? (event.reason.message || event.reason) : 'Unknown')
            }, '*');
          };
        })();
      </script>
    `;

    // 1. Inline CSS files safely
    for (const [path, file] of Object.entries(normalizedFiles)) {
      if (path.endsWith('.css')) {
        const fileName = path.split('/').pop() || path;
        const cssContent = file.content || '';
        const styleTag = `<style>/* ${path} */\n${cssContent}</style>`;

        // Try replacing linked css tag
        const linkRegex = new RegExp(
          `<link[^>]*href=["'][^"']*${escapeRegExp(fileName)}["'][^>]*>`,
          'i'
        );

        if (linkRegex.test(html)) {
          html = safeReplace(html, linkRegex, styleTag);
        } else if (html.includes('</head>')) {
          html = safeReplace(html, '</head>', `${styleTag}</head>`);
        } else {
          html = `${styleTag}${html}`;
        }
      }
    }

    // 2. Inline JavaScript / TypeScript / JSX files safely
    for (const [path, file] of Object.entries(normalizedFiles)) {
      const isScript = /\.(js|mjs|jsx|ts|tsx)$/i.test(path);
      const isConfig = path.endsWith('.config.js') || path.endsWith('.config.ts');

      if (isScript && !isConfig) {
        const fileName = path.split('/').pop() || path;
        const jsContent = file.content || '';
        const isBabel = /\.(jsx|tsx|ts)$/i.test(path);
        const scriptType = isBabel ? 'text/babel' : 'text/javascript';
        const scriptTag = `<script type="${scriptType}">/* ${path} */\n${jsContent}\n</script>`;

        const scriptRegex = new RegExp(
          `<script[^>]*src=["'][^"']*${escapeRegExp(fileName)}["'][^>]*>\\s*</script>`,
          'i'
        );

        if (scriptRegex.test(html)) {
          html = safeReplace(html, scriptRegex, scriptTag);
        } else if (html.includes('</body>')) {
          html = safeReplace(html, '</body>', `${scriptTag}</body>`);
        } else {
          html = `${html}${scriptTag}`;
        }
      }
    }

    // 3. Inject watchdog right before head ends or at the beginning
    if (html.includes('</head>')) {
      html = safeReplace(html, '</head>', `${watchdogScript}</head>`);
    } else {
      html = `${watchdogScript}${html}`;
    }

    return html;
  };

  const handleRefresh = () => {
    setRuntimeError(null);
    setReloadKey((k) => k + 1);
  };

  const handleOpenExternal = () => {
    const srcDoc = generateSrcDoc();
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(srcDoc);
      win.document.close();
    }
  };

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

      {/* Sandboxed Iframe Container */}
      <div className="flex-1 bg-white relative">
        <iframe
          key={reloadKey}
          ref={iframeRef}
          srcDoc={generateSrcDoc()}
          title="Sandbox Preview"
          sandbox="allow-scripts allow-modals allow-same-origin allow-forms"
          className="w-full h-full border-none"
        />
      </div>
    </div>
  );
};
