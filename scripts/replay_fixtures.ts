/**
 * scripts/replay_fixtures.ts
 * Replays fixtures from /app/fixtures/real/ (or /app/fixtures/mock/ with explicit tag)
 * through StreamingActionParser.
 * Audits format compliance rate, TTFT, cost, and captures every failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { StreamingActionParser } from '../app/src/lib/streaming-parser';

const REAL_FIXTURES_DIR = path.resolve(__dirname, '../app/fixtures/real');
const MOCK_FIXTURES_DIR = path.resolve(__dirname, '../app/fixtures/mock');

interface ReplayResult {
  id: string;
  name: string;
  ttftMs: number;
  totalTimeMs: number;
  costUSD: number;
  tokensTotal: number;
  filesExtracted: string[];
  compliant: boolean;
  failures: string[];
}

function runReplay() {
  console.log('================================================================');
  console.log(' Fixture Replay & Parser Format Compliance Audit');
  console.log('================================================================\n');

  let fixturesDir = REAL_FIXTURES_DIR;
  let isMock = false;

  const realFiles = fs.existsSync(REAL_FIXTURES_DIR)
    ? fs.readdirSync(REAL_FIXTURES_DIR).filter((f) => f.endsWith('.raw.txt'))
    : [];

  if (realFiles.length === 0) {
    fixturesDir = MOCK_FIXTURES_DIR;
    isMock = true;
    console.warn('⚠️  Notice: /app/fixtures/real/ is empty. Replaying from /app/fixtures/mock/ [MOCK]');
    console.warn('   All metrics below are [MOCK / SYNTHETIC] and not from real API calls.\n');
  } else {
    console.log(`Auditing ${realFiles.length} real fixtures from /app/fixtures/real/...\n`);
  }

  if (!fs.existsSync(fixturesDir)) {
    console.error(`Fixtures directory not found: ${fixturesDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.raw.txt'));

  if (files.length === 0) {
    console.error(`No .raw.txt fixtures found in ${fixturesDir}`);
    process.exit(1);
  }

  const results: ReplayResult[] = [];

  for (const file of files) {
    const fixtureId = file.replace('.raw.txt', '');
    const rawPath = path.join(fixturesDir, file);
    const metaPath = path.join(fixturesDir, `${fixtureId}.meta.json`);

    const rawContent = fs.readFileSync(rawPath, 'utf-8');
    let meta: any = {};
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      } catch {}
    }

    const failures: string[] = [];
    const extractedFiles: string[] = [];

    const parser = new StreamingActionParser({
      onFileStart: (p) => {
        extractedFiles.push(p);
      },
    });

    // Feed in 32-character chunks to simulate streaming delivery
    const chunkSize = 32;
    for (let i = 0; i < rawContent.length; i += chunkSize) {
      parser.feed(rawContent.substring(i, i + chunkSize));
    }
    const finalState = parser.finish();

    // Check compliance
    if (extractedFiles.length === 0) {
      failures.push('Zero files were extracted by parser');
    }

    for (const [filePath, fileObj] of (parser as any).files.entries()) {
      if (!fileObj.isComplete && !fileObj.isTruncated) {
        failures.push(`File ${filePath} was left open without completion`);
      }
      if (fileObj.content.length === 0) {
        failures.push(`File ${filePath} has empty content`);
      }
    }

    results.push({
      id: fixtureId,
      name: meta.name || fixtureId,
      ttftMs: meta.ttftMs || 0,
      totalTimeMs: meta.totalTimeMs || 0,
      costUSD: meta.costUSD || 0,
      tokensTotal: meta.usage?.total_tokens || 0,
      filesExtracted: extractedFiles,
      compliant: failures.length === 0,
      failures,
    });
  }

  // Summary Table
  console.log('| Fixture ID | Name | TTFT (ms) | Duration (ms) | Tokens | Files Extracted | Compliant | Tag |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  let passedCount = 0;
  let totalCost = 0;
  let totalTTFT = 0;
  let totalTime = 0;

  for (const r of results) {
    if (r.compliant) passedCount++;
    totalCost += r.costUSD;
    totalTTFT += r.ttftMs;
    totalTime += r.totalTimeMs;

    const statusMark = r.compliant ? '✅ PASS' : '⚠️ ISSUE';
    const tag = isMock ? '[MOCK]' : '[REAL]';
    console.log(
      `| ${r.id} | ${r.name.substring(0, 24)} | ${r.ttftMs}ms | ${r.totalTimeMs}ms | ${r.tokensTotal} | ${r.filesExtracted.length} files | ${statusMark} | ${tag} |`
    );
  }

  const complianceRate = ((passedCount / results.length) * 100).toFixed(1);
  const avgTTFT = Math.round(totalTTFT / results.length);
  const avgDuration = Math.round(totalTime / results.length);

  console.log('\n----------------------------------------------------------------');
  console.log(`Format-Compliance Rate: ${complianceRate}% (${passedCount}/${results.length} passed) [${isMock ? 'MOCK' : 'REAL'}]`);
  console.log(`Average Measured TTFT: ${avgTTFT} ms [${isMock ? 'MOCK/ESTIMATE' : 'REAL'}] (Total TTFT; prefill/RTT split dropped)`);
  console.log(`Average Stream Duration: ${avgDuration} ms`);
  console.log(`Total Batch Token Cost: $${totalCost.toFixed(6)} USD (HK$ ${(totalCost * 7.8).toFixed(4)}) [${isMock ? 'ASSUMPTION' : 'MEASURED'}]`);
  console.log('----------------------------------------------------------------\n');

  console.log('Detailed Failures & Quirks Discovered:');
  let hasFailures = false;
  for (const r of results) {
    if (r.failures.length > 0) {
      hasFailures = true;
      console.log(`\n• [${r.id}] ${r.name}:`);
      for (const f of r.failures) {
        console.log(`  - ❌ ${f}`);
      }
    }
  }

  if (!hasFailures) {
    console.log(`  None! All ${results.length} fixtures passed format compliance.`);
  }

  return { results, complianceRate, avgTTFT, avgDuration, totalCost, isMock };
}

runReplay();
