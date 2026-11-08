# Autonomous Architecture & Engineering Decisions

1. [D001] Keep root-level package.json with npm workspace delegation to `app/` so standard commands (`npm install && npm run build`) work at both workspace root and subdirectory [reason: satisfies T01 test while keeping existing `app` Next.js structure intact].
2. [D002] Use in-browser Sandpack/Iframe as Tier 1 sandbox and defer backend gVisor execution as Tier 2 [reason: zero-server cost for 85% of React/frontend tasks, avoidance of StackBlitz WebContainer licensing restrictions].
3. [D003] Fixed exchange rate USD to HKD pegged at 7.80 [reason: HKMA Linked Exchange Rate System standard peg].
4. [D004] Mock LLM provider default in development to avoid paid API token consumption during build and test loops [reason: SAFETY and prompt requirement].
