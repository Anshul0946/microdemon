# PART 1 — UI Foundation & Intake

Goal of this part:

- Build the shell UI, design system wiring, and intake flow.
- Implement a thin `POST /api/audit` that:
  - Validates the request.
  - Calls only the Shopify analyzer actor.
  - Calls the AI normalizer once.
  - Computes a very simple CQI score.
- Prove that the end-to-end pipeline structure works.

Do **not** implement any module-specific logic yet.

---

## 1. Scope of Part 1 (what you MUST do)

You MUST:

1. Implement the global layout and design system wiring:
   - Fonts (Syne, Inter, JetBrains Mono).
   - Colors, spacing, and typography from `03_DESIGN_SYSTEM.md`.
2. Build the **IntakeForm** component with:
   - Domain input.
   - Sliders for spend, AOV, return rate, promo frequency.
   - Vertical dropdown.
3. Build the **ExecutionLog** component to show pipeline steps on the right.
4. Implement `POST /api/audit` with a **minimal** pipeline:
   - Validate request body.
   - Call `getShopifyStoreData(domain)`.
   - Call `callAIModel` once to normalize Shopify data + sliders into `NormalizedStoreData`.
   - Compute a **simple CQI score** using only sliders + basic Shopify signals.
   - Return a minimal `NormalizedAuditResult`.
5. Render:
   - CQI grade and label.
   - Evidence mode (`partial` hardcoded is OK for now).
   - A small text summary on the landing page.

You MUST NOT:

- Implement Modules 1–5.
- Implement stockout, tech stack, AI visibility, or valuation logic.
- Call Meta/Google/Similarweb actors.
- Implement competitive benchmark or PDF export.
- Modify design tokens or architecture defined in earlier files.

---

## 2. Files to create / modify in Part 1

### 2.1 `app/layout.tsx`

Responsibilities:

- Load fonts (Syne, Inter, JetBrains Mono).
- Set `body` classes for dark theme and base font.
- Provide the main content container.

Checklist:

- Use `--font-body` / Tailwind `font-body` for global body font.
- Set background color to `--color-bg`, text color to `--color-text`.

Example skeleton:

```tsx
import './globals.css'

export const metadata = {
  title: 'CQI — Customer Quality Index',
  description: 'Institutional-grade diagnostic for Shopify brands.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* font links defined in 03_DESIGN_SYSTEM.md */}
      </head>
      <body className="bg-cqi-bg text-cqi-text font-body antialiased">
        <div className="min-h-screen flex flex-col">
          {/* Optional Header */}
          <main className="flex-1 px-6 md:px-10 py-10">
            {children}
          </main>
          {/* Optional Footer */}
        </div>
      </body>
    </html>
  )
}
```

### 2.2 `app/page.tsx` (Home / Intake screen)

Responsibilities:

- Show:
  - Left side: hero + IntakeForm.
  - Right side: ExecutionLog + small summary panel for CQI grade after submit.
- Manage client-side state for:
  - `loading` / `error`.
  - `executionStatus` steps.
  - `result` (minimal `NormalizedAuditResult` from API).

Behavior:

1. When the form submits:
   - Reset execution log state.
   - Set status to `'running'`.
   - `fetch('/api/audit', { method: 'POST', body: JSON.stringify(payload) })`.
2. When the response returns:
   - Set status to `'success'` or `'error'`.
   - Store the result.
3. Render:
   - If result exists, show CQI grade and label in a small card.
   - Show a link/button to “View full report” (this can be a placeholder for now).

Layout:

```tsx
<div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
  <section className="space-y-8">
    {/* Hero copy + IntakeForm */}
  </section>
  <aside className="space-y-4">
    {/* ExecutionLog + small CQI summary card */}
  </aside>
</div>
```

### 2.3 `components/intake/IntakeForm.tsx`

