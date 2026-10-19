import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseHtmlTechStack } from '../lib/data/techScanner'
import { scrapeShopifyCatalog } from '../lib/data/shopifyScraper'
import {
  fetchGoogleSearchAndCheckScale,
  evaluateUniversalBlunderGuard,
  KNOWN_ENTERPRISE_BRANDS,
} from '../lib/data/apify/googleSearch'
import { getFallbackScaleAssessment } from '../lib/data/groq/client'

describe('Native $0.00 DOM Tech Stack Scanner', () => {
  it('detects CAPI, pixels, ESPs, reviews, and counts script bloat', () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script src="https://connect.facebook.net/en_US/fbevents.js"></script>
          <script src="https://analytics.tiktok.com/i18n/pixel/sdk.js"></script>
          <script src="https://www.googletagmanager.com/gtm.js?id=GTM-123"></script>
          <script src="https://static.klaviyo.com/onsite/js/klaviyo.js"></script>
          <script src="https://rechargepayments.com/recharge.js"></script>
          <script src="https://cdn.judge.me/widget.js"></script>
          <script src="https://getelevar.com/capi.js"></script>
          <script src="/scripts/custom1.js"></script>
          <script src="/scripts/custom2.js"></script>
          <script src="/scripts/custom3.js"></script>
        </head>
        <body>
          <h1>Store</h1>
        </body>
      </html>
    `

    const result = parseHtmlTechStack(mockHtml)
    expect(result.detectedPixels).toContain('Meta Pixel')
    expect(result.detectedPixels).toContain('TikTok Pixel')
    expect(result.detectedPixels).toContain('Google Tag Manager')
    expect(result.detectedPixels).toContain('Elevar CAPI')
    expect(result.detectedRetention).toContain('Klaviyo')
    expect(result.detectedSubscriptionUpsell).toContain('Recharge')
    expect(result.detectedReviews).toContain('Judge.me')
    expect(result.hasCapiSignal).toBe(true)
    expect(result.externalScriptCount).toBeGreaterThanOrEqual(10)
  })
})

describe('Shopify Catalog Scraper Calculations', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('calculates bundle ratio, variant friction, stockouts, and catalog AOV', async () => {
    const mockProducts = [
      {
        id: 101,
        title: 'Longevity Bundle Kit (30-day supply)',
        product_type: 'Bundles',
        variants: [
          { id: 1, price: '120.00', compare_at_price: '150.00', available: true },
          { id: 2, price: '120.00', compare_at_price: null, available: false },
        ],
      },
      {
        id: 102,
        title: 'Single Starter Vitamin',
        product_type: 'Supplements',
        variants: [
          { id: 3, price: '45.00', compare_at_price: null, available: true },
          { id: 4, price: '45.00', compare_at_price: null, available: true },
          { id: 5, price: '45.00', compare_at_price: null, available: true },
          { id: 6, price: '45.00', compare_at_price: null, available: true },
          { id: 7, price: '45.00', compare_at_price: null, available: true },
          { id: 8, price: '45.00', compare_at_price: null, available: true }, // > 5 variants: high friction
        ],
      },
    ]

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products.json')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ products: mockProducts }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ collections: [] }) })
    })

    const metrics = await scrapeShopifyCatalog('sample-catalog.com')
    expect(metrics.totalProductsSampled).toBe(2)
    expect(metrics.bundleRatioPct).toBe(50) // 1 out of 2 products
    expect(metrics.highFrictionVariantPct).toBe(50) // 1 out of 2 products has >5 variants
    expect(metrics.discountMarkedPct).toBeGreaterThan(0)
    expect(metrics.stockoutVariantPct).toBeGreaterThan(0)
    expect(metrics.estimatedCatalogAOV).toBeGreaterThan(metrics.medianSkuPrice)
  })
})

describe('Universal 3-Layer Telemetry Blunder Guard', () => {
  it('triggers spendBlunderDetected = true and calibrates spend & revenue upward when gymshark.com is provided with $10,000 ad spend', () => {
    const realityCheck = evaluateUniversalBlunderGuard({
      domain: 'gymshark.com',
      userMonthlyRevenue: 100000,
      userAdSpend: 10000,
      activeAdCount: 160,
    })

    expect(realityCheck.overrideApplied).toBe(true)
    expect(realityCheck.spendBlunderDetected).toBe(true)
    expect(realityCheck.revenueBlunderDetected).toBe(true)
    expect(realityCheck.calibratedAdSpend).toBe(
      KNOWN_ENTERPRISE_BRANDS['gymshark.com'].adSpendFloor
    )
    expect(realityCheck.calibratedMonthlyRevenue).toBe(
      KNOWN_ENTERPRISE_BRANDS['gymshark.com'].monthlyRevenueFloor
    )
    expect(realityCheck.reason).toContain('Telemetry Sanity Guard Triggered')
    expect(realityCheck.detectedScaleTier).toBe('ENTERPRISE')
  })

  it('triggers spendBlunderDetected = true when any brand has 65 active ads and only $5,000 ad spend entered', () => {
    const realityCheck = evaluateUniversalBlunderGuard({
      domain: 'growth-brand.com',
      userMonthlyRevenue: 250000,
      userAdSpend: 5000,
      activeAdCount: 65,
    })

    expect(realityCheck.overrideApplied).toBe(true)
    expect(realityCheck.spendBlunderDetected).toBe(true)
    expect(realityCheck.calibratedAdSpend).toBeGreaterThanOrEqual(45000)
    expect(realityCheck.reason).toContain('Telemetry Sanity Guard Triggered')
  })

  it('cleanly falls back to deterministic sub-niche and dynamic competitor when Groq oracle is offline', () => {
    const fallback = getFallbackScaleAssessment('clean-pet-brand.com', 'pets', 55)
    expect(fallback.estimatedTier).toBe('mid_market_growth')
    expect(fallback.subNicheName).toContain('Pet')
    expect(fallback.dynamicCompetitor.name).toBeDefined()
    expect(fallback.dynamicCompetitor.cqiScore).toBeGreaterThan(80)
    expect(fallback.live2026SubNicheBenchmarks.benchmarkAOV).toBeGreaterThan(0)
    expect(fallback.evidence).toBe('DETERMINISTIC_BENCHMARK')

    const realityCheck = evaluateUniversalBlunderGuard({
      domain: 'clean-pet-brand.com',
      userMonthlyRevenue: 30000,
      userAdSpend: 4000,
      activeAdCount: 55,
      groqAssessment: fallback,
    })

    expect(realityCheck.subNicheName).toContain('Pet')
    expect(realityCheck.dynamicCompetitor?.name).toBe(fallback.dynamicCompetitor.name)
    expect(realityCheck.overrideApplied).toBe(true)
  })

  it('triggers overrideApplied = true via fetchGoogleSearchAndCheckScale when gymshark.com has low revenue', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    try {
      const result = await fetchGoogleSearchAndCheckScale('gymshark.com', 100000, 20000)
      expect(result.realityCheck.overrideApplied).toBe(true)
      expect(result.realityCheck.originalMonthlyRevenue).toBe(100000)
      expect(result.realityCheck.calibratedMonthlyRevenue).toBe(
        KNOWN_ENTERPRISE_BRANDS['gymshark.com'].monthlyRevenueFloor
      )
      expect(result.realityCheck.calibratedAdSpend).toBe(
        KNOWN_ENTERPRISE_BRANDS['gymshark.com'].adSpendFloor
      )
      expect(result.realityCheck.reason).toContain('Telemetry Sanity Guard Triggered')
      expect(result.realityCheck.detectedScaleTier).toBe('ENTERPRISE')
    } finally {
      global.fetch = originalFetch
    }
  })

  it('keeps self-reported numbers when a brand reports realistic scale', async () => {
    const originalFetch = global.fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    try {
      const result = await fetchGoogleSearchAndCheckScale('gymshark.com', 45000000, 7000000)
      expect(result.realityCheck.overrideApplied).toBe(false)
      expect(result.realityCheck.calibratedMonthlyRevenue).toBe(45000000)
    } finally {
      global.fetch = originalFetch
    }
  })
})
