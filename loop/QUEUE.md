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
| **T19** | PERSISTENCE: Autosave VFS & chat to IndexedDB, restore on reload, download zip button | Automated unit test & verified export/import | DONE | 1 |
| **T20** | FAILOVER TEST: Fake upstream with 429, 503, disconnect, slow stream; failover asserted | Unit test verifies failover, no partial file duplication, clear error reporting | DONE | 1 |
| **T21** | PREVIEW SECURITY: Exact CSP/sandbox audit, Babel unsafe-eval handling, storage shim, origin check | Unit tests verify storage shim, message source validation, cookie protection | DONE | 1 |
| **T22** | CROSS-PLATFORM + CI: Replace curl.exe with Node fetch, backslash/traversal tests, GitHub Actions CI | `npm test` runs fetch test; CI workflow created with 2 jobs | DONE | 1 |
| **T23** | COST MODEL v2: Real/assumed usage across 3 scenarios, free abuse, Stripe HK, Supabase, breakeven | `node scripts/cost_v2.js` and `/plan/cost_v2.md` show arithmetic in USD and HKD | DONE | 1 |
| **T24** | FACTS AUDIT: Re-open /plan/facts.md, unverified tags for unvisited URLs, audit top 3 favorable | Counts printed: verified, unverified, corrected; audit log complete | DONE | 1 |
| **T25** | DOCS + SAFETY: Update README, 7day_plan, risks.md; secrets scan; git instructions; readiness.md | Secrets scan passes cleanly; all documents synced with reality | DONE | 1 |
| **T26** | PROVENANCE AUDIT: Audit all numbers in last report into /plan/provenance.md, check key presence, relabel mock/assumptions in cost/readiness/facts, drop TTFT split, scripts/verify-fixtures.js | `node scripts/verify-fixtures.js` rejects mock in real/; provenance.md written | DONE | 1 |
| **T27** | MISSING EVIDENCE: Print iterations, FAIL/BLOCKED count, hostile findings T14-T25, audit.md, readiness.md, facts.md counts, and test names/output for T18, T19, T20, T21 | All requested evidence printed from real disk files | DONE | 1 |
| **T28** | COST SANITY: Per-scenario token breakdown table, check $0.000559 implied output tokens, explain 3 edits cost vs 1st gen, correct everywhere | Output tokens arithmetic verified; costs corrected everywhere | DONE | 1 |
| **T29** | BREAKEVEN v3: Reconcile Pro price to HK$158, tagged assumptions table, 3x3 sensitivity matrix with arithmetic per cell | Sensitivity matrix complete with paying users formula per cell | DONE | 1 |
| **T30** | FAILOVER STRATEGY: Document restart vs resume, token loss, VFS overwrite/rollback, test output proving no duplicate/half-written files | Strategy documented and failover test output demonstrated | DONE | 1 |
| **T31** | REAL RUN & PUSH READINESS: Check API key (BLOCKED [needs key] if absent), run secrets scan over git history & fixtures, verify .env gitignored, write private GitHub repo creation commands | Secrets scan clean, .env gitignored, git push commands documented | DONE | 1 |
| **T32** | EVIDENCE INDEX: Write /plan/evidence_index.md with 1 row per task T14-T30 (status, file, test command, last real output line), totals, T29 sensitivity table, T30 failover answer, T28 plausibility check | `cat /plan/evidence_index.md` has no unverified rows; all test commands verified | DONE | 1 |
| **T33** | COST LABELS: Token counts, prices per 1M, USD, HKD, cumulative vs per-turn, tagged [mock], [assumption] or [measured]; retag cost.md, readiness.md, README.md | Verified labeling across cost.md, readiness.md, README.md; node scripts/cost_v2.js exits 0 | DONE | 1 |
| **T34** | SECRETS SCAN WITH NEGATIVE CONTROL: Negative control test with fake sk- and Authorization line; git history and /app/fixtures scanned; personal paths flagged | `node scripts/secrets_scan.js` exits 0; negative control verified | PENDING | 0 |
| **T35** | BROWSER PROOF: Install Playwright (pinned version >= 2 weeks ago), e2e test against `npm run dev` (streaming, preview iframe, todo item, storage shim, cookie/parent isolation, CSP/sandbox audit, parent event.source check, screenshots saved) | Playwright e2e test exits 0 with screenshots or marked BLOCKED with exact reproduction steps | PENDING | 0 |
| **T36** | REAL RUN (key required): DeepSeek model check, non-reasoning chat model, 30 varied prompts recorded with sidecars, compliance k/30, patch k/5, TTFT p50/p95, spend ledger | BLOCKED [needs key] if API key absent; otherwise 30 fixtures recorded and verified | PENDING | 0 |
| **T37** | COST AND BREAKEVEN v4: Replace assumed token counts with T36 usage numbers, re-run scenario and sensitivity tables, old vs new, paying users at HK$158 | BLOCKED [needs key] if T36 blocked; otherwise updated with measured usage | PENDING | 0 |
