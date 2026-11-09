/**
 * scripts/secrets_scan.js
 * Pre-push security & credential audit script (T25)
 * Acceptance Test: node scripts/secrets_scan.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('================================================================');
console.log('            SECURITY & SECRETS AUDIT SCAN (T25)                 ');
console.log('================================================================\n');

let pass = true;

// 1. Verify .gitignore ignores .env files
console.log('Step 1: Checking .gitignore configuration...');
const rootDir = path.join(__dirname, '..');
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
    console.log('  ✓ .gitignore properly specifies .env patterns.');
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

// 3. Scan workspace for secret patterns
console.log('\nStep 3: Scanning tracked files for secret / API key signatures...');

const SECRET_PATTERNS = [
  { name: 'DeepSeek / Generic API Key', regex: /sk-[a-zA-Z0-9]{32,}/g },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'Stripe Restricted Key', regex: /rk_live_[0-9a-zA-Z]{24,}/g },
  { name: 'AWS Access Key ID', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  { name: 'GitHub Personal Token', regex: /gh[pous]_[0-9a-zA-Z]{36}/g },
];

// Get list of all git-tracked files
let filesToScan = [];
try {
  const output = execSync('git ls-files', { cwd: rootDir, encoding: 'utf-8' });
  filesToScan = output.split('\n').map((f) => f.trim()).filter(Boolean);
} catch (e) {
  console.error('❌ Failed to obtain git file list:', e.message);
  filesToScan = [];
  pass = false;
}

let leakedCount = 0;

for (const relPath of filesToScan) {
  // Skip binary files or lock files
  if (relPath.endsWith('.lock') || relPath.endsWith('.png') || relPath.endsWith('.ico') || relPath.endsWith('.jpg')) {
    continue;
  }

  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) continue;

  const content = fs.readFileSync(fullPath, 'utf-8');

  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      // Filter out false positives from documentation or variable names
      const validLeaks = matches.filter((m) => {
        return (
          m !== 'sk-placeholder' &&
          m !== 'sk-dummy-key' &&
          !m.includes('xxxxxxxx') &&
          !m.includes('EXAMPLE')
        );
      });

      if (validLeaks.length > 0) {
        console.error(`❌ Potential ${pattern.name} found in: ${relPath}`);
        validLeaks.forEach((leak) => {
          console.error(`     Exposed string: ${leak.slice(0, 8)}...${leak.slice(-4)}`);
        });
        leakedCount += validLeaks.length;
        pass = false;
      }
    }
  }
}

if (leakedCount === 0) {
  console.log(`  ✓ Scanned ${filesToScan.length} tracked files. Zero hardcoded secrets detected!`);
}

console.log('\n----------------------------------------------------------------');
if (pass) {
  console.log('✅ SECRETS AUDIT PASSED: Repository is clean and safe to push.');
  console.log('================================================================');
  process.exit(0);
} else {
  console.error('❌ SECRETS AUDIT FAILED: Security issues must be resolved before push.');
  console.log('================================================================');
  process.exit(1);
}
