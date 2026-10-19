import { VerticalBenchmark } from '@/lib/config/benchmarks'
import { FinancialMetrics, PillarScores, DynamicCompetitorProfile } from './types'
import { ScrapedCatalogMetrics } from '@/lib/data/shopifyScraper'
import { TechScanResult } from '@/lib/data/techScanner'
import { MetaAdTelemetry } from '@/lib/data/apify/metaAds'

export interface CategoryComparisonRow {
  metric: string
  targetStoreValue: string | number
  leaderBrandValue: string | number
  differenceDelta: string
  favorable: boolean
}

export interface CategoryLeaderComparison {
  leaderBrandName: string
  leaderBrandDomain: string
  leaderCQIScore: number
  storeCQIScore: number
  winningEdgeSummary: string
  comparisons: CategoryComparisonRow[]
}

export function buildCategoryLeaderComparison(
  domain: string,
  storeCQIScore: number,
  financials: FinancialMetrics,
  pillars: PillarScores,
  shopifyData: ScrapedCatalogMetrics,
  techScan: TechScanResult,
  metaAds: MetaAdTelemetry,
  benchmark: VerticalBenchmark,
  dynamicCompetitor?: DynamicCompetitorProfile
): CategoryLeaderComparison {
  const leader = dynamicCompetitor || benchmark.leaderBrand

  const comparisons: CategoryComparisonRow[] = [
    {
      metric: 'Master CQI Score',
      targetStoreValue: `${storeCQIScore}/100`,
      leaderBrandValue: `${leader.cqiScore}/100`,
      differenceDelta: `${storeCQIScore - leader.cqiScore > 0 ? '+' : ''}${storeCQIScore - leader.cqiScore} pts`,
      favorable: storeCQIScore >= leader.cqiScore,
    },
    {
      metric: 'Average Order Value (AOV)',
      targetStoreValue: `$${financials.effectiveAOV}`,
      leaderBrandValue: `$${leader.aov}`,
      differenceDelta: `${financials.effectiveAOV - leader.aov >= 0 ? '+' : ''}$${financials.effectiveAOV - leader.aov}`,
      favorable: financials.effectiveAOV >= leader.aov,
    },
    {
      metric: 'Implied Blended CAC',
      targetStoreValue: `$${financials.impliedBlendedCAC}`,
      leaderBrandValue: `$${leader.blendedCAC}`,
      differenceDelta: `${financials.impliedBlendedCAC - leader.blendedCAC > 0 ? '+' : ''}$${financials.impliedBlendedCAC - leader.blendedCAC}`,
      favorable: financials.impliedBlendedCAC <= leader.blendedCAC,
    },
    {
      metric: 'Catalog Bundle Ratio (%)',
      targetStoreValue: `${shopifyData.bundleRatioPct}%`,
      leaderBrandValue: `${leader.bundleRatioPct}%`,
      differenceDelta: `${shopifyData.bundleRatioPct - leader.bundleRatioPct > 0 ? '+' : ''}${shopifyData.bundleRatioPct - leader.bundleRatioPct}%`,
      favorable: shopifyData.bundleRatioPct >= leader.bundleRatioPct,
    },
    {
      metric: 'Active Meta Ad Creatives',
      targetStoreValue: metaAds.activeAdCount,
      leaderBrandValue: leader.activeAdCount,
      differenceDelta: `${metaAds.activeAdCount - leader.activeAdCount > 0 ? '+' : ''}${metaAds.activeAdCount - leader.activeAdCount}`,
      favorable: metaAds.activeAdCount >= leader.activeAdCount,
    },
    {
      metric: 'Video Creative Share (%)',
      targetStoreValue: `${metaAds.videoAdSharePct}%`,
      leaderBrandValue: `${leader.videoAdSharePct}%`,
      differenceDelta: `${metaAds.videoAdSharePct - leader.videoAdSharePct > 0 ? '+' : ''}${metaAds.videoAdSharePct - leader.videoAdSharePct}%`,
      favorable: metaAds.videoAdSharePct >= leader.videoAdSharePct,
    },
    {
      metric: 'External Scripts Count',
      targetStoreValue: techScan.externalScriptCount,
      leaderBrandValue: leader.scriptCount,
      differenceDelta: `${techScan.externalScriptCount - leader.scriptCount > 0 ? '+' : ''}${techScan.externalScriptCount - leader.scriptCount}`,
      favorable: techScan.externalScriptCount <= leader.scriptCount,
    },
  ]

  return {
    leaderBrandName: leader.name,
    leaderBrandDomain: leader.domain,
    leaderCQIScore: leader.cqiScore,
    storeCQIScore,
    winningEdgeSummary: leader.winningEdgeSummary,
    comparisons,
  }
}
