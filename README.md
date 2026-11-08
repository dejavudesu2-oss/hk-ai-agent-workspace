# Hong Kong AI Agent Workspace (香港在線 AI Agent 工作台)

> A high-performance, cost-effective online AI agent development workspace (similar to Bolt.new / Claude Artifacts / v0.dev), engineered for solo founders with minimal budget in Hong Kong.

---

## 🌟 Key Features

1. **Split-Pane Full-Stack IDE**:
   - **Left Panel**: Reactive chat dialogue with sample prompts (Todo App, HK Taxi Splitter, etc.) and 1-click ZIP project exporter.
   - **Center Panel**: In-memory Virtual File System (VFS) with hierarchical file tree and full-featured **Monaco Editor** with multi-tab management and syntax highlighting.
   - **Bottom Panel**: Real-time terminal log viewer.
   - **Right Panel**: **Live Sandboxed Preview** with browser-level security isolation and error-watchdog self-healing.

2. **Resilient Streaming FSM Parser**:
   - Parses streaming XML action blocks (`<sandbox_action type="file" path="...">`) on the fly.
   - Handles network chunk fragmentation (down to 1-character packets), unquoted attributes, and automatically recovers when LLMs omit closing tags.

3. **Two-Tier Sandbox Architecture**:
   - **Tier 1 (Client-Side, 85% of workloads)**: Sandboxed iframe with in-browser bundling and Babel Standalone.
     - **Security Model**: Strict `sandbox="allow-scripts allow-modals allow-forms"` (**strictly omitting `allow-same-origin`** to enforce an opaque `null` origin, blocking parent document/cookie tampering).
     - **Content Security Policy (CSP)**: Injects strict meta CSP allowing trusted CDNs while blocking unauthorized scripts.
     - **Error Watchdog**: Listens for `window.onerror` in iframe via `postMessage` and triggers "一鍵 AI 修復" (One-Click AI Self-Healing).
     - **License**: 100% open-source, eliminating StackBlitz WebContainer commercial licensing royalties and COOP/COEP headers.
   - **Tier 2 (Backend Container Sandbox)**:
     - Google gVisor (`runsc:systrap`) user-space kernel interception.
     - Cgroup resource quotas (256MB RAM, 0.5 vCPU, 64 PIDs, 15s timeout).
     - Network egress allowlist restricting outbound calls strictly to approved package registries and CDNs.

4. **Multi-Provider LLM Engine with Zero-Cost Mock**:
   - Controlled via `LLM_PROVIDER=mock` (default) or `LLM_PROVIDER=real`.
   - **Mock Provider**: Zero token consumption; streams realistic SSE chunks at ~60 tokens/sec cadence with complete runnable applications.
   - **Real Dual-Failover Provider**: Primary: DeepSeek API (Hong Kong edge direct, 12-20ms RTT); Backup: SiliconFlow / DashScope Qwen2.5-Coder.

5. **Hardcore Hong Kong FinOps Model**:
   - Fixed foreign exchange: **1 USD = 7.80 HKD** (HKMA Linked Peg).
   - Single session cost: **$0.003636 USD (~ HK$ 0.0284)** using DeepSeek context caching.
   - Fixed monthly VPS: **$24.00 USD (HK$ 187.20)** on AWS Lightsail HK (2C / 4GB RAM).
   - **Breakeven Point**: Only **4 Pro subscribers** (HK$ 68/mo) required to achieve 100% operational breakeven!

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

---

## 🧪 Automated Test & Benchmark Commands

Every layer of this workspace includes automated acceptance tests:

