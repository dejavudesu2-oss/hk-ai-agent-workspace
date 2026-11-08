import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generatePreviewHtml, escapeRegExp, safeReplace } from '../lib/preview-generator';
import { getMatchingTemplate } from '../lib/templates';

test('safeReplace: preserves dollar patterns without regex replacement substitution corruption', () => {
  const template = '<html><head></head><body><script src="app.js"></script></body></html>';
  const codeWithDollars = `
    const str = "hello world";
    const result = str.replace(/(\\w+)/, '$1-$&');
    const rest = "$'";
  `;

  const scriptTag = `<script>/* app.js */\n${codeWithDollars}\n</script>`;
  const scriptRegex = new RegExp(`<script[^>]*src=["'][^"']*app\\.js["'][^>]*>\\s*</script>`, 'i');

  const inlined = safeReplace(template, scriptRegex, scriptTag);

  assert.ok(inlined.includes("const result = str.replace(/(\\w+)/, '$1-$&');"));
  assert.ok(inlined.includes("const rest = \"$'\";"));
  assert.ok(inlined.endsWith('</body></html>'));
});

test('escapeRegExp: prevents syntax error when file paths contain regex special characters', () => {
  const problematicPaths = [
    'components/[id].tsx',
    'styles(1).css',
    'pages/item+detail.js',
    'assets/icon{v2}.svg',
  ];

  for (const p of problematicPaths) {
    const escaped = escapeRegExp(p);
    assert.doesNotThrow(() => {
      new RegExp(`<script[^>]*src=["'][^"']*${escaped}["'][^>]*>`, 'i');
    });
  }
});

test('generatePreviewHtml: renders generated todo app with inlined styles, scripts, CSP, and watchdog', () => {
  const todoTemplate = getMatchingTemplate('build me a todo app');
  const vfs: Record<string, { path: string; content: string }> = {};

  for (const f of todoTemplate.files) {
    vfs[f.path] = { path: f.path, content: f.content };
  }

  const html = generatePreviewHtml(vfs);

  // Check CSP is present
  assert.ok(html.includes('Content-Security-Policy'), 'CSP meta tag must be present');
  assert.ok(html.includes("default-src 'self' 'unsafe-inline'"), 'CSP must allow self and inline');

  // Check Watchdog script is present
  assert.ok(html.includes('WATCHDOG_ERROR'), 'Watchdog error listener must be injected');

  // Check CSS is inlined
  assert.ok(html.includes('<style>/* styles.css */'), 'styles.css must be inlined into style tag');
  assert.ok(html.includes('--bg-gradient'), 'CSS variable rules must be preserved');

  // Check JS is inlined
  assert.ok(html.includes('<script type="text/javascript">/* app.js */'), 'app.js must be inlined');
  assert.ok(html.includes('todoInput'), 'JS logic referencing todoInput must be present');

  // Check HTML structure
  assert.ok(html.includes('<input'), 'Todo input must be present');
  assert.ok(html.includes('</button>'), 'Todo action button must be present');
});

test('generatePreviewHtml: injects Babel Standalone and React when JSX/TSX files are present', () => {
  const reactVfs = {
    'index.html': {
      path: 'index.html',
      content: '<html><head></head><body><div id="root"></div></body></html>',
    },
    'App.tsx': {
      path: 'App.tsx',
      content: 'export const App = () => <h1>Hello React</h1>;',
    },
  };

  const html = generatePreviewHtml(reactVfs);
  assert.ok(html.includes('babel.min.js'), 'Babel standalone must be loaded for JSX/TSX');
  assert.ok(html.includes('react.production.min.js'), 'React must be loaded for JSX/TSX');
  assert.ok(html.includes('<script type="text/babel">/* App.tsx */'), 'JSX script must have text/babel type');
  assert.ok(html.includes('window.require'), 'Browser module shim must be present for CommonJS imports');
  // Watchdog script must precede external scripts in head
  assert.ok(html.indexOf('WATCHDOG_ERROR') < html.indexOf('babel.min.js'), 'Watchdog must be injected before external scripts');
});

test('generatePreviewHtml: escapes closing script tags in JS code to prevent HTML parser breakage', () => {
  const vfsWithScriptClose = {
    'index.html': {
      path: 'index.html',
      content: '<html><head></head><body><script src="app.js"></script></body></html>',
    },
    'app.js': {
      path: 'app.js',
      content: 'const regex = /<\\/script>/;\nconst msg = "</script>";',
    },
  };

  const html = generatePreviewHtml(vfsWithScriptClose);
  // Must escape </script to <\/script
  assert.ok(!html.includes('app.js */\nconst regex = /</script>/;'));
  assert.ok(html.includes('<\\/script>'));
});

test('LivePreview component: sandbox attribute strictly excludes allow-same-origin', () => {
  const possiblePaths = [
    path.resolve(process.cwd(), 'src/components/LivePreview.tsx'),
    path.resolve(process.cwd(), 'app/src/components/LivePreview.tsx'),
  ];
  const livePreviewPath = possiblePaths.find((p) => fs.existsSync(p));
  assert.ok(livePreviewPath, 'LivePreview.tsx must exist');

  const content = fs.readFileSync(livePreviewPath, 'utf-8');

  // Verify sandbox attribute
  const sandboxMatch = content.match(/sandbox=["']([^"']+)["']/);
  assert.ok(sandboxMatch, 'LivePreview must declare sandbox attribute on iframe');
  const sandboxValue = sandboxMatch[1];

  assert.ok(sandboxValue.includes('allow-scripts'), 'Must allow scripts to run');
  assert.ok(!sandboxValue.includes('allow-same-origin'), 'Must NOT include allow-same-origin (security hazard)');
});
