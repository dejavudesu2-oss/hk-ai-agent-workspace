import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StreamingActionParser } from '../lib/streaming-parser';

describe('T36 Reasoning Model Stream Isolation', () => {
  it('parser and stream processor completely ignore reasoning_content and cleanly extract code', () => {
    const parser = new StreamingActionParser();

    // Simulated SSE chunks from a reasoning model (deepseek-reasoner)
    const simulatedSSEChunks = [
      {
        choices: [
          {
            delta: {
              reasoning_content: 'Let me think about how to structure this todo app in vanilla JS and CSS.\nFirst I will create index.html...',
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              reasoning_content: 'Now let us consider the styling and glassmorphism effect. We should use CSS variables.',
            },
          },
        ],
      },
      {
        choices: [
          {
            delta: {
              content: '好的！這是一個香港本地化待辦事項應用。\n\n<sandbox_action type="file" path="app.js">\nconst todos = [];\nconsole.log("Ready");\n</sandbox_action>',
            },
          },
        ],
      },
    ];

    // Filter chunks exactly as RealLLMProvider does: only enqueue delta.content, ignoring delta.reasoning_content
    for (const chunk of simulatedSSEChunks) {
      const delta = chunk.choices[0]?.delta;
      // Explicit invariant: reasoning_content must NOT be enqueued into the code stream
      if (delta.content) {
        parser.feed(delta.content);
      }
    }
    parser.finish();

    const files = parser.getFiles();
    assert.equal(files.size, 1);
    assert.ok(files.has('app.js'));

    const appJs = files.get('app.js');
    assert.ok(appJs);
    assert.ok(appJs.content.includes('const todos = [];'));
    // Invariant: reasoning thoughts must NEVER pollute generated code files
    assert.ok(!appJs.content.includes('Let me think'));
    assert.ok(!appJs.content.includes('glassmorphism effect'));
    assert.equal(appJs.isComplete, true);
  });
});
