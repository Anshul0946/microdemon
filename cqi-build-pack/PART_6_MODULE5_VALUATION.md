# PART 6 — Module 5: Terminal Enterprise Valuation Markdown

Goal of this part:

- Implement **Module 5** (Terminal Enterprise Valuation Markdown) end-to-end.
- Turn sliders, category benchmarks, and module outputs into:
  - Annual revenue estimate.
  - Bear/Base/Bull valuation band.
  - Risk discount %.
  - Equity loss (headline number).
- Extend the report UI to include Module 5 and valuation components.

Do **not** modify Modules 1–4 behavior in this part.

---

## 1. Scope of Part 6 (what you MUST do)

You MUST:

1. Implement financial computations in `lib/cqi/financial.ts` as **pure TypeScript functions**.
2. Extend `ValuationResult` and `ModuleValuationOutput` in `lib/cqi/types.ts`.
3. Implement `buildValuationModule` in `lib/cqi/modules/valuation.ts`.
4. Extend `/api/audit` to:
   - Use category benchmarks from `googleSearch` output.
   - Compute valuation and risk discount.
   - Attach Module 5 output to `modules.valuation`.
5. Build `components/report/ValuationBand.tsx` for Bear/Base/Bull values.
6. Build `components/report/modules/ModuleValuation.tsx` for the valuation module card.
7. Extend unit tests in `tests/lib/financial.test.ts` and integration tests for `/api/audit`.

You MUST NOT:

- Ask AI to compute any of the numbers (revenue, multiples, risk, equity loss).
- Change the conceptual formulas defined in `01_PRODUCT_BLUEPRINT.md`.

---

## 2. Inputs to the valuation model

### 2.1 Sliders (`SliderInputs`)

- `spend` (monthly ad spend).
- `aov` (Average Order Value).
- `returnRate` (0–1).
- `vertical` (category string).

### 2.2 Category benchmarks (from `getCategoryBenchmarks`)

Normalized into a TypeScript type (e.g. `CategoryMacroBenchmarks`):

```ts
export interface CategoryMacroBenchmarks {
  cpc: number                // cost per click, in dollars
  conversionRate: number     // 0–1
  bearMultiple: number       // e.g. 1.5
  baseMultiple: number       // e.g. 2.5
  bullMultiple: number       // e.g. 4
  requiredMargin: number     // 0–1, required gross margin band (e.g. 0.6)
}
```

These values come from AI Mode / Google search actor but must be used as **inputs** to your math, not computed by AI.

### 2.3 Modules (for risk discount)

- Module 1 (Ad Signal):
  - `signalDistortionPercent`
  - `couponDependencyImpact`
- Module 2 (Stockout):
  - `estimatedMonthlyWaste`
  - `variantDeficitShare`
- Module 3 (Tech Stack):
  - `leaksExistDespiteTools`
- Module 4 (AI Visibility):
  - `indexScore`

---

## 3. Financial formulas (implementation details)

### 3.1 Annual revenue

Conceptual formula:

```text
Annual Revenue = monthly ad spend × (1 / CPC) × conversion rate × AOV × 12
```

Implementation:

```ts
export function computeAnnualRevenue(
  sliders: SliderInputs,
  macro: CategoryMacroBenchmarks
): number {
  const { spend, aov } = sliders
  const { cpc, conversionRate } = macro

  if (cpc <= 0 || conversionRate <= 0 || spend <= 0 || aov <= 0) {
    return 0
  }

  const clicksPerMonth = spend / cpc
  const conversionsPerMonth = clicksPerMonth * conversionRate
  const revenuePerMonth = conversionsPerMonth * aov
  let annualRevenue = revenuePerMonth * 12

  // Apply minimum floor at $1M for reporting
  if (annualRevenue < 1_000_000) {
    annualRevenue = 1_000_000
  }

  return annualRevenue
}
```

### 3.2 Valuation band

Conceptual formulas:

```text
Ideal Value Bear = Annual Revenue × bearMultiple
Ideal Value Base = Annual Revenue × baseMultiple
Ideal Value Bull = Annual Revenue × bullMultiple
```

Implementation:

```ts
export function computeValuationBand(
  annualRevenue: number,
  macro: CategoryMacroBenchmarks
): {
  bear: number
  base: number
  bull: number
} {
  const bear = annualRevenue * macro.bearMultiple
  const base = annualRevenue * macro.baseMultiple
  const bull = annualRevenue * macro.bullMultiple

  return { bear, base, bull }
}
```

