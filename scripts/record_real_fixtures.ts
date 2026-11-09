/**
 * scripts/record_real_fixtures.ts
 * Records raw LLM streams from real provider (capped at USD $0.50).
 * If no key is set in .env, marks BLOCKED [needs key] and generates realistic raw test fixtures.
 */

import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { performance } from 'node:perf_hooks';
import { SYSTEM_PROMPT } from '../app/src/lib/llm-provider';

const FIXTURES_REAL_DIR = path.resolve(__dirname, '../app/fixtures/real');
const FIXTURES_MOCK_DIR = path.resolve(__dirname, '../app/fixtures/mock');
const MAX_BUDGET_USD = 0.50;

function measureTcpConnectTime(host: string, port = 443): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = net.createConnection({ host, port }, () => {
      const tcpTime = performance.now() - start;
      socket.destroy();
      resolve(Math.round(tcpTime));
    });
    socket.on('error', () => {
      resolve(0);
    });
    socket.setTimeout(3000, () => {
      socket.destroy();
      resolve(0);
    });
  });
}

interface PromptFixtureDef {
  id: string;
  name: string;
  prompt: string;
  expectedFilesMin: number;
}

const FIXTURE_PROMPTS: PromptFixtureDef[] = [
  // 1-5: Standard Core Apps & 4+ file architectures
  {
    id: '01-todo-app',
    name: 'Todo App (Standard XML Blocks)',
    prompt: 'Build a complete todo list app in HTML, CSS, and JS with add, toggle, delete, and filter by status.',
    expectedFilesMin: 3,
  },
  {
    id: '02-calculator',
    name: 'Scientific Calculator',
    prompt: 'Build a scientific calculator in HTML/JS with standard arithmetic, square root, power, percentage, and clear.',
    expectedFilesMin: 2,
  },
  {
    id: '03-landing-page',
    name: 'Landing Page (Marketing)',
    prompt: 'Create a modern landing page for an AI developer platform with hero section, features grid, pricing table, and FAQ.',
    expectedFilesMin: 3,
  },
  {
    id: '04-react-component',
    name: 'React Temperature Converter',
    prompt: 'Create an interactive React component for temperature conversion between Celsius, Fahrenheit, and Kelvin.',
    expectedFilesMin: 2,
  },
  {
    id: '05-multi-file-analytics',
    name: 'Modular Analytics Dashboard (4+ files)',
    prompt: 'Create a modular web analytics dashboard with at least 4 files: index.html, styles.css, app.js, store.js, and charts.js.',
    expectedFilesMin: 4,
  },

  // 6-8: Edge cases (escaped tags, max_tokens, ambiguous)
  {
    id: '06-escaped-closing-tag',
    name: 'Escaped Action Tag Inside Code',
    prompt: 'Write a tutorial on writing parser regexes. Include a code sample in app.js that defines a string const closeTag = "</sandbox_action>"; and tests regex matching against it.',
    expectedFilesMin: 2,
  },
  {
    id: '07-max-tokens-limit',
    name: 'Large Enterprise CMS (Hits max_tokens)',
    prompt: 'Generate a massive full-stack enterprise CMS client with exhaustive multi-page router, 20 distinct data models, full CRUD tables, and comprehensive validation logic in a single comprehensive file tree.',
    expectedFilesMin: 5,
  },
  {
    id: '08-ambiguous-prompt',
    name: 'Ambiguous Short Prompt',
    prompt: 'make it look nice and fast',
    expectedFilesMin: 1,
  },

  // 9-14: Hong Kong Regional & Chinese Prompts
  {
    id: '09-chinese-mtr-calc',
    name: '繁體中文港鐵票價與行程查詢',
    prompt: '請用繁體中文編寫一個香港地鐵港鐵MTR票價查詢與行程時間預估工具，包含港島線與荃灣線主要站點。',
    expectedFilesMin: 3,
  },
  {
    id: '10-chinese-taxi-split',
    name: '繁體中文香港的士分賬計算器',
    prompt: '請編寫一個繁體中文香港的士收費分賬計算器，支援市區紅的、新界綠的跳錶計算、隧道費（西隧、紅隧、東隧）以及行李附加費，並計算每人均攤費用。',
    expectedFilesMin: 3,
  },
  {
    id: '11-chinese-mpf-calc',
    name: '繁體中文強積金MPF供款估算器',
    prompt: '請編寫香港僱員強積金（MPF）強制性供款與自願性供款計算機，依據最新法定供款上限與豁免下限精算每月僱主與僱員扣款。',
    expectedFilesMin: 2,
  },
  {
    id: '12-chinese-salary-tax',
    name: '繁體中文香港薪俸稅累進稅率計算器',
    prompt: '請用繁體中文製作香港薪俸稅累進稅階（2%到17%）與標準稅率對比計算器，包含基本免稅額、強積金扣除及已婚人士免稅額。',
    expectedFilesMin: 3,
  },
  {
    id: '13-markdown-editor',
    name: 'Markdown Split-Screen Editor',
    prompt: 'Build a split-screen markdown editor with live HTML preview, word count, and copy markdown button.',
    expectedFilesMin: 2,
  },
  {
    id: '14-weather-widget',
    name: 'HK Observatory Weather Forecast Widget',
    prompt: 'Build a simulated live Hong Kong weather forecast widget with 9-day forecast, typhoon signal warnings, and humidity icons.',
    expectedFilesMin: 2,
  },

  // 15-25: Multi-file apps & Interactive Tools
  {
    id: '15-kanban-board',
    name: 'Drag-and-Drop Kanban Board (3+ files)',
    prompt: 'Build a drag-and-drop Kanban task board with 3 columns: Todo, In Progress, Done, with add and move task capabilities in index.html, kanban.css, kanban.js.',
    expectedFilesMin: 3,
  },
  {
    id: '16-multi-file-ecommerce',
    name: 'Mini E-commerce Storefront (4+ files)',
    prompt: 'Create a mini e-commerce storefront with index.html, styles.css, products.js, cart.js, and checkout.js featuring cart total and modal checkout.',
    expectedFilesMin: 4,
  },
  {
    id: '17-multi-file-chat-ui',
    name: 'Team Chat Application UI (4+ files)',
    prompt: 'Build a multi-channel Slack-like chat interface with index.html, chat.css, channels.js, messages.js, and avatars.js.',
    expectedFilesMin: 4,
  },
  {
    id: '18-multi-file-crypto-ticker',
    name: 'Crypto Ticker & Order Book (4+ files)',
    prompt: 'Build a simulated crypto exchange dashboard with index.html, ticker.css, prices.js, orderbook.js, and charts.js.',
    expectedFilesMin: 4,
  },
  {
    id: '19-svg-icon-generator',
    name: 'SVG Icon & Shape Generator',
    prompt: 'Create a dynamic SVG icon maker where users adjust path curvature, stroke width, fill gradient, and export clean SVG code.',
    expectedFilesMin: 2,
  },
  {
    id: '20-web-audio-synth',
    name: 'Web Audio Synthesizer',
    prompt: 'Create a playable synthesizer in HTML/JS using Web Audio API with sine/sawtooth oscillators, envelope ADSR, and musical keyboard keys.',
    expectedFilesMin: 2,
  },
  {
    id: '21-regex-tester',
    name: 'Interactive Regex Matcher & Explainer',
    prompt: 'Build a real-time regex testing tool with match highlight in text, regex flag toggles (g, i, m), and match group breakdown.',
    expectedFilesMin: 2,
  },
  {
    id: '22-pomodoro-timer',
    name: 'Pomodoro Productivity Timer',
    prompt: 'Build a Pomodoro timer with 25m work / 5m break cycles, progress ring animation, session counter, and audio beep.',
    expectedFilesMin: 2,
  },
  {
    id: '23-quiz-trivia-game',
    name: 'Interactive Trivia Quiz Game',
    prompt: 'Build a 5-question coding quiz with score progress bar, timer per question, explanation on answer, and final leaderboard.',
    expectedFilesMin: 2,
  },
  {
    id: '24-color-palette-tool',
    name: 'Color Palette Generator & Contrast Checker',
    prompt: 'Create a color scheme generator that checks WCAG AA/AAA contrast ratios against white/black text and exports CSS variables.',
    expectedFilesMin: 2,
  },
  {
    id: '25-json-tree-viewer',
    name: 'Interactive JSON Tree Inspector',
    prompt: 'Build a JSON tree visualizer with collapsible keys, search filter, type badges (string, number, array, boolean), and copy path.',
    expectedFilesMin: 2,
  },

  // 26-30: 5 Follow-Up Edit Turns (Testing multi-turn patch engine)
  {
    id: '26-edit-turn-1',
    name: 'Follow-Up Edit 1: Blue Add Button',
    prompt: 'Please modify the Todo App (from #01) using a patch: change the Add Button background color to royal blue (#2563eb) and add hover effect.',
    expectedFilesMin: 1,
  },
  {
    id: '27-edit-turn-2',
    name: 'Follow-Up Edit 2: Clear Completed Button',
    prompt: 'Please patch index.html and app.js to add a "Clear Completed" button that removes all items marked as done.',
    expectedFilesMin: 2,
  },
  {
    id: '28-edit-turn-3',
    name: 'Follow-Up Edit 3: Priority Badges',
    prompt: 'Please patch app.js and styles.css to let users assign High / Medium / Low priority to each task with color-coded badges.',
    expectedFilesMin: 2,
  },
  {
    id: '29-edit-turn-4',
    name: 'Follow-Up Edit 4: LocalStorage Persistence',
    prompt: 'Please patch app.js to automatically save tasks to localStorage and reload them on initialization.',
    expectedFilesMin: 1,
  },
  {
    id: '30-edit-turn-5',
    name: 'Follow-Up Edit 5: Dark Mode Theme Switcher',
    prompt: 'Please patch styles.css and index.html to add a Dark Mode toggle button that flips the entire UI between light and dark palette.',
    expectedFilesMin: 2,
  },
];

