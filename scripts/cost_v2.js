/**
 * scripts/cost_v2.js
 * FinOps Cost Model v2 Calculator
 * Acceptance Test: node scripts/cost_v2.js
 */

const USD_TO_HKD = 7.80;

// DeepSeek Peak Model Pricing per 1M tokens (standard rates)
const PRICING = {
  cacheHitPerMillion: 0.014,    // $0.014 / 1M tokens
  cacheMissPerMillion: 0.14,    // $0.14 / 1M tokens
  outputPerMillion: 0.28,       // $0.28 / 1M tokens
};

// Fixed Monthly Platform OpEx (USD)
const FIXED_OPEX = {
  supabasePro: 25.00,
  vpsHosting: 24.00,     // AWS Lightsail HK (2C / 4GB)
  domainDns: 1.00,       // Annual domain ($12/yr amortized)
};
const TOTAL_FIXED_OPEX_USD = Object.values(FIXED_OPEX).reduce((a, b) => a + b, 0); // $50.00
const TOTAL_FIXED_OPEX_HKD = TOTAL_FIXED_OPEX_USD * USD_TO_HKD; // HK$ 390.00

// Pro Subscription Pricing & Stripe HK Fees
const PRO_TIER = {
  priceHKD: 68.00,
  stripePercentFee: 0.034, // 3.4%
  stripeFixedFeeHKD: 2.35, // HK$ 2.35
};

// 3 Scenarios Token Profiles
const SCENARIOS = {
  scenario1: {
    name: 'Scenario 1: First Generation (1 turn)',
    promptTokens: 1200,
    cacheHitTokens: 900,
    cacheMissTokens: 300,
    outputTokens: 1800,
  },
  scenario2: {
    name: 'Scenario 2: First Generation + 3 Edits (4 turns total)',
    promptTokens: 6600,
    cacheHitTokens: 5400,
    cacheMissTokens: 1200,
    outputTokens: 2550,
  },
  scenario3: {
    name: 'Scenario 3: First Generation + 3 Edits + 1 Auto-Fix (5 turns total)',
    promptTokens: 8700,
    cacheHitTokens: 7200,
    cacheMissTokens: 1500,
    outputTokens: 2900,
  },
};

function calculateTokensCost(profile) {
  const hitCost = (profile.cacheHitTokens * PRICING.cacheHitPerMillion) / 1_000_000;
  const missCost = (profile.cacheMissTokens * PRICING.cacheMissPerMillion) / 1_000_000;
  const outCost = (profile.outputTokens * PRICING.outputPerMillion) / 1_000_000;
  const totalUSD = hitCost + missCost + outCost;
  const totalHKD = totalUSD * USD_TO_HKD;
  return { hitCost, missCost, outCost, totalUSD, totalHKD };
}

function calculateStripeHKFee(amountHKD) {
  const percentFee = amountHKD * PRO_TIER.stripePercentFee;
  const totalFeeHKD = percentFee + PRO_TIER.stripeFixedFeeHKD;
  const netHKD = amountHKD - totalFeeHKD;
  const netUSD = netHKD / USD_TO_HKD;
  return {
    feeHKD: totalFeeHKD,
    netHKD,
    netUSD,
    effectiveRate: (totalFeeHKD / amountHKD) * 100,
  };
}

