# Task Queue

| ID | Description | Acceptance Test Command & Expected Result | Status | Attempts |
| :--- | :--- | :--- | :--- | :--- |
| **T01** | Repo skeleton: Next.js app, .gitignore, .env.example | `npm install && npm run build` exits 0 | DONE | 1 |
| **T02** | /plan/facts.md: verify claims with URLs or UNVERIFIED, re-check 3 most favorable claims | `node scripts/audit_facts.js` exits 0; all 9 claims verified, 3 favorable claims re-checked | DONE | 1 |
| **T03** | /plan/cost.md + scripts/cost.js: per-task and per-user cost from token counts | `node scripts/cost.js` prints USD and HKD, arithmetic matches hand-computed example | TODO | 0 |
| **T04** | Mock LLM provider streaming SSE tokens at realistic rate + provider adapter (mock/real via env) | `curl -N http://localhost:3000/api/chat` or test script streams SSE chunks | TODO | 0 |
| **T05** | Streaming file-block parser (XML-style file blocks) | `npm test` passes at least 10 parser test cases (split chunks, malformed input) | TODO | 0 |
| **T06** | Monaco editor + file tree + in-memory virtual file system fed by parser | `npm run build` passes and scripted test shows files appear as stream arrives | TODO | 0 |
| **T07** | Live preview in sandboxed iframe with security documentation (sandbox attribute, origin, CSP) | Automated preview test passes or verified with exact reproduction steps | TODO | 0 |
| **T08** | /api/sandbox backend execution with Docker + gVisor, resource limits, egress allowlist | Node test on sandbox API endpoint; if Docker/gVisor unavailable, mark UNTESTED | TODO | 0 |
| **T09** | infra/setup.sh VPS bootstrap script | `shellcheck infra/setup.sh` or bash syntax verification; mark UNTESTED if unsupported locally | TODO | 0 |
| **T10** | /bench loadtest and container-density scripts + capacity formula with [assumption] tags | Run scripts or execute capacity calculation script with tagged assumptions | TODO | 0 |
| **T11** | End-to-end: prompt "build me a todo app" streams files into editor and preview renders | Automated e2e test script exits 0 | TODO | 0 |
| **T12** | /plan/7day_plan.md (day-by-day, hours, tests) and /plan/risks.md (top 10 risks + mitigations) | Review and verify consistency with actual built code | TODO | 0 |
| **T13** | README with exact run commands | Fresh run instructions verified with `npm run dev` / test execution | TODO | 0 |
