# Provenance Audit & Metrics Traceability Matrix (`/plan/provenance.md`)

**Date**: November 2026  
**Status**: Formal Audit & Retraction Record (Task T26)  

---

## 1. Metrics Provenance Audit Table

Every single number reported in the previous iteration report is audited below to its concrete disk source, exact command, raw output, and authentic classification:

| Number | Source File | Command that Produced It | Raw Output | Real or Mock | Provenance Status & Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **100% compliance** (10/10) | `scripts/replay_fixtures.ts`<br>`app/fixtures/mock/*.raw.txt` | `npx tsx scripts/replay_fixtures.ts` | `Format Compliance Rate: 100.0% (10/10 passed)` | **Mock** | **RETRACTED as "real-API" metric.** Relabeled as `[mock: synthetic replay against mock fixtures]`. Real API compliance is unmeasured (no key). |
| **TTFT 681ms** | `app/fixtures/mock/*.meta.json`<br>`scripts/replay_fixtures.ts` | `npx tsx scripts/replay_fixtures.ts` | `Average Measured TTFT: 681 ms` | **Mock / Synthetic** | **RETRACTED as live measurement.** Values were synthesized in `record_real_fixtures.ts` fallback generator when no API key was present. Relabeled `[mock/assumption]`. |
| **RTT 15ms** | `loop/LOG.md`<br>`plan/facts.md` | Network ping assumption / mental model | `(RTT ~15ms + 666ms prefill)` | **Assumption** | **RETRACTED as measured metric.** Ping to DeepSeek HK PoP was an assumed data center RTT, not measured during API calls. Relabeled `[assumption]`. |
| **prefill 666ms** | `loop/LOG.md` (iter 3, T16) | Derived arithmetic: `681ms - 15ms` | `(RTT ~15ms + 666ms prefill)` | **Mock / Fabricated Split** | **RETRACTED.** A client-side fetch cannot decompose TTFT into network RTT and server prefill without server timing headers. Client-side split is dropped entirely. |
| **$0.000559** (Scenario 1) | `scripts/cost_v2.js`<br>`plan/cost_v2.md` | `node scripts/cost_v2.js` | `Cost: $0.0005586 USD \| HK$ 0.00436` | **Assumption / Flawed Pricing** | **RETRACTED.** Calculated using an invalid output price ($0.28/1M instead of DeepSeek-Flash official $1.20 peak / $0.60 off-peak) and assumed token counts. |
| **$0.000958** (Scenario 2) | `scripts/cost_v2.js`<br>`plan/cost_v2.md` | `node scripts/cost_v2.js` | `Cost: $0.0009576 USD \| HK$ 0.00747` | **Assumption / Flawed Pricing** | **RETRACTED.** Inherited flawed $0.28 output price and assumed 250-token patch outputs across 4 turns. |
| **$0.001123** (Scenario 3) | `scripts/cost_v2.js`<br>`plan/cost_v2.md` | `node scripts/cost_v2.js` | `Cost: $0.0011228 USD \| HK$ 0.00876` | **Assumption / Flawed Pricing** | **RETRACTED.** Inherited flawed $0.28 output price and assumed auto-fix token counts. |
| **7-8 break-even users** | `scripts/cost_v2.js`<br>`plan/cost_v2.md` | `node scripts/cost_v2.js` | `Breakeven Paying Users: 7 users` / `8 users` | **Assumption / Flawed Pricing** | **RETRACTED.** Built upon the flawed scenario token costs, an arbitrary HK$68 Pro subscription (conflicting with blueprint HK$158), and unverified freemium ratios. |
| **64 tests** | `app/src/__tests__/*.test.ts` (11 test suites) | `npm test` | `ℹ tests 64\nℹ suites 0\nℹ pass 64\nℹ fail 0` | **Real** | **VERIFIED REAL.** 64 unit and integration tests executed by native Node.js test runner against code on disk. |

---

## 2. API Key Presence & Live Spend Ledger

- **Was an API key present when T16 ran?**: **NO** (`process.env.DEEPSEEK_API_KEY` was undefined; `.env` did not exist).
- **Was an API key present when T26 ran?**: **NO** (`Env DEEPSEEK_API_KEY present: false`, `.env exists: false`).
- **Spend-Ledger Total**: **$0.000000 USD** (0 live upstream API calls made; 0 tokens billed).
- **Contradiction Resolution**: The previous report presented mock fixture replay metrics (10 prompts replayed through parser) as if they were live API calls, while simultaneously noting in section 3 that real API calls were `BLOCKED [needs key]`. The truth is: **No live API calls were ever executed.** All 10 fixtures were synthetic/mock streams generated locally.

---

## 3. TTFT Latency Measurement Standard

- **Audit Finding**: In an HTTP/SSE client fetch, total Time-To-First-Token (TTFT) is the duration between initiating `fetch()` and receiving the first response chunk containing text tokens (`delta.content`).
- **Correction**: Client-side code **cannot** isolate network round-trip time (RTT) from server-side queueing and prefill execution time without deep transport-layer packet dissection or server-side `Server-Timing` headers.
- **Rule Adopted**: The arbitrary `681ms = 15ms RTT + 666ms prefill` decomposition is **retracted and dropped**. System reports will henceforth measure and state only:
  1. Total client-measured TTFT (from request dispatch to first token chunk), and/or
  2. TCP/TLS handshake connection time via Node.js `net.Socket` connect hooks.

---

## 4. Fixture Provenance Enforcement (`scripts/verify-fixtures.js`)

To prevent synthetic or mock fixtures from ever masquerading as real API telemetry:
1. All mock fixtures were moved out of `/app/fixtures/real/` into `/app/fixtures/mock/`.
2. `/app/fixtures/real/` is reserved strictly for genuine upstream recordings.
3. Every fixture in `/app/fixtures/real/` MUST possess an authentic sidecar JSON containing:
   - `provider`: upstream provider identifier (must NOT contain 'mock' or 'simulator')
   - `model`: exact upstream model ID
   - `requestId`: upstream request identifier (e.g. from `x-request-id` header or SSE data payload)
   - `timestamp`: valid ISO timestamp of the API invocation
   - `usage`: token usage object (`prompt_tokens`, `completion_tokens`)
4. Acceptance Test: `node scripts/verify-fixtures.js`
   - Exits `0` when `/app/fixtures/real/` is empty or contains only valid real fixtures with sidecars.
   - Exits non-zero (`1`) when a mock fixture or fixture lacking a valid sidecar is placed in `/app/fixtures/real/`. (Verified: exited with code 1 and detailed validation errors).
