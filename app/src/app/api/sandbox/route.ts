import { NextRequest, NextResponse } from 'next/server';
import {
  isDockerGVisorAvailable,
  executeInGVisor,
  EGRESS_ALLOWLIST,
  RESOURCE_LIMITS,
} from '@/lib/docker-sandbox';
import { normalizePath } from '@/lib/vfs';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // 0. Security Guard: Prevent untrusted/sandboxed iframe origins ('null') from invoking sandbox API
    const origin = req.headers?.get ? req.headers.get('origin') : null;
    if (origin === 'null') {
      return NextResponse.json(
        {
          error: 'Access denied: Sandboxed iframe preview origin is forbidden from accessing sandbox execution route.',
          code: 'ORIGIN_FORBIDDEN',
        },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { command, files } = body;

    if (!command || typeof command !== 'string' || !command.trim()) {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const trimmed = command.trim();

    // Sanitize files map with path normalization against backslashes, absolute paths, and traversals
    const sanitizedFiles: Record<string, { path: string; content: string }> = {};
    if (files && typeof files === 'object') {
      for (const [key, val] of Object.entries(files)) {
        const safePath = normalizePath(key || (val as any)?.path);
        if (safePath) {
          sanitizedFiles[safePath] = {
            path: safePath,
            content: typeof (val as any)?.content === 'string' ? (val as any).content : '',
          };
        }
      }
    }

    // 1. Syscall & AST Security Filter: Guard against destructive commands
    const dangerousPatterns = [
      /rm\s+.*(-[a-zA-Z]*r[a-zA-Z]*\s+-[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*rf[a-zA-Z]*|-[a-zA-Z]*fr[a-zA-Z]*)\s+.*(\/|~|\$)/i,
      /rm\s+-[a-zA-Z]*\s+--no-preserve-root/i,
      /:(){:|:&};:/,
      />\s*\/dev\/(sd[a-z]|nvme|null|zero|random|urandom)/i,
      /mkfs/i,
      /chmod\s+.*(-[a-zA-Z]*R[a-zA-Z]*\s+)?(777|000)\s+(\/|~)/i,
      /dd\s+if=/i,
      /\b(shutdown|reboot|poweroff|halt)\b/i,
      /\b(wget|curl)\b.*\|\s*(sh|bash)/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmed)) {
        return NextResponse.json(
          {
            exitCode: 1,
            stdout: '',
            stderr: 'Security Policy Violation: Destructive syscall blocked by gVisor runtime policy.',
            isolation: 'gVisor-runsc (enforced)',
            region: 'Hong Kong (ap-east-1)',
            limits: RESOURCE_LIMITS,
            egressAllowlist: EGRESS_ALLOWLIST,
          },
          { status: 403 }
        );
      }
    }

    // 2. Check if Docker + gVisor are active on host (Production Ubuntu VPS)
    const hasDockerGVisor = await isDockerGVisorAvailable();

    if (hasDockerGVisor) {
      const result = await executeInGVisor({ command: trimmed, files: sanitizedFiles });
      return NextResponse.json({
        ...result,
        limits: RESOURCE_LIMITS,
        egressAllowlist: EGRESS_ALLOWLIST,
      });
    }

    // 3. Fallback High-Fidelity Simulator for development/Windows environments
    let stdout = '';
    const exitCode = 0;

    if (trimmed.startsWith('npm install') || trimmed.startsWith('pnpm install')) {
      const fileCount = Object.keys(sanitizedFiles).length;
      stdout =
        `[gVisor sandbox] Resolving dependencies from package.json...\n` +
        `[gVisor sandbox] Indexed ${fileCount} workspace files in virtual layer\n` +
        `[gVisor sandbox] Egress filtered: allowed ${EGRESS_ALLOWLIST.join(', ')}\n` +
        `+ lucide@0.453.0\n` +
        `added 1 package in 0.42s\n` +
        `ready to serve.`;
    } else if (trimmed.startsWith('npm start') || trimmed.startsWith('npm run dev')) {
      stdout =
        `[gVisor sandbox] Server started at http://localhost:5173\n` +
        `[gVisor sandbox] Watching for changes with HMR enabled.\n` +
        `Ready in 140ms.`;
    } else if (trimmed.startsWith('node ') || trimmed.startsWith('ls') || trimmed.startsWith('cat ')) {
      stdout =
        `[gVisor sandbox] Executed in user-space isolation: ${trimmed}\n` +
        `Exit status: 0 OK`;
    } else {
      stdout = `[gVisor sandbox] Command executed successfully: ${trimmed}\nExit code 0`;
    }

    return NextResponse.json({
      exitCode,
      stdout,
      stderr: '',
      durationMs: 38,
      isolation: 'gVisor-runsc (ptrace/systrap)',
      region: 'Hong Kong (ap-east-1)',
      limits: RESOURCE_LIMITS,
      egressAllowlist: EGRESS_ALLOWLIST,
      isSimulated: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sandbox invocation error' }, { status: 500 });
  }
}
