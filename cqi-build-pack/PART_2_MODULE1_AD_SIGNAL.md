# PART 2 — Module 1: Ad Signal Contamination Matrix

Goal of this part:

- Implement **Module 1** (Ad Signal Contamination Matrix) end-to-end.
- Extend `/api/audit` to pull Meta ads data.
- Extend the normalized data model and module outputs.
- Render Module 1 in the report UI.

Do **not** touch Modules 2–5, competitive benchmark, or PDF export in this part.

---

## 1. Scope of Part 2 (what you MUST do)

You MUST:

1. Wire Meta ads data into the pipeline via `lib/data/apify/metaAds.ts`.
2. Extend `NormalizedStoreData` and `ModuleAdSignalOutput` in `lib/cqi/types.ts`.
3. Implement `buildAdSignalModule` in `lib/cqi/modules/adSignal.ts`.
4. Extend `/api/audit` to:
   - Fetch Meta ads.
   - Pass necessary data to the module.
   - Attach Module 1 output to `modules.adSignal`.
5. Build `components/report/modules/ModuleAdSignal.tsx` to render the module card in the report view.
6. Add unit tests for Module 1 logic and extend the `/api/audit` integration test.

You MUST NOT:

- Implement Module 2–5 logic.
- Implement cross-module interactions (Module 1 depends only on normalized data and sliders).
- Change existing Part 1 UI patterns or design tokens.

---

## 2. Data and logic for Module 1

### 2.1 Conceptual question

**Question:**  
Are your ad platforms optimizing on **real profit per order** or on **inflated, contaminated signals** (gross revenue, coupons, distorted events)?

Module 1 aims to create a simple but powerful view of **signal distortion**.

### 2.2 Inputs for Module 1

- **From sliders:**
  - `aov` (Average Order Value).
  - `returnRate` (0–1).
  - `promoFrequency` (0–1, representing coupon dependency).
  - `spend` (monthly ad spend, used later but not critical in basic v1).

- **From normalized data:**
  - `quantitativeMetrics.productCount` (rough sanity check).
  - If you have normalized Meta ads, you may add derived metrics later (creative count, etc.), but this is optional in Part 2.

### 2.3 Key concepts & simplified formulas (v1)

Let:

- `aov` = Average Order Value (from slider).
- `returnRate` = fraction 0–1 (from slider).
- Rather than a static 65% assumption, Module 1 utilizes a brand- and vertical-specific estimated gross margin (e.g. `estimatedGrossMargin` from Google AI Mode / NIM strategic analyst or the sliders). It falls back to `0.65` only when no specific margin estimate can be retrieved.

**1. Real Unit Profit**

Approximate how much profit is left per order after returns:

```text
realUnitProfit = aov × grossMarginApprox × (1 - returnRate)
```

Example:
- AOV = 100
- returnRate = 0.2 (20%)
- realUnitProfit = 100 × 0.65 × 0.8 = 52

**2. Passed Pixel Value**

In practice, platforms optimize on **revenue per conversion**, not profit.  
For v1, assume:

```text
passedPixelValue = aov  (they optimize on gross revenue per order)
```

**3. Signal Distortion %**

How far is the pixel’s view of value from real profit?

```text
distortionRaw = 1 - (realUnitProfit / max(passedPixelValue, 1))
signalDistortionPercent = clamp(distortionRaw, 0, 1) × 100
```

Where `clamp(x, 0, 1)` = `Math.max(0, Math.min(1, x))`.

Interpretation:

- 0% → No distortion (real profit ~ pixel value).
- 50% → Half the “value” is not real profit.
- 80%+ → Platforms are heavily misled.

**4. Coupon Dependency Impact**

From slider `promoFrequency` (0–1):

```text
couponDependencyImpact = promoFrequency × 100
```

Interpretation:

- 0–20% → disciplined on promos.
- 50–80% → frequent discounting, signal heavily polluted.
- 80–100% → brand is effectively coupon-driven.

