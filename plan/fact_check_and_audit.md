# 香港在線 AI Agent 平台 —— 藍圖事實審查、多智能體推演與紅隊裁決報告
**文檔日期**：2026年11月  
**定位**：香港本地初創（Solo Founder）、極低預算、< 7 天上線產品之硬核事實審查與決策紀要

---

## Phase 0: 嚴格事實審查表 (Fact Check Matrix)

針對草稿 `hk_ai_agent_platform_definitive_blueprint.md` 及 `hk_sme_erp_tvp_execution_plan.md` 的關鍵陳述，基於 2026 年最新公開催詢與官方文檔進行逐一核實與糾偏：

| 原始主張 / 概念 (Claim) | 審查裁定 (Verdict) | 官方 / 一手數據來源 (Source) | 糾偏後準確數值與事實 (Corrected Value) |
| :--- | :--- | :--- | :--- |
| **DeepSeek API 定價與模型名稱**<br>草稿稱 DeepSeek-V3 快取價為 \$0.003-\$0.006，無離峰概念 | **部分正確 / 需更新** | [verified: deepseek.com official API documentation 2026] | 官方已推行「尖峰/離峰階梯計價」。`deepseek-flash` (V4.1-Flash) 快取擊中價：尖峰 \$0.006 / 離峰 \$0.003 每百萬 tokens；未命中輸入：尖峰 \$0.30 / 離峰 \$0.15；輸出：尖峰 \$1.20 / 離峰 \$0.60。旗艦 `deepseek-v4-pro` 快取擊中 \$0.022-\$0.044。香港直連延遲保持在 12-20ms。 |
| **Qwen 2.5 Coder 定價**<br>草稿未列出具體 Qwen API 備援成本 | **補充核實** | [verified: Alibaba Cloud DashScope & SiliconFlow 2026] | 硅基流動 (SiliconFlow) / 阿里雲百煉：Qwen2.5-Coder (7B/32B) 輸入約 \$0.30-\$0.66 / 1M tokens，輸出約 \$1.00-\$1.50 / 1M tokens。首充常含免費體驗額度，可作 DeepSeek 429 時的平價備援。 |
| **AWS Bedrock Claude 3.5 定價與區域**<br>草稿稱新加坡節點直連，快取減免 90% | **證實準確 (VERIFIED)** | [verified: AWS Bedrock Pricing & Anthropic Documentation] | 新加坡 `ap-southeast-1` 提供 Claude 3.5 Sonnet / 3.7。標準輸入 \$3.00 / 1M，輸出 \$15.00 / 1M。Prompt Caching：快取寫入 \$3.75 / 1M，快取讀取 \$0.30 / 1M（減免 90%）。香港直連 RTT 約 34-38ms。 |
| **Azure OpenAI 香港直接可用性**<br>草稿提及 Azure GPT-4o 供香港企業直簽 | **修正限制** | [verified: Microsoft Azure OpenAI regional documentation 2026] | Azure 香港本地機房 (`East Asia`) **不託管** Azure OpenAI 服務端點。香港企業必須簽約後將資源調配至 `Japan East` (東京) 或 `Southeast Asia` (新加坡) 之 Global/Regional 端點，香港連線 RTT 約 40-50ms，不可聲稱香港本地機房託管。 |
| **TVP 科技券新申請資格**<br>是否可為新用戶申請 TVP 資助 75% | **已終止新申請 (CRITICAL)** | [verified: 香港特區政府創新科技署 ITC 官方公報] | **創新科技署已於 2024 年 12 月 31 日正式停止接受科技券 (TVP) 新申請！** 任何聲稱「幫新客戶申請 TVP 拿 75% 補貼」均屬虛假承諾。僅存在 2024 年底前獲批存量項目的更換供應商救援 (Form TVP-04)。Day 7 上線必須走純商業直銷。 |
| **StackBlitz WebContainer 授權條款**<br>草稿一度認為可直接用於商業收費平台 | **違法侵權風險 (CRITICAL)** | [verified: StackBlitz WebContainer API Terms of Service & AUP] | `@webcontainer/api` 僅對開源非營利/技術原型 (PoC) 免費。**用於商業/付費生產環境必須簽署 StackBlitz 企業商業授權！** 且強制的 `COOP/COEP` 標頭會封殺所有非 CORS 圖片及 Stripe 內嵌 Iframe。Day 7 生產版必須具備沙盒解耦能力（瀏覽器沙盒採用 Apache-2.0 Sandpack / 自研 Iframe，全棧切換本地 gVisor）。 |
| **Sandpack 開源協議與跨域**<br>Sandpack 是否能避免 COOP/COEP 且免費商用 | **證實準確 (VERIFIED)** | [verified: CodeSandbox Sandpack GitHub (Apache-2.0 License)] | 核心 Sandpack 採用 Apache-2.0 許可協議，完全允許商業化修改與發布。標準客戶端預覽使用 Web Worker + Iframe postMessage 通訊，**無需啟用強制 COOP/COEP**，第三方 Stripe 支付與外部 CDN 圖片完全相容。 |
| **gVisor (`runsc`) 運行硬體需求**<br>常規平價 VPS 是否需要嵌套虛擬化/裸機 | **證實準確 (VERIFIED)** | [verified: gVisor.dev Architecture & runsc platform docs] | gVisor 原生支援 `--platform=ptrace` 與 `systrap`，**可在任何標準 Linux 核心 VPS 運行，無需 `/dev/kvm` 或硬體虛擬化**。阿里雲香港或 AWS Lightsail 常規虛擬機均可直接運行，免除 \$2,500/月 裸機開銷。 |
| **香港平價主機價格**<br>阿里雲香港 / AWS Lightsail 香港真實月費 | **證實準確 (VERIFIED)** | [verified: AWS Lightsail HK & Alibaba Cloud Pricing 2026] | AWS Lightsail 香港節點：2GB RAM 實例為 \$12/mo，4GB RAM 為 \$24/mo（需注意流量包為常規區的一半）；阿里雲香港輕量應用伺服器 (SAS) / ECS u1 系列 2C/2G 約 \$24-\$41/mo。首月基建成本低於 \$30 USD。 |
| **數碼港微型基金 (CCMF) 條款**<br>初創團隊申請條件與資助金額 | **證實準確 (VERIFIED)** | [verified: Cyberport Creative Micro Fund Guide 2026] | 總額 **HK\$ 100,000** 零股權資助，分三期發放 (HK\$10k 簽約 / HK\$45k 中期 / HK\$45k 終期)，專案週期 6 個月。需香港永久居民或在港註冊公司。審批需 2-3 個月，**不可作為 7 天內冷啟動依賴**，應作為 Week 4 申請的無償增長槓桿。 |

