# PART 5 — Module 4: Conversational Engine Invisibility Index

Goal of this part:

- Implement **Module 4** (Conversational Engine Invisibility Index) end-to-end.
- Score how visible and understandable the brand is to AI search engines.
- Extend the report UI to include Module 4.
- Clearly label when the result is based on **simulation mode** vs real evidence.

Do **not** modify Modules 1–3 behavior or implement valuation logic in this part.

---

## 1. Scope of Part 5 (what you MUST do)

You MUST:

1. Ensure schema and review-related fields are normalized into `NormalizedStoreData.aiReadability`.
2. Define and implement `ModuleAIVisibilityOutput` in `lib/cqi/types.ts`.
3. Implement `buildAIVisibilityModule` in `lib/cqi/modules/aiVisibility.ts`.
4. Extend `/api/audit` to:
   - Call the relevant actors (`googleSearch`, `reviews`) if not already used.
   - Pass required data into Module 4.
   - Attach Module 4 output to `modules.aiVisibility`.
5. Build `components/report/modules/ModuleAIVisibility.tsx` to render Module 4.
6. Show **Simulation Mode** messaging clearly when `dataMode = 'simulated'` or evidence is thin.
7. Add unit tests for Module 4 logic and extend `/api/audit` integration tests.

You MUST NOT:

- Ask AI to decide the final numeric score; it must be computed in TypeScript.
- Change the evidence mode logic already implemented in `evidence.ts`.
- Implement valuation (Module 5) here.

---

## 2. Conceptual question and angle

**Question:**  
Can modern AI search engines (ChatGPT, Gemini, Perplexity, etc.) **see**, **parse**, and **trust** this brand’s storefront?

Module 4 focuses on:

- Presence and quality of structured data (schema).
- Review volume and crawlability.
- Overall **AI visibility index** (0–100).

High index → easy to understand, reputable, structured brand in the eyes of AI engines.  
Low index → brand is effectively invisible or ambiguous in AI-driven interfaces.

---

## 3. Inputs for Module 4

### 3.1 From normalized store data (`NormalizedStoreData.aiReadability`)

At minimum:

```ts
export interface AIReadabilitySnapshot {
  productSchemaPresent: boolean
  reviewSchemaPresent: boolean
  orgSchemaPresent: boolean
  crawlableReviews: boolean
  missingSchemaTypes: string[]
}
```

Populate these in `normalize.ts` using:

- On-page JSON-LD detection (from Shopify analyzer HTML).
- Simple checks of presence/absence.

### 3.2 From Google Search AI & Reviews Scraper

From `lib/data/apify/googleSearch.ts` (already specified in `04_DATA_LAYER.md`):

- `reviewDensity` — numeric score calculated from the presence and volume of organic reviews (positive + negative) retrieved (e.g. 0 to 1).
- `crawlableReviews` — boolean indicating whether any reviews were detected.
- `brandReviewSnippets` — positive/negative arrays of extracted reviews.
- `aiNarrativeConsensusLevel` — multi-AI consensus percentage (J-score overlap).

If the search scraper fails or returns nothing, these fallback safely to empty sets and low/absent evidence.

---

## 4. Index scoring logic (0–100)

The AI Visibility Index is a composite of:

1. **Schema coverage** (up to 80 points).
2. **Review presence & crawlability** (up to 20 points).

### 4.1 Schema scoring (0–80 points)

Base points:

- Product schema present: +40 points.
- Review schema present: +20 points.
- Organization/website schema present: +20 points.

Pseudo-code:

```ts
let schemaScore = 0

if (ai.productSchemaPresent) schemaScore += 40
if (ai.reviewSchemaPresent) schemaScore += 20
if (ai.orgSchemaPresent) schemaScore += 20

// Clamp to[1]
schemaScore = Math.max(0, Math.min(80, schemaScore))
```

Penalty for missing important schema types:

- If `missingSchemaTypes` includes `Product`, `Review`, or `Organization`, you may apply small negative adjustments, but do not drop below 0.

### 4.2 Reviews scoring (0–20 points)

Base on:

- `reviewDensity` (0–1).
- `crawlableReviews` (boolean).

Pseudo-code:

```ts
let reviewsScore = 0

reviewsScore += reviewDensity * 15   // 0–15 points
if (crawlableReviews) {
  reviewsScore += 5                  // bonus for crawlability
}

// Clamp to[2]
reviewsScore = Math.max(0, Math.min(20, reviewsScore))
```

### 4.3 Final index score

```ts
const indexScore = schemaScore + reviewsScore // 0–100
```

This is the main number displayed in Module 4.

---

## 5. Type definitions (`lib/cqi/types.ts`)

Define or confirm `ModuleAIVisibilityOutput`:

```ts
export interface ModuleAIVisibilityOutput {
  indexScore: number               // 0–100
  schemaValid: boolean             // true if key schema types present
  crawlableReviews: boolean
  missingSchemaTypes: string[]     // e.g. ['Product', 'Review']
  dreamStateDescription: string
  dreamStateDollarImpact: number
}
```

