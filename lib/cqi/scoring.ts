import { VerticalBenchmark } from '@/lib/config/benchmarks'
import { ScrapedCatalogMetrics } from '@/lib/data/shopifyScraper'
import { TechScanResult } from '@/lib/data/techScanner'
import { MetaAdTelemetry } from '@/lib/data/apify/metaAds'
import {
  FinancialMetrics,
  PillarScores,
  MarginLeak,
  PrivateIntakeInputs,
} from './types'

export function computeFinancialMetrics(
  inputs: PrivateIntakeInputs,
  shopifyData: ScrapedCatalogMetrics,
  benchmark: VerticalBenchmark
): FinancialMetrics {
  const effectiveAOV = shopifyData.estimatedCatalogAOV || benchmark.benchmarkAOV
  const monthlyOrders = Math.max(10, Math.round(inputs.monthlyRevenue / effectiveAOV))
  const currentMER = Number((inputs.monthlyRevenue / Math.max(1, inputs.monthlyAdSpend)).toFixed(2))

  // 72% first-time orders baseline
  const newCustomerOrderShare = 0.72
  const impliedBlendedCAC = Math.round(
    inputs.monthlyAdSpend / Math.max(1, monthlyOrders * newCustomerOrderShare)
  )

  const grossProfitPerOrder = Number((effectiveAOV * (1 - inputs.cogsPct / 100)).toFixed(2))
  const refundLossPerOrder = Number((effectiveAOV * (inputs.refundRatePct / 100)).toFixed(2))
  const firstOrderNetContributionPerOrder = Number(
    (grossProfitPerOrder - refundLossPerOrder - impliedBlendedCAC).toFixed(2)
  )
  const firstOrderContributionMarginPct = Number(
    ((firstOrderNetContributionPerOrder / effectiveAOV) * 100).toFixed(1)
  )
  const aovToCacRatio = Number((effectiveAOV / Math.max(1, impliedBlendedCAC)).toFixed(2))

  return {
    effectiveAOV,
    monthlyOrders,
    currentMER,
    impliedBlendedCAC,
    grossProfitPerOrder,
    refundLossPerOrder,
    firstOrderNetContributionPerOrder,
    firstOrderContributionMarginPct,
    aovToCacRatio,
  }
}

export function computePillarScores(
  inputs: PrivateIntakeInputs,
  financials: FinancialMetrics,
  shopifyData: ScrapedCatalogMetrics,
  techScan: TechScanResult,
  metaAds: MetaAdTelemetry,
  benchmark: VerticalBenchmark,
  serpScore = 80
): PillarScores {
  // --- PILLAR 1: Unit Economics & First-Order Contribution (25% Weight) ---
  let p1 = 55 + (financials.currentMER - benchmark.healthyMER) * 12
  if (financials.firstOrderNetContributionPerOrder > 0) {
    p1 += Math.min(18, financials.firstOrderNetContributionPerOrder * 0.6)
  } else {
    p1 -= Math.min(28, Math.abs(financials.firstOrderNetContributionPerOrder) * 1.0)
  }
  if (inputs.refundRatePct > benchmark.avgRefundRatePct) {
    p1 -= (inputs.refundRatePct - benchmark.avgRefundRatePct) * 1.2
  }
  const unitEconomics = Math.max(15, Math.min(94, Math.round(p1)))

  // --- PILLAR 2: Paid Ad Signal & Advantage+ Concentration Immunity (25% Weight) ---
  const targetAds = Math.max(12, Math.round(inputs.monthlyAdSpend / 1200))
  const volumeScore = Math.min(35, Math.round((metaAds.activeAdCount / targetAds) * 35))
  const videoScore = Math.min(25, Math.round((metaAds.videoAdSharePct / 65) * 25))
  const discountScore = Math.max(
    0,
    Math.min(20, Math.round(20 - (metaAds.discountCopySharePct / 100) * 20))
  )
  const ascImmunityScore = Math.max(
    0,
    Math.min(20, Math.round(20 - ((metaAds.ascConcentrationRiskPct - 15) / 85) * 20))
  )
  const p2 = volumeScore + videoScore + discountScore + ascImmunityScore
  const adSignal = Math.max(15, Math.min(96, Math.round(p2)))

  // --- PILLAR 3: Offer Architecture & AOV Extraction (20% Weight) ---
  // 1. AOV to CAC Ratio (0–35 pts)
  const aovCacScore = Math.min(35, Math.round((financials.aovToCacRatio / 2.2) * 35))

  // 2. Bundle Or Price Ladder Score (0–30 pts)
  const bundlePoints = Math.round((shopifyData.bundleRatioPct / Math.max(1, benchmark.healthyBundleRatioPct)) * 30)
  const priceLadderRatio = (shopifyData.priceArchitecture?.p90Price || 0) / Math.max(1, shopifyData.medianSkuPrice)
  const priceLadderPoints = priceLadderRatio >= 1.6 ? 26 : priceLadderRatio >= 1.3 ? 18 : 8
  const hasOfferMechanisms = (shopifyData.detectedOfferMechanisms?.length || 0) >= 3 ? 4 : 0
  const bundleOrPriceLadderScore = Math.min(30, Math.max(bundlePoints, priceLadderPoints) + hasOfferMechanisms)

  // 3. Subscription / Repeat Mechanism (+15 pts)
  const subscriptionBonus =
    techScan.detectedSubscriptionUpsell.length > 0 ||
    shopifyData.detectedOfferMechanisms?.includes('Subscription Autoship')
      ? 15
      : 0

  // 4. Variant Friction Efficiency (0–20 pts)
  let variantFrictionPoints = 20
  if (shopifyData.highFrictionVariantPct > 35) {
    variantFrictionPoints = Math.max(
      5,
      Math.round(20 - ((shopifyData.highFrictionVariantPct - 35) / 65) * 15)
    )
  }

  const p3 = aovCacScore + bundleOrPriceLadderScore + subscriptionBonus + variantFrictionPoints
  const offerArchitecture = Math.max(20, Math.min(96, Math.round(p3)))

  // --- PILLAR 4: Signal Integrity & Retention Infrastructure (15% Weight) ---
  let p4 = 0
  if (techScan.hasCapiSignal) p4 += 30
  if (techScan.detectedRetention.length > 0) p4 += 25
  if (techScan.detectedSubscriptionUpsell.length > 0) p4 += 20
  const scriptBloatPenalty =
    Math.max(0, techScan.externalScriptCount - benchmark.maxHealthyScripts) * 1.8
  p4 += Math.max(0, 25 - scriptBloatPenalty)
  const techStack = Math.max(15, Math.min(98, Math.round(p4)))

  // --- PILLAR 5: Brand Authority, Trust & AI Search Visibility (15% Weight) ---
  let p5 = 0
  if (techScan.detectedReviews.length > 0) p5 += 35
  if (shopifyData.discountMarkedPct < 40) {
    p5 += 35
  } else {
    p5 += Math.max(10, Math.round(35 - ((shopifyData.discountMarkedPct - 40) / 60) * 25))
  }
  p5 += Math.min(30, Math.round((serpScore / 100) * 30))
  const brandAuthority = Math.max(20, Math.min(96, Math.round(p5)))

  return {
    unitEconomics,
    adSignal,
    offerArchitecture,
    techStack,
    brandAuthority,
  }
}

