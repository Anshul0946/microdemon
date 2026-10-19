# CQI – Commercial Quality Index Diagnostic Console

The **Commercial Quality Index (CQI)** is a specialized diagnostic platform for Shopify storefronts. It audits e-commerce brands by crawling public data and assessing marketing efficiency, inventory coverage, technology stack redundancy, search visibility, and terminal valuation. The platform combines parallelized web scrapers, NVIDIA NIM-powered data normalization, and mathematical modeling to calculate an index grade and design a structured remediation checklist.

---

## Key Features

### 1. Multi-Step Onboarding Pipeline
- **Landing Console (`/`)**: Input a brand domain. The system normalizes the address, checks the Supabase cache for a fresh report, and validates the storefront's Shopify compatibility (probing `products.json` and scanning HTML tags) to gate onboarding.
- **Parameters Configuration (`/configure/[domain]`)**: Supply custom marketing sliders, including monthly ad spend (exact or tiered), average order value (AOV), return rate, promo/coupon dependency, and standard vertical configuration.
- **Diagnostic Execution Runner (`/run/[domain]`)**: Renders real-time animation logs as background tasks scrape and evaluate storefront metrics.
- **Report Dashboard (`/report/[domain]`)**: Interactive dashboard housing BrandOverview summary cards, core quantitative metrics (e.g. ad count, variant counts, annual revenue), and detailed module tabs.

### 2. Five Core Diagnostic Modules
- **Module 1: Ad Signal Contamination Matrix** – Measures discrepancy between raw tracked pixel AOV and true net profit per order by factoring in return rates, discount frequencies, and margin structures.
- **Module 2: Best-Seller Stockout Ledger** – Cross-references active ads destination links against variants availability. Estimates monthly ad budget leakages and wastage due to out-of-stock best-sellers.
- **Module 3: Tech Stack Redundancy Paradox** – Computes SaaS app budgets, flags premium apps (e.g., Triple Whale, Klaviyo, Elevar, Gorgias), and evaluates underutilization based on existing data leaks.
- **Module 4: Conversational Engine Invisibility Index** – Measures Schema.org markup validation (Product, Organization, FAQPage, Review) and crawls search overview coverage across AI models.
- **Module 5: Terminal Enterprise Valuation Markdown** – Generates valuation estimates (Bear, Base, Bull) based on vertical revenue multiples and applies risk discount markdowns.

### 3. Strategy & Export Utilities
- **Resolution Protocol** – Generates a prioritized, interactive 30–60 day action checklist mapping directly to identified leakage points.
- **PDF Export Engine** – Server-side PDF generation returning a printable summary document containing the brand overview, index score, and core metrics.

---

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Custom Harmonic Color System
- **Database / Caching**: Supabase (PostgreSQL) + Local in-memory cache fallback
- **AI Normalization**: NVIDIA NIM (`meta/llama-3.1-8b-instruct` OpenAI-compatible endpoint)
- **Scrapers**: Apify (BuiltWith technology scraper, Meta Ad library, Google Ads, Google Search)
- **PDF Exporter**: `pdfkit` (with Server Components external bundling setup)

---

## Running Locally

### Prerequisites
- **Node.js**: Version `18.17.0` or higher
- **npm** or **pnpm**

### Commands

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **Run Production Build & Start**:
   ```bash
   npm run build
   npm run start
   ```

4. **Run Tests**:
   ```bash
   npm run test
   ```

---

## Environment Variables

Create a `.env.local` file in the root of the project using the keys from `.env.example`:

```env
# Apify Scraper Tokens
APIFY_TOKEN_1=
APIFY_TOKEN_2=
APIFY_TOKEN_3=
APIFY_TOKEN_4=

# Apify Actor Configurations
APIFY_SHOPIFY_ACTOR_ID=solidcode/shopify-scraper
APIFY_META_ACTOR_ID=apify/meta-ads-scraper
APIFY_GOOGLE_ACTOR_ID=apify/google-ads-scraper
APIFY_TIKTOK_ACTOR_ID=apify/tiktok-ads-scraper
APIFY_GOOGLE_SEARCH_ACTOR_ID=apify/google-search-scraper

# NVIDIA NIM / AI Normalizer
AI_MODEL_BASE_URL=https://integrate.api.nvidia.com/v1
AI_MODEL_API_KEY=
AI_MODEL_ID=meta/llama-3.1-8b-instruct

# Supabase Configurations
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# App Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Deployment (Vercel)

1. Connect your GitHub repository to Vercel.
2. Add all environment variables listed above in the Vercel project settings.
3. Configure the build command as `npm run build` and output directory as `.next`.
4. Deploy the application.

---

## Security & Best Practices

- **Never commit your `.env.local` file** to version control. It is ignored by default in `.gitignore`.
- Do not expose the `SUPABASE_SERVICE_ROLE_KEY` or any `APIFY_TOKEN` on the client. All scraper and database queries must run on the server side (Next.js server-actions or API Route Handlers).
- Enable Row-Level Security (RLS) on your Supabase tables if configuring client-side access in the future.
