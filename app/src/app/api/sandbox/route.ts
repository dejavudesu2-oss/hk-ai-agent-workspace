import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { command, files } = await req.json();

    if (!command || typeof command !== 'string') {
      return NextResponse.json({ error: 'Command is required' }, { status: 400 });
    }

    const trimmed = command.trim();

    // Security check: Guard against dangerous commands (simulation of gVisor / AST security filter)
    const dangerousPatterns = [/rm\s+-rf\s+\//i, /:(){:|:&};:/, />\s*\/dev\/sda/i, /mkfs/i];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(trimmed)) {
        return NextResponse.json({
          exitCode: 1,
          stdout: '',
          stderr: 'Security Policy Violation: Destructive syscall blocked by gVisor runtime policy.',
          isolation: 'gVisor-runsc (enforced)',
        }, { status: 403 });
      }
    }

    // Process benign simulated sandbox commands
    let stdout = '';
    let exitCode = 0;

    if (trimmed.startsWith('npm install') || trimmed.startsWith('pnpm install')) {
      const fileCount = files ? Object.keys(files).length : 0;
      stdout = `[gVisor sandbox] Resolving dependencies from package.json...\n` +
               `[gVisor sandbox] Indexed ${fileCount} workspace files in virtual layer\n` +
               `+ lucide@0.453.0\n` +
               `added 1 package in 0.42s\n` +
               `ready to serve.`;
    } else if (trimmed.startsWith('npm start') || trimmed.startsWith('npm run dev')) {
      stdout = `[gVisor sandbox] Server started at http://localhost:5173\n` +
               `[gVisor sandbox] Watching for changes with HMR enabled.\n` +
               `Ready in 140ms.`;
    } else if (trimmed.startsWith('node ') || trimmed.startsWith('ls') || trimmed.startsWith('cat ')) {
      stdout = `[gVisor sandbox] Executed in user-space isolation: ${trimmed}\n` +
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Sandbox invocation error' }, { status: 500 });
  }
}
