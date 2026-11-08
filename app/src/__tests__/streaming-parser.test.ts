import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamingActionParser } from '../lib/streaming-parser';

test('StreamingActionParser: parses single file in single chunk', () => {
  const fileStarts: string[] = [];
  const fileEnds: string[] = [];
  let fileContent = '';

  const parser = new StreamingActionParser({
    onFileStart: (path) => fileStarts.push(path),
    onFileContent: (_path, _total, delta) => (fileContent += delta),
    onFileEnd: (path) => fileEnds.push(path),
  });

  const raw = `<sandbox_action type="file" path="src/index.js">
console.log("hello world");
</sandbox_action>`;

  parser.feed(raw);
  parser.finish();

  assert.deepEqual(fileStarts, ['src/index.js']);
  assert.deepEqual(fileEnds, ['src/index.js']);
  assert.equal(fileContent.trim(), 'console.log("hello world");');
});

test('StreamingActionParser: handles chunks split across tag boundaries', () => {
  const fileStarts: string[] = [];
  const fileEnds: string[] = [];
  let accumulatedContent = '';

  const parser = new StreamingActionParser({
    onFileStart: (path) => fileStarts.push(path),
    onFileContent: (_path, total) => (accumulatedContent = total),
    onFileEnd: (path) => fileEnds.push(path),
  });

  // Simulating 5 realistic network stream packets
  parser.feed('Here is the code: ');
  parser.feed('<sandbox_');
  parser.feed('action type="file" path="app.tsx">\n');
  parser.feed('export const App = () => <div>');
  parser.feed('HK AI</div>;\n</sandbox_');
  parser.feed('action>\nDone!');
  parser.finish();

  assert.deepEqual(fileStarts, ['app.tsx']);
  assert.deepEqual(fileEnds, ['app.tsx']);
  assert.equal(accumulatedContent.trim(), 'export const App = () => <div>HK AI</div>;');
});

test('StreamingActionParser: handles tag split across chunks with very long file path', () => {
  const fileStarts: string[] = [];
  const fileEnds: string[] = [];
  let content = '';

  const parser = new StreamingActionParser({
    onFileStart: (path) => fileStarts.push(path),
    onFileContent: (_path, total) => (content = total),
    onFileEnd: (path) => fileEnds.push(path),
  });

  const longPath = 'src/components/features/analytics/realtime/RealtimeMetricDashboardViewModal.tsx';
  parser.feed('Starting generation: <sandbox_action type="file" path="src/components/features/');
  parser.feed('analytics/realtime/RealtimeMetricDashboardViewModal.tsx">\n');
  parser.feed('export const Modal = () => null;\n</sandbox_action>');
  parser.finish();

  assert.deepEqual(fileStarts, [longPath]);
  assert.deepEqual(fileEnds, [longPath]);
  assert.equal(content.trim(), 'export const Modal = () => null;');
});

test('StreamingActionParser: handles JSX elements and < symbols inside file without premature withholding', () => {
  let content = '';

  const parser = new StreamingActionParser({
    onFileContent: (_path, total) => (content = total),
  });

  parser.feed('<sandbox_action type="file" path="App.tsx">\n');
  parser.feed('export const App = () => (\n');
  parser.feed('  <div className="container">\n');
  parser.feed('    <button onClick={() => alert("click")}>Click</button>\n');
  parser.feed('    <span>5 < 10 && 20 > 5</span>\n');
  parser.feed('  </div>\n');
  parser.feed(');\n</sandbox_action>');
  parser.finish();

  assert.ok(content.includes('<button onClick'));
  assert.ok(content.includes('<span>5 < 10 && 20 > 5</span>'));
});

test('StreamingActionParser: flushes remaining buffer on finish even if stream ended abruptly', () => {
  let content = '';
  const fileEnds: string[] = [];

  const parser = new StreamingActionParser({
    onFileContent: (_path, total) => (content = total),
    onFileEnd: (path) => fileEnds.push(path),
  });

  parser.feed('<sandbox_action type="file" path="incomplete.js">\n');
  parser.feed('const unfinishedCode = 42;');
  // No closing </sandbox_action>
  parser.finish();

  assert.deepEqual(fileEnds, ['incomplete.js']);
  assert.ok(content.includes('const unfinishedCode = 42;'));
});

