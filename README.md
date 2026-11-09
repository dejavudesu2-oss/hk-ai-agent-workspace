# Hong Kong AI Agent Workspace (香港在線 AI Agent 工作台)

> A high-performance, cost-effective online AI agent development workspace (similar to Bolt.new / Claude Artifacts / v0.dev), engineered for solo founders with minimal budget in Hong Kong.

---

## 🌟 Key Features

1. **Split-Pane Full-Stack IDE**:
   - **Left Panel**: Reactive chat dialogue with sample prompts (Todo App, HK Taxi Splitter, etc.) and 1-click ZIP project exporter.
   - **Center Panel**: In-memory Virtual File System (VFS) with hierarchical file tree and full-featured **Monaco Editor** with multi-tab management and syntax highlighting.
   - **Bottom Panel**: Real-time terminal log viewer.
   - **Right Panel**: **Live Sandboxed Preview** with browser-level security isolation and error-watchdog self-healing.

2. **Resilient Streaming FSM Parser & Search/Replace Patch Engine**:
   - Parses streaming XML action blocks (`<sandbox_action type="file" path="...">`) on the fly.
   - **Search/Replace Patch Engine**: Multi-turn edits send file tree + file contexts and parse `<sandbox_action type="patch">` containing `<search>` and `<replace>`, enforcing a strict single-match invariant.
   - Auto-unescapes `<\\/sandbox_action>` tags inside generated code via negative lookbehind `(?<!\\)<\/(sandbox_action|boltAction)`.
   - Strips prose and markdown code fences around action tags, flags truncated streams (`isTruncated = true`), and sanitizes Windows drive letters and directory traversals (`../`).

3. **Cost Guard & Financial Circuit Breaker**:
   - Per-IP sliding-window rate limiting (30 requests / 10 minutes).
   - Maximum user input size limit (12,000 characters).
   - Output `max_tokens` cap (4,096 tokens).
   - Global daily budget kill switch ($0.50 USD cap) tracking real DeepSeek usage tokens in-stream.
   - Optional invite-code authentication gate on `/api/chat`.

4. **Two-Tier Sandbox Security Architecture**:
   - **Tier 1 (Client-Side, 85% of workloads)**: Sandboxed iframe with in-browser bundling and Babel Standalone.
     - **Security Invariant**: Strict `sandbox="allow-scripts allow-modals allow-forms"` (**strictly omitting `allow-same-origin`** to enforce an opaque `null` origin, blocking parent document/cookie tampering).
     - **In-Memory Storage Shim**: Detects `DOMException: Access is denied for this document` on `localStorage`/`sessionStorage` and activates an in-memory key-value polyfill conforming to the `Storage` interface.
     - **Source Validation**: Parent message receiver strictly verifies `event.source === iframeRef.current.contentWindow`.
     - **Content Security Policy (CSP)**: Injects strict meta CSP allowing trusted CDNs (`unpkg.com`, `cdn.tailwindcss.com`) with `'unsafe-inline'` and `'unsafe-eval'` (required for Babel Standalone).
     - **Error Watchdog**: Listens for `window.onerror` in iframe via `postMessage` and triggers "一鍵 AI 修復" (One-Click AI Self-Healing).
   - **Tier 2 (Backend Container Sandbox)**:
     - Google gVisor (`runsc:systrap`) user-space kernel interception without nested virtualization.
     - Cgroup resource quotas (256MB RAM, 0.5 vCPU, 64 PIDs, 15s timeout).
     - Strict network egress allowlist restricting outbound calls strictly to approved package registries and CDNs.

5. **Multi-Provider LLM Engine with Zero-Cost Mock & Failover**:
   - Controlled via `LLM_PROVIDER=mock` (default) or `LLM_PROVIDER=real`.
   - **Mock Provider**: Zero token consumption; streams realistic SSE chunks at ~60 tokens/sec cadence with complete runnable applications.
   - **Real Dual-Failover Provider**: Primary: DeepSeek API (Hong Kong edge direct, 12-20ms RTT); Backup: SiliconFlow / DashScope Qwen2.5-Coder.
   - Automatic failover on HTTP 429, 503, slow stream timeout (15s timeout race), or mid-stream network drop without duplicating partial files.

