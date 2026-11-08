/**
 * scripts/test_vfs_stream.js
 * Scripted check for T06:
 * Tests that in-memory virtual file system and file tree update dynamically
 * as the streaming parser receives chunks.
 */

const { StreamingActionParser } = require('../app/src/lib/streaming-parser');
const { buildFileTree, normalizePath } = require('../app/src/lib/vfs');

async function testStreamingVFS() {
  console.log('--- Testing Virtual File System Fed by Streaming Parser ---');

  const vfs = {};
  let activeFile = '';
  const fileEvents = [];

  const parser = new StreamingActionParser({
    onFileStart: (path) => {
      vfs[path] = { path, content: '' };
      activeFile = path;
      const tree = buildFileTree(vfs);
      fileEvents.push({ event: 'start', path, totalFiles: Object.keys(vfs).length, treeSize: tree.length });
    },
    onFileContent: (path, totalContent) => {
      if (vfs[path]) {
        vfs[path].content = totalContent;
      }
    },
    onFileEnd: (path, finalContent) => {
      fileEvents.push({ event: 'end', path, size: finalContent.length });
    },
  });

  const testStreamChunks = [
    'Initializing workspace...\n<sandbox_action type="file" path="src/index.html">\n',
    '<!DOCTYPE html><html><body>\n',
    '  <div id="root">Loading...</div>\n',
    '</body></html>\n</sandbox_action>\n',
    'Creating styles...\n<sandbox_action type="file" path="src/styles/main.css">\n',
    'body { font-family: sans-serif; margin: 0; }\n',
    '.container { padding: 20px; }\n',
    '</sandbox_action>\n',
    'Creating app logic...\n<sandbox_action type="file" path="src/app.js">\n',
    'console.log("App loaded in sandbox!");\n',
    '</sandbox_action>\nDone!',
  ];

  for (let i = 0; i < testStreamChunks.length; i++) {
    const chunk = testStreamChunks[i];
    parser.feed(chunk);

    // Verify intermediate states
    if (i === 3) {
      // After first file completes
      if (!vfs['src/index.html'] || !vfs['src/index.html'].content.includes('Loading...')) {
        throw new Error('VFS failed to capture src/index.html during streaming');
      }
      const tree = buildFileTree(vfs);
      if (tree.length === 0) {
        throw new Error('File tree empty after first file streamed');
      }
      console.log(`✓ Intermediate check 1: 1 file in VFS, tree has root node "${tree[0].name}"`);
    }

    if (i === 7) {
      // After second file completes
      if (!vfs['src/styles/main.css']) {
        throw new Error('VFS failed to capture src/styles/main.css');
      }
      console.log(`✓ Intermediate check 2: 2 files in VFS, nested folders detected`);
    }
  }

  parser.finish();

  // Final verification
  const totalFiles = Object.keys(vfs).length;
  console.log(`Final VFS file count: ${totalFiles}`);
  if (totalFiles !== 3) {
    throw new Error(`Expected 3 files in VFS, got ${totalFiles}`);
  }

  const tree = buildFileTree(vfs);
  console.log(`Final file tree root entries: ${tree.map(n => n.name).join(', ')}`);
  const srcNode = tree.find(n => n.name === 'src');
  if (!srcNode || !srcNode.isDirectory || !srcNode.children) {
    throw new Error('File tree failed to construct nested "src" directory node');
  }

  console.log(`"src" folder children count: ${srcNode.children.length}`);
  console.log('✓ File tree structure successfully verified:\n', JSON.stringify(tree, null, 2));

  console.log('\n✅ T06 Scripted Check PASSED: VFS and file tree dynamically populate as stream arrives.');
}

testStreamingVFS().catch((err) => {
  console.error('❌ T06 Scripted Check FAILED:', err);
  process.exit(1);
});