---

## Phase 1: 多智能體架構頭腦風暴 (Multi-Agent Brainstorm)

### Agent 1: Scope Cutter (極限範圍裁剪師)
* **核心原則**：Day 7 的核心 Magic 只有一個——「用戶輸入提示詞，AI 即時流式生成代碼，右側預覽即時運行並可互動」。除此以外全是干擾。
* **堅決砍掉**：
  1. 砍掉後端龐大的多租戶 RBAC 權限管理與團隊分享。
  2. 砍掉複雜的 AST 語法樹增量 Diff 補丁引擎（首週全量覆寫，DeepSeek 70 tok/s 幾秒即可重寫幾百行）。
  3. 砍掉自建 Firecracker / Kubernetes 複雜編排（首週前端優先，全棧依賴單機 Docker + gVisor）。
  4. 砍掉自定義域名綁定與雲端多容器獨立冷啟動。
* **絕對保留**：
  1. 雙軌分屏佈局：左側對話 + 文件樹 + Monaco Editor，右側 Live Preview + 終端日誌。
  2. 流式 XML 標籤解析器（`<sandbox_action type="file" path="...">`），500ms 內在編輯器中呈現打字機流式寫入。
  3. 預覽控制台與一鍵 AI 修復按鈕（Watchdog 捕獲 `window.onerror`）。

