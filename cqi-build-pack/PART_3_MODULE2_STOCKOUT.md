# PART 3 — Module 2: Best-Seller Stockout Conflict Ledger

Goal of this part:

- Implement **Module 2** (Best-Seller Stockout Conflict Ledger) end-to-end.
- Quantify how much ad spend is being routed into out-of-stock or poorly stocked products.
- Extend the report UI to include Module 2.

Do **not** implement Modules 3–5 logic, competitive benchmark, or PDF export in this part.

---

## 1. Scope of Part 3 (what you MUST do)

You MUST:

1. Ensure Shopify product/variant availability and ad destination URLs are flowing into the pipeline.
2. Define and implement the Module 2 logic in `lib/cqi/modules/stockout.ts`.
3. Extend `lib/cqi/types.ts` with `ModuleStockoutOutput`.
4. Extend `/api/audit` to:
   - Pass the necessary raw data to Module 2.
   - Attach Module 2 output to `modules.stockout`.
5. Build `components/report/modules/ModuleStockout.tsx` to render Module 2.
6. Add unit tests for Module 2 logic and extend `/api/audit` integration tests.

You MUST NOT:

- Change Module 1 behavior.
- Introduce new data sources beyond what Part 1–2 already use (Shopify + ad libraries).
- Implement tech stack or AI visibility logic here.

---

## 2. Conceptual question and ideas

**Question:**  
How much of your ad spend is being wasted by sending traffic to **out-of-stock** or badly stocked products?

Module 2 highlights **inventory conflicts**:

- `You’re paying to send traffic to products that cannot be bought right now.`

---

## 3. Inputs for Module 2

### 3.1 From Shopify analyzer

For each product/variant, you need:

- Product handle or URL.
- Variant availability (`in_stock` boolean or quantity).
- Optionally, tags like “best-seller” (if present).

You must be able to determine:

- Whether the landing URL of an ad points to:
  - A product detail page.
  - A collection page.
  - The homepage or other route.

### 3.2 From ad libraries (Meta / Google / )

For each ad (from Part 2 wrappers):

- `destinationUrl`
- `adNetwork` (Meta, Google, )
- Optional: `id`, `headline` (for display).

### 3.3 From sliders

- `spend` (monthly ad spend).

---

## 4. Conceptual logic & formulas

### 4.1 URL → product mapping

High-level approach:

1. Extract the path from `destinationUrl`.
2. Heuristics:
   - If path matches `/products/{handle}`:
     - Map to that product using Shopify product list.
   - If path matches `/collections/{slug}`:
     - Map to all products in that collection (if available from analyzer).
   - If neither:
     - Treat as “unmapped” (ignore for stockout logic in v1).

You can implement conservative mapping; it doesn’t need to be perfect in v1 as long as it doesn’t produce nonsense.

### 4.2 Stockout ratio per landing URL

For each mapped URL:

1. Determine set of variants this URL effectively represents:
   - Product page → variants of that product.
   - Collection page → variants of all products in the collection.
2. Compute:

```text
stockoutRatio = outOfStockVariants / totalVariants
```

- `outOfStockVariants` = number of variants with `available = false` or `inventory <= 0`.
- `totalVariants` = total variants considered.

### 4.3 Conflict threshold

Define a “conflict URL” as one where a meaningful share of variants are unavailable.

For v1:

```text
conflict if stockoutRatio > 0.4
```

Meaning:

- At least 40% of variants are out of stock.

### 4.4 Estimated wasted ad spend

Approximate the share of ad spend that is effectively hitting stockouts.

Steps:

1. Compute `conflictRatios` = list of `stockoutRatio` for all conflict URLs.
2. Compute:

```text
wastedShare = average(conflictRatios)
estimatedMonthlyWaste = wastedShare × spend
```

Interpretation:

- If conflict URLs are on average 60% stocked out and you spend $100K per month:
  - `wastedShare = 0.6`
  - `estimatedMonthlyWaste = 0.6 × 100,000 = 60,000`
