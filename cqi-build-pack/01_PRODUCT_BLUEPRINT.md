# 01 — CQI Product Blueprint

This file defines **what** CQI is and how it behaves, independent of any implementation.
All other `.md` files in this folder exist to implement this blueprint exactly.

If any other file seems to contradict this one, this blueprint wins.

---

## 1. Product summary

**Name:** Customer Quality Index (CQI)  
**Format:** Zero-auth, browser-based diagnostic micro-SaaS  
**Target stack:** Shopify D2C only (no Amazon, no custom carts in v1)

CQI takes:

- A Shopify brand’s public domain  
- A small set of sliders the founder can move in 30 seconds  

and returns:

- A **0–100 CQI Master Grade** with a label  
- A **Bear / Base / Bull valuation band**  
- A **quantified equity loss** based on current leaks  
- **Five diagnostic modules** that show *where* the leaks are and *what* they cost

The report is designed to feel like:

- A cross between a private equity diligence memo  
- A risk engine output from a hedge fund  
- A “black box” institutional audit, not a marketing tool

---

## 2. Target user and JTBD

### 2.1 Target user

- Role: Founder / CEO / Owner of a Shopify D2C brand  
- Stage: ~$1M–$50M in annual revenue (self-reported via sliders)  
- Context:
  - Running paid ads (Meta, Google)
  - Feels that “things are off”: ROAS compressed, CAC rising, conversion unstable
  - Has already tried surface-level fixes (new creatives, more discounts)

### 2.2 Emotional job-to-be-done

> “Show me, with real numbers and real proof, exactly what is wrong with my business and what it is costing me.”

The tool does **not**:

- Ask them to connect ad accounts.
- Ask for data exports.
- Ask them to trust vibes.

It uses **public signals + minimal self-reporting** to approximate what a very expensive audit would tell them.

---

## 3. Inputs

CQI uses **one core input** plus **five sliders**.

### 3.1 Domain input

- A single text field: `brand.com`
- Assumptions:
  - It must be a Shopify store.
  - If not Shopify:
    - The tool can still run, but with lower confidence (e.g., simulation mode).

### 3.2 Sliders and fields

These are used to seed the financial model and calibrate some vectors.

1. **Monthly Ad Spend**
   - Slider: e.g., `$5K → $500K+` (log scale)
   - Optional exact input: numeric (e.g., `$430,000`)

2. **Average Order Value (AOV)**
   - Slider: e.g., `$20 → $500+`
   - Used to map revenue and profit per order

3. **Return / Refund Rate**
   - Slider: `0% → 60%`
   - Used to adjust real revenue and equity risk

4. **Promo / Coupon Frequency**
   - Slider: `Never → Rare → Sometimes → Often → Always`
   - Internally encoded as `0 → 1` scale (coupon dependency)

5. **Vertical (Category)**
   - Dropdown list: e.g., Apparel, Beauty, CPG, Supplements, Digital Products, etc.
   - Used to select the right CPC, CR, and multiple baselines.

The user should be able to answer all of this in under 30 seconds.

---

## 4. Data sources (public only)

CQI uses **public** signals. No ad account authentication, no GA connections.

Data sources per domain:

1. **Shopify Store Analyzer**
   - Products, variants, pricing
   - Stock status (available vs out-of-stock)
   - Installed apps and tracking pixels
   - Theme and tech stack hints

2. **Meta Ads Library**
   - Up to 10 active ads
   - Creative types (image/video/text)
   - Destinations (product pages, collections, homepage)
   - Active/inactive status, run time

3. **Google Ads**
   - Up to 10 ads per brand
   - Search / shopping / display mix
   - Headline/description copy
   - Landing URLs

4. **Similarweb-style traffic estimates**
   - Monthly visit estimates
   - Channel mix (paid, organic, direct, social)
   - Top countries

5. **Google AI Mode & Reviews (Gemini / AI search / multi-AI platform summaries)**
   - Category-level benchmarks:
     - Average CPC (cost per click) for the vertical
     - Average CR (conversion rate)
     - Typical revenue multiples (bear/base/bull) for similar brands
     - Required margin levels for sustainability
   - Brand PR context & reviews:
     - News, PR events
     - Customer review snippets (up to 4 positive, 4 negative) extracted from organic search results via ratings or sentiment-based heuristics
     - Multi-AI (ChatGPT, Perplexity, Copilot, Gemini) summaries and J-score consensus calculation
     - Review density (none/low/medium/high) and crawlability status derived from search results

