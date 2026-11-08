import { NextRequest } from 'next/server';
import { getMatchingTemplate } from '@/lib/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `
You are the HK AI Agent Workspace Lead Coder.
Your task is to write real, runnable, production-quality code based on user requests.
Always format your response using standard sandbox action tags:
<sandbox_action type="file" path="relative/path/to/file.ext">
...file content here...
</sandbox_action>

If shell commands are needed, use:
<sandbox_action type="command">
npm install
</sandbox_action>

Write complete files without placeholders, TODOs, or truncation. Provide helpful concise explanations in Traditional Chinese (繁體中文).
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const message = body.message;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Valid prompt message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const siliconflowKey = process.env.SILICONFLOW_API_KEY;

    // If live API keys are provided, attempt live LLM streaming with dual-failover
    if (deepseekKey || siliconflowKey) {
      try {
        return await handleLiveLLMDualStream(message.trim(), deepseekKey, siliconflowKey);
      } catch (err: any) {
        console.warn('Live LLM providers failed, falling back to simulated stream:', err.message);
        // Fallback to high-fidelity simulated stream on upstream outage
        return handleSimulatedStream(message.trim());
      }
    }

    // Default high-fidelity local streaming generator (zero config needed)
    return handleSimulatedStream(message.trim());
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

interface ProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

async function handleLiveLLMDualStream(
  message: string,
  deepseekKey?: string,
  siliconflowKey?: string
): Promise<Response> {
  const providers: ProviderConfig[] = [];

  if (deepseekKey) {
    providers.push({
      name: 'DeepSeek (Primary HK Edge)',
      baseUrl: 'https://api.deepseek.com',
      apiKey: deepseekKey,
      model: 'deepseek-chat',
    });
  }

  if (siliconflowKey) {
    providers.push({
      name: 'SiliconFlow (Backup Failover)',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: siliconflowKey,
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
    });
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          stream: true,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: message },
          ],
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`${provider.name} responded with HTTP ${response.status}: ${response.statusText}`);
      }

      // Successful upstream connection! Stream response back to client.
      const encoder = new TextEncoder();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;
                if (trimmed === 'data: [DONE]') {
                  controller.close();
                  return;
                }

                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    controller.enqueue(encoder.encode(delta));
                  }
                } catch {
                  // Partial JSON chunk, ignore
                }
              }
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-LLM-Provider': provider.name,
        },
      });
    } catch (err: any) {
      console.warn(`Upstream provider ${provider.name} failed:`, err.message);
      lastError = err;
      // Continue to next provider in failover chain
    }
  }

  throw lastError || new Error('All configured LLM providers failed.');
}

function handleSimulatedStream(message: string) {
  const template = getMatchingTemplate(message);
  const encoder = new TextEncoder();

  const parts: string[] = [
    `好的！我正在為您構建【${template.description}】。\n正在初始化香港本地安全沙盒環境並流式編寫代碼...\n\n`,
  ];

  for (const file of template.files) {
    parts.push(`<sandbox_action type="file" path="${file.path}">\n${file.content}\n</sandbox_action>\n\n`);
  }

  if (template.command) {
    parts.push(`<sandbox_action type="command">\n${template.command}\n</sandbox_action>\n\n`);
  }

  parts.push(`🎉 項目構建完成！代碼已即時寫入中間 Monaco 編輯器，右側沙盒預覽已即時熱更新。您可以直接在預覽中新增與切換待辦事項。`);

  const fullText = parts.join('');

  // Break full text into realistic stream chunks
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
      'X-LLM-Provider': 'High-Fidelity Simulated Stream (HK Edge)',
    },
  });
}