Props:

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
  }) => void
  loading?: boolean
}
```

Responsibilities:

- Provide:
  - `domain` text input (Shopify domain to crawl).
  - Slider/inputs for:
    - `spend` (slider; optionally numeric exact field).
    - `aov`.
    - `returnRate` (0–100%, convert to 0–1).
    - `promoFrequency` (map discrete labels to 0–1).
  - `vertical` dropdown (default option: "Auto-detect", which delegates category benchmarking to the Google AI normalizer).
  - Note: Manual inputs for competitor domains and niche categories are removed from the UI. Competitors and categories are inferred automatically from Google AI Mode results.

UX constraints:

- Slider values clearly labelled with current number.
- All inputs grouped visually in a card.

Validation:

- Basic presence and numeric ranges on the client before calling `onSubmit`.
- Domain string trimmed and lowercased.

You do not need complex error handling yet; just show simple messages under fields.

### 2.4 `components/execution/ExecutionLog.tsx`

Props:

```ts
type ExecutionLogProps = {
  status: 'idle' | 'running' | 'success' | 'error'
  steps?: Array<{ label: string; status: 'pending' | 'active' | 'done' | 'failed' }>
}
```

Responsibilities:

- Show 3–4 key steps, e.g.:
  - Validating domain
  - Fetching Shopify data
  - Normalizing data
  - Computing CQI

Behavior:

- When `status === 'idle'`:
  - Show a placeholder hint (e.g., “Run a diagnostic to see the pipeline in motion.”).
- When `status === 'running'`:
  - Highlight active step in accent color.
- When `status === 'success'`:
  - All steps marked as done.
- When `status === 'error'`:
  - Final step shows failed state.

Visual:

- Use the terminal-style panel pattern from `03_DESIGN_SYSTEM.md`.

### 2.5 `lib/utils/validation.ts`

Add helper functions:

1. `normalizeDomain(domain: string): string`
   - Trim whitespace.
   - Lowercase.
   - Remove protocol (`http://`, `https://`) and trailing slashes.
   - Ensure result is just the host (`brand.com`, `www.brand.com`).

2. `isValidDomain(host: string): boolean`
   - Basic regex to check format.
   - Does not need to be perfect, just avoid obvious bad inputs.

3. `assertShopifyLikeDomain(host: string)` (optional)
   - For now, optional; deeper Shopify validation will come from the actor.

Used in `/api/audit` and IntakeForm.

---

## 3. `app/api/audit/route.ts` (minimal v1)

This is the **first version** of the main pipeline. It will be extended in later parts.

### 3.1 Responsibilities in Part 1

1. Parse JSON body.
2. Validate:
   - `domain` present and formatted.
   - Sliders within reasonable ranges:
     - `spend` ≥ 0.
     - `aov` ≥ 0.
     - `returnRate` between 0 and 1.
     - `promoFrequency` between 0 and 1.
   - `vertical` present.
3. Use `getShopifyStoreData(domain)` from `lib/data/apify/shopifyAnalyzer.ts`.
4. Call AI normalizer via `callAIModel` from `lib/data/nim/client.ts` with a **simple prompt**:
   - System prompt: “You are a data normalizer. Return strict JSON matching this TS type…”
   - User content: JSON containing `shopifyData` and `sliders`.
5. Parse AI JSON into `NormalizedStoreData`.
6. Compute a **simple CQI score**:
   - Start at 75.
   - Apply small adjustments based on slider values:
     - High `promoFrequency` → decrease.
     - Very high `returnRate` → decrease.
     - Very low `spend` might also lower the grade slightly.
7. Compose a placeholder `NormalizedAuditResult`:
   - `store` = `NormalizedStoreData`.
   - `sliders` = slider inputs.
   - `cqi` = { `grade`, `label` } (label based on thresholds).
   - `valuation` = 0s for now.
   - `modules` = `null` for all modules.
   - `evidenceState` = mark `shopify = true`, others `false`.
   - `dataMode` = `'partial'` (hardcoded is OK).
   - `evidenceConfidenceScore` = a simple constant, e.g., 40.
8. Return JSON.

### 3.2 Example CQI v1 scoring (simple)

In `lib/cqi/scoring.ts` (or inside route for now, but recommended in `scoring.ts` even for v1):

```ts
export function computeSimpleCQI(sliders: SliderInputs): CQIScore {
  let grade = 75

  // Penalty for high promo frequency (0–1)
  grade -= sliders.promoFrequency * 20

  // Penalty for high return rate (0–1)
  if (sliders.returnRate > 0.3) {
    grade -= (sliders.returnRate - 0.3) * 50
  }

  // Clamp
  if (grade > 100) grade = 100
  if (grade < 0) grade = 0

  const label =
    grade >= 85
      ? 'Asset Compounder'
      : grade >= 70
      ? 'Efficiency Opportunity'
      : grade >= 55
      ? 'Signal Contaminated'
      : grade >= 40
      ? 'Structurally Leaking'
      : 'Capital Destruction Risk'

  return { grade: Math.round(grade), label }
}
```