6. **Schema / AI readability**
   - Presence and completeness of:
     - JSON-LD product schema
     - Review schema
     - Organization / website schema
   - Crawlability of key pages
   - Signals that affect AI search engines’ ability to “see” the brand

*Implementation details for each source live in `02_ARCHITECTURE.md` and `04_DATA_LAYER.md`, but the **concept** comes from here.*

---

## 5. Evidence vectors and modes

CQI uses five evidence vectors:

1. **Shopify product + variants data**
2. **Ads data (Meta / Google / TikTok)**
3. **Tech stack (apps + pixels)**
4. **Reviews and sentiment**
5. **Schema / AI readability**

### 5.1 Evidence sufficiency rule

For each evidence vector, the system marks it as available or unavailable.

- Count of available vectors = `n` (0–5).

Mode:

- If `n ≥ 3` → **Full Evidence Mode**
- If `n = 2` → **Partial Evidence Mode**
- If `n ≤ 1` → **Simulation & Schema Integrity Mode**

The UI must **always** show which mode is used and what the evidence confidence is.

### 5.2 Evidence confidence score (0–100)

A simple mapping, e.g.:

- 5 vectors → 90–100
- 4 vectors → 75–90
- 3 vectors → 60–75
- 2 vectors → 40–60
- 1 vector → 20–40
- 0 vectors → 0–20

The exact function is implemented in `evidence.ts`, but the **principle**:

- More diverse evidence = higher confidence.
- Thin evidence = more emphasis on sliders and category benchmarks, clearly labelled as simulation.

---

## 6. CQI Master Grade (0–100) — Composite scoring model

The CQI grade is a weighted composite score across Modules 1–4. Each module produces a 0–100 health score which is combined using the following weights:

### 6.1 Weight Distribution and Importance

1. **Module 1: Ad Signal Integrity (40% weight)**
   * **Why**: Optimization quality directly affects acquisition efficiency (top-of-funnel ROAS). High data reliability (sliders are always present).
   * **Formula**: `health1 = (100 - signalDistortionPercent) * 0.7 + (100 - couponDependencyImpact) * 0.3`
2. **Module 2: Stockout Conflict (25% weight)**
   * **Why**: Direct cash waste from sending ad traffic to out-of-stock items. High importance for operations.
   * **Formula**: `health2 = 100 - (variantDeficitShare * 0.5 + wasteShare * 0.5) * 100` (Fallback: `90` if products are missing/uncrawled).
3. **Module 3: Tech Stack Paradox (15% weight)**
   * **Why**: Measures SaaS efficiency and underutilization. Low direct margin impact compared to ads, but high strategic impact.
   * **Formula**: `health3 = 100` if no paradox detected, else `Math.max(30, 100 - (30 + underutilizedCount * 5))` (Fallback: `95` if BuiltWith crawl skipped).
4. **Module 4: AI Visibility (20% weight)**
   * **Why**: Represents long-term organic leverage and AI search engine readability.
   * **Formula**: `health4 = indexScore * 0.7 + consensus * 0.1 + audienceScore * 0.1 + geoScore * 0.1` (Fallback: `90` if Google Search crawl fails).

### 6.2 Missing Data vs Bad Data

To prevent penalizing brands with partial data/scrapes, the scoring distinguishes between:
* **Bad Data (Identified Risks)**: Low module health score resulting in weighted score reductions.
* **Missing Data (Crawl skipped/failed)**: Receives a small generic uncertainty penalty (e.g. 5–10 points off) rather than a worst-case 0 score.
  * *Module 2 missing*: Health score of `90`
  * *Module 3 missing*: Health score of `95`
  * *Module 4 missing*: Health score of `90`

### 6.3 Scoring Scenarios & Examples

