const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const setupPath = path.resolve(__dirname, '../infra/setup.sh');
if (!fs.existsSync(setupPath)) {
  console.error(`setup.sh not found at ${setupPath}`);
  process.exit(1);
}

const content = fs.readFileSync(setupPath, 'utf-8');

console.log('--- Static Audit of infra/setup.sh ---');

// 1. Check strict mode
if (!content.includes('set -euo pipefail')) {
  console.error('❌ Missing "set -euo pipefail" for strict error handling');
  process.exit(1);
}
console.log('✓ Strict error handling (set -euo pipefail) present');

// 2. Check gVisor platform
if (content.includes('--platform=ptrace')) {
  console.error('❌ Deprecated --platform=ptrace found; should be --platform=systrap');
  process.exit(1);
}
if (!content.includes('--platform=systrap')) {
  console.error('❌ Missing modern --platform=systrap');
  process.exit(1);
}
console.log('✓ Modern gVisor non-KVM platform (--platform=systrap) configured');

// 3. Check Caddy flush_interval for SSE streaming
if (!content.includes('flush_interval -1')) {
  console.error('❌ Missing "flush_interval -1" in Caddyfile for unbuffered SSE streaming');
  process.exit(1);
}
console.log('✓ Caddy reverse proxy configured with flush_interval -1 for real-time SSE streaming');

// 4. Run bash -n syntax check if Git Bash is present
try {
  const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (fs.existsSync(gitBashPath)) {
    execSync(`"${gitBashPath}" -n "${setupPath}"`);
    console.log('✓ Git Bash syntax check (-n) exited 0 with no syntax errors');
  } else {
    console.log('ℹ Git Bash not located; bash syntax check skipped');
  }
} catch (e) {
  console.error('❌ Bash syntax check failed:', e.message);
  process.exit(1);
}

console.log('\nNote: shellcheck binary is not installed in this Windows host; marked [UNTESTED for shellcheck]');
console.log('✅ infra/setup.sh static and syntax audit PASSED.');
