# Autonomous Architecture & Engineering Decisions

1. [D001] Keep root-level package.json with npm workspace delegation to `app/` so standard commands (`npm install && npm run build`) work at both workspace root and subdirectory [reason: satisfies T01 test while keeping existing `app` Next.js structure intact].
2. [D002] Choose Virtual Document In-Browser Bundler + Babel Standalone over Sandpack for Tier 1 live preview [reason: zero dependency on CodeSandbox proprietary Nodebox licensing, avoids COOP/COEP header blocks on Stripe embeds, zero-cost client compilation].
3. [D003] Live preview iframe omits allow-same-origin in sandbox attribute [reason: ensures opaque null origin to strictly prevent untrusted generated code from reading parent DOM/cookies].
4. [D004] Fixed exchange rate USD to HKD pegged at 7.80 [reason: HKMA Linked Exchange Rate System standard peg].
5. [D005] Mock LLM provider default in development to avoid paid API token consumption during build and test loops [reason: SAFETY and prompt requirement].
