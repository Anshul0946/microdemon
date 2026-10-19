# PART 4 — Module 3: Tech Stack Redundancy Paradox

Goal of this part:

- Implement **Module 3** (Tech Stack Redundancy Paradox) end-to-end.
- Use tech stack data to show when brands pay for premium tools yet still have fundamental leaks.
- Extend the report UI to include Module 3.

Do **not** modify Modules 1–2 behavior, Module 4–5 logic, competitive benchmark, or PDF export in this part.

---

## 1. Scope of Part 4 (what you MUST do)

You MUST:

1. Ensure the Shopify analyzer is providing enough tech stack information (apps + pixels).
2. Extend `NormalizedStoreData` to carry a tech stack snapshot.
3. Define and implement `ModuleTechStackOutput` in `lib/cqi/types.ts`.
4. Implement `buildTechStackModule` in `lib/cqi/modules/techStack.ts`.
5. Call Module 3 from `/api/audit` after Modules 1–2 are computed.
6. Build `components/report/modules/ModuleTechStack.tsx` to render Module 3.
7. Add unit tests for Module 3 logic and extend `/api/audit` integration tests.

AI-driven technology classification is implemented in this version to augment tech stack signals. We use the NIM AI normalizer to classify BuiltWith results into Shopify apps vs generic web tech, premium status, and cost tiers. (hard-code a mapping in TypeScript).
- Change Module 1 or 2 outputs’ semantics.
- Implement AI visibility or valuation logic here.

---

## 2. Conceptual question and angle

**Question:**  
Is this brand **overpaying for tools** that are not solving the basics?

The paradox:

- The brand has expensive analytics/attribution/email/review tools installed.
- Yet Modules 1 and 2 show:
  - Signal contamination.
  - Inventory conflicts.
- Therefore, they are paying for tools without fixing structural leaks.

Module 3 highlights:

- **Which premium tools they are paying for.**
- **Estimated annual tool spend.**
- **Whether leaks still exist despite these tools.**
- **Which tools appear underutilized.**

---

## 3. Inputs for Module 3

### 3.3 AI-Assisted Tech Stack Classification

We send the BuiltWith scraped technology lists to NIM to:
1. Distinguish Shopify ecosystem apps from general JS tags/pixels.
2. Group tools into buckets (analytics, email/SMS, reviews, tracking, subscriptions).
3. Identify premium tiers (tools costing >$100/month) and estimate annual SaaS spend.
4. Detect tech stack paradoxes: generating a `leakNarrative` if the brand is paying for premium tools (e.g. Triple Whale, Elevar) but still exhibiting severe leaks (Module 1/2 distortion or stockout waste).

From normalized store data

From `NormalizedStoreData.techStack`:

- `apps: string[]`
  - App names or identifiers, normalized to title case where possible.
- `pixels: string[]`
  - Pixel/integration identifiers (Meta pixel, Google Analytics, etc.).

Ensure Part 1’s normalization includes at least these fields.

### 3.2 From modules

From previously computed modules:

- `ModuleAdSignalOutput` (Module 1):
  - `signalDistortionPercent`
  - `couponDependencyImpact`
- `ModuleStockoutOutput` (Module 2):
  - `estimatedMonthlyWaste`
  - `variantDeficitShare`

Module 3 **does not** call external services. It only reads these outputs.

---

## 4. Premium tools mapping and cost table

Define a static mapping of premium tools in `lib/cqi/modules/techStack.ts` (or a shared constants file).

Example:

```ts
const PREMIUM_TOOL_COSTS: Record<string, { label: string; annualCost: number }> = {
  'triple whale': { label: 'Triple Whale', annualCost: 6000 },
  'elevar': { label: 'Elevar', annualCost: 4000 },
  'lifetimely': { label: 'Lifetimely', annualCost: 3000 },
  'klaviyo': { label: 'Klaviyo', annualCost: 3500 },
  'postscript': { label: 'Postscript', annualCost: 3000 },
  'attentive': { label: 'Attentive', annualCost: 4000 },
  'reviews.io': { label: 'Reviews.io', annualCost: 2500 },
  'okendo': { label: 'Okendo', annualCost: 2500 },
  'judge.me': { label: 'Judge.me', annualCost: 1000 },
}
```

Logic:

- Normalize app names to lowercase.
- If the normalized app name contains a key from this table, treat it as detected.

---

## 5. Type extensions (`lib/cqi/types.ts`)

Define or extend `ModuleTechStackOutput`:

```ts
export interface ModuleTechStackOutput {
  detectedPremiumTools: string[]      // e.g. ['Triple Whale', 'Klaviyo']
  estimatedAnnualSaasSpend: number   // in dollars
  toolsUnderutilized: string[]       // subset of detected tools flagged as underutilized
  leaksExistDespiteTools: boolean    // true if Modules 1–2 show leaks while tools are present
  dreamStateDescription: string
  dreamStateDollarImpact: number
}
```

Later, Module 5 may use `estimatedAnnualSaasSpend` and `leaksExistDespiteTools`, but for now Module 3 only needs to compute and display.

---

## 6. Module logic (`lib/cqi/modules/techStack.ts`)

**Signature:**

```ts
import {
  NormalizedStoreData,
  ModuleAdSignalOutput,
  ModuleStockoutOutput,
  ModuleTechStackOutput,
} from '../types'

export function buildTechStackModule(args: {
  normalized: NormalizedStoreData
  adSignal: ModuleAdSignalOutput | null
  stockout: ModuleStockoutOutput | null
}): ModuleTechStackOutput {
  // ...
}
```

### 6.1 Implementation outline

1. Extract `apps` from `normalized.techStack.apps`.
2. Detect premium tools:

```ts
const detectedPremiumTools: string[] = []

for (const appName of normalized.techStack.apps) {
  const lower = appName.toLowerCase()
  for (const key of Object.keys(PREMIUM_TOOL_COSTS)) {
    if (lower.includes(key)) {
      const label = PREMIUM_TOOL_COSTS[key].label
      if (!detectedPremiumTools.includes(label)) {
        detectedPremiumTools.push(label)
      }
    }
  }
}
```

3. Compute `estimatedAnnualSaasSpend`:

```ts
let estimatedAnnualSaasSpend = 0

for (const label of detectedPremiumTools) {
  const entry = Object.values(PREMIUM_TOOL_COSTS).find(
    (tool) => tool.label === label
  )
  if (entry) {
    estimatedAnnualSaasSpend += entry.annualCost
  }
}
```

4. Determine `leaksExistDespiteTools`:

- Define leaks as “meaningful problem flags” from Modules 1–2.
- For v1:

```ts
const hasPremiumTools = detectedPremiumTools.length > 0

const adSignalLeak =
  !!adSignal &&
  (adSignal.signalDistortionPercent >= 30 ||
    adSignal.couponDependencyImpact >= 50)

const stockoutLeak =
  !!stockout &&
  (stockout.estimatedMonthlyWaste > 0 ||
    stockout.variantDeficitShare > 0.2)

const leaksExistDespiteTools = hasPremiumTools && (adSignalLeak || stockoutLeak)
```

5. Determine `toolsUnderutilized`:

- If `leaksExistDespiteTools` is true, we consider all premium tools underutilized.
- More nuanced rules can be added later, but v1 can be:

```ts
const toolsUnderutilized = leaksExistDespiteTools ? detectedPremiumTools : []
```

6. Compose `dreamStateDescription`:

```ts
const dreamStateDescription =
  'Your analytics and marketing tools work in concert to eliminate basic signal and inventory leaks, so every dollar of SaaS spend amplifies clean ROAS rather than masking structural issues.'
```

7. Compute `dreamStateDollarImpact` (v1 heuristic):

- Tie to both `estimatedAnnualSaasSpend` and leak indicators:

```ts
let dreamStateDollarImpact = 0

if (leaksExistDespiteTools) {
  // Heuristic: if leaks exist, assume you can reclaim some fraction of
  // wasted ad spend from Module 2 plus a multiple of SaaS spend.
  const stockoutWaste = stockout?.estimatedMonthlyWaste ?? 0
  // Rough annualized effect: 12 × monthly waste + 1× SaaS spend
  dreamStateDollarImpact = stockoutWaste * 12 + estimatedAnnualSaasSpend
}
```

8. Return:

```ts
return {
  detectedPremiumTools,
  estimatedAnnualSaasSpend,
  toolsUnderutilized,
  leaksExistDespiteTools,
  dreamStateDescription,
  dreamStateDollarImpact,
}
```

---

## 7. Pipeline extension in `/api/audit/route.ts`

After computing Modules 1 and 2:

```ts
const adSignal = buildAdSignalModule(normalized)
const stockout = buildStockoutModule({ normalized, metaAds, googleAds })
const techStack = buildTechStackModule({ normalized, adSignal, stockout })
```

Then set:

```ts
const modules: ModuleOutputs = {
  adSignal,
  stockout,
  techStack,
  aiVisibility: null,
  valuation: null,
}
```

Make sure the order of execution is:

1. Ad Signal (Module 1)
2. Stockout (Module 2)
3. Tech Stack (Module 3)

