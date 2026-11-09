/**
 * scripts/secrets_scan.js
 * Deep Security, Secrets & Negative-Control Audit Script (T25, T31 & T34)
 * Audits:
 * 1. Git root verification (confirm project folder is the git root)
 * 2. .gitignore explicitly contains .env, node_modules, .next
 * 3. Verify .env, node_modules, and .next are NOT tracked by git
 * 4. Scans all workspace files (tracked + untracked) & /app/fixtures (real & mock) for:
 *    - sk- API keys (32+ hex/alphanumeric)
 *    - Authorization: Bearer headers
 *    - .env contents / secrets
 * 5. Scans the ENTIRE git history (git log -p) for secrets / credentials
 * 6. Scans loop/LOG.md and /app/fixtures for personal paths (e.g. Windows username)
 *
 * Acceptance Test: node scripts/secrets_scan.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('       DEEP SECURITY & SECRETS AUDIT SCAN (History & Fixtures)   ');
console.log('================================================================\n');

let pass = true;
const rootDir = path.resolve(__dirname, '..');

// Step 1: Confirm Git Root is the project folder
console.log('Step 1: Confirming git repository root...');
try {
  const gitRootRaw = execSync('git rev-parse --show-toplevel', { cwd: rootDir, encoding: 'utf-8' }).trim();
  const normalizedGitRoot = path.resolve(gitRootRaw);
  if (normalizedGitRoot.toLowerCase() === rootDir.toLowerCase()) {
    console.log(`  ✓ Git root confirmed: ${normalizedGitRoot}`);
  } else {
    console.error(`❌ Git root mismatch: expected ${rootDir}, got ${normalizedGitRoot}`);
    pass = false;
  }
} catch (e) {
  console.error('❌ Failed to verify git root:', e.message);
  pass = false;
}

// Step 2: Verify .gitignore configuration & untracked status
console.log('\nStep 2: Checking .gitignore and untracked status for sensitive/build folders...');
const gitignorePath = path.join(rootDir, '.gitignore');
const requiredIgnores = ['.env', 'node_modules', '.next'];

if (!fs.existsSync(gitignorePath)) {
  console.error('❌ .gitignore file not found in repository root!');
  pass = false;
} else {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  for (const item of requiredIgnores) {
    const isIgnored = gitignoreContent.split('\n').some((line) => {
      const t = line.trim();
      return t === item || t === `/${item}` || t === `${item}/` || t === `*${item}*`;
    });
    if (isIgnored) {
      console.log(`  ✓ .gitignore specifies: ${item}`);
    } else {
      console.error(`❌ .gitignore missing: ${item}`);
      pass = false;
    }
  }
}

// Confirm .env, node_modules, and .next are UNTRACKED
const sensitivePaths = ['.env', 'app/.env', 'node_modules', '.next', 'app/node_modules', 'app/.next'];
try {
  const trackedOutput = execSync(`git ls-files ${sensitivePaths.join(' ')}`, { cwd: rootDir, encoding: 'utf-8' }).trim();
  if (trackedOutput) {
    console.error(`❌ Sensitive files are tracked by git:\n${trackedOutput}`);
    pass = false;
  } else {
    console.log('  ✓ Confirmed .env, node_modules, and .next are completely UNTRACKED.');
  }
} catch (e) {
  console.error('❌ Failed to check git tracked status:', e.message);
  pass = false;
}

// Step 3: Scan workspace files (tracked + untracked non-ignored) and app/fixtures
console.log('\nStep 3: Scanning workspace files and /app/fixtures for secrets & Authorization headers...');

const SECRET_PATTERNS = [
  { name: 'DeepSeek / Generic API Key (sk-...)', regex: /sk-[a-fA-F0-9]{32,}|sk-[a-zA-Z0-9]{32,}/g },
  { name: 'Authorization Bearer Header', regex: /Authorization:\s*Bearer\s+[^\r\n"'\s]{10,}/gi },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Stripe Restricted Key', regex: /rk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'GitHub Personal Token', regex: /gh[pous]_[0-9a-zA-Z]{36}/g },
  { name: '.env DeepSeek Key Assignment', regex: /DEEPSEEK_API_KEY\s*=\s*sk-[^\r\n\s]+/gi },
];

function isFalsePositive(m) {
  return (
    m === 'sk-placeholder' ||
    m === 'sk-dummy-key' ||
    m.includes('xxxxxxxx') ||
    m.includes('EXAMPLE') ||
    m.includes('your_') ||
    m.includes('<your') ||
    m.includes('sk-your-') ||
    m.includes('sk-...') ||
    m.includes('Bearer ${') ||
    m.includes('Bearer $') ||
    m.includes('process.env')
  );
}

// Collect files to scan: tracked + untracked + fixtures
let filesToScan = new Set();
try {
  // Tracked files
  const tracked = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
  tracked.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => filesToScan.add(f));

  // Untracked files (excluding ignored)
  const untracked = execSync('git ls-files --others --exclude-standard', { cwd: rootDir, encoding: 'utf-8' });
  untracked.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => filesToScan.add(f));
} catch (e) {
  console.error('❌ Failed to obtain git file list:', e.message);
  pass = false;
}

// Walk fixtures directory recursively
function addDirFiles(dirRel) {
  const absDir = path.join(rootDir, dirRel);
  if (!fs.existsSync(absDir)) return;
  const items = fs.readdirSync(absDir);
  for (const item of items) {
    const full = path.join(absDir, item);
    const rel = path.relative(rootDir, full);
    if (fs.statSync(full).isDirectory()) {
      addDirFiles(rel);
    } else {
      filesToScan.add(rel);
    }
  }
}
addDirFiles('app/fixtures');

// Also explicitly scan any temp files in root
try {
  const rootItems = fs.readdirSync(rootDir);
  for (const item of rootItems) {
    if (item.startsWith('temp') || item.endsWith('.tmp')) {
      filesToScan.add(item);
    }
  }
} catch (_) {}

let leakedCount = 0;

for (const relPath of filesToScan) {
  if (
    relPath.endsWith('.lock') ||
    relPath.endsWith('.png') ||
    relPath.endsWith('.ico') ||
    relPath.endsWith('.jpg') ||
    relPath.includes('node_modules') ||
    relPath.includes('.next')
  ) {
    continue;
  }

  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      const validLeaks = matches.filter((m) => !isFalsePositive(m));
      if (validLeaks.length > 0) {
        console.error(`❌ Potential ${pattern.name} found in: ${relPath}`);
        validLeaks.forEach((leak) => {
          console.error(`     Exposed string: ${leak.slice(0, 16)}...${leak.slice(-4)}`);
        });
        leakedCount += validLeaks.length;
        pass = false;
      }
    }
  }
}

if (leakedCount === 0) {
  console.log(`  ✓ Scanned ${filesToScan.size} files (including untracked files & /app/fixtures). Zero leaks detected!`);
}

// Step 4: Scan the ENTIRE git commit history
console.log('\nStep 4: Scanning entire git commit history (git log -p) for leaked secrets & Authorization headers...');
try {
  const gitLogDiff = execSync('git log -p', { cwd: rootDir, encoding: 'utf-8', maxBuffer: 15 * 1024 * 1024 });
  let historyLeaks = 0;

  for (const pattern of SECRET_PATTERNS) {
    const matches = gitLogDiff.match(pattern.regex);
    if (matches) {
      const validLeaks = matches.filter((m) => !isFalsePositive(m));
      if (validLeaks.length > 0) {
        console.error(`❌ Potential ${pattern.name} found in git commit history!`);
        validLeaks.forEach((leak) => {
          console.error(`     History snippet: ${leak.slice(0, 16)}...${leak.slice(-4)}`);
        });
        historyLeaks += validLeaks.length;
        pass = false;
      }
    }
  }

  if (historyLeaks === 0) {
    console.log('  ✓ Entire git commit history scanned. Zero committed credentials or bearer tokens detected!');
  }
} catch (e) {
  console.error('❌ Failed to scan git history:', e.message);
  pass = false;
}

// Step 5: Check loop/LOG.md and /app/fixtures for personal paths (Windows username)
console.log('\nStep 5: Checking loop/LOG.md and /app/fixtures for personal paths (Windows username)...');
const currentUsername = process.env.USERNAME || 'rain2';
let personalPathLeaks = 0;

const pathsToCheck = ['loop/LOG.md'];
function collectFixturePaths(dirRel) {
  const absDir = path.join(rootDir, dirRel);
  if (!fs.existsSync(absDir)) return;
  const items = fs.readdirSync(absDir);
  for (const item of items) {
    const full = path.join(absDir, item);
    const rel = path.relative(rootDir, full);
    if (fs.statSync(full).isDirectory()) {
      collectFixturePaths(rel);
    } else {
      pathsToCheck.push(rel);
    }
  }
}
collectFixturePaths('app/fixtures');

for (const rel of pathsToCheck) {
  const full = path.join(rootDir, rel);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, 'utf-8');
  
  // Look for C:\Users\<username> or /Users/<username>
  const userRegex = new RegExp(`(?:C:\\\\Users\\\\|/Users/)${currentUsername}`, 'gi');
  const matches = text.match(userRegex);
  if (matches) {
    console.warn(`⚠️ Personal path detected in ${rel}: ${matches.length} occurrence(s)`);
    personalPathLeaks += matches.length;
  }
}

if (personalPathLeaks === 0) {
  console.log(`  ✓ loop/LOG.md and /app/fixtures checked. Zero personal paths for user "${currentUsername}" detected.`);
} else {
  console.warn(`  ⚠️ Flagged ${personalPathLeaks} personal path occurrence(s).`);
}

console.log('\n----------------------------------------------------------------');
if (pass) {
  console.log('✅ SECRETS AUDIT PASSED: Working tree, /app/fixtures, and full git history are CLEAN.');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error('❌ SECRETS AUDIT FAILED: Security issues must be resolved before push.');
  console.log('================================================================');
  process.exit(1);
}
