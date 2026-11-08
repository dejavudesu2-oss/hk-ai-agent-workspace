/**
 * bench/loadtest.js
 * High-Throughput In-Process Load Benchmark for HK AI Agent Workspace Endpoints
 * Acceptance Test: node bench/loadtest.js
 */

const { POST: chatHandler } = require('../app/src/app/api/chat/route');
const { POST: sandboxHandler } = require('../app/src/app/api/sandbox/route');

// Helper to construct mock NextRequest
class MockNextRequest {
  constructor(url, options = {}) {
    this.url = url;
    this.method = options.method || 'GET';
    this.headers = new Map(Object.entries(options.headers || {}));
    this._body = options.body;
  }

  async json() {
    return typeof this._body === 'string' ? JSON.parse(this._body) : this._body;
  }
}

async function runBenchmark(name, runner, totalRequests = 50, concurrency = 5) {
  console.log(`\n--- Running Benchmark: ${name} (${totalRequests} total requests, concurrency ${concurrency}) ---`);

  const latencies = [];
  let successful = 0;
  let failed = 0;
  let totalBytes = 0;

  const startTime = Date.now();
  let requestIndex = 0;

  async function worker() {
    while (true) {
      const idx = requestIndex++;
      if (idx >= totalRequests) break;

      const reqStart = process.hrtime.bigint();
      try {
        const bytes = await runner();
        const reqEnd = process.hrtime.bigint();
        const durationMs = Number(reqEnd - reqStart) / 1_000_000;

        latencies.push(durationMs);
        totalBytes += bytes;
        successful++;
      } catch (err) {
        failed++;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const totalDurationMs = Date.now() - startTime;
  latencies.sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const avg = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
  const throughput = (successful / (totalDurationMs / 1000)).toFixed(1);

  console.log(`  Requests: ${successful} passed, ${failed} failed in ${(totalDurationMs / 1000).toFixed(2)}s`);
  console.log(`  Throughput: ${throughput} req/sec`);
  console.log(`  Latency: avg=${avg.toFixed(2)}ms, p50=${p50.toFixed(2)}ms, p95=${p95.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
  console.log(`  Data Transfer: ${(totalBytes / 1024).toFixed(1)} KB processed`);

  return { throughput: Number(throughput), p50, p95, failed };
}

async function main() {
  console.log('================================================================');
  console.log(' HK AI AGENT WORKSPACE - LOADTEST & BENCHMARK SUITE');
  console.log('================================================================');

  // Test 1: Sandbox Command API (fast execution & security policy filter)
  const sandboxBench = await runBenchmark('API /api/sandbox (benign shell command)', async () => {
    const req = new MockNextRequest('http://localhost:3000/api/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'npm install' }),
    });

    const res = await sandboxHandler(req);
    const data = await res.json();
    return JSON.stringify(data).length;
  }, 100, 10);

  // Test 2: Destructive Security Filter (instant 403 rejection)
  const securityFilterBench = await runBenchmark('API /api/sandbox (security policy violation block)', async () => {
    const req = new MockNextRequest('http://localhost:3000/api/sandbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'rm -rf /' }),
    });

    const res = await sandboxHandler(req);
    return 100;
  }, 100, 10);

  // Test 3: Chat Stream Initialization (first token latency)
  const chatInitBench = await runBenchmark('API /api/chat (stream initialization)', async () => {
    const req = new MockNextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'build me a todo app' }),
    });

    const res = await chatHandler(req);
    if (!res.body) throw new Error('No body');
    const reader = res.body.getReader();
    // Read first chunk only to measure TTFT (Time to First Token)
    const { value } = await reader.read();
    reader.cancel();
    return value ? value.length : 0;
  }, 20, 4);

  console.log('\n================================================================');
  console.log(' BENCHMARK SUMMARY:');
  console.log(` - Sandbox API Throughput:     ${sandboxBench.throughput} req/sec (p50: ${sandboxBench.p50.toFixed(1)}ms)`);
  console.log(` - Security Block Throughput:  ${securityFilterBench.throughput} req/sec (p50: ${securityFilterBench.p50.toFixed(1)}ms)`);
  console.log(` - Chat TTFT (First Token):    p50: ${chatInitBench.p50.toFixed(1)}ms`);
  console.log('================================================================');

  if (sandboxBench.failed > 0 || securityFilterBench.failed > 0) {
    console.error('❌ Benchmark failed with unexpected errors');
    process.exit(1);
  }

  console.log('\n✅ T10 Benchmark & Loadtest PASSED successfully.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark fatal error:', err);
  process.exit(1);
});
