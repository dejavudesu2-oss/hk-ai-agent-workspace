# System Readiness Matrix

> **Honesty Mandate**: No unearned "ready to launch" claims. Every component's verification state is documented with strict technical honesty.

| Component | Tested with Mock | Tested with Real API | Tested on Linux | Untested / Known Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Chat API (`/api/chat`)** | ✅ YES (Node `tsx` unit test) | ❌ NO (Blocked: no key) | ❌ NO (Tested only on Windows Node.js) | Live streaming network stalls, real-world connection resets |
| **Cost Guard & Rate Limiter** | ✅ YES (Rate limit, input cap, max_tokens, $0.50 budget kill switch, invite gate) | ❌ NO | ❌ NO | Reverse proxy IP spoofing behind multi-layer proxies, distributed Redis sync |
| **Streaming Parser** | ✅ YES (42 unit tests + 10 fixture replays) | ⚠️ BLOCKED [needs key] (Hardened for escaped tags, truncation, fences, path traversal) | ❌ NO | Multi-byte UTF-8 boundary splits under live packet drops |
| **Live Preview (Bundler + Iframe)** | ✅ YES (CSP, no allow-same-origin, in-memory storage shim, event.source check tested) | ❌ NO | ❌ NO | Real browser end-to-end rendering (Playwright not installed; marked [manual]), complex NPM module dependencies |
| **Sandboxed Execution (`/api/sandbox`)** | ✅ YES (Command filter & Node runner) | N/A | ❌ NO (gVisor `runsc` requires Linux kernel) | Real gVisor `systrap` container runtime, egress iptables allowlist |
| **VPS Bootstrap (`infra/setup.sh`)** | ⚠️ Partial (`bash -n` syntax) | N/A | ❌ NO | Fresh Ubuntu 24.04 LTS package installs, systemd service registration |
| **Edit Turns & Patch Parser** | ✅ YES (Search/replace patch engine, strict 1-match invariant, multi-turn Todo edit tested) | ❌ NO | ❌ NO | Whitespace tolerance fuzzy matching, multi-file merge conflict |
| **Persistence (IndexedDB / Zip)** | ✅ YES (IndexedDB autosave/restore + JSZip package download verified) | N/A | ❌ NO | Browser quota eviction under low disk, multi-tab IndexedDB locking |
| **Provider Failover** | ✅ YES (Simulated 429, 503, slow stream timeout, mid-stream disconnect, dual-failure tested) | ❌ NO | ❌ NO | Live TCP RST resets from Chinese/HK border transit, real ISP throttling |
| **CI / CD Pipeline** | ✅ YES (Job 1: npm test + build verified) | N/A | ⚠️ Job 2 UNTESTED-locally (Marked in ci.yml; exact steps in plan/ci.md) | GitHub runner network limits, gVisor systrap apt mirror availability |
| **FinOps Cost Model v2** | ✅ YES (scripts/cost_v2.js verified, 3 scenarios, Stripe HK, free abuse & breakeven modeled) | ⚠️ BLOCKED [needs key] (Grounded on T16 measured fixtures + DeepSeek peak pricing) | N/A | High-volume production token variance under unconstrained user prompts |
| **Market & Regulatory Facts** | ✅ YES (7 verified with live 200 URLs, 3 unverified due to 403/404, 5 corrections documented) | N/A | N/A | Future regulatory changes to HK cross-border API access or Stripe payment rules |

---
*Last updated: Iteration 11 (T24 Facts Audit Complete - 7 verified, 3 unverified, 5 corrections versus early drafts, 3 favorable claims re-checked)*