export function computeMasterCQI(pillars: PillarScores): number {
  return Math.round(
    0.25 * pillars.unitEconomics +
    0.25 * pillars.adSignal +
    0.20 * pillars.offerArchitecture +
    0.15 * pillars.techStack +
    0.15 * pillars.brandAuthority
  )
}

export function getCustomerQualityTier(cqiScore: number): {
  tier: string
  description: string
} {
  if (cqiScore >= 80) {
    return {
      tier: 'Tier 1: Institutional Sovereign (High-LTV Engine)',
      description:
        'Elite operational sovereignty (top decile of DTC storefronts). Exceptional organic-to-paid moat, high repeat purchase frequency, and superior first-order contribution margin.',
    }
  }
  if (cqiScore >= 65) {
    return {
      tier: 'Tier 2: Scaling — Recoverable Margin Leaks',
      description:
        'Profitable growth architecture with identified margin leakage in ad creative rotation, price laddering, or mobile variant drop-off.',
    }
  }
  if (cqiScore >= 50) {
    return {
      tier: 'Tier 3: Margin Compressed & Signal Drag',
      description:
        'Experiencing acute creative fatigue or discount dependency that degrades customer quality and inflates Blended CAC.',
    }
  }
  return {
    tier: 'Tier 4: Critical Signal Contamination',
    description:
      'Severe unit economics deficit. High returns, ad spend cannibalization, and single-SKU compression are eroding enterprise value on every transaction.',
  }
}

