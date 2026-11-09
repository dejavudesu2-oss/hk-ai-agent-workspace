# Breakeven v3 Financial Sensitivity Model (`/plan/breakeven_v3.md`)

**Date**: November 2026  
**Auditor**: Autonomous Build Agent (Task T29)  

---

## 1. Pro Tier Pricing Reconciliation (HK$158 vs. HK$68)

- **The Blueprint**: The original architecture blueprint designated **HK$ 158 / month** (approx. **US$ 20.26 / month**), standard for global developer AI tooling (matching Cursor Pro at $20, v0 Pro at $20, and ChatGPT Plus at $20).
- **The Divergence**: In T03, HK$ 68 / month was tentatively adopted as an ultra-low local entry price. However, auditing revealed that at HK$68:
  1. Stripe HK's fixed HK$2.35 fee takes a disproportionate 3.46% of every payment, creating a 6.86% effective fee (netting only HK$63.34 / $8.12 USD).
  2. With realistic token costs ($0.0023 - $0.0042 per session) and freemium ratios (32.3 to 99 free users per paying user), HK$68 leaves virtually zero margin to absorb free-tier unmonetized users.
- **The Decision**: Standardized strictly on **ONE Pro Price**: **HK$ 158.00 / month** ($20.256 USD / month), fully reconciling with the blueprint.

---

## 2. Parameter Assumptions & Verifications Table

