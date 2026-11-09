# 【十大工程與商業風險及防禦方案】(Top 10 Risks & Mitigations)
**項目**：香港在線 AI Agent 平台 (7天極限上線)  
**責任人**：Solo Founder / Lead Architect  
**版本**：基於實際已構建代碼庫之審查版 (November 2026)

---

## 風險矩陣總覽 (Risk Severity Matrix)

| 編號 | 風險維度 | 風險名稱 | 嚴重級別 | 落地防禦方案 (Status) |
| :--- | :--- | :--- | :--- | :--- |
| **R01** | 法律版權 | WebContainer / Nodebox 商業授權侵權與索賠風險 | **極高 (Critical)** | 採用自主虛擬文件系統 (VFS) + Babel Standalone 瀏覽器沙盒，零商業授權地雷 |
| **R02** | 地緣封鎖 | OpenAI / Bedrock Claude 對香港 IP 直接調用封鎖 | **極高 (Critical)** | 全面走 DeepSeek 香港邊緣直連 (12-20ms) + 硅基流動百煉 Qwen 備援容災 |
| **R03** | 網絡安全 | 沙盒終端被惡意利用為礦機、黑客掃描或提權 | **極高 (Critical)** | gVisor (`runsc:systrap`) 用戶態內核隔離 + 嚴格出網白名單與資源配額限制 |
| **R04** | 瀏覽器安全 | 沙盒 Iframe 腳本逃逸讀取父頁面 Cookie 與 DOM | **高 (High)** | Iframe 嚴格剔除 `allow-same-origin`，強制賦予 opaque `null` origin 隔離 + 嚴格 CSP |
| **R05** | 產品穩定性 | LLM 生成語法錯誤代碼導致預覽黑屏死鎖 | **高 (High)** | Iframe 看門狗捕獲異常透過 postMessage 回傳，一鍵觸發 AI 自癒修復 |
| **R06** | 商業財務 | 惡意用戶或機器人高頻刷會話擊穿 API Token 成本 | **中 (Medium)** | 每日會話配額制 (Free 15次/天, Pro 200次/天) + 60秒執行超時防護 |
| **R07** | 基礎設施 | Serverless 函數 10-15s 逾時強制截斷代碼串流 | **高 (High)** | 全面採用 Docker / VPS 原生 Node.js 串流部署於香港主機，消除時間限制 |
| **R08** | 法律合規 | 香港 PCPD 個人資料私隱審查及代碼數據洩露風險 | **中 (Medium)** | 啟用 Zero Data Retention 商業通道，在港公布標準《個人資料收集聲明 (PICS)》 |
| **R09** | 政策幻想 | 誤信「申請 TVP 科技券拿 75% 補貼」導致商業模式落空 | **極高 (Critical)** | 糾偏：特區政府已於 2024 年 12 月 31 日終止 TVP 新申請，全線改走純商業直銷 + FPS/Stripe |
| **R10** | 運營維護 | 單兵作戰遭遇代碼庫崩潰或數據丟失 | **中 (Medium)** | 前端客戶端 VFS 狀態管理 + 一鍵 ZIP 導出 + GitHub Actions 自動化 |

---

## 十大風險深度剖析與落地緩解措施 (Detailed Mitigations)

### R01. WebContainer / Nodebox 商業授權侵權與索賠風險 (Licensing Trap)
* **風險描述**：StackBlitz 官方明確規定 `@webcontainer/api` 僅可用於個人原型測試，在付費生產 SaaS 中使用必須獲取企業商業授權 [verified: StackBlitz ToS]。同時 CodeSandbox 對其 Nodebox 容器運行時設有商業限制。直接抄襲商業架構會收到侵權律師函。
* **緩解防禦方案**：
  1. 徹底解耦渲染引擎：自研 200 行現代 StreamingActionParser 有限狀態機，配合 in-browser Babel Standalone 與虛擬文件系統 (VFS) 作為 Tier 1 渲染引擎。
  2. 核心代碼 100% 自主研發，零外部專利授權費，免除 COOP/COEP 跨域阻斷問題。

