export type AiPresenceStatus =
  | 'STRONG_AI_PRESENCE'
  | 'MODERATE_AI_PRESENCE'
  | 'WEAK_AI_PRESENCE'
  | 'ZERO_AI_PRESENCE'

export interface CitedSource {
  title: string
  url: string
}

export interface ParsedAiOverview {
  normalizedText: string
  citedSources: CitedSource[]
  aiPresenceStatus: AiPresenceStatus
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
  domain: string
): ParsedAiOverview {
  const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
  const textBlocks: string[] = []
  const sourcesMap = new Map<string, string>()

  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (!item) continue

      // Extract text content from various Google AI overview schemas
      if (typeof item === 'string') {
        textBlocks.push(item)
      } else if (typeof item === 'object') {
        const itemObj = item as Record<string, unknown>
        if (typeof itemObj.text === 'string') textBlocks.push(itemObj.text)
        if (typeof itemObj.answer_text === 'string') textBlocks.push(itemObj.answer_text)
        if (typeof itemObj.answer === 'string') textBlocks.push(itemObj.answer)
        if (typeof itemObj.aiOverviewText === 'string') textBlocks.push(itemObj.aiOverviewText)
        if (itemObj.ai_overview && typeof (itemObj.ai_overview as Record<string, unknown>).answer_text === 'string') {
          textBlocks.push((itemObj.ai_overview as Record<string, unknown>).answer_text as string)
        }
        if (Array.isArray(itemObj.text_blocks)) {
          for (const tb of itemObj.text_blocks) {
            if (typeof tb === 'string') textBlocks.push(tb)
            else if (tb && typeof (tb as Record<string, unknown>).text === 'string') {
              textBlocks.push((tb as Record<string, unknown>).text as string)
            }
          }
        }

        // Extract sources / references
        const rawSources = (itemObj.sources || itemObj.references || itemObj.cited_sources || []) as Array<Record<string, unknown>>
        if (Array.isArray(rawSources)) {
          for (const src of rawSources) {
            const url = typeof src?.url === 'string' ? src.url : typeof src?.link === 'string' ? src.link : ''
            const rawTitle = typeof src?.title === 'string' ? src.title : typeof src?.name === 'string' ? src.name : url
            const title = String(rawTitle).trim()
            if (url) {
              try {
                const u = new URL(url)
                const host = u.hostname.replace(/^www\./, '').toLowerCase()
                if (!sourcesMap.has(url) && !host.includes('google')) {
                  sourcesMap.set(url, title)
                }
              } catch {
                // Ignore invalid URL
              }
            }
          }
        }
      }
    }
  }

  const rawCombinedText = textBlocks.join('\n\n')
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
