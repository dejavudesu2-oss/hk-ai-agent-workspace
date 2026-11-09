# Architecture & Engineering Audit (`/plan/audit.md`)

**Date**: November 2026  
**Status**: Completed & Verified  

---

## 1. Contradiction A: `next.config` Static Export vs. Backend API Routes

- **The Contradiction**:
  Earlier architectural notes mentioned "static export" for cost minimization (e.g. S3 / Cloudflare Pages hosting), but the application includes dynamic backend API routes:
  - `/api/chat` (streaming SSE endpoint with provider switching, rate limiting, and cost guard)
  - `/api/sandbox` (Docker + gVisor backend execution with AST security policy)

- **The Technical Evidence**:
  Next.js strictly prohibits static HTML export (`output: 'export'`) when dynamic server routes (`Route Handlers` utilizing request headers/body or dynamic streaming) exist.
  Running `npm run build` with `output: 'export'` fails immediately with:
  `Error: Page "/api/chat" cannot be exported with "output: export" because it uses request-dependent features or API routes.`
  When building without `output: 'export'`, `npm run build` succeeds and explicitly designates the routes as server-rendered dynamic endpoints:
  ```
  Route (app)                              Size     First Load JS
  ┌ ○ /                                    51.1 kB         138 kB
  ├ ○ /_not-found                          873 B            88 kB
  ├ ƒ /api/chat                            0 B                0 B
  └ ƒ /api/sandbox                         0 B                0 B
  ○  (Static)   prerendered as static content
  ƒ  (Dynamic)  server-rendered on demand
  ```

- **The Decision & Fix**:
  - **Deployment Mode**: Node.js Server Runtime on VPS (`next start` managed via PM2 / systemd) reverse-proxied behind Cloudflare.
  - **Target Host**: AWS Lightsail HK (2C / 4GB RAM) or DigitalOcean SGP/HK droplet.
  - **Action Taken**: `next.config.js` does NOT include `output: 'export'`. Deployment documentation in `README.md` and `7day_plan.md` updated to reflect `next start` on VPS.

---

## 2. Contradiction B: Cost Per Task ($0.0275 in Blueprint vs. $0.0036 in Current Model)

- **Detailed Calculation Comparison**:

  ### Calculation 1: Earlier Blueprint ($0.0275 / task)
  - **Assumptions / Baseline**: Based on generic multi-turn LLM assumptions without DeepSeek disk cache hit pricing or using higher-tier models (e.g. Bedrock Claude 3.5 Sonnet / Qwen / un-cached models):
    - Input Tokens: 15,000 tokens (cache miss) @ $0.50 / 1,000,000 = $0.0075 USD
    - Output Tokens: 2,000 tokens @ $10.00 / 1,000,000 = $0.0200 USD
    - **Total per task**: $0.0075 + $0.0200 = **$0.0275 USD** (HK$ 0.2145)
    - *Token Status*: Both input and output were assumed un-cached figures from pre-prompt-caching pricing sheets.

  ### Calculation 2: Current FinOps Model ($0.003636 / task)
  - **Assumptions / Baseline**: DeepSeek-Flash 2026 Peak Pricing with 75% context disk cache hit:
    - Input Cache-Hit: 6,000 tokens @ $0.006 / 1,000,000 = $0.000036 USD
    - Input Cache-Miss: 2,000 tokens @ $0.30 / 1,000,000 = $0.000600 USD
    - Output Tokens: 2,500 tokens @ $1.20 / 1,000,000 = $0.003000 USD
    - **Total per task**: $0.000036 + $0.000600 + $0.003000 = **$0.003636 USD** (HK$ 0.02836)
    - *Token Status*:
      - Input tokens (8,000 tokens across 3 turns): **ASSUMED** (derived from system prompt + VFS diffs, not yet measured under live multi-user traffic).
      - Cache-hit ratio (75%): **ASSUMED** (relies on DeepSeek's server-side disk cache prefix match for system prompts).
      - Output tokens (2,500 tokens): **ASSUMED** (derived from single-page React app code generation lengths).
      - Real tokens will be measured directly in T16 and fed into Cost Model v2 (T23).

- **The Fix**:
  Explicitly tag all token counts in `plan/cost.md` as `[assumption - pending T16 live measurement]`. Do not treat $0.0036 as proven reality until real stream token metrics are logged.

---

## 3. Contradiction C: The "4 Users to Break Even" Claim

- **The Claim**:
  "Only 4 paying Pro users (HK$68/mo) are required to cover all fixed platform monthly OpEx (HK$195/mo)."

- **The Flaw in the Claim**:
  - The calculation ($195 / $61.64 = 3.16 -> 4 users) assumes **ZERO free users**.
  - In reality, an open freemium platform incurs free-tier LLM token costs:
    If 500 free users make even 5 tasks per month, that is 2,500 sessions = $9.09 USD = HK$ 70.90 in unmonetized token drain.
  - Furthermore, Stripe HK transaction fee includes a fixed HK$2.35 charge per charge (3.4% + HK$2.35), reducing margin on micro-payments.
  - If a user triggers automated retry/repair loops or heavy edits, the per-user cost rises.

- **The Fix**:
  Mark the "4 users" claim as **UNREALISTIC / BIASED (Best-case only)**.
  A robust breakeven formula accounting for free-tier abuse, conversion rates, and 3 user scenarios will be computed in T23 (`/plan/cost_v2.md`).

---

## 4. Contradiction D: "12-18ms" DeepSeek Latency

- **The Reality**:
  - "12-18ms" is solely **ICMP/TCP network ping (Round Trip Time)** between Hong Kong data centers and DeepSeek's Hong Kong point-of-presence.
  - It is **NOT** Time-To-First-Token (TTFT) or inference time.
  - Actual LLM Time-To-First-Token typically ranges from 300ms to 1,500ms due to model queue scheduling and prefill computation.

- **The Fix**:
  - Relabeled all references in `.env.example`, `plan/facts.md`, and documentation from "12-20ms latency" to "12-20ms network RTT (excluding prefill inference TTFT)".
  - Real TTFT will be measured in T16 against the real API stream.

---

## 5. Security & Dependency Audit: `npm audit` and Next.js Pinned Version

- **Audit Findings**:
  - `npm audit` reported 6 advisories on initial check:
    - 2 critical advisories in `next` (DoS in Server Actions, image optimization cache confusion)
    - 1 critical advisory in `dompurify` (DOM XSS in subtree handlers, inherited via `monaco-editor`)
    - 1 moderate advisory in `esbuild` (inherited via `tsx`)
    - 1 high advisory in `postcss`
  - Action taken:
    - Ran safe `npm audit fix` which upgraded `next` from `14.2.15` to `14.2.35` (patched LTS release within major 14).
    - Upgraded `tsx` to `4.23.15` and dev dependencies.
    - Verified all 32 unit tests pass without regressions (`ℹ pass 32, ℹ fail 0`).
  - Remaining advisories in `next` and `postcss` require `next@16.x` which would be a breaking major framework migration; current application code does NOT use Next.js Server Actions or Next.js Image Optimization remote patterns, mitigating the exploitable surface.
