import { CrossRelationInsight, FinancialMetrics, PillarScores } from './types'
import { ScrapedCatalogMetrics } from '@/lib/data/shopifyScraper'
import { TechScanResult } from '@/lib/data/techScanner'
import { MetaAdTelemetry } from '@/lib/data/apify/metaAds'
import { VerticalBenchmark } from '@/lib/config/benchmarks'

export function computeCrossRelations(
  financials: FinancialMetrics,
  pillars: PillarScores,
  shopifyData: ScrapedCatalogMetrics,
  techScan: TechScanResult,
  metaAds: MetaAdTelemetry,
  benchmark: VerticalBenchmark,
  monthlyAdSpend: number
): CrossRelationInsight[] {
  // 1. Ad Signal <-> Offer Architecture
  const discountAdPct = metaAds.discountCopySharePct
  const bundleRatio = shopifyData.bundleRatioPct
  const netContribution = financials.firstOrderNetContributionPerOrder
  const adOfferLoss = Math.round(
    financials.monthlyOrders * Math.max(5, (100 - bundleRatio) * 0.18)
  )

  const insight1: CrossRelationInsight = {
    id: 'ad_signal_x_offer_architecture',
    title: 'Discount-Led Ad Signal ↔ Low-AOV Single SKU Landing',
    primaryPillars: 'Pillar 2 (Ad Signal) × Pillar 3 (Offer Architecture)',
    description: `${discountAdPct}% of active Meta ads leverage promotional or discount keywords, yet only ${bundleRatio}% of catalog SKUs are configured as bundles. Traffic arriving on low-margin entry SKUs compresses First-Order Net Margin to ${netContribution > 0 ? '$' + netContribution : '-$' + Math.abs(netContribution)}/order.`,
    dollarImpact: adOfferLoss,
    severity: netContribution < 0 || discountAdPct > 40 ? 'CRITICAL' : 'HIGH',
    formulaExplanation: `When promotional ad traffic lands on single units without bundle incentives, first-order contribution margin collapses by an estimated -$${adOfferLoss.toLocaleString()}/mo.`,
  }

  // 2. Tech Script Load <-> Paid Blended CAC
  const scriptCount = techScan.externalScriptCount
  const scriptOverhead = Math.max(0, scriptCount - benchmark.maxHealthyScripts)
  const cacInflation = Number((scriptOverhead * 0.85).toFixed(1))
  const scriptCacLoss = Math.round(financials.monthlyOrders * cacInflation)

  const insight2: CrossRelationInsight = {
    id: 'tech_script_x_blended_cac',
    title:
      scriptOverhead > 0
        ? 'Mobile Script Drag ↔ Inflated Paid CAC'
        : 'Streamlined Mobile Scripts ↔ Protected Blended CAC',
    primaryPillars: 'Pillar 4 (Tech Stack) × Pillar 1 (Unit Economics)',
    description:
      scriptOverhead > 0
        ? `${scriptCount} third-party scripts execute in the browser (exceeding the vertical ceiling of ${benchmark.maxHealthyScripts}). Slower mobile Largest Contentful Paint (LCP) causes paid visitors to bounce before product pages render, adding an estimated +$${cacInflation}/customer to your effective Blended CAC ($${financials.impliedBlendedCAC}).`
        : `${scriptCount} third-party scripts detected (within the vertical ceiling of ${benchmark.maxHealthyScripts}). Mobile LCP remains lean, shielding Blended CAC from script-induced bounce rates.`,
    dollarImpact: scriptCacLoss,
    severity: scriptOverhead > 4 ? 'CRITICAL' : scriptOverhead > 0 ? 'HIGH' : 'MODERATE',
    formulaExplanation:
      scriptOverhead > 0
        ? `Each additional third-party script beyond benchmark inflates mobile paid traffic bounce rates by ~0.8%, bleeding +$${scriptCacLoss.toLocaleString()}/mo in unacquired shoppers.`
        : `Maintaining script count at or below ${benchmark.maxHealthyScripts} prevents latency-driven drop-off during checkout.`,
  }

  // 3. ASC Creative Fatigue <-> 30-Day Refund Rate
  const ascRisk = metaAds.ascConcentrationRiskPct
  const avoidableRefundDollars = Math.round(
    financials.monthlyOrders * financials.effectiveAOV * 0.04
  )

  const insight3: CrossRelationInsight = {
    id: 'asc_fatigue_x_refund_rate',
    title: 'ASC Creative Concentration ↔ Post-Purchase Buyer Friction',
    primaryPillars: 'Pillar 2 (Ad Signal) × Pillar 1 (Unit Economics)',
    description: `${ascRisk}% concentration in repetitive ad hooks indicates that Meta Advantage+ is repeatedly serving the same 1–2 angles to cold audiences. Over-promising product claims in fatiguing creatives correlated with higher return rates, driving ~$${avoidableRefundDollars.toLocaleString()}/mo in preventable refund losses.`,
    dollarImpact: avoidableRefundDollars,
    severity: ascRisk > 50 ? 'HIGH' : 'MODERATE',
    formulaExplanation: `Creative concentration traps force Meta algorithms to seek conversions by over-indexing on aggressive discount hooks that attract low-intent, refund-prone buyers.`,
  }

  // 4. CAPI Signal Loss <-> Algorithmic Bidding
  const capiSignalPresent = techScan.hasCapiSignal
  const capiLoss = Math.round(monthlyAdSpend * (capiSignalPresent ? 0.04 : 0.14))

  const insight4: CrossRelationInsight = {
    id: 'capi_loss_x_algorithmic_bidding',
    title: capiSignalPresent
      ? 'Active Server-Side CAPI ↔ Advantage+ Optimization Signal'
      : 'Missing Server-Side CAPI ↔ Meta Signal Blindness',
    primaryPillars: 'Pillar 4 (Signal Integrity) × Pillar 2 (Ad Signal)',
    description: capiSignalPresent
      ? `Server-side CAPI telemetry (Elevar / Triple Whale / Web Pixels) is detected, ensuring Meta receives enriched conversion events to train Advantage+ bidding on high-LTV buyers.`
      : `No dedicated server-side CAPI container detected. Browser ad-blockers and iOS privacy restrictions strip up to 25–30% of purchase signals, forcing Meta to bid blindly on lower-quality customer cohorts.`,
    dollarImpact: capiLoss,
    severity: capiSignalPresent ? 'MODERATE' : 'CRITICAL',
    formulaExplanation: capiSignalPresent
      ? `Enriched server-side telemetry protects approximately $${capiLoss.toLocaleString()}/mo in ad delivery efficiency.`
      : `Missing server-side deduplication drains ~$${capiLoss.toLocaleString()}/mo in misplaced Meta Advantage+ budget allocation.`,
  }

  return [insight1, insight2, insight3, insight4]
}