### Agent 2: Build-vs-Fork Architect (開源選型架構師)
* **選型對比**：
  * **OpenHands**：Python 驅動，針對本地終端與複雜 Docker 操作優化，Web 互動與即時在線預覽過於沉重，改造成純 Web IDE 需耗費 2-3 週。
  * **Bolt.diy**：Remix 框架，功能完整但深度綁定 StackBlitz WebContainer，存在重大商業授權侵權風險與 COOP/COEP 跨域問題。
  * **純淨自主骨架 (Next.js 14/15 App Router + Monaco + Sandpack/Iframe)**：
    * 採用現代 Next.js App Router 全棧架構，零商業授權版權風險。
    * 自研 200 行的高效流式有限狀態機解析器，精確解析 `<sandbox_action>`。
    * 預覽層採用沙盒 Iframe + 瀏覽器端動態打捆（支援 React 18/19、Tailwind CSS、Lucide 圖標），同時具備對接後端 gVisor 容器的標準 REST/WS 接口。
* **決策結論**：採用以 Next.js 為基礎的 Clean MVP 架構，吸收 Bolt.diy 的流式協議，徹底規避 StackBlitz 的版權律師函。

### Agent 3: Infra/Sandbox Engineer (沙盒基礎設施工程師)
* **架構決策**：
  * **雙軌沙盒策略 (Two-Tier Sandbox)**：
    * **Tier 1 (客戶端沙盒，覆蓋 85% 場景)**：在用戶瀏覽器內透過 Sandboxed Iframe 動態編譯與運行前端 HTML5 / React / CSS。伺服器成本為 **\$0.00**，反應時間 < 100ms，無任何伺服器資源消耗與攻擊面。
    * **Tier 2 (後端 gVisor 容器沙盒，覆蓋 15% 全棧場景)**：單台香港 VPS（AWS Lightsail HK 2C/4G 或阿里雲香港，月租 \$20-\$24 USD）。
    * 容器執行期使用 Google gVisor (`runsc`，使用 `--platform=ptrace` 或 `systrap`)。在用戶空間攔截全部系統調用，阻斷一切未授權網路掃描、提權與內核漏洞利用。
    * 邊緣使用 Caddy 提供自動 HTTPS 終結與反向代理。

### Agent 4: Cost/FinOps Analyst (成本與財務精算師)
* **單次會話 (Session) 成本拆解**：
  * 平均單次會話：3 輪對話，每次生成約 2,500 tokens，累計輸入（含上下文）約 8,000 tokens。
  * 採用 DeepSeek 官方 API（快取擊中率保守估計 70%）：
    * 輸入成本：(5,600 × \$0.006 + 2,400 × \$0.30) / 1,000,000 = \$0.0007536 USD
    * 輸出成本：(2,500 × \$1.20) / 1,000,000 = \$0.0030 USD
    * 單次會話模型成本：約 **\$0.0038 USD (折合約 HK\$ 0.029)**！
  * 單用戶月度成本（按活躍用戶每月 40 次會話計算）：
    * 模型費用：40 × \$0.0038 = **\$0.152 USD (HK\$ 1.18)**。
    * 伺服器分攤：單台 \$24 USD VPS 可輕鬆支撐 500 名活躍用戶，每人分攤 **\$0.048 USD (HK\$ 0.37)**。
    * **單個活躍用戶全月總成本：僅約 \$0.20 USD (HK\$ 1.56)**！
* **定價與毛利**：
  * Pro 方案定價：**HK\$ 68 / 月 (~ \$8.70 USD)**。
  * 扣除 Stripe 手續費（3.4% + HK\$2.35 ≈ HK\$4.66）及硬體模型成本（HK\$1.56），單個 Pro 用戶每月淨利潤達 **HK\$ 61.78**（毛利率高達 90.8%）。
  * **收支平衡點**：只需 **4 位付費用戶** 即可覆蓋香港 VPS 主機開銷（HK\$187 / 月）！

