import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {
  saveWorkspaceToIndexedDB,
  loadWorkspaceFromIndexedDB,
  clearWorkspaceIndexedDB,
  resetMemoryPersistenceForTesting,
} from '../lib/persistence';
import { normalizePath } from '../lib/vfs';

test('Persistence: saves and restores VFS and chat messages cleanly', async () => {
  resetMemoryPersistenceForTesting();

  const mockFiles = {
    'index.html': { path: 'index.html', content: '<h1>Todo App</h1>' },
    'styles.css': { path: 'styles.css', content: 'body { background: #000; }' },
    'app.js': { path: 'app.js', content: 'console.log("ready");' },
  };

  const mockMessages = [
    { id: '1', sender: 'user' as const, text: 'build me a todo app', timestamp: '12:00' },
    { id: '2', sender: 'assistant' as const, text: 'Building your app...', timestamp: '12:01' },
  ];

  // 1. Initial load before save returns null
  const empty = await loadWorkspaceFromIndexedDB();
  assert.equal(empty, null);

  // 2. Save workspace state
  await saveWorkspaceToIndexedDB({
    files: mockFiles,
    messages: mockMessages,
    activeFile: 'app.js',
  });

  // 3. Load workspace snapshot and assert state match
  const restored = await loadWorkspaceFromIndexedDB();
  assert.ok(restored);
  assert.equal(Object.keys(restored.files).length, 3);
  assert.equal(restored.files['index.html'].content, '<h1>Todo App</h1>');
  assert.equal(restored.files['styles.css'].content, 'body { background: #000; }');
  assert.equal(restored.files['app.js'].content, 'console.log("ready");');
  assert.equal(restored.messages.length, 2);
  assert.equal(restored.messages[0].text, 'build me a todo app');
  assert.equal(restored.activeFile, 'app.js');

  // 4. Clear storage
  await clearWorkspaceIndexedDB();
  const cleared = await loadWorkspaceFromIndexedDB();
  assert.equal(cleared, null);
});

test('Persistence: Download ZIP packages valid archive with normalized paths', async () => {
  const mockFiles = {
    'src/index.js': { path: 'src/index.js', content: 'console.log("entry");' },
    'styles\\main.css': { path: 'styles\\main.css', content: '.btn { color: red; }' },
    './package.json': { path: './package.json', content: '{"name":"demo"}' },
  };

  const zip = new JSZip();
  for (const [p, file] of Object.entries(mockFiles)) {
    const clean = normalizePath(p);
    zip.file(clean, file.content);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  assert.ok(zipBuffer.length > 0);

  // Read zip back and verify contents
  const loadedZip = await JSZip.loadAsync(zipBuffer);
  const entryJs = await loadedZip.file('src/index.js')?.async('string');
  assert.equal(entryJs, 'console.log("entry");');

  const css = await loadedZip.file('styles/main.css')?.async('string');
  assert.equal(css, '.btn { color: red; }');

  const pkg = await loadedZip.file('package.json')?.async('string');
  assert.equal(pkg, '{"name":"demo"}');
});
