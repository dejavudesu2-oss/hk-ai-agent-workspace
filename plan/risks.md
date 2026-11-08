# 【十大工程與商業風險及防禦方案】(Top 10 Risks & Mitigations)
**項目**：香港在線 AI Agent 平台 (7天極限上線)  
**責任人**：Solo Founder / Lead Architect  

---

## 風險矩陣總覽 (Risk Severity Matrix)

| 編號 | 風險維度 | 風險名稱 | 嚴重級別 | 緩解方案狀態 |
| :--- | :--- | :--- | :--- | :--- |
| **R01** | 法律版權 | WebContainer 商業授權侵權與索賠風險 | **極高 (Critical)** | 架構解耦，主推 Apache-2.0 Sandpack / 瀏覽器沙盒 |
| **R02** | 系統可用性 | DeepSeek 官方 API 突發 429 或網路抖動 | **高 (High)** | 雙路 Active-Active 自動熔斷切換至 SiliconFlow |
| **R03** | 網絡安全 | 沙盒終端被惡意利用為礦機或 DDoS 傀儡 | **極高 (Critical)** | gVisor 內核隔離 + iptables Egress 白名單出網 |
| **R04** | 用戶體驗 | 前端 COOP/COEP 跨域阻斷 Stripe 支付彈窗 | **高 (High)** | 採用 Stripe Hosted 託管收銀頁，脫離主頁面隔離域 |
| **R05** | 產品穩定性 | LLM 生成語法錯誤代碼導致預覽黑屏死鎖 | **高 (High)** | Iframe 看門狗捕獲異常，一鍵觸發 AI 自癒修復 |
| **R06** | 商業財務 | 惡意用戶刷高頻會話擊穿 API Token 成本 | **中 (Medium)** | 每日會話配額制 (Quota) + 5秒防抖節流限制 |
| **R07** | 基礎設施 | Serverless 函數 10-15s 逾時強制截斷代碼串流 | **高 (High)** | 全面採用 Docker 容器部署於香港 VPS，消除超時 |
| **R08** | 法律合規 | 香港 PCPD 個人資料私隱審查及數據留存風險 | **中 (Medium)** | 啟用 Zero Data Retention，發布標準 PICS 聲明 |
| **R09** | 本地市場 | 僅支援海外信用卡導致香港用戶轉化率低下 | **中 (Medium)** | 整合轉數快 (FPS) / PayMe 本地即時開通 |
| **R10** | 運營維護 | 單兵作戰遭遇代碼庫崩潰或數據丟失 | **中 (Medium)** | 3秒客戶端 IndexedDB 備份 + Supabase 自動快照 |

---

## 十大風險深度剖析與落地緩解措施 (Detailed Mitigations)

### R01. WebContainer 商業授權侵權與索賠風險 (Licensing Trap)
* **風險描述**：StackBlitz 官方明確規定 `@webcontainer/api` 僅可用於個人原型測試，在付費生產 SaaS 中使用必須獲取企業商業授權 [verified: StackBlitz ToS]。直接拿 Bolt.diy 上線收費面臨法律侵權與高額索賠。
* **緩解防禦方案**：
  1. 徹底解耦渲染引擎：默認啟用基於 Apache-2.0 許可的 Sandpack / 自研 Sandboxed Iframe 作為 Tier 1 渲染引擎 [verified: CodeSandbox Sandpack GitHub]。
  2. 後端全棧代碼執行無縫對接香港本地 gVisor 容器沙盒，核心運行時 100% 開源合法，不侵犯任何商業專利。

### R02. DeepSeek 官方 API 突發 429 請求超限或網路抖動
* **風險描述**：在亞太高峰時段（上午 10:00 - 下午 16:00），DeepSeek 官方 API 偶爾出現 HTTP 429 或回應延遲飆升 [assumption]。
* **緩解防禦方案**：
  1. 實裝雙路 Failover 路由：在 Next.js `/api/chat` 中封裝雙通道邏輯。主力走 `api.deepseek.com`，若在 5 秒內未收到首個 Token 或收到 429/500，立刻自動無感熱切換至硅基流動 (`api.siliconflow.cn` 託管之 Qwen2.5-Coder-32B 或 DeepSeek 節點) [verified: siliconflow.com]。
  2. 前端介面展示目前線路指示燈，用戶亦可手動切換線路。

### R03. 後端沙盒終端被惡意利用為礦機、黑客掃描或 DDoS 發射器
* **風險描述**：若提供後端終端執行能力，攻擊者可透過 `curl` 下載挖礦腳本或發起大規模 SYN Flood 攻擊，導致伺服器 IP 被阿里雲/AWS 封禁 [assumption]。
* **緩解防禦方案**：
  1. 內核虛擬化：必須透過 Google gVisor (`runsc`) 運行容器，在用戶空間攔截全部系統調用，阻斷內核提權 [verified: gVisor.dev]。
  2. 嚴格 cgroups v2 資源限制：單容器限制 CPU 1.0 核、記憶體 1GB、PID 上限 64、執行超時 60 秒強殺。
  3. Egress 出網白名單：配置 iptables / nftables，僅放行特定 DNS (1.1.1.1)、npm 鏡像 (registry.npmjs.org) 與 GitHub，阻斷全部未知外聯與挖礦協定端口。

