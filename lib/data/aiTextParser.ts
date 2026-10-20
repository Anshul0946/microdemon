export type AiPresenceStatus =
  | 'STRONG_AI_PRESENCE'
  | 'MODERATE_AI_PRESENCE'
  | 'WEAK_AI_PRESENCE'
  | 'ZERO_AI_PRESENCE'

export interface CitedSource {
  title: string
  url: string
  source?: string
  snippet?: string
}

export interface ParsedAiOverview {
  normalizedText: string
  citedSources: CitedSource[]
  aiPresenceStatus: AiPresenceStatus
  actorUsed?: string
  brandAndReviewsAiText?: string
  industryBenchmarksAiText?: string
  googleAiModeSuccess?: boolean
  rawAiAnswers?: {
    q1Scale?: string
    q2Reviews?: string
    q3Competitors?: string
    q4IndustryReport?: string
  }
  extractedMetrics: {
    monthlyRevenueEstimate?: {
      minMonthly: number
      maxMonthly: number
      midpointMonthly: number
      rawPhrase: string
      isAnnualized: boolean
    }
    trafficEstimate?: {
      monthlyVisits: number
      rawPhrase: string
    }
    reviewSentiment?: {
      rating?: number
      reviewCount?: number
      rawPhrase?: string
    }
    competitorDomains: string[]
  }
}

const EXCLUDED_HOSTS = [
  'google',
  'duckduckgo',
  'wikipedia',
  'youtube',
  'facebook',
  'instagram',
  'tiktok',
  'twitter',
  'x.com',
  'linkedin',
  'reddit',
  'techlist',
  'gripsintelligence',
  'companiesmarketcap',
  'stockanalysis',
  'ecdb',
  'zoominfo',
  'craft.co',
  'pitchbook',
  'crunchbase',
]

import { decodeHtmlEntities } from '@/lib/utils/formatters'

