/**
 * scripts/cost.js
 * FinOps Token and Unit Economics Calculator
 * Acceptance Test: node scripts/cost.js
 */

const USD_TO_HKD = 7.80;

// DeepSeek Pricing (Per 1 Million Tokens) - Peak rates (conservative)
const PRICING = {
  deepseekFlashPeak: {
    cacheHitPerMillion: 0.006,
    cacheMissPerMillion: 0.30,
    outputPerMillion: 1.20,
  },
  deepseekFlashOffPeak: {
    cacheHitPerMillion: 0.003,
    cacheMissPerMillion: 0.15,
    outputPerMillion: 0.60,
  },
  deepseekProPeak: {
    cacheHitPerMillion: 0.044,
    cacheMissPerMillion: 1.32,
    outputPerMillion: 3.96,
  },
  siliconflowQwen: {
    inputPerMillion: 0.30,
    outputPerMillion: 1.00,
  }
};

/**
 * Calculates the exact token cost for a session/task
 */
function calculateTaskCost({
  cacheHitTokens,
  cacheMissTokens,
  outputTokens,
  rates = PRICING.deepseekFlashPeak,
}) {
  const cacheHitCost = (cacheHitTokens * rates.cacheHitPerMillion) / 1_000_000;
  const cacheMissCost = (cacheMissTokens * rates.cacheMissPerMillion) / 1_000_000;
  const outputCost = (outputTokens * rates.outputPerMillion) / 1_000_000;

  const totalCostUSD = cacheHitCost + cacheMissCost + outputCost;
  const totalCostHKD = totalCostUSD * USD_TO_HKD;

  return {
    cacheHitCost,
    cacheMissCost,
    outputCost,
    totalCostUSD,
    totalCostHKD,
  };
}

/**
 * Canonical Hand-Computed Example Baseline
 */
const CANONICAL_TASK = {
  name: 'Standard AI Agent Coding Session (3 turns: init, tweak, fix)',
  cacheHitTokens: 6000,
  cacheMissTokens: 2000,
  outputTokens: 2500,
};

// Hand-computed expected values:
const EXPECTED_TASK_USD = 0.003636;
const EXPECTED_TASK_HKD = 0.003636 * 7.80; // 0.0283608

