# 04 — Shared Data Layer (lib/data)

This file defines how **all external data access** works and how it feeds the CQI logic.

Rule:  
No component, module, or API route may call Apify, Supabase, or AI models directly.  
They must import functions from `lib/data/`.

---

## 1. Directory structure

```text
lib/
  data/
    apify/
      client.ts           # generic Apify runner with token rotation
      shopifyAnalyzer.ts  # Shopify store data
      metaAds.ts          # Meta ads data
      googleAds.ts        # Google ads data
      similarweb.ts       # Traffic and channel mix
      googleSearch.ts     # AI Mode queries for benchmarks, PR context, and reviews
    nim/
      client.ts           # AI model wrapper (NIM/Bedrock, OpenAI-compatible)
    supabase/
      client.ts           # Supabase read/write helpers
    index.ts              # Optional re-exports for clean imports

  cqi/
    types.ts              # Core data types (normalized, modules, result)
    evidence.ts           # Evidence vectors, dataMode, confidence score
    normalize.ts          # Raw actor output → NormalizedStoreData
    scoring.ts            # CQI master grade computation
    financial.ts          # Revenue, valuation, risk, equity loss
    modules/
      adSignal.ts         # Module 1 logic
      stockout.ts         # Module 2 logic
      techStack.ts        # Module 3 logic
      aiVisibility.ts     # Module 4 logic
      valuation.ts        # Module 5 logic
```

`lib/data/*` is the **only** place that talks to the outside world.

`lib/cqi/*` is pure logic; it only consumes inputs from `lib/data`.

---

## 2. Apify client — token rotation

**File:** `lib/data/apify/client.ts`

Responsibility:

- Provide a single function to run any Apify actor.
- Handle:
  - Token rotation across `APIFY_TOKEN_1..4`
  - Basic retry behavior on 5xx or rate limits
  - Normalizing the actor response into a typed result

Environment:

```env
APIFY_TOKEN_1=
APIFY_TOKEN_2=
APIFY_TOKEN_3=
APIFY_TOKEN_4=
```

Conceptual implementation:

```ts
const APIFY_TOKENS = [
  process.env.APIFY_TOKEN_1,
  process.env.APIFY_TOKEN_2,
  process.env.APIFY_TOKEN_3,
  process.env.APIFY_TOKEN_4,
].filter(Boolean) as string[]

if (!APIFY_TOKENS.length) {
  throw new Error('No Apify tokens configured')
}

interface RunApifyOptions<TInput> {
  actorId: string
  input: TInput
  timeoutMs?: number
}

export async function runApifyActor<TInput, TResult>({
  actorId,
  input,
  timeoutMs = 60_000,
}: RunApifyOptions<TInput>): Promise<TResult | null> {
  // Loop over tokens; on rate-limit/5xx, try next token
  // On success: parse JSON → TResult
  // On failure with all tokens: return null, do not throw
}
```

**Behavior:**

- If all tokens fail for a given actor:
  - Return `null`.
  - Let `evidence.ts` mark that evidence vector as missing.
- You **never** crash the whole pipeline due to one actor failure.

---

## 3. Per-actor wrappers (`lib/data/apify/*.ts`)

Each external data source gets a wrapper that:

- Accepts typed parameters.
- Calls `runApifyActor` with the correct `actorId` and `input`.
- Enforces **max 10 ads** where relevant.
- Swallows low-level errors and returns safe defaults (`[]` or `null`).

### 3.1 Shopify analyzer

**File:** `lib/data/apify/shopifyAnalyzer.ts`  
**Function:** `getShopifyStoreData(domain: string)`

Behavior:

- Uses an actor that:
  - Confirms the domain is Shopify.
  - Returns:
    - Products + variants, with availability and price.
    - Collections.
    - Installed apps.
    - Pixels / tags.
- If the actor fails or store is not accessible:
  - Return `null` or a typed “not Shopify / not found” result.

### 3.2 Meta ads

**File:** `lib/data/apify/metaAds.ts`  
**Function:** `getMetaAds(brandName: string, domain: string)`