### R02. OpenAI 及 Anthropic Claude 香港本地調用封鎖風險
* **風險描述**：OpenAI 官方將香港列為不支持地區，從香港 IP 直連 API 返回 403 阻斷；AWS Bedrock 的 Anthropic Claude 同樣動態校驗客戶端來源 IP，香港直連觸發 `ValidationException` [verified: OpenAI Terms & AWS Bedrock docs]。
* **緩解防禦方案**：
  1. 主力架構全面對接 DeepSeek 官方 API (`api.deepseek.com`)，香港直連延遲僅 12-20ms，原生支援香港特區商業合規 [verified: deepseek.com]。
  2. 備援線路走硅基流動 (SiliconFlow) / 阿里雲百煉託管之 Qwen2.5-Coder-32B，實現 100% 本地合法可訪問。

### R03. 後端沙盒終端被惡意利用為礦機、黑客掃描或提權
* **風險描述**：若提供後端終端執行能力，攻擊者可透過 `curl` 下載挖礦腳本或發起大規模 SYN Flood 攻擊，導致伺服器 IP 被 AWS/阿里雲封禁 [assumption]。
* **緩解防禦方案**：
  1. 內核虛擬化：透過 Google gVisor (`runsc`，使用現代預設 `--platform=systrap`，免除 `/dev/kvm` 需求)，在用戶空間攔截全部系統調用，阻斷內核提權 [verified: gVisor.dev]。
  2. 嚴格 cgroups v2 資源限制：單容器限制 CPU 0.5 核、記憶體 256MB、PID 上限 64、執行超時 15 秒強殺。
  3. Egress 出網白名單：僅放行特定公共 CDN 及 npm 鏡像 (registry.npmjs.org, unpkg.com, cdn.tailwindcss.com)，阻斷內網 RFC1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) 與雲端元數據服務 (169.254.169.254)。

#### R04. 沙盒 Iframe 腳本逃逸讀取父頁面 Cookie 與 DOM (XSS Escape & Storage Denied)
* **風險描述**：若 Iframe 的 sandbox 屬性同時包含 `allow-scripts` 與 `allow-same-origin`，生成的惡意代碼可透過 `window.parent.document` 竊取父頁面的 localStorage、Stripe 金鑰或竄改介面 [verified: MDN Web Docs]。同時，若剔除 `allow-same-origin`，瀏覽器會直接對 `localStorage` 拋出 `DOMException: Access is denied for this document`，導致生成之 React 組件白屏崩潰。
* **緩解防禦方案**：
  1. Iframe 嚴格配置 `sandbox="allow-scripts allow-modals allow-forms"`，**堅決剔除 `allow-same-origin`**。
  2. 瀏覽器自動將該 Iframe 標記為不透明的 `null` 來源 (`origin: "null"`)，任何跨域 DOM/Cookie 訪問均會被瀏覽器內核直接阻斷拋出 SecurityError。
  3. **內存存儲 Shim (Storage Shim)**：注入 `IN_MEMORY_STORAGE_SHIM`，主動探測存儲權限，在被沙盒阻斷時透明以內存 Map polyfill `Storage` 接口 (`getItem`, `setItem`, `removeItem`, `clear`, `length`)，防止應用崩潰。
  4. **PostMessage 來源校驗**：父頁面監聽器嚴格校驗 `event.source === iframeRef.current.contentWindow`，防止其他 null-origin 框架偽造報錯事件。
  5. 頁面注入嚴格的 Content-Security-Policy (CSP) meta 標籤。

### R05. LLM 生成語法錯誤代碼導致預覽黑屏死鎖
* **風險描述**：AI 偶爾會輸出缺失括號或未定義變量的代碼，導致 React 運行時報錯，預覽視窗白屏，用戶誤以為平台當機而流失 [assumption]。
* **緩解防禦方案**：
  1. 預覽 Iframe 內部注入全局異常攔截器：監聽 `window.onerror` 及 `window.onunhandledrejection`。
  2. 捕獲到報錯時透過 `postMessage` 向父頁面回傳，在預覽視窗上方展示防護 Banner：「⚠️ 報錯看門狗已觸發，點擊一鍵 AI 修復」。
  3. 點擊修復時自動將錯誤 Stack Trace 送回 LLM 進行自癒修復，預覽自動熱更新恢復。

