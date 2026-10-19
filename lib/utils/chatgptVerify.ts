import { AuditReportResult } from '@/lib/cqi/types'

export function buildFullAuditPrompt(report: AuditReportResult): string {
  const leaksSummary = report.leaks
    .map(
      (l, idx) =>
        `Leak #${idx + 1}: ${l.title} (Monthly Loss: -$${l.monthlyLossDollars.toLocaleString()}/mo)\nDiagnosis: ${l.exposedDiagnosis}`
    )
    .join('\n\n')

  const topSkusSummary = report.skuAnalytics?.topSkus
    ? report.skuAnalytics.topSkus
        .slice(0, 6)
        .map(
          (s) =>
            `- ${s.title}: $${s.price} (Role: ${s.skuRole}, Variants: ${s.variantCount}, Discount: ${s.discountPct}%)`
        )
        .join('\n')
    : '(Catalog sampled: ' + report.storefront.totalProductsSampled + ' products)'

  const waterfall = report.fourSourceWaterfall

  return `=== NYXIR CQI TELEMETRY & MARGIN LEAK AUDIT ===
Target Domain: ${report.domain}
Store Title: ${report.storeTitle}
Sub-Niche: ${report.subNicheName || report.benchmark.label}
Data Authenticity: ${report.dataAuthenticityScore?.label || 'Verified'}

1. 4-SOURCE DATA HIERARCHY WATERFALL:
A) Source 1 (Public Signals):
   - Catalog Median Price: $${waterfall?.source1PublicData.catalogMedianPrice || report.storefront.medianSkuPrice}
   - Bundle Ratio: ${waterfall?.source1PublicData.bundleRatioPct || report.storefront.bundleRatioPct}%
   - External Scripts: ${waterfall?.source1PublicData.scriptCount || report.techScan.externalScriptCount}
   - CAPI Active: ${waterfall?.source1PublicData.hasCapiSignal || report.techScan.hasCapiSignal}
   - Public Meta Ads: ${waterfall?.source1PublicData.activeAdCount || report.metaAds.activeAdCount} (${waterfall?.source1PublicData.adEvaluationNotice || 'Evaluated'})
   - AI Presence: ${waterfall?.source1PublicData.aiPresenceStatus || 'Evaluated'}

B) Source 2 (Private Confirmed Baselines):
   - Monthly Revenue: $${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo (${report.rawInputs.revenueMode || 'CONFIRMED'})
   - Monthly Ad Spend: $${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo (${report.rawInputs.adSpendMode || 'CONFIRMED'})
   - Landed COGS: ${report.calibratedInputs.cogsPct}%
   - 30-Day Refund Bleed: ${report.calibratedInputs.refundRatePct}%

C) Source 3 (2026 Industry Report Benchmarks):
   - Sub-Niche: ${waterfall?.source3IndustryReport2026.subNicheName || report.subNicheName}
   - Benchmark AOV: $${waterfall?.source3IndustryReport2026.benchmarkAOV || report.benchmark.benchmarkAOV}
   - Healthy CAC: $${waterfall?.source3IndustryReport2026.healthyCAC || report.benchmark.healthyBlendedCAC}
   - Healthy MER: ${waterfall?.source3IndustryReport2026.healthyMER || report.benchmark.healthyMER}x
   - Repeat Rate 90d: ${waterfall?.source3IndustryReport2026.repeatRate90dPct || report.benchmark.repeatRate90dPct}%

D) Source 4 (Derived Estimations):
   - Implied Blended CAC: $${report.financials.impliedBlendedCAC}
   - First-Order Net Cash: $${report.financials.firstOrderNetContributionPerOrder}/order (${report.financials.firstOrderContributionMarginPct}%)
   - 90-Day LTV: $${waterfall?.source4DerivedEstimations.ninetyDayCustomerLTV || 'Calibrated'}

2. SKU CATALOG & PRICE LADDER:
- Price Ladder: Min $${report.skuAnalytics?.priceLadder.minPrice || report.storefront.medianSkuPrice} · Median $${report.skuAnalytics?.priceLadder.medianSkuPrice || report.storefront.medianSkuPrice} · P90 $${report.skuAnalytics?.priceLadder.p90Price || report.storefront.medianSkuPrice}
Top Products:
${topSkusSummary}

3. GOOGLE AI MODE BRAND & CUSTOMER PROFILE:
- AI Status: ${report.aiBrandAndCustomerProfile?.aiPresenceStatus || 'ANALYZED'}
- Perception: ${report.aiBrandAndCustomerProfile?.googleAiOverviewSummary || report.executiveSummary}
- Demographics: ${report.aiBrandAndCustomerProfile?.customerBaseProfile.targetDemographics || 'Modern DTC Buyers'}
- Buying Trigger: ${report.aiBrandAndCustomerProfile?.customerBaseProfile.primaryBuyingTrigger || 'Specific utility fit'}

4. 5-PILLAR CQI LEDGER (MASTER SCORE: ${report.masterCQIScore}/100 - ${report.customerQualityTier}):
- Pillar 1 (Unit Economics - 25%): ${report.pillars.unitEconomics}/100
- Pillar 2 (Paid Ad Signal - 25%): ${report.pillars.adSignal}/100
- Pillar 3 (Offer Architecture - 20%): ${report.pillars.offerArchitecture}/100
- Pillar 4 (Signal & Retention - 15%): ${report.pillars.techStack}/100
- Pillar 5 (Brand Authority - 15%): ${report.pillars.brandAuthority}/100

5. DYNAMIC COMPETITOR COMPARISON:
- Benchmark Competitor: ${report.dynamicCompetitor?.name || 'Category Rival'} (${report.dynamicCompetitor?.domain || 'rival.com'})
- Rival CQI: ${report.dynamicCompetitor?.cqiScore || 78}/100 | Rival AOV: $${report.dynamicCompetitor?.aov || 95} | CAC: $${report.dynamicCompetitor?.blendedCAC || 38}

6. 3 QUANTIFIED MONTHLY MARGIN LEAKS (-$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo Total):
${leaksSummary}

Above is the complete Day-0 E-Commerce Customer Quality Index (CQI) and Margin Leak telemetry captured for ${report.domain}. My goal is to verify whether all captured data, CQI math, SKU economics, and margin leak estimates look accurate, realistic, and sound—what is your assessment?`
}