Behavior:

- Query by page name + domain hint.
- Return up to 10 ads max.
- Each ad includes:
  - `id`, `platform`, `creativeType`, `destinationUrl`, `headline`, `text`, `startDate`, etc.
- On failure:
  - Return `[]`.

### 3.3 Google ads

**File:** `lib/data/apify/googleAds.ts`  
**Function:** `getGoogleAds(brandName: string, domain: string)`

Behavior:

- Similar to Meta wrapper.
- Return up to 10 ads max.
- Capture `destinationUrl`, `headline`, `adType`.

### 3.4 Similarweb-style traffic

**File:** `lib/data/apify/similarweb.ts`  
**Function:** `getTrafficProfile(domain: string)`

Behavior:

- Return:
  - `monthlyVisitsEstimate`
  - `channelMix` (paid, organic, direct, etc.)
  - `topCountries`
- On failure:
  - Return `null`.

### 3.5 Google Search (AI Mode) — benchmarks + PR & Reviews

**File:** `lib/data/apify/googleSearch.ts`  

Functions:

- `getCategoryBenchmarks(vertical: string)`:
  - Use AI Mode to get:
    - Typical CPC for the vertical
    - Typical CR
    - Bear/Base/Bull revenue multiples
    - Required gross margin band
- `getBrandPRContext(domain: string, vertical?: string)`:
  - Query Google Search with AI Mode to fetch brand context and reviews.
  - Return:
    - `googleAiNarrative` (AI Overview summary text)
    - `googleAiCitations` (citations URLs)
    - `perplexityAnswerSummary`, `chatGptAnswerSummary`, `copilotAnswerSummary`, `geminiAnswerSummary` (other AI platform summaries)
    - `aiNarrativeConsensusLevel` (Jaccard similarity J-score of overlap percentage)
    - `organicCompetitorDomains` (deduplicated domains from search results)
    - `brandReviewSnippets` (up to 4 positive and 4 negative customer review snippets classified via keyword heuristics and/or ratings)
    - `primaryAudienceHints` (target audience details)
    - `latestNewsHeadlines` (top stories / news items)

### 3.5.1 Google AI / Search Integration Details

#### 1. Input Construction & Query Formation
The scraper input queries are built dynamically to target brand reviews, customer quality feedback, and AI Overviews.
- **Query Format**: `${domain} ${vertical} brand review customer quality` (e.g. `gymshark.com Apparel brand review customer quality`).
- **Clean and Minimal Input Payload**:
  ```json
  {
    "queries": "...",
    "searchType": "web",
    "maxPagesPerQuery": 1,
    "resultsPerPage": 10,
    "countryCode": "us",
    "languageCode": "en",
    "googleAiMode": "withSearchResults",
    "aiModeSearch": { "enableAiMode": true },
    "perplexitySearch": { "enablePerplexity": true },
    "chatGptSearch": { "enableChatGpt": true },
    "copilotSearch": { "enableCopilot": true },
    "geminiSearch": { "enableGemini": true },
    "maximumLeadsEnrichmentRecords": 0,
    "saveHtml": false,
    "saveHtmlToKeyValueStore": false,
    "includePeopleAlsoAsk": false,
    "includeRelatedSearches": false,
    "includeLocalResults": false,
    "includeProductResults": false,
    "includeOrganicResults": true,
    "includePaidResults": true
  }
  ```
- **Unnecessary Features Disabled**: Features like People Also Ask (PAA), local search, and product/shopping results are explicitly set to `false`. This reduces payload sizes, eliminates noise, and minimizes execution times. We retain `includeOrganicResults` and `includePaidResults` for competitor extraction, reviews parsing, and ad checking.