#### Scenario A: High Paid Ads Spend but operational leaks (Gymshark-like)
* **Module 1**: Distortion is 30%, Coupons dependency is 10% (Health1 = 70 * 0.7 + 90 * 0.3 = 76)
* **Module 2**: Deficit Share is 40%, Waste Share is 20% (Health2 = 100 - (0.4 * 0.5 + 0.2 * 0.5) * 100 = 70)
* **Module 3**: Paradox active, 2 underutilized tools (Health3 = 100 - (30 + 10) = 60)
* **Module 4**: Index Score 80, Consensus 90, Alignment 95/95 (Health4 = 80 * 0.7 + 90 * 0.1 + 95 * 0.2 = 56 + 9 + 19 = 84)
* **Composite**: `76 * 0.40 (30.4) + 70 * 0.25 (17.5) + 60 * 0.15 (9) + 84 * 0.20 (16.8) = 73.7` -> Grade **74** (Efficiency Opportunity)

#### Scenario B: High Signal Contamination & Coupons dependency (Promo brand)
* **Module 1**: Distortion is 80%, Coupons is 90% (Health1 = 20 * 0.7 + 10 * 0.3 = 17)
* **Module 2**: Deficit Share is 10%, Waste is 5% (Health2 = 92)
* **Module 3**: Paradox active, 1 tool underutilized (Health3 = 100 - 35 = 65)
* **Module 4**: Index Score 90, Consensus 80, Alignment 85/85 (Health4 = 90 * 0.7 + 80 * 0.1 + 85 * 0.2 = 88)
* **Composite**: `17 * 0.40 (6.8) + 92 * 0.25 (23) + 65 * 0.15 (9.75) + 88 * 0.20 (17.6) = 57.15` -> Grade **57** (Signal Contaminated)

#### Scenario C: Competitor Audits (Missing Modules 2, 3, 4)
* **Module 1**: Distortion is 10%, Coupons is 10% (Health1 = 90)
* **Module 2**: Missing (Health2 = 90)
* **Module 3**: Missing (Health3 = 95)
* **Module 4**: Missing (Health4 = 90)
* **Composite**: `90 * 0.40 (36) + 90 * 0.25 (22.5) + 95 * 0.15 (14.25) + 90 * 0.20 (18) = 90.75` -> Grade **91** (Asset Compounder)

### 6.4 Grade labels

| Score | Label                        | Interpretation                                  |
|-------|------------------------------|----------------------------------------------|
| 85–100 | Asset Compounder            | Rare, clean, scalable asset                  |
| 70–84  | Efficiency Opportunity      | Good engine with leaks to fix                |
| 55–69  | Signal Contaminated         | Growing but with serious signal issues       |
| 40–54  | Structurally Leaking        | Structure itself is causing capital loss     |
| 0–39   | Capital Destruction Risk    | Growth destroys value rather than creating it|

## 7. The five diagnostic modules

Each module answers one core question and outputs both:

- **Current state** — quantified pain
- **Dream state** — quantified future if fixed

### 7.1 Module 1 — Ad Signal Contamination Matrix

**Question:**  
Are your ads optimizing on **real profit** or on **polluted, inflated signals**?

**Inputs:**

- Meta/Google ads data
- Sliders (AOV, return rate, promo frequency)
- Basic assumptions about margin

**Outputs (conceptual):**

- Passed pixel value (what the platforms see as “value per conversion”)
- Real unit profit (profit per order after returns)
- Signal distortion % (how far passed pixel value is from real profit)
- Coupon dependency impact (how much coupons distort the signal)
- Dream state description (what “clean” signal looks like)
- Dream state dollar impact (how much profit uplift is possible from cleaning the signal)

### 7.2 Module 2 — Best-Seller Stockout Conflict Ledger

**Question:**  
How much ad spend is running into **out-of-stock** or low-stock products?

**Inputs:**

- Shopify stock status per product/variant
- Ad destination URLs (Meta, Google)
- Slider: ad spend

**Outputs (conceptual):**

- List of conflict URLs (where significant stockout exists)
- Variant deficit share (ratio of out-of-stock variants)
- Estimated monthly wasted ad spend (ads → out-of-stock)
- Dream state description (ads only driving traffic to healthy inventory)
- Dollar impact of fixing this routing

### 7.3 Module 3 — Tech Stack Redundancy Paradox

**Question:**  
Are you paying for premium tools while still leaking basic signal and inventory quality?

**Inputs:**

- Shopify tech stack: apps and pixels
- Modules 1 and 2 outputs (are there still leaks?)
- Basic cost assumptions per tool

**Outputs:**