- This is intentionally coarse, but consistent.

---

## 5. Type extensions (`lib/cqi/types.ts`)

Extend `ModuleStockoutOutput` as:

```ts
export interface ModuleStockoutOutput {
  conflictUrls: Array<{
    url: string
    adNetwork: string
    stockoutRatio: number
  }>
  variantDeficitShare: number       // overall ratio of OOS variants across mapped URLs
  estimatedMonthlyWaste: number     // dollars
  dreamStateDescription: string
  dreamStateDollarImpact: number
}
```

You may add fields later if needed, but this is the minimum.

---

## 6. Module logic (`lib/cqi/modules/stockout.ts`)

**Signature:**

```ts
import {
  NormalizedStoreData,
  ModuleStockoutOutput,
} from '../types'
import type { MetaAdRaw } from '@/lib/data/apify/metaAds'
import type { GoogleAdRaw } from '@/lib/data/apify/googleAds'

export function buildStockoutModule(args: {
  normalized: NormalizedStoreData
  metaAds: MetaAdRaw[]
  googleAds: GoogleAdRaw[]
}): ModuleStockoutOutput {
  // ...
}
```

**Implementation outline:**

1. Normalize all ads into a single internal structure:

```ts
type InternalAd = {
  url: string
  adNetwork: 'meta' | 'google'
}
```

2. For each `InternalAd`, map `url` to one or more products using a helper:

```ts
function mapUrlToProducts(url: string, normalized: NormalizedStoreData): MappedProduct[] {
  // heuristics based on path (products/handle, collections/slug)
}
```

3. For each mapped group:

- Gather all relevant variants.
- Compute `stockoutRatio` as described.

4. Build list of conflict URLs:

```ts
const conflictUrls = collected.filter((x) => x.stockoutRatio > 0.4)
```

5. Compute:

```ts
const conflictRatios = conflictUrls.map((c) => c.stockoutRatio)
const wastedShare =
  conflictRatios.length === 0
    ? 0
    : conflictRatios.reduce((sum, r) => sum + r, 0) / conflictRatios.length

const estimatedMonthlyWaste = wastedShare * normalized.sliders.spend
```

6. Compute overall `variantDeficitShare` across all mapped URLs (including non-conflicts) as:

```ts
const totalVariants = sum of all variants considered
const totalOutOfStock = sum of all out-of-stock variants

const variantDeficitShare =
  totalVariants === 0 ? 0 : totalOutOfStock / totalVariants
```

7. Compose output:

```ts
const dreamStateDescription =
  'Every dollar of ad spend routes to products with healthy inventory coverage and no structural stockouts on best-sellers.'

const dreamStateDollarImpact = estimatedMonthlyWaste // in v1, equate

return {
  conflictUrls,
  variantDeficitShare,
  estimatedMonthlyWaste,
  dreamStateDescription,
  dreamStateDollarImpact,
}
```

**Important:**  
If you cannot map any URLs or there is no inventory data, safely return zeros and an empty `conflictUrls` list. Do not throw.

---

## 7. Pipeline extension in `/api/audit/route.ts`

Extend the `/api/audit` pipeline as follows:

1. After collecting Meta ads (from Part 2), also collect:
   - Google ads via `getGoogleAds`.
2. Build ad arrays (even if some are empty).
3. After normalization:

   ```ts
   const adSignal = buildAdSignalModule(normalized)
   const stockout = buildStockoutModule({
     normalized,
     metaAds,
     googleAds,
   })
   ```

4. Attach to modules:

   ```ts
   const modules: ModuleOutputs = {
     adSignal,
     stockout,
     techStack: null,
     aiVisibility: null,
     valuation: null,
   }
   ```

5. If any ad source fails (e.g., API error), pass empty arrays to `buildStockoutModule`. That function must handle empties gracefully.

---

## 8. Module 2 UI (`components/report/modules/ModuleStockout.tsx`)

Props:

```ts
type ModuleStockoutProps = {
  data: ModuleStockoutOutput
}
```