async function main() {
  console.log('================================================================');
  console.log(' T16: Real Model Fixture Recorder & Live Runner');
  console.log(` Budget Cap: USD $${MAX_BUDGET_USD.toFixed(2)}`);
  console.log('================================================================\n');

    if (!fs.existsSync(FIXTURES_REAL_DIR)) {
      fs.mkdirSync(FIXTURES_REAL_DIR, { recursive: true });
    }

    // Load .env from workspace root or app/.env if present
    for (const envCandidate of [
      path.resolve(__dirname, '../.env'),
      path.resolve(__dirname, '../app/.env'),
    ]) {
      if (fs.existsSync(envCandidate)) {
        const lines = fs.readFileSync(envCandidate, 'utf-8').split(/\r?\n/);
        for (const line of lines) {
          const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
          if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
          }
        }
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const apiKey = geminiKey || process.env.DEEPSEEK_API_KEY || process.env.SILICONFLOW_API_KEY;
    const isReal = !!apiKey && apiKey.trim().length > 0;

    if (!isReal) {
      console.warn('⚠️  [BLOCKED: needs key] No GEMINI_API_KEY, DEEPSEEK_API_KEY, or SILICONFLOW_API_KEY found in .env or environment.');
      console.warn('   Per task instruction: Marking real-API parts BLOCKED [needs key].');
      console.warn('   Generating canonical mock LLM stream fixtures into /app/fixtures/mock/ for parser audit...\n');

      generateRepresentativeFixtures();
      return;
    }

    // Live execution against real provider with strict $0.50 budget cap
    let totalSpentUSD = 0;
    const isGemini = !!geminiKey && geminiKey.trim().length > 0;
    console.log(`✓ Active API Key found (${isGemini ? 'Google Gemini 3.8 Flash' : 'DeepSeek'}). Connecting to live provider...`);

    for (const item of FIXTURE_PROMPTS) {
      if (totalSpentUSD >= MAX_BUDGET_USD) {
        console.warn(`🛑 Hard budget cap of $${MAX_BUDGET_USD} reached ($${totalSpentUSD.toFixed(4)} spent). Aborting further calls.`);
        break;
      }

      console.log(`\nRecording prompt [${item.id}] ${item.name}...`);
      
      // Measure separate TCP connect time to upstream API
      const tcpHost = isGemini ? 'generativelanguage.googleapis.com' : 'api.deepseek.com';
      const tcpConnectMs = await measureTcpConnectTime(tcpHost, 443);

      let promptContent = item.prompt;
      // For edit turns 26-30, supply the initial Todo app code context so model can produce valid search/replace patches
      if (item.id.startsWith('26') || item.id.startsWith('27') || item.id.startsWith('28') || item.id.startsWith('29') || item.id.startsWith('30')) {
        const mockTodoPath = path.join(FIXTURES_MOCK_DIR, '01-todo-app.raw.txt');
        if (fs.existsSync(mockTodoPath)) {
          const baseAppCode = fs.readFileSync(mockTodoPath, 'utf-8');
          promptContent = `${item.prompt}\n\n[Existing Application Context for Patching]:\n${baseAppCode}`;
        }
      }

      const startTime = performance.now();
      let ttft = 0;
      let rawStream = '';
      let usage: any = null;
      let sseRequestId = '';
      let responseModel = isGemini ? 'gemini-3.8-flash' : 'deepseek-chat';

      try {
        if (isGemini) {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey: geminiKey });
          const geminiStream = await ai.interactions.create({
            model: 'gemini-3.8-flash',
            input: promptContent,
            system_instruction: SYSTEM_PROMPT,
            store: false,
            stream: true,
            generation_config: {
              max_output_tokens: 4096,
            },
          });
          let firstTokenReceived = false;
          for await (const event of geminiStream) {
            if (event.event_type === 'step.delta' && event.delta?.type === 'text' && event.delta.text) {
              if (!firstTokenReceived) {
                ttft = performance.now() - startTime;
                firstTokenReceived = true;
              }
              const chunkJson = JSON.stringify({
                id: sseRequestId || 'gemini-chunk',
                model: 'gemini-3.8-flash',
                choices: [{ delta: { content: event.delta.text } }],
              });
              rawStream += `data: ${chunkJson}\n\n`;
            } else if (event.event_type === 'interaction.completed') {
              sseRequestId = event.interaction?.id || `gemini_${Date.now()}`;
              const u = event.interaction?.usage;
              usage = {
                prompt_tokens: u?.total_input_tokens || 0,
                completion_tokens: u?.total_output_tokens || 0,
                total_tokens: u?.total_tokens || 0,
              };
            }
          }
          rawStream += 'data: [DONE]\n\n';
        } else {
          const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: 'deepseek-chat',
              stream: true,
              stream_options: { include_usage: true },
              max_tokens: 4096,
              messages: [
                {
                  role: 'system',
                  content: SYSTEM_PROMPT,
                },
                { role: 'user', content: promptContent },
              ],
            }),
          });

          if (!response.ok || !response.body) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const headerRequestId = response.headers.get('x-request-id');
          if (headerRequestId) sseRequestId = headerRequestId;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let firstTokenReceived = false;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunkText = decoder.decode(value, { stream: true });
            if (!firstTokenReceived && chunkText.includes('content')) {
              ttft = performance.now() - startTime;
              firstTokenReceived = true;
            }

            rawStream += chunkText;

            // Parse usage, id, and model from response chunks
            const lines = chunkText.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const p = JSON.parse(line.slice(6));
                  if (p.id) sseRequestId = p.id;
                  if (p.model) responseModel = p.model;
                  if (p.usage) usage = p.usage;
                } catch {}
              }
            }
          }
        }

        const totalTime = performance.now() - startTime;

        // Calculate cost using conservative $0.30/1M input and $1.20/1M output cap
        let costThisCall = 0;
        if (usage) {
          costThisCall =
            (usage.prompt_tokens * 0.30 + usage.completion_tokens * 1.20) / 1_000_000;
          totalSpentUSD += costThisCall;
        }

        const finalRequestId = sseRequestId || `req_${Date.now()}`;
        const rawPath = path.join(FIXTURES_REAL_DIR, `${item.id}.raw.txt`);
        const metaPath = path.join(FIXTURES_REAL_DIR, `${item.id}.meta.json`);

        fs.writeFileSync(rawPath, rawStream, 'utf-8');
        fs.writeFileSync(
          metaPath,
          JSON.stringify(
            {
              id: item.id,
              name: item.name,
              provider: isGemini ? 'gemini' : 'deepseek',
              model: responseModel,
              requestId: finalRequestId,
              timestamp: new Date().toISOString(),
              tcpConnectMs,
              ttftMs: Math.round(ttft),
              totalTimeMs: Math.round(totalTime),
              usage: usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
              costUSD: costThisCall,
              cumulativeSpendUSD: totalSpentUSD,
            },
            null,
            2
          ),
          'utf-8'
        );

        console.log(`  ✓ Saved: ${rawPath}`);
        console.log(`  ⏱ TCP Connect: ${tcpConnectMs}ms | TTFT: ${Math.round(ttft)}ms | Total: ${Math.round(totalTime)}ms | Spend: $${costThisCall.toFixed(6)}`);
      } catch (err: any) {
        console.error(`  ❌ Failed to record ${item.id}:`, err.message);
      }
    }
}

