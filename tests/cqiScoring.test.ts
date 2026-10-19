import { describe, it, expect } from 'vitest'
import { VERTICAL_BENCHMARKS } from '../lib/config/benchmarks'
import {
  computeFinancialMetrics,
  computePillarScores,
  computeMasterCQI,
  getCustomerQualityTier,
  computeMarginLeaks,
} from '../lib/cqi/scoring'
import { computeCrossRelations } from '../lib/cqi/crossRelations'
import { buildCategoryLeaderComparison } from '../lib/cqi/competitive'

describe('5-Pillar CQI Scoring Engine & Margin Leaks', () => {
  const benchmark = VERTICAL_BENCHMARKS.supplements
  const mockInputs = {
    vertical: 'supplements' as const,
    monthlyRevenue: 150000,
    monthlyAdSpend: 50000,
    cogsPct: 24,
    refundRatePct: 6,
  }

  const mockShopifyData = {
    totalProductsSampled: 25,
    medianSkuPrice: 75,
    meanSkuPrice: 80,
    bundleRatioPct: 25,
    discountMarkedPct: 15,
    avgVariantsPerProduct: 3,
    highFrictionVariantPct: 10,
    stockoutVariantPct: 5,
    estimatedCatalogAOV: 83,
    sampleProducts: [],
  }

  const mockTechScan = {
    detectedPixels: ['Meta Pixel', 'Google Tag Manager', 'Elevar CAPI'],
    detectedRetention: ['Klaviyo'],
    detectedSubscriptionUpsell: ['Recharge'],
    detectedReviews: ['Okendo'],
    externalScriptCount: 20,
    hasCapiSignal: true,
    allDetectedApps: ['Meta Pixel', 'Elevar CAPI', 'Klaviyo', 'Recharge', 'Okendo'],
  }

  const mockMetaAds = {
    activeAdCount: 45,
    videoAdSharePct: 70,
    staticAdSharePct: 30,
    discountCopySharePct: 20,
    ascConcentrationRiskPct: 35,
    evidence: 'LIVE_SCRAPED' as const,
  }

  it('calculates derived financial metrics correctly', () => {
    const financials = computeFinancialMetrics(mockInputs, mockShopifyData, benchmark)
    expect(financials.effectiveAOV).toBe(83)
    expect(financials.currentMER).toBe(3.0) // 150000 / 50000
    expect(financials.monthlyOrders).toBeGreaterThan(1000)
    expect(financials.impliedBlendedCAC).toBeGreaterThan(0)
    expect(financials.firstOrderNetContributionPerOrder).toBeDefined()
    expect(financials.aovToCacRatio).toBeGreaterThan(1.0)
  })

  it('computes and clamps all 5 pillars within strictly defined boundaries', () => {
    const financials = computeFinancialMetrics(mockInputs, mockShopifyData, benchmark)
    const pillars = computePillarScores(
      mockInputs,
      financials,
      mockShopifyData,
      mockTechScan,
      mockMetaAds,
      benchmark
    )

    // Pillar 1: Unit Economics [12, 98]
    expect(pillars.unitEconomics).toBeGreaterThanOrEqual(12)
    expect(pillars.unitEconomics).toBeLessThanOrEqual(98)

    // Pillar 2: Paid Ad Signal [15, 96]
    expect(pillars.adSignal).toBeGreaterThanOrEqual(15)
    expect(pillars.adSignal).toBeLessThanOrEqual(96)

    // Pillar 3: Offer Architecture [18, 96]
    expect(pillars.offerArchitecture).toBeGreaterThanOrEqual(18)
    expect(pillars.offerArchitecture).toBeLessThanOrEqual(96)

    // Pillar 4: Signal Integrity [15, 98]
    expect(pillars.techStack).toBeGreaterThanOrEqual(15)
    expect(pillars.techStack).toBeLessThanOrEqual(98)

    // Pillar 5: Brand Authority [20, 96]
    expect(pillars.brandAuthority).toBeGreaterThanOrEqual(20)
    expect(pillars.brandAuthority).toBeLessThanOrEqual(96)

    const masterScore = computeMasterCQI(pillars)
    expect(masterScore).toBeGreaterThanOrEqual(0)
    expect(masterScore).toBeLessThanOrEqual(100)

    const tier = getCustomerQualityTier(masterScore)
    expect(tier.tier).toBeTruthy()
    expect(tier.description).toBeTruthy()
  })

  it('computes the 3 quantified dollar leaks with exposed diagnosis and locked remediation steps', () => {
    const financials = computeFinancialMetrics(mockInputs, mockShopifyData, benchmark)
    const pillars = computePillarScores(
      mockInputs,
      financials,
      mockShopifyData,
      mockTechScan,
      mockMetaAds,
      benchmark
    )
    const leaks = computeMarginLeaks(
      mockInputs,
      financials,
      pillars,
      mockShopifyData,
      mockTechScan,
      benchmark
    )

    expect(leaks.length).toBe(3)

    // Leak 1: Ad Fatigue
    expect(leaks[0].id).toBe('ad_fatigue_bleed')
    expect(leaks[0].monthlyLossDollars).toBeGreaterThan(0)
    expect(leaks[0].lockedRemediationSteps.length).toBe(3)

    // Leak 2: Single-SKU Compression
    expect(leaks[1].id).toBe('single_sku_compression')
    expect(leaks[1].monthlyLossDollars).toBeGreaterThan(0)
    expect(leaks[1].lockedRemediationSteps.length).toBe(3)

    // Leak 3: Script Drag
    expect(leaks[2].id).toBe('script_drag_repeat_ltv')
    expect(leaks[2].monthlyLossDollars).toBeGreaterThan(0)
    expect(leaks[2].lockedRemediationSteps.length).toBe(3)
  })

  it('generates the 4 cross-pillar compounding relations', () => {
    const financials = computeFinancialMetrics(mockInputs, mockShopifyData, benchmark)
    const pillars = computePillarScores(
      mockInputs,
      financials,
      mockShopifyData,
      mockTechScan,
      mockMetaAds,
      benchmark
    )
    const relations = computeCrossRelations(
      financials,
      pillars,
      mockShopifyData,
      mockTechScan,
      mockMetaAds,
      benchmark,
      mockInputs.monthlyAdSpend
    )

    expect(relations.length).toBe(4)
    for (const rel of relations) {
      expect(rel.title).toBeTruthy()
      expect(rel.primaryPillars).toBeTruthy()
      expect(rel.description).toBeTruthy()
      expect(rel.dollarImpact).toBeGreaterThanOrEqual(0)
    }
  })

  it('builds category leader comparison table against the benchmark leader', () => {
    const financials = computeFinancialMetrics(mockInputs, mockShopifyData, benchmark)
    const pillars = computePillarScores(
      mockInputs,
      financials,
      mockShopifyData,
      mockTechScan,
      mockMetaAds,
      benchmark
    )
    const masterScore = computeMasterCQI(pillars)
    const comp = buildCategoryLeaderComparison(
      'target-supplements.com',
      masterScore,
      financials,
      pillars,
      mockShopifyData,
      mockTechScan,
      mockMetaAds,
      benchmark
    )

    expect(comp.leaderBrandName).toBe(benchmark.leaderBrand.name)
    expect(comp.comparisons.length).toBe(7)
  })
})
