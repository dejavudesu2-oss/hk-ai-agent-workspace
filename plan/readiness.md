# System Readiness Matrix

> **Honesty Mandate**: No unearned "ready to launch" claims. Every component's verification state is documented with strict technical honesty.

| Component | Tested with Mock | Tested with Real API | Tested on Linux | Untested / Known Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Chat API (`/api/chat`)** | ✅ YES (Node `tsx` unit test) | ❌ NO (Blocked: no key) | ❌ NO (Tested only on Windows Node.js) | Live streaming network stalls, real-world connection resets |
| **Cost Guard & Rate Limiter** | ✅ YES (Rate limit, input cap, max_tokens, $0.50 budget kill switch, invite gate) | ❌ NO | ❌ NO | Reverse proxy IP spoofing behind multi-layer proxies, distributed Redis sync |
| **Streaming Parser** | ✅ YES (42 unit tests + 10 fixture replays) | ⚠️ BLOCKED [needs key] (Hardened for escaped tags, truncation, fences, path traversal) | ❌ NO | Multi-byte UTF-8 boundary splits under live packet drops |
| **Live Preview (Bundler + Iframe)** | ✅ YES (HTML generator tests) | ❌ NO | ❌ NO | Real browser iframe messaging, CSS isolation, complex NPM module dependencies |
| **Sandboxed Execution (`/api/sandbox`)** | ✅ YES (Command filter & Node runner) | N/A | ❌ NO (gVisor `runsc` requires Linux kernel) | Real gVisor `systrap` container runtime, egress iptables allowlist |
| **VPS Bootstrap (`infra/setup.sh`)** | ⚠️ Partial (`bash -n` syntax) | N/A | ❌ NO | Fresh Ubuntu 24.04 LTS package installs, systemd service registration |
| **Edit Turns & Patch Parser** | ✅ YES (Search/replace patch engine, strict 1-match invariant, multi-turn Todo edit tested) | ❌ NO | ❌ NO | Whitespace tolerance fuzzy matching, multi-file merge conflict |
| **Persistence (IndexedDB / Zip)** | ✅ YES (IndexedDB autosave/restore + JSZip package download verified) | N/A | ❌ NO | Browser quota eviction under low disk, multi-tab IndexedDB locking |
| **Provider Failover** | ✅ YES (Simulated 429, 503, slow stream timeout, mid-stream disconnect, dual-failure tested) | ❌ NO | ❌ NO | Live TCP RST resets from Chinese/HK border transit, real ISP throttling |
| **CI / CD Pipeline** | ❌ UNTESTED (Pending T22) | N/A | ❌ NO | GitHub Actions runner execution |

---
*Last updated: Iteration 7 (T20 Failover Complete - 429/503 failover, slow stream timeout, mid-stream recovery, dual-failure 503 error verified)*
