import test from 'node:test';
import assert from 'node:assert/strict';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function safeReplace(str: string, pattern: RegExp | string, replacement: string): string {
  return str.replace(pattern, () => replacement);
}

test('safeReplace: preserves dollar patterns without regex replacement substitution corruption', () => {
  const template = '<html><head></head><body><script src="app.js"></script></body></html>';
  // Code with $1, $', $&, which triggers replacement bug in standard replace(str, code)
  const codeWithDollars = `
    const str = "hello world";
    const result = str.replace(/(\\w+)/, '$1-$&');
    const rest = "$'";
  `;

  const scriptTag = `<script>/* app.js */\n${codeWithDollars}\n</script>`;
  const scriptRegex = new RegExp(`<script[^>]*src=["'][^"']*app\\.js["'][^>]*>\\s*</script>`, 'i');

  const inlined = safeReplace(template, scriptRegex, scriptTag);

  // Must contain verbatim code without being mangled or repeating document body
  assert.ok(inlined.includes("const result = str.replace(/(\\w+)/, '$1-$&');"));
  assert.ok(inlined.includes("const rest = \"$'\";"));
  // Ensure the script tag wasn't duplicated or mangled into surrounding tags
  assert.ok(inlined.endsWith('</body></html>'));
});

test('escapeRegExp: prevents syntax error when file paths contain regex special characters', () => {
  const problematicPaths = [
    'components/[id].tsx',
    'styles(1).css',
    'pages/item+detail.js',
    'assets/icon{v2}.svg',
  ];

  for (const path of problematicPaths) {
    const escaped = escapeRegExp(path);
    assert.doesNotThrow(() => {
      new RegExp(`<script[^>]*src=["'][^"']*${escaped}["'][^>]*>`, 'i');
    });
  }
});
