import { AuditReportResult } from '@/lib/cqi/types'

export function buildFullAuditPrompt(report: AuditReportResult): string {
  const leaksSummary = report.leaks
    .map(
      (l, idx) =>
        `Leak #${idx + 1}: ${l.title} (Monthly Loss: -$${l.monthlyLossDollars.toLocaleString()}/mo)\nDiagnosis: ${l.exposedDiagnosis}`
    )
    .join('\n\n')

  return `=== NYXIR CQI TELEMETRY & MARGIN LEAK AUDIT ===
Target Domain: ${report.domain}
Store Title: ${report.storeTitle}
Vertical: ${report.benchmark.label}
Reality-Check Calibrated: ${report.realityCheck.overrideApplied ? 'YES (' + report.realityCheck.reason + ')' : 'NO'}

1. CORE FINANCIAL UNIT ECONOMICS:
- Calibrated Monthly Revenue: $${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo
- Calibrated Monthly Ad Spend: $${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo
- Implied MER: ${report.financials.currentMER}x (Benchmark Healthy: ${report.benchmark.healthyMER}x)
- Effective Catalog AOV: $${report.financials.effectiveAOV} (Benchmark: $${report.benchmark.benchmarkAOV})
- Implied Blended CAC: $${report.financials.impliedBlendedCAC} (Benchmark Healthy: $${report.benchmark.healthyBlendedCAC})
- COGS & Landed Fulfillment: ${report.calibratedInputs.cogsPct}%
- 30-Day Return / Refund Rate: ${report.calibratedInputs.refundRatePct}% (Benchmark Avg: ${report.benchmark.avgRefundRatePct}%)
- First-Order Net Contribution: $${report.financials.firstOrderNetContributionPerOrder}/order
- First-Order Contribution Margin: ${report.financials.firstOrderContributionMarginPct}%
- AOV-to-CAC Ratio: ${report.financials.aovToCacRatio}x

2. MASTER CQI SCORE: ${report.masterCQIScore}/100 (${report.customerQualityTier})
- Pillar 1 (Unit Economics): ${report.pillars.unitEconomics}/100
- Pillar 2 (Paid Ad Signal): ${report.pillars.adSignal}/100
- Pillar 3 (Offer Architecture): ${report.pillars.offerArchitecture}/100
- Pillar 4 (Signal & Retention Integrity): ${report.pillars.techStack}/100
- Pillar 5 (Brand Authority & Trust): ${report.pillars.brandAuthority}/100

3. STOREFRONT & AD TELEMETRY SIGNALS:
- Catalog Bundle Ratio: ${report.storefront.bundleRatioPct}% (Benchmark: ${report.benchmark.healthyBundleRatioPct}%)
- Variant Friction: ${report.storefront.highFrictionVariantPct}% of products with >5 variants
- Stockout Variant Ratio: ${report.storefront.stockoutVariantPct}%
- External Mobile Script Count: ${report.techScan.externalScriptCount} (Ceiling: ${report.benchmark.maxHealthyScripts})
- Server-Side CAPI: ${report.techScan.hasCapiSignal ? 'ACTIVE' : 'MISSING'}
- Detected Apps: ${report.techScan.allDetectedApps.join(', ') || 'Standard Shopify'}
- Active Meta Ads: ${report.metaAds.activeAdCount} (Video Share: ${report.metaAds.videoAdSharePct}%, Discount Copy Share: ${report.metaAds.discountCopySharePct}%, ASC Concentration: ${report.metaAds.ascConcentrationRiskPct}%)

4. QUANTIFIED MONTHLY DOLLAR LEAKS (Total: -$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo):
${leaksSummary}

Above is the complete Day-0 E-Commerce Customer Quality Index (CQI) and Margin Leak telemetry captured for ${report.domain}. My goal is to independently verify whether these unit economics, CQI pillar scores, cross-relations, and the 3 identified margin leaks look mathematically sound, realistic, and accurate for a brand in this vertical—and what you think of the diagnosis overall.`
}

export function buildConciseChatGptUrl(report: AuditReportResult): string {
  const concisePrompt = `Verify Day-0 CQI Audit for ${report.domain} (${report.benchmark.label}):
- Calibrated Revenue: $${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo | Ad Spend: $${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo
- Implied MER: ${report.financials.currentMER}x | AOV: $${report.financials.effectiveAOV} | Blended CAC: $${report.financials.impliedBlendedCAC}
- Net First-Order Margin: $${report.financials.firstOrderNetContributionPerOrder}/order (${report.financials.firstOrderContributionMarginPct}%)
- Master CQI: ${report.masterCQIScore}/100 (${report.customerQualityTier})
- Pillars: P1(Unit Econ)=${report.pillars.unitEconomics}, P2(Ad Signal)=${report.pillars.adSignal}, P3(Offer)=${report.pillars.offerArchitecture}, P4(Tech/CAPI)=${report.pillars.techStack}, P5(Trust)=${report.pillars.brandAuthority}
- 3 Identified Leaks (-$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo total):
1) ${report.leaks[0]?.title}: -$${report.leaks[0]?.monthlyLossDollars.toLocaleString()}/mo
2) ${report.leaks[1]?.title}: -$${report.leaks[1]?.monthlyLossDollars.toLocaleString()}/mo
3) ${report.leaks[2]?.title}: -$${report.leaks[2]?.monthlyLossDollars.toLocaleString()}/mo

Above is the complete Day-0 E-Commerce Customer Quality Index (CQI) and Margin Leak telemetry captured for ${report.domain}. My goal is to independently verify whether these unit economics, CQI pillar scores, cross-relations, and the 3 identified margin leaks look mathematically sound, realistic, and accurate for a brand in this vertical—and what you think of the diagnosis overall.`

  // URL encode and keep query <= 3500 chars
  const encoded = encodeURIComponent(concisePrompt.slice(0, 3200))
  return `https://chatgpt.com/?q=${encoded}`
}

export const buildChatGptVerifyUrl = buildConciseChatGptUrl

