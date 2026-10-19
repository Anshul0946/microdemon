# QA_CHECKLIST

This checklist is a **hard gate** between parts.

You must not move from Part N to Part N+1 until every item for Part N is satisfied.

Mark items as `[x]` only when they are objectively verified (tests passing, manual QA done).

---

## Part 1 — UI Foundation & Intake

- [x] **Build & layout**
  - [x] `app/layout.tsx` renders without runtime errors.
  - [x] Global fonts (Syne, Inter, JetBrains Mono) are loaded.
  - [x] Background and text colors match `03_DESIGN_SYSTEM.md` (dark theme).
  - [x] Main layout uses grid split: left (hero + intake), right (execution log + summary).

- [x] **IntakeForm**
  - [x] Domain input accepts and normalizes values like `https://brand.com` to `brand.com`.
  - [x] Sliders for spend, AOV, return rate, promo frequency render and update values correctly.
  - [x] Vertical dropdown is present and selectable.
  - [x] Client-side validation prevents obviously bad inputs (empty domain, negative numbers).

- [x] **ExecutionLog**
  - [x] Component renders in `status = 'idle'` with a clear “ready” message.
  - [x] On submit, status transitions to `'running'`.
  - [x] On successful response, status transitions to `'success'`.
  - [x] On network/API failure, status transitions to `'error'`.

- [x] **/api/audit (minimal)**
  - [x] Accepts valid JSON body with domain + sliders.
  - [x] Validates domain and slider ranges.
  - [x] Calls `getShopifyStoreData` for the domain.
  - [x] Calls `callAIModel` once to normalize Shopify + sliders.
  - [x] Computes a **simple CQI** score.
  - [x] Returns a `NormalizedAuditResult` shape with:
    - [x] `store.domain`
    - [x] `sliders`
    - [x] `cqi.grade` and `cqi.label`
    - [x] `valuation` placeholder (zeroed)
    - [x] `modules` with all modules `null`
    - [x] `dataMode` present (can be `'partial'` hardcoded)
    - [x] `evidenceConfidenceScore` present

- [x] **UI behavior**
  - [x] Submitting a valid Shopify domain shows a CQI grade and label on the home page.
  - [x] Invalid domain shows a user-friendly error without crashing.

- [x] **Tests**
  - [x] `tests/lib/scoring.test.ts` covers `computeSimpleCQI` and passes.
  - [x] `tests/lib/financial.test.ts` placeholder tests pass (0 output behavior).
  - [x] `tests/api/audit.test.ts` (minimal) passes and asserts basic response fields.

---

## Part 2 — Module 1 (Ad Signal Contamination Matrix)

- [x] **Data layer**
  - [x] `lib/data/apify/metaAds.ts` implemented and uses `runApifyActor`.
  - [x] Meta ads are capped at 10 items via `.slice(0, 10)`.
  - [x] Failure in Meta ads actor returns `[]`, does not crash `/api/audit`.

- [x] **Types**
  - [x] `NormalizedStoreData.quantitativeMetrics.activeMetaAds` exists and is populated.
  - [x] `ModuleAdSignalOutput` has all fields defined (passedPixelValue, realUnitProfit, signalDistortionPercent, couponDependencyImpact, topContaminationSources, dreamStateDescription, dreamStateDollarImpact).

- [x] **Module logic**
  - [x] `buildAdSignalModule`:
    - [x] Computes `realUnitProfit` using AOV, gross margin approx, and return rate.
    - [x] Sets `passedPixelValue` based on AOV.
    - [x] Calculates `signalDistortionPercent` in [0, 100].
    - [x] Calculates `couponDependencyImpact` in [0, 100].
    - [x] Returns a non-empty `topContaminationSources` array when distortion or coupon dependency are high.
    - [x] Returns a stable `dreamStateDescription`.

- [x] **Pipeline**
  - [x] `/api/audit` calls `getMetaAds`.
  - [x] Evidence state marks `ads = true` when Meta ads present.
  - [x] After normalization, `modules.adSignal` is attached to the result.

- [x] **UI**
  - [x] `ModuleAdSignal.tsx` renders without errors when given valid data.
  - [x] Displays a large percentage for `signalDistortionPercent`.
  - [x] Shows numerical values for `passedPixelValue` and `realUnitProfit`.
  - [x] Shows `couponDependencyImpact` as a percentage.
  - [x] Shows contamination bullet points if present.

- [x] **Tests**
  - [x] `tests/lib/modules/adSignal.test.ts`:
    - [x] Confirms distortion grows with higher return rate and promo frequency.
    - [x] Confirms coupon dependency impact grows with higher promo slider.
    - [x] Handles zero AOV safely (no division by zero).
  - [x] `tests/api/audit.test.ts` extended to assert `modules.adSignal` structure, and passes.

