import test from 'node:test';
import assert from 'node:assert/strict';
import { RealLLMProvider, UpstreamConfig } from '../lib/llm-provider';
import { StreamingActionParser } from '../lib/streaming-parser';

function createMockSSEResponse(content: string, status = 200): Response {
  const encoder = new TextEncoder();
  const chunks = [
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    'data: [DONE]\n\n',
  ];

  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

test('T20 Failover: Primary returns 429 -> Fails over to Secondary seamlessly', async () => {
  const upstreams: UpstreamConfig[] = [
    {
      name: 'Primary (DeepSeek)',
      baseUrl: 'https://primary.example.com',
      apiKey: 'k1',
      model: 'm1',
      fetchFn: async () => new Response('Too Many Requests', { status: 429 }),
    },
    {
      name: 'Secondary (SiliconFlow)',
      baseUrl: 'https://secondary.example.com',
      apiKey: 'k2',
      model: 'm2',
      fetchFn: async () =>
        createMockSSEResponse(
          '<sandbox_action type="file" path="app.js">\nconsole.log("From Secondary");\n</sandbox_action>'
        ),
    },
  ];

  const provider = new RealLLMProvider('k1', 'k2', upstreams);
  const res = await provider.streamChat('build me an app');

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-LLM-Provider'), 'Secondary (SiliconFlow)');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }

  assert.ok(full.includes('From Secondary'));
});

test('T20 Failover: Primary returns 503 -> Fails over to Secondary seamlessly', async () => {
  const upstreams: UpstreamConfig[] = [
    {
      name: 'Primary (DeepSeek)',
      baseUrl: 'https://primary.example.com',
      apiKey: 'k1',
      model: 'm1',
      fetchFn: async () => new Response('Service Unavailable', { status: 503 }),
    },
    {
      name: 'Secondary (SiliconFlow)',
      baseUrl: 'https://secondary.example.com',
      apiKey: 'k2',
      model: 'm2',
      fetchFn: async () =>
        createMockSSEResponse(
          '<sandbox_action type="file" path="index.html">\n<h1>Recovered from 503</h1>\n</sandbox_action>'
        ),
    },
  ];

  const provider = new RealLLMProvider('k1', 'k2', upstreams);
  const res = await provider.streamChat('build me an app');

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-LLM-Provider'), 'Secondary (SiliconFlow)');

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
  }

  assert.ok(full.includes('Recovered from 503'));
});

test('T20 Failover: Primary is a slow stream -> Times out and fails over to Secondary', async () => {
  const upstreams: UpstreamConfig[] = [
    {
      name: 'Primary (DeepSeek Stalled)',
      baseUrl: 'https://primary.example.com',
      apiKey: 'k1',
      model: 'm1',
      timeoutMs: 80, // Low timeout threshold for test
      fetchFn: async () => {
        // Hang longer than timeoutMs
        await new Promise((r) => setTimeout(r, 400));
        return createMockSSEResponse('Too late');
      },
    },
    {
      name: 'Secondary (SiliconFlow Fast)',
      baseUrl: 'https://secondary.example.com',
      apiKey: 'k2',
      model: 'm2',
      fetchFn: async () =>
        createMockSSEResponse(
          '<sandbox_action type="file" path="app.js">\nconsole.log("Fast recovery");\n</sandbox_action>'
        ),
    },
  ];

  const provider = new RealLLMProvider('k1', 'k2', upstreams);
  const res = await provider.streamChat('build me an app');

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-LLM-Provider'), 'Secondary (SiliconFlow Fast)');
});

test('T20 Failover: RealLLMProvider handles mid-stream disconnect, fails over, and parser discards partial file', async () => {
  const encoder = new TextEncoder();

  // Upstream 1 emits a partial file then abruptly disconnects (throws error)
  const brokenStream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content: '<sandbox_action type="file" path="app.js">\nconst halfWritten = 123;' } }] })}\n\n`
        )
      );
      // Simulate socket reset mid-stream
      controller.error(new Error('Connection reset by peer mid-stream'));
    },
  });

  // Upstream 2 provides the complete recovery file
  const recoveryStream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ delta: { content: '<sandbox_action type="file" path="app.js">\nconst cleanCode = true;\nconsole.log("Complete");\n</sandbox_action>' } }] })}\n\n`
        )
      );
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  const upstreams: UpstreamConfig[] = [
    {
      name: 'Primary (Fails Mid-Stream)',
      baseUrl: 'https://primary.example.com',
      apiKey: 'k1',
      model: 'm1',
      fetchFn: async () =>
        new Response(brokenStream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    },
    {
      name: 'Secondary (Failover Recovery)',
      baseUrl: 'https://secondary.example.com',
      apiKey: 'k2',
      model: 'm2',
      fetchFn: async () =>
        new Response(recoveryStream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    },
  ];

  const provider = new RealLLMProvider('k1', 'k2', upstreams);
  const res = await provider.streamChat('build me an app');

  assert.equal(res.status, 200);

  const parser = new StreamingActionParser();
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
  parser.finish();

  const finalFiles = parser.getFiles();
  const appJs = finalFiles.get('app.js');
  assert.ok(appJs, 'app.js must exist');
  assert.ok(!appJs.content.includes('halfWritten'), 'Partial file content must be discarded on failover');
  assert.ok(appJs.content.includes('const cleanCode = true;'));
  assert.equal(appJs.isComplete, true);
});

test('T20 Failover: Both providers fail -> User sees clear error message', async () => {
  const upstreams: UpstreamConfig[] = [
    {
      name: 'Primary (DeepSeek)',
      baseUrl: 'https://primary.example.com',
      apiKey: 'k1',
      model: 'm1',
      fetchFn: async () => new Response('Primary Rate Limit', { status: 429 }),
    },
    {
      name: 'Secondary (SiliconFlow)',
      baseUrl: 'https://secondary.example.com',
      apiKey: 'k2',
      model: 'm2',
      fetchFn: async () => new Response('Secondary Service Unavailable', { status: 503 }),
    },
  ];

  const provider = new RealLLMProvider('k1', 'k2', upstreams);
  const res = await provider.streamChat('build me an app', { noMockFallback: true });

  assert.equal(res.status, 503, 'When both fail with noMockFallback, must return 503');
  const data = await res.json();
  assert.equal(data.code, 'ALL_PROVIDERS_FAILED');
  assert.ok(data.error.includes('All upstream LLM providers failed'));
  assert.ok(data.error.includes('503'));
});
