/**
 * scripts/verify-fixtures.js
 * Verifies that all fixtures in /app/fixtures/real have authentic provenance.
 * Every fixture in /app/fixtures/real MUST have a valid sidecar JSON containing:
 * - provider (non-empty string, not 'mock' or 'simulator')
 * - model (non-empty string)
 * - request id (requestId or request_id)
 * - timestamp (valid ISO date or timestamp)
 * - usage (object with numeric prompt_tokens and completion_tokens)
 *
 * Refuses to treat any fixture as real otherwise and exits non-zero.
 */

const fs = require('fs');
const path = require('path');

const REAL_DIR = path.resolve(__dirname, '../app/fixtures/real');
const MOCK_DIR = path.resolve(__dirname, '../app/fixtures/mock');

function verifyFixtures() {
  console.log('=== Fixture Provenance Verifier ===');
  console.log('Checking directory:', REAL_DIR);

  if (!fs.existsSync(REAL_DIR)) {
    console.log('Real fixtures directory does not exist.');
    process.exit(0);
  }

  const files = fs.readdirSync(REAL_DIR);
  if (files.length === 0) {
    console.log('Real fixtures directory is empty (no real API calls recorded). 0 fixtures to verify.');
    process.exit(0);
  }

  let failures = [];
  let verifiedCount = 0;

  // Group files by base name (e.g. 01-todo-app)
  const rawFiles = files.filter(f => f.endsWith('.raw.txt') || (!f.endsWith('.json') && !f.endsWith('.meta.json')));

  if (rawFiles.length === 0) {
    // Check if there are loose json files without sidecar definition
    for (const file of files) {
      failures.push(`Unpaired or unrecognized file in real fixtures: ${file}`);
    }
  }

  for (const rawFile of rawFiles) {
    const baseName = rawFile.replace(/\.raw\.txt$/, '');
    const sidecarNameMeta = `${baseName}.meta.json`;
    const sidecarNameSidecar = `${baseName}.sidecar.json`;
    
    let sidecarFile = null;
    if (files.includes(sidecarNameMeta)) {
      sidecarFile = sidecarNameMeta;
    } else if (files.includes(sidecarNameSidecar)) {
      sidecarFile = sidecarNameSidecar;
    }

    if (!sidecarFile) {
      failures.push(`Missing required sidecar JSON for fixture: ${rawFile}`);
      continue;
    }

    const sidecarPath = path.join(REAL_DIR, sidecarFile);
    let sidecar;
    try {
      sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    } catch (err) {
      failures.push(`Malformed sidecar JSON in ${sidecarFile}: ${err.message}`);
      continue;
    }

    // Required sidecar properties: provider, model, request id, timestamp, usage
    const provider = sidecar.provider;
    const model = sidecar.model;
    const requestId = sidecar.requestId || sidecar.request_id || sidecar['request id'];
    const timestamp = sidecar.timestamp;
    const usage = sidecar.usage;

    if (!provider || typeof provider !== 'string' || provider.toLowerCase().includes('mock') || provider.toLowerCase().includes('simulator')) {
      failures.push(`Invalid or mock provider in ${sidecarFile}: ${provider || 'MISSING'}`);
    }

    if (!model || typeof model !== 'string') {
      failures.push(`Missing model in ${sidecarFile}`);
    }

    if (!requestId || typeof requestId !== 'string') {
      failures.push(`Missing valid request id in ${sidecarFile}`);
    }

    if (!timestamp || isNaN(new Date(timestamp).getTime())) {
      failures.push(`Missing or invalid timestamp in ${sidecarFile}: ${timestamp}`);
    }

    if (!usage || typeof usage !== 'object' || typeof usage.prompt_tokens !== 'number' || typeof usage.completion_tokens !== 'number') {
      failures.push(`Missing or invalid usage (prompt_tokens & completion_tokens) in ${sidecarFile}`);
    }

    if (sidecar.note && (sidecar.note.toLowerCase().includes('mock') || sidecar.note.toLowerCase().includes('simulat') || sidecar.note.toLowerCase().includes('representative'))) {
      failures.push(`Fixture ${sidecarFile} is explicitly labeled as mock/synthetic in note`);
    }

    if (failures.length === 0) {
      verifiedCount++;
    }
  }

  if (failures.length > 0) {
    console.error('❌ Fixture verification FAILED. Found invalid or mock fixtures in /app/fixtures/real/:');
    for (const f of failures) {
      console.error('   - ' + f);
    }
    process.exit(1);
  }

  console.log(`✅ All ${verifiedCount} real fixtures passed provenance audit.`);
  process.exit(0);
}

verifyFixtures();