#### 2. Output Schema (`NormalizedGoogleAiContext`)
The raw response is parsed and mapped into the internal `NormalizedGoogleAiContext` type:
```typescript
export interface NormalizedGoogleAiContext {
  hasAiOverview: boolean                    // True if an AI Overview is present and valid
  googleAiNarrative: string                 // Text narrative from Google AI
  googleAiCitations: string[]               // Citation URLs cited in Google's overview
  perplexityAnswerSummary: string | null    // Perplexity summary text
  chatGptAnswerSummary: string | null       // ChatGPT summary text
  copilotAnswerSummary: string | null       // Copilot summary text
  geminiAnswerSummary: string | null        // Gemini summary text
  aiNarrativeConsensusLevel: number         // 0-100 percentage consensus between models
  organicCompetitorDomains: string[]        // Extracted hostnames of competitor brands
  brandReviewSnippets: {
    positive: ReviewSnippet[]               // Up to 4 positive customer review snippets
    negative: ReviewSnippet[]               // Up to 4 negative customer review snippets
  }
  primaryAudienceHints: string[]            // Deduced target audience details
  latestNewsHeadlines: NewsHeadline[]       // Latest news stories/headlines
  organicCompetitorCount: number            // Total organic results returned
  hasAds: boolean                           // True if search ads are present
  
  // Upgraded analysis fields (computed via NVIDIA NIM)
  estimatedGrossMargin: number              // Inferred gross margin decimal (e.g. 0.72)
  estimatedGrossMarginRange: string         // Inferred gross margin range string (e.g. "70-75%")
  brandTrafficScale: string                 // "small" | "mid" | "large"
  audienceAlignmentScore: number            // Score of alignment (0-100)
  geoAlignmentScore: number                 // Score of geo alignment (0-100)
  audienceGeoNarrative: string              // Narrative summary of demographics and geos
}
```

#### 3. Module & Feature Dependencies
- **Brand Overview (Report Header)**: Uses `brandOverview` (synthesized from the Google AI narrative and storefront products) to display the niche, category, brand description, main product types, best sellers, target audience, and website promos.
- **Module 1 (Ad Signal Contamination)**: Reads `brandPRContext.estimatedGrossMargin` to dynamicize unit economics calculation instead of hardcoding a 65% baseline margin.
- **Module 4 (AI Visibility)**: Uses narratives, citations, summaries, news, consensus level, reviews density/snippets, and audience/geo alignment scores.
- **Competitive Shadow Benchmark**: Reads the first domain from `organicCompetitorDomains` to automatically trigger the shadow competitor audit.

#### 4. Failures & Timeout Fallback Behavior
- **Timeout Limit**: Set at `120000ms` (120 seconds) for the sync run, after which the client aborts to prevent hanging requests.
- **Fallback Generation**: If a network error, timeout, or 404/500 occurs, the wrapper catches it and returns a default structure via `getFallbackGoogleAiContext(domain, vertical, errorDetail)`.
- **UI Treatment**:
  - `hasAiOverview` is set to `false`.
  - The Brand Overview block and AI Visibility block display clean, user-friendly indicators and fallbacks (e.g. "Brand overview unavailable from AI" or "AI narratives unavailable") instead of leaving sections blank or crashing the page.

---

## 4. NIM / AI client (`lib/data/nim/client.ts`)

This is the **only** file that talks to NVIDIA NIM or a production AI model.

Environment:

```env
AI_MODEL_BASE_URL=
AI_MODEL_API_KEY=
AI_MODEL_ID=
```

Conceptual implementation:

```ts
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: process.env.AI_MODEL_BASE_URL,
  apiKey: process.env.AI_MODEL_API_KEY,
})

export async function callAIModel(
  systemPrompt: string,
  userContent: string,
  maxTokens = 2048
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: process.env.AI_MODEL_ID!,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    response_format: { type: 'json_object' },
    max_tokens: maxTokens,
  })

  const content = completion.choices.message.content
  if (!content) {
    throw new Error('AI model returned empty content')
  }

  return content
}
```

Rules:

- `callAIModel` must **only** be used for:
  - Normalizing raw actor outputs into `NormalizedStoreData`.
  - Summarizing complex text (PR, reviews) into structured fields.
- No math or scoring is delegated to the AI.

---

