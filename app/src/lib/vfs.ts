/**
 * Virtual File System (VFS) and File Tree Utilities
 */

export interface VFSFile {
  path: string;
  content: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileTreeNode[];
}

export type VFSMap = Record<string, VFSFile>;

/**
 * Normalizes file paths to a standard relative format:
 * - Replaces backslashes with forward slashes
 * - Strips leading './' or '/'
 * - Normalizes redundant slashes
 * - Resolves internal relative navigation and blocks parent directory traversal
 */
export function normalizePath(rawPath: string): string {
  if (!rawPath) return '';
  let clean = rawPath.replace(/\\/g, '/').trim();
  clean = clean.replace(/^(\.\/|\/)+/, '');
  clean = clean.replace(/\/+/g, '/');
  clean = clean.replace(/\/+$/, '');

  const parts = clean.split('/');
  const safeParts: string[] = [];
  for (const p of parts) {
    if (p === '.' || p === '') continue;
    if (p === '..') {
      if (safeParts.length > 0) {
        safeParts.pop();
      }
      continue;
    }
    safeParts.push(p);
  }
  return safeParts.join('/');
}

export function detectLanguage(filePath: string): string {
  const cleanPath = normalizePath(filePath);
  const ext = cleanPath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'py':
      return 'python';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

export function buildFileTree(files: VFSMap): FileTreeNode[] {
  const root: FileTreeNode = {
    name: 'root',
    path: '',
    isDirectory: true,
    children: [],
  };

  // Group by normalized path
  const normalizedMap = new Map<string, VFSFile>();
  for (const [key, val] of Object.entries(files)) {
    const norm = normalizePath(key || val.path);
    if (norm) {
      normalizedMap.set(norm, { path: norm, content: val.content });
    }
  }

  const sortedPaths = Array.from(normalizedMap.keys()).sort();

  for (const filePath of sortedPaths) {
    const parts = filePath.split('/').filter(Boolean);
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!currentNode.children) {
        currentNode.children = [];
      }

      let existing = currentNode.children.find((c) => c.name === part);
      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isDirectory: !isFile,
          children: isFile ? undefined : [],
        };
        currentNode.children.push(existing);
      }
      currentNode = existing;
    }
  }

  // Sort folders first, then files alphabetically
  function sortNodes(nodes: FileTreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  }

  if (root.children) {
    sortNodes(root.children);
    return root.children;
  }
  return [];
}
