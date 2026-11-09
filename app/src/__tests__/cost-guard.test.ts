import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as chatHandler } from '../app/api/chat/route';
import {
  resetCostGuardForTesting,
  recordSpendUSD,
  setBudgetKillSwitch,
  DEFAULT_CONFIG,
} from '../lib/cost-guard';
import { RealLLMProvider } from '../lib/llm-provider';

test('Cost Guard: per-IP rate limit triggers 429 after threshold', async () => {
  resetCostGuardForTesting();
  const testIp = '192.168.1.100';

  // Issue requests up to rateLimitPerWindow (30)
  for (let i = 0; i < DEFAULT_CONFIG.rateLimitPerWindow; i++) {
    const req = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': testIp,
      },
      body: JSON.stringify({ message: 'test small message' }),
    });
    const res = await chatHandler(req);
    assert.equal(res.status, 200, `Request ${i + 1} should succeed`);
  }

  // 31st request from same IP must be rate limited with 429
  const rateLimitedReq = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': testIp,
    },
    body: JSON.stringify({ message: 'test over limit' }),
  });
  const res = await chatHandler(rateLimitedReq);
  assert.equal(res.status, 429, 'Rate limited request must return 429');
  const data = await res.json();
  assert.equal(data.code, 'RATE_LIMIT_EXCEEDED');
  assert.ok(res.headers.get('retry-after'));
});

test('Cost Guard: max input size cap triggers 429', async () => {
  resetCostGuardForTesting();
  const oversizedMessage = 'a'.repeat(DEFAULT_CONFIG.maxInputChars + 100);

  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.101',
    },
    body: JSON.stringify({ message: oversizedMessage }),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 429, 'Oversized input must return 429');
  const data = await res.json();
  assert.equal(data.code, 'INPUT_TOO_LARGE');
  assert.ok(data.error.includes('exceeds maximum allowed limit'));
});

test('Cost Guard: requested max_tokens exceeding cap triggers 429', async () => {
  resetCostGuardForTesting();
  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.102',
    },
    body: JSON.stringify({
      message: 'test message',
      max_tokens: DEFAULT_CONFIG.maxTokensCap + 5000,
    }),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 429, 'Excessive max_tokens must return 429');
  const data = await res.json();
  assert.equal(data.code, 'MAX_TOKENS_EXCEEDED');
});

test('Cost Guard: global daily budget exhausted triggers 503 and blocks real provider', async () => {
  resetCostGuardForTesting();

  // Spend $0.51 to exceed $0.50 cap
  recordSpendUSD(0.51);

  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.103',
    },
    body: JSON.stringify({ message: 'build a todo app' }),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 503, 'Budget exhausted must return 503');
  const data = await res.json();
  assert.equal(data.code, 'BUDGET_EXHAUSTED');

  // Verify RealLLMProvider directly rejects and aborts
  const realProvider = new RealLLMProvider('test-key-fake', 'test-key-fake');
  await assert.rejects(
    async () => {
      await realProvider.streamChat('test message');
    },
    (err: Error) => {
      return err.message.includes('Daily API budget limit ($0.50 USD) exhausted');
    },
    'Real provider must directly throw and abort when budget is exhausted'
  );
});

test('Cost Guard: manual kill switch triggers 503 Service Unavailable', async () => {
  resetCostGuardForTesting();
  setBudgetKillSwitch(true);

  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '192.168.1.104',
    },
    body: JSON.stringify({ message: 'build a todo app' }),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 503, 'Manual kill switch must return 503');
  const data = await res.json();
  assert.equal(data.code, 'BUDGET_EXHAUSTED');
});

test('Cost Guard: invite-code gate blocks unauthorized requests when enabled', async () => {
  resetCostGuardForTesting();
  DEFAULT_CONFIG.inviteCodeRequired = true;

  try {
    // With real provider simulated
    const origEnv = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'real';
    process.env.DEEPSEEK_API_KEY = 'mock_key_for_gate_test';

    const reqWithoutCode = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.105',
      },
      body: JSON.stringify({ message: 'hello world' }),
    });

    const res = await chatHandler(reqWithoutCode);
    assert.equal(res.status, 403, 'Missing invite code must return 403 Forbidden');
    const data = await res.json();
    assert.equal(data.code, 'INVITE_CODE_REQUIRED');

    // Clean up
    process.env.LLM_PROVIDER = origEnv;
    delete process.env.DEEPSEEK_API_KEY;
  } finally {
    DEFAULT_CONFIG.inviteCodeRequired = false;
  }
});