This will be replaced by the full scoring system in a later part, but it is enough to drive the UI.

---

## 4. Minimal types for Part 1 (`lib/cqi/types.ts`)

You do not need every type yet. Implement at least:

- `SliderInputs`
- `QuantitativeMetrics` (with minimal fields, e.g., `productCount`)
- `NormalizedStoreData`
- `CQIScore`
- `ValuationResult` (with numeric fields set to 0 in Part 1)
- `ModuleOutputs` with all module fields `null`
- `EvidenceState`
- `NormalizedAuditResult`

This matches the conceptual shapes in `04_DATA_LAYER.md` but can be trimmed to what Part 1 uses.

---

## 5. Tests required in Part 1

You must add tests before moving to Part 2.

### 5.1 Unit tests — `tests/lib/scoring.test.ts`

Implement simple tests for `computeSimpleCQI`:

- Case 1: Low promo + low returns:
  - Expect grade higher than baseline or not penalized heavily.
- Case 2: High promo + high returns:
  - Expect grade significantly lower.

Example:

```ts
it('penalizes high promo and returns', () => {
  const lowLeak = computeSimpleCQI({
    spend: 10000,
    aov: 80,
    returnRate: 0.05,
    promoFrequency: 0.1,
    vertical: 'Apparel',
  })

  const highLeak = computeSimpleCQI({
    spend: 10000,
    aov: 80,
    returnRate: 0.5,
    promoFrequency: 0.9,
    vertical: 'Apparel',
  })

  expect(highLeak.grade).toBeLessThan(lowLeak.grade)
})
```

### 5.2 Unit tests — `tests/lib/financial.test.ts`

For Part 1, you can implement placeholder tests:

- `computeAnnualRevenue` returns at least 0.
- Valuation functions return 0 when given zeros.
- This will be extended in Part 6.

### 5.3 Integration test — `tests/api/audit.test.ts`

- Mock `getShopifyStoreData` to return a fake Shopify response.
- Call `POST /api/audit` with a valid body.
- Assert:
  - Status code = 200.
  - Response body has:
    - `store.domain`
    - `cqi.grade`
    - `cqi.label`
    - `dataMode`
    - `modules` present with `null` values.

---

## 6. Manual QA for Part 1

Before moving to Part 2, you must manually verify:

1. On the home page:
   - Intake form renders correctly.
   - Using a valid Shopify domain, clicking “Run CQI Diagnostic”:
     - Updates ExecutionLog from idle → running → success.
     - Displays a CQI grade and label.
2. Invalid domains:
   - Show a user-friendly error (toast or inline) and do not call `/api/audit`.
3. API behavior:
   - On repeated runs with the same domain, the system remains stable (even if you are not caching yet).

---

## 7. Redesigned Visual & UX Architecture

The application has been restructured from a single-screen layout into a multi-page, light-themed diagnostics tool. All UI components are customized to match this modern experience.

### 7.1 Visual Styling & Light Theme Tokens
The interface has transitioned from a dark aesthetic to a modern, crisp, Slate-based light/neutral palette to increase readability and deliver a premium institutional diagnostic tool.
- **Background**: Soft light grey/off-white (`#f8fafc`).
- **Cards & Surfaces**: Clean white card widgets (`#ffffff`) with soft shadows and thin borders (`rgba(15, 23, 42, 0.08)`).
- **Typography**: Retains the Syne and Inter fonts but contrasts them on light panels.
- **Accent Palette**: Corporate Teal (`#0d9488` with hover state `#0f766e`).
- **CQI Grade Indicators**: High-readability vibrant colors suited for light containers:
  - Grade A: `#16a34a` (Green)
  - Grade B: `#84cc16` (Lime)
  - Grade C: `#d97706` (Amber)
  - Grade D: `#ea580c` (Orange)
  - Grade F: `#dc2626` (Red)

### 7.2 Global Navigation Shell (`app/layout.tsx`)
- Adds a sticky header at the top of all views (`sticky top-0 z-50 bg-cqi-bg/85 backdrop-blur-md`).
- Renders the brand logo ("CQI Diagnostic") on the left and a persistent "Book a Call" CTA button on the right which links to the user's Calendly calendar (`https://calendly.com/your-agency/cqi-strategy-call`).