## 5. Supabase client (`lib/data/supabase/client.ts`)

This file encapsulates:

- Creating a Supabase client using service role key.
- Reading and writing CQI audit records.

Environment:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Conceptual implementation:

```ts
import { createClient } from '@supabase/supabase-js'
import type { NormalizedAuditResult } from '../cqi/types'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
  }
)

export async function getAuditFromCache(domain: string): Promise<NormalizedAuditResult | null> {
  const { data, error } = await supabase
    .from('cqi_diagnostic_audits')
    .select('*')
    .eq('shopify_url', domain)
    .maybeSingle()

  if (error || !data) return null

  // Map flat row into NormalizedAuditResult (see types.ts)
  return mapRowToNormalizedResult(data)
}

export async function saveAuditResult(
  domain: string,
  result: NormalizedAuditResult
): Promise<void> {
  const row = mapResultToRow(domain, result)

  await supabase.from('cqi_diagnostic_audits').upsert(row)
}
```

Mapping functions (`mapRowToNormalizedResult`, `mapResultToRow`) live in this file or a sibling helper. They must:

- Keep parity with the Supabase schema in `02_ARCHITECTURE.md`.
- Serialize module outputs into JSONB fields.

---

## 6. Core types (`lib/cqi/types.ts`)

This file defines all key domain types used across the app.

At minimum, it must include:

```ts
export type DataMode = 'full' | 'partial' | 'simulated'

export interface SliderInputs {
  spend: number           // monthly ad spend (slider)
  spendExact?: number     // optional exact spend
  aov: number             // average order value
  returnRate: number      // 0–1
  promoFrequency: number  // 0–1
  vertical: string        // e.g. 'Apparel'
}

export interface QuantitativeMetrics {
  productCount: number
  variantCount: number
  activeMetaAds: number
  activeGoogleAds: number
  
  estimatedTraffic: number | null
}

export interface TechStackSnapshot {
  apps: string[]
  pixels: string[]
}

export interface AIReadabilitySnapshot {
  productSchemaPresent: boolean
  reviewSchemaPresent: boolean
  orgSchemaPresent: boolean
  crawlableReviews: boolean
  missingSchemaTypes: string[]
}

export interface NormalizedStoreData {
  domain: string
  brandName: string | null
  sliders: SliderInputs
  quantitativeMetrics: QuantitativeMetrics
  techStack: TechStackSnapshot
  aiReadability: AIReadabilitySnapshot
  // you can add additional normalized fields (category, geo, etc.)
}

export interface CQIScore {
  grade: number   // 0–100
  label: string   // “Asset Compounder” etc.
}

export interface ValuationResult {
  annualRevenue: number
  idealValueBear: number
  idealValueBase: number
  idealValueBull: number
  riskDiscountPercent: number
  equityLoss: number
}

/* Module outputs (simplified here; each PART file will extend them) */
export interface ModuleAdSignalOutput {
  passedPixelValue: number
  realUnitProfit: number
  signalDistortionPercent: number
  couponDependencyImpact: number
  topContaminationSources: string[]
  dreamStateDescription: string
  dreamStateDollarImpact: number
}

export interface ModuleStockoutOutput {
  conflictUrls: Array<{ url: string; adNetwork: string; stockoutRatio: number }>
  variantDeficitShare: number
  estimatedMonthlyWaste: number
  dreamStateDescription: string
  dreamStateDollarImpact: number
}

export interface ModuleTechStackOutput {
  detectedPremiumTools: string[]
  estimatedAnnualSaasSpend: number
  toolsUnderutilized: string[]
  leaksExistDespiteTools: boolean
  dreamStateDescription: string
  dreamStateDollarImpact: number
}

export interface ModuleAIVisibilityOutput {
  indexScore: number
  schemaValid: boolean
  crawlableReviews: boolean
  missingSchemaTypes: string[]
  dreamStateDescription: string
  dreamStateDollarImpact: number
}

export interface ModuleValuationOutput {
  annualRevenue: number
  idealValueBase: number
  riskDiscountPercent: number
  equityLoss: number
  dreamStateDescription: string
  dreamStateDollarImpact: number
}

export interface ModuleOutputs {
  adSignal: ModuleAdSignalOutput | null
  stockout: ModuleStockoutOutput | null
  techStack: ModuleTechStackOutput | null
  aiVisibility: ModuleAIVisibilityOutput | null
  valuation: ModuleValuationOutput | null
  competitorBenchmark?: any // later
}

export interface EvidenceState {
  shopify: boolean
  ads: boolean
  techStack: boolean
  reviews: boolean
  schema: boolean
}

export interface NormalizedAuditResult {
  store: NormalizedStoreData
  sliders: SliderInputs
  cqi: CQIScore
  valuation: ValuationResult
  modules: ModuleOutputs
  evidenceState: EvidenceState
  evidenceConfidenceScore: number
  dataMode: DataMode
  runId: string
  createdAt: string
}
```

