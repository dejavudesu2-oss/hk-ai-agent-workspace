import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath } from '../lib/vfs';
import { StreamingActionParser } from '../lib/streaming-parser';
import { POST as sandboxHandler } from '../app/api/sandbox/route';

test('T22 Path Normalization: normalizePath handles backslashes, ../ traversal, and absolute paths', () => {
  // 1. Backslash normalization
  assert.equal(normalizePath('src\\components\\Button.tsx'), 'src/components/Button.tsx');
  assert.equal(normalizePath('app\\lib\\utils\\index.ts'), 'app/lib/utils/index.ts');
  assert.equal(normalizePath('.\\styles\\main.css'), 'styles/main.css');

  // 2. Directory traversal (../) neutralization
  assert.equal(normalizePath('../../etc/passwd'), 'etc/passwd');
  assert.equal(normalizePath('src/utils/../../secret.env'), 'secret.env');
  assert.equal(normalizePath('../../../../../root/.bashrc'), 'root/.bashrc');
  assert.equal(normalizePath('a/b/c/../../d'), 'a/d');

  // 3. Absolute paths and Windows drive letters
  assert.equal(normalizePath('/etc/nginx/nginx.conf'), 'etc/nginx/nginx.conf');
  assert.equal(normalizePath('///var/log/syslog'), 'var/log/syslog');
  assert.equal(normalizePath('C:\\Users\\Administrator\\secret.key'), 'Users/Administrator/secret.key');
  assert.equal(normalizePath('D:/projects/app/package.json'), 'projects/app/package.json');
  assert.equal(normalizePath('C:\\..\\..\\etc\\shadow'), 'etc/shadow');

  // 4. Redundant slashes and current directory dots
  assert.equal(normalizePath('././components//Header.jsx'), 'components/Header.jsx');
  assert.equal(normalizePath('foo///bar/./baz'), 'foo/bar/baz');
});

test('T22 Path Normalization: StreamingActionParser normalizes backslashes, ../, and absolute paths in stream', () => {
  const parser = new StreamingActionParser();

  const streamData = `
<sandbox_action type="file" path="src\\components\\Counter.tsx">
export const Counter = () => <div>123</div>;
</sandbox_action>
<sandbox_action type="file" path="../../etc/passwd">
root:x:0:0:root:/root:/bin/bash
</sandbox_action>
<sandbox_action type="file" path="C:\\Users\\Test\\script.js">
console.log("safe");
</sandbox_action>
<sandbox_action type="file" path="/var/www/html/index.html">
<h1>Safe Root</h1>
</sandbox_action>
`;

  parser.feed(streamData);
  parser.finish();

  const files = parser.getFiles();

  // Assert: Backslashes normalized
  assert.ok(files.has('src/components/Counter.tsx'), 'Backslash path must be normalized to forward slashes');
  assert.ok(!files.has('src\\components\\Counter.tsx'));

  // Assert: Traversal neutralized
  assert.ok(files.has('etc/passwd'), 'Leading ../ traversal must be stripped to safe relative path');
  assert.ok(!files.has('../../etc/passwd'));

  // Assert: Windows drive letter stripped
  assert.ok(files.has('Users/Test/script.js'), 'Windows drive letter C:\\ must be stripped');
  assert.ok(!files.has('C:\\Users\\Test\\script.js'));

  // Assert: Absolute leading slash stripped
  assert.ok(files.has('var/www/html/index.html'), 'Leading absolute slash must be stripped');
  assert.ok(!files.has('/var/www/html/index.html'));
});

test('T22 Path Normalization: Sandbox API route sanitizes input files against backslashes and traversals', async () => {
  const req = {
    url: 'http://localhost/api/sandbox',
    method: 'POST',
    json: async () => ({
      command: 'npm install',
      files: {
        'src\\components\\Widget.js': { path: 'src\\components\\Widget.js', content: 'export default 1;' },
        '../../etc/shadow': { path: '../../etc/shadow', content: 'fake shadow' },
        'C:\\Windows\\System32\\cmd.exe': { path: 'C:\\Windows\\System32\\cmd.exe', content: 'binary' },
        '/opt/config.json': { path: '/opt/config.json', content: '{"port": 80}' },
      },
    }),
  } as any;

  const res = await sandboxHandler(req);
  assert.equal(res.status, 200);

  const data = await res.json();
  assert.equal(data.exitCode, 0);
  // Simulator output should report 4 indexed sanitized workspace files
  assert.ok(data.stdout.includes('Indexed 4 workspace files in virtual layer'));
});
