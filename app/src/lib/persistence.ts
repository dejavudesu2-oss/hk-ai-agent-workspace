/**
 * app/src/lib/persistence.ts
 * IndexedDB Persistence for VFS and Chat messages.
 * Includes in-memory fallback for headless/Node testing environments.
 */

import { VFSMap } from './vfs';
import { ChatMessage } from '@/components/ChatPanel';

export interface WorkspaceSnapshot {
  id: string;
  files: VFSMap;
  messages: ChatMessage[];
  activeFile?: string;
  updatedAt: number;
}

const DB_NAME = 'hk_ai_agent_workspace_db';
const DB_VERSION = 1;
const STORE_NAME = 'workspace_state';
const CURRENT_SNAPSHOT_KEY = 'active_workspace';

// In-memory fallback for environments without IndexedDB (e.g., Node.js unit tests)
let inMemoryStore: Record<string, any> = {};

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

export function openWorkspaceDB(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB not supported in current environment'));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves VFS, Chat Messages, and active file state to IndexedDB (or in-memory fallback)
 */
export async function saveWorkspaceToIndexedDB(state: {
  files: VFSMap;
  messages: ChatMessage[];
  activeFile?: string;
}): Promise<void> {
  const snapshot: WorkspaceSnapshot = {
    id: CURRENT_SNAPSHOT_KEY,
    files: state.files,
    messages: state.messages,
    activeFile: state.activeFile,
    updatedAt: Date.now(),
  };

  const idb = getIndexedDB();
  if (!idb) {
    // In-memory fallback
    inMemoryStore[CURRENT_SNAPSHOT_KEY] = JSON.parse(JSON.stringify(snapshot));
    return;
  }

  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(snapshot);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Loads the saved workspace state from IndexedDB
 */
export async function loadWorkspaceFromIndexedDB(): Promise<WorkspaceSnapshot | null> {
  const idb = getIndexedDB();
  if (!idb) {
    // In-memory fallback
    const mem = inMemoryStore[CURRENT_SNAPSHOT_KEY];
    return mem ? JSON.parse(JSON.stringify(mem)) : null;
  }

  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(CURRENT_SNAPSHOT_KEY);

    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears saved workspace state
 */
export async function clearWorkspaceIndexedDB(): Promise<void> {
  const idb = getIndexedDB();
  if (!idb) {
    delete inMemoryStore[CURRENT_SNAPSHOT_KEY];
    return;
  }

  const db = await openWorkspaceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(CURRENT_SNAPSHOT_KEY);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Reset memory store for unit testing
 */
export function resetMemoryPersistenceForTesting(): void {
  inMemoryStore = {};
}
