# PART 7 — Competitive Shadow Benchmark

Goal of this part:

- Add an **optional competitor domain** input.
- Run a **lighter version** of the pipeline for the competitor.
- Show a **side-by-side summary** comparing the primary brand vs competitor.
- Keep the primary brand’s behavior unchanged.

Do **not** modify the core CQI logic, modules, or valuation formulas for the primary brand.

---

## 1. Scope of Part 7 (what you MUST do)

You MUST:

1. Remove the manual competitor input from the IntakeForm UI.
2. Extend `/api/audit` to:
   - Extract the first competitor from the Google AI results (`organicCompetitorDomains`).
   - Run a simplified pipeline for the competitor automatically if one is detected.
   - Attach a `competitorBenchmark` payload to the result.
3. Define a `CompetitorBenchmark` type in `lib/cqi/types.ts`.
4. Implement a `CompetitiveBenchmark` UI component showing side-by-side metrics.
5. Ensure all this works **without** changing main CQI scoring and valuation logic.

You MUST NOT:

- Reuse cached results between primary and competitor (treat each independently).
- Change the main brand’s CQI grade or valuation based on competitor data.
- Force competitor analysis if none are detected (it is skipped dynamically).


---

## 2. Input changes

### 2.1 Intake form (`components/intake/IntakeForm.tsx`)

Extend props:

```ts
type IntakeFormProps = {
  onSubmit: (payload: {
    domain: string
    spend: number
    spendExact?: number
    aov: number
    returnRate: number
    promoFrequency: number
    vertical: string
    competitorDomain?: string
  }) => void
  loading?: boolean
}
```

Add an **optional** text field:

- Label: “Competitor domain (optional)”
- Placeholder: `competitorbrand.com`
- This field is not required and should not block form submission if empty.

When building the payload:

- If the competitor field is non-empty after trimming, include `competitorDomain`.
- Otherwise, omit it or set it to `undefined`.

---

## 3. Types (`lib/cqi/types.ts`)

### 3.1 Competitor benchmark type

Define:

```ts
export interface CompetitorBenchmark {
  domain: string

  cqiGrade: number
  cqiLabel: string

  evidenceConfidenceScore: number
  dataMode: DataMode

  aiVisibilityIndex: number | null
  activeAdsTotal: number | null

  // Optional: rough valuation proxy (use annualRevenue * baseMultiple)
  baseValuationEstimate: number | null
}
```

### 3.2 NormalizedAuditResult extension

Extend `NormalizedAuditResult` and `ModuleOutputs` to include competitor:

```ts
export interface ModuleOutputs {
  adSignal: ModuleAdSignalOutput | null
  stockout: ModuleStockoutOutput | null
  techStack: ModuleTechStackOutput | null
  aiVisibility: ModuleAIVisibilityOutput | null
  valuation: ModuleValuationOutput | null
  competitorBenchmark?: CompetitorBenchmark | null
}

export interface NormalizedAuditResult {
  // existing fields...
  modules: ModuleOutputs
  // ...
}
```

---

## 4. Pipeline changes in `/api/audit/route.ts`

### 4.1 Request parsing

- When reading the request body, parse `competitorDomain` if present.
- Validate `competitorDomain` using the same `normalizeDomain` / `isValidDomain` helpers.
- If invalid:
  - Ignore and proceed without competitor analysis (do not fail entire request).

### 4.2 Running competitor pipeline (simplified)

If `competitorDomain` is valid:

1. Build a **minimal slider set** for competitor:

   - You may reuse the same sliders as primary brand for v1, or derive simple defaults:
     - `spend`: same as primary.
     - `aov`: same as primary.
     - `returnRate`: same as primary.
     - `promoFrequency`: same as primary.
     - `vertical`: same as primary.

   This keeps complexity low and emphasizes structural comparison.

