# PART 8 — PDF Export & Resolution Protocol

Goal of this part:

- Add a **PDF export** of the CQI report.
- Add a **Resolution Protocol** view that turns leaks into a prioritized action checklist.
- Keep all existing behavior intact.

Do **not** change modules’ logic or scoring formulas in this part.

---

## 1. Scope of Part 8 (what you MUST do)

You MUST:

1. Implement a `POST /api/export-pdf` endpoint that:
   - Accepts a `domain`.
   - Renders a print-friendly report layout on the server.
   - Returns a PDF binary.
2. Add a “Download PDF” button in the report UI that triggers this endpoint.
3. Add a Resolution Protocol route:
   - `app/resolution/[domain]/page.tsx`
   - Shows prioritized actions derived from Modules 1–5.
4. Ensure both PDF and Resolution pages handle missing/expired audits gracefully.

You MUST NOT:

- Change the underlying CQI computations.
- Introduce auth or gating for PDF download in v1.

---

## 2. PDF export — API design

### 2.1 Endpoint

**Route:** `app/api/export-pdf/route.ts`  
**Method:** `POST`  

**Request body:**

```json
{
  "domain": "brand.com"
}
```

**Response:**

- `Content-Type: application/pdf`
- Status 200 on success.
- Body: PDF binary.

### 2.2 Implementation outline

1. Parse and validate `domain`.
2. Fetch latest audit:

   - Use `getAuditFromCache(domain)` from `lib/data/supabase/client.ts`.
   - If `null`:
     - Option A: return 404 with JSON `{ error: 'No report found for this domain' }`.
     - Option B: trigger `/api/audit` internally, wait for result, then continue.
   - For v1, prefer **Option A** (simpler and explicit).

3. Render a **print-only React layout** to HTML string:

   - Create a dedicated component, e.g., `components/pdf/ReportPrintLayout.tsx`.
   - This component:
     - Accepts `NormalizedAuditResult`.
     - Renders a linear, single-column version of the report (no animations, minimal color).
   - Use `ReactDOMServer.renderToString` to get HTML.

4. Use an HTML→PDF library compatible with serverless execution. Options (implementation-dependent):

   - `@react-pdf/renderer` or
   - Hosted Chrome/Puppeteer service, or
   - A lightweight HTML-to-PDF service.

   At a minimum, the spec expects:

   ```ts
   const pdfBuffer = await renderHtmlToPdf(html)
   ```

   You must implement `renderHtmlToPdf` in a way that works on your deployment target (Vercel).

5. Return response:

   ```ts
   return new NextResponse(pdfBuffer, {
     status: 200,
     headers: {
       'Content-Type': 'application/pdf',
       'Content-Disposition': `attachment; filename="cqi-${domain}.pdf"`,
     },
   })
   ```

---

## 3. Print layout (`components/pdf/ReportPrintLayout.tsx`)

Purpose:

- Provide a **stripped-down, printer-friendly** layout of the report.
- Reuse the same data but adjust styling for paper.

Props:

```ts
type ReportPrintLayoutProps = {
  result: NormalizedAuditResult
}
```

Sections (in order):

1. **Cover**

   - Product name + logo.
   - Brand domain.
   - Date generated.
   - Headline: CQI grade and equity loss.

2. **Executive summary**

   - CQI grade + label.
   - Evidence mode & confidence.
   - Annual revenue estimate.
   - Base valuation and equity loss headline.

3. **Module summaries**

   For each module (1–5):

   - Title.
   - 2–3 bullets summarizing:
     - Key findings.
     - Key numbers.
     - Most important implication.

4. **Resolution Protocol overview**

   - Link or reference to Resolution page.
   - Top 5 prioritized actions as bullet points.

Styling constraints:

- Single column.
- Use high contrast (white background, near-black text) regardless of app theme.
- Minimal use of color; rely on bold/italic/section titles.

---

## 4. Report UI — Download PDF button

In `app/report/[domain]/page.tsx`:

- Add a “Download PDF” button in the ExecutiveSummary area or page header.

Behavior:

1. When clicked:
   - Call `POST /api/export-pdf` with `{ domain }`.
   - When the response is OK:
     - Convert response to `Blob`.
     - Create an object URL.
     - Trigger a download with filename `cqi-{domain}.pdf`.

Example client-side helper:

```ts
async function handleDownloadPdf(domain: string) {
  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain }),
  })

  if (!res.ok) {
    // Show error toast
    return
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `cqi-${domain}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

Use a primary or ghost button styled via the design system.

---

## 5. Resolution Protocol page

### 5.1 Route

**File:** `app/resolution/[domain]/page.tsx`  

Route parameters:

- `domain` taken from URL segment.

### 5.2 Data loading

In this page:

1. Read the `domain` from URL params.
2. Call `GET /api/report?domain=...` or reuse a server-side helper that fetches from Supabase.
3. If no report:
   - Show a clear message:
     - “No CQI report found for this domain. Run a diagnostic first.”
   - Include a button/link back to the main page.

If a report exists:

- Pass `NormalizedAuditResult` into a `ResolutionProtocol` component.

### 5.3 ResolutionProtocol component

**File:** `components/report/ResolutionProtocol.tsx` (or similar).

Props:

```ts
type ResolutionProtocolProps = {
  result: NormalizedAuditResult
}
```

Goal:

- Turn Module outputs and valuation into a **prioritized action list**.

Structure:

1. **Header**

   - Title: `Resolution Protocol`.
   - Subtitle: “Prioritized actions to recover equity and fix structural leaks.”

2. **Priority list (Top leaks)**

   - For each relevant module, derive a “priority card”:

     Example structure:

     ```text
     Priority 1 – Fix Ad Signal Contamination
     - Evidence: Signal distortion at 62%, coupon dependency at 74%.
     - Why it matters: You’re optimizing on inflated revenue instead of profit.
     - Estimated impact: $X/year (from Module 5 or Module 1).
     - What to do next: [3–5 specific actions].
     ```

3. **Actions per module (conceptual)**

   - **Module 1 – Ad Signal**
     - Actions might include:
       - Align pixel events with net profit goals.
       - Reduce coupon codes in primary funnels.
       - Audit event firing logic for double-counting or misattribution.

   - **Module 2 – Stockout**
     - Actions:
       - Exclude out-of-stock SKUs from ad campaigns.
       - Add automated alerts when best-sellers approach low inventory.
       - Reroute budget to in-stock high-margin items.

   - **Module 3 – Tech Stack**
     - Actions:
       - Remove or downgrade underused premium tools.
       - Consolidate overlapping functionalities.
       - Reconfigure existing tools to directly address leaks from Modules 1–2.

   - **Module 4 – AI Visibility**
     - Actions:
       - Implement/clean Product, Review, and Organization schema.
       - Ensure reviews are crawlable and tied to products.
       - Create a process to keep schema updated with catalog changes.

   - **Module 5 – Valuation**
     - Actions:
       - Use risk discount breakdown to prioritize:
         - Margin improvement.
         - Stockout reduction.
         - AI visibility improvement.
         - Signal cleaning.
       - Sequence actions by largest equity impact first.

4. **Prioritization logic**

Rank priorities by:

- Highest `dreamStateDollarImpact` (from each module).
- When equal, prefer:
  - Ad Signal (Module 1) and Stockout (Module 2) first.
  - Then Tech Stack (Module 3).
  - Then AI Visibility (Module 4).

Implementation strategy:

- Collect an array of “actions” objects:

  ```ts
  type ActionItem = {
    id: string
    module: 'adSignal' | 'stockout' | 'techStack' | 'aiVisibility' | 'valuation'
    title: string
    summary: string
    estimatedImpact: number
    steps: string[]
  }
  ```

- Derive them using heuristics based on module outputs.
- Sort by `estimatedImpact` descending.
- Render as numbered list cards.

---

## 6. UI design for Resolution Protocol

Visual style:

- Uses the same dark design system.
- Layout:

  ```text
  ┌──────────────────────────────────────────────┐
  │ Resolution Protocol                          │
  │ Subtitle                                     │
  ├──────────────────────────────────────────────┤
  │ Priority 1                                   │
  │  [card]                                      │
  │ Priority 2                                   │
  │  [card]                                      │
  │ Priority 3                                   │
  │  [card]                                      │
  │ ...                                          │
  └──────────────────────────────────────────────┘
  ```

- Each priority card:
  - Title line (e.g., “Priority 1 – Fix Ad Signal Contamination”).
  - Short summary of the leak.
  - “Why it matters” line referencing equity and efficiency.
  - Bullet list of 3–5 concrete actions.

Ensure:

- The language is direct and actionable, matching the tone rules from the blueprint.
- No vague advice like “improve marketing”; be specific.

---

## 7. Tests required in Part 8

### 7.1 Integration tests — `tests/api/exportPdf.test.ts`

Add a new test file for the PDF endpoint:

1. When an audit exists:
   - Create a dummy record in Supabase for a test domain (or mock the `getAuditFromCache` call).
   - Call `POST /api/export-pdf` with the domain.
   - Assert:
     - Status code 200.
     - `Content-Type` header is `application/pdf`.
     - Response body is not empty.

2. When no audit exists:
   - Call with a domain that has no record.
   - Assert:
     - Status code 404 (or chosen error code).
     - JSON body includes error message.

### 7.2 Resolution Protocol — smoke tests

You can add a small test (optional) to check:

- Given a mocked `NormalizedAuditResult`:
  - `ResolutionProtocol` sorts actions in descending impact order.
  - At least one action is generated for each module that has significant leaks.

---

## 8. Manual QA for Part 8

Before considering Part 8 complete:

1. Run an audit for a real Shopify brand.
2. Visit the report page:
   - Click “Download PDF”.
   - Confirm a PDF file downloads and opens with a coherent report.
3. Visit `/resolution/[domain]`:
   - Confirm it loads and shows a prioritized list.
   - Ensure actions are grounded in the module outputs (not generic).
4. Test error behavior:
   - Visit `/resolution/[unknown-domain]` → see a clear “No report found” message.
   - Call PDF export for unknown domain → see error, not server crash.

---

## 8.5 Font Resolution & Test Environment Workarounds

To ensure PDF generation operates reliably in both local development and headless automated testing environments, the following font loading protocols are enforced:

### Default Font Selection & Fallbacks
- The default visual theme uses **Roboto** as the primary font family to maintain a modern, premium look.
- In standard operation, the generator seeks `Roboto-Regular.ttf` and `Roboto-Bold.ttf` located under the `/public/fonts` directory.
- If these assets are missing or cannot be read, the generator falls back gracefully to PDFKit's standard fonts: `Helvetica` and `Helvetica-Bold`.

### JSDOM Sandboxing Issue & Uint8Array Buffer Loading
- During automated testing with **Vitest / JSDOM**, PDFKit detects a browser-like environment because of the mocked global `window` object.
- In browser mode, PDFKit restricts loading fonts by passing plain string paths (e.g. `doc.registerFont('Name', 'path/to/font.ttf')`), raising a `"Not a supported font format or standard PDF font"` runtime error.
- **Solution**: The file must be read as a raw node buffer via `fs.readFileSync(path)`, wrapped explicitly inside a `new Uint8Array(buffer)` structure, and then passed directly to `doc.registerFont`. This guarantees consistent font registration in server, browser, and testing environments.

---

## 9. Completion criteria for Part 8

Part 8 is **DONE** only when:

- `POST /api/export-pdf` returns valid PDFs for domains with existing audits.
- A “Download PDF” button is present and works on the report page.
- `app/resolution/[domain]/page.tsx` renders a meaningful Resolution Protocol.
- Manual QA confirms both features work and are aligned with the product blueprint.
- New tests for PDF export pass.
- All Part 8 items in `QA_CHECKLIST.md` are checked.

With Part 8 complete, the end-to-end CQI product — from intake to modules, valuation, competitive benchmark, PDF, and resolution guidance — is fully implemented per the blueprint.