/**
 * Generates realistic raw stream fixtures reflecting real LLM outputs:
 * Includes markdown wrappers, prose outside tags, closing tag collisions, unclosed tags, and windows paths.
 */
function generateRepresentativeFixtures() {
  const sampleData: Array<{
    id: string;
    name: string;
    ttftMs: number;
    totalTimeMs: number;
    promptTokens: number;
    completionTokens: number;
    rawContent: string;
  }> = [
    {
      id: '01-todo-app',
      name: 'Todo App (Standard XML Blocks)',
      ttftMs: 642,
      totalTimeMs: 4210,
      promptTokens: 1120,
      completionTokens: 1850,
      rawContent: `好的！這是一個完整的待辦事項應用程式。

<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html>
<head><title>Todo App</title><link rel="stylesheet" href="styles.css"></head>
<body>
  <div id="app">
    <h1>香港 Todo List</h1>
    <input id="new-todo" placeholder="新增待辦...">
    <ul id="list"></ul>
  </div>
  <script src="app.js"></script>
</body>
</html>
</sandbox_action>

<sandbox_action type="file" path="styles.css">
body { font-family: system-ui, sans-serif; background: #0f172a; color: white; padding: 20px; }
.done { text-decoration: line-through; opacity: 0.6; }
</sandbox_action>

<sandbox_action type="file" path="app.js">
const list = document.getElementById('list');
console.log("Loaded todo app");
</sandbox_action>
`,
    },
    {
      id: '02-calculator',
      name: 'Scientific Calculator (Prose outside blocks)',
      ttftMs: 580,
      totalTimeMs: 3890,
      promptTokens: 980,
      completionTokens: 1420,
      rawContent: `Here is the scientific calculator you requested with all math operations:

<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html>
<body><div id="calc"><h3>計算機</h3></div><script src="calc.js"></script></body>
</html>
</sandbox_action>

<sandbox_action type="file" path="calc.js">
function calculate(op, a, b) {
  if (op === 'sqrt') return Math.sqrt(a);
  return a + b;
}
</sandbox_action>

Hope you like it! Let me know if you want memory buttons.
`,
    },
    {
      id: '03-landing-page',
      name: 'Landing Page (Markdown code fence wrapping)',
      ttftMs: 720,
      totalTimeMs: 5120,
      promptTokens: 1350,
      completionTokens: 2100,
      rawContent: `\`\`\`xml
<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html>
<head><title>AI Platform</title></head>
<body><header><h1>Next Gen AI Agent</h1></header></body>
</html>
</sandbox_action>

<sandbox_action type="file" path="styles.css">
header { padding: 40px; text-align: center; }
</sandbox_action>
\`\`\`
`,
    },
    {
      id: '04-react-component',
      name: 'React Temperature Converter (Script tag in JS)',
      ttftMs: 610,
      totalTimeMs: 3400,
      promptTokens: 1050,
      completionTokens: 1280,
      rawContent: `<sandbox_action type="file" path="TemperatureConverter.tsx">
import React, { useState } from 'react';

export default function TemperatureConverter() {
  const [celsius, setCelsius] = useState(25);
  // Note: testing edge case where JS contains closing tag in string
  const debugTag = "</script>";
  return (
    <div className="p-4 bg-slate-800 text-white rounded">
      <h3>溫度轉換器 (HK Weather)</h3>
      <input type="number" value={celsius} onChange={(e) => setCelsius(Number(e.target.value))} />
      <p>華氏度: {(celsius * 9/5 + 32).toFixed(1)} °F</p>
    </div>
  );
}
</sandbox_action>
`,
    },
    {
      id: '05-multi-file-4plus',
      name: 'Modular Dashboard (5 files, nested folders)',
      ttftMs: 890,
      totalTimeMs: 6200,
      promptTokens: 1600,
      completionTokens: 2950,
      rawContent: `<sandbox_action type="file" path="index.html">
<html><body><div id="root"></div><script src="src/app.js"></script></body></html>
</sandbox_action>

<sandbox_action type="file" path="src/styles.css">
.card { border: 1px solid #334155; padding: 12px; }
</sandbox_action>

<sandbox_action type="file" path="src/store.js">
export const store = { data: [10, 20, 30] };
</sandbox_action>

<sandbox_action type="file" path="src/charts.js">
export function renderChart() { return "chart rendered"; }
</sandbox_action>

<sandbox_action type="file" path="src/app.js">
import { store } from './store.js';
console.log("App ready", store);
</sandbox_action>
`,
    },
    {
      id: '06-ambiguous-prompt',
      name: 'Ambiguous Short Prompt (Minimal response)',
      ttftMs: 510,
      totalTimeMs: 1980,
      promptTokens: 750,
      completionTokens: 620,
      rawContent: `為您建立極簡高流暢頁面：

<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html><body style="background:#0b0f19;color:#38bdf8;font-family:sans-serif;display:grid;place-content:center;height:100vh;">
  <h1>✨ 極致速度與現代美學</h1>
</body></html>
</sandbox_action>
`,
    },
    {
      id: '07-chinese-prompt',
      name: 'Chinese MTR Calculator (Unicode & Windows path edge case)',
      ttftMs: 780,
      totalTimeMs: 4600,
      promptTokens: 1280,
      completionTokens: 1900,
      rawContent: `已為您生成香港地鐵港鐵 (MTR) 票價與時間計算器：

<sandbox_action type="file" path="mtr\\data\\stations.json">
{
  "stations": ["中環", "金鐘", "尖沙咀", "旺角", "銅鑼灣"]
}
</sandbox_action>

<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>港鐵票價查詢</title></head>
<body>
  <h2>港鐵 (MTR) 票價與行程時間估算</h2>
  <div id="mtr-app"></div>
  <script src="mtr.js"></script>
</body>
</html>
</sandbox_action>

<sandbox_action type="file" path="mtr.js">
const fares = { "中環-尖沙咀": 11.2, "金鐘-銅鑼灣": 6.3 };
console.log("MTR Calculator Ready");
</sandbox_action>
`,
    },
    {
      id: '08-markdown-editor',
      name: 'Markdown Editor (Markdown code block containing tag-like tokens)',
      ttftMs: 650,
      totalTimeMs: 3950,
      promptTokens: 1100,
      completionTokens: 1540,
      rawContent: `<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html>
<body>
  <textarea id="editor"># 歡迎使用 Markdown 編輯器\n\n輸入 <tag> 不會干擾解析器。</textarea>
  <div id="preview"></div>
  <script src="editor.js"></script>
</body>
</html>
</sandbox_action>

<sandbox_action type="file" path="editor.js">
const editor = document.getElementById('editor');
editor.addEventListener('input', () => {
  document.getElementById('preview').innerText = editor.value;
});
</sandbox_action>
`,
    },
    {
      id: '09-weather-widget',
      name: 'Weather Forecast (Truncated stream without closing tag)',
      ttftMs: 690,
      totalTimeMs: 3100,
      promptTokens: 1020,
      completionTokens: 1100,
      // Truncated on purpose to simulate real LLM token cut-off / abort
      rawContent: `<sandbox_action type="file" path="index.html">
<!DOCTYPE html>
<html>
<head><title>香港天文台天氣</title></head>
<body>
  <div class="weather-box">
    <h3>香港當前氣溫: 24°C</h3>
    <p>濕度: 75% | 天氣: 多雲</p>
  </div>
</body>
</html>
</sandbox_action>

<sandbox_action type="file" path="weather.js">
console.log("Fetching HKO API...");
const simulatedTemp = 24;
// Stream abruptly cut off here before </sandbox_action>`,
    },
    {
      id: '10-kanban-board',
      name: 'Kanban Board (Multiple attributes with irregular whitespace)',
      ttftMs: 740,
      totalTimeMs: 4800,
      promptTokens: 1400,
      completionTokens: 2200,
      rawContent: `<sandbox_action  type = "file"   path = "index.html" >
<!DOCTYPE html>
<html>
<head><title>Kanban</title><link rel="stylesheet" href="kanban.css"></head>
<body>
  <div class="board">
    <div class="col" id="todo"><h3>待辦</h3></div>
    <div class="col" id="doing"><h3>進行中</h3></div>
    <div class="col" id="done"><h3>已完成</h3></div>
  </div>
  <script src="kanban.js"></script>
</body>
</html>
</sandbox_action>

<sandbox_action type="file" path="kanban.css">
.board { display: flex; gap: 16px; }
.col { flex: 1; background: #1e293b; padding: 12px; border-radius: 8px; }
</sandbox_action>

<sandbox_action type="file" path="kanban.js">
console.log("Kanban loaded");
</sandbox_action>
`,
    },
  ];

  if (!fs.existsSync(FIXTURES_MOCK_DIR)) {
    fs.mkdirSync(FIXTURES_MOCK_DIR, { recursive: true });
  }

  for (const item of sampleData) {
    const rawPath = path.join(FIXTURES_MOCK_DIR, `${item.id}.raw.txt`);
    const metaPath = path.join(FIXTURES_MOCK_DIR, `${item.id}.meta.json`);

    fs.writeFileSync(rawPath, item.rawContent, 'utf-8');

    const costUSD =
      (item.promptTokens * 0.30 + item.completionTokens * 1.20) / 1_000_000;

    fs.writeFileSync(
      metaPath,
      JSON.stringify(
        {
          id: item.id,
          name: item.name,
          ttftMs: item.ttftMs,
          totalTimeMs: item.totalTimeMs,
          usage: {
            prompt_tokens: item.promptTokens,
            completion_tokens: item.completionTokens,
            total_tokens: item.promptTokens + item.completionTokens,
          },
          costUSD,
          note: 'Representative mock LLM fixture with synthetic failure patterns',
        },
        null,
        2
      ),
      'utf-8'
    );

    console.log(`✓ Fixture generated: ${item.id} (${item.name}) - TTFT: ${item.ttftMs}ms, Cost: $${costUSD.toFixed(6)}`);
  }

  console.log('\n✅ 10 representative fixtures generated in /app/fixtures/mock/.');
}

main().catch((err) => {
  console.error('Fatal in record_real_fixtures:', err);
  process.exit(1);
});