Layout:

- Use the same module card structure as Module 1.
- Top:
  - Label: `MODULE 2 — BEST-SELLER STOCKOUT CONFLICT LEDGER`.
  - Title: `Inventory Conflict Risk`.
- Body:

Left column — CURRENT STATE:

- Key number: `estimatedMonthlyWaste` (mono, large, e.g. `$32,000/month`).
- Supporting metrics:
  - `variantDeficitShare` as a percentage (e.g., `32% of mapped variants are out of stock`).
  - Number of conflict URLs.
- Optionally, a short bullet list of top 3 conflict URLs with:
  - Truncated URL.
  - Network tag (Meta/Google/).
  - Stockout ratio.

Right column — DREAM STATE:

- `dreamStateDescription` text.
- Dollar impact: `dreamStateDollarImpact` (same as `estimatedMonthlyWaste` in v1).
- Short explanation line:
  - “If you reroute traffic away from stockouts, this is the monthly spend unlocked from dead pages.”

Visual guidelines:

- Use red/danger accent subtly for high `variantDeficitShare` or high `estimatedMonthlyWaste`.
- If `estimatedMonthlyWaste` is zero:
  - Show a positive, green-toned message (“No major stockout conflicts detected in current mapping.”).

---

## 9. Report page placement (`app/report/[domain]/page.tsx`

Update the report page:

- Below Module 1, render Module 2 if `modules.stockout` is not null.
- Maintain consistent spacing and ordering:
  1. ExecutiveSummary
  2. Module 1 — Ad Signal
  3. Module 2 — Stockout
  4. (Later) Modules 3–5

---

## 10. Tests required in Part 3

### 10.1 Unit tests — `tests/lib/modules/stockout.test.ts`

Test `buildStockoutModule` behavior in isolation.

Scenarios:

1. **No inventory / no ads:**
   - Inputs: no mapped URLs, or all arrays empty.
   - Expect:
     - `conflictUrls.length === 0`
     - `estimatedMonthlyWaste === 0`
     - `variantDeficitShare === 0`

2. **Moderate stockouts:**
   - Simulate a scenario where:
     - Some URLs have ~50% variants out of stock.
     - `spend` is non-zero.
   - Expect:
     - `estimatedMonthlyWaste > 0`
     - `variantDeficitShare` between 0 and 1.

3. **Severe stockouts:**
   - High `stockoutRatio` across URLs.
   - Expect significantly higher `estimatedMonthlyWaste` than baseline.

### 10.2 Integration test — extend `tests/api/audit.test.ts`

Add assertions:

- `modules.stockout` exists on the response.
- It has:
  - `conflictUrls` array (possibly empty).
  - Numeric `variantDeficitShare`.
  - Numeric `estimatedMonthlyWaste`.
- For a mocked scenario:
  - Changing `spend` in request changes `estimatedMonthlyWaste` proportionally.

---

## 11. Manual QA for Part 3

Before moving to Part 4, manually verify:

1. Use a store where you know some products are out of stock:
   - Ensure Module 2 shows at least some `conflictUrls`.
   - Check that `estimatedMonthlyWaste` is non-zero and visually sensible (not absurd).
2. Use a store with mostly in-stock best-sellers:
   - Module 2 should show low or zero conflict, with positive message.
3. Change sliders (especially `spend`) and re-run:
   - Confirm that `estimatedMonthlyWaste` responds appropriately.

---

## 12. Completion criteria for Part 3

Part 3 is **DONE** only when:

- `lib/cqi/modules/stockout.ts` implements the logic described here.
- `/api/audit` builds and attaches `modules.stockout` correctly.
- `ModuleStockout.tsx` renders in the report page with coherent data.
- Unit tests for stockout module logic pass.
- Extended `/api/audit` integration tests pass.
- All Part 3 items in `QA_CHECKLIST.md` are checked.

Once all of the above is true, you may proceed to **PART 4 — Module 3: Tech Stack Redundancy Paradox**.