### R06. 惡意用戶或爬蟲高頻刷會話擊穿 API Token 成本 (Financial Circuit Breaker)
* **風險描述**：羊毛黨或爬蟲透過無限制調用 API，在幾小時內耗盡創始人 API 賬戶餘額。T23 測算證實：若 100% 免費用戶達到 15 次/天上限，邊際貢獻將轉為負數 (-HK$0.50/用戶) [verified: scripts/cost_v2.js]。
* **緩解防禦方案**：
  1. **T15 成本熔斷護衛 (Cost Guard)**：
     - 單 IP 滑動窗口限流 (30 req / 10 分鐘)。
     - 輸入長度硬頂 (12,000 字符) 及輸出 `max_tokens` 限制 (4,096 tokens)。
     - 全局每日預算熔斷開關 ($0.50 USD 硬頂)，從 DeepSeek usage 字段累計消費，超額即刻阻斷上游調用返回 HTTP 503。
     - 邀請碼機制 (Invite Code Gate)：未獲授權之匿名流量無法調用真模型。
  2. Cloudflare 開啟 Bot Fight Mode 及香港邊緣 WAF 規則 [verified: Cloudflare docs]。

### R07. Serverless 雲函數 10-15s 執行逾時與靜態導出矛盾
* **風險描述**：早期筆記提及靜態導出 (`output: 'export'`)，但項目包含 `/api/chat` 與 `/api/sandbox` 動態路由，靜態導出無法編譯。若部署於免費 Serverless，10-15s 超時會截斷大模型代碼串流 [verified: T14 Audit & Vercel docs]。
* **緩解防禦方案**：
  1. **VPS 原生 Node.js 服務器運行 (`next start`)**：Next.js 構建保留動態 API 路由，運行於 AWS Lightsail HK VPS，消除任何執行時長限制。
  2. **上游雙路容災與超時競態 (T20)**：`Promise.race` 設置 15s 首字超時，主力 DeepSeek 遇 429/503 或卡流自動切換至硅基流動備援。

### R08. 香港 PCPD 個人資料私隱審查及代碼數據洩露風險
* **風險描述**：香港個人資料私隱專員公署 (PCPD) 於 2024 年發布了嚴格的生成式 AI 數據指引。若用戶代碼包含商業機密或個人數據，且被用於模型訓練，將面臨法律合規處罰 [verified: PCPD 2024 AI Guidelines]。
* **緩解防禦方案**：
  1. 採用企業級商業 API 通道，嚴格啟用 **Zero Data Retention** 條款（數據不參與任何第三方模型訓練）[verified: DeepSeek API Terms]。
  2. 上線標準《個人資料收集聲明 (PICS)》，明示數據僅在內存中做流式處理。
  3. 客戶端本地存儲敏感環境變量，不向雲端明文傳輸。

### R09. 誤信「申請 TVP 科技券拿 75% 補貼」導致商業模式落空
* **風險描述**：早期商業草案幻想依靠幫新客戶申請特區政府 TVP 科技券資助 75% 獲客，忽視了政策變更 [verified: ITC Public Notice]。
* **緩解防禦方案**：
  1. **事實糾偏**：創新科技署已於 2024 年 12 月 31 日正式停止接受 TVP 新申請。
  2. 商業模式全面轉向純市場化直銷：定價定位於平價 HK$ 68 / 月，極度親民；支援轉數快 (FPS) 零手續費季票 (HK$ 180 / 3 個月)，完全不依賴政府繁瑣審批。

### R10. 單兵作戰（Solo Founder）遭遇代碼庫崩潰或數據丟失
* **風險描述**：一人團隊精力有限，若本地開發機器硬盤損壞或伺服器宕機，缺乏團隊備份導致專案停擺 [assumption]。
* **緩解防禦方案**：
  1. 前端提供一鍵打包下載 ZIP 功能 (`handleDownloadZip`)，用戶與創始人可隨時導出完整代碼壓縮包。
  2. 配置自動化 Git 提交與版本快照，代碼變更遵循自動化循環流程記錄於 `loop/LOG.md` 與 `loop/STATE.md`。