### R04. 前端 COOP/COEP 跨域隔離阻斷 Stripe 支付彈窗與第三方資源
* **風險描述**：若主頁面設置了 `Cross-Origin-Opener-Policy: same-origin`，將導致頁面無法載入非 CORS CDN 圖片、第三方 Webhook 及 Stripe Elements 支付 Iframe [verified: MDN Web Docs]。
* **緩解防禦方案**：
  1. 採用 **Stripe Hosted Checkout** 模式：用戶點擊升級時跳轉至 Stripe 官方託管收銀頁面 (`checkout.stripe.com`)，完成付款後異步 Webhook 通知伺服器並重定向回應用 [verified: Stripe API Docs]。
  2. 主應用頁面無需開啟強制的 `COOP/COEP` 標頭，保留開放的生態兼容性。

### R05. LLM 生成語法錯誤代碼導致預覽崩潰黑屏死鎖
* **風險描述**：AI 偶爾會輸出缺失括號或未定義變量的代碼，導致 React 運行時報錯，預覽視窗白屏，用戶誤以為平台當機而流失 [assumption]。
* **緩解防禦方案**：
  1. 預覽 Iframe 內部注入全局異常攔截器：監聽 `window.addEventListener('error')` 及 `unhandledrejection`。
  2. 捕獲到報錯時，在預覽視窗上方展示防護 Banner：「⚠️ 發現運行時錯誤，點擊一鍵修復」。
  3. 點擊修復按鈕後，自動將錯誤堆棧（Error Stack Trace）作為 Prompt 傳送給後端看門狗 (Watchdog)，呼叫 DeepSeek 進行自癒修復，預覽自動熱更新恢復。

### R06. 惡意用戶編寫自動化腳本刷高頻會話擊穿 API Token 成本
* **風險描述**：羊毛黨或爬蟲透過無限制調用 API，在幾小時內耗盡創始人 API 賬戶餘額 [assumption]。
* **緩解防禦方案**：
  1. 每日配額硬性限制：免費用戶每天嚴格限制 15 次會話生成；Pro 付費用戶限制 200 次/天防刷熔斷。
  2. 前端輸入欄實施 5 秒防抖（Debounce）與請求頻率節流（Rate Limiting）。
  3. Cloudflare 開啟 Bot Fight Mode 及香港邊緣 WAF 規則 [verified: Cloudflare docs]。

### R07. Serverless 雲函數 10-15s 執行逾時強制截斷代碼串流
* **風險描述**：若部署在 Vercel 或 Cloudflare Pages 免費版，其 Serverless 函數存在 10-15 秒嚴格執行超時。LLM 生成大項目代碼時耗時通常需 20-40 秒，會直接觸發 `FUNCTION_INVOCATION_TIMEOUT` 異常中斷 [verified: Vercel docs]。
* **緩解防禦方案**：
  1. **Docker-First 原生容器化部署**：將 Next.js 應用構建為標準 Docker 鏡像，運行於香港本地 VPS 上，使用 Node.js 原生 HTTP 串流服務，徹底破除任何時間上限 [verified: Docker docs]。

### R08. 香港 PCPD 個人資料私隱審查及代碼數據洩露風險
* **風險描述**：香港個人資料私隱專員公署 (PCPD) 於 2024 年發布了嚴格的生成式 AI 數據指引。若用戶代碼包含商業機密或個人數據，且被用於模型訓練，將面臨法律合規處罰 [verified: PCPD 2024 AI Guidelines]。
* **緩解防禦方案**：
  1. 採用企業級商業 API 通道，嚴格啟用 **Zero Data Retention** 條款（數據不參與任何第三方模型訓練）[verified: DeepSeek API Terms]。
  2. 上線標準《個人資料收集聲明 (PICS)》，明示數據僅在內存中做流式處理。
  3. 客戶端本地存儲敏感環境變量，不向雲端明文傳輸。

### R09. 僅支援海外信用卡導致香港本地用戶轉化率極低
* **風險描述**：香港本地很多獨立開發者、學生或中小企工程師不習慣隨意綁定海外信用卡，單一 Stripe 信用卡支付容易造成 60% 以上結算流失 [assumption]。
* **緩解防禦方案**：
  1. 雙軌支付架構：在升級頁面並列顯示 **Stripe HK (信用卡/Apple Pay)** 與 **香港轉數快 (FPS) / PayMe 收款碼**。
  2. 提供轉數快早鳥季票 (HK\$ 180 / 3 個月)，用戶透過銀行 App 掃碼付款後填寫參考號，創始人手機查賬秒級手動開通。

### R10. 單兵作戰（Solo Founder）遭遇代碼庫崩潰或數據丟失
* **風險描述**：一人團隊精力有限，若本地開發機器硬盤損壞或伺服器宕機，缺乏團隊備份導致專案停擺 [assumption]。
* **緩解防禦方案**：
  1. 客戶端 3 秒自動 IndexedDB 防抖本地存檔，即使刷新瀏覽器代碼永不丟失。
  2. 項目配置自動化 GitHub Actions CI/CD，代碼提交自動運行單元測試並構建 Docker 鏡像。
  3. Supabase 雲端數據庫開啟每日自動冷備份。