2. Use a **separate internal helper** to run a **slim pipeline** for competitor:

   ```ts
   async function runCompetitorBenchmark(
     competitorDomain: string,
     sliders: SliderInputs
   ): Promise<CompetitorBenchmark | null> {
     // 1. Normalize domain
     // 2. Get Shopify data
     // 3. Get ads (Meta, Google, )
     // 4. Build evidence state and dataMode
     // 5. Optionally call AI normalizer (or reuse normalization logic)
     // 6. Compute CQI (same scoring function)
     // 7. Compute AI visibility from Module 4 logic (or a subset)
     // 8. Compute optional base valuation estimate
   }
   ```

3. The competitor pipeline should reuse:

   - `getShopifyStoreData`
   - `getMetaAds`, `getGoogleAds`, `getAds`
   - `buildEvidenceState`, `determineDataMode`
   - `callAIModel` + `normalize` (if not too expensive) OR a trimmed normalization path.
   - `computeCQIScore`
   - `buildAIVisibilityModule` (if reviews/schema can be reused)

4. For cost reasons, you may choose to **skip** heavy actors (reviews, PR) in competitor pipeline and just estimate AI visibility as `null` or low-confidence. The important part is the CQI grade comparison and active ads vs primary.

### 4.3 Attaching benchmark to main result

After main brand result is built:

```ts
let competitorBenchmark: CompetitorBenchmark | null = null

if (competitorDomain) {
  competitorBenchmark = await runCompetitorBenchmark(competitorDomain, sliders)
}

const modules: ModuleOutputs = {
  adSignal,
  stockout,
  techStack,
  aiVisibility,
  valuation: valuationModule,
  competitorBenchmark,
}

// build full NormalizedAuditResult...
```

If `runCompetitorBenchmark` fails or returns `null` (e.g., competitor not on Shopify), simply set `competitorBenchmark = null` and proceed without error.

---

## 5. Competitive benchmark helper (logic sketch)

**File:** You can put the helper in `lib/cqi/competitive.ts` or directly in `/api/audit/route.ts` if kept short, but prefer a separate file for clarity.

Steps:

1. Normalize `competitorDomain`.
2. Call:
   - `getShopifyStoreData(competitorDomain)`
   - `getMetaAds`, `getGoogleAds`, `getAds`
3. If Shopify data is missing or clearly not a D2C brand:
   - Return `null`.
4. Build a minimal `evidenceState` and `dataMode` with the same functions.
5. Call AI normalizer and compute `NormalizedStoreData` and modules **or**:
   - For v1, you can compute a **reduced CQI** using only:
     - Sliders, `activeAds`, and any obvious tech/AI visibility flags without full modules.
6. Compute:
   - `cqiGrade` and `cqiLabel` via `computeCQIScore`.
   - `aiVisibilityIndex` (from `buildAIVisibilityModule`) or set to `null` if skipping.
   - `activeAdsTotal` = `activeMetaAds + activeGoogleAds + `.
   - `baseValuationEstimate` = `annualRevenue * baseMultiple` (using same functions as main brand, but can be marked as low-confidence if some evidence is missing).

Return:

```ts
return {
  domain: competitorDomain,
  cqiGrade,
  cqiLabel,
  evidenceConfidenceScore: competitorEvidenceScore,
  dataMode: competitorDataMode,
  aiVisibilityIndex,
  activeAdsTotal,
  baseValuationEstimate,
}
```

---

## 6. Competitive benchmark UI (`components/competitive/CompetitiveBenchmark.tsx`)

Props:

```ts
type CompetitiveBenchmarkProps = {
  primaryDomain: string
  primaryCQI: CQIScore
  primaryValuation: ValuationResult
  primaryAiVisibilityIndex: number | null
  primaryActiveAdsTotal: number | null
  competitor: CompetitorBenchmark | null
}
```

Layout:

- Render **only** if `competitor` is not `null`.

Structure:

- Card title: `Competitive Shadow Benchmark`.
- Subtitle: e.g., `How you compare to {competitor.domain}`.
- Two-column table on desktop, stacked on mobile:

Columns:

1. **You**
2. **Competitor**

Rows:

- CQI grade:
  - Show grade + label (e.g., `78 – Efficiency Opportunity`).
- Evidence confidence:
  - Evidence score and data mode (badge).
