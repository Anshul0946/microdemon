import { EcommerceVertical, VerticalBenchmark } from '@/lib/config/benchmarks'
import { MetaAdTelemetry } from '@/lib/data/apify/metaAds'
import { RealityCheckResult } from '@/lib/data/apify/googleSearch'
import { ScrapedCatalogMetrics } from '@/lib/data/shopifyScraper'
import { TechScanResult } from '@/lib/data/techScanner'

export interface PrivateIntakeInputs {
  vertical: EcommerceVertical
  monthlyRevenue: number
  monthlyAdSpend: number
  cogsPct: number
  refundRatePct: number
}

export interface FinancialMetrics {
  effectiveAOV: number
  monthlyOrders: number
  currentMER: number
  impliedBlendedCAC: number
  grossProfitPerOrder: number
  refundLossPerOrder: number
  firstOrderNetContributionPerOrder: number
  firstOrderContributionMarginPct: number
  aovToCacRatio: number
}

export interface PillarScores {
  unitEconomics: number       // P1: 25%
  adSignal: number            // P2: 25%
  offerArchitecture: number   // P3: 20%
  techStack: number           // P4: 15%
  brandAuthority: number      // P5: 15%
}

export interface MarginLeak {
  id: 'ad_fatigue_bleed' | 'single_sku_compression' | 'script_drag_repeat_ltv'
  title: string
  monthlyLossDollars: number
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE'
  exposedDiagnosis: string
  lockedRemediationSteps: string[]
}

export interface CrossRelationInsight {
  id: string
  title: string
  primaryPillars: string
  description: string
  dollarImpact: number
  severity: 'CRITICAL' | 'HIGH' | 'MODERATE'
  formulaExplanation: string
}

export interface AgencyQualificationAnswers {
  agenciesWorkedWith?: string
  agencyCount?: string
  biggestGrowthIssue?: string
  primaryBottleneck?: string
  creativeWorkflow?: string
  ninetyDayPriority?: string
  ninetyDayTarget?: string
}

export interface DynamicCompetitorProfile {
  name: string
  domain: string
  cqiScore: number
  aov: number
  blendedCAC: number
  bundleRatioPct: number
  activeAdCount: number
  videoAdSharePct: number
  scriptCount: number
  repeatRate90dPct: number
  winningEdgeSummary: string
}

export interface AuditReportResult {
  domain: string
  storeTitle: string
  vertical: EcommerceVertical
  benchmark: VerticalBenchmark
  rawInputs: PrivateIntakeInputs
  realityCheck: RealityCheckResult
  calibratedInputs: {
    monthlyRevenue: number
    monthlyAdSpend: number
    cogsPct: number
    refundRatePct: number
  }
  financials: FinancialMetrics
  pillars: PillarScores
  masterCQIScore: number
  customerQualityTier: string
  tierDescription: string
  leaks: MarginLeak[]
  totalRecoverableMonthlyMargin: number
  crossRelations: CrossRelationInsight[]
  storefront: ScrapedCatalogMetrics
  techScan: TechScanResult
  metaAds: MetaAdTelemetry
  executiveSummary: string
  dynamicCompetitor?: DynamicCompetitorProfile
  subNicheName?: string
  agencyName?: string
  qualificationAnswers?: AgencyQualificationAnswers
  createdAt: string
}

// Backward compatibility aliases if any legacy code imports them
export type NormalizedAuditResult = AuditReportResult
export interface CQIScore {
  grade: number
  label: string
}