export function computeMarginLeaks(
  inputs: PrivateIntakeInputs,
  financials: FinancialMetrics,
  pillars: PillarScores,
  shopifyData: ScrapedCatalogMetrics,
  techScan: TechScanResult,
  benchmark: VerticalBenchmark
): MarginLeak[] {
  // Raw Leak 1: Meta Advantage+ Creative Concentration & Midday Fatigue Bleed
  const wasteFactor = Math.max(0.12, Math.min(0.34, (100 - pillars.adSignal) / 260))
  const rawLeak1 = Math.round(inputs.monthlyAdSpend * wasteFactor)

  // Raw Leak 2: Single-SKU AOV Compression & Mobile Variant Drop-Off
  const aovGap = Math.max(12, benchmark.leaderBrand.aov - financials.effectiveAOV)
  const rawLeak2 = Math.round(
    financials.monthlyOrders * aovGap * (benchmark.grossMarginPct / 100) * 0.28
  )

  // Raw Leak 3: Third-Party Script Checkout Drag & Uncaptured 60-Day Repeat LTV
  const scriptPenaltyPct = Math.max(
    0.04,
    Math.min(0.18, Math.max(0, techScan.externalScriptCount - 18) * 0.007)
  )
  const rawLeak3 = Math.round(
    inputs.monthlyRevenue * scriptPenaltyPct * (benchmark.grossMarginPct / 100)
  )

  // Bound sum of leaks between 8% and 22% of revenue, and <= 85% ad spend + 12% rev
  const rawSum = rawLeak1 + rawLeak2 + rawLeak3
  const minFloor = Math.round(inputs.monthlyRevenue * 0.08)
  const maxCeil = Math.min(
    Math.round(inputs.monthlyRevenue * 0.22),
    Math.round(inputs.monthlyAdSpend * 0.85 + inputs.monthlyRevenue * 0.12)
  )

  let finalLeak1 = rawLeak1
  let finalLeak2 = rawLeak2
  let finalLeak3 = rawLeak3

  if (rawSum > maxCeil && rawSum > 0) {
    const scale = maxCeil / rawSum
    finalLeak1 = Math.round(rawLeak1 * scale)
    finalLeak2 = Math.round(rawLeak2 * scale)
    finalLeak3 = Math.round(rawLeak3 * scale)
  } else if (rawSum < minFloor && rawSum > 0) {
    const scale = minFloor / rawSum
    finalLeak1 = Math.round(rawLeak1 * scale)
    finalLeak2 = Math.round(rawLeak2 * scale)
    finalLeak3 = Math.round(rawLeak3 * scale)
  }

  const leak1: MarginLeak = {
    id: 'ad_fatigue_bleed',
    title: 'Meta Advantage+ Creative Concentration & Midday Fatigue Bleed',
    monthlyLossDollars: finalLeak1,
    severity: finalLeak1 > 15000 ? 'CRITICAL' : 'HIGH',
    exposedDiagnosis: `Algorithmic ad delivery concentrates up to 60–75% of monthly budget ($${inputs.monthlyAdSpend.toLocaleString()}) into repetitive hooks. Midday auction frequency spikes bid up effective CPMs on low-intent shoppers, causing an estimated $${finalLeak1.toLocaleString()}/mo in exhausted media spend.`,
    lockedRemediationSteps: [
      'Partition ASC campaigns into separate cold creative test sandboxes using Cost-Cap and Bid-Cap controls to prevent budget dumping.',
      'Establish a mandatory 4-hook weekly iteration cadence (problem-solution, mechanism, testimonial, objection) before creative decay penalizes CPMs.',
      'Exclude past 90-day purchasers and recent cart abandoners from Advantage+ shopping campaigns to halt paid CAC cannibalization on existing customers.',
    ],
  }

  const leak2: MarginLeak = {
    id: 'single_sku_compression',
    title: 'Single-SKU AOV Compression & Mobile Variant Drop-Off',
    monthlyLossDollars: finalLeak2,
    severity: finalLeak2 > 20000 ? 'CRITICAL' : 'HIGH',
    exposedDiagnosis: `Storefront traffic converts predominantly on single-unit entry items ($${financials.effectiveAOV} AOV vs $${benchmark.leaderBrand.aov} for ${benchmark.leaderBrand.name}), leaving $${aovGap} in unextracted cart value per transaction. Furthermore, ${shopifyData.highFrictionVariantPct}% of products exhibit high-friction variant selectors causing mobile abandonment.`,
    lockedRemediationSteps: [
      'Deploy custom 3-step regimen builder or bundle packs on the primary PDP with automated tier discounts (Buy 2 Save 15%, Buy 3 Save 25%).',
      'Replace native multi-dropdown variant pickers on mobile with 1-click horizontal swatch pills to eradicate mobile checkout hesitation.',
      'Implement an in-cart slideout drawer with 1-click complementary pre-purchase accessories before redirecting to Shopify checkout.',
    ],
  }

  const leak3: MarginLeak = {
    id: 'script_drag_repeat_ltv',
    title: 'Third-Party Script Checkout Drag & Uncaptured 60-Day Repeat LTV',
    monthlyLossDollars: finalLeak3,
    severity: finalLeak3 > 12000 ? 'HIGH' : 'MODERATE',
    exposedDiagnosis: `${techScan.externalScriptCount} external JavaScript files execute on the storefront, inflating mobile Largest Contentful Paint (LCP) and checkout latency. Mobile shoppers encounter micro-delays at payment initiation, leaking an estimated $${finalLeak3.toLocaleString()}/mo in uncompleted orders.`,
    lockedRemediationSteps: [
      'Migrate client-side tracking tags (Meta, TikTok, Google) to server-side CAPI via Shopify Web Pixels Manager to eliminate checkout DOM blocking.',
      'Defer non-essential review and UGC widgets to asynchronous post-LCP execution so the mobile hero section renders instantly.',
      'Deploy 14-day and 45-day automated replenishment trigger sequences in Klaviyo to capture secondary orders at zero incremental acquisition cost.',
    ],
  }

  return [leak1, leak2, leak3]
}
