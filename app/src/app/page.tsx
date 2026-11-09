'use client';

import React, { useState, useCallback, useEffect } from 'react';
import JSZip from 'jszip';
import { ChatPanel, ChatMessage } from '@/components/ChatPanel';
import { FileTree } from '@/components/FileTree';
import { Editor } from '@/components/Editor';
import { LivePreview } from '@/components/LivePreview';
import { Terminal } from '@/components/Terminal';
import { VFSMap, normalizePath } from '@/lib/vfs';
import { StreamingActionParser } from '@/lib/streaming-parser';
import { saveWorkspaceToIndexedDB, loadWorkspaceFromIndexedDB } from '@/lib/persistence';

export default function WorkspacePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: '歡迎使用香港在線 AI Agent 工作台！\n我支援即時流式代碼編寫、雙軌安全沙盒運行與 Monaco 編輯器熱重載。\n請在下方輸入需求（例如點擊「build me a todo app」），即可體驗全自動代碼流式生成與即時預覽。',
      timestamp: '剛剛',
    },
  ]);

  const [files, setFiles] = useState<VFSMap>({});
  const [activeFile, setActiveFile] = useState<string>('');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([
    '[system] HK AI Agent runtime initialized.',
    '[system] Connection established to Hong Kong edge gateway.',
    '[gVisor] User-space syscall sandbox ready for code isolation.',
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = useCallback((line: string) => {
    setLogs((prev) => [...prev, line]);
  }, []);

  // Restore workspace from IndexedDB on page load
  useEffect(() => {
    loadWorkspaceFromIndexedDB()
      .then((snapshot) => {
        if (snapshot && snapshot.files && Object.keys(snapshot.files).length > 0) {
          setFiles(snapshot.files);
          if (snapshot.messages && snapshot.messages.length > 0) {
            setMessages(snapshot.messages);
          }
          if (snapshot.activeFile) {
            setActiveFile(snapshot.activeFile);
            setOpenFiles([snapshot.activeFile]);
          }
          addLog('[system] Restored workspace from local IndexedDB storage.');
        }
      })
      .catch((err) => {
        console.warn('Could not restore from IndexedDB:', err);
      });
  }, [addLog]);

  // Autosave workspace whenever files, messages, or active file change
  useEffect(() => {
    if (Object.keys(files).length > 0) {
      saveWorkspaceToIndexedDB({ files, messages, activeFile }).catch(() => {});
    }
  }, [files, messages, activeFile]);

  const handleSelectFile = useCallback((path: string) => {
    setActiveFile(path);
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
  }, []);

  const handleCloseFile = useCallback(
    (path: string) => {
      setOpenFiles((prev) => {
        const next = prev.filter((p) => p !== path);
        if (activeFile === path) {
          setActiveFile(next.length > 0 ? next[next.length - 1] : '');
        }
        return next;
      });
    },
    [activeFile]
  );

  const handleFileChange = useCallback((newContent: string) => {
    if (!activeFile) return;
    setFiles((prev) => ({
      ...prev,
      [activeFile]: { path: activeFile, content: newContent },
    }));
  }, [activeFile]);

  const handleSendMessage = async (prompt: string) => {
    const userMsgId = 'user-' + Date.now();
    const assistantMsgId = 'assistant-' + Date.now();

    const newMessages: ChatMessage[] = [
      ...messages,
      {
        id: userMsgId,
        sender: 'user',
        text: prompt,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      {
        id: assistantMsgId,
        sender: 'assistant',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];

    setMessages(newMessages);
    setIsLoading(true);
    addLog(`[cmd] User prompt: "${prompt}"`);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, files }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat API responded with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const currentFiles: VFSMap = { ...files };

      // Initialize Streaming Action Parser with existing files for patch support
      const parser = new StreamingActionParser(
        {
          onTextMessage: (delta) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + delta } : m))
            );
          },
          onFileStart: (filePath) => {
            addLog(`[file] Streaming new file: ${filePath}`);
            currentFiles[filePath] = { path: filePath, content: '' };
            setFiles((prev) => ({
              ...prev,
              [filePath]: { path: filePath, content: '' },
            }));
            setActiveFile(filePath);
            setOpenFiles((prev) => (prev.includes(filePath) ? prev : [...prev, filePath]));
          },
          onFileContent: (filePath, totalContent) => {
            currentFiles[filePath] = { path: filePath, content: totalContent };
            setFiles((prev) => ({
              ...prev,
              [filePath]: { path: filePath, content: totalContent },
            }));
          },
          onFileEnd: (filePath, totalContent) => {
            currentFiles[filePath] = { path: filePath, content: totalContent };
            setFiles((prev) => ({
              ...prev,
              [filePath]: { path: filePath, content: totalContent },
            }));
            addLog(`[file] Completed file: ${filePath}`);
          },
          onFilePatch: (filePath, _s, _r, success, error) => {
            if (success) {
              const patchedContent = parser.getFiles().get(filePath)?.content || '';
              currentFiles[filePath] = { path: filePath, content: patchedContent };
              setFiles((prev) => ({
                ...prev,
                [filePath]: { path: filePath, content: patchedContent },
              }));
              addLog(`[patch] Successfully applied patch to: ${filePath}`);
            } else {
              addLog(`[patch error] Failed to patch ${filePath}: ${error}`);
            }
          },
          onCommand: async (cmd) => {
            addLog(`[cmd] Executing sandbox command: ${cmd}`);
            try {
              const sandboxRes = await fetch('/api/sandbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: cmd, files: currentFiles }),
              });
              const data = await sandboxRes.json();
              if (data.stdout) addLog(data.stdout);
              if (data.stderr) addLog(`[error] ${data.stderr}`);
            } catch (e: any) {
              addLog(`[error] Sandbox execution failed: ${e.message}`);
            }
          },
        },
        files
      );

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        parser.feed(chunk);
      }

      parser.finish();
      addLog('[system] Stream parsing finished successfully. Live preview updated.');
    } catch (err: any) {
      console.error(err);
      addLog(`[error] Stream error: ${err.message}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, text: m.text + `\n\n[連線錯誤: ${err.message}]` }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFixError = (errorText: string) => {
    handleSendMessage(`預覽運行時捕獲到報錯，請幫我自動修復：\n${errorText}`);
  };

  const handleDownloadZip = async () => {
    if (Object.keys(files).length === 0) return;
    addLog('[system] Packaging workspace into ZIP archive...');

    const zip = new JSZip();
    for (const [path, file] of Object.entries(files)) {
      const cleanPath = normalizePath(path);
      if (cleanPath) {
        zip.file(cleanPath, file.content);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hk-agent-project-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    addLog('[system] ZIP package downloaded successfully.');
  };

  const activeContent = activeFile && files[activeFile] ? files[activeFile].content : '';

  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#0d1117] text-white">
      {/* 1. Left: Chat & Prompts Panel */}
      <ChatPanel
        messages={messages}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        onDownloadZip={handleDownloadZip}
        hasFiles={Object.keys(files).length > 0}
      />

      {/* 2. Middle-Left: File Tree */}
      <FileTree
        files={files}
        activeFile={activeFile}
        onSelectFile={handleSelectFile}
      />

      {/* 3. Middle-Center: Monaco Editor & Terminal */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-1 h-2/3 min-h-0">
          <Editor
            activeFile={activeFile}
            content={activeContent}
            onChange={handleFileChange}
            openFiles={openFiles}
            onSelectFile={handleSelectFile}
            onCloseFile={handleCloseFile}
          />
        </div>
        <div className="h-1/3 min-h-0">
          <Terminal logs={logs} onClear={() => setLogs([])} />
        </div>
      </div>

      {/* 4. Right: Live Sandbox Preview */}
      <div className="w-[45%] h-full min-w-[380px]">
        <LivePreview files={files} onFixError={handleFixError} />
      </div>
    </main>
  );
}