Later, Module 5 (Valuation) will convert these into dollar impact; in Part 2 we just compute and display.

---

## 3. Type extensions (`lib/cqi/types.ts`)

Extend types to support Module 1 properly.

### 3.1 NormalizedStoreData

Add at least:

```ts
export interface QuantitativeMetrics {
  productCount: number
  variantCount: number
  activeMetaAds: number
  activeGoogleAds: number
  
  estimatedTraffic: number | null
}
```

In Part 2, you should populate `activeMetaAds` from Meta ads wrapper.

### 3.2 ModuleAdSignalOutput

Ensure it has:

```ts
export interface ModuleAdSignalOutput {
  contaminationNarrative?: string       // NIM-driven human explanation of why signal is distorted
  passedPixelValue: number              // value per conversion used by platforms
  realUnitProfit: number                // approx profit per order
  signalDistortionPercent: number       // 0–100
  couponDependencyImpact: number        // 0–100
  topContaminationSources: string[]     // e.g. ['High discount frequency']
  dreamStateDescription: string         // text description of ideal state
  dreamStateDollarImpact: number        // placeholder for now (0)
}
```

You will fill `topContaminationSources` minimally in Part 2 (e.g., based on thresholds).

---

## 4. Meta ads data wrapper (`lib/data/apify/metaAds.ts`)

Implement `getMetaAds(brandName: string, domain: string)`.

Responsibilities:

- Use `runApifyActor` from `client.ts` with the correct actor ID and input.
- Ensure:
  - Hard cap at 10 ads in code.
  - Reasonable fallback: return `[]` on failure.

Example shape:

```ts
export interface MetaAdRaw {
  id: string
  creativeType: 'image' | 'video' | 'carousel' | string
  destinationUrl: string | null
  primaryText?: string
  headline?: string
  startedAt?: string
}

export async function getMetaAds(
  brandName: string,
  domain: string
): Promise<MetaAdRaw[]> {
  const result = await runApifyActor<{ brandName: string; domain: string }, MetaAdRaw[]>({
    actorId: 'apify/meta-ads-actor-id', // actual ID set in code
    input: { brandName, domain },
  })

  if (!result) return []

  return result.slice(0, 10)
}
```

`/api/audit` will call this in Part 2.

---

## 5. Module logic (`lib/cqi/modules/adSignal.ts`)

Implement `buildAdSignalModule` as a pure function.

**Signature:**

```ts
import { NormalizedStoreData, ModuleAdSignalOutput } from '../types'

export function buildAdSignalModule(
  normalized: NormalizedStoreData
): ModuleAdSignalOutput {
  // ...
}
```

**Implementation (v1):**

```ts
export function buildAdSignalModule(
  normalized: NormalizedStoreData
): ModuleAdSignalOutput {
  const { sliders } = normalized
  const { aov, returnRate, promoFrequency } = sliders

  const grossMarginApprox = 0.65
  const realUnitProfit = aov * grossMarginApprox * (1 - returnRate)
  const passedPixelValue = aov

  const distortionRaw = 1 - realUnitProfit / Math.max(passedPixelValue, 1)
  const signalDistortionPercent = Math.max(0, Math.min(1, distortionRaw)) * 100

  const couponDependencyImpact = promoFrequency * 100

  const topContaminationSources: string[] = []
  if (signalDistortionPercent > 40) {
    topContaminationSources.push('Unit economics vs pixel value are significantly misaligned')
  }
  if (couponDependencyImpact > 50) {
    topContaminationSources.push('High reliance on discount codes')
  }

  const dreamStateDescription =
    'Your ad platforms optimize directly on net profit per order, with clean events that reflect true contribution margin and minimal coupon distortion.'

  const dreamStateDollarImpact = 0 // Will be tied to valuation in a later part

  return {
    passedPixelValue,
    realUnitProfit,
    signalDistortionPercent,
    couponDependencyImpact,
    topContaminationSources,
    dreamStateDescription,
    dreamStateDollarImpact,
  }
}
```