---

## Part 3 — Module 2 (Best-Seller Stockout Conflict Ledger)

- [x] **Data & mapping**
  - [x] Shopify analyzer provides variant availability data to normalization.
  - [x] Ad wrappers (Meta/Google) supply destination URLs.
  - [x] URL → product mapping logic exists (even if heuristic).

- [x] **Module logic**
  - [x] `ModuleStockoutOutput` type defined with conflictUrls, variantDeficitShare, estimatedMonthlyWaste, dreamStateDescription, dreamStateDollarImpact.
  - [x] `buildStockoutModule`:
    - [x] Aggregates destination URLs across Meta and Google.
    - [x] Computes `stockoutRatio` per landing URL.
    - [x] Defines conflicts for `stockoutRatio > 0.4`.
    - [x] Builds `conflictUrls` array appropriately.
    - [x] Computes overall `variantDeficitShare` in [0, 1].
    - [x] Computes `estimatedMonthlyWaste = wastedShare × spend`.
    - [x] Sets `dreamStateDollarImpact` ≈ `estimatedMonthlyWaste` in v1.

- [x] **Pipeline**
  - [x] `/api/audit` calls `getGoogleAds`.
  - [x] `modules.stockout` attached with correct shape.
  - [x] Failing any ad source results in empty arrays, not errors.

- [x] **UI**
  - [x] `ModuleStockout.tsx` renders correctly.
  - [x] Shows estimated monthly waste as a formatted dollar amount.
  - [x] Shows conflict URL list (or positive message if none).
  - [x] Shows variant deficit share percentage.

- [x] **Tests**
  - [x] `tests/lib/modules/stockout.test.ts`:
    - [x] No data scenario → zero waste, zero deficit share.
    - [x] Stockout scenario → positive waste, non-zero deficit share.
  - [x] `tests/api/audit.test.ts` extended to assert `modules.stockout` presence and coherence.

---

## Part 4 — Module 3 (Tech Stack Redundancy Paradox)

- [x] **Data**
  - [x] `NormalizedStoreData.techStack.apps` and `.pixels` populated from Shopify analyzer output.

- [x] **Module logic**
  - [x] Premium tools cost table defined (Triple Whale, Elevar, Klaviyo, etc.).
  - [x] `ModuleTechStackOutput` type defined with all required fields.
  - [x] `buildTechStackModule`:
    - [x] Detects premium tools from `apps`.
    - [x] Computes `estimatedAnnualSaasSpend` based on cost table.
    - [x] Sets `leaksExistDespiteTools` true when premium tools exist and Modules 1–2 show leaks.
    - [x] Populates `toolsUnderutilized` when leaks exist despite tools.
    - [x] Computes a non-zero `dreamStateDollarImpact` when leaksExistDespiteTools is true.

- [x] **Pipeline**
  - [x] `/api/audit` constructs `modules.techStack` after Modules 1–2.

- [x] **UI**
  - [x] `ModuleTechStack.tsx` renders correctly.
  - [x] Shows detected premium tools list.
  - [x] Shows estimated annual SaaS spend.
  - [x] Highlights when leaks exist despite tools.

- [x] **Tests**
  - [x] `tests/lib/modules/techStack.test.ts` cases for:
    - [x] No tools.
    - [x] Tools without leaks.
    - [x] Tools with leaks.
  - [x] `/api/audit` test asserts presence and coherence of `modules.techStack`.

---

## Part 5 — Module 4 (Conversational Engine Invisibility Index)

- [x] **Data**
  - [x] `NormalizedStoreData.aiReadability` populated with schema flags and missing types.
  - [x] `getReviewSentiment` wired and returns review density + crawlability when possible.

- [x] **Module logic**
  - [x] `ModuleAIVisibilityOutput` type defined with indexScore, schemaValid, crawlableReviews, missingSchemaTypes, dreamStateDescription, dreamStateDollarImpact.
  - [x] `buildAIVisibilityModule`:
    - [x] Computes schemaScore (0–80) based on schema flags.
    - [x] Computes reviewsScore (0–20) based on reviewDensity and crawlableReviews.
    - [x] Returns `indexScore = schemaScore + reviewsScore` in [0, 100].
    - [x] Sets `schemaValid` appropriately.
    - [x] Builds `dreamStateDollarImpact` from index gap.

- [x] **Pipeline**
  - [x] `/api/audit` calls `getReviewSentiment` and passes data into Module 4.
  - [x] `modules.aiVisibility` attached with correct shape.

