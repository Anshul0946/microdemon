# 02 — CQI Architecture Spec

This file defines **how** CQI is built technically: tech stack, file structure, data flow,
database schema, and API contracts. It implements (but does not change) the product
behavior defined in `01_PRODUCT_BLUEPRINT.md`.

If any code you write conflicts with this spec, this spec wins.

---

## 1. Tech stack

| Layer        | Choice                                          | Reason                                                 |
|--------------|--------------------------------------------------|--------------------------------------------------------|
| Framework    | Next.js 14 App Router + TypeScript              | Server Components, API routes, Vercel-native           |
| Styling      | Tailwind CSS + CSS variables from design system | Fast, consistent, token-driven                         |
| Database     | Supabase Postgres                               | Managed Postgres, JSONB, easy MCP integration         |
| External data| Apify actors via MCP                            | Robust public web/data scraping                        |
| AI (dev)     | NVIDIA NIM (OpenAI-compatible HTTP API)         | Free dev access, easy to swap                          |
| AI (prod)    | OpenAI-compatible Bedrock endpoint              | Enterprise-grade, swapped via env only                |
| Hosting      | Vercel                                          | Native support for Next.js & edge/server runtimes     |

All security-sensitive work (external APIs, DB) is done in **server context** only.

---

## 2. Environment variables

Environment variables live in `.env.local`. They are **never** hardcoded in code.

Provide `.env.example` with the same keys, but empty values.

```env
# Apify tokens (rotate across calls)
APIFY_TOKEN_1=
APIFY_TOKEN_2=
APIFY_TOKEN_3=
APIFY_TOKEN_4=

# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# AI Model (dev/test — NVIDIA NIM)
AI_MODEL_BASE_URL=https://integrate.api.nvidia.com/v1
AI_MODEL_API_KEY=
AI_MODEL_ID=meta/llama-3.1-8b-instruct

# When swapping to production AI (e.g. Bedrock), ONLY change these:
# AI_MODEL_BASE_URL=YOUR_PROD_OPENAI_COMPATIBLE_ENDPOINT
# AI_MODEL_API_KEY=YOUR_PROD_KEY
# AI_MODEL_ID=your-prod-model-id

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Swap rule:**  
To move from NIM to production AI, only `AI_MODEL_*` change. No code changes.

---

## 3. Repository structure (must-follow)

The repo structure must follow this layout as its backbone. You may add files,
but do not rename or remove the core ones without updating this spec.

```text
cqi-app/
  app/
    layout.tsx                     # Root layout: fonts, global styles, shell
    page.tsx                       # Landing + intake + inline results
    report/
      [domain]/
        page.tsx                   # Full diagnostic report page
    resolution/
      [domain]/
        page.tsx                   # Resolution Protocol page (later)
    api/
      audit/
        route.ts                   # POST /api/audit – main pipeline
      report/
        route.ts                   # GET /api/report?domain=...
      export-pdf/
        route.ts                   # POST /api/export-pdf (later phase)

  components/
    layout/
      Header.tsx
      Footer.tsx
    intake/
      IntakeForm.tsx               # Domain + sliders (+ optional competitor in later part)
      SliderField.tsx              # Reusable slider UI
    execution/
      ExecutionLog.tsx             # Live step log while audit runs
    report/
      ExecutiveSummary.tsx         # Top-level CQI + equity loss summary
      CQIGauge.tsx                 # Circular CQI gauge
      RiskFragilityAlert.tsx       # High-risk banner / alert
      ValuationBand.tsx            # Bear / Base / Bull band display
      EvidenceBadge.tsx            # full/partial/simulated status badge
      MethodologyDrawer.tsx        # “How this was calculated” expandable panel
      modules/
        ModuleAdSignal.tsx         # Module 1 UI
        ModuleStockout.tsx         # Module 2 UI
        ModuleTechStack.tsx        # Module 3 UI
        ModuleAIVisibility.tsx     # Module 4 UI
        ModuleValuation.tsx        # Module 5 UI
    competitive/
      CompetitiveBenchmark.tsx     # Comparison vs competitor (later)

  lib/
    data/                          # SHARED DATA LAYER (only place for external calls)
      apify/
        client.ts                  # Generic Apify runner with token rotation
        shopifyAnalyzer.ts         # Shopify raw data
        metaAds.ts                 # Meta ads (max 10)
        googleAds.ts               # Google ads (max 10)
                       #  (max 10)
        similarweb.ts              # Traffic/channel mix
        googleSearch.ts            # AI Mode queries for benchmarks + PR
                         # Review sentiment/density from search
      nim/
        client.ts                  # OpenAI-compatible AI client wrapper (NIM/Bedrock)
      supabase/
        client.ts                  # Supabase reads/writes for audit records
      index.ts                     # Re-exports for clean imports

    cqi/                           # PURE LOGIC – NO EXTERNAL CALLS
      types.ts                     # Normalized types, module outputs, result shape
      evidence.ts                  # Evidence vectors, dataMode, confidence score
      normalize.ts                 # Raw actor output → NormalizedStoreData
      scoring.ts                   # computeCQIScore()
      financial.ts                 # computeAnnualRevenue(), valuation, risk discount, equity loss
      modules/
        adSignal.ts                # Module 1 logic
        stockout.ts                # Module 2 logic
        techStack.ts               # Module 3 logic
        aiVisibility.ts            # Module 4 logic
        valuation.ts               # Module 5 logic

    utils/
      validation.ts                # Domain validation, Shopify check helpers
      formatters.ts                # Currency, percent, and number formatting helpers

  tests/
    lib/
      financial.test.ts
      scoring.test.ts
      evidence.test.ts
      modules/
        adSignal.test.ts
        stockout.test.ts
        techStack.test.ts
        aiVisibility.test.ts
        valuation.test.ts
    api/
      audit.test.ts                # Integration test for /api/audit

  public/                          # Static assets (logo, favicon, etc.)

  00_README.md
  01_PRODUCT_BLUEPRINT.md
  02_ARCHITECTURE.md
  03_DESIGN_SYSTEM.md
  04_DATA_LAYER.md
  PART_1_UI_FOUNDATION.md
  PART_2_MODULE1_AD_SIGNAL.md
  PART_3_MODULE2_STOCKOUT.md
  PART_4_MODULE3_TECHSTACK.md
  PART_5_MODULE4_AI_VISIBILITY.md
  PART_6_MODULE5_VALUATION.md
  PART_7_COMPETITIVE_BENCHMARK.md
  PART_8_PDF_EXPORT.md
  QA_CHECKLIST.md
  agent.md
  rules.md