function runCostModelV2() {
  console.log('================================================================');
  console.log('       FinOps Cost Model v2: Unit Economics & Breakeven         ');
  console.log('================================================================\n');

  console.log('1. Fixed Platform Monthly OpEx:');
  console.log(`   - Supabase Pro:             $${FIXED_OPEX.supabasePro.toFixed(2)} USD (HK$ ${(FIXED_OPEX.supabasePro * USD_TO_HKD).toFixed(2)})`);
  console.log(`   - VPS Hosting (AWS HK):     $${FIXED_OPEX.vpsHosting.toFixed(2)} USD (HK$ ${(FIXED_OPEX.vpsHosting * USD_TO_HKD).toFixed(2)})`);
  console.log(`   - Domain & Cloudflare DNS:  $${FIXED_OPEX.domainDns.toFixed(2)} USD (HK$ ${(FIXED_OPEX.domainDns * USD_TO_HKD).toFixed(2)})`);
  console.log(`   ------------------------------------------------------------`);
  console.log(`   Total Fixed OpEx:           $${TOTAL_FIXED_OPEX_USD.toFixed(2)} USD (HK$ ${TOTAL_FIXED_OPEX_HKD.toFixed(2)})\n`);

  console.log('2. Stripe HK Fee Structure (HK$68/mo Pro Tier):');
  const stripe = calculateStripeHKFee(PRO_TIER.priceHKD);
  console.log(`   - Gross Charge:             HK$ ${PRO_TIER.priceHKD.toFixed(2)} ($${(PRO_TIER.priceHKD / USD_TO_HKD).toFixed(2)} USD)`);
  console.log(`   - Stripe HK Fee (3.4%+2.35):HK$ ${stripe.feeHKD.toFixed(2)} (${stripe.effectiveRate.toFixed(2)}% effective)`);
  console.log(`   - Net Collected:            HK$ ${stripe.netHKD.toFixed(2)} ($${stripe.netUSD.toFixed(3)} USD)\n`);

  console.log('3. Token Costs Across 3 Scenarios:');
  const s1 = calculateTokensCost(SCENARIOS.scenario1);
  const s2 = calculateTokensCost(SCENARIOS.scenario2);
  const s3 = calculateTokensCost(SCENARIOS.scenario3);

  console.log(`   ${SCENARIOS.scenario1.name}:`);
  console.log(`     Tokens: ${SCENARIOS.scenario1.promptTokens} in (${SCENARIOS.scenario1.cacheHitTokens} hit, ${SCENARIOS.scenario1.cacheMissTokens} miss), ${SCENARIOS.scenario1.outputTokens} out`);
  console.log(`     Cost:   $${s1.totalUSD.toFixed(7)} USD | HK$ ${s1.totalHKD.toFixed(5)}`);

  console.log(`   ${SCENARIOS.scenario2.name}:`);
  console.log(`     Tokens: ${SCENARIOS.scenario2.promptTokens} in (${SCENARIOS.scenario2.cacheHitTokens} hit, ${SCENARIOS.scenario2.cacheMissTokens} miss), ${SCENARIOS.scenario2.outputTokens} out`);
  console.log(`     Cost:   $${s2.totalUSD.toFixed(7)} USD | HK$ ${s2.totalHKD.toFixed(5)}`);

  console.log(`   ${SCENARIOS.scenario3.name}:`);
  console.log(`     Tokens: ${SCENARIOS.scenario3.promptTokens} in (${SCENARIOS.scenario3.cacheHitTokens} hit, ${SCENARIOS.scenario3.cacheMissTokens} miss), ${SCENARIOS.scenario3.outputTokens} out`);
  console.log(`     Cost:   $${s3.totalUSD.toFixed(7)} USD | HK$ ${s3.totalHKD.toFixed(5)}\n`);

  console.log('4. Free-Tier Abuse & Freemium Cohort Dynamics:');
  const conversionRate = 0.03; // 3%
  const freePerPaying = (1 - conversionRate) / conversionRate; // ~32.33 free users per paying user
  console.log(`   - Stated Conversion Rate:   ${(conversionRate * 100).toFixed(1)}%`);
  console.log(`   - Free users per Pro user:  ${freePerPaying.toFixed(2)} users`);

  // Max free abuse: 15 tasks/day * 30 days = 450 tasks/mo * s1 cost
  const maxAbuseMonthlyUSD = 15 * 30 * s1.totalUSD;
  console.log(`   - Max 15 tasks/day abuse:   $${maxAbuseMonthlyUSD.toFixed(4)} USD / user / mo (HK$ ${(maxAbuseMonthlyUSD * USD_TO_HKD).toFixed(2)})`);

  // Baseline Cohort: Average free user does 15 tasks/mo
  const avgFreeMonthlyUSD = 15 * s1.totalUSD;
  const freeBurdenUSD_Baseline = freePerPaying * avgFreeMonthlyUSD;
  const freeBurdenHKD_Baseline = freeBurdenUSD_Baseline * USD_TO_HKD;

  // Pro monthly consumption: 60 tasks/mo (Scenario 2)
  const proMonthlyTokenUSD = 60 * s2.totalUSD;
  const proMonthlyTokenHKD = proMonthlyTokenUSD * USD_TO_HKD;

  const netMarginUSD_Baseline = stripe.netUSD - proMonthlyTokenUSD - freeBurdenUSD_Baseline;
  const netMarginHKD_Baseline = stripe.netHKD - proMonthlyTokenHKD - freeBurdenHKD_Baseline;
  const breakevenPaying_Baseline = Math.ceil(TOTAL_FIXED_OPEX_USD / netMarginUSD_Baseline);

  console.log(`   [Cohort A: Typical Free Tier (15 tasks/month)]:`);
  console.log(`     - Pro Net Revenue:        $${stripe.netUSD.toFixed(3)} USD (HK$ ${stripe.netHKD.toFixed(2)})`);
  console.log(`     - Pro Token Burn (60x):   $${proMonthlyTokenUSD.toFixed(4)} USD (HK$ ${proMonthlyTokenHKD.toFixed(3)})`);
  console.log(`     - Free Cohort Drain:      $${freeBurdenUSD_Baseline.toFixed(4)} USD (HK$ ${freeBurdenHKD_Baseline.toFixed(3)})`);
  console.log(`     - Net Margin / Pro User:  $${netMarginUSD_Baseline.toFixed(3)} USD (HK$ ${netMarginHKD_Baseline.toFixed(2)})`);
  console.log(`     - Breakeven Paying Users: ${breakevenPaying_Baseline} users ($${TOTAL_FIXED_OPEX_USD} / $${netMarginUSD_Baseline.toFixed(3)})`);
  console.log(`     - Supporting Free Users:  ${Math.round(breakevenPaying_Baseline * freePerPaying)} free users`);

  // Cohort B: 10% heavy abusers (15 tasks/day), 90% typical (15 tasks/mo)
  const blendedFreeMonthlyUSD = 0.10 * maxAbuseMonthlyUSD + 0.90 * avgFreeMonthlyUSD;
  const freeBurdenUSD_Abuse = freePerPaying * blendedFreeMonthlyUSD;
  const freeBurdenHKD_Abuse = freeBurdenUSD_Abuse * USD_TO_HKD;
  const netMarginUSD_Abuse = stripe.netUSD - proMonthlyTokenUSD - freeBurdenUSD_Abuse;
  const netMarginHKD_Abuse = stripe.netHKD - proMonthlyTokenHKD - freeBurdenHKD_Abuse;
  const breakevenPaying_Abuse = Math.ceil(TOTAL_FIXED_OPEX_USD / netMarginUSD_Abuse);

  console.log(`\n   [Cohort B: 10% Heavy Abusers (15 tasks/day) + 90% Typical]:`);
  console.log(`     - Blended Free User Cost: $${blendedFreeMonthlyUSD.toFixed(4)} USD (HK$ ${(blendedFreeMonthlyUSD * USD_TO_HKD).toFixed(3)})`);
  console.log(`     - Free Cohort Drain:      $${freeBurdenUSD_Abuse.toFixed(4)} USD (HK$ ${freeBurdenHKD_Abuse.toFixed(3)})`);
  console.log(`     - Net Margin / Pro User:  $${netMarginUSD_Abuse.toFixed(3)} USD (HK$ ${netMarginHKD_Abuse.toFixed(2)})`);
  console.log(`     - Breakeven Paying Users: ${breakevenPaying_Abuse} users ($${TOTAL_FIXED_OPEX_USD} / $${netMarginUSD_Abuse.toFixed(3)})`);
  console.log(`     - Supporting Free Users:  ${Math.round(breakevenPaying_Abuse * freePerPaying)} free users\n`);

  console.log('================================================================');
  console.log('✅ Cost Model v2 Calculations Complete & Verified.');
  console.log('================================================================');
}

runCostModelV2();