### 3.3 Risk discount %

Risk discount blends several normalized risk components, matching the blueprint:

Components:

1. **Margin gap**  
   How far actual margin is from required margin.

   - Approximate actual margin using sliders:
     - Use the same `grossMarginApprox` used in Module 1 (e.g. 0.65).
     - Adjust for return rate.
   - Required margin comes from category benchmarks.

   Implementation:

   ```ts
   function computeMarginGap(sliders: SliderInputs, macro: CategoryMacroBenchmarks): number {
     const grossMarginApprox = 0.65
     const actualMargin = grossMarginApprox * (1 - sliders.returnRate)
     const required = macro.requiredMargin

     if (required <= 0) return 0

     const gap = Math.max(0, required - actualMargin) / required
     return Math.min(1, gap) // 0–1
   }
   ```

2. **Stockout ratio**  
   Use `variantDeficitShare` from Module 2 (already 0–1).

3. **AI readability gap**  
   Difference between ideal AI index (100) and current index.

   ```ts
   function computeAIReadabilityGap(aiIndex: number): number {
     const gap = Math.max(0, 100 - aiIndex) / 100
     return Math.min(1, gap)
   }
   ```

4. **Signal contamination**  
   Use `signalDistortionPercent` from Module 1, normalized to 0–1.

   ```ts
   function computeSignalContamination(signalDistortionPercent: number): number {
     const v = signalDistortionPercent / 100
     return Math.max(0, Math.min(1, v))
   }
   ```

Composite risk discount:

```ts
export function computeRiskDiscount(
  sliders: SliderInputs,
  macro: CategoryMacroBenchmarks,
  modules: {
    adSignal: ModuleAdSignalOutput | null
    stockout: ModuleStockoutOutput | null
    aiVisibility: ModuleAIVisibilityOutput | null
  }
): number {
  const marginGap = computeMarginGap(sliders, macro)
  const stockoutRatio = modules.stockout?.variantDeficitShare ?? 0
  const aiIndex = modules.aiVisibility?.indexScore ?? 0
  const aiReadabilityGap = computeAIReadabilityGap(aiIndex)
  const signalContamination = computeSignalContamination(
    modules.adSignal?.signalDistortionPercent ?? 0
  )

  let risk =
    marginGap * 0.35 +
    stockoutRatio * 0.25 +
    aiReadabilityGap * 0.2 +
    signalContamination * 0.2

  // Convert to percent
  risk = risk * 100

  // Clamp to[1]
  if (risk < 0) risk = 0
  if (risk > 85) risk = 85

  return risk
}
```

### 3.4 Equity loss

```ts
export function computeEquityLoss(
  idealValueBase: number,
  riskDiscountPercent: number
): number {
  const discount = riskDiscountPercent / 100
  return idealValueBase * discount
}
```

---

## 4. Types (`lib/cqi/types.ts`)

### 4.1 ValuationResult

Ensure `ValuationResult` includes:

```ts
export interface ValuationResult {
  annualRevenue: number
  idealValueBear: number
  idealValueBase: number
  idealValueBull: number
  riskDiscountPercent: number
  equityLoss: number
}
```

### 4.2 ModuleValuationOutput

Define:

```ts
export interface ModuleValuationOutput {
  annualRevenue: number
  idealValueBase: number
  idealValueBear: number
  idealValueBull: number
  riskDiscountPercent: number
  equityLoss: number
  dreamStateDescription: string
  dreamStateDollarImpact: number
}
```

Later, you can add optional breakdowns, but this is the core.

---

## 5. Valuation module (`lib/cqi/modules/valuation.ts`)

**Signature:**

```ts
import {
  SliderInputs,
  CategoryMacroBenchmarks,
  ModuleAdSignalOutput,
  ModuleStockoutOutput,
  ModuleAIVisibilityOutput,
  ModuleValuationOutput,
  ValuationResult,
} from '../types'

import {
  computeAnnualRevenue,
  computeValuationBand,
  computeRiskDiscount,
  computeEquityLoss,
} from '../financial'

export function buildValuationModule(args: {
  sliders: SliderInputs
  macro: CategoryMacroBenchmarks
  modules: {
    adSignal: ModuleAdSignalOutput | null
    stockout: ModuleStockoutOutput | null
    aiVisibility: ModuleAIVisibilityOutput | null
  }
}): { valuation: ValuationResult; moduleOutput: ModuleValuationOutput } {
  // ...
}
```

