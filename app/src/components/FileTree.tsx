'use client';

import React, { useState } from 'react';
import { Folder, FolderOpen, FileCode, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { FileTreeNode, VFSMap, buildFileTree } from '@/lib/vfs';

interface FileTreeProps {
  files: VFSMap;
  activeFile: string;
  onSelectFile: (path: string) => void;
}

export const FileTree: React.FC<FileTreeProps> = ({ files, activeFile, onSelectFile }) => {
  const tree = buildFileTree(files);
  const fileCount = Object.keys(files).length;

  return (
    <div className="w-56 h-full bg-[#161b22] border-r border-[#30363d] flex flex-col text-xs select-none">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] text-gray-400 font-semibold tracking-wide text-[11px] uppercase">
        <span>專案檔案目錄</span>
        <span className="bg-[#21262d] text-gray-300 px-1.5 py-0.5 rounded text-[10px]">
          {fileCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-gray-500 text-center italic">暫無檔案</div>
        ) : (
          tree.map((node) => (
            <TreeNodeItem
              key={node.path}
              node={node}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              depth={0}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface TreeNodeItemProps {
  node: FileTreeNode;
  activeFile: string;
  onSelectFile: (path: string) => void;
  depth: number;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({ node, activeFile, onSelectFile, depth }) => {
  const [isOpen, setIsOpen] = useState(true);

  if (node.isDirectory) {
    return (
      <div>
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{ paddingLeft: `${depth * 14 + 10}px` }}
          className="flex items-center space-x-1.5 py-1 text-gray-300 hover:bg-[#21262d] cursor-pointer"
        >
          {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
          {isOpen ? <FolderOpen className="w-3.5 h-3.5 text-blue-400" /> : <Folder className="w-3.5 h-3.5 text-blue-400" />}
          <span className="font-medium text-gray-200">{node.name}</span>
        </div>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNodeItem
                key={child.path}
                node={child}
                activeFile={activeFile}
                onSelectFile={onSelectFile}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const isActive = node.path === activeFile;

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: `${depth * 14 + 22}px` }}
      className={`flex items-center space-x-1.5 py-1 cursor-pointer transition-colors ${
        isActive
          ? 'bg-[#1f242c] text-blue-400 font-medium'
          : 'text-gray-400 hover:text-gray-200 hover:bg-[#21262d]'
      }`}
    >
      <FileCode className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-gray-500'}`} />
      <span className="truncate">{node.name}</span>
    </div>
  );
};