so that Module 3 can read 1–2 outputs.

---

## 8. Module 3 UI (`components/report/modules/ModuleTechStack.tsx`)

Props:

```ts
type ModuleTechStackProps = {
  data: ModuleTechStackOutput
}
```

Layout:

- Standard module card pattern.
- Top:
  - Label: `MODULE 3 — TECH STACK REDUNDANCY PARADOX`.
  - Title: `Tool Spend vs Leak Profile`.

Body:

Left column — CURRENT STATE:

- Key number: `estimatedAnnualSaasSpend` (mono, large, e.g. `$18,500/year`).
- Under it, textual label: “Estimated annual SaaS spend on premium tools.”
- List of detected tools:
  - Bullet list with names (e.g., Triple Whale, Klaviyo).
- If `leaksExistDespiteTools`:
  - Text highlight: “Structural leaks remain despite premium tools in place.”

Right column — DREAM STATE:

- `dreamStateDescription` (short paragraph).
- Dollar impact:
  - `dreamStateDollarImpact` formatted as annual dollars.
  - Label: “Potential annual upside from aligning tools with fundamentals.”
- If `toolsUnderutilized` is non-empty:
  - Short line: “Currently underutilized: Triple Whale, Klaviyo”.

Visual cues:

- If `leaksExistDespiteTools`:
  - Show a small red badge or tag like “LEAKS DESPITE PREMIUM STACK”.
- If no premium tools:
  - Emphasize “Low tool overhead” and that Module 3 risk is currently low.

---

## 9. Report page placement (`app/report/[domain]/page.tsx`)

Update report layout:

- After Module 2, render Module 3 if `modules.techStack` is not null.
- Maintain order:

  1. ExecutiveSummary
  2. ModuleAdSignal
  3. ModuleStockout
  4. ModuleTechStack
  5. (Later) ModuleAIVisibility
  6. ModuleValuation

Follow the same spacing and card width patterns for consistency.

---

## 10. Tests required in Part 4

### 10.1 Unit tests — `tests/lib/modules/techStack.test.ts`

Test `buildTechStackModule` behavior:

1. **No premium tools:**
   - Input: `apps` list does not match any keys.
   - Expect:
     - `detectedPremiumTools` empty.
     - `estimatedAnnualSaasSpend` = 0.
     - `leaksExistDespiteTools` = false.
     - `toolsUnderutilized` empty.

2. **Premium tools but no leaks:**
   - Input: `apps` includes `'Triple Whale'`, `'Klaviyo'`.
   - Modules 1–2 show low distortion, low waste.
   - Expect:
     - `detectedPremiumTools` includes both.
     - `estimatedAnnualSaasSpend` > 0.
     - `leaksExistDespiteTools` = false.
     - `toolsUnderutilized` empty or only include tools if you choose.

3. **Premium tools with leaks:**
   - Input: same premium tools.
   - Module 1: `signalDistortionPercent` high.
   - Module 2: `estimatedMonthlyWaste` > 0.
   - Expect:
     - `leaksExistDespiteTools` = true.
     - `toolsUnderutilized` includes premium tools.
     - `dreamStateDollarImpact` > 0.

### 10.2 Integration test — extend `tests/api/audit.test.ts`

Add assertions:

- Response `modules.techStack` exists when Shopify tech data is present.
- It contains `detectedPremiumTools`, `estimatedAnnualSaasSpend`, and `leaksExistDespiteTools`.
- Changing inputs (mocked Module 1–2 outputs) can be used to test that `leaksExistDespiteTools` toggles from false to true and affects `dreamStateDollarImpact`.

---

## 11. Manual QA for Part 4

Before moving to Part 5, manually verify:

1. For a store with no obvious advanced tools:
   - Module 3 shows near-zero SaaS spend and no paradox message.
2. For a store where the Shopify analyzer detects known premium tools:
   - Detected tools list is accurate.
   - Estimated annual SaaS spend is non-zero and in a plausible range.
3. For a scenario where Modules 1–2 show leaks:
   - Module 3 clearly calls out that leaks exist despite premium tools.

---

## 12. Completion criteria for Part 4

Part 4 is **DONE** only when:

- `lib/cqi/modules/techStack.ts` implements the logic described here.
- `/api/audit` constructs and attaches `modules.techStack`.
- `ModuleTechStack.tsx` renders correctly in the report.
- Unit tests for Module 3 logic pass.
- Extended `/api/audit` integration tests pass.
- All Part 4 items in `QA_CHECKLIST.md` are checked.

Once all of the above is true, you may proceed to **PART 5 — Module 4: Conversational Engine Invisibility Index**.