import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as chatHandler } from '../app/api/chat/route';
import { POST as sandboxHandler } from '../app/api/sandbox/route';

test('API Chat Handler: empty or whitespace message returns 400 Bad Request', async () => {
  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, 'Valid prompt message is required');
});

test('API Chat Handler: "build me a todo app" returns SSE stream with files and actions', async () => {
  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'build me a todo app' }),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');

  // Read response stream
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullStream = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullStream += decoder.decode(value, { stream: true });
  }

  assert.ok(fullStream.includes('<sandbox_action type="file" path="package.json">'));
  assert.ok(fullStream.includes('<sandbox_action type="file" path="styles.css">'));
  assert.ok(fullStream.includes('<sandbox_action type="file" path="app.js">'));
  assert.ok(fullStream.includes('<sandbox_action type="file" path="index.html">'));
  assert.ok(fullStream.includes('</sandbox_action>'));
});

test('API Chat Handler: "寫一個香港的士分賬計算器" triggers HK Taxi Splitter template', async () => {
  const req = new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '寫一個香港的士分賬計算器' }),
  });

  const res = await chatHandler(req);
  assert.equal(res.status, 200);

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let fullStream = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    fullStream += decoder.decode(value, { stream: true });
  }

  assert.ok(fullStream.includes('香港市區紅的收費分賬計算器'));
  assert.ok(fullStream.includes('起步價首2公里: HK$ 29.0'));
});

test('API Sandbox Handler: executes benign commands with gVisor isolation tag', async () => {
  const req = new NextRequest('http://localhost:3000/api/sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'npm install' }),
  });

  const res = await sandboxHandler(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.exitCode, 0);
  assert.ok(data.stdout.includes('gVisor sandbox'));
  assert.ok(data.isolation.includes('gVisor'));
  assert.equal(data.region, 'Hong Kong (ap-east-1)');
});

test('API Sandbox Handler: blocks dangerous destructive syscalls with 403 Forbidden', async () => {
  const req = new NextRequest('http://localhost:3000/api/sandbox', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command: 'rm -rf /' }),
  });

  const res = await sandboxHandler(req);
  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.exitCode, 1);
  assert.ok(data.stderr.includes('Security Policy Violation'));
});
