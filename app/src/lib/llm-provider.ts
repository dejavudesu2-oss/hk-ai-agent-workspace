import { getMatchingTemplate } from './templates';
import {
  isBudgetExhausted,
  recordSpendUSD,
  DEFAULT_CONFIG,
} from './cost-guard';

export interface ChatOptions {
  maxTokens?: number;
  files?: Record<string, { path: string; content: string }>;
  noMockFallback?: boolean;
}

export interface LLMProvider {
  name: string;
  streamChat(message: string, options?: ChatOptions): Promise<Response>;
}

export const SYSTEM_PROMPT = `
You are the HK AI Agent Workspace Lead Coder.
Your task is to write real, runnable, production-quality code based on user requests.

CRITICAL FORMATTING & SYNTAX RULES:
1. CREATING OR OVERWRITING FULL FILES:
<sandbox_action type="file" path="relative/path/to/file.ext">
...file content here...
</sandbox_action>

2. EDITING EXISTING FILES (SEARCH/REPLACE PATCH ACTION):
When modifying an existing file with targeted edits, use a search/replace patch action:
<sandbox_action type="patch" path="relative/path/to/file.ext">
<search>
...exact existing code to replace (must match uniquely in the file)...
</search>
<replace>
...new replacement code...
</replace>
</sandbox_action>
RULES FOR PATCHES:
- The <search> text MUST match exactly one location in the file.
- If multiple sections change, use separate <sandbox_action type="patch"> blocks.

3. EXECUTING COMMANDS:
<sandbox_action type="command">
npm install
</sandbox_action>

4. FILE PATHS MUST BE CLEAN & RELATIVE:
   - Always use forward slashes (e.g., "src/components/App.tsx", "index.html").
   - NEVER use Windows drive letters ("C:\\...") or Unix root paths ("/app/...").
   - NEVER use parent directory traversal ("../").

5. ESCAPING CLOSING TAGS:
   - If code, documentation, or HTML contains literal "</sandbox_action>", escape the slash as "<\\/sandbox_action>".
   - In HTML <script> blocks, escape closing script tags as "<\\/script>".

6. NO MARKDOWN FENCES AROUND ACTION TAGS:
   - Output <sandbox_action> tags directly as raw text. Do NOT wrap them in \`\`\`xml or \`\`\` blocks.

Write complete, functional files without placeholders or truncation. Provide concise, helpful explanations in Traditional Chinese (繁體中文).
`;

/**
 * Mock LLM Provider
 * Streams realistic SSE tokens at 60-70 tokens/sec cadence with complete runnable code templates.
 * Zero external network calls, zero API token cost.
 */
export class MockLLMProvider implements LLMProvider {
  name = 'Mock LLM Provider (Offline Simulator)';

  async streamChat(message: string, options?: ChatOptions): Promise<Response> {
    const template = getMatchingTemplate(message);
    const encoder = new TextEncoder();

    const parts: string[] = [
      `好的！我正在為您構建【${template.description}】。\n正在初始化香港本地安全沙盒環境並流式編寫代碼...\n\n`,
    ];

    for (const file of template.files) {
      parts.push(`<sandbox_action type="file" path="${file.path}">\n${file.content}\n</sandbox_action>\n\n`);
    }

    if (template.patches && template.patches.length > 0) {
      for (const patch of template.patches) {
        parts.push(
          `<sandbox_action type="patch" path="${patch.path}">\n<search>\n${patch.search}\n</search>\n<replace>\n${patch.replace}\n</replace>\n</sandbox_action>\n\n`
        );
      }
    }

    if (template.command) {
      parts.push(`<sandbox_action type="command">\n${template.command}\n</sandbox_action>\n\n`);
    }

    parts.push(`🎉 項目構建完成！代碼已即時寫入中間 Monaco 編輯器，右側沙盒預覽已即時熱更新。您可以直接在預覽中新增與切換待辦事項。`);

    const fullText = parts.join('');
    const chunkSize = 28;
    const chunks: string[] = [];

    for (let i = 0; i < fullText.length; i += chunkSize) {
      chunks.push(fullText.substring(i, i + chunkSize));
    }

    let index = 0;
    const stream = new ReadableStream({
      async pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        const chunk = chunks[index++];
        controller.enqueue(encoder.encode(chunk));
        // 10ms typing cadence for smooth 60fps streaming
        await new Promise((res) => setTimeout(res, 10));
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-LLM-Provider': 'Mock LLM Provider (Offline Simulator)',
      },
    });
  }
}

