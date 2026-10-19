# CQI Non‑Negotiable Build Rules

These rules are **absolute**. They override any instinct to “improve,” “simplify,” or
“experiment with architecture”.

If any rule here conflicts with your preferences, the rule wins.

---

## Rule 1 — Shared data layer is the ONLY gateway

All external services must be accessed through the shared data layer in `lib/data/`.

- Apify actors  
- Supabase (Postgres)  
- NVIDIA NIM / production AI model

**MUST** be called only via wrappers in `lib/data/…`.

**Correct:**

```ts
import { getMetaAds } from '@/lib/data/apify/metaAds'

const ads = await getMetaAds(brandName, domain)
```

**Wrong:**

```ts
// Direct HTTP call (NOT allowed)
await fetch('https://api.apify.com/v2/acts/solidcode/meta-ads-library-scraper', ...)

// Direct Supabase client inside a component (NOT allowed)
const supabase = createClient(...)
```

All new integration points must:

1. Be implemented as functions in `lib/data/`.
2. Be imported and used from there.

No exceptions.

---

## Rule 2 — No math inside AI model calls

All numeric logic lives in TypeScript in `lib/cqi/`.  
AI models are used **only** to:

- Normalize messy raw data into structured JSON.
- Summarize / label text when explicitly asked (e.g., PR context, review summaries).

You must **never** ask NIM or any AI model to:

- Calculate CQI scores.
- Calculate risk discounts.
- Calculate valuations.
- Aggregate metrics.

**Correct:**

```ts
const normalized = normalizeRawData(raw, sliders)
const cqi = computeCQIScore(normalized, verticalConfig)
const valuation = computeValuationBand(annualRevenue, macroMultiples)
```

**Wrong:**

```ts
// NOT allowed
await callAIModel(
  'Given this data, calculate the CQI score and valuation band and return them.'
)
```

If a formula or number appears in the blueprint, it must be implemented as a
deterministic function, not outsourced to AI.

---

## Rule 3 — Max 10 ads per network, always

All ad data must be capped at 10 creatives per network:

- Meta Ads Library (Meta)
- Google Ads

This protects cost and performance and keeps analysis consistent.

Each ad wrapper must:

1. Request at most 10 items (`maxItems: 10` or equivalent).
2. After receiving data, enforce `slice(0, 10)` in code as a second safety.

```ts
const ads = (result as AdRaw[]).slice(0, 10)
```

You must not increase this limit without changing the blueprint.

---

## Rule 4 — Evidence mode must be computed for every audit

For every CQI audit, you must compute:

- Which evidence vectors are available
  - Shopify (products/variants)
  - Ads (Meta / Google)
  - Tech stack
  - Reviews
  - Schema / AI readability
- `dataMode` as:
  - `'full'`
  - `'partial'`
  - `'simulated'`
- `evidenceConfidenceScore` as a 0–100 number reflecting coverage.

`determineDataMode(evidenceState)` in `lib/cqi/evidence.ts` must be called inside
`/api/audit` before computing modules and valuation.

The UI must always be able to show which mode the report is in.

---

## Rule 5 — Zero auth, zero email gate in v1

Version 1 of CQI has:

- No login
- No signup
- No password reset
- No OAuth
- No email capture forms
- No paywall

The only inputs are:

- Shopify domain
- Sliders (spend, AOV, return rate, promo frequency, vertical)
- Optional competitor domain in later parts

You must not introduce any authentication flows unless the blueprint is updated.

---

## Rule 6 — AI model wrapper must be drop‑in swappable

All AI model calls must route through `lib/data/nim/client.ts` (the “AI client”).

This file must:

- Read `AI_MODEL_BASE_URL`, `AI_MODEL_API_KEY`, and `AI_MODEL_ID` from environment.
- Use an OpenAI‑compatible client interface.
- Always request JSON output with `response_format: { type: 'json_object' }`.
- Return the generated JSON text as a string.

Swapping from NVIDIA NIM (dev) to a production AI model (e.g., Bedrock) must require:

- **Only** changing environment variables.
- **No changes** to API routes, CQI logic, or components.

If a change would require editing multiple files to swap models, that change is not allowed.

---

## Rule 7 — One part at a time (strict)

You must follow the PART files in order:

1. `PART_1_UI_FOUNDATION.md`
2. `PART_2_MODULE1_AD_SIGNAL.md`
3. `PART_3_MODULE2_STOCKOUT.md`
4. `PART_4_MODULE3_TECHSTACK.md`
5. `PART_5_MODULE4_AI_VISIBILITY.md`
6. `PART_6_MODULE5_VALUATION.md`
7. `PART_7_COMPETITIVE_BENCHMARK.md`
8. `PART_8_PDF_EXPORT.md`

While working on Part N:

- You do **not** implement features from Part N+1 or later.
- You do **not** pre-emptively add modules, benchmark logic, or PDF export.
- You only implement what Part N explicitly asks for.

If something clearly belongs to a later part, leave a comment:

```ts
// TODO: Implement in PART_X when specified
```

and skip it.

---

## Rule 8 — No hardcoded secrets, ever

All secrets and connection details must be read from environment variables:

- Apify tokens
- Supabase URL and service role key
- AI model base URL, key, and model ID

You must never:

- Hardcode tokens, keys, or private URLs in `.tsx`, `.ts`, or `.md` files.
- Commit `.env.local` to version control.

`02_ARCHITECTURE.md` defines the environment variables you should use.

---

## Rule 9 — Tests and QA checklist gate every part

A part is not “done” until:

1. All unit tests described in that PART file are implemented and passing.
2. All integration tests described in that PART file are implemented and passing.
3. Every relevant item in `QA_CHECKLIST.md` is checked.

You must not move from Part N to Part N+1 until those conditions are met.

If a test is flaky or failing, you must fix the implementation; disabling the test is not allowed.

---

## Rule 10 — Design system is locked

All UI must use the design tokens and patterns defined in `03_DESIGN_SYSTEM.md`:

- Colors via CSS variables (`--color-*`), not arbitrary hex codes.
- Typography via `--font-display`, `--font-body`, `--font-mono`.
- Spacing via `--space-*` variables.
- Component patterns (cards, buttons, evidence badges, gauge) as specified.

You must not:

- Introduce gradients, blobs, emoji, or generic SaaS visuals.
- Introduce light mode.
- Change the core color palette or fonts without updating `03_DESIGN_SYSTEM.md`.

If a new component is needed, it must visually fit within the existing system.

---

## Rule 11 — No silent breaking changes

When adding functionality in a later part:

- You must not break behavior that was already working in earlier parts.
- If a refactor is needed, it must preserve all previous test behavior and QA checklist items.

Regression = violation of this rule.

---

## Rule 12 — Blueprint is the source of truth

The conceptual behavior of CQI (what it measures, how modules behave, how valuation works)
is defined in `01_PRODUCT_BLUEPRINT.md`.

If any other file seems to contradict the blueprint:

- The blueprint wins.
- The conflicting file must be adjusted.
- You must not “invent” new product behavior on your own.

---

If you follow these rules exactly, the resulting implementation will match the intended CQI product and remain stable as it grows part by part.