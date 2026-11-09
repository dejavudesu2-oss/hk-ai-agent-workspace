import { NextRequest } from 'next/server';
import { getLLMProvider } from '@/lib/llm-provider';
import {
  checkRateLimit,
  checkInputSize,
  isBudgetExhausted,
  validateInviteCode,
  extractClientIp,
  DEFAULT_CONFIG,
} from '@/lib/cost-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const clientIp = extractClientIp(req.headers);

    // 1. Daily budget / emergency kill switch check (returns 503 if exhausted)
    if (isBudgetExhausted()) {
      return new Response(
        JSON.stringify({
          error: 'Daily API budget exhausted ($0.50 cap) or emergency kill switch active.',
          code: 'BUDGET_EXHAUSTED',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' },
        }
      );
    }

    // 2. Per-IP rate limit check (returns 429 if limit exceeded)
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: `Rate limit exceeded. Please wait ${rateCheck.retryAfter}s before retrying.`,
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(rateCheck.retryAfter || 60),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const message = body.message;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Valid prompt message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Max input size check (returns 429 if input exceeds max characters)
    const inputCheck = checkInputSize(message);
    if (!inputCheck.allowed) {
      return new Response(
        JSON.stringify({
          error: inputCheck.error,
          code: 'INPUT_TOO_LARGE',
        }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Max tokens cap check (returns 429 if requested max_tokens exceeds cap)
    if (body.max_tokens && typeof body.max_tokens === 'number') {
      if (body.max_tokens > DEFAULT_CONFIG.maxTokensCap) {
        return new Response(
          JSON.stringify({
            error: `Requested max_tokens (${body.max_tokens}) exceeds platform cap of ${DEFAULT_CONFIG.maxTokensCap}.`,
            code: 'MAX_TOKENS_EXCEEDED',
          }),
          {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // 5. Optional invite code check for real provider (returns 429/403)
    const inviteCode = (req.headers.get('x-invite-code') || body.inviteCode || '').trim();
    const provider = getLLMProvider();

    if (provider.name.includes('Real')) {
      if (!validateInviteCode(inviteCode)) {
        return new Response(
          JSON.stringify({
            error: 'Valid invite code required to access live real LLM provider.',
            code: 'INVITE_CODE_REQUIRED',
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    return await provider.streamChat(message.trim(), {
      maxTokens: body.max_tokens,
      files: body.files,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    if (error.message?.includes('budget limit') || error.message?.includes('budget cap')) {
      return new Response(
        JSON.stringify({ error: error.message, code: 'BUDGET_EXHAUSTED' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
