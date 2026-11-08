/**
 * scripts/test_chat_stream.js
 * Acceptance test for T04: Mock LLM provider that streams SSE tokens at realistic rate + provider adapter.
 */

const { getLLMProvider, MockLLMProvider, RealLLMProvider } = require('../app/src/lib/llm-provider');

async function testProviderSelection() {
  console.log('--- Test 1: Provider selection via env variable ---');
  process.env.LLM_PROVIDER = 'mock';
  const mockProvider = getLLMProvider();
  console.log(`LLM_PROVIDER=mock -> Selected: ${mockProvider.name}`);
  if (!(mockProvider instanceof MockLLMProvider)) {
    throw new Error('Expected MockLLMProvider when LLM_PROVIDER=mock');
  }

  process.env.LLM_PROVIDER = 'real';
  const realProvider = getLLMProvider();
  console.log(`LLM_PROVIDER=real -> Selected: ${realProvider.name}`);
  if (!(realProvider instanceof RealLLMProvider)) {
    throw new Error('Expected RealLLMProvider when LLM_PROVIDER=real');
  }

  // Restore to mock for safe testing
  process.env.LLM_PROVIDER = 'mock';
  console.log('✓ Provider adapter selection verified.\n');
}

async function testMockStreamChunks() {
  console.log('--- Test 2: SSE stream chunk cadence & delivery ---');
  const provider = new MockLLMProvider();
  const startTime = Date.now();
  const response = await provider.streamChat('build me a todo app');

  if (response.status !== 200) {
    throw new Error(`Expected HTTP 200, got ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/event-stream')) {
    throw new Error(`Expected text/event-stream content-type, got ${contentType}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let chunksReceived = 0;
  let totalBytes = 0;
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunksReceived++;
    totalBytes += value.length;
    fullText += decoder.decode(value, { stream: true });
  }

  const durationMs = Date.now() - startTime;
  console.log(`Received ${chunksReceived} chunks (${totalBytes} bytes) in ${durationMs}ms`);
  console.log(`Average chunk size: ${(totalBytes / chunksReceived).toFixed(1)} bytes`);

  if (chunksReceived < 5) {
    throw new Error(`Expected at least 5 stream chunks for realistic streaming, got ${chunksReceived}`);
  }
  if (!fullText.includes('<sandbox_action type="file" path="package.json">')) {
    throw new Error('Expected stream to contain package.json sandbox_action');
  }
  if (!fullText.includes('</sandbox_action>')) {
    throw new Error('Expected stream to contain closing sandbox_action tag');
  }

  console.log('✓ Stream successfully emitted SSE chunks with complete files.\n');
}

async function main() {
  try {
    await testProviderSelection();
    await testMockStreamChunks();
    console.log('✅ T04 Acceptance Test PASSED: Mock LLM streams SSE chunks and provider adapter switches via env.');
    process.exit(0);
  } catch (err) {
    console.error('❌ T04 Acceptance Test FAILED:', err);
    process.exit(1);
  }
}

main();