**Implementation outline:**

1. Compute annual revenue:

```ts
const annualRevenue = computeAnnualRevenue(sliders, macro)
```

2. Compute valuation band:

```ts
const { bear, base, bull } = computeValuationBand(annualRevenue, macro)
```

3. Compute risk discount:

```ts
const riskDiscountPercent = computeRiskDiscount(sliders, macro, modules)
```

4. Compute equity loss:

```ts
const equityLoss = computeEquityLoss(base, riskDiscountPercent)
```

5. Construct `ValuationResult`:

```ts
const valuation: ValuationResult = {
  annualRevenue,
  idealValueBear: bear,
  idealValueBase: base,
  idealValueBull: bull,
  riskDiscountPercent,
  equityLoss,
}
```

6. Construct `ModuleValuationOutput`:

```ts
const dreamStateDescription =
  'The business operates at target margins with clean signals, zero structural stockout waste, and full AI visibility, so its valuation reflects its true earning power rather than avoidable leaks.'

const dreamStateDollarImpact = equityLoss // in v1, assume closing leaks recovers the discounted equity

const moduleOutput: ModuleValuationOutput = {
  annualRevenue,
  idealValueBase: base,
  idealValueBear: bear,
  idealValueBull: bull,
  riskDiscountPercent,
  equityLoss,
  dreamStateDescription,
  dreamStateDollarImpact,
}
```

7. Return both:

```ts
return { valuation, moduleOutput }
```

---

## 6. Pipeline extension in `/api/audit/route.ts`

After Modules 1–4 have been computed:

1. Extract sliders, macro benchmarks, and module outputs:

```ts
const macro: CategoryMacroBenchmarks = {
  cpc: categoryBenchmarks.cpc,
  conversionRate: categoryBenchmarks.conversionRate,
  bearMultiple: categoryBenchmarks.bearMultiple,
  baseMultiple: categoryBenchmarks.baseMultiple,
  bullMultiple: categoryBenchmarks.bullMultiple,
  requiredMargin: categoryBenchmarks.requiredMargin,
}
```

2. Call valuation builder:

```ts
const { valuation, moduleOutput: valuationModule } = buildValuationModule({
  sliders: normalized.sliders,
  macro,
  modules: {
    adSignal,
    stockout,
    aiVisibility,
  },
})
```

3. Attach to result:

```ts
const modules: ModuleOutputs = {
  adSignal,
  stockout,
  techStack,
  aiVisibility,
  valuation: valuationModule,
}

const result: NormalizedAuditResult = {
  store: normalized,
  sliders: normalized.sliders,
  cqi,
  valuation,
  modules,
  evidenceState,
  evidenceConfidenceScore,
  dataMode,
  runId,
  createdAt,
}
```

---

## 7. Valuation UI (`components/report/ValuationBand.tsx`)

This component visualizes Bear/Base/Bull valuations.

Props:

```ts
type ValuationBandProps = {
  valuation: ValuationResult
}
```

Layout:

- Card or inline component showing three numbers:

  - Bear
  - Base
  - Bull

- Use a horizontal bar or three labeled columns.
- Format numbers in compact notation (e.g., `$18.2M`).

Example (simple columns):

```tsx
export function ValuationBand({ valuation }: ValuationBandProps) {
  const { idealValueBear, idealValueBase, idealValueBull } = valuation

  return (
    <div className="bg-cqi-surface border border-cqi-border rounded-xl p-4 grid grid-cols-3 gap-4 text-sm">
      <div>
        <div className="text-xs text-cqi-muted uppercase tracking-[0.16em]">
          Bear
        </div>
        <div className="font-mono text-lg">
          {formatCurrencyCompact(idealValueBear)}
        </div>
      </div>
      <div>
        <div className="text-xs text-cqi-muted uppercase tracking-[0.16em]">
          Base
        </div>
        <div className="font-mono text-lg">
          {formatCurrencyCompact(idealValueBase)}
        </div>
      </div>
      <div>
        <div className="text-xs text-cqi-muted uppercase tracking-[0.16em]">
          Bull
        </div>
        <div className="font-mono text-lg">
          {formatCurrencyCompact(idealValueBull)}
        </div>
      </div>
    </div>
  )
}
```

(Use a helper `formatCurrencyCompact` in `lib/utils/formatters.ts`.)

---

## 8. Module 5 UI (`components/report/modules/ModuleValuation.tsx`)