No external calls. No side effects. This function must be fully testable in isolation.

---

## 6. Pipeline changes in `/api/audit/route.ts`

Extend the Part 1 pipeline to include Module 1.

New steps:

1. After domain + sliders validation:
   - Normalize domain.
   - Optionally derive `brandName` (from Shopify data or simple transform of domain).

2. In addition to `getShopifyStoreData(domain)`, call:

   ```ts
   const [shopifyData, metaAds] = await Promise.all([
     getShopifyStoreData(domain),
     getMetaAds(brandName, domain),
   ])
   ```

3. Build `evidenceState` from `shopifyData` and `metaAds`:
   - `shopify = !!shopifyData`
   - `ads = metaAds.length > 0`
   - others remain `false` for now.

4. Call `callAIModel` to normalize:
   - System prompt must mention the TypeScript type to output as JSON.
   - User content should include:
     - `shopifyData`
     - `sliders`
     - (You may optionally include a summary of `metaAds` count, but not required yet.)

5. Parse AI JSON into `NormalizedStoreData` in `normalize.ts`.

6. Compute:

   ```ts
   const adSignal = buildAdSignalModule(normalizedStoreData)
   const cqi = computeCQIScore(normalizedStoreData, { adSignal }, verticalConfig)
   ```

   For now, `computeCQIScore` can combine:
   - Simple baseline from Part 1.
   - Penalty based on `signalDistortionPercent` and `couponDependencyImpact`.

7. Attach Module 1 output:

   ```ts
   const modules: ModuleOutputs = {
     adSignal,
     stockout: null,
     techStack: null,
     aiVisibility: null,
     valuation: null,
   }
   ```

8. Build and return `NormalizedAuditResult` including `modules.adSignal`.

---

## 7. Module 1 UI (`components/report/modules/ModuleAdSignal.tsx`)

This component renders the Ad Signal Contamination Matrix.

Props:

```ts
type ModuleAdSignalProps = {
  data: ModuleAdSignalOutput
}
```

Layout:

- Use the module card pattern from `03_DESIGN_SYSTEM.md`.
- Top:
  - Module label: `MODULE 1 — AD SIGNAL CONTAMINATION MATRIX` (xs, uppercase).
  - Title: `Ad Signal Integrity` (2xl, display font).
- Body:
  - Two columns (stack on mobile):
    - Left: CURRENT STATE
      - Key number: `signalDistortionPercent` (large, mono, `%`).
      - 3–4 metrics:
        - Passed pixel value.
        - Real unit profit.
        - Signal distortion %.
        - Coupon dependency impact.
    - Right: DREAM STATE
      - Short paragraph (from `dreamStateDescription`).
      - Placeholder dollar impact (set to `$0` for now with a tooltip/footnote about later linkage).

Example snippet:

```tsx
export function ModuleAdSignal({ data }: ModuleAdSignalProps) {
  const {
    passedPixelValue,
    realUnitProfit,
    signalDistortionPercent,
    couponDependencyImpact,
    topContaminationSources,
    dreamStateDescription,
    dreamStateDollarImpact,
  } = data

  return (
    <div className="bg-cqi-surface border border-cqi-border rounded-xl p-6 space-y-4">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-cqi-muted">
            MODULE 1 — AD SIGNAL CONTAMINATION MATRIX
          </p>
          <h2 className="mt-1 text-2xl font-display">Ad Signal Integrity</h2>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.16em] text-cqi-muted">
            CURRENT STATE
          </h3>
          <div className="text-sm text-cqi-muted">Signal distortion</div>
          <div className="font-mono text-3xl">
            {signalDistortionPercent.toFixed(0)}%
          </div>

          <div className="mt-4 space-y-2">
            {/* Data rows */}
            {/* Passed pixel value */}
            {/* Real unit profit */}
            {/* Coupon dependency impact */}
          </div>

          {topContaminationSources.length > 0 && (
            <ul className="mt-4 space-y-1 text-xs text-cqi-muted list-disc list-inside">
              {topContaminationSources.map((src) => (
                <li key={src}>{src}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold tracking-[0.16em] text-cqi-muted">
            DREAM STATE
          </h3>
          <p className="text-sm text-cqi-muted">
            {dreamStateDescription}
          </p>
          <div className="mt-4">
            <p className="text-xs text-cqi-muted mb-1">Estimated upside (placeholder)</p>
            <p className="font-mono text-lg">
              ${dreamStateDollarImpact.toFixed(0)}
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
```

