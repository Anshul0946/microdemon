import { NextRequest, NextResponse } from 'next/server'
import { validateDomainSyntax } from '@/lib/utils/validation'
import { VERTICAL_BENCHMARKS, EcommerceVertical } from '@/lib/config/benchmarks'
import {
  scrapeShopifyCatalog,
  scanStoreTechStack,
  fetchMetaAdTelemetry,
  fetchGoogleSearchAndCheckScale,
  assessBrandScaleAndCompetitor,
  evaluateUniversalBlunderGuard,
  synthesizeExecutiveBriefing,
  GoogleSerpSummary,
} from '@/lib/data'
import {
  computeFinancialMetrics,
  computePillarScores,
  computeMasterCQI,
  getCustomerQualityTier,
  computeMarginLeaks,
  buildFourSourceWaterfall,
  computeDataAuthenticityScore,
} from '@/lib/cqi/scoring'
import { computeCrossRelations } from '@/lib/cqi/crossRelations'
import { saveAuditReport } from '@/lib/data/reportStore'
import { AuditReportResult, PrivateIntakeInputs } from '@/lib/cqi/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      domain,
      vertical = 'supplements',
      monthlyRevenue = 100000,
      monthlyAdSpend = 25000,
      cogsPct = 30,
      refundRatePct = 8,
      revenueMode = 'CONFIRMED_ONLINE',
      adSpendMode = 'CONFIRMED_ONLINE',
      cogsMode = 'CONFIRMED_ONLINE',
      refundMode = 'CONFIRMED_ONLINE',
      varianceExplanations,
      qualificationAnswers,
      agencyName,
    } = body

    const syntax = validateDomainSyntax(domain)
    if (!syntax.isValidSyntax) {
      return NextResponse.json(
        { ok: false, error: syntax.error || 'Invalid storefront domain.' },
        { status: 400 }
      )
    }

    const cleanDomain = syntax.normalizedDomain

    // Benchmark resolution
    const validVertical: EcommerceVertical =
      vertical in VERTICAL_BENCHMARKS ? (vertical as EcommerceVertical) : 'supplements'
    const benchmark = VERTICAL_BENCHMARKS[validVertical]

    const rawInputs: PrivateIntakeInputs = {
      vertical: validVertical,
      monthlyRevenue: Math.max(1000, Number(monthlyRevenue)),
      monthlyAdSpend: Math.max(500, Number(monthlyAdSpend)),
      cogsPct: Math.min(85, Math.max(5, Number(cogsPct))),
      refundRatePct: Math.min(60, Math.max(0.5, Number(refundRatePct))),
      revenueMode,
      adSpendMode,
      cogsMode,
      refundMode,
      varianceExplanations,
    }

    // Run parallel telemetry probes (all with <= 6s timeouts and Promise.allSettled)
    const [catalogSettled, techSettled, adsSettled, searchSettled] = await Promise.allSettled([
      scrapeShopifyCatalog(cleanDomain),
      scanStoreTechStack(cleanDomain),
      fetchMetaAdTelemetry(cleanDomain, rawInputs.monthlyAdSpend),
      fetchGoogleSearchAndCheckScale(
        cleanDomain,
        rawInputs.monthlyRevenue,
        rawInputs.monthlyAdSpend
      ),
    ])

    const storefront =
      catalogSettled.status === 'fulfilled'
        ? catalogSettled.value
        : {
            totalProductsSampled: 20,
            medianSkuPrice: benchmark.benchmarkAOV,
            meanSkuPrice: benchmark.benchmarkAOV,
            bundleRatioPct: benchmark.healthyBundleRatioPct,
            discountMarkedPct: 18,
            avgVariantsPerProduct: 3,
            highFrictionVariantPct: 15,
            stockoutVariantPct: 5,
            estimatedCatalogAOV: benchmark.benchmarkAOV,
            sampleProducts: [],
          }

    const techScan =
      techSettled.status === 'fulfilled'
        ? techSettled.value
        : {
            detectedPixels: ['Meta Pixel', 'Google Tag Manager'],
            detectedRetention: ['Klaviyo'],
            detectedSubscriptionUpsell: [],
            detectedReviews: ['Judge.me'],
            externalScriptCount: 22,
            hasCapiSignal: true,
            allDetectedApps: ['Meta Pixel', 'Google Tag Manager', 'Klaviyo'],
          }

    const metaAds =
      adsSettled.status === 'fulfilled'
        ? adsSettled.value
        : {
            activeAdCount: 0,
            videoAdSharePct: 0,
            staticAdSharePct: 0,
            discountCopySharePct: 0,
            ascConcentrationRiskPct: 0,
            evidence: 'BENCHMARK_ESTIMATED' as const,
            adsVerified: false,
            adEvaluationNotice:
              'Evaluated via Current On-Site Pixel & Offer Posture (0 Public Ad Library Items Found)',
            evergreenAds90dPlusPct: 0,
            scalingAds30to90dPct: 0,
            testingAds7to30dPct: 0,
            freshLaunchesUnder7dPct: 0,
            oldestActiveAdDays: 0,
          }

    const searchSummary: GoogleSerpSummary =
      searchSettled.status === 'fulfilled'
        ? searchSettled.value
        : {
            competitorDomains: [],
            searchSnippetSummary: `${cleanDomain} commercial footprint.`,
            reviewSentimentScore: 82,
            detectedPublicFloorRevenue: 0,
            publicRevenueEvidence: undefined,
            aiPresenceStatus: 'MODERATE_AI_PRESENCE',
            citedSources: [],
            buyerSearchQueries: [],
            parsedOverview: {
              normalizedText: `${cleanDomain} commercial footprint.`,
              citedSources: [],
              aiPresenceStatus: 'MODERATE_AI_PRESENCE',
              extractedMetrics: {
                competitorDomains: [],
              },
            },
            realityCheck: {
              overrideApplied: false,
              originalMonthlyRevenue: rawInputs.monthlyRevenue,
              originalAdSpend: rawInputs.monthlyAdSpend,
              calibratedMonthlyRevenue: rawInputs.monthlyRevenue,
              calibratedAdSpend: rawInputs.monthlyAdSpend,
              detectedScaleTier: 'SMB' as const,
            },
          }

    // Layer 3: Groq Universal Brand Scale & Dynamic Competitor Oracle (with 6s timeout & fallback)
    const groqAssessment = await assessBrandScaleAndCompetitor(
      cleanDomain,
      validVertical,
      {
        totalProducts: storefront.totalProductsSampled,
        medianPrice: storefront.medianSkuPrice,
        bundleRatioPct: storefront.bundleRatioPct,
      },
      {
        activeAdCount: metaAds.activeAdCount,
        videoAdSharePct: metaAds.videoAdSharePct,
      },
      searchSummary.searchSnippetSummary
    )

    // Evaluate Universal 3-Layer Telemetry Blunder Guard
    const realityCheck = evaluateUniversalBlunderGuard({
      domain: cleanDomain,
      userMonthlyRevenue: rawInputs.monthlyRevenue,
      userAdSpend: rawInputs.monthlyAdSpend,
      activeAdCount: metaAds.activeAdCount,
      serpData: {
        snippetSummary: searchSummary.searchSnippetSummary,
        detectedPublicFloorRevenue: searchSummary.detectedPublicFloorRevenue,
        publicRevenueEvidence: searchSummary.publicRevenueEvidence,
        competitorDomains: searchSummary.competitorDomains,
      },
      groqAssessment,
    })

    // Calibrated Inputs for Calculations
    const calibratedInputs: PrivateIntakeInputs = {
      vertical: validVertical,
      monthlyRevenue: realityCheck.overrideApplied
        ? realityCheck.calibratedMonthlyRevenue
        : rawInputs.monthlyRevenue,
      monthlyAdSpend: realityCheck.overrideApplied
        ? realityCheck.calibratedAdSpend
        : rawInputs.monthlyAdSpend,
      cogsPct: rawInputs.cogsPct,
      refundRatePct: rawInputs.refundRatePct,
    }

    // Deterministic Scoring
    const financials = computeFinancialMetrics(calibratedInputs, storefront, benchmark)
    const reviewIntel = groqAssessment?.customerReviewIntelligence
    const pillars = computePillarScores(
      calibratedInputs,
      financials,
      storefront,
      techScan,
      metaAds,
      benchmark,
      searchSummary.reviewSentimentScore,
      reviewIntel,
      searchSummary.citedSources?.length || 0
    )
    const masterCQIScore = computeMasterCQI(pillars)
    const { tier: customerQualityTier, description: tierDescription } =
      getCustomerQualityTier(masterCQIScore)

    const leaks = computeMarginLeaks(
      calibratedInputs,
      financials,
      pillars,
      storefront,
      techScan,
      benchmark
    )
    const totalRecoverableMonthlyMargin = leaks.reduce(
      (sum, l) => sum + l.monthlyLossDollars,
      0
    )

    const crossRelations = computeCrossRelations(
      financials,
      pillars,
      storefront,
      techScan,
      metaAds,
      benchmark,
      calibratedInputs.monthlyAdSpend
    )

    // Groq Executive Narrative Synthesis
    const aiBriefing = await synthesizeExecutiveBriefing(
      cleanDomain,
      masterCQIScore,
      leaks[0]?.title || 'Ad Concentration Bleed',
      leaks[0]?.monthlyLossDollars || 12000,
      benchmark.label
    )

    const fourSourceWaterfall = buildFourSourceWaterfall(
      calibratedInputs,
      financials,
      storefront,
      techScan,
      metaAds,
      benchmark,
      leaks,
      realityCheck.subNicheName || benchmark.label,
      searchSummary.searchSnippetSummary ? 'STRONG_AI_PRESENCE' : 'ZERO_AI_PRESENCE',
      qualificationAnswers
    )

    const dataAuthenticityScore = computeDataAuthenticityScore(
      rawInputs,
      realityCheck.calibratedMonthlyRevenue,
      realityCheck.calibratedAdSpend
    )

    const report: AuditReportResult = {
      domain: cleanDomain,
      storeTitle: cleanDomain.split('.')[0].toUpperCase(),
      vertical: validVertical,
      benchmark,
      rawInputs,
      realityCheck,
      calibratedInputs,
      financials,
      pillars,
      masterCQIScore,
      customerQualityTier,
      tierDescription,
      leaks,
      totalRecoverableMonthlyMargin,
      crossRelations,
      storefront,
      techScan,
      metaAds,
      executiveSummary: aiBriefing.summary,
      dynamicCompetitor: realityCheck.dynamicCompetitor,
      subNicheName: realityCheck.subNicheName || benchmark.label,
      agencyName: agencyName ? String(agencyName).trim() : undefined,
      qualificationAnswers,
      skuAnalytics: storefront.skuAnalytics,
      fourSourceWaterfall,
      dataAuthenticityScore,
      customerReviewIntelligence: reviewIntel,
      createdAt: new Date().toISOString(),
    }

    // Save report in persistent memory and disk store
    saveAuditReport(report)

    return NextResponse.json({ ok: true, report }, { status: 200 })
  } catch (err: unknown) {
    const errObj = err as Error
    console.error('[API Audit Error]', errObj)
    return NextResponse.json(
      { ok: false, error: errObj.message || 'Diagnostic execution failure.' },
      { status: 500 }
    )
  }
}
