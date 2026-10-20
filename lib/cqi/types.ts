import { EcommerceVertical, VerticalBenchmark } from '@/lib/config/benchmarks'
export type { EcommerceVertical, VerticalBenchmark }
import { MetaAdTelemetry } from '@/lib/data/apify/metaAds'
import { RealityCheckResult } from '@/lib/data/apify/googleSearch'
import { ScrapedCatalogMetrics } from '@/lib/data/shopifyScraper'
import { TechScanResult } from '@/lib/data/techScanner'

export type SkuRole = 'ENTRY_HOOK' | 'CORE_MARGIN' | 'BUNDLE_ANCHOR' | 'HIGH_VARIANT_DRAG'

export interface TopSku {
  id: string | number
  title: string
  handle: string
  productType: string
  price: number
  compareAtPrice: number
  discountPct: number
  variantCount: number
  available: boolean
  imageUrl: string
  skuRole: SkuRole
}

export interface SkuAnalytics {
  totalProductsSampled: number
  totalVariantsSampled: number
  priceLadder: {
    minPrice: number
    p10Price: number
    medianSkuPrice: number
    meanSkuPrice: number
    p90Price: number
    maxPrice: number
  }
  bundleSkuCount: number
  bundleRatioPct: number
  discountedSkuPct: number
  avgDiscountDepthPct: number
  avgVariantsPerSku: number
  highFrictionSkuCount: number
  dominantProductTypes: string[]
  dominantTags: string[]
  topSkus: TopSku[]
  historicalCatalog: {
    historicalDataAvailable: boolean
    oldestSkuDate?: string
    catalogAgeYears?: number
    skusCreatedLast90d?: number
    skusUpdatedLast30d?: number
  }
}

export interface CustomerReviewIntelligence {
  overallSentimentScore: number | null // 0–100
  aggregatedStarRating: number | null // e.g. 4.6 (out of 5.0)
  estimatedTotalReviews: number | null
  topCustomerPraises: string[] // 3 items
  topCustomerComplaints: string[] // 3 items
  customerQualityVerdict: string
}

export interface AiBrandAndCustomerProfile {
  aiPresenceStatus: 'STRONG_AI_PRESENCE' | 'MODERATE_AI_PRESENCE' | 'WEAK_AI_PRESENCE' | 'ZERO_AI_PRESENCE'
  googleAiOverviewSummary: string
  customerBaseProfile: {
    targetDemographics: string
    pricePositioning: string
    primaryBuyingTrigger: string
    repeatPurchaseDriver: string
    churnAndRefundRiskFactor: string
  }
  skuCatalogAssessment: string
  citedSources?: Array<{ title: string; url: string }>
  buyerSearchQueries?: string[]
  customerReviewIntelligence?: CustomerReviewIntelligence
}

export interface DiscoveredRevenueMetric {
  foundOnline: boolean
  value: number | null
  rangeMin?: number | null
  rangeMax?: number | null
  confidence: 'HIGH' | 'MEDIUM' | 'ESTIMATED_FROM_STORE_SIGNALS' | 'NOT_PUBLIC'
  sourceExplanation: string
}

export interface IndustryReport2026 {
  subNicheName: string
  reportSource: string
  benchmarkAOV: number
  healthyCAC: number
  healthyMER: number
  grossMarginPct: number
  avgRefundRatePct: number
  repeatRate90dPct: number
  key2026Trend: string
}

export interface DiscoveredCompetitor {
  name: string
  domain: string
  estimatedAOV: number
  estimatedCAC: number
  cqiScore: number
  winningMechanism: string
  whySelected?: string
}

export interface DiscoveredFields {
  vertical: EcommerceVertical
  subNicheName: string
  sourceLabel: string
  monthlyRevenue: DiscoveredRevenueMetric
  monthlyAdSpend: DiscoveredRevenueMetric
  cogsPct: { value: number; sourceExplanation: string }
  refundRatePct: { value: number; sourceExplanation: string }
  competitors: DiscoveredCompetitor[]
  industryReport2026: IndustryReport2026
}

export interface DiscoveryPayload {
  ok: boolean
  domain: string
  storeTitle: string
  detectedCurrency: string
  skuAnalytics: SkuAnalytics
  aiBrandAndCustomerProfile: AiBrandAndCustomerProfile
  discoveredFields: DiscoveredFields
  techScan: TechScanResult
  metaAds: MetaAdTelemetry
  customerReviewIntelligence?: CustomerReviewIntelligence
}

export interface PrivateIntakeInputs {
  vertical: EcommerceVertical
  monthlyRevenue: number
  monthlyAdSpend: number
  cogsPct: number
  refundRatePct: number
  revenueMode?: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE' | 'BLENDED'
  adSpendMode?: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE' | 'BLENDED'
  cogsMode?: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'
  refundMode?: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'
  varianceExplanations?: string[]
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

export interface FourSourceWaterfall {
  source1PublicData: {
    catalogMedianPrice: number
    catalogMeanPrice: number
    bundleRatioPct: number
    scriptCount: number
    hasCapiSignal: boolean
    activeAdCount: number
    adsVerified: boolean
    adEvaluationNotice: string
    aiPresenceStatus: string
    historicalCatalogAvailable: boolean
  }
  source2PrivateConfirmed: {
    monthlyRevenue: number
    revenueMode: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE' | 'BLENDED'
    monthlyAdSpend: number
    adSpendMode: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE' | 'BLENDED'
    cogsPct: number
    cogsMode: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'
    refundRatePct: number
    refundMode: 'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'
    qualificationPulse?: AgencyQualificationAnswers
    varianceExplanations?: string[]
  }
  source3IndustryReport2026: {
    subNicheName: string
    reportSource: string
    benchmarkAOV: number
    healthyCAC: number
    healthyMER: number
    repeatRate90dPct: number
    avgRefundRatePct: number
  }
  source4DerivedEstimations: {
    effectiveAOV: number
    monthlyOrders: number
    grossProfitDollars: number
    refundBleedDollars: number
    netContributionProfitDollars: number
    netContributionMarginPct: number
    impliedBlendedCAC: number
    firstOrderNetCashPerCustomer: number
    ninetyDayCustomerLTV: number
    threeMarginLeaks: MarginLeak[]
  }
}

export interface DataAuthenticityScore {
  scorePct: number
  label: string
  isDualScenario: boolean
  onlineVsCustomVariancePct?: number
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
  skuAnalytics?: SkuAnalytics
  aiBrandAndCustomerProfile?: AiBrandAndCustomerProfile
  discoveredFields?: DiscoveredFields
  fourSourceWaterfall?: FourSourceWaterfall
  dataAuthenticityScore?: DataAuthenticityScore
  customerReviewIntelligence?: CustomerReviewIntelligence
  createdAt: string
}

// Backward compatibility aliases if any legacy code imports them
export type NormalizedAuditResult = AuditReportResult
export interface CQIScore {
  grade: number
  label: string
}
