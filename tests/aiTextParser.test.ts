import { describe, it, expect } from 'vitest'
import {
  normalizeRawText,
  extractFinancialMetricsFromText,
  classifyAiPresence,
  parseGoogleAiModeResponse,
} from '../lib/data/aiTextParser'
import { cleanAndParseQwenJson } from '../lib/data/groq/client'
import {
  buildFourSourceWaterfall,
  computeDataAuthenticityScore,
  computeFinancialMetrics,
  computePillarScores,
  computeMasterCQI,
  computeMarginLeaks,
} from '../lib/cqi/scoring'
import { VERTICAL_BENCHMARKS } from '../lib/config/benchmarks'

describe('Google AI Mode & AI Text Parser Unit Tests', () => {
  it('normalizes markdown fences, citation brackets [1], and HTML tags', () => {
    const raw = `
      # Brand Overview [1]
      **Gymshark** is a fitness apparel brand.[2] They had <div>$1.2M in annual sales</div>.
    `
    const normalized = normalizeRawText(raw)
    expect(normalized).not.toContain('[1]')
    expect(normalized).not.toContain('[2]')
    expect(normalized).not.toContain('**')
    expect(normalized).not.toContain('<div>')
    expect(normalized).toContain('Gymshark is a fitness apparel brand')
  })

  it('correctly converts annual revenue prose into normalized monthly USD (/12)', () => {
    const prose = 'The company recorded $1.2 million in annual revenue in 2024.'
    const metrics = extractFinancialMetricsFromText(prose)
    expect(metrics.monthlyRevenueEstimate).toBeDefined()
    expect(metrics.monthlyRevenueEstimate?.isAnnualized).toBe(true)
    // $1.2M annual / 12 = $100,000/mo
    expect(metrics.monthlyRevenueEstimate?.midpointMonthly).toBe(100000)
  })

  it('correctly parses annual range $1.2M to $2.4M into monthly midpoint $150,000/mo', () => {
    const prose = 'Estimates show $1.2M to $2.4M in annual revenue.'
    const metrics = extractFinancialMetricsFromText(prose)
    expect(metrics.monthlyRevenueEstimate).toBeDefined()
    expect(metrics.monthlyRevenueEstimate?.minMonthly).toBe(100000)
    expect(metrics.monthlyRevenueEstimate?.maxMonthly).toBe(200000)
    expect(metrics.monthlyRevenueEstimate?.midpointMonthly).toBe(150000)
  })

  it('retains direct monthly MRR values without dividing by 12', () => {
    const prose = 'The direct-to-consumer store generates roughly $90,000 per month from recurring subscribers.'
    const metrics = extractFinancialMetricsFromText(prose)
    expect(metrics.monthlyRevenueEstimate).toBeDefined()
    expect(metrics.monthlyRevenueEstimate?.isAnnualized).toBe(false)
    expect(metrics.monthlyRevenueEstimate?.midpointMonthly).toBe(90000)
  })

  it('classifies ZERO_AI_PRESENCE when Google AI Mode returns empty or unrecognized', () => {
    const status = classifyAiPresence('', 0, 'obscure-store.com')
    expect(status).toBe('ZERO_AI_PRESENCE')
  })

  it('classifies STRONG_AI_PRESENCE when detailed answer and multiple citations are present', () => {
    const detailedText = 'A comprehensive multi-sentence breakdown of the direct-to-consumer store brand footprint spanning over three hundred characters of rich synthesized market intelligence describing product line, competitive posture, and verified customer demographics.'
    const status = classifyAiPresence(detailedText, 3, 'drinkag1.com')
    expect(status).toBe('STRONG_AI_PRESENCE')
  })

  it('parses Google AI Mode response array into complete structured overview', () => {
    const rawItems = [
      {
        text: 'DrinkAG1 generates an estimated $120 million in annual ARR with 4.7/5 customer review rating.',
        sources: [
          { title: 'Forbes Profile', url: 'https://forbes.com/ag1' },
          { title: 'Trustpilot Reviews', url: 'https://trustpilot.com/review/drinkag1.com' },
        ],
      },
    ]

    const parsed = parseGoogleAiModeResponse(rawItems, 'drinkag1.com')
    expect(parsed.aiPresenceStatus).toBe('STRONG_AI_PRESENCE')
    expect(parsed.citedSources.length).toBe(2)
    expect(parsed.extractedMetrics.monthlyRevenueEstimate?.midpointMonthly).toBe(10000000)
  })
})