The exact fields may be extended by the PART files, but all logic must use these types consistently.

---

## 7. Evidence logic (`lib/cqi/evidence.ts`)

This file contains:

- Functions to derive `EvidenceState` from raw data presence.
- Function to compute `dataMode` (`'full' | 'partial' | 'simulated'`).
- Function to compute `evidenceConfidenceScore` 0–100.

Example conceptual API:

```ts
export function buildEvidenceState(args: {
  shopifyData: any | null
  adsMeta: any[]
  adsGoogle: any[]
  ads: any[]
  techStack: any | null
  reviews: any | null
  aiReadability: AIReadabilitySnapshot | null
}): EvidenceState {
  // ...
}

export function determineDataMode(evidence: EvidenceState): DataMode {
  // ...
}

export function computeEvidenceConfidence(evidence: EvidenceState): number {
  // ...
}
```

`/api/audit` must call these before computing modules and valuation.

---

## 8. Normalize (`lib/cqi/normalize.ts`)

This file is the bridge between raw actor outputs + AI JSON and `NormalizedStoreData`.

Responsibilities:

- Take:
  - Raw Apify outputs
  - Slider inputs
  - AI JSON from `callAIModel`
- Return:
  - `NormalizedStoreData` and any auxiliary normalized bits needed for modules.

Key rules:

- All unstructured arrays and messy fields must be normalized here.
- Modules should read from `NormalizedStoreData`, not raw actor output.

---

## 9. Scoring & financial (`lib/cqi/scoring.ts`, `lib/cqi/financial.ts`)

These files implement:

- `computeCQIScore(normalized: NormalizedStoreData, moduleOutputs: ModuleOutputs, verticalConfig): CQIScore`
- `computeAnnualRevenue(sliders, macroBenchmarks)`
- `computeValuationBand(annualRevenue, macroBenchmarks)`
- `computeRiskDiscount(normalized, modules)`
- `computeEquityLoss(idealValueBase, riskDiscountPercent)`

All formulas must match the conceptual ones in `01_PRODUCT_BLUEPRINT.md`.

No external calls; pure functions only.

---

## 10. Modules (`lib/cqi/modules/*.ts`)

Each module file:

- Accepts:
  - `NormalizedStoreData`
  - Whatever additional pre-normalized raw slices are needed (ads, reviews, etc.)
  - Other module outputs if specified
- Returns:
  - The relevant `ModuleXOutput` type.

Rules:

- No calls to Apify, Supabase, or AI.
- No side effects.
- Deterministic: same input → same output.

`/api/audit` orchestrates module calls in a clear order:

1. Module 1 (Ad Signal) → uses normalized + sliders.
2. Module 2 (Stockout) → uses normalized + raw ad URLs.
3. Module 3 (Tech Stack) → uses normalized + module 1 & 2 outputs.
4. Module 4 (AI Visibility) → uses normalized + review data.
5. Module 5 (Valuation) → uses normalized + macro benchmarks + modules.

---

Use this file as the **definitive map** for where data lives, how it flows, and where logic is allowed to talk to external services.