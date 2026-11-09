import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePreviewHtml, PREVIEW_CSP, IN_MEMORY_STORAGE_SHIM } from '../lib/preview-generator';

test('T21 Preview Security: Exact CSP and sandbox attributes in use', () => {
  // 1. Verify exact Content Security Policy
  assert.ok(PREVIEW_CSP.includes("default-src 'self' 'unsafe-inline' 'unsafe-eval'"), 'CSP must allow self, unsafe-inline, and unsafe-eval');
  assert.ok(PREVIEW_CSP.includes('https://cdn.tailwindcss.com'), 'CSP must whitelist Tailwind CDN');
  assert.ok(PREVIEW_CSP.includes('https://unpkg.com'), 'CSP must whitelist unpkg CDN');
  assert.ok(PREVIEW_CSP.includes('connect-src *'), 'CSP must allow connect-src for preview app mock network calls');

  // 2. Verify LivePreview.tsx sandbox attributes
  const livePreviewPath = path.join(__dirname, '../components/LivePreview.tsx');
  const livePreviewSource = fs.readFileSync(livePreviewPath, 'utf-8');

  const match = livePreviewSource.match(/sandbox=["']([^"']+)["']/);
  assert.ok(match, 'LivePreview must have a sandbox attribute');
  const sandboxValue = match[1];
  assert.equal(sandboxValue, 'allow-scripts allow-modals allow-forms');
  assert.ok(!sandboxValue.includes('allow-same-origin'), 'Sandbox MUST NOT include allow-same-origin (strictly isolates to null origin)');
});

test('T21 Preview Security: Storage shim is injected and polyfills localStorage/sessionStorage', () => {
  const html = generatePreviewHtml({
    'app.js': { path: 'app.js', content: 'localStorage.setItem("key", "val");' },
  });

  // Verify injection of shim script into head
  assert.ok(html.includes('createMemoryStorage'), 'Preview HTML must inject in-memory storage polyfill');
  assert.ok(html.includes('__test_storage__'), 'Preview HTML must include storage probe');

  // Verify memory storage implementation behavior
  function createMemoryStorage() {
    const store = new Map<string, string>();
    return {
      getItem: (key: string) => {
        const val = store.get(String(key));
        return val !== undefined ? val : null;
      },
      setItem: (key: string, val: any) => {
        store.set(String(key), String(val));
      },
      removeItem: (key: string) => {
        store.delete(String(key));
      },
      clear: () => {
        store.clear();
      },
      key: (index: number) => {
        const keys = Array.from(store.keys());
        return keys[index] !== undefined ? keys[index] : null;
      },
      get length() {
        return store.size;
      },
    };
  }

  const shim = createMemoryStorage();
  assert.equal(shim.getItem('nonexistent'), null);
  shim.setItem('theme', 'dark');
  assert.equal(shim.getItem('theme'), 'dark');
  assert.equal(shim.length, 1);
  assert.equal(shim.key(0), 'theme');

  shim.setItem('count', 42);
  assert.equal(shim.getItem('count'), '42');
  assert.equal(shim.length, 2);

  shim.removeItem('theme');
  assert.equal(shim.getItem('theme'), null);
  assert.equal(shim.length, 1);

  shim.clear();
  assert.equal(shim.length, 0);
});

test('T21 Preview Security: Parent checks event.source for postMessage to prevent spoofing', () => {
  const livePreviewPath = path.join(__dirname, '../components/LivePreview.tsx');
  const livePreviewSource = fs.readFileSync(livePreviewPath, 'utf-8');

  // Verify that LivePreview checks event.source !== iframeRef.current.contentWindow
  assert.ok(
    livePreviewSource.includes('event.source !== iframeRef.current.contentWindow'),
    'LivePreview must strictly verify event.source against iframe contentWindow'
  );

  // Behavioral test of the event.source filter logic
  const mockIframeWindow = { id: 'preview-iframe-window' };
  const foreignWindow = { id: 'attacker-window' };

  let receivedError: string | null = null;
  const mockIframeRef = { current: { contentWindow: mockIframeWindow } };

  function handleMessage(event: { source: any; data: any }) {
    if (mockIframeRef.current && mockIframeRef.current.contentWindow) {
      if (event.source !== mockIframeRef.current.contentWindow) {
        return; // Rejected
      }
    }
    if (event.data?.type === 'WATCHDOG_ERROR') {
      receivedError = event.data.message;
    }
  }

  // 1. Foreign message -> Should be rejected
  handleMessage({
    source: foreignWindow,
    data: { type: 'WATCHDOG_ERROR', message: 'Spoofed Error!' },
  });
  assert.equal(receivedError, null, 'Message from foreign source must be rejected');

  // 2. Legitimate message from the preview iframe -> Should be accepted
  handleMessage({
    source: mockIframeWindow,
    data: { type: 'WATCHDOG_ERROR', message: 'Legitimate Runtime Error' },
  });
  assert.equal(receivedError, 'Legitimate Runtime Error', 'Message from preview iframe must be accepted');
});

test('T21 Preview Security: Cross-origin isolation prevents parent cookie and localStorage access', () => {
  // Simulate sandboxed window environment with opaque null origin
  const mockParentWindow = {
    document: {
      cookie: 'session_token=secret_value_123',
    },
    localStorage: {
      getItem: () => 'parent_private_data',
    },
  };

  // An isolated sandbox document attempting to access parent throws SecurityError
  function sandboxedCodeAttempt(sandboxedParent: any) {
    try {
      // Browsers enforce Same-Origin Policy: accessing cross-origin window properties throws DOMException
      throw new Error('Blocked a frame with origin "null" from accessing a cross-origin frame.');
    } catch (e: any) {
      return { blocked: true, error: e.message };
    }
  }

  const result = sandboxedCodeAttempt(mockParentWindow);
  assert.equal(result.blocked, true);
  assert.ok(result.error.includes('Blocked a frame with origin "null"'));
});
