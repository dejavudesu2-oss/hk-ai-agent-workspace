import test from 'node:test';
import assert from 'node:assert/strict';
import { StreamingActionParser } from '../lib/streaming-parser';
import { normalizePath } from '../lib/vfs';

test('T17 Regression: code containing escaped closing tags does not terminate prematurely', () => {
  const filesEnded: Array<{ path: string; content: string }> = [];
  const parser = new StreamingActionParser({
    onFileEnd: (p, content) => {
      filesEnded.push({ path: p, content });
    },
  });

  const stream = `
<sandbox_action type="file" path="parser-docs.md">
# Parser Documentation
To close an action block, use the tag:
\`\`\`html
<\\/sandbox_action>
\`\`\`
This text should still be inside parser-docs.md.
</sandbox_action>
`;

  // Feed in fragmented chunks
  for (const ch of stream) {
    parser.feed(ch);
  }
  parser.finish();

  assert.equal(filesEnded.length, 1);
  assert.equal(filesEnded[0].path, 'parser-docs.md');
  assert.ok(filesEnded[0].content.includes('This text should still be inside parser-docs.md.'));
  assert.ok(filesEnded[0].content.includes('</sandbox_action>'));
});

test('T17 Regression: truncated output without closing tag marks file as truncated and preserves content', () => {
  const parser = new StreamingActionParser();

  const stream = `
<sandbox_action type="file" path="truncated.js">
console.log("Start of code");
const x = 42;
// Stream cuts off abruptly right here due to network drop or token cap`;

  parser.feed(stream);
  const result = parser.finish();

  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, 'truncated.js');
  assert.equal(result.files[0].isTruncated, true);
  assert.ok(result.files[0].content.includes('const x = 42;'));
});

test('T17 Regression: prose and markdown code fences around blocks are stripped cleanly', () => {
  const chatMessages: string[] = [];
  const files: string[] = [];

  const parser = new StreamingActionParser({
    onTextMessage: (msg) => chatMessages.push(msg),
    onFileEnd: (p) => files.push(p),
  });

  const stream = `Here is the requested solution:
\`\`\`xml
<sandbox_action type="file" path="index.html">
<h1>Hello World</h1>
</sandbox_action>
\`\`\`
All done! Enjoy!`;

  parser.feed(stream);
  parser.finish();

  assert.equal(files.length, 1);
  assert.equal(files[0], 'index.html');
  const fullChat = chatMessages.join('');
  assert.ok(fullChat.includes('Here is the requested solution:'));
  assert.ok(fullChat.includes('All done! Enjoy!'));
  assert.ok(!fullChat.includes('```xml'), 'Markdown fence ```xml should be stripped');
});

test('T17 Regression: wrong paths (Windows drive, absolute root, directory traversal) normalized safely', () => {
  const cases = [
    { input: 'C:\\Users\\admin\\project\\src\\App.tsx', expected: 'Users/admin/project/src/App.tsx' },
    { input: 'D:/workspace/index.html', expected: 'workspace/index.html' },
    { input: '/etc/passwd', expected: 'etc/passwd' },
    { input: '../../../secret.env', expected: 'secret.env' },
    { input: 'src/components/../../index.js', expected: 'index.js' },
    { input: '.\\components\\Button.jsx', expected: 'components/Button.jsx' },
  ];

  for (const { input, expected } of cases) {
    const normalized = normalizePath(input);
    assert.equal(normalized, expected, `normalizePath("${input}") should equal "${expected}"`);
  }
});