“Schema valid” in v1 can be defined as:

```ts
schemaValid = productSchemaPresent && orgSchemaPresent
```

You may refine later.

---

## 6. Module logic (`lib/cqi/modules/aiVisibility.ts`)

**Signature:**

```ts
import {
  NormalizedStoreData,
  ModuleAIVisibilityOutput,
} from '../types'

export interface ReviewsRaw {
  reviewDensity: number      // 0–1
  crawlableReviews: boolean
  // optional: sentimentScore, complaintThemes[]
}

export function buildAIVisibilityModule(args: {
  normalized: NormalizedStoreData
  reviews: ReviewsRaw | null
}): ModuleAIVisibilityOutput {
  // ...
}
```

### 6.1 Implementation outline

1. Extract `ai` from `normalized.aiReadability`.

2. Compute schema score:

```ts
let schemaScore = 0
if (ai.productSchemaPresent) schemaScore += 40
if (ai.reviewSchemaPresent) schemaScore += 20
if (ai.orgSchemaPresent) schemaScore += 20

schemaScore = Math.max(0, Math.min(80, schemaScore))
```

3. Normalize `reviewsRaw`:

```ts
const reviewDensity = reviews?.reviewDensity ?? 0
const crawlableReviews = reviews?.crawlableReviews ?? false

let reviewsScore = reviewDensity * 15
if (crawlableReviews) reviewsScore += 5
reviewsScore = Math.max(0, Math.min(20, reviewsScore))
```

4. Compute `indexScore`:

```ts
const indexScore = schemaScore + reviewsScore
```

5. Compute `schemaValid`:

```ts
const schemaValid = ai.productSchemaPresent && ai.orgSchemaPresent
```

6. Determine `missingSchemaTypes`:

- Already in `ai.missingSchemaTypes` (from normalization).
- Just pass through.

7. Compose `dreamStateDescription`:

```ts
const dreamStateDescription =
  'Your brand is fully legible to AI search engines: product, organization, and review schema are all present, clean, and updated, and a dense layer of crawlable reviews supports trust signals.'
```

8. Compute `dreamStateDollarImpact` (v1 heuristic):

- Rather than exact math, set a rough heuristic based on index gap:

```ts
const indexGap = Math.max(0, 100 - indexScore) // 0–100
// Heuristic: each missing point corresponds to a modest annual opportunity
const dreamStateDollarImpact = indexGap * 500 // e.g. up to ~$50k
```

This will be refined when tying into Module 5, but it gives a number to anchor the narrative.

9. Return:

```ts
return {
  indexScore,
  schemaValid,
  crawlableReviews,
  missingSchemaTypes: ai.missingSchemaTypes,
  dreamStateDescription,
  dreamStateDollarImpact,
}
```

---

## 7. Pipeline changes in `/api/audit/route.ts`

Extend the pipeline:

1. Call `getBrandPRContext(domain, vertical)` in the parallel step group:

```ts
const [techStackRawData, metaAdsRaw, googleAdsRaw, categoryBenchmarks, brandPRContext] = await Promise.all([
  getBuiltWithTechStack(normalized),
  getMetaAds(brandName, normalized),
  getGoogleAds(brandName, normalized),
  getCategoryBenchmarks(sliders.vertical),
  getBrandPRContext(normalized, sliders.vertical),
])
```

2. Pass `brandPRContext` reviews data (or a normalized subset) into `buildAIVisibilityModule`:

```ts
const positiveCount = brandPRContext?.brandReviewSnippets?.positive?.length || 0
const negativeCount = brandPRContext?.brandReviewSnippets?.negative?.length || 0
const totalReviews = positiveCount + negativeCount
const reviewDensity = totalReviews >= 6 ? 1.0 : totalReviews >= 3 ? 0.66 : totalReviews >= 1 ? 0.33 : 0
const crawlableReviews = totalReviews > 0

const aiVisibility = buildAIVisibilityModule({
  normalized: storeData,
  reviews: brandPRContext
    ? {
        reviewDensity,
        crawlableReviews,
        googleAiNarrative: brandPRContext.googleAiNarrative,
        googleAiCitations: brandPRContext.googleAiCitations,
        perplexityAnswerSummary: brandPRContext.perplexityAnswerSummary,
        chatGptAnswerSummary: brandPRContext.chatGptAnswerSummary,
        copilotAnswerSummary: brandPRContext.copilotAnswerSummary,
        geminiAnswerSummary: brandPRContext.geminiAnswerSummary,
        aiNarrativeConsensusLevel: brandPRContext.aiNarrativeConsensusLevel,
        organicCompetitorDomains: brandPRContext.organicCompetitorDomains,
        brandReviewSnippets: brandPRContext.brandReviewSnippets,
        primaryAudienceHints: brandPRContext.primaryAudienceHints,
        latestNewsHeadlines: brandPRContext.latestNewsHeadlines,
      }
    : null,
})
```

3. Attach to `modules.aiVisibility`:

```ts
const modules: ModuleOutputs = {
  adSignal,
  stockout,
  techStack,
  aiVisibility,
  valuation: valuationModule,
}
```

4. Evidence logic:
   - Derive `evidenceState.reviews` by checking whether `brandReviewSnippets` contain any items.
   - Derive `evidenceState.schema` from the presence of `storeData.aiReadability`.

`dataMode` and `evidenceConfidenceScore` will automatically reflect this.

---

## 8. Module 4 UI (`components/report/modules/ModuleAIVisibility.tsx`)

Props:

```ts
type ModuleAIVisibilityProps = {
  data: ModuleAIVisibilityOutput
  dataMode: 'full' | 'partial' | 'simulated'
}
```

Layout:

- Standard module card pattern.
- Top:
  - Label: `MODULE 4 — CONVERSATIONAL ENGINE INVISIBILITY INDEX`.
  - Title: `AI Visibility`.

Body:

Left column — CURRENT STATE:

- Key number: `indexScore` (mono, large, e.g. `72/100`).
- Under it, textual label: “AI Visibility Index”.
- Data rows:
  - Schema coverage:
    - If `schemaValid`: “Core schema present”.
    - Else: “Core schema missing”.
  - Missing schema types:
    - If any, show short list (e.g., “Missing: Review, Organization”).
  - Reviews:
    - “Crawlable reviews: Yes/No”.

Right column — DREAM STATE:

- `dreamStateDescription` (short paragraph).
- Dollar impact:
  - `dreamStateDollarImpact` (annual, formatted).
  - Label: “Estimated annual upside from closing AI visibility gap.”

Simulation Mode messaging:

- If `dataMode === 'simulated'` OR `missingSchemaTypes` list is based primarily on assumptions:

  - Show a small badge or inline text at the top of the card:
    - “SIMULATION MODE: AI visibility score is estimated due to missing direct evidence.”
  - Use the evidence badge component or a slim variant inside the card.

Visual cues:

- Low `indexScore` (< 40) → consider showing a subtle red border or icon.
- Moderate (40–70) → neutral.
- High (70+) → subtle green accent.

---

## 9. Report page integration (`app/report/[domain]/page.tsx`)

Update report composition:

- After Module 3, render Module 4 if `modules.aiVisibility` is not null.
- Pass `dataMode` from `NormalizedAuditResult` to Module 4, so it can show simulation/badge.

Order:

1. ExecutiveSummary
2. ModuleAdSignal
3. ModuleStockout
4. ModuleTechStack
5. ModuleAIVisibility
6. (Later) ModuleValuation

---

## 10. Tests required in Part 5

### 10.1 Unit tests — `tests/lib/modules/aiVisibility.test.ts`

Test `buildAIVisibilityModule` behavior:

1. **No schema, no reviews:**
   - `productSchemaPresent = false`
   - `reviewSchemaPresent = false`
   - `orgSchemaPresent = false`
   - `reviews = null`
   - Expect:
     - `indexScore` close to 0.
     - `schemaValid = false`.
     - `crawlableReviews = false`.

2. **Full schema + dense crawlable reviews:**
   - All schema flags = true.
   - `reviewDensity = 1`, `crawlableReviews = true`.
   - Expect:
     - `indexScore` close to 100.
     - `schemaValid = true`.

3. **Partial schema with some reviews:**
   - Only product schema present.
   - `reviewDensity = 0.5`, `crawlableReviews = false`.
   - Expect:
     - `indexScore` between 20 and 70.
     - `dreamStateDollarImpact` > 0 (since there’s room to improve).

### 10.2 Integration test — extend `tests/api/audit.test.ts`

Add assertions:

- When `reviewsRaw` and `aiReadability` exist:
  - `modules.aiVisibility` exists and has:
    - `indexScore`
    - `schemaValid`
    - `missingSchemaTypes`
- For mocked scenarios:
  - Changing schema flags changes `indexScore`:
    - Full schema → higher index.
    - No schema → low index.

---

## 11. Manual QA for Part 5

Before moving to Part 6, manually verify:

1. For a brand with good schema and many reviews:
   - Module 4 shows a high index score.
   - Missing schema list is short or empty.
2. For a brand with almost no schema and few reviews:
   - Module 4 shows a low index score.
   - Missing schema list is meaningful.
3. If actors fail and you fall back to simulation:
   - Module clearly indicates simulation mode, and the user is not misled into thinking the number is fully evidence-backed.

---

## 12. Completion criteria for Part 5

Part 5 is **DONE** only when:

- `lib/cqi/modules/aiVisibility.ts` implements the logic described here.
- `/api/audit` constructs and attaches `modules.aiVisibility`.
- `ModuleAIVisibility.tsx` renders correctly in the report and clearly handles simulation vs real evidence.
- Unit tests for Module 4 logic pass.
- Extended `/api/audit` integration tests pass.
- All Part 5 items in `QA_CHECKLIST.md` are checked.

Once all of the above is true, you may proceed to **PART 6 — Module 5: Terminal Enterprise Valuation Markdown**.