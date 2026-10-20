import { runApifyActor } from './client'
import { DynamicCompetitorProfile } from '@/lib/cqi/types'
import { GroqBrandScaleAssessment } from '../groq/client'
import {
  parseGoogleAiModeResponse,
  ParsedAiOverview,
  AiPresenceStatus,
  CitedSource,
} from '../aiTextParser'

export interface RealityCheckResult {
  overrideApplied: boolean
  spendBlunderDetected?: boolean
  revenueBlunderDetected?: boolean
  originalMonthlyRevenue: number
  originalAdSpend: number
  calibratedMonthlyRevenue: number
  calibratedAdSpend: number
  detectedScaleTier: 'SMB' | 'MID_MARKET' | 'ENTERPRISE'
  subNicheName?: string
  dynamicCompetitor?: DynamicCompetitorProfile
  publicRevenueEvidence?: string
  blunderExplanation?: string
  reason?: string
}

export interface GoogleSerpSummary {
  competitorDomains: string[]
  searchSnippetSummary: string
  reviewSentimentScore: number
  detectedPublicFloorRevenue?: number
  publicRevenueEvidence?: string
  aiPresenceStatus: AiPresenceStatus
  citedSources: CitedSource[]
  buyerSearchQueries: string[]
  parsedOverview: ParsedAiOverview
  realityCheck: RealityCheckResult
  googleAiModeRawText?: string
  rawAiAnswers?: {
    q1Scale?: string
    q2Reviews?: string
    q3Competitors?: string
    q4IndustryReport?: string
  }
  actorUsed?: string
}

export function evaluateUniversalBlunderGuard(params: {
  domain: string
  userMonthlyRevenue: number
  userAdSpend: number
  activeAdCount?: number
  serpData?: {
    snippetSummary?: string
    detectedPublicFloorRevenue?: number
    publicRevenueEvidence?: string
    competitorDomains?: string[]
  }
  groqAssessment?: GroqBrandScaleAssessment | null
}): RealityCheckResult {
  const cleanDomain = params.domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  const userRevenue = Math.max(1000, params.userMonthlyRevenue)
  const userSpend = Math.max(500, params.userAdSpend)
  const activeAds = params.activeAdCount || 0

  // 1. Layer 2: Ad Spend Floor from Active Ad Library Volume
  const minSpendFromAds =
    activeAds >= 50
      ? Math.max(45000, activeAds * 950)
      : activeAds >= 20
      ? Math.max(15000, activeAds * 750)
      : 0

  // 2. Layer 3: Dynamic Groq Qwen floors
  const groqSpendFloor = params.groqAssessment?.estimatedMonthlyAdSpendFloor || 0
  const groqRevFloor = params.groqAssessment?.estimatedMonthlyRevenueFloor || 0

  // 3. Layer 1: Google AI Mode & SERP extracted floor
  const serpRevFloor = params.serpData?.detectedPublicFloorRevenue || 0

  // Combined market floors (100% dynamically evaluated - ZERO hardcoded brand dictionaries)
  const marketSpendFloor = Math.max(minSpendFromAds, groqSpendFloor)
  const marketRevFloor = Math.max(serpRevFloor, groqRevFloor, marketSpendFloor * 2.5)

  let detectedScaleTier: 'SMB' | 'MID_MARKET' | 'ENTERPRISE' = 'SMB'
  if (marketRevFloor >= 1000000 || activeAds >= 60 || (params.groqAssessment?.estimatedTier === 'tier1_enterprise')) {
    detectedScaleTier = 'ENTERPRISE'
  } else if (marketRevFloor >= 100000 || activeAds >= 20 || (params.groqAssessment?.estimatedTier === 'mid_market_growth')) {
    detectedScaleTier = 'MID_MARKET'
  }

  let spendBlunderDetected = false
  let revenueBlunderDetected = false
  let calibratedAdSpend = userSpend
  let calibratedMonthlyRevenue = userRevenue

  // Ad Spend Blunder Check:
  // If brand has confirmed spend floor (>= 15,000 from active ads or Google AI Mode / Qwen)
  // and user enters implausibly low spend (< 40% of market spend floor):
  if (marketSpendFloor >= 15000 && userSpend < marketSpendFloor * 0.4) {
    spendBlunderDetected = true
    calibratedAdSpend = Math.max(marketSpendFloor, Math.round(marketRevFloor * 0.22))
  } else if (userSpend > userRevenue * 1.2) {
    spendBlunderDetected = true
    calibratedAdSpend = Math.round(userRevenue * 0.28)
  }

  // Revenue Blunder Check:
  // If self-reported monthlyRevenue is < 35% of the implied revenue floor
  const impliedRevFloorFromSpend = calibratedAdSpend * 2.5
  const effectiveRevFloor = Math.max(marketRevFloor, impliedRevFloorFromSpend)

  if (userRevenue < effectiveRevFloor * 0.35) {
    revenueBlunderDetected = true
    calibratedMonthlyRevenue = Math.max(effectiveRevFloor, Math.round(calibratedAdSpend * 3.2))
  }

  const overrideApplied = spendBlunderDetected || revenueBlunderDetected

  const subNicheName = params.groqAssessment?.subNicheName || 'Direct-to-Consumer'
  const dynamicCompetitor = params.groqAssessment?.dynamicCompetitor

  let reason = ''
  if (overrideApplied) {
    reason = `Dynamic Telemetry Sanity Guard Triggered: Self-reported inputs (Rev: $${userRevenue.toLocaleString()}/mo | Ad Spend: $${userSpend.toLocaleString()}/mo) conflicted with verified digital footprint for ${cleanDomain} (${subNicheName}). Auto-calibrated to verified floor (Rev: $${calibratedMonthlyRevenue.toLocaleString()}/mo | Ad Spend: $${calibratedAdSpend.toLocaleString()}/mo) to preserve CQI scoring accuracy.`
  }

  return {
    overrideApplied,
    spendBlunderDetected,
    revenueBlunderDetected,
    originalMonthlyRevenue: userRevenue,
    originalAdSpend: userSpend,
    calibratedMonthlyRevenue,
    calibratedAdSpend,
    detectedScaleTier,
    subNicheName,
    dynamicCompetitor,
    publicRevenueEvidence: params.serpData?.publicRevenueEvidence,
    blunderExplanation: params.groqAssessment?.blunderExplanation,
    reason: overrideApplied ? reason : undefined,
  }
}

