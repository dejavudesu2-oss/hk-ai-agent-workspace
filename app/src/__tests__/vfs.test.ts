import test from 'node:test';
import assert from 'node:assert/strict';
import { detectLanguage, buildFileTree, normalizePath, VFSMap } from '../lib/vfs';

test('normalizePath: correctly strips leading slashes, dot-slashes, and normalizes backslashes', () => {
  assert.equal(normalizePath('./src/index.js'), 'src/index.js');
  assert.equal(normalizePath('/src/index.js'), 'src/index.js');
  assert.equal(normalizePath('.//src//index.js'), 'src/index.js');
  assert.equal(normalizePath('src\\components\\Button.tsx'), 'src/components/Button.tsx');
  assert.equal(normalizePath('./index.html'), 'index.html');
  assert.equal(normalizePath('styles.css/'), 'styles.css');
  assert.equal(normalizePath(''), '');
});

test('detectLanguage: correctly identifies programming languages', () => {
  assert.equal(detectLanguage('index.html'), 'html');
  assert.equal(detectLanguage('./index.html'), 'html');
  assert.equal(detectLanguage('styles.css'), 'css');
  assert.equal(detectLanguage('app.jsx'), 'javascript');
  assert.equal(detectLanguage('server.ts'), 'typescript');
  assert.equal(detectLanguage('component.tsx'), 'typescript');
  assert.equal(detectLanguage('package.json'), 'json');
  assert.equal(detectLanguage('README.md'), 'markdown');
  assert.equal(detectLanguage('setup.sh'), 'shell');
  assert.equal(detectLanguage('unknown.xyz'), 'plaintext');
});

test('buildFileTree: constructs nested hierarchical folder structure and normalizes paths', () => {
  const files: VFSMap = {
    './package.json': { path: './package.json', content: '{}' },
    '/src/index.ts': { path: '/src/index.ts', content: 'console.log()' },
    'src\\components\\Button.tsx': { path: 'src\\components\\Button.tsx', content: 'export const Button = () => null;' },
    'public/favicon.ico': { path: 'public/favicon.ico', content: '' },
  };

  const tree = buildFileTree(files);

  // Expect top level to have: public (dir), src (dir), package.json (file) - NOT '.' folder
  assert.equal(tree.length, 3);
  assert.equal(tree[0].name, 'public');
  assert.equal(tree[0].isDirectory, true);
  assert.equal(tree[1].name, 'src');
  assert.equal(tree[1].isDirectory, true);
  assert.equal(tree[2].name, 'package.json');
  assert.equal(tree[2].isDirectory, false);

  // Check src children
  const src = tree.find((n) => n.name === 'src');
  assert.ok(src && src.children);
  assert.equal(src.children.length, 2);
  assert.equal(src.children[0].name, 'components');
  assert.equal(src.children[0].isDirectory, true);
  assert.equal(src.children[1].name, 'index.ts');
  assert.equal(src.children[1].isDirectory, false);
});
