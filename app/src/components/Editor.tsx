'use client';

import React from 'react';
import MonacoEditor from '@monaco-editor/react';
import { detectLanguage } from '@/lib/vfs';

interface EditorProps {
  activeFile: string;
  content: string;
  onChange: (newContent: string) => void;
  openFiles: string[];
  onSelectFile: (path: string) => void;
  onCloseFile: (path: string) => void;
}

export const Editor: React.FC<EditorProps> = ({
  activeFile,
  content,
  onChange,
  openFiles,
  onSelectFile,
  onCloseFile,
}) => {
  const language = detectLanguage(activeFile || 'file.txt');

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-r border-[#30363d] overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center bg-[#161b22] border-b border-[#30363d] overflow-x-auto no-scrollbar h-9">
        {openFiles.length === 0 ? (
          <div className="text-xs text-gray-500 px-3 py-1.5 italic">無開啟檔案</div>
        ) : (
          openFiles.map((file) => {
            const isActive = file === activeFile;
            const fileName = file.split('/').pop() || file;
            return (
              <div
                key={file}
                onClick={() => onSelectFile(file)}
                className={`flex items-center space-x-2 px-3 py-1.5 text-xs border-r border-[#30363d] cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[#1e1e1e] text-white border-t-2 border-t-blue-500 font-medium'
                    : 'bg-[#161b22] text-gray-400 hover:text-gray-200 hover:bg-[#1f242c]'
                }`}
              >
                <span>{fileName}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseFile(file);
                  }}
                  className="hover:text-red-400 p-0.5 rounded text-[10px]"
                  title="關閉檔案"
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Editor Body */}
      <div className="flex-1 relative">
        {activeFile ? (
          <MonacoEditor
            height="100%"
            path={activeFile}
            language={language}
            value={content}
            theme="vs-dark"
            onChange={(val) => onChange(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              renderLineHighlight: 'all',
              tabSize: 2,
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
            <p>請從左側目錄樹選取檔案，或在對話框輸入提示詞自動生成代碼</p>
          </div>
        )}
      </div>
    </div>
  );
};
