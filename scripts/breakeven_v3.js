/**
 * scripts/breakeven_v3.js
 * Breakeven v3 Financial Sensitivity Engine (Task T29)
 * Acceptance Test: node scripts/breakeven_v3.js
 */

const USD_TO_HKD = 7.80;

// Reconciled Pro Tier Price: Blueprint specified HK$158 (industry standard $20 USD/mo)
const PRO_PRICE_HKD = 158.00;
const PRO_PRICE_USD = PRO_PRICE_HKD / USD_TO_HKD; // $20.2564 USD

// Stripe HK Fees [verified: https://stripe.com/hk/pricing]
const STRIPE_PERCENT = 0.034;
const STRIPE_FIXED_HKD = 2.35;
const STRIPE_FEE_HKD = PRO_PRICE_HKD * STRIPE_PERCENT + STRIPE_FIXED_HKD; // HK$ 7.722
const NET_PRO_REVENUE_HKD = PRO_PRICE_HKD - STRIPE_FEE_HKD; // HK$ 150.278
const NET_PRO_REVENUE_USD = NET_PRO_REVENUE_HKD / USD_TO_HKD; // $19.2664 USD

// Fixed Monthly Platform OpEx (USD) [verified: AWS, Supabase, Cloudflare]
const FIXED_OPEX_USD = 50.00; // $24 AWS Lightsail HK + $25 Supabase Pro + $1 Domain
const FIXED_OPEX_HKD = FIXED_OPEX_USD * USD_TO_HKD; // HK$ 390.00

// Unit token costs from T28 (Peak DeepSeek-Flash rates)
const COST_SCENARIO_1_USD = 0.0023154; // 1st Gen
const COST_SCENARIO_2_USD = 0.0036240; // 1st Gen + 3 Edits

// Pro usage assumption: 60 Scenario 2 tasks per month [assumption]
const PRO_MONTHLY_TASKS = 60;
const PRO_MONTHLY_TOKEN_COST_USD = PRO_MONTHLY_TASKS * COST_SCENARIO_2_USD; // $0.21744 USD
const PRO_MONTHLY_TOKEN_COST_HKD = PRO_MONTHLY_TOKEN_COST_USD * USD_TO_HKD; // HK$ 1.6960

// Net contribution margin per Pro user before absorbing free tier
const PRO_NCM_BASE_USD = NET_PRO_REVENUE_USD - PRO_MONTHLY_TOKEN_COST_USD; // $19.0490 USD
const PRO_NCM_BASE_HKD = NET_PRO_REVENUE_HKD - PRO_MONTHLY_TOKEN_COST_HKD; // HK$ 148.582

function runBreakevenV3() {
  console.log('================================================================');
  console.log('       BREAKEVEN v3 SENSITIVITY ENGINE (Task T29)               ');
  console.log('================================================================\n');

  console.log('1. Pro Subscription & Unit Economics (HK$ 158 / Month):');
  console.log(`   - Pro Price:                  HK$ ${PRO_PRICE_HKD.toFixed(2)} ($${PRO_PRICE_USD.toFixed(3)} USD) [reconciled: blueprint]`);
  console.log(`   - Stripe HK Fee (3.4%+2.35):  HK$ ${STRIPE_FEE_HKD.toFixed(3)} (4.89% take rate) [verified: stripe.com/hk/pricing]`);
  console.log(`   - Net Collected / Pro User:   HK$ ${NET_PRO_REVENUE_HKD.toFixed(3)} ($${NET_PRO_REVENUE_USD.toFixed(3)} USD)`);
  console.log(`   - Pro Token Burn (60 tasks):  HK$ ${PRO_MONTHLY_TOKEN_COST_HKD.toFixed(3)} ($${PRO_MONTHLY_TOKEN_COST_USD.toFixed(4)} USD) [verified: arithmetic]`);
  console.log(`   - Pro Base Margin (NCM_0):    HK$ ${PRO_NCM_BASE_HKD.toFixed(3)} ($${PRO_NCM_BASE_USD.toFixed(4)} USD)\n`);

  console.log('2. Fixed Monthly Platform OpEx:');
  console.log(`   - AWS Lightsail HK (4GB RAM): $24.00 USD (HK$ 187.20) [verified: aws.amazon.com/lightsail/pricing]`);
  console.log(`   - Supabase Pro Plan:          $25.00 USD (HK$ 195.00) [verified: supabase.com/pricing]`);
  console.log(`   - Domain & DNS:               $1.00 USD (HK$ 7.80) [verified: cloudflare.com/products/registrar]`);
  console.log(`   ------------------------------------------------------------`);
  console.log(`   Total Fixed OpEx:             $${FIXED_OPEX_USD.toFixed(2)} USD (HK$ ${FIXED_OPEX_HKD.toFixed(2)})\n`);

  const conversions = [0.05, 0.03, 0.01]; // 5%, 3%, 1%
  const dailyFreeTasks = [1, 5, 15]; // 1, 5, 15 tasks/day

  console.log('3. 3x3 Sensitivity Matrix (Conversion % x Free Tasks/Day):');
  console.log('| Conversion | Free Tasks/Day | Free/Pro Ratio | Free Drain / Pro | Net Margin / Pro | Arithmetic | Breakeven Pro Users | Status |');
  console.log('| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  for (const c of conversions) {
    const freePerPro = (1 - c) / c;
    for (const d of dailyFreeTasks) {
      const monthlyFreeTasks = d * 30;
      const freeCostPerUserUSD = monthlyFreeTasks * COST_SCENARIO_1_USD;
      const freeDrainUSD = freePerPro * freeCostPerUserUSD;
      const freeDrainHKD = freeDrainUSD * USD_TO_HKD;
      const netMarginUSD = PRO_NCM_BASE_USD - freeDrainUSD;
      const netMarginHKD = netMarginUSD * USD_TO_HKD;

      if (netMarginUSD <= 0) {
        console.log(
          `| ${(c * 100).toFixed(0)}% | ${d} task/day (${monthlyFreeTasks}/mo) | ${freePerPro.toFixed(1)} | $${freeDrainUSD.toFixed(2)} (HK$${freeDrainHKD.toFixed(1)}) | -$${Math.abs(netMarginUSD).toFixed(2)} (-HK$${Math.abs(netMarginHKD).toFixed(1)}) | Deficit (NCM < 0) | **Infeasible** | 🛑 Free drain exceeds Pro margin |`
        );
      } else {
        const breakevenUsers = Math.ceil(FIXED_OPEX_USD / netMarginUSD);
        const calcStr = `ceil($${FIXED_OPEX_USD.toFixed(0)} / $${netMarginUSD.toFixed(3)}) = ${(FIXED_OPEX_USD / netMarginUSD).toFixed(2)}`;
        console.log(
          `| ${(c * 100).toFixed(0)}% | ${d} task/day (${monthlyFreeTasks}/mo) | ${freePerPro.toFixed(1)} | $${freeDrainUSD.toFixed(2)} (HK$${freeDrainHKD.toFixed(1)}) | $${netMarginUSD.toFixed(3)} (HK$${netMarginHKD.toFixed(2)}) | ${calcStr} | **${breakevenUsers} users** | ✅ Viable |`
        );
      }
    }
  }

  console.log('\n================================================================');
  console.log('✅ Breakeven v3 Sensitivity Analysis Complete.');
  console.log('================================================================');
}

runBreakevenV3();