### 7.3 Onboarding Multi-Page Navigation Route Flow
The intake flow is segmented across multiple routes to guide users step-by-step:
1. **`/` (Landing Page)**: Centered hero layout featuring a single text input to enter a Shopify domain. Submitting the form:
   - Validates store domain formatting.
   - Hits `GET /api/report?domain=normalizedDomain` to check if a cached audit exists.
   - Redirects to `/report/[domain]` on a Cache Hit.
   - Redirects to `/configure/[domain]` on a Cache Miss.
2. **`/configure/[domain]`**: A dedicated parameter input screen. Shows the static domain being audited and renders the sliders (Monthly Spend, AOV, Return Rate, Promo Frequency, Category). Submitting the parameters serializes the sliders into URL query parameters and routes the user to `/run/[domain]`.
3. **`/run/[domain]`**: A loading pipeline step-by-step view. Extracted params are queried and fired client-side to `POST /api/audit`. Polished active/pending log step animations keep the user engaged. When the audit completes successfully, it auto-redirects to `/report/[domain]`.
4. **`/report/[domain]`**: The central dashboard page. Includes a responsive 5-column **Key Metrics Row** (Category, Niche, Primary Audience, Est. Annual Revenue, and CQI Index) positioned at the top of the report below the Brand Overview card.

---

## 8. Completion criteria for Part 1
Part 1 is **DONE** only when:
- The light theme variables in `globals.css` are active.
- Global layout contains the header shell and Calendly booking button.
- Intake flow operates across `/`, `/configure/[domain]`, `/run/[domain]`, and `/report/[domain]` with automatic redirects.
- Unit and integration tests pass successfully without logic regressions.

---

## 9. Part 2 — Dashboard Redesign (Module Tabs & Detailed Views)

The report dashboard's diagnostic modules area is redesigned from a stacked vertical layout into an interactive horizontal tabbed workspace.

### 9.1 Module Tab Bar Navigation
- Positioned directly below the **Key Metrics Row** and above the **Executive Summary**.
- Tabs render as a horizontal list on desktop and a scrollable row on mobile screens.
- Utilizes kebab-case tab IDs:
  - `ad-signal` (label: "Ad Signal")
  - `stockout` (label: "Stockout")
  - `tech-stack` (label: "Tech Stack")
  - `ai-visibility` (label: "AI Visibility")
  - `valuation` (label: "Valuation")
  - `resolution` (label: "Resolution / Plan")
- Features clean light theme variables and a Teal active indicator bar (`border-cqi-accent text-cqi-accent`).

### 9.2 Tab Content Structure
Each tab maps to a detailed view displaying specific diagnostics and actions:
- **Ad Signal**: Signal contamination percentage, reported pixel vs real unit profit comparison chart, signal distortion, coupon dependency, contamination sources, attribution narrative, and margin alignment checklist.
- **Stockout**: Monthly wasted ad spend, variant OOS deficit share, active conflict URL counts, list of inventory conflict collection landers, bounce rate dynamics, and SKU pause script checklist.
- **Tech Stack**: Annual SaaS spend estimate, underutilized system alerts, discovered premium apps list with categories/cost tiers/active status, SaaS redundancy analysis narrative, and stack consolidation actions.
- **AI Visibility**: Search Visibility index score, JSON-LD structured schema validations, crawlable reviews indicator, missing schema type lists, Perplexity/Google/ChatGPT answer summaries, competitor discovery SERP list, audience demographic hints, and crawlers site map checklist.
- **Valuation**: Current capital loss metrics, ideal valuation band cases (Bear, Base, Bull) structured as high-contrast widgets, risk markdown status, reclaimed dream state valuation, and equity recovery narrative.
- **Resolution**: Prioritized checklist showing days 1–15, 16–30, and 31–60 action checklists compiled dynamically based on active telemetry leaks.

### 9.3 Scope Restrictions
- All modifications are confined strictly to the report dashboard page (`app/report/[domain]/page.tsx`), the tabs navigation, and the module detailed views.
- The multi-page onboarding route flows, header links, Supabase cache tables, and underlying module/scoring calculations in `lib/cqi/` remain entirely unchanged.