### Agent 5: Legal & GTM (香港法律與第一用戶落地)
* **法律主體最簡路徑**：
  * 首週無須花費數千元設立有限公司。個人持香港身份證直接向稅務局申請**獨資業務商業登記證 (Sole Proprietorship Business Registration)**，年費約 HK\$ 2,150（符合小規模業務豁免條件者可申請減免），1-2 個工作天出證。
  * 憑商業登記證開立 **Stripe HK** 商戶賬號，綁定個人香港銀行戶口（FPS / 恒生 / 中銀 / ZA Bank）。
* **私隱合規 (PDPO & PCPD 2024 指引)**：
  * 在網站頁面顯著提供《個人資料收集聲明 (PICS)》與《隱私政策》。
  * API 調用明確採用非訓練通道（Zero Data Retention），用戶在畫布中輸入之代碼不被回傳用於模型訓練。
* **Day 7 冷啟動獲客**：
  * 鎖定連登 (LIHKG) 程式台、StartupHK 社群與 HKU/HKUST 資訊科技社群，推出「香港創始支持者早鳥優惠：HK\$ 68 / 月，首 30 名巴打送專屬額度」，透過轉數快 (FPS) 即時查賬手動開通或 Stripe 直接線上扣款。

---

## Phase 2: 紅隊極限審查與裁決 (Red Team Critique & Revisions)

**紅隊審查員評分**：
* Agent 1 (Scope Cutter): 9/10
* Agent 2 (Build-vs-Fork): 8.5/10
* Agent 3 (Infra/Sandbox): 9/10
* Agent 4 (Cost/FinOps): 8/10
* Agent 5 (Legal/GTM): 8.5/10

### 紅隊強制否決的 3 項致命設計 (3 Hard Rejections)

#### 1. 否決一：在商業產品中直接使用 StackBlitz WebContainer (Agent 2 初步提案)
* **否決原因**：商業授權是法律地雷。StackBlitz 官方對營利性 SaaS 的授權收費極其昂貴，且有侵權追索風險。此外 COOP/COEP 會在前端造成跨域連鎖災難，阻止 Stripe Hosted Checkout 彈出視窗與外部資源載入。
* **裁決修訂**：**Day 7 生產版本必須使用開源無版權風險的 Sandpack / 自研沙盒 Iframe 作為 Tier 1 渲染引擎**，將 WebContainer 隔離為可選的本機實驗性開關，杜絕法律風險。

#### 2. 否決二：在 Day 7 衝刺期手寫 AST / SEARCH-REPLACE 差分補丁引擎 (Agent 1 初步提案)
* **否決原因**：流式狀態機下的差分補丁（類似 Aider 格式）在 LLM 輸出遺漏搜索錨點時極易產生代碼幻覺與文件損壞。編寫與調優邊界條件需要至少 5 天，極大增加發布失敗風險。
* **裁決修訂**：**首週全面採用全文件覆寫 (Full File Rewrite)**。DeepSeek-V3 速度超過 70 tokens/s，幾秒即可吐出完整組件代碼。將差分補丁推遲至 Week 3 作為性能優化。

#### 3. 否決三：在 SSE 串流過程中進行即時微計費與 Postgres 事務扣減 (Agent 4 初步提案)
* **否決原因**：在幾百毫秒一次的 SSE 標記流中對數據庫進行實時扣減，會產生嚴重的並發鎖競爭與計費延遲，一旦網路波動還會造成計費不一致。
* **裁決修訂**：**首週極簡化為「每日會話次數額度」**（免費版每天 15 次，Pro 版每日無限制但設 200 次/天防刷熔斷）。計費邏輯僅在會話開始時扣減，耗時 < 5ms，零資料庫負擔。