export function buildConciseChatGptUrl(report: AuditReportResult): string {
  const concisePrompt = `Above is the complete Day-0 E-Commerce Customer Quality Index (CQI) and Margin Leak telemetry captured for ${report.domain}. My goal is to verify whether all captured data, CQI math, SKU economics, and margin leak estimates look accurate, realistic, and sound—what is your assessment?

Summary Data:
- Domain: ${report.domain} (${report.subNicheName || report.benchmark.label})
- Revenue: $${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo | Ad Spend: $${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo
- Implied MER: ${report.financials.currentMER}x | AOV: $${report.financials.effectiveAOV} | Blended CAC: $${report.financials.impliedBlendedCAC}
- First-Order Net Cash: $${report.financials.firstOrderNetContributionPerOrder} (${report.financials.firstOrderContributionMarginPct}%)
- Master CQI: ${report.masterCQIScore}/100 (${report.customerQualityTier})
- Pillars: P1=${report.pillars.unitEconomics}, P2=${report.pillars.adSignal}, P3=${report.pillars.offerArchitecture}, P4=${report.pillars.techStack}, P5=${report.pillars.brandAuthority}
- 3 Margin Leaks: -$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo total
  1) ${report.leaks[0]?.title}: -$${report.leaks[0]?.monthlyLossDollars.toLocaleString()}/mo
  2) ${report.leaks[1]?.title}: -$${report.leaks[1]?.monthlyLossDollars.toLocaleString()}/mo
  3) ${report.leaks[2]?.title}: -$${report.leaks[2]?.monthlyLossDollars.toLocaleString()}/mo`

  const encoded = encodeURIComponent(concisePrompt.slice(0, 3200))
  return `https://chatgpt.com/?q=${encoded}`
}

export const buildChatGptVerifyUrl = buildConciseChatGptUrl