| Command | Purpose | Expected Result |
| :--- | :--- | :--- |
| `npm test` | Complete test suite (28 test cases) | Exits 0, all 28 tests pass |
| `npm run test:e2e` | End-to-End prompt-to-preview verification | Exits 0, validates English Todo App and HK Taxi Splitter |
| `npm run test:chat` | SSE stream cadence & provider adapter switching | Exits 0, verifies realistic chunk streaming and env toggle |
| `npm run test:vfs` | Virtual File System & FileTree dynamic population | Exits 0, verifies live tree building as stream arrives |
| `node scripts/cost.js` | FinOps token calculator & unit economics | Exits 0, matches hand-computed baseline ($0.003636 USD) |
| `node scripts/audit_facts.js` | Fact-check matrix verification | Exits 0, verifies 9 claims with URLs + 3 hostile re-checks |
| `node bench/container_density.js` | gVisor capacity planning on $24 VPS | Exits 0, outputs tagged formulas with `[assumption]` |
| `npm run bench:load` | In-process load testing & TTFT latency | Exits 0, measures throughput (15+ req/s, 50,000 blocks/s) |
| `npm run build` | Production Next.js build | Exits 0, builds static & dynamic pages successfully |

---

## 📂 Project Structure

```
hk-ai-agent-workspace/
├── app/                          # Next.js 14 App Router application
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── chat/route.ts       # SSE streaming chat handler
│   │   │   │   └── sandbox/route.ts    # gVisor sandbox execution API
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx                # Main 3-pane agent IDE workspace
│   │   ├── components/
│   │   │   ├── ChatPanel.tsx           # Chat prompts & ZIP export
│   │   │   ├── Editor.tsx              # Monaco editor & tab manager
│   │   │   ├── FileTree.tsx            # Interactive VFS file explorer
│   │   │   ├── LivePreview.tsx         # Sandboxed iframe with error watchdog
│   │   │   └── Terminal.tsx            # Terminal log display
│   │   └── lib/
│   │       ├── docker-sandbox.ts       # gVisor runsc execution engine
│   │       ├── llm-provider.ts         # Mock & Real LLM provider adapters
│   │       ├── preview-generator.ts    # In-browser bundler, CSP & watchdog
│   │       ├── streaming-parser.ts     # Resilient FSM streaming XML parser
│   │       ├── templates.ts            # High-fidelity runnable starter templates
│   │       └── vfs.ts                  # Virtual File System & path utilities
├── bench/                        # Performance and capacity benchmarks
│   ├── container_density.js      # gVisor container capacity formula
│   └── loadtest.js               # Throughput & latency load test
├── infra/
│   └── setup.sh                  # One-command Ubuntu VPS bootstrap script
├── loop/                         # Autonomous agent state & audit logs
│   ├── DECISIONS.md              # Architectural decisions & reasons
│   ├── LOG.md                    # Append-only iteration log
│   ├── QUEUE.md                  # Task queue & acceptance tests
│   └── STATE.md                  # Loop state & iteration checkpoints
├── plan/
│   ├── 7day_plan.md              # 7-day launch roadmap & daily pass/fail tests
│   ├── cost.md                   # FinOps unit economics & breakeven models
│   ├── facts.md                  # 2026 authoritative fact check matrix
│   ├── preview_security.md       # Iframe sandbox security & CSP specification
│   └── risks.md                  # Top 10 engineering & commercial risks
├── scripts/
│   ├── audit_facts.js            # Facts audit verification test
│   ├── audit_setup.js            # Infra bash script static audit
│   ├── cost.js                   # FinOps token calculator
│   ├── e2e_test.js               # End-to-end automated verification
│   ├── test_chat_stream.js       # Streaming chat acceptance test
│   └── test_vfs_stream.js        # VFS streaming tree acceptance test
├── .env.example                  # Environment configuration template
├── .gitignore                    # Git ignore file (safely excludes .env)
├── package.json                  # Root npm workspace configuration
└── tsconfig.json                 # Root TypeScript path configuration
```

---

## 🔒 Security & Compliance Summary

1. **Iframe Isolation**: No `allow-same-origin` ensures user-generated code runs in an opaque `null` origin, completely preventing sandbox escape or cookie theft.
2. **Hong Kong Compliance (PCPD)**: Zero Data Retention (ZDR) on LLM provider calls guarantees user source code is never stored or used for model training.
3. **No TVP Dependency**: Fully market-driven SaaS model (HK$ 68/mo); does not make false promises regarding the discontinued Technology Voucher Programme.
4. **Stripe & FPS Dual-Rail Billing**: Direct payments via Stripe HK (credit card/Apple Pay) and local Hong Kong Faster Payment System (轉數快 FPS) QR codes.
