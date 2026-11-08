# Task Queue

| ID | Description | Acceptance Test Command & Expected Result | Status | Attempts |
| :--- | :--- | :--- | :--- | :--- |
| **T01** | Repo skeleton: Next.js app, .gitignore, .env.example | `npm install && npm run build` exits 0 | DONE | 1 |
| **T02** | /plan/facts.md: verify claims with URLs or UNVERIFIED, re-check 3 most favorable claims | `node scripts/audit_facts.js` exits 0; all 9 claims verified, 3 favorable claims re-checked | DONE | 1 |
| **T03** | /plan/cost.md + scripts/cost.js: per-task and per-user cost from token counts | `node scripts/cost.js` prints USD and HKD, arithmetic matches hand-computed example | DONE | 1 |
| **T04** | Mock LLM provider streaming SSE tokens at realistic rate + provider adapter (mock/real via env) | `npm run test:chat` verifies SSE chunks and provider adapter switching | DONE | 1 |
| **T05** | Streaming file-block parser (XML-style file blocks) | `npm test` passes 25 cases (including 15 parser edge cases) | DONE | 1 |
| **T06** | Monaco editor + file tree + in-memory virtual file system fed by parser | `npm run build` and `npm run test:vfs` exit 0; files appear as stream arrives | DONE | 1 |
| **T07** | Live preview in sandboxed iframe with security documentation (sandbox attribute, origin, CSP) | `npm test` passes preview generator, CSP, and sandbox attribute isolation audits | DONE | 1 |
| **T08** | /api/sandbox backend execution with Docker + gVisor, resource limits, egress allowlist | Node tests pass for API logic; live Docker+gVisor marked UNTESTED on host | DONE | 1 |
| **T09** | infra/setup.sh VPS bootstrap script | `bash -n` syntax passed; `shellcheck` marked UNTESTED (binary absent on Windows host) | DONE | 1 |
| **T10** | /bench loadtest and container-density scripts + capacity formula with [assumption] tags | `node bench/container_density.js` and `npm run bench:load` exit 0 | DONE | 1 |
| **T11** | End-to-end: prompt "build me a todo app" via the mock provider streams files into the editor and preview renders | `npm run test:e2e` exits 0 with 2/2 passing scenarios | DONE | 1 |
| **T12** | /plan/7day_plan.md (day-by-day, hours, tests) and /plan/risks.md (top 10 risks + mitigations) | Review and verify consistency with actual built code | TODO | 0 |
| **T13** | README with exact run commands | Fresh run instructions verified with `npm run dev` / test execution | TODO | 0 |