6. **Workspace Persistence**:
   - Debounced autosave of Virtual File System and chat history to browser **IndexedDB**.
   - Automatic workspace state restoration on page reload.
   - Clean "Download ZIP" package export via JSZip with normalized forward-slash paths.

7. **Hardcore Hong Kong FinOps Model (v2)**:
   - Fixed foreign exchange: **1 USD = 7.80 HKD** (HKMA Linked Peg).
   - **Unit Cost**: $0.00056 USD (1st gen) to $0.00096 USD (1st gen + 3 edits).
   - **Stripe HK Processing Fee**: 3.4% + HK$2.35 (6.86% effective fee on HK$68/mo subscription, netting HK$63.34 / $8.120 USD).
   - **Fixed Monthly OpEx**: $50.00 USD (HK$ 390.00 / mo: Supabase Pro $25, AWS Lightsail HK VPS $24, Domain $1).
   - **Breakeven Point**: Only **7 to 8 paying users** required to cover all fixed OpEx and subsidize up to 250 active free users!

---

## 🚀 Quickstart & Exact Run Commands

### 1. Prerequisites
- Node.js >= 18.17 (Node.js 20 or 22 recommended)
- npm >= 9.0

### 2. Setup & Installation
```bash
# 1. Clone the repository
git clone <repo-url>
cd hk-ai-agent-workspace

# 2. Configure environment (Optional - default uses free mock provider)
cp .env.example .env

# 3. Install dependencies across workspaces
npm install
```

### 3. Start Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 4. Build for Production (VPS Deployment)
```bash
npm run build
npm run start
```
*Note*: Deployed as a dynamic Node.js server (`next start`) on VPS reverse-proxied behind Cloudflare.

---

## 🧪 Automated Test & Benchmark Commands

Every layer of this workspace includes automated acceptance tests:

| Command | Purpose | Expected Result |
| :--- | :--- | :--- |
| `npm test` | Complete automated unit & integration test suite (64 tests) | Exits 0, all 64 tests pass |
| `npm run test:chat` | Cross-platform Node fetch SSE stream test | Exits 0, verifies streaming chunks without curl.exe |
| `npm run test:e2e` | End-to-End prompt-to-preview verification | Exits 0, validates English Todo App and HK Taxi Splitter |
| `npm run test:vfs` | Virtual File System & FileTree dynamic population | Exits 0, verifies live tree building as stream arrives |
| `node scripts/cost_v2.js` | FinOps Cost Model v2 token calculator & unit economics | Exits 0, verifies 3 scenarios, official peak rates, and sane tokens |
| `node scripts/breakeven_v3.js` | Breakeven v3 3x3 sensitivity matrix engine (HK$158 Pro) | Exits 0, computes exact breakeven paying users per cell |
| `node scripts/verify-fixtures.js` | Fixture provenance verifier | Exits 0 when real/ is valid or clean; exits 1 on mock in real/ |
| `node scripts/audit_facts_v2.js` | Fact-check matrix verification (T24 audit) | Exits 0, reports 7 verified, 3 unverified, 5 corrected |
| `node scripts/t27_evidence.js` | T27 comprehensive evidence printer | Exits 0, prints all hostile findings, audits, and test outputs |
| `node scripts/secrets_scan.js` | Pre-push credential & secrets scan | Exits 0, confirms .env gitignored and 0 secrets leaked |
| `node bench/container_density.js` | gVisor capacity planning on $24 VPS | Exits 0, outputs tagged formulas with `[assumption]` |
| `npm run bench:load` | In-process load testing & TTFT latency | Exits 0, measures throughput (15+ req/s, 50,000 blocks/s) |
| `npm run build` | Production Next.js build | Exits 0, compiles dynamic routes `/api/chat` and `/api/sandbox` |

---

## 🔒 Security & Git Push Instructions

### Pre-Push Security Verification
Before pushing commits to GitHub, verify that no credentials or environment keys are staged:
```bash
node scripts/secrets_scan.js
```

### Exact Commands to Push to a Private GitHub Repository
```bash
# 1. Verify working directory is clean
git status

# 2. Ensure your local branch is named master (or main)
git branch -M master

# 3. Using GitHub CLI to create private repo and push:
gh auth login
gh repo create hk-ai-agent --private --source=. --remote=origin --push

# Or manually using standard git remote:
git remote add origin git@github.com:<your-username>/hk-ai-agent.git
git push -u origin master
```

