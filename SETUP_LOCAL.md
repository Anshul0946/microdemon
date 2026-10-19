# Local Setup Guide for CQI Micro-SaaS

This guide walks you through configuring and running the CQI (Commercial Quality Index) diagnostic application in your local environment.

---

## Prerequisites

Before setting up the project, ensure you have installed:
- **Node.js**: Version `18.17.0` or higher (Node.js `20.x` recommended).
- **npm** (comes with Node.js) or **pnpm**.

You will also need credentials/accounts for:
1. **NVIDIA NIM**: Access key for OpenAI-compatible LLM execution.
2. **Apify**: Access token and custom actor configurations (Shopify, Meta, Google, TikTok, Google Search).
3. **Supabase**: A database project for caching/persisting the audit results.

---

## Environment Setup

The application uses environment variables to communicate with external services. We manage local secrets using Next.js's native `.env.local` support, which is already configured in `.gitignore` so your secrets will never be checked into git.

### Step-by-Step Env Configuration

1. **Copy the example configuration file** to create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
2. **Open `.env.local`** and enter your real service credentials:

   - **NVIDIA NIM Configuration**:
     - `AI_MODEL_API_KEY`: Paste your NVIDIA API key here (from [build.nvidia.com](https://build.nvidia.com/)).
     - `AI_MODEL_BASE_URL`: Leave as `https://integrate.api.nvidia.com/v1` or supply your preferred custom endpoint base URL.
     - `AI_MODEL_ID`: Supply the selected LLM model identifier (e.g. `meta/llama-3.1-8b-instruct`).

   - **Apify Configuration**:
     - `APIFY_TOKEN_1`: Input your primary Apify API token.
     - `APIFY_TOKEN_2`: Optional secondary token (if you want token rotation).
     - `APIFY_SHOPIFY_ACTOR_ID`: Actor ID for the Shopify storefront scraper (default: `solidcode/shopify-scraper`).
     - `APIFY_META_ACTOR_ID`: Actor ID for Meta Ads Library scraper (default: `apify/meta-ads-scraper`).
     - `APIFY_GOOGLE_ACTOR_ID`: Actor ID for Google Ads Library scraper (default: `apify/google-ads-scraper`).
     - `APIFY_TIKTOK_ACTOR_ID`: Actor ID for TikTok Ads scraper (default: `apify/tiktok-ads-scraper`).
     - `APIFY_GOOGLE_SEARCH_ACTOR_ID`: Actor ID for category/competitor research scraper (default: `apify/google-search-scraper`).

   - **Supabase Configuration**:
     - `SUPABASE_URL`: The project endpoint URL (found under Settings → API in your Supabase Dashboard).
     - `SUPABASE_SERVICE_ROLE_KEY`: The service role secret token (found under Settings → API in your Supabase Dashboard). **Never expose this token on the frontend.**

   - **App Configuration**:
     - `NEXT_PUBLIC_APP_URL`: Set to `http://localhost:3000` (used for local links and generating URLs).

3. **Verify Git Protection**:
   Ensure `.env.local` remains omitted from your commits to guarantee API tokens are kept private.

---

## Commands to Run

Once environment variables are defined, initialize and start the app:

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Run Development Server**:
   ```bash
   npm run dev
   ```
3. **Open App**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your web browser.

---

## Verification Flow

To verify that your installation works properly end-to-end:

1. **Submit Intake Form**:
   - Go to [http://localhost:3000](http://localhost:3000).
   - Enter a test storefront domain (e.g. `quick-brown-fox.myshopify.com` or a real Shopify store URL).
   - Adjust the input sliders (Ad Spend, AOV, Return Rate, Promo Frequency) and choose a vertical.
   - (Optional) Enter a competitor storefront domain to test the shadow benchmarking block.
   - Click **Run Commercial Quality Audit**.

2. **Check Execution Log**:
   - Verify the intake transitions to the real-time execution log.
   - The logger will display sequential steps as scrapers query data and normalization LLM parses it.

3. **Inspect the Generated Report**:
   - Ensure the diagnostic page displays the overall CQI score, grade, and the five main modules:
     - *Module 1: Ad Signal Contamination Matrix*
     - *Module 2: Best-Seller Stockout Ledger*
     - *Module 3: Tech Stack Redundancy Paradox*
     - *Module 4: Conversational Engine Invisibility Index*
     - *Module 5: Terminal Enterprise Valuation Markdown*
   - If a competitor was provided, verify the **Competitive Shadow Benchmark** block renders comparisons accurately.

4. **Verify PDF Generation**:
   - Click the **Download PDF** button at the top of the report.
   - Ensure it returns a compiled PDF download containing the entire executive overview and audit data.

5. **Verify Resolution Protocol**:
   - Click the **Resolution Protocol** action checklist link.
   - Confirm it opens the interactive remediation planner page listing prioritized recommendations with checkboxes.

---

## Troubleshooting & Graceful Degradation

If external services are missing keys or return API errors, the system is designed to degrade gracefully rather than fail:

- **Missing NVIDIA NIM API Key**:
  - The server logs a console warning: `[AI NIM Client] AI_MODEL_API_KEY is not configured.`
  - The client falls back to local simulated mock data. The audit will still successfully generate a report for review.
- **Missing or Failed Apify Actors**:
  - The system prints warnings (e.g., `[Apify Client] No tokens configured. Skipping actor run...`).
  - Scraper wrappers return empty datasets. The main audit remains unaffected, though target scores for that module might degrade to a safe default/reduced evidence level.
- **Supabase Credentials Missing / Misconfigured**:
  - The server prints: `[Supabase Client] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing...`
  - The server automatically handles storage locally inside an in-memory cache map. Persistence is skipped, but reports and PDFs can still be loaded and downloaded successfully in the same session.