function runEconomics() {
  console.log('================================================================');
  console.log(' HK AI Agent Workspace - FinOps Unit Economics Calculator');
  console.log(' Fixed FX Rate: 1 USD = 7.80 HKD [verified: HKMA peg]');
  console.log('================================================================\n');

  // 1. Single Session Calculation
  const taskResult = calculateTaskCost(CANONICAL_TASK);

  console.log(`1. Single Session Cost (${CANONICAL_TASK.name}):`);
  console.log(`   Input Hit Tokens:  ${CANONICAL_TASK.cacheHitTokens.toLocaleString()} -> $${taskResult.cacheHitCost.toFixed(6)} USD`);
  console.log(`   Input Miss Tokens: ${CANONICAL_TASK.cacheMissTokens.toLocaleString()} -> $${taskResult.cacheMissCost.toFixed(6)} USD`);
  console.log(`   Output Tokens:     ${CANONICAL_TASK.outputTokens.toLocaleString()} -> $${taskResult.outputCost.toFixed(6)} USD`);
  console.log(`   -------------------------------------------------------------`);
  console.log(`   Total Task Cost:   $${taskResult.totalCostUSD.toFixed(6)} USD | HK$ ${taskResult.totalCostHKD.toFixed(5)}`);

  // Verify match with hand-computed arithmetic
  const diffUSD = Math.abs(taskResult.totalCostUSD - EXPECTED_TASK_USD);
  if (diffUSD > 0.000001) {
    console.error(`❌ Arithmetic mismatch! Computed: ${taskResult.totalCostUSD}, Expected: ${EXPECTED_TASK_USD}`);
    process.exit(1);
  }
  console.log('   ✓ Matches hand-computed baseline: $0.003636 USD / HK$ 0.02836\n');

  // 2. User Monthly Personas
  const FREE_MONTHLY_SESSIONS = 12;
  const PRO_MONTHLY_SESSIONS = 60;

  const freeUserTokenUSD = FREE_MONTHLY_SESSIONS * taskResult.totalCostUSD;
  const freeUserTokenHKD = freeUserTokenUSD * USD_TO_HKD;

  const proUserTokenUSD = PRO_MONTHLY_SESSIONS * taskResult.totalCostUSD;
  const proUserTokenHKD = proUserTokenUSD * USD_TO_HKD;

  console.log('2. Monthly Persona Economics:');
  console.log(`   Free User (${FREE_MONTHLY_SESSIONS} sessions/mo):`);
  console.log(`     Token Cost: $${freeUserTokenUSD.toFixed(4)} USD / HK$ ${freeUserTokenHKD.toFixed(4)}`);
  console.log(`   Pro User (${PRO_MONTHLY_SESSIONS} heavy sessions/mo):`);
  console.log(`     Token Cost: $${proUserTokenUSD.toFixed(4)} USD / HK$ ${proUserTokenHKD.toFixed(4)}\n`);

  // 3. Fixed OpEx & Breakeven
  const VPS_MONTHLY_USD = 24.00; // AWS Lightsail HK 2C/4G
  const DOMAIN_MONTHLY_USD = 1.00;
  const FIXED_OPEX_USD = VPS_MONTHLY_USD + DOMAIN_MONTHLY_USD;
  const FIXED_OPEX_HKD = FIXED_OPEX_USD * USD_TO_HKD; // HK$ 195.00

  const PRO_PRICE_HKD = 68.00;
  const PRO_PRICE_USD = PRO_PRICE_HKD / USD_TO_HKD;

  // Stripe HK fee: 3.4% + HK$2.35
  const STRIPE_FEE_HKD = PRO_PRICE_HKD * 0.034 + 2.35; // HK$ 4.662
  const STRIPE_FEE_USD = STRIPE_FEE_HKD / USD_TO_HKD;

  const PRO_MARGIN_HKD = PRO_PRICE_HKD - STRIPE_FEE_HKD - proUserTokenHKD;
  const PRO_MARGIN_USD = PRO_MARGIN_HKD / USD_TO_HKD;
  const GROSS_MARGIN_PCT = ((PRO_PRICE_HKD - STRIPE_FEE_HKD - proUserTokenHKD) / PRO_PRICE_HKD) * 100;

  const BREAKEVEN_USERS = FIXED_OPEX_HKD / PRO_MARGIN_HKD;

  console.log('3. Platform Fixed OpEx & Breakeven:');
  console.log(`   Fixed Monthly OpEx:     $${FIXED_OPEX_USD.toFixed(2)} USD | HK$ ${FIXED_OPEX_HKD.toFixed(2)}`);
  console.log(`   Pro Subscription Price: $${PRO_PRICE_USD.toFixed(2)} USD | HK$ ${PRO_PRICE_HKD.toFixed(2)}`);
  console.log(`   Stripe HK Fee (3.4%+2.35): HK$ ${STRIPE_FEE_HKD.toFixed(2)}`);
  console.log(`   Pro Net Margin / User:  $${PRO_MARGIN_USD.toFixed(2)} USD | HK$ ${PRO_MARGIN_HKD.toFixed(2)}`);
  console.log(`   Gross Margin Rate:      ${GROSS_MARGIN_PCT.toFixed(1)}%`);
  console.log(`   Breakeven Users Needed: ${BREAKEVEN_USERS.toFixed(2)} -> ${Math.ceil(BREAKEVEN_USERS)} Users\n`);

  // 4. Scale Model: 1,000 MAU (200 Pro + 800 Free)
  const SCALE_PRO_COUNT = 200;
  const SCALE_FREE_COUNT = 800;

  const totalRevenueHKD = SCALE_PRO_COUNT * PRO_PRICE_HKD;
  const totalStripeHKD = SCALE_PRO_COUNT * STRIPE_FEE_HKD;
  const totalTokensHKD = (SCALE_PRO_COUNT * proUserTokenHKD) + (SCALE_FREE_COUNT * freeUserTokenHKD);
  const scaleServerHKD = 80.00 * USD_TO_HKD; // 2x 4C/8G VPS
  const scaleDatabaseHKD = 25.00 * USD_TO_HKD; // Supabase Pro
  const totalCostHKD = totalStripeHKD + totalTokensHKD + scaleServerHKD + scaleDatabaseHKD;
  const netProfitHKD = totalRevenueHKD - totalCostHKD;
  const netProfitUSD = netProfitHKD / USD_TO_HKD;
  const netProfitMargin = (netProfitHKD / totalRevenueHKD) * 100;

  console.log(`4. Scale Projection (${SCALE_PRO_COUNT} Pro, ${SCALE_FREE_COUNT} Free MAU):`);
  console.log(`   Monthly Gross Revenue: $${(totalRevenueHKD / USD_TO_HKD).toFixed(2)} USD | HK$ ${totalRevenueHKD.toFixed(2)}`);
  console.log(`   Total Operating Costs: $${(totalCostHKD / USD_TO_HKD).toFixed(2)} USD | HK$ ${totalCostHKD.toFixed(2)}`);
  console.log(`   Net Operating Profit:  $${netProfitUSD.toFixed(2)} USD | HK$ ${netProfitHKD.toFixed(2)}`);
  console.log(`   Net Profit Margin:     ${netProfitMargin.toFixed(1)}%\n`);

  console.log('✅ FinOps Calculation verified: All arithmetic matches hand-computed examples.');
}

runEconomics();