test('StreamingActionParser: handles flexible closing tags with whitespace', () => {
  const fileEnds: string[] = [];

  const parser = new StreamingActionParser({
    onFileEnd: (path) => fileEnds.push(path),
  });

  parser.feed('<sandbox_action type="file" path="test.js">\nconsole.log(1);\n</sandbox_action >');
  parser.feed('<boltAction type="file" path="test2.js">\nconsole.log(2);\n</boltAction   >');
  parser.finish();

  assert.deepEqual(fileEnds, ['test.js', 'test2.js']);
});

test('StreamingActionParser: swallows boltArtifact container tags without polluting chat messages', () => {
  const textMessages: string[] = [];
  const fileEnds: string[] = [];

  const parser = new StreamingActionParser({
    onTextMessage: (delta) => textMessages.push(delta),
    onFileEnd: (path) => fileEnds.push(path),
  });

  parser.feed('Preparing project...\n<boltArtifact id="todo" title="Todo App">\n');
  parser.feed('<boltAction type="file" filePath="index.html">\n<h1>App</h1>\n</boltAction>\n');
  parser.feed('</boltArtifact>\nReady to run!');
  parser.finish();

  const fullText = textMessages.join('');
  assert.ok(!fullText.includes('boltArtifact'));
  assert.ok(fullText.includes('Preparing project'));
  assert.ok(fullText.includes('Ready to run'));
  assert.deepEqual(fileEnds, ['index.html']);
});

test('StreamingActionParser: normalizes file paths with leading ./ and backslashes', () => {
  const fileStarts: string[] = [];

  const parser = new StreamingActionParser({
    onFileStart: (path) => fileStarts.push(path),
  });

  parser.feed('<sandbox_action type="file" path="./src/components/Header.tsx">content</sandbox_action>');
  parser.feed('<sandbox_action type="file" path="/public/favicon.ico">ico</sandbox_action>');
  parser.feed('<sandbox_action type="file" path="src\\utils\\math.ts">math</sandbox_action>');
  parser.finish();

  assert.deepEqual(fileStarts, [
    'src/components/Header.tsx',
    'public/favicon.ico',
    'src/utils/math.ts',
  ]);
});

test('StreamingActionParser: handles multiple files and commands in sequence', () => {
  const filesCreated: string[] = [];
  const commandsRun: string[] = [];
  const textMessages: string[] = [];

  const parser = new StreamingActionParser({
    onTextMessage: (delta) => textMessages.push(delta),
    onFileEnd: (path) => filesCreated.push(path),
    onCommand: (cmd) => commandsRun.push(cmd),
  });

  const stream = `
Analyzing request...
<sandbox_action type="file" path="index.html">
<h1>HK AI App</h1>
</sandbox_action>
<sandbox_action type="file" path="style.css">
body { color: red; }
</sandbox_action>
<sandbox_action type="command">
npm install
</sandbox_action>
All done!
`;

  // Feed in 10-char fragments
  for (let i = 0; i < stream.length; i += 10) {
    parser.feed(stream.substring(i, i + 10));
  }
  parser.finish();

  assert.deepEqual(filesCreated, ['index.html', 'style.css']);
  assert.deepEqual(commandsRun, ['npm install']);
  const fullText = textMessages.join('');
  assert.ok(fullText.includes('Analyzing request'));
  assert.ok(fullText.includes('All done'));
});

test('StreamingActionParser: compatibility with boltAction tags', () => {
  const filesCreated: string[] = [];
  let content = '';

  const parser = new StreamingActionParser({
    onFileEnd: (path, total) => {
      filesCreated.push(path);
      content = total;
    },
  });

  parser.feed('<boltAction type="file" filePath="package.json">{"name":"demo"}</boltAction>');
  parser.finish();

  assert.deepEqual(filesCreated, ['package.json']);
  assert.equal(content, '{"name":"demo"}');
});