- List of premium tools detected (Triple Whale, Elevar, Klaviyo, etc.)
- Estimated annual SaaS spend
- Flag: `leaksExistDespiteTools` (are leaks present while premium tools are on?)
- Tools underutilized
- Dream state: fewer tools, fully utilized, no leaks
- Dollar impact: potential SaaS waste and reclaimed efficiency

### 7.4 Module 4 — Conversational Engine Invisibility Index

**Question:**  
Can AI search engines (ChatGPT, Gemini, Perplexity, etc.) actually see and trust this brand?

**Inputs:**

- Schema presence and completeness
- Review density and crawlability
- AI Mode search results context

**Outputs:**

- AI visibility / index score (0–100)
- Schema validity flag
- List of missing schema types
- Review crawlability flag
- Dream state: fully AI-readable storefront with clean schema + reviews
- Dollar impact: improved discoverability and brand safety

### 7.5 Module 5 — Terminal Enterprise Valuation Markdown

**Question:**  
What is this business worth today vs what it should be worth if leaks were fixed?

**Inputs:**

- Sliders (ad spend, AOV, return rate)
- Category benchmarks (CPC, CR, multiples, required margin)
- Module outputs (leaks and risk factors)

**Outputs:**

- Annual revenue estimate
- Bear / Base / Bull valuation band
- Risk discount %
- Equity loss (in dollars)
- Dream state: valuation without current leaks

---

## 8. Financial model (conceptual formulas)

All calculations must be implemented in TypeScript in `lib/cqi/financial.ts`.

### 8.1 Annual revenue

Conceptual formula:

```text
Annual Revenue = Monthly Ad Spend × (1 / CPC) × CR × AOV × 12
```

Where:

- CPC and CR come from category benchmarks (Google AI Mode) for the brand’s vertical.
- AOV and monthly ad spend come from sliders.
- Revenue floor: if the computed revenue < $1M, treat as $1M for reporting.

### 8.2 Valuation band

Conceptual formulas:

```text
Ideal Value Base = Annual Revenue × Base Multiple
Ideal Value Bear = Annual Revenue × Bear Multiple
Ideal Value Bull = Annual Revenue × Bull Multiple
```

Multiples:

- Base / Bear / Bull come from category benchmarks for the vertical.
- Example (not fixed): Apparel might be 1.5x (bear), 2.5x (base), 4x (bull).

### 8.3 Risk discount

Conceptually, risk discount is a function of:

- **Margin gap** — how far the actual margin is from required margin.
- **Stockout ratio** — severity of inventory conflicts.
- **AI readability gap** — difference between current AI visibility and ideal.
- **Signal contamination** — severity of signal distortion from Module 1.

Example conceptual formula:

```text
Risk Discount % =
    (margin_gap         × 0.35) +
    (stockout_ratio     × 0.25) +
    (ai_readability_gap × 0.20) +
    (signal_contamination × 0.20)
```

- All subcomponents normalized to 0–1 before weighting.
- Risk discount is **capped at 85%** (no more than that).

### 8.4 Equity loss

```text
Equity Loss = Ideal Value Base × (Risk Discount / 100)
```

This is the headline number shown in Module 5 and the Executive Summary.

---

## 9. Competitive shadow benchmark (later phase)

Optional feature:

- User can provide a second domain (competitor).
- CQI runs the same pipeline for the competitor.
- Outputs a comparison view showing:
  - CQI grade vs competitor
  - Creative volume / testing vs competitor
  - AI visibility vs competitor
  - Evidence confidence vs competitor

This is implemented later (see `PART_7_COMPETITIVE_BENCHMARK.md`), but the concept lives here.

---

## 10. Tone and language rules

The product’s language is as important as the math.

- Never say “we found”; say “the data shows”.
- Never soften leaks; say “this is costing you approximately $X per month”.
- Always convert percentages to dollar terms when possible.
- Avoid jargon where a clear phrase will do.
- Every module must show:
  - A **Current state** narrative (pain).
  - A **Dream state** narrative (aspiration).
  - A concrete **number** that connects them (dollars, not just percentages).

The user should leave feeling:

- Seen (“this describes my situation well”).
- Slightly punched in the gut by the leak numbers.
- Clear on what to fix, in which order, and why it matters financially.

---

This blueprint is the highest-level guide.  
All subsequent files specify how to implement it, step by step.