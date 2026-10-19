# QA and Diagnostic Pass Report — CQI Micro-SaaS

This report compiles the results of the hyper-detailed, end-to-end quality assurance (QA) and diagnostics audit executed on the CQI micro-SaaS application codebase.

---

## 1. Executive Summary

- **Overall Test Status**: **PASS**
  - **Automated Suite**: 77/77 unit & integration tests passing cleanly.
  - **Build Suitability**: Next.js production build (`npm run build`) compiles successfully into optimized static and server-rendered pages without any type-checking or linting errors.
- **Scope Verified**: Multi-page onboarding intake flow, horizontal module-tab dashboard layout, PDF exports, Supabase caches, Shopify gating checks, Apify integration scripts, and NVIDIA NIM normalizers.
- **Key Fixes Implemented**:
  1. **Next.js Fetch Caching Resolution (Supabase Mismatch)**: Configured a custom `fetch` handler inside the Supabase client wrapper setting `cache: 'no-store'`. This successfully bypassed Next.js 14's default fetch caching behaviour, enabling immediate report retrieval on cache hits.
  2. **Lazy Supabase Initialization**: Refactored module-level client creation to lazy-load the client through `getSupabaseClient()`, preventing environment variable lookup conflicts at compile/build time.
  3. **In-Memory Fallback Check**: Upgraded database query miss fallback logic to check the local in-memory cache map as a secondary fallback, guaranteeing that reports load instantly after a successful audit even if database commits are slow.
  4. **Shopify Validation Page Halt**: Adjusted `app/page.tsx` submit handler to explicitly check for response status codes. It now displays server-returned error notifications inline and halts the intake flow when invalid or non-Shopify domains are entered, instead of incorrectly redirecting the user to `/configure/[domain]`.

---

## 2. E2E UI Flow Diagnostics

### 2.1 Landing Page Intake & Shopify Storefront Gating (`/`)
- **Normalized Address Handling**: Form inputs are normalized via `normalizeDomain` (stripping protocols like `https://` and trailing slashes `/`).
- **Cache Redirection**: The landing page correctly requests `/api/report?domain=...`.
  - **Cache Hit**: Returns `200 OK` and immediately routes the client to `/report/[domain]`.
  - **Cache Miss (Shopify)**: Returns `404 Not Found` and routes the client to `/configure/[domain]` to input sliders.
  - **Cache Miss (Non-Shopify)**: Returns `422 Unprocessable Entity`. The submit handler captures the error message inline (`"This domain does not appear to be a Shopify store..."`) and disables the loading state to halt onboarding.

### 2.2 Parameters Configuration Page (`/configure/[domain]`)
- **UI Elements**: Displays the normalized domain at the top. Includes sliders for Spend, AOV, and Return/Refund rates, along with dropdown selectors for Promo/Coupon Frequency and Vertical.
- **Spend Input Toggles**: The "Enter Exact Amount" checkbox removes the slider and provides a text input for precise marketing budgets.

### 2.3 Diagnostic Execution Runner (`/run/[domain]`)
- **Progress Telemetry**: Renders an animated `ExecutionLog` detailing steps: Validating store domain, Crawling Shopify storefront, Executing NIM LLM data normalization, and Running CQI scoring engines.
- **Audit POST Pipeline**: Triggers a background `POST /api/audit` request with the slider data. On completion, it routes to `/report/[domain]`.