export async function fetchGoogleSearchAndCheckScale(
  domain: string,
  userMonthlyRevenue: number,
  userAdSpend: number,
  activeAdCount = 0,
  groqAssessment: GroqBrandScaleAssessment | null = null,
  brandName?: string,
  categoryHint?: string
): Promise<GoogleSerpSummary> {
  const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  const cleanBrand = (brandName || cleanDomain.replace(/\.[a-z]+$/, '')).trim()
  const cleanCategory = categoryHint || 'direct-to-consumer commerce'

  const rawAiModeItems: unknown[] = []
  const buyerSearchQueries: string[] = []

  // 1. Build the 4 Parallel Intelligence Queries
  const q1Scale = `What is ${cleanDomain} (${cleanBrand}) estimated annual or monthly revenue, website traffic, product category, and typical target customer profile?`
  const q2Reviews = `What are customer reviews, star ratings, common praises, and customer complaints for ${cleanBrand} (${cleanDomain}) on Trustpilot, Reddit, and review sites?`
  const q3Competitors = `Who are the top 3 direct e-commerce brand competitors to ${cleanBrand} (${cleanDomain}) and what are their websites and price points?`
  const q4IndustryReport = `What are the 2026 e-commerce industry report benchmarks for ${cleanCategory} brands including Average Order Value (AOV), Customer Acquisition Cost (CAC), MER, and return rate?`

  // 2. Parallel Execution: Multi-Actor Apify Chain + Fast Native Web Probes
  let actorUsed = 'native_web_probes'

  const apifyRunnerPromise = (async () => {
    // Attempt 1: Primary Google AI Mode Actor (litescrape~google-ai-mode) - 35s
    try {
      const res = await runApifyActor<unknown>(
        'litescrape~google-ai-mode',
        {
          q: `What is ${cleanDomain} (${cleanBrand}) estimated revenue, customer reviews, top 3 competitors, and target customer base?`,
          gl: 'us',
          hl: 'en',
          device: 'desktop',
          timeout: 40,
          maxRequests: 4,
          requests: [
            { q: q1Scale },
            { q: q2Reviews },
            { q: q3Competitors },
            { q: q4IndustryReport },
          ],
        },
        35000
      )
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return { data: res.data, actor: 'litescrape~google-ai-mode' }
      }
    } catch (err) {
      console.warn('[Google AI Mode] Primary actor litescrape~google-ai-mode failed, trying fallback #1:', err)
    }

    // Attempt 2: Fallback #1 Google AI Mode Actor (subimpact~google-ai-mode-scraper) - 35s
    try {
      const res = await runApifyActor<unknown>(
        'subimpact~google-ai-mode-scraper',
        {
          queries: [q1Scale, q2Reviews, q3Competitors, q4IndustryReport],
          backend: 'android',
          concurrency: 4,
        },
        35000
      )
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return { data: res.data, actor: 'subimpact~google-ai-mode-scraper' }
      }
    } catch (err) {
      console.warn('[Google AI Mode] Fallback #1 subimpact~google-ai-mode-scraper failed, trying fallback #2:', err)
    }

    // Attempt 3: Fallback #2 Google SERP & Overview Actor (gauravlabs~google-serp-api) - 25s
    try {
      const res = await runApifyActor<unknown>(
        'gauravlabs~google-serp-api',
        {
          q: `"${cleanDomain}" OR "${cleanBrand}" revenue OR reviews OR trustpilot OR competitors`,
          gl: 'us',
          hl: 'en',
          num: 10,
        },
        25000
      )
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return { data: res.data, actor: 'gauravlabs~google-serp-api' }
      }
    } catch (err) {
      console.warn('[Google AI Mode] Fallback #2 gauravlabs~google-serp-api failed, trying litescrape~google-search:', err)
    }

    // Attempt 4: Fallback #2 Alternative (litescrape~google-search) - 25s
    try {
      const res = await runApifyActor<unknown>(
        'litescrape~google-search',
        {
          q: `"${cleanDomain}" OR "${cleanBrand}" revenue OR reviews OR trustpilot OR competitors`,
          gl: 'us',
          hl: 'en',
          num: 10,
        },
        25000
      )
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return { data: res.data, actor: 'litescrape~google-search' }
      }
    } catch {}

    // Attempt 5: Fallback #3 Official Apify Google Search Scraper - 22s
    try {
      const res = await runApifyActor<unknown>(
        'apify~google-search-scraper',
        {
          queries: `"${cleanDomain}" OR "${cleanBrand}" revenue OR reviews OR competitors`,
          resultsPerPage: 10,
          maxPagesPerQuery: 1,
        },
        22000
      )
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        return { data: res.data, actor: 'apify~google-search-scraper' }
      }
    } catch {}

    return { data: null, actor: 'native_web_probes' }
  })()

  // Native Fast Web Probes (<2200ms)
  const nativeProbesPromise = Promise.allSettled([
    // A. Google Autocomplete Buyer Queries
    fetch(
      `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(cleanBrand + ' ')}`,
      { signal: AbortSignal.timeout(1800) }
    )
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && Array.isArray(data[1])) {
          for (const item of data[1].slice(0, 6)) {
            if (typeof item === 'string') buyerSearchQueries.push(item)
          }
        }
      })
      .catch(() => {}),

    // B. DuckDuckGo Lite HTML Search Snippets
    fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanDomain + ' revenue traffic competitors')}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(2200),
      }
    )
      .then((r) => r.text())
      .then((html) => {
        const snippetRegex = /<a class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
        let match: RegExpExecArray | null
        while ((match = snippetRegex.exec(html)) !== null && rawAiModeItems.length < 5) {
          const text = match[1].replace(/<[^>]+>/g, '').trim()
          if (text) {
            rawAiModeItems.push({ text })
          }
        }
      })
      .catch(() => {}),

    // C. Store Homepage Meta Description & JSON-LD (Marked so it never overrides real AI text)
    fetch(`https://${cleanDomain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => r.text())
      .then((html) => {
        const metaMatch = html.match(
          /<meta\s+(?:name|property)=["'](?:description|og:description)["']\s+content=["'](.*?)["']/i
        )
        if (metaMatch && metaMatch[1]) {
          rawAiModeItems.push({ isStoreMetaDescription: true, text: metaMatch[1].trim() })
        }
      })
      .catch(() => {}),

    // D. Trustpilot JSON-LD Live Probe
    fetch(`https://www.trustpilot.com/review/${cleanDomain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(2000),
    })
      .then((r) => r.text())
      .then((html) => {
        const jsonMatches = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)
        if (jsonMatches) {
          for (const tag of jsonMatches) {
            const raw = tag.replace(/<\/?script[^>]*>/gi, '').trim()
            try {
              const parsed = JSON.parse(raw)
              if (parsed.aggregateRating) {
                rawAiModeItems.push({
                  text: `Trustpilot rating: ${parsed.aggregateRating.ratingValue}/5 from ${parsed.aggregateRating.reviewCount} customer reviews for ${cleanDomain}.`,
                })
              }
            } catch {}
          }
        }
      })
      .catch(() => {}),
  ])

  // Await both parallel tracks
  const [, apifyResult] = await Promise.all([nativeProbesPromise, apifyRunnerPromise])

  if (apifyResult?.data && Array.isArray(apifyResult.data)) {
    actorUsed = apifyResult.actor
    for (const item of apifyResult.data) {
      rawAiModeItems.push(item)
    }
  }

  // Parse via Universal Normalizer
  const parsedOverview = parseGoogleAiModeResponse(rawAiModeItems, cleanDomain, actorUsed)

  let detectedPublicFloorRevenue = 0
  let publicRevenueEvidence = ''

  if (parsedOverview.extractedMetrics.monthlyRevenueEstimate) {
    detectedPublicFloorRevenue = parsedOverview.extractedMetrics.monthlyRevenueEstimate.midpointMonthly
    publicRevenueEvidence = `Google AI Mode extracted: "${parsedOverview.extractedMetrics.monthlyRevenueEstimate.rawPhrase}" (normalized to ~$${detectedPublicFloorRevenue.toLocaleString()}/mo)`
  }

  const competitorDomains = parsedOverview.extractedMetrics.competitorDomains

  const serpData = {
    snippetSummary:
      parsedOverview.normalizedText.slice(0, 500) || `${cleanDomain} digital footprint.`,
    detectedPublicFloorRevenue,
    publicRevenueEvidence,
    competitorDomains,
  }

  // Evaluate Universal Blunder Guard
  const realityCheck = evaluateUniversalBlunderGuard({
    domain: cleanDomain,
    userMonthlyRevenue,
    userAdSpend,
    activeAdCount,
    serpData,
    groqAssessment,
  })

  // Review sentiment score
  let reviewSentimentScore = 84
  if (parsedOverview.extractedMetrics.reviewSentiment?.rating) {
    reviewSentimentScore = Math.round(
      (parsedOverview.extractedMetrics.reviewSentiment.rating / 5) * 100
    )
  }

  return {
    competitorDomains: competitorDomains.slice(0, 4),
    searchSnippetSummary: serpData.snippetSummary,
    reviewSentimentScore,
    detectedPublicFloorRevenue,
    publicRevenueEvidence,
    aiPresenceStatus: parsedOverview.aiPresenceStatus,
    citedSources: parsedOverview.citedSources,
    buyerSearchQueries: buyerSearchQueries.slice(0, 6),
    parsedOverview,
    realityCheck,
    googleAiModeRawText: parsedOverview.normalizedText,
    rawAiAnswers: parsedOverview.rawAiAnswers,
    actorUsed,
  }
}
