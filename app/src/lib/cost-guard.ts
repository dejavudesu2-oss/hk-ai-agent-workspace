/**
 * app/src/lib/cost-guard.ts
 * FinOps & Security Guard: Rate limiting, input caps, budget kill switch, and invite gating.
 */

export interface CostGuardConfig {
  maxInputChars: number;
  rateLimitPerWindow: number;
  rateLimitWindowMs: number;
  dailyBudgetUSD: number;
  maxTokensCap: number;
  inviteCodeRequired: boolean;
  validInviteCodes: string[];
}

export const DEFAULT_CONFIG: CostGuardConfig = {
  maxInputChars: parseInt(process.env.MAX_INPUT_CHARS || '12000', 10),
  rateLimitPerWindow: parseInt(process.env.RATE_LIMIT_PER_WINDOW || '30', 10),
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '600000', 10), // 10 minutes
  dailyBudgetUSD: parseFloat(process.env.DAILY_BUDGET_USD || '0.50'), // $0.50 hard cap
  maxTokensCap: parseInt(process.env.MAX_TOKENS_CAP || '4096', 10),
  inviteCodeRequired: process.env.INVITE_CODE_REQUIRED === 'true',
  validInviteCodes: (process.env.INVITE_CODES || 'HK_BETA_2026,VIP_DEV').split(',').map((s) => s.trim()).filter(Boolean),
};

// In-memory rate limiting store: IP -> array of timestamps
const ipRequestHistory = new Map<string, number[]>();

// In-memory spend tracking
let cumulativeSpendUSD = 0;
let manualKillSwitchActive = process.env.BUDGET_KILL_SWITCH === 'true';

/**
 * Check if the client IP exceeds the sliding-window rate limit
 */
export function checkRateLimit(
  ip: string,
  limit = DEFAULT_CONFIG.rateLimitPerWindow,
  windowMs = DEFAULT_CONFIG.rateLimitWindowMs
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  const timestamps = (ipRequestHistory.get(ip) || []).filter((ts) => ts > windowStart);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter: Math.max(retryAfter, 1) };
  }

  timestamps.push(now);
  ipRequestHistory.set(ip, timestamps);
  return { allowed: true, remaining: limit - timestamps.length };
}

/**
 * Check if input size exceeds max character cap
 */
export function checkInputSize(
  message: string,
  maxChars = DEFAULT_CONFIG.maxInputChars
): { allowed: boolean; error?: string } {
  if (message.length > maxChars) {
    return {
      allowed: false,
      error: `Input size (${message.length} chars) exceeds maximum allowed limit of ${maxChars} chars.`,
    };
  }
  return { allowed: true };
}

/**
 * Check if the global budget limit has been reached or manual kill switch is enabled
 */
export function isBudgetExhausted(capUSD = DEFAULT_CONFIG.dailyBudgetUSD): boolean {
  if (manualKillSwitchActive) return true;
  return cumulativeSpendUSD >= capUSD;
}

/**
 * Records spend in USD from token usage
 */
export function recordSpendUSD(amountUSD: number): void {
  cumulativeSpendUSD += Math.max(0, amountUSD);
}

/**
 * Gets currently tracked spend
 */
export function getTrackedSpendUSD(): number {
  return cumulativeSpendUSD;
}

/**
 * Toggle manual budget kill switch
 */
export function setBudgetKillSwitch(active: boolean): void {
  manualKillSwitchActive = active;
}

/**
 * Validates invite code if invite gating is enabled
 */
export function validateInviteCode(
  code?: string,
  required = DEFAULT_CONFIG.inviteCodeRequired,
  validList = DEFAULT_CONFIG.validInviteCodes
): boolean {
  if (!required) return true;
  if (!code) return false;
  return validList.includes(code.trim());
}

/**
 * Extracts real client IP safely considering proxies
 */
export function extractClientIp(headers: Headers): string {
  // Cloudflare Connecting IP is most authoritative behind Cloudflare
  const cfIp = headers.get('cf-connecting-ip');
  if (cfIp) return cfIp.trim();

  // Standard X-Forwarded-For: take the leftmost client IP
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',');
    return ips[0].trim();
  }

  const xRealIp = headers.get('x-real-ip');
  if (xRealIp) return xRealIp.trim();

  return '127.0.0.1';
}

/**
 * Reset guard state for tests
 */
export function resetCostGuardForTesting(): void {
  ipRequestHistory.clear();
  cumulativeSpendUSD = 0;
  manualKillSwitchActive = process.env.BUDGET_KILL_SWITCH === 'true';
}