test('StreamingActionParser: auto-recovers when LLM omits closing tag before starting next file', () => {
  const filesEnded: string[] = [];
  const contents: Record<string, string> = {};

  const parser = new StreamingActionParser({
    onFileEnd: (path, total) => {
      filesEnded.push(path);
      contents[path] = total.trim();
    },
  });

  // Notice no </sandbox_action> closing tag for file1.js
  parser.feed('<sandbox_action type="file" path="file1.js">\nconst a = 1;\n');
  parser.feed('<sandbox_action type="file" path="file2.js">\nconst b = 2;\n</sandbox_action>');
  parser.finish();

  assert.deepEqual(filesEnded, ['file1.js', 'file2.js']);
  assert.equal(contents['file1.js'], 'const a = 1;');
  assert.equal(contents['file2.js'], 'const b = 2;');
});

test('StreamingActionParser: handles unquoted attribute syntax without crashing', () => {
  const filesEnded: string[] = [];
  let content = '';

  const parser = new StreamingActionParser({
    onFileEnd: (path, total) => {
      filesEnded.push(path);
      content = total.trim();
    },
  });

  parser.feed('<sandbox_action type=file path=src/main.ts>\nconst ready = true;\n</sandbox_action>');
  parser.finish();

  assert.deepEqual(filesEnded, ['src/main.ts']);
  assert.equal(content, 'const ready = true;');
});

test('StreamingActionParser: ignores malformed action tag missing path attribute safely', () => {
  const textMessages: string[] = [];
  const filesEnded: string[] = [];

  const parser = new StreamingActionParser({
    onTextMessage: (delta) => textMessages.push(delta),
    onFileEnd: (path) => filesEnded.push(path),
  });

  // Malformed tag: missing path
  parser.feed('Here is an invalid tag: <sandbox_action type="file">oops</sandbox_action> Still working.');
  parser.finish();

  assert.equal(filesEnded.length, 0);
  const fullText = textMessages.join('');
  assert.ok(fullText.includes('Here is an invalid tag'));
  assert.ok(fullText.includes('Still working'));
});

test('StreamingActionParser: extreme fragmentation with 1-character feed chunks', () => {
  const filesEnded: string[] = [];
  let content = '';

  const parser = new StreamingActionParser({
    onFileEnd: (path, total) => {
      filesEnded.push(path);
      content = total.trim();
    },
  });

  const fullPayload = '<sandbox_action type="file" path="tiny.txt">Hello HK AI Agent!</sandbox_action>';

  // Feed 1 character at a time
  for (const char of fullPayload) {
    parser.feed(char);
  }
  parser.finish();

  assert.deepEqual(filesEnded, ['tiny.txt']);
  assert.equal(content, 'Hello HK AI Agent!');
});

test('StreamingActionParser: handles unicode, emoji, and special characters inside content', () => {
  let content = '';

  const parser = new StreamingActionParser({
    onFileContent: (_path, total) => (content = total),
  });

  const unicodeSnippet = 'const greeting = "你好，香港！🇭🇰 $HKD 7.80 <script>alert(1)</script>";';
  parser.feed(`<sandbox_action type="file" path="test.ts">\n${unicodeSnippet}\n</sandbox_action>`);
  parser.finish();

  assert.ok(content.includes('你好，香港！🇭🇰'));
  assert.ok(content.includes('<script>alert(1)</script>'));
});

test('StreamingActionParser: parses action tags with spaces around equals signs', () => {
  const filesEnded: string[] = [];
  let content = '';

  const parser = new StreamingActionParser({
    onFileEnd: (path, total) => {
      filesEnded.push(path);
      content = total.trim();
    },
  });

  parser.feed('<sandbox_action type = "file" path = "spaced.js">\nconst spaced = true;\n</sandbox_action>');
  parser.finish();

  assert.deepEqual(filesEnded, ['spaced.js']);
  assert.equal(content, 'const spaced = true;');
});

test('StreamingActionParser: handles self-closing action tags gracefully', () => {
  const filesStarted: string[] = [];
  const filesEnded: string[] = [];

  const parser = new StreamingActionParser({
    onFileStart: (path) => filesStarted.push(path),
    onFileEnd: (path) => filesEnded.push(path),
  });

  parser.feed('<sandbox_action type="file" path="touch.txt" />\nSome trailing text');
  parser.finish();

  assert.deepEqual(filesStarted, ['touch.txt']);
  assert.deepEqual(filesEnded, ['touch.txt']);
});

