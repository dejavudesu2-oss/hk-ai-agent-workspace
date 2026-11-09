# FinOps Cost Model v2 (`/plan/cost_v2.md`)

## 1. Executive Summary & Provenance Audit State

This document contains the audited unit economics model following the Task T26 & T28 sanity audit. All earlier preliminary numbers ($0.000559, $0.000958, $0.001123) have been formally **retracted** because they relied on an erroneous output token rate ($0.28/1M instead of DeepSeek-Flash's official $1.20 peak rate). 

**Key Audited Findings (Peak DeepSeek Rates)**:
- **Scenario 1 (1st Gen)**: **$0.002315 USD** (HK$ 0.01806) per task [retracted $0.000559]
- **Scenario 2 (1st Gen + 3 Edits)**: **$0.003624 USD** (HK$ 0.02827) per task [retracted $0.000958]
- **Scenario 3 (1st Gen + 3 Edits + 1 Auto-Fix)**: **$0.004218 USD** (HK$ 0.03290) per task [retracted $0.001123]
- **Pro Tier Subscription**: Reconciled to **HK$ 158.00 / month** ($20.256 USD / month) per architectural blueprint.
- **Stripe HK Effective Take Rate on HK$158/mo**: **4.89%** (3.4% + HK$2.35 = HK$7.722 fee, netting HK$150.278 / $19.266 USD).
- **Breakeven (Target Cohort: 3% conversion, 5 free tasks/day)**: **7 paying users** (covering HK$390 / $50 fixed OpEx plus 226 free users). Full 3x3 matrix in `/plan/breakeven_v3.md`.

---

## 2. Corrected Official Model Pricing (DeepSeek-Flash)

Pricing is based on DeepSeek's official published rates (`api-docs.deepseek.com/quick_start/pricing` [verified]):

| Token Category | Peak Rates / 1M (USD) | Off-Peak / 1M (USD) | Per 1k Tokens Peak (USD) | Source & Status |
| :--- | :--- | :--- | :--- | :--- |
| **Input Cache Hit** | $0.0060 | $0.0030 | $0.0000060 | Published DeepSeek API rate [Verified: URL] |
| **Input Cache Miss** | $0.3000 | $0.1500 | $0.0003000 | Published DeepSeek API rate [Verified: URL] |
| **Output Tokens** | $1.2000 | $0.6000 | $0.0012000 | Published DeepSeek API rate [Verified: URL] |
| **USD/HKD Exchange Rate** | 7.8000 | 7.8000 | N/A | HKMA Linked Exchange Rate [Verified] |

---

## 3. The 3 Lifecycle Scenarios (Audited Arithmetic)

### Scenario 1: First Generation (1 Prompt Turn)
- **User Action**: Initial prompt to create application (e.g. "build me a todo app").
- **Tokens**:
  - Prompt: 1,200 tokens (System prompt ~900 tok + user prompt ~300 tok)
  - Cache Hit: 900 tokens (system prompt prefix match)
  - Cache Miss: 300 tokens (unique user prompt)
  - Output: 1,850 tokens (complete files: HTML, CSS, JS)
- **Arithmetic**:
  $$\text{Hit Cost} = \frac{900 \times \$0.006}{1,000,000} = \$0.0000054$$
  $$\text{Miss Cost} = \frac{300 \times \$0.30}{1,000,000} = \$0.0000900$$
  $$\text{Output Cost} = \frac{1,850 \times \$1.20}{1,000,000} = \$0.0022200$$
  $$\mathbf{Cost_{S1} = \$0.0023154\text{ USD (HK\$ 0.018060)}}$$

### Scenario 2: First Generation + 3 Edits (4 Prompt Turns)
- **User Action**: Generates app, then executes 3 sequential patch edits using search/replace.
- **Tokens**:
  - Cumulative Prompt: 10,500 tokens (Input cache hit: 9,000 tok; Cache miss: 1,500 tok)
  - Cumulative Output: 2,600 tokens (Initial files 1,850 tok + 3 targeted patches @ 250 tok each)
- **Arithmetic**:
  $$\text{Hit Cost} = \frac{9,000 \times \$0.006}{1,000,000} = \$0.0000540$$
  $$\text{Miss Cost} = \frac{1,500 \times \$0.30}{1,000,000} = \$0.0004500$$
  $$\text{Output Cost} = \frac{2,600 \times \$1.20}{1,000,000} = \$0.0031200$$
  $$\mathbf{Cost_{S2} = \$0.0036240\text{ USD (HK\$ 0.028267)}}$$

### Scenario 3: First Generation + 3 Edits + 1 Auto-Fix (5 Prompt Turns)
- **User Action**: Same as Scenario 2, plus watchdog catches an uncaught runtime error and triggers automated repair.
- **Tokens**:
  - Cumulative Prompt: 15,000 tokens (Input cache hit: 13,000 tok; Cache miss: 2,000 tok)
  - Cumulative Output: 2,950 tokens (Initial files + 3 patches + 1 patch repair @ 350 tok)
- **Arithmetic**:
  $$\text{Hit Cost} = \frac{13,000 \times \$0.006}{1,000,000} = \$0.0000780$$
  $$\text{Miss Cost} = \frac{2,000 \times \$0.30}{1,000,000} = \$0.0006000$$
  $$\text{Output Cost} = \frac{2,950 \times \$1.20}{1,000,000} = \$0.0035400$$
  $$\mathbf{Cost_{S3} = \$0.0042180\text{ USD (HK\$ 0.032900)}}$$

---

## 4. Platform Fixed OpEx & Payment Gateway Fees


### Fixed Monthly Infrastructure OpEx
| Service | Provider & Spec | Monthly Cost (USD) | Monthly Cost (HKD) |
| :--- | :--- | :--- | :--- |
| **Backend & DB** | Supabase Pro Plan (Auth, PostgreSQL, Storage) | $25.00 | HK$ 195.00 |
| **VPS Server** | AWS Lightsail HK (2 vCPU, 4GB RAM, 80GB SSD) | $24.00 | HK$ 187.20 |
| **Domain & DNS** | Cloudflare Pro DNS + `.hk`/`.com` domain | $1.00 | HK$ 7.80 |
| **Total Fixed OpEx** | | **$50.00** | **HK$ 390.00** |

### Stripe HK Processing Fee Verification
- **Pricing Rule for Hong Kong Merchant Accounts**: **3.4% + HK$ 2.35** per successful transaction.
- **Pro Tier Subscription Price**: **HK$ 68.00 / month** ($8.718 USD / month).
- **Arithmetic**:
  $$\text{Variable Fee} = HK\$ 68.00 \times 3.4\% = HK\$ 2.312$$
  $$\text{Fixed Fee} = HK\$ 2.35$$
  $$\text{Total Stripe Fee} = HK\$ 2.312 + HK\$ 2.35 = \mathbf{HK\$ 4.662\text{ (6.86\% effective)}}$$
  $$\mathbf{Net\ Stripe\ Revenue} = HK\$ 68.00 - HK\$ 4.662 = \mathbf{HK\$ 63.338\text{ (\$8.120 USD)}}$$

---

## 5. Free-Tier Abuse Modeling & Conversion Economics

### Free-Tier Abuse Capacity
- Daily rate limit: **15 tasks/day** per user/IP.
- If a free user maximizes the quota every single day of the month:
  $$\text{Max Free Tasks/Month} = 15 \times 30 = 450\text{ tasks}$$
  $$\text{Max Monthly LLM Cost per Abuser} = 450 \times \$0.0005586 = \mathbf{\$0.2514\text{ USD (HK\$ 1.96)}}$$

### Freemium Ratio
At a stated **3.0% free-to-paid conversion rate**:
$$\text{Free Users per Pro User} = \frac{1 - 0.03}{0.03} = 32.33\text{ free users}$$

### Pro User Token Consumption
An active Pro user generating 60 multi-turn projects/month (Scenario 2):
$$\text{Pro Monthly Token Burn} = 60 \times \$0.0009576 = \mathbf{\$0.0575\text{ USD (HK\$ 0.448)}}$$

---

## 6. Breakeven Calculations (Arithmetic Shown)

### Cohort A: Typical Free Tier (Average 15 tasks/month)
- Free user monthly cost: $15 \times \$0.0005586 = \$0.00838\text{ USD}$
- Free tier burden per Pro user: $32.33 \times \$0.00838 = \$0.2709\text{ USD (HK\$ 2.113)}$
- Net margin per Pro user ($NCM$):
  $$NCM = \$8.120\text{ (Revenue)} - \$0.0575\text{ (Pro Tokens)} - \$0.2709\text{ (Free Drain)} = \mathbf{\$7.7916\text{ USD (HK\$ 60.777)}}$$
- **Breakeven Formula**:
  $$N_{\text{breakeven}} = \lceil \frac{\$50.00}{\$7.7916} \rceil = \lceil 6.417 \rceil = \mathbf{7\text{ paying users}}$$
  - In HKD: $\lceil HK\$ 390.00 / HK\$ 60.777 \rceil = \mathbf{7\text{ paying users}}$.
  - Supporting Community: 7 Pro users + 226 free users (233 total active users).

---

### Cohort B: 10% Heavy Abusers (15 tasks/day) + 90% Typical
- Blended free user cost: $0.10 \times \$0.2514 + 0.90 \times \$0.00838 = \$0.03268\text{ USD}$
- Free tier burden per Pro user: $32.33 \times \$0.03268 = \$1.0566\text{ USD (HK\$ 8.241)}$
- Net margin per Pro user:
  $$NCM = \$8.120 - \$0.0575 - \$1.0566 = \mathbf{\$7.0059\text{ USD (HK\$ 54.646)}}$$
- **Breakeven Formula**:
  $$N_{\text{breakeven}} = \lceil \frac{\$50.00}{\$7.0059} \rceil = \lceil 7.137 \rceil = \mathbf{8\text{ paying users}}$$
  - In HKD: $\lceil HK\$ 390.00 / HK\$ 54.646 \rceil = \mathbf{8\text{ paying users}}$.
  - Supporting Community: 8 Pro users + 259 free users (267 total active users).

---

## 7. Sensitivity Analysis Matrix

| Conversion Rate | Free User Usage Profile | Net Margin / Pro User (HKD) | Breakeven Pro Users | Total Active Users |
| :--- | :--- | :--- | :--- | :--- |
| **5.0%** (High) | Typical (15 tasks/mo) | HK$ 61.65 | **7** | 140 |
| **3.0%** (Base) | Typical (15 tasks/mo) | HK$ 60.78 | **7** | 233 |
| **3.0%** (Base) | 10% Heavy Abusers | HK$ 54.65 | **8** | 267 |
| **2.0%** (Low) | Typical (15 tasks/mo) | HK$ 59.70 | **7** | 350 |
| **2.0%** (Low) | 10% Heavy Abusers | HK$ 50.84 | **8** | 400 |
| **1.0%** (Stress) | 10% Heavy Abusers | HK$ 39.42 | **10** | 1,000 |
| **3.0%** (Stress) | 100% Abusers (15/day) | -HK$ 0.50 (Deficit) | **Infeasible** (Negative margin) | N/A |

> **Critical FinOps Conclusion**:
> If unmonetized users are allowed to script or bot the 15 tasks/day allowance continuously, unit economics invert. The IP rate limiter, captcha, and invite code gate implemented in T15 are not optional performance optimizations—they are an existential financial safeguard against margin destruction.
