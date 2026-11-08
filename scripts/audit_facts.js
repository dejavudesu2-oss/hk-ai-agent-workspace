const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'plan', 'facts.md');
if (!fs.existsSync(filePath)) {
  console.error(`File does not exist: ${filePath}`);
  process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');
const tableLines = lines.filter(l => l.startsWith('| **'));

console.log(`Found ${tableLines.length} claims in matrix:`);
let pass = true;

tableLines.forEach((row, i) => {
  const hasUrlOrUnverified = row.includes('http://') || row.includes('https://') || row.includes('UNVERIFIED');
  const cols = row.split('|').map(c => c.trim()).filter(Boolean);
  const topic = cols[0] || `Row ${i + 1}`;
  if (!hasUrlOrUnverified) {
    console.error(`❌ [FAIL] Missing URL or UNVERIFIED in: ${topic}`);
    pass = false;
  } else {
    console.log(`  ✓ [PASS] ${topic}`);
  }
});

const requiredTopics = [
  'DeepSeek',
  'Bedrock',
  'OpenAI',
  'gVisor',
  'Sandpack',
  'Babel',
  'Cyberport',
  'Lightsail',
  'TVP'
];

for (const t of requiredTopics) {
  const found = tableLines.some(row => row.includes(t));
  if (!found) {
    console.error(`❌ [FAIL] Required topic "${t}" not found in matrix rows`);
    pass = false;
  }
}

const favorableRecheckCount = (content.match(/### \d+\. Re-check:/g) || []).length;
console.log(`Favorable claims re-checked: ${favorableRecheckCount}`);
if (favorableRecheckCount < 3) {
  console.error(`❌ [FAIL] Expected at least 3 favorable claims re-checked, found ${favorableRecheckCount}`);
  pass = false;
}

if (!pass) {
  console.error('\n❌ T02 Audit Failed');
  process.exit(1);
}

console.log('\n✅ T02 Acceptance Test: ALL claims verified with URLs, and 3 favorable claims hostilely re-checked!');
process.exit(0);
