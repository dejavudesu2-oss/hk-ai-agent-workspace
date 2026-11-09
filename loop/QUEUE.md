# Task Queue

| ID | Description | Acceptance Test Command & Expected Result | Status | Attempts |
| :--- | :--- | :--- | :--- | :--- |
| **T01** | Repo skeleton: Next.js app, .gitignore, .env.example | `npm install && npm run build` exits 0 | DONE | 1 |
| **T02** | /plan/facts.md: verify claims with URLs or UNVERIFIED, re-check 3 most favorable claims | `node scripts/audit_facts.js` exits 0; all 9 claims verified, 3 favorable claims re-checked | DONE | 1 |
| **T03** | /plan/cost.md + scripts/cost.js: per-task and per-user cost from token counts | `node scripts/cost.js` prints USD and HKD, arithmetic matches hand-computed example | DONE | 1 |
| **T04** | Mock LLM provider streaming SSE tokens at realistic rate + provider adapter (mock/real via env) | `npm run test:chat` exits 0; verifies provider selection, SSE chunks, and real curl command streaming chunks | DONE | 1 |
| **T05** | Streaming file-block parser (XML-style file blocks) | `npm test` passes 32 cases (including 17 parser edge cases) | DONE | 1 |
| **T06** | Monaco editor + file tree + in-memory virtual file system fed by parser | `npm run build` and `npm run test:vfs` exit 0; files appear as stream arrives | DONE | 1 |
| **T07** | Live preview in sandboxed iframe with security documentation (sandbox attribute, origin, CSP) | `npm test` passes preview generator, CSP, and sandbox attribute isolation audits | DONE | 1 |
| **T08** | /api/sandbox backend execution with Docker + gVisor, resource limits, egress allowlist | Node tests pass for API logic, AST security filter, and container file mounting; live Docker+gVisor marked UNTESTED on host | DONE | 1 |
| **T09** | infra/setup.sh VPS bootstrap script | `bash -n` syntax passed; `shellcheck` marked UNTESTED (binary absent on Windows host) | DONE | 1 |
| **T10** | /bench loadtest and container-density scripts + capacity formula with [assumption] tags | `node bench/container_density.js` and `npm run bench:load` exit 0 | DONE | 1 |
| **T11** | End-to-end: prompt "build me a todo app" via the mock provider streams files into the editor and preview renders | `npm run test:e2e` exits 0 with 2/2 passing scenarios | DONE | 1 |
| **T12** | /plan/7day_plan.md (day-by-day, hours, tests) and /plan/risks.md (top 10 risks + mitigations) | Aligned with actual built codebase; reviewed and verified | DONE | 1 |
| **T13** | README with exact run commands | Fresh clone run commands verified (`npm run dev` started in 1661ms) | DONE | 1 |
| **T14** | AUDIT: Reconcile 5 architecture contradictions, check npm audit, write /plan/audit.md | `npm run build` lists API routes; audit.md complete; npm audit clean | DONE | 1 |
| **T15** | COST GUARD: IP rate limit, max input size, max_tokens, daily budget kill switch, invite code on /api/chat | `npm test` asserts 429/503 on limits, real provider blocked when budget exhausted | DONE | 1 |
| **T16** | REAL MODEL FIXTURES: 10 varied prompts recorded/replayed, measure TTFT and format-compliance rate | `node scripts/replay_fixtures.js` (or ts) logs usage, compliance rate, and failure audit | DONE | 1 |
| **T17** | FIX FROM REAL FAILURES: Fix parser and system prompt for edge cases, add regression tests | `npm test` passes all parser regression tests | DONE | 1 |
| **T18** | EDIT TURNS: Multi-turn prompt sends file tree + contents, supports search/replace patch action | Multi-turn test asserts only targeted file changed, preview renders | DONE | 1 |
| **T19** | PERSISTENCE: Autosave VFS & chat to IndexedDB, restore on reload, download zip button | Automated unit test & verified export/import | TODO | 0 |
| **T20** | FAILOVER TEST: Fake upstream with 429, 503, disconnect, slow stream; failover asserted | Unit test verifies failover, no partial file duplication, clear error reporting | TODO | 0 |
| **T21** | PREVIEW SECURITY: Exact CSP/sandbox audit, Babel unsafe-eval handling, storage shim, origin check | Unit tests verify storage shim, message source validation, cookie protection | TODO | 0 |
| **T22** | CROSS-PLATFORM + CI: Replace curl.exe with Node fetch, backslash/traversal tests, GitHub Actions CI | `npm test` runs fetch test; CI workflow created with 2 jobs | TODO | 0 |
| **T23** | COST MODEL v2: Real/assumed usage across 3 scenarios, free abuse, Stripe HK, Supabase, breakeven | `node scripts/cost_v2.js` and `/plan/cost_v2.md` show arithmetic in USD and HKD | TODO | 0 |
| **T24** | FACTS AUDIT: Re-open /plan/facts.md, unverified tags for unvisited URLs, audit top 3 favorable | Counts printed: verified, unverified, corrected; audit log complete | TODO | 0 |
| **T25** | DOCS + SAFETY: Update README, 7day_plan, risks.md; secrets scan; git instructions; readiness.md | Secrets scan passes cleanly; all documents synced with reality | TODO | 0 |