Integration:

- Render this module in the report page once `modules.adSignal` is not null.

---

## 8. Report page integration (`app/report/[domain]/page.tsx`)

For Part 2, the report page should:

- Fetch `NormalizedAuditResult` from `/api/report?domain=...` or receive it via props.
- Render:
  - ExecutiveSummary (CQI, equity loss placeholder).
  - Module 1 card.

You do **not** need to render Modules 2–5 yet.

---

## 9. Tests required in Part 2

### 9.1 Unit tests — `tests/lib/modules/adSignal.test.ts`

Test `buildAdSignalModule` behavior:

- Case 1: Low returnRate, low promoFrequency:
  - Expect `signalDistortionPercent` relatively low.
  - Expect `couponDependencyImpact` low.
- Case 2: High returnRate, high promoFrequency:
  - Expect higher `signalDistortionPercent`.
  - Expect `couponDependencyImpact` near 100.
- Case 3: Ensure no division by zero when `aov` is 0.

Example:

```ts
it('increases distortion with higher returns and promos', () => {
  const base = buildAdSignalModule({
    // minimal NormalizedStoreData with modest sliders
  } as any)

  const highLeak = buildAdSignalModule({
    // same, but returnRate and promoFrequency high
  } as any)

  expect(highLeak.signalDistortionPercent).toBeGreaterThanOrEqual(
    base.signalDistortionPercent
  )
  expect(highLeak.couponDependencyImpact).toBeGreaterThan(
    base.couponDependencyImpact
  )
})
```

### 9.2 Integration test — extend `tests/api/audit.test.ts`

Add assertions:

- Response `modules.adSignal` exists and has:
  - `passedPixelValue`, `realUnitProfit`, `signalDistortionPercent`, `couponDependencyImpact` numbers.
- The overall `cqi.grade` changes in the expected direction when you change slider values dramatically (e.g., test two different request bodies).

---

## 10. Manual QA for Part 2

Before moving to Part 3, manually verify:

1. Running an audit with reasonable sliders:
   - Module 1 card appears on the report page.
   - Module 1 numbers are sensible (no NaN, infinity, or negative percentages).
2. Changing sliders and re-running:
   - Signal distortion and coupon dependency change in the expected direction.
3. If Meta ads are unavailable:
   - The system still runs (Module 1 logic uses sliders; Meta count can be used later).
   - Evidence mode still makes sense (`shopify = true`, `ads = false`).

---

## 11. Completion criteria for Part 2

Part 2 is **DONE** only when:

- `lib/data/apify/metaAds.ts` is implemented and capped at 10 ads.
- `lib/cqi/types.ts` has the extended fields for Module 1.
- `lib/cqi/modules/adSignal.ts` computes the values described here.
- `/api/audit` attaches `modules.adSignal` to the result.
- `ModuleAdSignal.tsx` renders correctly in the report.
- Unit tests for the module logic pass.
- Extended `/api/audit` integration tests pass.
- All Part 2 items in `QA_CHECKLIST.md` are checked.

Once all of the above is true, you may proceed to **PART 3 — Module 2: Best-Seller Stockout Conflict Ledger**.