export interface UpstreamConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchFn?: (url: string, init?: any) => Promise<Response>;
  timeoutMs?: number;
}

/**
 * Real LLM Provider Adapter
 * Connects to live upstream APIs with dual-failover (Primary: DeepSeek HK edge, Secondary: SiliconFlow Qwen).
 */
export class RealLLMProvider implements LLMProvider {
  name = 'Real Multi-Provider LLM (DeepSeek / SiliconFlow)';
  private deepseekKey?: string;
  private siliconflowKey?: string;
  private customUpstreams?: UpstreamConfig[];
  private fallbackMock = new MockLLMProvider();

  constructor(deepseekKey?: string, siliconflowKey?: string, customUpstreams?: UpstreamConfig[]) {
    this.deepseekKey = deepseekKey || process.env.DEEPSEEK_API_KEY;
    this.siliconflowKey = siliconflowKey || process.env.SILICONFLOW_API_KEY;
    this.customUpstreams = customUpstreams;
  }

  async streamChat(message: string, options?: ChatOptions): Promise<Response> {
    if (isBudgetExhausted()) {
      throw new Error('Daily API budget limit ($0.50 USD) exhausted or kill switch active. Upstream call blocked.');
    }

    const upstreams: UpstreamConfig[] = this.customUpstreams
      ? [...this.customUpstreams]
      : [];

    if (!this.customUpstreams) {
      if (this.deepseekKey) {
        upstreams.push({
          name: 'DeepSeek (Primary HK Edge)',
          baseUrl: 'https://api.deepseek.com',
          apiKey: this.deepseekKey,
          model: 'deepseek-chat',
        });
      }

      if (this.siliconflowKey) {
        upstreams.push({
          name: 'SiliconFlow (Backup Failover)',
          baseUrl: 'https://api.siliconflow.cn/v1',
          apiKey: this.siliconflowKey,
          model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
        });
      }
    }

    if (upstreams.length === 0) {
      console.warn('RealLLMProvider requested but no API keys configured. Falling back to Mock.');
      return this.fallbackMock.streamChat(message, options);
    }

    let lastError: Error | null = null;
    const maxTokens = Math.min(options?.maxTokens || DEFAULT_CONFIG.maxTokensCap, DEFAULT_CONFIG.maxTokensCap);

    let promptContent = message;
    if (options?.files && Object.keys(options.files).length > 0) {
      const fileTree = Object.keys(options.files).map((p) => `  - ${p}`).join('\n');
      const fileContext = Object.entries(options.files)
        .map(([p, f]) => `--- File: ${p} ---\n${f.content}`)
        .join('\n\n');
      promptContent = `${message}\n\n[Workspace File Tree]:\n${fileTree}\n\n[Existing File Contents]:\n${fileContext}`;
    }

    const fetchUpstream = async (upstream: UpstreamConfig): Promise<Response> => {
      const fetchFn = upstream.fetchFn || fetch;
      const abortCtrl = new AbortController();
      const timeoutMs = upstream.timeoutMs || 15000;

      let timerId: any;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => {
          abortCtrl.abort();
          reject(new Error(`Upstream ${upstream.name} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      try {
        return await Promise.race([
          fetchFn(`${upstream.baseUrl}/chat/completions`, {
            method: 'POST',
            signal: abortCtrl.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${upstream.apiKey}`,
            },
            body: JSON.stringify({
              model: upstream.model,
              stream: true,
              stream_options: { include_usage: true },
              max_tokens: maxTokens,
              messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: promptContent },
              ],
            }),
          }),
          timeoutPromise,
        ]);
      } finally {
        clearTimeout(timerId);
      }
    };

    for (let uIdx = 0; uIdx < upstreams.length; uIdx++) {
      const upstream = upstreams[uIdx];
      if (isBudgetExhausted()) {
        throw new Error('Daily API budget limit ($0.50 USD) exhausted. Further upstream calls aborted.');
      }

      try {
        const response = await fetchUpstream(upstream);

        if (!response.ok || !response.body) {
          throw new Error(`${upstream.name} responded with HTTP ${response.status}: ${response.statusText}`);
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let currentReader = response.body.getReader();
        let currentUpstream = upstream;
        let nextUpstreamIdx = uIdx + 1;

        const stream = new ReadableStream({
          async start(controller) {
            while (true) {
              let reachedDone = false;
              let buffer = '';

              try {
                while (true) {
                  const { done, value } = await currentReader.read();
                  if (done) break;

                  buffer += decoder.decode(value, { stream: true });
                  const lines = buffer.split('\n');
                  buffer = lines.pop() || '';

                  for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: ')) continue;
                    if (trimmed === 'data: [DONE]') {
                      reachedDone = true;
                      break;
                    }

                    try {
                      const parsed = JSON.parse(trimmed.slice(6));

                      // Track spend from usage chunk
                      if (parsed.usage) {
                        const promptTok = parsed.usage.prompt_tokens || 0;
                        const compTok = parsed.usage.completion_tokens || 0;
                        const isDeepSeek = currentUpstream.baseUrl.includes('deepseek');
                        const inputRate = isDeepSeek ? 0.30 : 0.30;
                        const outputRate = isDeepSeek ? 1.20 : 1.00;
                        const costUSD = (promptTok * inputRate + compTok * outputRate) / 1_000_000;
                        recordSpendUSD(costUSD);
                      }

                      const delta = parsed.choices?.[0]?.delta?.content;
                      if (delta) {
                        controller.enqueue(encoder.encode(delta));
                      }
                    } catch {
                      // Ignore incomplete JSON chunks
                    }
                  }

                  if (reachedDone) break;
                }
              } catch (midStreamErr: any) {
                console.warn(
                  `Upstream ${currentUpstream.name} encountered mid-stream error:`,
                  midStreamErr.message
                );
                reachedDone = false;
              } finally {
                currentReader.releaseLock();
              }

              if (reachedDone) {
                controller.close();
                return;
              }

              // Mid-stream failure: attempt failover to next upstream
              if (nextUpstreamIdx < upstreams.length) {
                const nextUp = upstreams[nextUpstreamIdx++];
                console.warn(`Attempting mid-stream failover to backup upstream: ${nextUp.name}`);
                try {
                  const nextRes = await fetchUpstream(nextUp);
                  if (nextRes.ok && nextRes.body) {
                    currentUpstream = nextUp;
                    currentReader = nextRes.body.getReader();
                    continue;
                  }
                } catch (failoverErr: any) {
                  console.warn(`Failover upstream ${nextUp.name} also failed:`, failoverErr.message);
                }
              }

              // All upstreams exhausted
              controller.enqueue(
                encoder.encode(`\n\n[Error: Stream interrupted and all backup upstreams failed.]\n`)
              );
              controller.close();
              return;
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-LLM-Provider': upstream.name,
          },
        });
      } catch (err: any) {
        console.warn(`Upstream ${upstream.name} failed:`, err.message);
        lastError = err;
      }
    }

    const errorMsg = `All upstream LLM providers failed: ${lastError?.message || 'Upstream unavailable'}`;
    console.warn(errorMsg);

    if (options?.noMockFallback) {
      return new Response(
        JSON.stringify({
          error: errorMsg,
          code: 'ALL_PROVIDERS_FAILED',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const mockRes = await this.fallbackMock.streamChat(message, options);
    const headers = new Headers(mockRes.headers);
    headers.set('X-LLM-Provider-Fallback', 'true');
    headers.set('X-LLM-Fallback-Reason', lastError?.message || 'Upstream unavailable');
    return new Response(mockRes.body, { status: 200, headers });
  }
}

/**
 * Factory to select the active provider adapter based on environment variable:
 * - LLM_PROVIDER=mock (default) -> MockLLMProvider
 * - LLM_PROVIDER=real -> RealLLMProvider (requires DEEPSEEK_API_KEY or SILICONFLOW_API_KEY)
 */
export function getLLMProvider(): LLMProvider {
  const providerType = (process.env.LLM_PROVIDER || 'mock').trim().toLowerCase();

  if (providerType === 'real') {
    return new RealLLMProvider();
  }

  // If LLM_PROVIDER is not explicitly 'mock', but keys are provided, choose real
  if (providerType !== 'mock' && (process.env.DEEPSEEK_API_KEY || process.env.SILICONFLOW_API_KEY)) {
    return new RealLLMProvider();
  }

  return new MockLLMProvider();
}