| Input Parameter | Value | Audit Tag | Verification Source & Methodology |
| :--- | :--- | :--- | :--- |
| **Pro Subscription Price** | HK$ 158.00 / month ($20.256 USD) | [assumption: pricing model] | Reconciled with architecture blueprint; matches $20 developer AI tooling baseline |
| **Stripe HK Merchant Fee** | 3.4% + HK$ 2.35 per transaction | [verified: https://stripe.com/hk/pricing] | Verified from official Stripe Hong Kong merchant pricing documentation |
| **Net Revenue per Pro User** | HK$ 150.278 / month ($19.266 USD) | [verified: arithmetic] | `HK$158.00 - (158 * 3.4% + 2.35) = HK$150.278` (Effective Stripe take rate: 4.89%) |
| **AWS Lightsail HK VPS** | $24.00 USD / mo (HK$ 187.20) | [verified: https://aws.amazon.com/lightsail/pricing/] | Verified 2 vCPU, 4GB RAM, 80GB SSD in Hong Kong (`ap-east-1`) data center |
| **Supabase Database Plan** | $25.00 USD / mo (HK$ 195.00) | [verified: https://supabase.com/pricing] | Verified Pro tier for managed PostgreSQL, Auth, and Storage |
| **Domain & DNS Registrar** | $1.00 USD / mo (HK$ 7.80) | [verified: https://www.cloudflare.com/products/registrar/] | Verified amortized annual registrar fee ($12.00 / year) |
| **Total Platform Fixed OpEx** | **$50.00 USD / mo (HK$ 390.00 / mo)** | [verified: sum of OpEx] | `$24.00 + $25.00 + $1.00 = $50.00 USD` |
| **USD / HKD Exchange Rate** | 7.8000 HKD = 1 USD | [verified: HKMA] | Hong Kong Linked Exchange Rate System fixed peg |
| **DeepSeek Model Pricing** | Peak: Hit $0.006, Miss $0.30, Out $1.20 / 1M | [verified: https://api-docs.deepseek.com/quick_start/pricing] | Official DeepSeek-Flash rates published on api-docs.deepseek.com |
| **Single Task Cost (Scenario 1)** | $0.0023154 USD (HK$ 0.01806) | [verified: arithmetic] | `(900 * 0.006 + 300 * 0.30 + 1,850 * 1.20) / 1,000,000` |
| **Pro Task Cost (Scenario 2)** | $0.0036240 USD (HK$ 0.02827) | [verified: arithmetic] | Gen + 3 patch edits: `(9,000 * 0.006 + 1,500 * 0.30 + 2,600 * 1.20) / 1,000,000` |
| **Pro Tasks per Month** | 60 multi-turn tasks / month | [assumption: persona] | Average active paying developer generating 2 complete projects/features per day |
| **Pro User Monthly Token Burn** | $0.2174 USD / mo (HK$ 1.696) | [verified: arithmetic] | `60 * $0.0036240 = $0.21744 USD` |
| **Pro Base Margin ($NCM_0$)** | **$19.049 USD (HK$ 148.58)** | [verified: arithmetic] | Net Stripe Revenue ($19.266) minus Pro Token Burn ($0.217) |

---

## 3. The 3x3 Sensitivity Matrix

The matrix models **Conversion Rate (5%, 3%, 1%)** $\times$ **Free Tasks per User per Day (1, 5, 15 tasks/day)**.  
All formulas and arithmetic for every cell are fully displayed:

- **Free Users per Pro User ($F$)**: $F = \frac{1 - c}{c}$
- **Monthly Free Tasks per User**: $d \times 30$ tasks/month
- **Monthly Free Cost per User**: $(d \times 30) \times \$0.0023154\text{ USD}$
- **Free Cohort Drain per Pro User**: $F \times \text{Monthly Free Cost per User}$
- **Net Margin per Pro User ($NCM$)**: $\$19.049\text{ USD} - \text{Free Drain}$
- **Breakeven Formula**: $N_{\text{breakeven}} = \lceil \frac{\$50.00}{NCM} \rceil$

| Cell | Conversion ($c$) | Free Tasks/Day ($d$) | Free/Pro Ratio ($F$) | Monthly Free Cost / User | Free Drain / Pro User | Net Margin / Pro User ($NCM$) | Arithmetic for Breakeven | Breakeven Paying Users | Status & Viability |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **C1** | **5.0%** | **1 task/day** (30/mo) | 19.00 | $0.06946 USD (HK$0.542) | $1.320 USD (HK$ 10.29) | **$17.729 USD (HK$ 138.29)** | $\lceil \$50.00 / \$17.729 \rceil = 2.82$ | **3 users** | ✅ Highly Profitable |
| **C2** | **5.0%** | **5 tasks/day** (150/mo) | 19.00 | $0.34731 USD (HK$2.709) | $6.599 USD (HK$ 51.47) | **$12.450 USD (HK$ 97.11)** | $\lceil \$50.00 / \$12.450 \rceil = 4.02$ | **5 users** | ✅ Healthy Buffer |
| **C3** | **5.0%** | **15 tasks/day** (450/mo) | 19.00 | $1.04193 USD (HK$8.127) | $19.797 USD (HK$ 154.41) | **-$0.748 USD (-HK$ 5.83)** | Deficit ($NCM < 0$) | **Infeasible** | 🛑 Free drain exceeds Pro margin |
| **C4** | **3.0%** | **1 task/day** (30/mo) | 32.33 | $0.06946 USD (HK$0.542) | $2.246 USD (HK$ 17.52) | **$16.803 USD (HK$ 131.06)** | $\lceil \$50.00 / \$16.803 \rceil = 2.98$ | **3 users** | ✅ Highly Profitable |
| **C5** | **3.0%** | **5 tasks/day** (150/mo) | 32.33 | $0.34731 USD (HK$2.709) | $11.230 USD (HK$ 87.59) | **$7.819 USD (HK$ 60.99)** | $\lceil \$50.00 / \$7.819 \rceil = 6.39$ | **7 users** | ✅ Target Launch Baseline |
| **C6** | **3.0%** | **15 tasks/day** (450/mo) | 32.33 | $1.04193 USD (HK$8.127) | $33.689 USD (HK$ 262.77) | **-$14.640 USD (-HK$ 114.19)** | Deficit ($NCM < 0$) | **Infeasible** | 🛑 Free drain exceeds Pro margin |
| **C7** | **1.0%** | **1 task/day** (30/mo) | 99.00 | $0.06946 USD (HK$0.542) | $6.877 USD (HK$ 53.64) | **$12.172 USD (HK$ 94.94)** | $\lceil \$50.00 / \$12.172 \rceil = 4.11$ | **5 users** | ✅ Resilient at low conversion |
| **C8** | **1.0%** | **5 tasks/day** (150/mo) | 99.00 | $0.34731 USD (HK$2.709) | $34.384 USD (HK$ 268.19) | **-$15.335 USD (-HK$ 119.61)** | Deficit ($NCM < 0$) | **Infeasible** | 🛑 Free drain exceeds Pro margin |
| **C9** | **1.0%** | **15 tasks/day** (450/mo) | 99.00 | $1.04193 USD (HK$8.127) | $103.151 USD (HK$ 804.58) | **-$84.102 USD (-HK$ 656.00)** | Deficit ($NCM < 0$) | **Infeasible** | 🛑 Free drain exceeds Pro margin |

---

## 4. Key Financial Takeaways

1. **Base Target (3% conversion, 5 free tasks/day)**:
   Only **7 paying Pro users** (paying HK$158/mo) are required to achieve total breakeven. These 7 users generate enough revenue to cover the entire HK$390/mo fixed infrastructure bills plus the token costs of **226 active free users**!
2. **Conservative Target (1% conversion, 1 free task/day)**:
   Even if conversion is as low as 1.0%, if free users average 1 task per day, only **5 paying Pro users** achieve breakeven (supporting 495 free users).
3. **The 15 Tasks/Day Free Abuse Boundary**:
   If free users are permitted to consume 15 tasks every day without friction, a single free user burns $1.04 USD (HK$ 8.13) in token costs per month. Across a 19:1 or 32:1 freemium ratio, the free cohort cost overwhelms the Pro subscription margin. This conclusively validates the necessity of the **T15 Cost Guard** (daily rate limiting, bot protection, and IP throttling).