- [x] **UI**
  - [x] `ModuleAIVisibility.tsx` renders correctly.
  - [x] Shows AI visibility index as `score/100`.
  - [x] Lists missing schema types clearly.
  - [x] Shows simulation mode messaging when `dataMode = 'simulated'`.

- [x] **Tests**
  - [x] `tests/lib/modules/aiVisibility.test.ts` covers:
    - [x] No schema + no reviews (low score).
    - [x] Full schema + dense crawlable reviews (high score).
  - [x] `/api/audit` test asserts `modules.aiVisibility` structure and responsiveness to schema flags.

---

## Part 6 — Module 5 (Valuation & Equity Loss)

- [x] **Financial logic**
  - [x] `computeAnnualRevenue` implemented and:
    - [x] Returns ≥ 0.
    - [x] Floors result at $1,000,000 when below.
  - [x] `computeValuationBand` implemented with bear/base/bull multiples.
  - [x] `computeRiskDiscount` implemented with margin gap, stockout ratio, AI gap, signal contamination.
  - [x] `computeRiskDiscount` output is clamped in [0, 85].
  - [x] `computeEquityLoss` multiplies base valuation by risk discount.

- [x] **Module logic**
  - [x] `ModuleValuationOutput` type defined.
  - [x] `buildValuationModule`:
    - [x] Computes `ValuationResult` and module output.
    - [x] Uses category benchmarks as specified.
    - [x] Sets `dreamStateDescription` and `dreamStateDollarImpact` (≥ equityLoss).

- [x] **Pipeline**
  - [x] `/api/audit` attaches `valuation` and `modules.valuation` with correct values.

- [x] **UI**
  - [x] `ValuationBand.tsx` renders Bear/Base/Bull values.
  - [x] `ModuleValuation.tsx` renders equity loss, risk discount, annual revenue.
  - [x] ExecutiveSummary shows valuation band and equity loss.

- [x] **Tests**
  - [x] `tests/lib/financial.test.ts` extended to cover:
    - [x] Revenue floor at $1M.
    - [x] Risk discount cap at 85%.
    - [x] EquityLoss correlation with risk.
  - [x] `/api/audit` test asserts coherent valuation outputs.

---

## Part 7 — Competitive Shadow Benchmark

- [x] **Intake**
  - [x] Intake form contains an optional `competitorDomain` field.
  - [x] Submitting without competitor works exactly as before.
  - [x] Invalid competitor domains do not crash the app.

- [x] **Types & pipeline**
  - [x] `CompetitorBenchmark` type defined.
  - [x] `/api/audit` runs a minimal competitor pipeline when `competitorDomain` is valid.
  - [x] `modules.competitorBenchmark` is attached when available.
  - [x] Main brand CQI and valuation are not altered by competitor analysis.

- [x] **UI**
  - [x] `CompetitiveBenchmark.tsx` renders only when competitor data exists.
  - [x] Side-by-side view shows CQI grade, evidence, ads, AI index, base valuations.

- [x] **Tests**
  - [x] `/api/audit` integration test:
    - [x] No competitor: `competitorBenchmark` absent or null.
    - [x] With competitor: `competitorBenchmark` present and primary metrics unchanged.

---

## Part 8 — PDF Export & Resolution Protocol

- [x] **PDF export**
  - [x] `POST /api/export-pdf` exists and accepts `{ domain }`.
  - [x] For an existing audit:
    - [x] Returns HTTP 200.
    - [x] `Content-Type: application/pdf`.
    - [x] Response body is non-empty and opens as a PDF.
  - [x] For a missing audit:
    - [x] Returns a non-200 status with clear error JSON (no server crash).

- [x] **Print layout**
  - [x] `ReportPrintLayout` renders a single-column, print-friendly report.
  - [x] Includes cover, executive summary, module summaries, and resolution overview.

- [x] **Report UI**
  - [x] “Download PDF” button visible on report page.
  - [x] Clicking button downloads a PDF file named `cqi-{domain}.pdf`.

- [x] **Resolution Protocol**
  - [x] `app/resolution/[domain]/page.tsx` loads using `domain` param.
  - [x] When an audit exists:
    - [x] Shows a prioritized list of actions derived from Modules 1–5.
  - [x] When no audit exists:
    - [x] Shows a clear “No report found” message and a link back to main page.

- [x] **Manual QA**
  - [x] PDF export tested on at least one real store; content is coherent.
  - [x] Resolution page tested on at least one real store; priorities make sense.

---

Use this checklist as the enforcement mechanism:  
**Do not proceed to the next part until every item in the current part’s section is checked.**