---

## 📂 Project Structure

```
hk-ai-agent-workspace/
├── .github/
│   └── workflows/
│       └── ci.yml                # GitHub Actions CI (build+test, infra smoke test)
├── app/                          # Next.js 14 App Router application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── chat/route.ts       # SSE streaming chat handler with Cost Guard
│   │   │   │   └── sandbox/route.ts    # gVisor sandbox execution API
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx                # Main 3-pane agent IDE workspace with persistence
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx           # Chat prompts & ZIP export
│   │   │   ├── Editor.tsx              # Monaco editor & tab manager
│   │   │   ├── FileTree.tsx            # Interactive VFS file explorer
│   │   │   ├── LivePreview.tsx         # Sandboxed iframe with error watchdog & source check
│   │   │   └── Terminal.tsx            # Terminal log display
│   │   └── lib/
│   │       ├── cost-guard.ts           # Rate limiting, input/token caps, budget kill switch
│   │       ├── docker-sandbox.ts       # gVisor runsc execution engine with path sanitization
│   │       ├── llm-provider.ts         # Dual-upstream failover & Mock LLM provider
│   │       ├── patch.ts                # Single-match invariant search/replace patch engine
│   │       ├── persistence.ts          # IndexedDB workspace autosave and restore
│   │       ├── preview-generator.ts    # In-browser bundler, storage shim, CSP & watchdog
│   │       ├── streaming-parser.ts     # Resilient FSM streaming XML action & patch parser
│   │       ├── templates.ts            # High-fidelity runnable starter templates
│   │       └── vfs.ts                  # Virtual File System & path utilities
├── bench/                        # Performance and capacity benchmarks
│   ├── container_density.js      # gVisor container capacity formula
│   └── loadtest.js               # Throughput & latency load test
├── infra/
│   └── setup.sh                  # One-command Ubuntu VPS bootstrap script (systrap)
├── loop/                         # Autonomous agent state & audit logs
│   ├── DECISIONS.md              # Architectural decisions & reasons
│   ├── LOG.md                    # Append-only iteration log
│   ├── QUEUE.md                  # Task queue & acceptance tests
│   └── STATE.md                  # Loop state & iteration checkpoints
├── plan/
│   ├── 7day_plan.md              # 7-day launch roadmap & daily pass/fail tests
│   ├── audit.md                  # T14 engineering & architectural contradictions audit
│   ├── breakeven_v3.md           # T29 3x3 sensitivity matrix & HK$158 breakeven model
│   ├── ci.md                     # CI/CD pipeline & gVisor runner execution plan
│   ├── cost_v2.md                # FinOps Cost Model v2 (3 scenarios, peak rates, sane tokens)
│   ├── facts.md                  # 2026 authoritative fact check matrix (T24 audited)
│   ├── failover_strategy.md      # T30 upstream failover & VFS integrity specification
│   ├── preview_security.md       # Iframe sandbox security & CSP specification (T21)
│   ├── provenance.md             # T26 metrics provenance & audit matrix
│   ├── readiness.md              # Honest verification state tracking matrix
│   └── risks.md                  # Top 10 engineering & commercial risks with mitigations
├── scripts/
│   ├── audit_facts_v2.js         # Facts audit verification test
│   ├── breakeven_v3.js           # Breakeven v3 3x3 sensitivity engine
│   ├── cost_v2.js                # FinOps token calculator v2
│   ├── record_real_fixtures.ts   # Live stream fixture recorder with budget cap
│   ├── replay_fixtures.ts        # Fixture replayer & TTFT/compliance auditor
│   ├── secrets_scan.js           # Pre-push credential & secrets scan
│   ├── t27_evidence.js           # T27 missing evidence printer
│   ├── test_chat_stream.js       # Cross-platform Node fetch streaming acceptance test
│   ├── test_vfs_stream.js        # VFS streaming tree acceptance test
│   └── verify-fixtures.js        # Fixture provenance validator (rejects mock in real/)
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore file (safely excludes .env)
├── package.json                  # Root npm workspace configuration
└── tsconfig.json                 # Root TypeScript path configuration
```