Props:

```ts
type ModuleValuationProps = {
  data: ModuleValuationOutput
}
```

Layout:

- Module card pattern.
- Top:
  - Label: `MODULE 5 — TERMINAL ENTERPRISE VALUATION MARKDOWN`.
  - Title: `Valuation & Equity Loss`.

Body:

Left column — CURRENT STATE:

- Key number: `equityLoss` (mono, large, e.g. `$14.3M`).
- Label: “Estimated equity currently at risk due to structural leaks.”
- Supporting metrics:
  - `annualRevenue` (compact).
  - `riskDiscountPercent` (e.g., `37% risk discount`).
  - `idealValueBase` (Base valuation, compact).

Right column — DREAM STATE:

- `dreamStateDescription` paragraph.
- `dreamStateDollarImpact` (same as `equityLoss` in v1).
- Short line: “Closing today’s leaks could recover up to this much enterprise value over time.”

You may embed `ValuationBand` above or within this module, or place `ValuationBand` in the Executive Summary and keep Module 5 focused on equity loss interpretation.

---

## 9. Report page integration (`app/report/[domain]/page.tsx`)

Update the report layout:

- In the ExecutiveSummary card:
  - Show:
    - `valuation.annualRevenue`
    - `valuation.idealValueBase` (Base)
    - `valuation.riskDiscountPercent`
    - `valuation.equityLoss` as the headline figure.
  - Use `ValuationBand` for Bear/Base/Bull.

- In the module stack:
  - Add `ModuleValuation` after Module 4.

Final order:

1. ExecutiveSummary (includes CQI gauge + ValuationBand + EquityLoss headline).
2. ModuleAdSignal.
3. ModuleStockout.
4. ModuleTechStack.
5. ModuleAIVisibility.
6. ModuleValuation.

---

## 10. Tests required in Part 6

### 10.1 Unit tests — extend `tests/lib/financial.test.ts`

Test the core functions:

1. `computeAnnualRevenue`:
   - When given positive spend, CPC, CR, and AOV:
     - Returns > 0.
   - When revenue would be < $1M:
     - Returns exactly $1,000,000.
   - When inputs are invalid (0 or negative):
     - Returns 0.

2. `computeValuationBand`:
   - Given `annualRevenue = 2,000,000` and multiples:
     - Bear = 2M × bearMultiple, etc.

3. `computeRiskDiscount`:
   - When all gaps are 0:
     - Returns 0%.
   - When gaps are maximal (1 across the board):
     - Returns ≤ 85% (capped).
   - Increasing any individual gap increases the risk percentage.

4. `computeEquityLoss`:
   - Increases as `riskDiscountPercent` increases for a constant base value.

### 10.2 Integration test — extend `tests/api/audit.test.ts`

Assertions:

- Response includes `valuation` with:
  - `annualRevenue`
  - `idealValueBase`
  - `idealValueBear`
  - `idealValueBull`
  - `riskDiscountPercent`
  - `equityLoss`
- When you vary sliders (e.g., much higher spend, same category benchmarks):
  - `annualRevenue` increases.
  - Valuations increase.
- When you simulate high risk vs low risk (via mocked module outputs):
  - `riskDiscountPercent` changes.
  - `equityLoss` responds in the expected direction.

---

## 11. Manual QA for Part 6

Before moving to Part 7, manually verify:

1. For a moderate spend brand:
   - Annual revenue estimate and valuation band are plausible (not absurdly huge or tiny).
2. For very high spend + solid benchmarks:
   - Numbers scale upward sensibly.
3. When module leaks are severe (bad sliders, simulations):
   - Risk discount is relatively high (but ≤ 85%).
   - Equity loss is a substantial fraction of Base valuation.
4. When leaks are mild:
   - Risk discount is low.
   - Equity loss is relatively small.

---

## 12. Completion criteria for Part 6

Part 6 is **DONE** only when:

- `lib/cqi/financial.ts` implements all formulas as pure functions.
- `lib/cqi/modules/valuation.ts` builds `ValuationResult` and Module 5 output correctly.
- `/api/audit` populates `valuation` and `modules.valuation` on the result.
- `ValuationBand` and `ModuleValuation` render correctly and coherently in the report.
- Extended `financial.test.ts` and `/api/audit` integration tests pass.
- All Part 6 items in `QA_CHECKLIST.md` are checked.

Once all of the above is true, you may proceed to **PART 7 — Competitive Shadow Benchmark**.