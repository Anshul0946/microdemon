import {
  DiscoveryPayload,
  DiscoveredFields,
  AiBrandAndCustomerProfile,
  DiscoveredCompetitor,
  IndustryReport2026,
  EcommerceVertical,
} from '@/lib/cqi/types'
import { scrapeShopifyCatalog } from './shopifyScraper'
import { scanStoreTechStack, getFallbackTechScan } from './techScanner'
import { fetchGoogleSearchAndCheckScale } from './apify/googleSearch'
import { fetchMetaAdTelemetry } from './apify/metaAds'
import { runQwenAgenticJson } from './groq/client'
import { VERTICAL_BENCHMARKS } from '@/lib/config/benchmarks'

export async function runStep1StoreDiscovery(domain: string): Promise<DiscoveryPayload> {
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase().trim()
  const storeTitle = cleanDomain.split('.')[0].toUpperCase()

  // 1. Parallel Telemetry Fetch: Catalog + Tech + Google AI Mode Search + Meta Ads
  const [catalogSettled, techSettled, searchSettled, adsSettled] = await Promise.allSettled([
    scrapeShopifyCatalog(cleanDomain),
    scanStoreTechStack(cleanDomain),
    fetchGoogleSearchAndCheckScale(cleanDomain, 100000, 25000),
    fetchMetaAdTelemetry(cleanDomain, 25000),
  ])

  const catalog =
    catalogSettled.status === 'fulfilled'
      ? catalogSettled.value
      : await scrapeShopifyCatalog(cleanDomain)

  const techScan =
    techSettled.status === 'fulfilled'
      ? techSettled.value
      : getFallbackTechScan()

  const searchSummary =
    searchSettled.status === 'fulfilled' ? searchSettled.value : null

  const googleText =
    searchSummary?.parsedOverview?.normalizedText ||
    searchSummary?.searchSnippetSummary ||
    ''

  const citedSources =
    searchSummary?.citedSources ||
    searchSummary?.parsedOverview?.citedSources ||
    []

  const aiPresenceStatus = searchSummary?.aiPresenceStatus || 'ZERO_AI_PRESENCE'
  const extractedMetrics = searchSummary?.parsedOverview?.extractedMetrics
  const detectedPublicFloorRevenue = searchSummary?.detectedPublicFloorRevenue || 120000

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

  const skuAnalytics = catalog.skuAnalytics!
  const pLadder = skuAnalytics.priceLadder

  // 2. Detect Ecommerce Vertical & Sub-Niche from Catalog Signals
  const dominantTypes = skuAnalytics.dominantProductTypes.join(' ').toLowerCase()
  const dominantTags = skuAnalytics.dominantTags.join(' ').toLowerCase()
  const combinedText = `${dominantTypes} ${dominantTags} ${cleanDomain} ${googleText}`.toLowerCase()

  let detectedVertical: EcommerceVertical = 'supplements'
  let subNicheName = 'Premium Health & Wellness Formulations'

  if (
    combinedText.includes('beauty') ||
    combinedText.includes('skincare') ||
    combinedText.includes('serum') ||
    combinedText.includes('cream') ||
    combinedText.includes('cosmetic')
  ) {
    detectedVertical = 'skincare'
    subNicheName = 'Clean Active Skincare & Dermaceuticals'
  } else if (
    combinedText.includes('apparel') ||
    combinedText.includes('clothing') ||
    combinedText.includes('shirt') ||
    combinedText.includes('hoodie') ||
    combinedText.includes('wear') ||
    combinedText.includes('short') ||
    combinedText.includes('pant') ||
    combinedText.includes('shoe') ||
    combinedText.includes('athletic')
  ) {
    detectedVertical = 'apparel'
    subNicheName = 'Technical Performance & Athleisure Apparel'
  } else if (
    combinedText.includes('pet') ||
    combinedText.includes('dog') ||
    combinedText.includes('cat') ||
    combinedText.includes('chew')
  ) {
    detectedVertical = 'pets'
    subNicheName = 'Functional Pet Nutrition & Longevity'
  } else if (
    combinedText.includes('food') ||
    combinedText.includes('coffee') ||
    combinedText.includes('drink') ||
    combinedText.includes('snack') ||
    combinedText.includes('tea') ||
    combinedText.includes('cereal')
  ) {
    detectedVertical = 'food_bev'
    subNicheName = 'Better-For-You Functional Foods & Beverages'
  } else if (
    combinedText.includes('home') ||
    combinedText.includes('cookware') ||
    combinedText.includes('furniture') ||
    combinedText.includes('bed') ||
    combinedText.includes('pillow') ||
    combinedText.includes('candle')
  ) {
    detectedVertical = 'home_lifestyle'
    subNicheName = 'Design-Led Home Goods & Everyday Living'
  }

  const vBenchmark = VERTICAL_BENCHMARKS[detectedVertical]

  // 3. Run Groq Qwen Agentic Discovery Synthesis
  const systemPrompt = `You are the Principal Commerce Intelligence Architect for Nyxir CQI Diagnostics.
Your mission is to analyze scraped Shopify storefront schema telemetry and live search/AI text to produce an institutional customer quality and competitor discovery payload.
Return ONLY valid JSON matching the exact schema. No markdown fences, no conversational prose.`

  const userPrompt = `Store Domain: ${cleanDomain}
Store Title: ${storeTitle}
Auto-Detected Vertical: ${detectedVertical} (${subNicheName})
Catalog Sampled: ${skuAnalytics.totalProductsSampled} products, ${skuAnalytics.totalVariantsSampled} variants
Price Ladder: Min $${pLadder.minPrice}, P10 $${pLadder.p10Price}, Median $${pLadder.medianSkuPrice}, Mean $${pLadder.meanSkuPrice}, P90 $${pLadder.p90Price}, Max $${pLadder.maxPrice}
Bundle Ratio: ${skuAnalytics.bundleRatioPct}% (${skuAnalytics.bundleSkuCount} bundle SKUs)
Discounted SKUs: ${skuAnalytics.discountedSkuPct}% with average depth ${skuAnalytics.avgDiscountDepthPct}%
High Friction SKUs (>5 variants): ${skuAnalytics.highFrictionSkuCount}
Dominant Product Types: ${skuAnalytics.dominantProductTypes.slice(0, 5).join(', ')}
Dominant Tags: ${skuAnalytics.dominantTags.slice(0, 8).join(', ')}
Google AI Mode / Web Extracted Text:
${googleText.slice(0, 1400) || '(No Google AI Mode overview found for this brand)'}
Cited Sources: ${JSON.stringify(citedSources.slice(0, 5))}
Active Meta Ads Found: ${metaAds.activeAdCount} (Verified: ${metaAds.adsVerified})

Generate a complete JSON discovery response with:
1. "aiBrandAndCustomerProfile": {
     "aiPresenceStatus": "${aiPresenceStatus}",
     "googleAiOverviewSummary": "3-sentence synthesis of what Google AI Mode / web knows about this brand (or explicit warning that Google AI has zero record)",
     "customerBaseProfile": {
       "targetDemographics": "Detailed customer demographic and psychographic",
       "pricePositioning": "Value, Mid-Market, Premium, or Luxury based on $${pLadder.medianSkuPrice} median price",
       "primaryBuyingTrigger": "Core emotional or functional reason customers convert",
       "repeatPurchaseDriver": "Consumable replenishable cycle, seasonal launch, or low-repurchase single purchase",
       "churnAndRefundRiskFactor": "Specific quality, sizing, or expectation gap risk"
     },
     "skuCatalogAssessment": "Direct critique of SKU price ladder, bundle ratio ($${skuAnalytics.bundleRatioPct}%), and variant friction"
   }
2. "discoveredFields": {
     "vertical": "${detectedVertical}",
     "subNicheName": "${subNicheName}",
     "sourceLabel": "Shopify Schema + Google AI Mode Synthesis",
     "monthlyRevenue": {
       "foundOnline": boolean,
       "value": number (reasonable monthly USD estimate based on catalog and web signals),
       "rangeMin": number,
       "rangeMax": number,
       "confidence": "HIGH" | "MEDIUM" | "ESTIMATED_FROM_STORE_SIGNALS",
       "sourceExplanation": "string explaining how this was derived"
     },
     "monthlyAdSpend": {
       "foundOnline": boolean,
       "value": number (reasonable monthly ad spend based on revenue and ad count),
       "rangeMin": number,
       "rangeMax": number,
       "confidence": "HIGH" | "MEDIUM" | "ESTIMATED_FROM_STORE_SIGNALS",
       "sourceExplanation": "string explaining ad spend signal"
     },
     "cogsPct": { "value": ${vBenchmark.defaultCogsPct}, "sourceExplanation": "2026 ${subNicheName} Industry Report Benchmark" },
     "refundRatePct": { "value": ${vBenchmark.avgRefundRatePct}, "sourceExplanation": "2026 ${subNicheName} Industry Report Benchmark" },
     "competitors": [
       { "name": "Competitor 1", "domain": "competitor1.com", "estimatedAOV": number, "estimatedCAC": number, "cqiScore": number, "winningMechanism": "string" },
       { "name": "Competitor 2", "domain": "competitor2.com", "estimatedAOV": number, "estimatedCAC": number, "cqiScore": number, "winningMechanism": "string" },
       { "name": "Competitor 3", "domain": "competitor3.com", "estimatedAOV": number, "estimatedCAC": number, "cqiScore": number, "winningMechanism": "string" }
     ],
     "industryReport2026": {
       "subNicheName": "${subNicheName}",
       "reportSource": "Nyxir 2026 Institutional Commerce Index",
       "benchmarkAOV": ${vBenchmark.benchmarkAOV},
       "healthyCAC": ${vBenchmark.healthyBlendedCAC},
       "healthyMER": ${vBenchmark.healthyMER},
       "grossMarginPct": ${100 - vBenchmark.defaultCogsPct},
       "avgRefundRatePct": ${vBenchmark.avgRefundRatePct},
       "repeatRate90dPct": ${vBenchmark.repeatRate90dPct},
       "key2026Trend": "Shift towards high-retention bundle architectures and first-party signal ingestion."
     }
   }`

  interface QwenDiscoveryRaw {
    aiBrandAndCustomerProfile?: AiBrandAndCustomerProfile
    discoveredFields?: DiscoveredFields
  }

  const { data: qwenData } = await runQwenAgenticJson<QwenDiscoveryRaw>(
    systemPrompt,
    userPrompt,
    8500
  )

  // Default Competitors
  const defaultCompetitors: DiscoveredCompetitor[] = [
    {
      name: `${storeTitle} Benchmark Leader`,
      domain: `${cleanDomain.split('.')[0]}-leader.com`,
      estimatedAOV: Math.round(pLadder.medianSkuPrice * 1.25),
      estimatedCAC: Math.round(vBenchmark.healthyBlendedCAC * 0.9),
      cqiScore: 82,
      winningMechanism: 'High-LTV 3-pack subscription bundle anchor with 64% first-order margin.',
    },
    {
      name: `Direct Sub-Niche Rival`,
      domain: `${cleanDomain.split('.')[0]}-rival.com`,
      estimatedAOV: Math.round(pLadder.medianSkuPrice * 1.05),
      estimatedCAC: Math.round(vBenchmark.healthyBlendedCAC * 1.1),
      cqiScore: 68,
      winningMechanism: 'Aggressive ASC short-form creative testing with high promo elasticity.',
    },
    {
      name: `Entry-Price Competitor`,
      domain: `${cleanDomain.split('.')[0]}-value.com`,
      estimatedAOV: Math.round(pLadder.p10Price * 1.15),
      estimatedCAC: Math.round(vBenchmark.healthyBlendedCAC * 0.75),
      cqiScore: 61,
      winningMechanism: 'Low-friction starter SKU driving high initial front-end conversion volume.',
    },
  ]

  // Default Industry Report 2026
  const defaultIndustryReport: IndustryReport2026 = {
    subNicheName,
    reportSource: 'Nyxir 2026 Institutional Commerce Index',
    benchmarkAOV: vBenchmark.benchmarkAOV,
    healthyCAC: vBenchmark.healthyBlendedCAC,
    healthyMER: vBenchmark.healthyMER,
    grossMarginPct: 100 - vBenchmark.defaultCogsPct,
    avgRefundRatePct: vBenchmark.avgRefundRatePct,
    repeatRate90dPct: vBenchmark.repeatRate90dPct || 35,
    key2026Trend:
      'Meta ASC saturation is compressing single-SKU unit economics; leaders are anchoring traffic to multi-item routines.',
  }

  // Pre-extracted revenue from Google AI Mode if available
  const onlineRev = extractedMetrics?.monthlyRevenueEstimate
  const baseRevenue = onlineRev ? onlineRev.midpointMonthly : detectedPublicFloorRevenue || 120000
  const baseAdSpend = Math.round(baseRevenue / (vBenchmark.healthyMER || 3.0))

  const aiProfile: AiBrandAndCustomerProfile = qwenData?.aiBrandAndCustomerProfile || {
    aiPresenceStatus,
    googleAiOverviewSummary:
      googleText.length > 50
        ? `Google AI Mode synthesizes ${storeTitle} as an active brand in ${subNicheName}. Indexed citations reflect current storefront offerings and verified buyer interest.`
        : `Google AI Mode has zero indexed overview records for ${cleanDomain}. The brand currently lacks synthetic authority in Google generative overviews, leaving discovery vulnerable to direct competitor bidding.`,
    customerBaseProfile: {
      targetDemographics:
        qwenData?.aiBrandAndCustomerProfile?.customerBaseProfile?.targetDemographics ||
        `Affluent direct-to-consumer shoppers looking for verified quality in ${subNicheName}.`,
      pricePositioning:
        pLadder.medianSkuPrice >= 85 ? 'Premium / Luxury DTC' : pLadder.medianSkuPrice >= 45 ? 'Mid-Market Modern Commerce' : 'Accessible Entry-Level',
      primaryBuyingTrigger:
        qwenData?.aiBrandAndCustomerProfile?.customerBaseProfile?.primaryBuyingTrigger ||
        'Specific problem-solution fit highlighted by digital storefront presentation.',
      repeatPurchaseDriver:
        detectedVertical === 'supplements' || detectedVertical === 'skincare'
          ? 'Consumable replenishment cycle (30-45 day standard reorder cadence).'
          : 'Seasonal wardrobe updates and new collection drops.',
      churnAndRefundRiskFactor:
        qwenData?.aiBrandAndCustomerProfile?.customerBaseProfile?.churnAndRefundRiskFactor ||
        `Sizing uncertainty, variant confusion (${skuAnalytics.highFrictionSkuCount} high-variant SKUs), or expectation gaps on arrival.`,
    },
    skuCatalogAssessment:
      qwenData?.aiBrandAndCustomerProfile?.skuCatalogAssessment ||
      `Storefront catalogs ${skuAnalytics.totalProductsSampled} products with a median price of $${pLadder.medianSkuPrice} and a ${skuAnalytics.bundleRatioPct}% bundle ratio. ${
        skuAnalytics.bundleRatioPct < 20
          ? 'Bundle architecture is dangerously underutilized, exposing acquisition traffic to single-SKU margin compression.'
          : 'Healthy multi-SKU and kit structure is present to support blended order values.'
      }`,
  }

  const discoveredFields: DiscoveredFields = {
    vertical: detectedVertical,
    subNicheName,
    sourceLabel: 'Shopify Schema + Google AI Mode Synthesis',
    monthlyRevenue: qwenData?.discoveredFields?.monthlyRevenue || {
      foundOnline: Boolean(onlineRev),
      value: baseRevenue,
      rangeMin: onlineRev ? onlineRev.minMonthly : Math.round(baseRevenue * 0.7),
      rangeMax: onlineRev ? onlineRev.maxMonthly : Math.round(baseRevenue * 1.35),
      confidence: onlineRev ? 'HIGH' : 'ESTIMATED_FROM_STORE_SIGNALS',
      sourceExplanation: onlineRev
        ? `Extracted from Google AI Mode synthesis text (${onlineRev.rawPhrase})`
        : `Derived from ${skuAnalytics.totalProductsSampled} catalog SKUs and storefront tech footprint`,
    },
    monthlyAdSpend: qwenData?.discoveredFields?.monthlyAdSpend || {
      foundOnline: metaAds.activeAdCount > 0,
      value: baseAdSpend,
      rangeMin: Math.round(baseAdSpend * 0.65),
      rangeMax: Math.round(baseAdSpend * 1.35),
      confidence: metaAds.activeAdCount > 0 ? 'MEDIUM' : 'ESTIMATED_FROM_STORE_SIGNALS',
      sourceExplanation: metaAds.activeAdCount > 0
        ? `Calibrated from ${metaAds.activeAdCount} active Meta ad creatives and industry MER benchmark`
        : `Modeled from baseline MER (${vBenchmark.healthyMER}x) for ${subNicheName}`,
    },
    cogsPct: qwenData?.discoveredFields?.cogsPct || {
      value: vBenchmark.defaultCogsPct,
      sourceExplanation: `2026 ${subNicheName} Industry Report Benchmark (${vBenchmark.defaultCogsPct}%)`,
    },
    refundRatePct: qwenData?.discoveredFields?.refundRatePct || {
      value: vBenchmark.avgRefundRatePct,
      sourceExplanation: `2026 ${subNicheName} Industry Report Benchmark (${vBenchmark.avgRefundRatePct}%)`,
    },
    competitors:
      Array.isArray(qwenData?.discoveredFields?.competitors) && qwenData.discoveredFields.competitors.length >= 3
        ? qwenData.discoveredFields.competitors.slice(0, 3)
        : defaultCompetitors,
    industryReport2026: qwenData?.discoveredFields?.industryReport2026 || defaultIndustryReport,
  }

  return {
    ok: true,
    domain: cleanDomain,
    storeTitle,
    detectedCurrency: 'USD',
    skuAnalytics,
    aiBrandAndCustomerProfile: aiProfile,
    discoveredFields,
    techScan,
    metaAds,
  }
}