```

---

## 4. High-level data flow (end-to-end)

This is how a single audit request moves through the system.

1. **User submits the intake form** on `app/page.tsx`
   - Inputs:
     - `domain`
     - `spend` (+ optional `spendExact`)
     - `aov`
     - `returnRate`
     - `promoFrequency`
     - `vertical`
     - (Later) `competitorDomain` (optional)

2. **API: `POST /api/audit` (`app/api/audit/route.ts`)**
   1. Parse and validate the request (using `lib/utils/validation.ts`).
   2. Check Supabase cache via `lib/data/supabase/client.ts`:
      - If a fresh audit exists for this `shopify_url` (not expired), return it.
   3. If no cache or expired, call Apify actors in parallel through `lib/data/apify/*.ts`:
      - `getShopifyStoreData`
      - `getMetaAds`
      - `getGoogleAds`
      - `getAds`
      - `getSimilarwebData`
      - `getCategoryBenchmarks` + `getBrandPRContext`
      - `getReviewSentiment`
   4. Build `evidenceState` (which vectors returned usable data) and call `determineDataMode` from `lib/cqi/evidence.ts`:
      - Sets `dataMode` and `evidenceConfidenceScore`.
   5. Prepare a compact raw payload (raw outputs + slider inputs) and send to AI via `lib/data/nim/client.ts`:
      - System prompt: “You are a data normalizer… return JSON matching this TS type…”
      - User content: JSON string containing raw Apify outputs and sliders.
      - AI returns structured JSON.
   6. Parse AI JSON into `NormalizedStoreData` in `lib/cqi/normalize.ts`.
   7. Compute:
      - CQI score with `computeCQIScore` in `lib/cqi/scoring.ts`.
      - Financials with `lib/cqi/financial.ts`.
      - Module outputs with each `lib/cqi/modules/*.ts`.
   8. Compose `NormalizedAuditResult` object.
   9. Flatten and save it in Supabase via `lib/data/supabase/client.ts`.
   10. Return `NormalizedAuditResult` as JSON.

3. **Frontend uses response**:
   - `app/page.tsx` shows a quick summary (grade + small highlight).
   - `app/report/[domain]/page.tsx` fetches via `GET /api/report` and renders full report.

---

## 5. Supabase schema

There is a single main table for audits.

```sql
CREATE TABLE IF NOT EXISTS public.cqi_diagnostic_audits (
  shopify_url               TEXT PRIMARY KEY,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  run_id                    TEXT,

  -- User inputs
  user_spend_tier           NUMERIC NOT NULL,
  user_spend_exact          NUMERIC,
  user_aov                  NUMERIC NOT NULL,
  user_return_rate          NUMERIC NOT NULL,
  user_discount_frequency   NUMERIC NOT NULL,
  vertical_selected         TEXT,
  vertical_refined          TEXT,

  -- CQI outputs
  cqi_master_grade          INTEGER NOT NULL,
  cqi_label                 TEXT,
  evidence_confidence_score NUMERIC(5,2),
  data_mode                 TEXT CHECK (data_mode IN ('full','partial','simulated')),

  -- Financial outputs
  inferred_annual_revenue   NUMERIC(15,2),
  ideal_value_base          NUMERIC(15,2),
  ideal_value_bear          NUMERIC(15,2),
  ideal_value_bull          NUMERIC(15,2),
  risk_discount_percent     NUMERIC(5,2),
  equity_loss               NUMERIC(15,2),

  -- Module payloads
  module_ad_signal          JSONB DEFAULT '{}'::jsonb,
  module_stockout           JSONB DEFAULT '{}'::jsonb,
  module_tech_stack         JSONB DEFAULT '{}'::jsonb,
  module_ai_visibility      JSONB DEFAULT '{}'::jsonb,
  module_valuation          JSONB DEFAULT '{}'::jsonb,
  competitor_benchmark      JSONB DEFAULT '{}'::jsonb,

  -- Cache
  cache_expires_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cqi_domain ON public.cqi_diagnostic_audits (shopify_url);
```

Rules:

- Each `shopify_url` has at most one active row (upsert per run).
- `cache_expires_at` controls re-use vs re-scraping.
- Module payloads are kept as JSONB for flexibility.

If you add columns, update this file and `lib/data/supabase/client.ts` flattening logic.

---

## 6. API contracts

### 6.1 POST `/api/audit`

**Request body (JSON):**

```json
{
  "domain": "brand.com",
  "spend": 50000,
  "spendExact": 430000,
  "aov": 110,
  "returnRate": 0.2,
  "promoFrequency": 0.45,
  "vertical": "Apparel"
}
```

(Later, may include `"competitorDomain": "otherbrand.com"`.)

**Response body:**

- A `NormalizedAuditResult` object as defined in `lib/cqi/types.ts`.
- Contains:
  - `store: NormalizedStoreData`
  - `cqi: CQIScore`
  - `valuation: ValuationResult`
  - `modules: ModuleOutputs`
  - `dataMode: 'full' | 'partial' | 'simulated'`
  - `evidenceConfidenceScore`
  - `evidenceState`
  - `runId`, `createdAt`

### 6.2 GET `/api/report?domain=brand.com`

- Returns the latest cached `NormalizedAuditResult` for `shopify_url = domain`.
- If no record exists or cache expired, may return 404 or ask frontend to trigger `/api/audit`.

### 6.3 POST `/api/export-pdf` (later phase)

**Request body:**

```json
{
  "domain": "brand.com"
}
```

**Behavior:**

- Internally loads the report page or a dedicated print layout.
- Generates a PDF server-side.
- Returns a binary PDF response.

Exact library choice must be compatible with Vercel (headless Chromium or HTML→PDF).

---

## 7. AI (NIM / Bedrock) wrapper design

**File:** `lib/data/nim/client.ts`

Requirements:

- Uses an OpenAI-compatible client (e.g., `OpenAI` from `openai` package).
- Reads `AI_MODEL_BASE_URL`, `AI_MODEL_API_KEY`, `AI_MODEL_ID`.
- Exposes one main function like:

```ts
export async function callAIModel(
  systemPrompt: string,
  userContent: string,
  maxTokens = 2048
): Promise<string> {
  // ...
}
```

- Always sets `response_format: { type: 'json_object' }` to force JSON.
- Returns `string` (raw JSON text) that `normalize.ts` will parse.

**No math is done in this wrapper;** it only helps reformat and summarize data.

---

## 8. Integration with the product blueprint

This architecture exists to implement `01_PRODUCT_BLUEPRINT.md` exactly:

- Inputs (domain + sliders) map to `SliderInputs` in `lib/cqi/types.ts`.
- Evidence vectors map to raw outputs from `lib/data/apify/*`.
- Evidence mode and confidence map to `lib/cqi/evidence.ts`.
- CQI vectors and weights map to `lib/cqi/scoring.ts`.
- Financial model (revenue, valuation, risk, equity loss) maps to `lib/cqi/financial.ts`.
- Modules map to `lib/cqi/modules/*.ts` and their respective components.

You must not change product behavior at this level; you only define how it is
wired together and where each responsibility lives.

---

If you follow this architecture, the implementation will remain modular, testable, and easy to extend across the 8 build parts.