export function normalizeRawText(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return ''

  return decodeHtmlEntities(rawText)
    // Remove citation brackets like [1], [2], [12]
    .replace(/\[\d+\]/g, '')
    // Remove markdown formatting
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*{1,3}/g, '')
    .replace(/_{1,3}/g, '')
    // Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Remove zero-width characters and excessive whitespace
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseGoogleAiModeResponse(
  rawItems: unknown[],
  domain: string,
  actorUsed?: string
): ParsedAiOverview {
  const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  const textBlocks: string[] = []
  const callATextBlocks: string[] = []
  const callBTextBlocks: string[] = []
  const storeMetaDescriptionBlocks: string[] = []
  const sourcesMap = new Map<string, string>()

  const rawAiAnswers = {
    q1Scale: '',
    q2Reviews: '',
    q3Competitors: '',
    q4IndustryReport: '',
  }

  const helperExtractTextFromBlock = (tb: unknown): string => {
    if (!tb) return ''
    if (typeof tb === 'string') return tb.trim()
    if (typeof tb === 'object') {
      const b = tb as Record<string, unknown>
      const direct = (b.text || b.content || b.heading || b.paragraph || b.answer || '') as string
      if (typeof direct === 'string' && direct.trim()) return direct.trim()
      if (Array.isArray(b.items)) {
        return b.items.map((it) => (typeof it === 'string' ? it : (it as Record<string, unknown>)?.text || '')).filter(Boolean).join('\n')
      }
      if (Array.isArray(b.rows)) {
        return b.rows
          .map((row) => (Array.isArray(row) ? row.join(' | ') : (row as Record<string, unknown>)?.text || ''))
          .filter(Boolean)
          .join('\n')
      }
    }
    return ''
  }

  const helperAddCitation = (rawSrc: unknown) => {
    if (!rawSrc || typeof rawSrc !== 'object') return
    const src = rawSrc as Record<string, unknown>
    const url = typeof src.url === 'string' ? src.url : typeof src.link === 'string' ? src.link : ''
    const rawTitle = typeof src.title === 'string' ? src.title : typeof src.name === 'string' ? src.name : typeof src.source === 'string' ? src.source : typeof src.domain === 'string' ? src.domain : url
    const title = String(rawTitle || '').trim()
    if (url) {
      try {
        const u = new URL(url)
        const host = u.hostname.replace(/^www\./, '').toLowerCase()
        if (!sourcesMap.has(url) && !host.includes('google')) {
          sourcesMap.set(url, title || host)
        }
      } catch {
        // Ignore malformed URL
      }
    }
  }

  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (!item) continue

      if (typeof item === 'string') {
        textBlocks.push(item)
        continue
      }

      if (typeof item === 'object') {
        const itemObj = item as Record<string, unknown>

        // Check if explicitly flagged as store meta description
        if (itemObj.isStoreMetaDescription === true) {
          if (typeof itemObj.text === 'string' && itemObj.text.trim()) {
            storeMetaDescriptionBlocks.push(itemObj.text.trim())
          }
          continue
        }

        const itemQuery = typeof itemObj.q === 'string' ? itemObj.q : typeof itemObj.query === 'string' ? itemObj.query : ''
        const collectedFromItem: string[] = []

        // 1. Direct answer/text fields
        if (typeof itemObj.answer_text === 'string' && itemObj.answer_text.trim()) {
          collectedFromItem.push(itemObj.answer_text.trim())
        }
        if (typeof itemObj.text === 'string' && itemObj.text.trim()) {
          collectedFromItem.push(itemObj.text.trim())
        }
        if (typeof itemObj.markdown === 'string' && itemObj.markdown.trim()) {
          collectedFromItem.push(itemObj.markdown.trim())
        }
        if (typeof itemObj.answer === 'string' && itemObj.answer.trim()) {
          collectedFromItem.push(itemObj.answer.trim())
        }
        if (typeof itemObj.aiOverviewText === 'string' && itemObj.aiOverviewText.trim()) {
          collectedFromItem.push(itemObj.aiOverviewText.trim())
        }

        // 2. Iterate over blocks / text_blocks (litescrape~google-ai-mode / litescrape~google-ai-overview)
        const rawBlocks = (Array.isArray(itemObj.blocks) ? itemObj.blocks : Array.isArray(itemObj.text_blocks) ? itemObj.text_blocks : []) as unknown[]
        for (const block of rawBlocks) {
          const extracted = helperExtractTextFromBlock(block)
          if (extracted) collectedFromItem.push(extracted)
        }

        // 3. subimpact~google-ai-mode-scraper (nested ai_overview)
        if (itemObj.ai_overview && typeof itemObj.ai_overview === 'object') {
          const aiObj = itemObj.ai_overview as Record<string, unknown>
          if (typeof aiObj.answer_text === 'string' && aiObj.answer_text.trim()) {
            collectedFromItem.push(aiObj.answer_text.trim())
          }
          if (typeof aiObj.markdown === 'string' && aiObj.markdown.trim()) {
            collectedFromItem.push(aiObj.markdown.trim())
          }
          if (Array.isArray(aiObj.text_blocks)) {
            for (const tb of aiObj.text_blocks) {
              const extracted = helperExtractTextFromBlock(tb)
              if (extracted) collectedFromItem.push(extracted)
            }
          }
          if (Array.isArray(aiObj.references)) {
            for (const r of aiObj.references) helperAddCitation(r)
          }
          if (Array.isArray(aiObj.sources)) {
            for (const s of aiObj.sources) helperAddCitation(s)
          }
        }

        // 4. gauravlabs~google-serp-api / litescrape~google-search (answer_box, knowledge_graph, organic)
        if (itemObj.answer_box && typeof itemObj.answer_box === 'object') {
          const ab = itemObj.answer_box as Record<string, unknown>
          const snippet = (ab.snippet || ab.answer || ab.title || '') as string
          if (snippet) collectedFromItem.push(snippet)
        }
        if (itemObj.knowledge_graph && typeof itemObj.knowledge_graph === 'object') {
          const kg = itemObj.knowledge_graph as Record<string, unknown>
          const desc = (kg.description || kg.title || '') as string
          if (desc) collectedFromItem.push(desc)
        }
        const organicList = (Array.isArray(itemObj.organic_results)
          ? itemObj.organic_results
          : Array.isArray(itemObj.organic)
          ? itemObj.organic
          : Array.isArray(itemObj.organicResults)
          ? itemObj.organicResults
          : []) as Array<Record<string, unknown>>
        for (const org of organicList) {
          const orgTitle = (org.title || '') as string
          const orgSnippet = (org.snippet || org.description || '') as string
          if (orgSnippet || orgTitle) {
            collectedFromItem.push(`${orgTitle}: ${orgSnippet}`.trim())
          }
          helperAddCitation({ url: org.link || org.url, title: orgTitle || orgSnippet })
        }

        // Citations / References across actors
        const rawSources = (itemObj.references || itemObj.sources || itemObj.citations || itemObj.cited_sources || []) as Array<Record<string, unknown>>
        if (Array.isArray(rawSources)) {
          for (const s of rawSources) helperAddCitation(s)
        }

        const itemCombined = collectedFromItem.join('\n\n')
        if (itemCombined.trim()) {
          textBlocks.push(itemCombined.trim())

          const querySource = (itemObj.querySource || '') as string
          if (querySource === 'callA') {
            callATextBlocks.push(itemCombined.trim())
          } else if (querySource === 'callB') {
            callBTextBlocks.push(itemCombined.trim())
          }

          // Categorize into 4 intelligence queries
          const qLower = itemQuery.toLowerCase()
          const combinedLower = itemCombined.toLowerCase()
          if (qLower.includes('revenue') || qLower.includes('annual') || qLower.includes('traffic') || (!rawAiAnswers.q1Scale && /revenue|sales|annual|arr|\bturnover\b/i.test(combinedLower))) {
            rawAiAnswers.q1Scale = (rawAiAnswers.q1Scale ? rawAiAnswers.q1Scale + '\n\n' : '') + itemCombined
          } else if (qLower.includes('review') || qLower.includes('complaint') || qLower.includes('rating') || (!rawAiAnswers.q2Reviews && /reviews?|rating|complaint|praise|trustpilot/i.test(combinedLower))) {
            rawAiAnswers.q2Reviews = (rawAiAnswers.q2Reviews ? rawAiAnswers.q2Reviews + '\n\n' : '') + itemCombined
          } else if (qLower.includes('competitor') || qLower.includes('websites') || (!rawAiAnswers.q3Competitors && /competitor|alternative|vs\b|rival/i.test(combinedLower))) {
            rawAiAnswers.q3Competitors = (rawAiAnswers.q3Competitors ? rawAiAnswers.q3Competitors + '\n\n' : '') + itemCombined
          } else if (qLower.includes('benchmark') || qLower.includes('industry') || (!rawAiAnswers.q4IndustryReport && /benchmark|industry report|aov|cac|mer|return rate/i.test(combinedLower))) {
            rawAiAnswers.q4IndustryReport = (rawAiAnswers.q4IndustryReport ? rawAiAnswers.q4IndustryReport + '\n\n' : '') + itemCombined
          }
        }
      }
    }
  }

  const brandAndReviewsAiText = callATextBlocks.join('\n\n').trim()
  const industryBenchmarksAiText = callBTextBlocks.join('\n\n').trim()
  const googleAiModeSuccess =
    callATextBlocks.length > 0 ||
    callBTextBlocks.length > 0 ||
    (textBlocks.length > 0 && actorUsed !== 'native_web_probes')

  if (!rawAiAnswers.q4IndustryReport && industryBenchmarksAiText) {
    rawAiAnswers.q4IndustryReport = industryBenchmarksAiText
  }
  if (!rawAiAnswers.q1Scale && brandAndReviewsAiText) {
    rawAiAnswers.q1Scale = brandAndReviewsAiText
  }

  // Never overwrite real AI Mode text with store meta description
  // Only fallback to store meta description if real textBlocks are completely empty
  const blocksToUse = textBlocks.length > 0 ? textBlocks : storeMetaDescriptionBlocks
  const rawCombinedText = blocksToUse.join('\n\n')
  const normalizedText = normalizeRawText(rawCombinedText)

  const citedSources: CitedSource[] = Array.from(sourcesMap.entries()).map(([url, title]) => ({
    url,
    title: title || url,
  }))

  // Step B: Unit-Aware Financial & Metric Regex Pre-Extractor
  const extractedMetrics = extractMetricsFromText(normalizedText, cleanDomain, citedSources)

  // Step C: AI Presence Classification
  const aiPresenceStatus: AiPresenceStatus = classifyAiPresence(
    normalizedText,
    citedSources.length,
    cleanDomain
  )

  return {
    normalizedText,
    citedSources,
    aiPresenceStatus,
    actorUsed,
    brandAndReviewsAiText,
    industryBenchmarksAiText,
    googleAiModeSuccess,
    rawAiAnswers,
    extractedMetrics,
  }
}