- Active ads total:
  - e.g., `24 active ads` vs `15 active ads`.
- AI Visibility Index:
  - e.g., `68/100` vs `82/100` (or `—` if unknown).
- Base valuation estimate:
  - Show approximate base valuations (compact, e.g., `$18.2M` vs `$25.7M`) or `—` if unknown.

Visual cues:

- Use arrows or simple labels to highlight where the competitor is ahead.
- Do **not** overinterpret; just show data.

Example structure:

```tsx
export function CompetitiveBenchmark(props: CompetitiveBenchmarkProps) {
  const { primaryDomain, primaryCQI, primaryValuation, primaryAiVisibilityIndex, primaryActiveAdsTotal, competitor } = props

  if (!competitor) return null

  return (
    <div className="bg-cqi-surface border border-cqi-border rounded-xl p-6 space-y-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-cqi-muted">
            COMPETITIVE SHADOW BENCHMARK
          </p>
          <h2 className="mt-1 text-2xl font-display">
            You vs {competitor.domain}
          </h2>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 text-sm">
        {/* Left: You */}
        {/* Right: Competitor */}
      </div>
    </div>
  )
}
```

---

## 7. Report page integration (`app/report/[domain]/page.tsx`)

Placement:

- Put `CompetitiveBenchmark` **below** ExecutiveSummary and above modules, or at the end of the page under a “Compare” section.
- Pass necessary props extracted from `NormalizedAuditResult`:

  - `primaryDomain` from `store.domain`.
  - `primaryCQI` from `cqi`.
  - `primaryValuation` from `valuation`.
  - `primaryAiVisibilityIndex` from `modules.aiVisibility?.indexScore ?? null`.
  - `primaryActiveAdsTotal` from `store.quantitativeMetrics` (sum of ads).
  - `competitor` from `modules.competitorBenchmark`.

Behavior:

- If `modules.competitorBenchmark` is `null`:
  - Do not render the component at all.
- Otherwise:
  - Render full comparison.

---

## 8. Tests required in Part 7

### 8.1 Integration tests — `tests/api/audit.test.ts`

Add new tests:

1. **Without competitor:**
   - Submit a request without `competitorDomain`.
   - Assert:
     - `modules.competitorBenchmark` is `undefined` or `null`.
     - Primary brand behavior is unchanged.

2. **With competitor:**
   - Submit a request with `competitorDomain`.
   - Mock competitor pipeline to return a deterministic `CompetitorBenchmark`.
   - Assert:
     - Response includes `modules.competitorBenchmark`.
     - Primary brand’s `cqi.grade` and `valuation` stay the same as the no-competitor case.

### 8.2 Unit tests (optional but recommended)

- If `runCompetitorBenchmark` logic is non-trivial, add a unit test file
  `tests/lib/competitive.test.ts` to:
  - Ensure missing or non-Shopify competitors return `null`.
  - Ensure evidence and dataMode for competitor are computed consistently.

---

## 9. Manual QA for Part 7

Before finishing Part 7, manually verify:

1. Running an audit **without** a competitor:
   - Report looks exactly like before Part 7.
   - No empty competitor sections.
2. Running an audit **with** a competitor:
   - Benchmark card appears.
   - Values make sense (no NaN, unrealistic numbers).
3. Invalid competitor domain (e.g., blank or nonsense):
   - Main brand audit still works normally.
   - No crash; competitor section omitted.

---

## 10. Completion criteria for Part 7

Part 7 is **DONE** only when:

- Intake form includes an optional competitor domain field.
- `/api/audit` detects and processes competitor domain correctly.
- `CompetitorBenchmark` type is defined and used.
- CompetitiveBenchmark UI renders correctly when competitor data exists and is hidden otherwise.
- Main brand CQI and valuation behavior remain unchanged.
- New integration tests for `/api/audit` with/without competitor pass.
- All Part 7 items in `QA_CHECKLIST.md` are checked.

Once all of the above is true, you may proceed to **PART 8 — PDF Export & Resolution Protocol**.