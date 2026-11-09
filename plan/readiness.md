# System Readiness Matrix (`/plan/readiness.md`)

> **Honesty Mandate**: No unearned "ready to launch" claims. Every component's verification state is documented with strict technical honesty. Real API calls are marked `BLOCKED [needs key]` when no key is present; all mock and assumed metrics are explicitly tagged.

| Component | Tested with Mock | Tested with Real API | Tested on Linux | Untested / Known Gaps |
| :--- | :--- | :--- | :--- | :--- |
| **Chat API (`/api/chat`)** | ✅ YES (Node `tsx` unit test) | ❌ NO (BLOCKED [needs key]) | ❌ NO (Tested only on Windows Node.js) | Live streaming network stalls, real-world connection resets |
| **Cost Guard & Rate Limiter** | ✅ YES (Rate limit, input cap, max_tokens, $0.50 budget kill switch, invite gate) | ❌ NO (BLOCKED [needs key]) | ❌ NO | Distributed Redis synchronization across multi-instance clusters |
| **Streaming Parser** | ✅ YES (42 unit tests + 10 mock fixture replays) | ❌ NO (BLOCKED [needs key]: raw streams replayed from /app/fixtures/mock/) | ❌ NO | Live streaming multi-byte UTF-8 split across packet boundaries |
| **Fixture Provenance Guard** | ✅ YES (`scripts/verify-fixtures.js` rejects mock fixtures in real/) | N/A (real/ is clean and empty) | ❌ NO | Third-party provider sidecar metadata schema variations |
| **Live Preview (Bundler + Iframe)** | ✅ YES (CSP, no allow-same-origin, in-memory storage shim, event.source check tested) | ❌ NO | ❌ NO | Real browser end-to-end rendering (Playwright not installed; marked [manual]), complex NPM module dependencies |
| **Sandboxed Execution (`/api/sandbox`)** | ✅ YES (Command filter & Node runner) | N/A | ❌ NO (gVisor `runsc` requires Linux kernel) | Real gVisor `systrap` container runtime on bare VPS, egress iptables allowlist |
| **VPS Bootstrap (`infra/setup.sh`)** | ⚠️ Partial (`bash -n` syntax checked) | N/A | ❌ NO | Fresh Ubuntu 24.04 LTS package installs, systemd service registration |
| **Edit Turns & Patch Parser** | ✅ YES (Search/replace patch engine, strict 1-match invariant, multi-turn Todo edit tested) | ❌ NO (BLOCKED [needs key]) | ❌ NO | Whitespace tolerance fuzzy matching, multi-file concurrent merge conflict |
| **Persistence (IndexedDB / Zip)** | ✅ YES (IndexedDB autosave/restore + JSZip package download verified) | N/A | ❌ NO | Browser quota eviction under low disk, multi-tab IndexedDB locking |
| **Provider Failover** | ✅ YES (Simulated 429, 503, slow stream timeout, mid-stream disconnect, dual-failure tested) | ❌ NO (BLOCKED [needs key]) | ❌ NO | Live TCP RST resets from Chinese/HK border transit, real ISP throttling |
| **CI / CD Pipeline** | ✅ YES (Job 1: npm test + build verified) | N/A | ⚠️ Job 2 UNTESTED-locally (Marked in ci.yml; exact steps in plan/ci.md) | GitHub runner network limits, gVisor systrap apt mirror availability |
| **FinOps Cost Sanity (T28)** | ✅ YES (Official DeepSeek peak rates verified, 3 scenarios audited, $0.000559 retracted) | ❌ NO (Grounded on published peak pricing + mock fixture token lengths) | N/A | High-volume production token variance under unconstrained user prompts |
| **Breakeven v3 Model (T29)** | ✅ YES (scripts/breakeven_v3.js verified, HK$158 Pro price reconciled, 3x3 sensitivity matrix complete) | N/A | N/A | Actual conversion rate variance (modeled at 1%, 3%, 5%) |
| **Failover Strategy (T30)** | ✅ YES (plan/failover_strategy.md written; test proves 0 duplicates & partial file discard) | ❌ NO (BLOCKED [needs key]) | ❌ NO | Upstream provider token refund policy on partial connection drop |
| **Market & Regulatory Facts** | ✅ YES (7 verified with live 200 URLs, 3 unverified due to 403/404, 5 corrections documented) | N/A | N/A | Future regulatory changes to HK cross-border API access or Stripe payment rules |
| **Pre-Push Security (T31)** | ✅ YES (Deep scan passed 0 leaks across 114 files, .env gitignored, entire git history clean) | N/A | N/A | Untracked temporary files during developer manual editing |

---
*Last updated: Iteration 1 of Resume Loop (Tasks T26-T31 Complete: Provenance Audit, Missing Evidence, Cost Sanity, Breakeven v3, Failover Strategy, Pre-Push Secrets Scan Verified)*