export function classifyAiPresence(
  normalizedText: string,
  citedSourcesCount: number,
  domain: string
): AiPresenceStatus {
  if (!normalizedText || normalizedText.trim().length === 0) {
    return 'ZERO_AI_PRESENCE'
  }
  const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  const brandKey = cleanDomain.replace(/\.[a-z]+$/, '')
  const isRelevant = normalizedText.toLowerCase().includes(brandKey)

  if (!isRelevant && normalizedText.length < 50) {
    return 'ZERO_AI_PRESENCE'
  }
  if (
    (normalizedText.length > 200 ||
      (normalizedText.length > 70 && /revenue|sales|rating|reviews|\$|arr/i.test(normalizedText))) &&
    citedSourcesCount >= 2
  ) {
    return 'STRONG_AI_PRESENCE'
  }
  if (normalizedText.length >= 80 || citedSourcesCount >= 1) {
    return 'MODERATE_AI_PRESENCE'
  }
  return 'WEAK_AI_PRESENCE'
}

export function extractFinancialMetricsFromText(
  text: string,
  targetDomain = '',
  citedSources: CitedSource[] = []
): ParsedAiOverview['extractedMetrics'] {
  return extractMetricsFromText(text, targetDomain, citedSources)
}

function extractMetricsFromText(
  text: string,
  targetDomain: string,
  citedSources: CitedSource[]
): ParsedAiOverview['extractedMetrics'] {
  let monthlyRevenueEstimate: ParsedAiOverview['extractedMetrics']['monthlyRevenueEstimate'] = undefined
  let trafficEstimate: ParsedAiOverview['extractedMetrics']['trafficEstimate'] = undefined
  let reviewSentiment: ParsedAiOverview['extractedMetrics']['reviewSentiment'] = undefined
  const competitorDomains: string[] = []

  // 1. Annual Revenue Range: e.g. "$1.2M to $2.4M in annual revenue" or "$1.8 million per year"
  const annualRangeRegex =
    /\$(\d{1,3}(?:\.\d+)?)\s*(?:million|m\b)(?:\s*(?:to|-)\s*\$?(\d{1,3}(?:\.\d+)?)\s*(?:million|m\b))?\s*(?:in|of)?\s*(?:annual|annually|year|per\s+year|\/yr|arr|revenue)/i
  const annualMatch = text.match(annualRangeRegex)

  if (annualMatch) {
    const rawPhrase = annualMatch[0]
    const minM = parseFloat(annualMatch[1]) * 1000000
    const maxM = annualMatch[2] ? parseFloat(annualMatch[2]) * 1000000 : minM
    const isExplicitAnnual = /annual|annually|year|\/yr|arr/i.test(annualMatch[0])

    const divisor = isExplicitAnnual ? 12 : 12 // Annualized by default for millions
    const minMonthly = Math.round(minM / divisor)
    const maxMonthly = Math.round(maxM / divisor)
    const midpointMonthly = Math.round((minMonthly + maxMonthly) / 2)

    monthlyRevenueEstimate = {
      minMonthly,
      maxMonthly,
      midpointMonthly,
      rawPhrase,
      isAnnualized: isExplicitAnnual,
    }
  }

  // 1B. Monthly Revenue: e.g. "$90k MRR", "$90,000 per month", "$90k/mo"
  if (!monthlyRevenueEstimate) {
    const monthlyRegex =
      /\$(\d{1,4}(?:,\d{3})*(?:\.\d+)?|\d{1,3}(?:\.\d+)?\s*(?:k|thousand|m|million))\s*(?:mrr|per\s+month|\/month|\/mo|monthly)/i
    const mMatch = text.match(monthlyRegex)
    if (mMatch) {
      const rawPhrase = mMatch[0]
      let val = 0
      const innerStr = mMatch[1].toLowerCase().replace(/,/g, '')
      if (innerStr.includes('m') || innerStr.includes('million')) {
        val = parseFloat(innerStr) * 1000000
      } else if (innerStr.includes('k') || innerStr.includes('thousand')) {
        val = parseFloat(innerStr) * 1000
      } else {
        val = parseFloat(innerStr)
      }

      if (Number.isFinite(val) && val > 0) {
        monthlyRevenueEstimate = {
          minMonthly: Math.round(val * 0.85),
          maxMonthly: Math.round(val * 1.15),
          midpointMonthly: Math.round(val),
          rawPhrase,
          isAnnualized: false,
        }
      }
    }
  }

  // 2. Traffic estimation: e.g. "nearly 3M monthly visits", "450k monthly sessions"
  const trafficRegex =
    /(?:about|approximately|commands|over|nearly|around)?\s*(\d{1,3}(?:\.\d+)?)\s*(million|m|k|thousand)\s*(?:monthly\s+visits|monthly\s+visitors|visits\s+per\s+month|monthly\s+sessions|monthly\s+traffic)/i
  const tMatch = text.match(trafficRegex)
  if (tMatch) {
    const num = parseFloat(tMatch[1])
    const unit = tMatch[2].toLowerCase()
    let visits = num
    if (unit.startsWith('m')) visits *= 1000000
    else if (unit.startsWith('k') || unit.startsWith('t')) visits *= 1000
    trafficEstimate = {
      monthlyVisits: Math.round(visits),
      rawPhrase: tMatch[0],
    }
  }

  // 3. Review Sentiment: e.g. "4.6/5 stars" or "4.6 out of 5 across 1,200 reviews"
  const reviewRegex =
    /(\d(?:\.\d)?)\s*(?:\/|\s*out\s*of\s*)5(?:\s*stars)?(?:\s*(?:across|based\s+on|from)\s*(\d{1,4}(?:,\d{3})*)\s*reviews)?/i
  const rMatch = text.match(reviewRegex)
  if (rMatch) {
    const rating = parseFloat(rMatch[1])
    const reviewCount = rMatch[2] ? parseInt(rMatch[2].replace(/,/g, ''), 10) : undefined
    reviewSentiment = {
      rating: Number.isFinite(rating) ? rating : undefined,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : undefined,
      rawPhrase: rMatch[0],
    }
  }

  // 4. Candidate Competitor Domains from citations and text mentions
  for (const src of citedSources) {
    try {
      const u = new URL(src.url)
      const host = u.hostname.replace(/^www\./, '').toLowerCase()
      if (
        host &&
        !host.includes(targetDomain) &&
        !EXCLUDED_HOSTS.some((ex) => host.includes(ex)) &&
        !competitorDomains.includes(host)
      ) {
        competitorDomains.push(host)
      }
    } catch {
      // Ignore
    }
  }

  return {
    monthlyRevenueEstimate,
    trafficEstimate,
    reviewSentiment,
    competitorDomains: competitorDomains.slice(0, 5),
  }
}
