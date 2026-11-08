/**
 * scripts/e2e_test.js
 * Automated End-to-End Test for HK AI Agent Workspace
 * Acceptance Test: node app/node_modules/tsx/dist/cli.mjs scripts/e2e_test.js
 *
 * Verifies that the prompt "build me a todo app" via the mock provider:
 * 1. Streams SSE tokens from /api/chat
 * 2. Parses file blocks in real time via StreamingActionParser
 * 3. Populates in-memory Virtual File System (VFS)
 * 4. Compiles and renders live preview HTML with CSS, JS, CSP, and watchdog
 */

const { POST: chatHandler } = require('../app/src/app/api/chat/route');
const { StreamingActionParser } = require('../app/src/lib/streaming-parser');
const { generatePreviewHtml } = require('../app/src/lib/preview-generator');
const { buildFileTree } = require('../app/src/lib/vfs');

class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this._body = options.body;
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
}

async function runEndToEndTest() {
  console.log('================================================================');
  console.log(' HK AI AGENT WORKSPACE - END-TO-END VERIFICATION');
  console.log(' Prompt: "build me a todo app"');
  console.log('================================================================\n');

  // Step 1: Dispatch prompt to Chat API
  console.log('Step 1: Dispatching prompt to /api/chat...');
  const req = new MockNextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'build me a todo app' }),
  });

  const response = await chatHandler(req);
  if (response.status !== 200) {
    throw new Error(`Chat API failed with HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/event-stream')) {
    throw new Error(`Expected text/event-stream, got ${contentType}`);
  }
  console.log('✓ /api/chat connected: HTTP 200 text/event-stream received\n');

  // Step 2: Stream parsing into VFS
  console.log('Step 2: Consuming SSE stream through StreamingActionParser into VFS...');
  const vfs = {};
  const fileStarts = [];
  const fileEnds = [];
  let chatText = '';
  let commandExecuted = '';

  const parser = new StreamingActionParser({
    onTextMessage: (delta) => {
      chatText += delta;
    },
    onFileStart: (filePath) => {
      fileStarts.push(filePath);
      vfs[filePath] = { path: filePath, content: '' };
      console.log(`  [Stream Event] Starting file: ${filePath}`);
    },
    onFileContent: (filePath, totalContent) => {
      if (vfs[filePath]) {
        vfs[filePath].content = totalContent;
      }
    },
    onFileEnd: (filePath, finalContent) => {
      fileEnds.push(filePath);
      console.log(`  [Stream Event] Completed file: ${filePath} (${finalContent.length} bytes)`);
    },
    onCommand: (cmd) => {
      commandExecuted = cmd;
      console.log(`  [Stream Event] Shell command detected: ${cmd}`);
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunkCount = 0;
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunkCount++;
    totalBytes += value.length;
    const chunkText = decoder.decode(value, { stream: true });
    parser.feed(chunkText);
  }

  parser.finish();
  console.log(`✓ Stream completed: ${chunkCount} chunks, ${totalBytes} bytes processed.\n`);

  // Step 3: Validate VFS completeness
  console.log('Step 3: Validating Virtual File System (VFS)...');
  const expectedFiles = ['package.json', 'styles.css', 'app.js', 'index.html'];
  for (const exp of expectedFiles) {
    if (!vfs[exp]) {
      throw new Error(`Missing expected file in VFS: ${exp}`);
    }
    if (vfs[exp].content.length < 50) {
      throw new Error(`File ${exp} has suspiciously small content (${vfs[exp].content.length} bytes)`);
    }
    console.log(`  ✓ Verified ${exp}: ${vfs[exp].content.length} bytes`);
  }

  const fileTree = buildFileTree(vfs);
  console.log(`✓ File Tree constructed successfully with ${fileTree.length} top-level nodes.\n`);

  // Step 4: Render Live Preview from VFS
  console.log('Step 4: Compiling live preview HTML via generatePreviewHtml()...');
  const previewHtml = generatePreviewHtml(vfs);

  // Validate preview contents
  if (!previewHtml.includes('Content-Security-Policy')) {
    throw new Error('Preview HTML missing Content-Security-Policy header tag');
  }
  console.log('  ✓ Content-Security-Policy meta header present');

  if (!previewHtml.includes('WATCHDOG_ERROR')) {
    throw new Error('Preview HTML missing runtime watchdog error handler');
  }
  console.log('  ✓ Watchdog error listener injected');

  if (!previewHtml.includes('todoInput') || !previewHtml.includes('btnAdd')) {
    throw new Error('Preview HTML missing Todo interactive controls (todoInput / btnAdd)');
  }
  console.log('  ✓ Todo interactive input and add button verified');

  if (!previewHtml.includes('<style>/* styles.css */') || !previewHtml.includes('--bg-gradient')) {
    throw new Error('Preview HTML failed to inline styles.css with custom CSS variables');
  }
  console.log('  ✓ Modern glassmorphism CSS verified inlined');

  if (!previewHtml.includes('<script type="text/javascript">/* app.js */') || !previewHtml.includes('localStorage')) {
    throw new Error('Preview HTML failed to inline app.js reactive logic');
  }
  console.log('  ✓ Reactive Todo app JavaScript logic verified inlined\n');

  // Step 5: Test Cantonese Prompt ("寫一個香港的士分賬計算器")
  console.log('Step 5: Testing Hong Kong localized prompt: "寫一個香港的士分賬計算器"...');
  const hkReq = new MockNextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '寫一個香港的士分賬計算器' }),
  });
  const hkRes = await chatHandler(hkReq);
  if (hkRes.status !== 200) throw new Error('HK Taxi Splitter request failed');

  const hkVfs = {};
  const hkParser = new StreamingActionParser({
    onFileStart: (p) => { hkVfs[p] = { path: p, content: '' }; },
    onFileContent: (p, total) => { if (hkVfs[p]) hkVfs[p].content = total; },
  });

  const hkReader = hkRes.body.getReader();
  while (true) {
    const { done, value } = await hkReader.read();
    if (done) break;
    hkParser.feed(decoder.decode(value, { stream: true }));
  }
  hkParser.finish();

  if (!hkVfs['index.html'] || !hkVfs['index.html'].content.includes('香港的士車費分賬計算器')) {
    throw new Error('HK Taxi Splitter template failed to stream correctly');
  }
  const hkPreview = generatePreviewHtml(hkVfs);
  if (!hkPreview.includes('起步價首2公里: HK$ 29.0')) {
    throw new Error('HK Taxi Splitter preview missing HK$ 29.0 flagfall calculation');
  }
  console.log('  ✓ Hong Kong Taxi Fare Splitter streamed and rendered successfully!\n');

  console.log('================================================================');
  console.log(' ✅ T11 END-TO-END ACCEPTANCE TEST PASSED (2/2 scenarios)');
  console.log('    User prompt -> SSE stream -> Parser -> VFS -> Preview Render');
  console.log('================================================================');
  process.exit(0);
}

runEndToEndTest().catch((err) => {
  console.error('\n❌ T11 End-to-End Test FAILED:', err);
  process.exit(1);
});
