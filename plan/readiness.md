# System Readiness Matrix

> **Honesty Mandate**: No unearned "ready to launch" claims. Every component's verification state is documented with strict technical honesty.

| Component | Tested with Mock | Tested with Real API | Tested on Linux | Untested / Known Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Chat API (`/api/chat`)** | ✅ YES (Node `tsx` unit test) | ❌ NO (Blocked: no key) | ❌ NO (Tested only on Windows Node.js) | Live streaming network stalls, real-world connection resets |
| **Cost Guard & Rate Limiter** | ✅ YES (Rate limit, input cap, max_tokens, $0.50 budget kill switch, invite gate) | ❌ NO | ❌ NO | Reverse proxy IP spoofing behind multi-layer proxies, distributed Redis sync |
| **Streaming Parser** | ✅ YES (32 unit test cases) | ❌ NO (Pending real stream fixtures) | ❌ NO | Real LLM prose formatting quirks, malformed xml inside markdown |
| **Live Preview (Bundler + Iframe)** | ✅ YES (HTML generator tests) | ❌ NO | ❌ NO | Real browser iframe messaging, CSS isolation, complex NPM module dependencies |
| **Sandboxed Execution (`/api/sandbox`)** | ✅ YES (Command filter & Node runner) | N/A | ❌ NO (gVisor `runsc` requires Linux kernel) | Real gVisor `systrap` container runtime, egress iptables allowlist |
| **VPS Bootstrap (`infra/setup.sh`)** | ⚠️ Partial (`bash -n` syntax) | N/A | ❌ NO | Fresh Ubuntu 24.04 LTS package installs, systemd service registration |
| **Edit Turns & Patch Parser** | ❌ UNTESTED (Pending T18) | ❌ NO | ❌ NO | Fuzzy match failure recovery, multi-file diff conflicts |
| **Persistence (IndexedDB / Zip)** | ❌ UNTESTED (Pending T19) | N/A | ❌ NO | IndexedDB schema migrations, browser storage eviction, large zip memory |
| **Provider Failover** | ❌ UNTESTED (Pending T20) | ❌ NO | ❌ NO | Mid-stream token splicing during failover, upstream timeout handling |
| **CI / CD Pipeline** | ❌ UNTESTED (Pending T22) | N/A | ❌ NO | GitHub Actions runner execution |

---
*Last updated: Iteration 2 (T15 Cost Guard Complete - 429/503 limits, rate limiter, $0.50 budget kill switch tested)*