describe('Groq Qwen JSON & Reasoning Tag Stripper', () => {
  it('strips <think>...</think> reasoning blocks and markdown code fences before JSON.parse', () => {
    const qwenRawOutput = `
      <think>
      The user wants to evaluate customer demographics and SKU pricing.
      Let's compute median price $65 and assign roles.
      </think>
      \`\`\`json
      {
        "aiPresenceStatus": "STRONG_AI_PRESENCE",
        "googleAiOverviewSummary": "Recognized leader in wellness.",
        "monthlyRevenue": "$150,000",
        "medianPrice": 65
      }
      \`\`\`
    `

    interface ParsedOutput {
      aiPresenceStatus: string
      googleAiOverviewSummary: string
      monthlyRevenue: number
      medianPrice: number
    }

    const parsed = cleanAndParseQwenJson<ParsedOutput>(qwenRawOutput)
    expect(parsed).not.toBeNull()
    expect(parsed?.aiPresenceStatus).toBe('STRONG_AI_PRESENCE')
    expect(parsed?.googleAiOverviewSummary).toBe('Recognized leader in wellness.')
    expect(parsed?.medianPrice).toBe(65)
    expect(parsed?.monthlyRevenue).toBe(150000) // formatted string converted to finite number
  })
})

describe('4-Source Waterfall & Data Authenticity Math', () => {
  const benchmark = VERTICAL_BENCHMARKS['supplements']

  const inputs = {
    vertical: 'supplements' as const,
    monthlyRevenue: 150000,
    monthlyAdSpend: 50000,
    cogsPct: 24,
    refundRatePct: 6,
    revenueMode: 'CONFIRMED_ONLINE' as const,
    adSpendMode: 'CONFIRMED_ONLINE' as const,
  }

  const shopifyData = {
    totalProductsSampled: 25,
    medianSkuPrice: 65,
    meanSkuPrice: 70,
    bundleRatioPct: 32,
    discountMarkedPct: 15,
    avgVariantsPerProduct: 3,
    highFrictionVariantPct: 10,
    stockoutVariantPct: 5,
    estimatedCatalogAOV: 75,
    sampleProducts: [],
  }

  const techScan = {
    detectedPixels: ['Meta Pixel'],
    detectedRetention: ['Klaviyo'],
    detectedSubscriptionUpsell: [],
    detectedReviews: ['Judge.me'],
    externalScriptCount: 18,
    hasCapiSignal: true,
    hasKlaviyoIdentified: true,
    allDetectedApps: [],
    evidence: 'SCRAPED_DOM' as const,
  }

  const metaAds = {
    activeAdCount: 42,
    videoAdSharePct: 65,
    staticAdSharePct: 35,
    discountCopySharePct: 20,
    ascConcentrationRiskPct: 35,
    evidence: 'LIVE_SCRAPED' as const,
    adsVerified: true,
    adEvaluationNotice: 'Live Meta Ad Library Telemetry Verified',
    evergreenAds90dPlusPct: 25,
    scalingAds30to90dPct: 40,
    testingAds7to30dPct: 25,
    freshLaunchesUnder7dPct: 10,
    oldestActiveAdDays: 95,
  }

  it('computes 4-source waterfall transparently', () => {
    const financials = computeFinancialMetrics(inputs, shopifyData, benchmark)
    const pillars = computePillarScores(inputs, financials, shopifyData, techScan, metaAds, benchmark)
    const leaks = computeMarginLeaks(inputs, financials, pillars, shopifyData, techScan, benchmark)

    const waterfall = buildFourSourceWaterfall(
      inputs,
      financials,
      shopifyData,
      techScan,
      metaAds,
      benchmark,
      leaks,
      'Longevity Supplements',
      'STRONG_AI_PRESENCE'
    )

    // Source 1
    expect(waterfall.source1PublicData.catalogMedianPrice).toBe(65)
    expect(waterfall.source1PublicData.activeAdCount).toBe(42)
    expect(waterfall.source1PublicData.adsVerified).toBe(true)

    // Source 2
    expect(waterfall.source2PrivateConfirmed.monthlyRevenue).toBe(150000)
    expect(waterfall.source2PrivateConfirmed.revenueMode).toBe('CONFIRMED_ONLINE')

    // Source 3
    expect(waterfall.source3IndustryReport2026.subNicheName).toBe('Longevity Supplements')

    // Source 4
    expect(waterfall.source4DerivedEstimations.grossProfitDollars).toBe(114000) // $150k * (1 - 0.24)
    expect(waterfall.source4DerivedEstimations.refundBleedDollars).toBe(9000) // $150k * 0.06
    expect(waterfall.source4DerivedEstimations.netContributionProfitDollars).toBe(55000) // $114k - $9k - $50k
    expect(waterfall.source4DerivedEstimations.threeMarginLeaks.length).toBe(3)
  })

  it('computes data authenticity score with dual-scenario detection on variance >15%', () => {
    const confirmedAuth = computeDataAuthenticityScore(inputs, 150000, 50000)
    expect(confirmedAuth.scorePct).toBe(98)
    expect(confirmedAuth.isDualScenario).toBe(false)

    // User customized to $60k when discovered was $150k (60% delta)
    const customInputs = {
      ...inputs,
      monthlyRevenue: 60000,
      revenueMode: 'CUSTOM_USER_OVERRIDE' as const,
    }

    const customAuth = computeDataAuthenticityScore(customInputs, 150000, 50000)
    expect(customAuth.isDualScenario).toBe(true)
    expect(customAuth.onlineVsCustomVariancePct).toBe(60)
    expect(customAuth.label).toContain('Dual-Scenario')
  })
})