### 2.4 Report Dashboard & ModuleTabs (`/report/[domain]`)
- **BrandOverview Panel**: Synthesizes the niche, category, brand description, target audience, product categories, best sellers, and pop-up details.
- **Key Metrics Row**: The 5-column metric display is populated under the BrandOverview card, showing Category, Niche, Primary Audience, Est. Annual Revenue, and the final calculated CQI Grade & Label.
- **Module Tabs Navigation**: Positioned under key metrics, allowing users to toggle between module views (`ad-signal`, `stockout`, `tech-stack`, `ai-visibility`, `valuation`, `resolution`).
- **Tab Component Views**:
  - **Ad Signal**: Displays distortion %, coupon dependency %, pixel value vs real unit profit, and the contamination narrative.
  - **Stockout**: Renders variant OOS rates, monthly wasted ad spend, and inventory conflict URL catalogs.
  - **Tech Stack**: Lists annual SaaS spend estimates, underutilized tool alerts, active tech directories, and redundancy narratives.
  - **AI Visibility**: Renders the AI Visibility Index, JSON-LD schema checkmarks, crawlable review states, and consensus summaries.
  - **Valuation**: Displays risk markdowns, Bear/Base/Bull capitalizations, and equity loss figures.
  - **Resolution Protocol**: Displays prioritized actions based on active leaks.

---

## 3. External API Integrations

### 3.1 Apify Actors & Fallback Modes
- **Wrapper Executions**: `lib/data/apify/` wrappers handle actor queries for BuiltWith, Meta Ads Library (capped at 10 items), Google Ads, and Google Search.
- **Token Rotation Logic**: Integrates safe token rotations through environment variables (`APIFY_TOKEN_1` to `APIFY_TOKEN_4`).
- **Degraded Fallbacks**: If any Apify client actor times out or fails (e.g. invalid tokens), the client catches the error and degrades to mock structures, allowing the audit scoring formulas to execute without crashing the client request.

### 3.2 NVIDIA NIM Integration
- **Normalizer Models**: `lib/data/nim/client.ts` uses OpenAI SDK mapping pointing to NVIDIA's NIM API base URL (`https://integrate.api.nvidia.com/v1`) using `meta/llama-3.1-8b-instruct`.
- **Mock Fallback Handling**: If NVIDIA API keys are missing or credentials fail, the client defaults to `getMockNormalizedData()`, which dynamically generates mocked JSON store records.

---

## 4. Supporting Features

### 4.1 PDF Buffer Export
- **Route Endpoint**: `POST /api/export-pdf` returns a generated PDF buffer.
- **Font Registration**: Resolves Roboto-Regular and Roboto-Bold TTF files from `public/fonts/`. If fonts are missing, it defaults to standard Helvetica typography.

### 4.2 Supabase Caching Dual-Write
- **Table Constraints**: Matches table schema `cqi_diagnostic_audits` with `domain` configured as a UNIQUE key constraint.
- **Resilience**: Bypasses Next.js fetch caching using custom no-store options, while writing database results to a local memory cache map. If Supabase connections time out or connection variables are missing, the client falls back to reading/writing to the local memory cache to keep the session active.

---

## 5. QA Diagnostic Pass Metrics

| Scope | Test Strategy | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Landing Intake** | Probed invalid domains, Shopify domains, non-Shopify domains | **PASS** | Halts correctly on non-Shopify domains showing 422 error |
| **Sliders Config** | Verified slider values propagation and exact spend toggles | **PASS** | Validates parameter formats and range configurations |
| **Runner Logging** | Monitored log step animations and API exception overrides | **PASS** | Back-to-configure links render correctly on failures |
| **Module Views** | Inspected grid switches, active indicator borders, and metrics formatting | **PASS** | Key metrics, BrandOverview, and Resolution Plan compile cleanly |
| **Apify Clients** | Executed happy path mocks and timeouts abort routines | **PASS** | Aborts rotating tokens on execution timeouts to avoid double billing |
| **NIM AI Models** | Simulated API key failures and checked fallback mock returns | **PASS** | Degrades cleanly to local JSON mock structures |
| **PDF Generation** | Generated PDF buffers and checked font registry | **PASS** | Prevents compilation errors with external packages configuration |
| **Supabase Cache** | Tested cache writes, database misses, and connection fallbacks | **PASS** | Bypasses Next.js fetch caching; fallback to local Map cache |
| **Calendly CTA** | Clicked header CTA across all page routes | **PASS** | PERSISTENT navigation header layout on all screens |
