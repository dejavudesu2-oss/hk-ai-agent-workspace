/**
 * scripts/replay_fixtures.ts
 * Replays all fixtures from /app/fixtures/real/ through StreamingActionParser.
 * Audits format compliance rate, TTFT, cost, and captures every failure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { StreamingActionParser } from '../app/src/lib/streaming-parser';

const FIXTURES_DIR = path.resolve(__dirname, '../app/fixtures/real');

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
  console.log(' T16: Real Fixture Replay & Parser Format Compliance Audit');
  console.log('================================================================\n');

  if (!fs.existsSync(FIXTURES_DIR)) {
    console.error(`Fixtures directory not found: ${FIXTURES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.raw.txt'));

  if (files.length === 0) {
    console.error('No .raw.txt fixtures found in /app/fixtures/real/');
    process.exit(1);
  }

  const results: ReplayResult[] = [];

  for (const file of files) {
    const fixtureId = file.replace('.raw.txt', '');
    const rawPath = path.join(FIXTURES_DIR, file);
    const metaPath = path.join(FIXTURES_DIR, `${fixtureId}.meta.json`);

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
      onFileEnd: (p, content) => {
        extractedFiles.push(p);
        if (!content || content.trim().length === 0) {
          failures.push(`Empty file content extracted for: ${p}`);
        }
      },
    });

    // Feed in simulated network chunks of 32 characters
    const chunkSize = 32;
    for (let i = 0; i < rawContent.length; i += chunkSize) {
      parser.feed(rawContent.substring(i, i + chunkSize));
    }
    const finalState = parser.finish();

    // Verify compliance criteria:
    // 1. Must extract at least 1 valid file
    if (extractedFiles.length === 0) {
      failures.push('Zero files extracted by parser from stream');
    }

    // 2. Check for path issues (e.g. unnormalized backslashes or leading slashes)
    for (const p of extractedFiles) {
      if (p.includes('\\')) {
        failures.push(`Unnormalized backslash in path: ${p}`);
      }
      if (p.startsWith('/') || p.startsWith('.')) {
        failures.push(`Leading slash or dot segment not stripped: ${p}`);
      }
    }

    // 3. Check if raw stream had markdown fence wrapper that polluted filenames
    for (const p of extractedFiles) {
      if (p.includes('```') || p.includes('<') || p.includes('>')) {
        failures.push(`Corrupted filename containing markup tokens: ${p}`);
      }
    }

    // 4. Check if stream had truncated file
    const unfinishedFiles = finalState.files.filter((f) => !f.isComplete);
    if (unfinishedFiles.length > 0) {
      failures.push(`Truncated unclosed file stream: ${unfinishedFiles.map((f) => f.path).join(', ')}`);
    }

    const compliant = failures.length === 0;

    results.push({
      id: fixtureId,
      name: meta.name || fixtureId,
      ttftMs: meta.ttftMs || 0,
      totalTimeMs: meta.totalTimeMs || 0,
      costUSD: meta.costUSD || 0,
      tokensTotal: meta.usage?.total_tokens || 0,
      filesExtracted: extractedFiles,
      compliant,
      failures,
    });
  }

  // Summary Table
  console.log('| Fixture ID | Name | TTFT (ms) | Duration (ms) | Tokens | Files Extracted | Compliant |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

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
    console.log(
      `| ${r.id} | ${r.name.substring(0, 24)} | ${r.ttftMs}ms | ${r.totalTimeMs}ms | ${r.tokensTotal} | ${r.filesExtracted.length} files | ${statusMark} |`
    );
  }

  const complianceRate = ((passedCount / results.length) * 100).toFixed(1);
  const avgTTFT = Math.round(totalTTFT / results.length);
  const avgDuration = Math.round(totalTime / results.length);

  console.log('\n----------------------------------------------------------------');
  console.log(`Format-Compliance Rate: ${complianceRate}% (${passedCount}/${results.length} passed)`);
  console.log(`Average Measured TTFT: ${avgTTFT} ms (Ping RTT is only ~15ms, prefill adds ${avgTTFT - 15}ms)`);
  console.log(`Average Stream Duration: ${avgDuration} ms`);
  console.log(`Total Batch Token Cost: $${totalCost.toFixed(6)} USD (HK$ ${(totalCost * 7.8).toFixed(4)})`);
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
    console.log('  None! All 10 fixtures passed format compliance.');
  }

  return { results, complianceRate, avgTTFT, avgDuration, totalCost };
}

runReplay();
