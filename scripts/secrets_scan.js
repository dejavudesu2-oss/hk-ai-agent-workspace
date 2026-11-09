/**
 * scripts/secrets_scan.js
 * Pre-push security & credential audit script (T25 & T31)
 * Audits:
 * 1. .gitignore explicitly contains .env
 * 2. .env is not tracked by git
 * 3. Scans all workspace files & /app/fixtures (real and mock)
 * 4. Scans the entire git history (git log -p) for secrets / Authorization headers
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
const rootDir = path.join(__dirname, '..');

// 1. Verify .gitignore ignores .env files
console.log('Step 1: Checking .gitignore configuration...');
const gitignorePath = path.join(rootDir, '.gitignore');

if (!fs.existsSync(gitignorePath)) {
  console.error('❌ .gitignore file not found in repository root!');
  pass = false;
} else {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  const ignoresEnv = gitignoreContent.split('\n').some((line) => {
    const t = line.trim();
    return t === '.env' || t === '*.env' || t === '.env*.local' || t === '.env*';
  });

  if (ignoresEnv) {
    console.log('  ✓ .gitignore explicitly specifies .env patterns.');
  } else {
    console.error('❌ .gitignore does NOT explicitly ignore .env!');
    pass = false;
  }
}

// 2. Verify git does not track .env
console.log('\nStep 2: Checking git tracking status for sensitive files...');
try {
  const trackedFiles = execSync('git ls-files .env app/.env', { cwd: rootDir, encoding: 'utf-8' }).trim();
  if (trackedFiles) {
    console.error(`❌ Sensitive .env file is currently tracked by git: ${trackedFiles}`);
    pass = false;
  } else {
    console.log('  ✓ No .env files are tracked by git.');
  }
} catch (e) {
  console.error('❌ Failed to run git ls-files:', e.message);
  pass = false;
}

// 3. Scan workspace tracked files AND app/fixtures
console.log('\nStep 3: Scanning tracked files and /app/fixtures for secrets & Authorization headers...');

const SECRET_PATTERNS = [
  { name: 'DeepSeek / Generic API Key', regex: /sk-[a-zA-Z0-9]{32,}/g },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Stripe Restricted Key', regex: /rk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'GitHub Personal Token', regex: /gh[pous]_[0-9a-zA-Z]{36}/g },
  { name: 'Authorization Bearer Header', regex: /Authorization:\s*Bearer\s+[a-zA-Z0-9_\-\.]{20,}/gi },
];

function isFalsePositive(m) {
  return (
    m === 'sk-placeholder' ||
    m === 'sk-dummy-key' ||
    m.includes('xxxxxxxx') ||
    m.includes('EXAMPLE') ||
    m.includes('your_') ||
    m.includes('Bearer ${') ||
    m.includes('Bearer $') ||
    m.includes('process.env')
  );
}

// Get list of all git-tracked files plus all fixture files
let filesToScan = new Set();
try {
  const output = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
  output.split('\n').map((f) => f.trim()).filter(Boolean).forEach((f) => filesToScan.add(f));
} catch (e) {
  console.error('❌ Failed to obtain git file list:', e.message);
  pass = false;
}

// Ensure all fixtures (real and mock) are explicitly scanned even if untracked
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

let leakedCount = 0;

for (const relPath of filesToScan) {
  if (relPath.endsWith('.lock') || relPath.endsWith('.png') || relPath.endsWith('.ico') || relPath.endsWith('.jpg')) {
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
          console.error(`     Exposed string: ${leak.slice(0, 12)}...${leak.slice(-4)}`);
        });
        leakedCount += validLeaks.length;
        pass = false;
      }
    }
  }
}

if (leakedCount === 0) {
  console.log(`  ✓ Scanned ${filesToScan.size} files (including all /app/fixtures). Zero leaks detected!`);
}

// 4. Scan the ENTIRE git commit history
console.log('\nStep 4: Scanning entire git commit history (git log -p) for leaked secrets...');
try {
  const gitLogDiff = execSync('git log -p', { cwd: rootDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
  let historyLeaks = 0;

  for (const pattern of SECRET_PATTERNS) {
    const matches = gitLogDiff.match(pattern.regex);
    if (matches) {
      const validLeaks = matches.filter((m) => !isFalsePositive(m));
      if (validLeaks.length > 0) {
        console.error(`❌ Potential ${pattern.name} found in git commit history!`);
        validLeaks.forEach((leak) => {
          console.error(`     History snippet: ${leak.slice(0, 12)}...${leak.slice(-4)}`);
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
