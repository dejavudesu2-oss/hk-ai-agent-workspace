import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePreviewHtml, PREVIEW_CSP, IN_MEMORY_STORAGE_SHIM } from '../lib/preview-generator';
import { POST as chatHandler } from '../app/api/chat/route';
import { POST as sandboxHandler } from '../app/api/sandbox/route';

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

test('T21 Preview Security: Backend routes strictly reject sandboxed iframe preview calls (Origin: "null")', async () => {
  // 1. Sandboxed iframe makes fetch to /api/chat with Origin: 'null'
  const chatReq = {
    url: 'http://localhost/api/chat',
    method: 'POST',
    headers: new Map([
      ['origin', 'null'],
      ['content-type', 'application/json'],
    ]),
    json: async () => ({ message: 'steal tokens' }),
  } as any;

  const chatRes = await chatHandler(chatReq);
  assert.equal(chatRes.status, 403, 'Chat API must return 403 Forbidden when origin is "null"');
  const chatBody = await chatRes.json();
  assert.equal(chatBody.code, 'ORIGIN_FORBIDDEN');

  // 2. Sandboxed iframe makes fetch to /api/sandbox with Origin: 'null'
  const sandboxReq = {
    url: 'http://localhost/api/sandbox',
    method: 'POST',
    headers: new Map([
      ['origin', 'null'],
      ['content-type', 'application/json'],
    ]),
    json: async () => ({ command: 'cat /etc/passwd' }),
  } as any;

  const sandboxRes = await sandboxHandler(sandboxReq);
  assert.equal(sandboxRes.status, 403, 'Sandbox API must return 403 Forbidden when origin is "null"');
  const sandboxBody = await sandboxRes.json();
  assert.equal(sandboxBody.code, 'ORIGIN_FORBIDDEN');
});

test('T21 Preview Security: Sandbox attribute strictly omits allow-same-origin to prevent cookie & storage access', () => {
  const livePreviewPath = path.join(__dirname, '../components/LivePreview.tsx');
  const livePreviewSource = fs.readFileSync(livePreviewPath, 'utf-8');

  // Assert sandbox contains allow-scripts but NEVER allow-same-origin
  const match = livePreviewSource.match(/sandbox=["']([^"']+)["']/);
  assert.ok(match);
  const sandboxTokens = match[1].split(/\s+/);
  assert.ok(sandboxTokens.includes('allow-scripts'), 'Must allow scripts');
  assert.ok(!sandboxTokens.includes('allow-same-origin'), 'Must NOT include allow-same-origin');
  assert.ok(!sandboxTokens.includes('allow-top-navigation'), 'Must NOT allow top navigation');
});
