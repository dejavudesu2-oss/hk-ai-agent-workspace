import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as chatHandler } from '../app/api/chat/route';
import { applyPatch, parsePatchBlock } from '../lib/patch';
import { StreamingActionParser } from '../lib/streaming-parser';
import { generatePreviewHtml } from '../lib/preview-generator';

test('applyPatch: rejects search text matching 0 times', () => {
  const content = 'const color = "red";\nconst name = "todo";';
  const result = applyPatch(content, 'const color = "blue";', 'const color = "green";');

  assert.equal(result.success, false);
  assert.equal(result.matchCount, 0);
  assert.ok(result.error?.includes('Expected 1 match, found 0'));
  assert.equal(result.newContent, content);
});

test('applyPatch: rejects search text matching more than once (ambiguity check)', () => {
  const content = 'item\nitem\nitem';
  const result = applyPatch(content, 'item', 'product');

  assert.equal(result.success, false);
  assert.equal(result.matchCount, 3);
  assert.ok(result.error?.includes('Expected 1 match, found 3'));
  assert.equal(result.newContent, content);
});

test('applyPatch: succeeds and replaces when search text matches exactly once', () => {
  const content = 'function add() {\n  return a + b;\n}';
  const result = applyPatch(content, '  return a + b;', '  return Number(a) + Number(b);');

  assert.equal(result.success, true);
  assert.equal(result.matchCount, 1);
  assert.equal(result.newContent, 'function add() {\n  return Number(a) + Number(b);\n}');
});

test('applyPatch: succeeds when originalContent has Windows CRLF line endings and searchText has LF', () => {
  const content = 'function add() {\r\n  return a + b;\r\n}';
  const result = applyPatch(content, '  return a + b;\n}', '  return a + b + 1;\n}');

  assert.equal(result.success, true);
  assert.equal(result.matchCount, 1);
  assert.ok(result.newContent.includes('return a + b + 1;'));
  assert.ok(result.newContent.includes('\r\n'), 'Should preserve CRLF when target file used CRLF');
});

test('applyPatch: succeeds when searchText has single leading/trailing newline from XML formatting', () => {
  const content = 'const x = 1;\nconst y = 2;\nconst z = 3;';
  // Search text with leading & trailing newlines from <search>\n...\n</search>
  const searchText = '\nconst y = 2;\n';
  const result = applyPatch(content, searchText, '\nconst y = 42;\n');

  assert.equal(result.success, true);
  assert.equal(result.matchCount, 1);
  assert.equal(result.newContent, 'const x = 1;\nconst y = 42;\nconst z = 3;');
});

test('parsePatchBlock: extracts search and replace chunks correctly', () => {
  const block = `
<search>
.btn-add { background: red; }
</search>
<replace>
.btn-add { background: blue; }
</replace>
`;
  const parsed = parsePatchBlock(block);
  assert.ok(parsed);
  assert.equal(parsed.search.trim(), '.btn-add { background: red; }');
  assert.equal(parsed.replace.trim(), '.btn-add { background: blue; }');
});

test('T18 Multi-Turn Edit Flow: prompt 1 "build a todo app", prompt 2 "make the add button blue and add a delete-all button"', async () => {
  // === TURN 1: Initial App Generation ===
  const req1 = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'build a todo app' }),
  });

  const res1 = await chatHandler(req1);
  assert.equal(res1.status, 200);

  const reader1 = res1.body!.getReader();
  const decoder1 = new TextDecoder();
  let stream1 = '';
  while (true) {
    const { done, value } = await reader1.read();
    if (done) break;
    stream1 += decoder1.decode(value, { stream: true });
  }

  const parser1 = new StreamingActionParser();
  parser1.feed(stream1);
  const state1 = parser1.finish();

  const vfs: Record<string, { path: string; content: string }> = {};
  for (const f of state1.files) {
    vfs[f.path] = { path: f.path, content: f.content };
  }

  assert.ok(vfs['package.json']);
  assert.ok(vfs['styles.css']);
  assert.ok(vfs['index.html']);
  assert.ok(vfs['app.js']);

  const initialPkgContent = vfs['package.json'].content;
  const initialCssContent = vfs['styles.css'].content;

  // Verify Turn 1 preview renders
  const previewHtml1 = generatePreviewHtml(vfs);
  assert.ok(previewHtml1.includes('<!DOCTYPE html>'));
  assert.ok(previewHtml1.includes('var(--primary)'));

  // === TURN 2: Edit Turn via Patch Action ===
  // Send file tree / context on follow-up turn
  const req2 = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'make the add button blue and add a delete-all button',
      files: vfs,
    }),
  });

  const res2 = await chatHandler(req2);
  assert.equal(res2.status, 200);

  const reader2 = res2.body!.getReader();
  const decoder2 = new TextDecoder();
  let stream2 = '';
  while (true) {
    const { done, value } = await reader2.read();
    if (done) break;
    stream2 += decoder2.decode(value, { stream: true });
  }

  // Feed Turn 2 patches into parser preloaded with Turn 1 VFS
  const parser2 = new StreamingActionParser({}, vfs);
  parser2.feed(stream2);
  const state2 = parser2.finish();

  const updatedVfs: Record<string, { path: string; content: string }> = {};
  for (const f of state2.files) {
    updatedVfs[f.path] = { path: f.path, content: f.content };
  }

  // 1. Assert intended files changed:
  // styles.css changed to vibrant blue (#2563eb)
  assert.notEqual(updatedVfs['styles.css'].content, initialCssContent);
  assert.ok(updatedVfs['styles.css'].content.includes('#2563eb'));

  // index.html changed to include delete all button
  assert.ok(updatedVfs['index.html'].content.includes('id="btnDeleteAll"'));
  assert.ok(updatedVfs['index.html'].content.includes('刪除全部'));

  // app.js changed to include delete all click listener
  assert.ok(updatedVfs['app.js'].content.includes('btnDeleteAll'));

  // 2. Assert UNINTENDED files did NOT change:
  assert.equal(
    updatedVfs['package.json'].content,
    initialPkgContent,
    'package.json must NOT be modified by the edit turn'
  );

  // 3. Assert updated preview renders cleanly
  const previewHtml2 = generatePreviewHtml(updatedVfs);
  assert.ok(previewHtml2.includes('<!DOCTYPE html>'));
  assert.ok(previewHtml2.includes('#2563eb'));
  assert.ok(previewHtml2.includes('btnDeleteAll'));
  assert.ok(previewHtml2.includes('default-src')); // CSP verified
});
