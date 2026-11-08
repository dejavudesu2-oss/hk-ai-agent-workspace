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

async function testCurlStream() {
  console.log('--- Test 3: Actual curl to the endpoint streams chunks ---');
  const http = require('http');
  const { spawn } = require('child_process');
  const { POST: chatHandler } = require('../app/src/app/api/chat/route');

  const server = http.createServer(async (req, res) => {
    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const fakeReq = {
            url: 'http://localhost/api/chat',
            method: 'POST',
            headers: new Map(Object.entries(req.headers)),
            json: async () => JSON.parse(body || '{}'),
          };
          const response = await chatHandler(fakeReq);
          res.writeHead(response.status, {
            'Content-Type': response.headers.get('content-type') || 'text/event-stream',
            'Transfer-Encoding': 'chunked',
            Connection: 'keep-alive',
          });
          const reader = response.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(Buffer.from(value));
          }
          res.end();
        } catch (e) {
          res.writeHead(500);
          res.end(e.message);
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`Endpoint listening on http://127.0.0.1:${port}/api/chat`);

  const curlPromise = new Promise((resolve, reject) => {
    const curl = spawn('curl.exe', [
      '-N',
      '-s',
      '-X',
      'POST',
      `http://127.0.0.1:${port}/api/chat`,
      '-H',
      'Content-Type: application/json',
      '-d',
      JSON.stringify({ message: 'build me a todo app' }),
    ]);

    let chunks = 0;
    let totalBytes = 0;
    let output = '';

    curl.stdout.on('data', (d) => {
      chunks++;
      totalBytes += d.length;
      output += d.toString();
    });

    curl.stderr.on('data', (err) => {
      console.error('curl stderr:', err.toString());
    });

    curl.on('close', (code) => {
      server.close();
      if (code !== 0) {
        return reject(new Error(`curl exited with code ${code}`));
      }
      resolve({ chunks, totalBytes, output });
    });
  });

  const result = await curlPromise;
  console.log(`curl received ${result.chunks} streaming chunks (${result.totalBytes} bytes)`);
  if (result.chunks < 5) {
    throw new Error(`Expected curl to receive multiple stream chunks, got ${result.chunks}`);
  }
  if (!result.output.includes('香港 AI 待辦清單') || !result.output.includes('todoInput')) {
    throw new Error('curl output missing expected todo app contents');
  }
  console.log('✓ curl command successfully connected and streamed chunks from endpoint.\n');
}

async function main() {
  try {
    await testProviderSelection();
    await testMockStreamChunks();
    await testCurlStream();
    console.log('✅ T04 Acceptance Test PASSED: Mock LLM streams SSE chunks, provider adapter switches via env, and curl streams chunks.');
    process.exit(0);
  } catch (err) {
    console.error('❌ T04 Acceptance Test FAILED:', err);
    process.exit(1);
  }
}

main();
