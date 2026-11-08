# HK AI Agent Workspace (香港在線 AI 智能體代碼工作台)

> 類 Bolt.new / Claude Artifacts / Replit Agent 的現代化在線 AI Agent 工作台。  
> 專為香港本地開發者與中小企打造：直連 DeepSeek 香港邊緣節點（<15ms 延遲）、雙路容災（DeepSeek + SiliconFlow）、雙軌安全沙盒隔離、Monaco 編輯器流式熱重載、即時預覽與報錯自癒看門狗。

---

## 快速開始 (Quick Start)

### 1. 一鍵安裝與本地啟動
```bash
# 進入 app 目錄
cd app

# 安裝相依套件
npm install

# 啟動開發伺服器
npm run dev
```
瀏覽器訪問 **`http://localhost:3000`** 即可立即使用！

### 2. 核心功能驗收 (Definition of Done)
1. 在左側對話框輸入：`build me a todo app`（或直接點擊「📋 build me a todo app」快捷按鈕）。
2. **觀察效果**：
   - AI 在 500ms 內以打字機流式寫入多個檔案（`package.json`, `styles.css`, `app.js`, `index.html`）。
   - 中間 Monaco 編輯器自動開闢標籤頁並語法高亮展示代碼。
   - 左側檔案樹即時更新檔案結構。
   - 右側安全沙盒在 1 秒內即時渲染可互動的 Todo 應用（支援新增、切換完成、篩選與本地保存）。
   - 下方終端日誌即時顯示 gVisor 沙盒容器模擬執行日誌。
   - 點擊「下載 ZIP」可一鍵導出標準專案包。
3. 點擊「🚕 的士分賬器」快捷按鈕，即時流式生成香港市區紅的車費分賬計算器（含起步價 HK$29、過海隧道費與行李附加費）。

### 3. 運行單元與整合測試
```bash
npm test
```
**真實測試覆蓋項目 (21 項完整通過)**：
- `StreamingActionParser`: 單包流式解析、跨封包邊界拆分標籤解析、超長檔案路徑拆分解析、JSX 標籤與 `<` 符號防誤扣、流式中斷 buffer 自動沖刷、容錯式結尾標籤 (`</sandbox_action >`)、容器標籤 (`<boltArtifact>`) 過濾防洩漏、路徑前綴標準化、多檔案連續解析、指令標籤解析、BoltAction 相容解析。
- `VFS`: 相對路徑標準化 (`normalizePath`)、多語言語法高亮識別、巢狀目錄樹層級建構（防 `.` 目錄生成）。
- `LivePreview`: `$` 符號程式碼防正則替換損壞 (`safeReplace`)、特殊字符正則轉義 (`escapeRegExp`)、React / JSX / TSX 支援。
- `E2E`: 根路由 HTTP 200、空訊息 400 驗證、Todo App SSE 串流注入、香港的士分賬器模板觸發、gVisor 沙盒合法指令執行、破壞性指令 (rm -rf /) 安全阻斷。

---

## 環境變數配置 (可選)

本項目已內建**香港高保真流式生成引擎**，在未設定任何 API Key 的情況下即可離線流暢體驗完整的 TodoList 與的士分賬器生成流程。

如需連線真實生產級大模型，在 `app` 目錄下建立 `.env.local`：
```env
# 主力通道：DeepSeek 官方 API (香港直連節點 <15ms)
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# 備援通道：硅基流動 SiliconFlow API (自動故障轉移)
SILICONFLOW_API_KEY=your_siliconflow_api_key_here
```

---

## 生產構建與部署 (Production Deployment)

### 本地構建
```bash
npm run build
npm run start
```

### 香港 VPS 一鍵部署 (Docker + gVisor + Caddy)
在香港雲主機（Ubuntu 22.04 / 24.04）上執行：
```bash
sudo bash ../infra/setup.sh your-domain.hk
```
腳本將全自動配置：
1. **Docker Engine + Google gVisor (`runsc`)**：以 `--platform=ptrace` 模式運行，在常規平價 VPS 核心上實現硬體級系統調用隔離。
2. **Caddy 反向代理**：自動配置 Let's Encrypt 免費 SSL 證書，配置 `flush_interval -1` 保證 SSE 零延遲流式傳輸，並排除 `text/event-stream` 壓縮。
3. **UFW 防火牆**：嚴格限制入網與出網白名單，阻斷黑客挖礦與惡意掃描。

---

## 專案核心架構

```
app/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts      # SSE 雙路容災串流後端 (DeepSeek + SiliconFlow)
│   │   │   └── sandbox/route.ts   # gVisor 容器沙盒執行與安全過濾端點
│   │   ├── globals.css            # 深色 IDE 主題與捲動軸樣式
│   │   ├── layout.tsx             # 根佈局
│   │   └── page.tsx               # 核心三欄 IDE 頁面
│   ├── components/
│   │   ├── ChatPanel.tsx          # 對話面板與狀態監控
│   │   ├── Editor.tsx             # Monaco 編輯器多標籤封裝
│   │   ├── FileTree.tsx           # 虛擬檔案樹導航
│   │   ├── LivePreview.tsx        # 沙盒 Iframe 預覽與報錯看門狗 (Watchdog)
│   │   └── Terminal.tsx           # 沙盒終端與執行日誌
│   ├── lib/
│   │   ├── streaming-parser.ts    # 流式有限狀態機標籤解析器
│   │   ├── vfs.ts                 # 虛擬檔案系統與語言識別
│   │   └── templates.ts           # 演示模板與離線備援 (含 Todo 與香港的士分賬器)
│   └── __tests__/                 # 自動化測試套件 (21 個測試案例)
├── package.json
└── tsconfig.json
```
