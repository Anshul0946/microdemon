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
import { fetchMetaAdTelemetry, MetaAdTelemetry } from './apify/metaAds'
import { runQwenAgenticJson } from './groq/client'
import { VERTICAL_BENCHMARKS } from '@/lib/config/benchmarks'

export function getRealSubNicheCompetitors(
  vertical: EcommerceVertical,
  subNicheName: string,
  _medianPrice?: number
): DiscoveredCompetitor[] {
  const isGrooming = /beard|groom|shav|men/i.test(subNicheName)

  if (isGrooming || vertical === 'skincare') {
    if (isGrooming) {
      return [
        {
          name: 'Dr. Squatch',
          domain: 'drsquatch.com',
          estimatedAOV: 54,
          estimatedCAC: 28,
          cqiScore: 86,
          winningMechanism: 'High-converting multi-bar soap bundles with natural fragrance subscription anchors.',
        },
        {
          name: 'Manscaped',
          domain: 'manscaped.com',
          estimatedAOV: 76,
          estimatedCAC: 36,
          cqiScore: 84,
          winningMechanism: 'Peak Performance hygiene package routines driving high initial basket value.',
        },
        {
          name: 'Scotch Porter',
          domain: 'scotchporter.com',
          estimatedAOV: 48,
          estimatedCAC: 26,
          cqiScore: 79,
          winningMechanism: 'Complete beard care collection kits and targeted multicultural grooming authority.',
        },
      ]
    }
    return [
      {
        name: 'Summer Fridays',
        domain: 'summerfridays.com',
        estimatedAOV: 85,
        estimatedCAC: 32,
        cqiScore: 88,
        winningMechanism: 'Skin-smoothing regimen smoothie kits with high 60-day replenishment.',
      },
      {
        name: 'Rhode Skin',
        domain: 'rhodeskin.com',
        estimatedAOV: 68,
        estimatedCAC: 24,
        cqiScore: 86,
        winningMechanism: 'Minimalist peptide barrier restoration routine with viral social hook engine.',
      },
      {
        name: 'KraveBeauty',
        domain: 'kravebeauty.com',
        estimatedAOV: 52,
        estimatedCAC: 22,
        cqiScore: 81,
        winningMechanism: 'Barrier-first skin reset fundamentals with intentional slowing-down philosophy.',
      },
    ]
  }

  if (vertical === 'apparel') {
    return [
      {
        name: 'Vuori',
        domain: 'vuoriclothing.com',
        estimatedAOV: 135,
        estimatedCAC: 42,
        cqiScore: 90,
        winningMechanism: 'Premium coastal performance fabrics driving high organic word-of-mouth repeat.',
      },
      {
        name: 'Gymshark',
        domain: 'gymshark.com',
        estimatedAOV: 82,
        estimatedCAC: 29,
        cqiScore: 85,
        winningMechanism: 'Community-driven fitness lifestyle launches with strong athlete UGC flywheels.',
      },
      {
        name: 'Lululemon',
        domain: 'lululemon.com',
        estimatedAOV: 148,
        estimatedCAC: 46,
        cqiScore: 89,
        winningMechanism: 'Iconic technical athletic apparel with unmatched brand equity and repeat loyalty.',
      },
    ]
  }

  if (vertical === 'supplements') {
    return [
      {
        name: 'AG1',
        domain: 'drinkag1.com',
        estimatedAOV: 98,
        estimatedCAC: 48,
        cqiScore: 92,
        winningMechanism: 'Flawless 30-day recurring subscription funnel with free starter welcome kits.',
      },
      {
        name: 'Thorne',
        domain: 'thorne.com',
        estimatedAOV: 86,
        estimatedCAC: 38,
        cqiScore: 88,
        winningMechanism: 'Clinical-grade NSF certified formulations with deep practitioner endorsement.',
      },
      {
        name: 'Hims',
        domain: 'forhims.com',
        estimatedAOV: 75,
        estimatedCAC: 34,
        cqiScore: 86,
        winningMechanism: 'Seamless telehealth subscription onboarding and multi-month replenishment bundles.',
      },
    ]
  }

  if (vertical === 'food_bev') {
    return [
      {
        name: 'Magic Spoon',
        domain: 'magicspoon.com',
        estimatedAOV: 68,
        estimatedCAC: 26,
        cqiScore: 86,
        winningMechanism: 'High-protein multi-box variety pack anchors with subscription discounts.',
      },
      {
        name: 'Olipop',
        domain: 'drinkolipop.com',
        estimatedAOV: 42,
        estimatedCAC: 19,
        cqiScore: 84,
        winningMechanism: 'Functional prebiotic soda 12-packs leveraging nostalgic flavor associations.',
      },
      {
        name: 'Liquid I.V.',
        domain: 'liquid-iv.com',
        estimatedAOV: 50,
        estimatedCAC: 21,
        cqiScore: 83,
        winningMechanism: 'Cellular transport hydration multipliers in high-volume multi-pack formats.',
      },
    ]
  }

  if (vertical === 'pets') {
    return [
      {
        name: 'Native Pet',
        domain: 'nativepet.com',
        estimatedAOV: 72,
        estimatedCAC: 24,
        cqiScore: 89,
        winningMechanism: 'Clean ingredient chews with high 45-day recurring subscription replenishment.',
      },
      {
        name: 'The Farmer’s Dog',
        domain: 'thefarmersdog.com',
        estimatedAOV: 120,
        estimatedCAC: 55,
        cqiScore: 87,
        winningMechanism: 'Personalized fresh food subscription plans tailored to specific dog profiles.',
      },
      {
        name: 'BarkBox',
        domain: 'barkbox.com',
        estimatedAOV: 65,
        estimatedCAC: 28,
        cqiScore: 82,
        winningMechanism: 'Themed monthly toy and treat subscription unboxing experiences.',
      },
    ]
  }

  // Home lifestyle default
  return [
    {
      name: 'Our Place',
      domain: 'fromourplace.com',
      estimatedAOV: 165,
      estimatedCAC: 52,
      cqiScore: 87,
      winningMechanism: 'Multi-functional Always Pan bundle anchors driving high initial basket size.',
    },
    {
      name: 'Brooklinen',
      domain: 'brooklinen.com',
      estimatedAOV: 185,
      estimatedCAC: 58,
      cqiScore: 86,
      winningMechanism: 'Core sheet sets and bundle-and-save bedding upgrade pathways.',
    },
    {
      name: 'Caraway',
      domain: 'carawayhome.com',
      estimatedAOV: 175,
      estimatedCAC: 54,
      cqiScore: 85,
      winningMechanism: 'Non-toxic ceramic cookware set anchors with matching storage organizers.',
    },
  ]
}

export async function runStep1StoreDiscovery(domain: string): Promise<DiscoveryPayload> {
  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase().trim()
  const storeTitle = cleanDomain.split('.')[0].toUpperCase()

  // 1. Fire Meta Ads in background immediately so it runs concurrently with store discovery and NVIDIA NIM
  const adsPromise = fetchMetaAdTelemetry(cleanDomain, 25000)

  // 2. Fetch Catalog + Tech + Google AI Mode Search
  const [catalogSettled, techSettled, searchSettled] = await Promise.allSettled([
    scrapeShopifyCatalog(cleanDomain),
    scanStoreTechStack(cleanDomain),
    fetchGoogleSearchAndCheckScale(cleanDomain, 100000, 25000),
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

  const skuAnalytics = catalog.skuAnalytics!
  const pLadder = skuAnalytics.priceLadder

  // 3. Detect Ecommerce Vertical & Sub-Niche from Catalog Signals
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
    combinedText.includes('cosmetic') ||
    combinedText.includes('beard') ||
    combinedText.includes('grooming') ||
    combinedText.includes('haircare') ||
    combinedText.includes('shaving') ||
    combinedText.includes('parfum') ||
    combinedText.includes('balm')
  ) {
    detectedVertical = 'skincare'
    subNicheName = combinedText.includes('beard') || combinedText.includes('groom')
      ? "Men's Premium Grooming & Skin Formulations"
      : 'Clean Active Skincare & Dermaceuticals'
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
    /\b(pet|pets|dog|dogs|cat|cats|puppy|canine|feline|chews)\b/i.test(combinedText)
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

  // 4. Run NVIDIA NIM Discovery Synthesis in parallel with Meta Ads
  const systemPrompt = `You are the Principal Commerce Intelligence Architect for Nyxir CQI Diagnostics powered by NVIDIA Nemotron.
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

CRITICAL COMPETITOR MANDATE:
"competitors" MUST be 3 REAL, VERIFIABLE e-commerce brands and their real .com domains in the exact same sub-niche (for example, for beard/grooming brands: "Dr. Squatch" (drsquatch.com), "Manscaped" (manscaped.com), "Scotch Porter" (scotchporter.com); for apparel: "Vuori" (vuoriclothing.com), "Gymshark" (gymshark.com), "Lululemon" (lululemon.com); etc.). You are strictly forbidden from generating placeholder domains like *-leader.com or *-rival.com!

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

  // Run NVIDIA NIM and await Meta Ads in parallel
  const [nimSettled, adsSettled] = await Promise.allSettled([
    runQwenAgenticJson<QwenDiscoveryRaw>(systemPrompt, userPrompt, 25000),
    adsPromise,
  ])

  const qwenData = nimSettled.status === 'fulfilled' ? nimSettled.value.data : null

  const metaAds: MetaAdTelemetry =
    adsSettled.status === 'fulfilled'
      ? adsSettled.value
      : {
          activeAdCount: 0,
          videoAdSharePct: 0,
          staticAdSharePct: 0,
          discountCopySharePct: 0,
          ascConcentrationRiskPct: 0,
          evidence: 'BENCHMARK_ESTIMATED',
          adsVerified: false,
          adEvaluationNotice:
            'Evaluated via Current On-Site Pixel & Offer Posture (0 Public Ad Library Items Found)',
          evergreenAds90dPlusPct: 0,
          scalingAds30to90dPct: 0,
          testingAds7to30dPct: 0,
          freshLaunchesUnder7dPct: 0,
          oldestActiveAdDays: 0,
        }

  // Real Default Competitors (100% Real Domains)
  const defaultCompetitors = getRealSubNicheCompetitors(
    detectedVertical,
    subNicheName,
    pLadder.medianSkuPrice
  )

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

  // Process Competitors: Sanitize to prevent ANY fake domains from ever appearing
  let finalCompetitors = defaultCompetitors
  if (Array.isArray(qwenData?.discoveredFields?.competitors) && qwenData.discoveredFields.competitors.length >= 3) {
    const rawComps = qwenData.discoveredFields.competitors.slice(0, 3)
    const sanitizedComps: DiscoveredCompetitor[] = rawComps.map((c, i) => {
      const cleanCompDomain = (c.domain || '').toLowerCase().trim()
      if (
        !cleanCompDomain ||
        cleanCompDomain.includes('-leader') ||
        cleanCompDomain.includes('-rival') ||
        cleanCompDomain.includes('-value') ||
        cleanCompDomain.includes('placeholder') ||
        cleanCompDomain.includes('example.com')
      ) {
        return defaultCompetitors[i] || defaultCompetitors[0]
      }
      return {
        name: c.name || defaultCompetitors[i].name,
        domain: cleanCompDomain,
        estimatedAOV: Number(c.estimatedAOV) || defaultCompetitors[i].estimatedAOV,
        estimatedCAC: Number(c.estimatedCAC) || defaultCompetitors[i].estimatedCAC,
        cqiScore: Number(c.cqiScore) || defaultCompetitors[i].cqiScore,
        winningMechanism: c.winningMechanism || defaultCompetitors[i].winningMechanism,
      }
    })
    finalCompetitors = sanitizedComps
  }

  // Truthful Ad Spend Explanation (Never claim 32 active ads if unverified)
  const hasRealAds = metaAds.adsVerified && metaAds.activeAdCount > 0
  let adSpendExplanation = qwenData?.discoveredFields?.monthlyAdSpend?.sourceExplanation || ''
  if (!hasRealAds || adSpendExplanation.includes('active Meta ad') || adSpendExplanation.includes('32 active')) {
    adSpendExplanation = hasRealAds
      ? `Calibrated from ${metaAds.activeAdCount} active Meta ad creatives and industry MER benchmark`
      : `Derived from storefront catalog baseline ($${baseRevenue.toLocaleString()}/mo) and 2026 ${subNicheName} industry MER benchmark (${vBenchmark.healthyMER}x)`
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
    monthlyAdSpend: {
      foundOnline: hasRealAds,
      value: qwenData?.discoveredFields?.monthlyAdSpend?.value || baseAdSpend,
      rangeMin: qwenData?.discoveredFields?.monthlyAdSpend?.rangeMin || Math.round(baseAdSpend * 0.65),
      rangeMax: qwenData?.discoveredFields?.monthlyAdSpend?.rangeMax || Math.round(baseAdSpend * 1.35),
      confidence: hasRealAds ? 'MEDIUM' : 'ESTIMATED_FROM_STORE_SIGNALS',
      sourceExplanation: adSpendExplanation,
    },
    cogsPct: qwenData?.discoveredFields?.cogsPct || {
      value: vBenchmark.defaultCogsPct,
      sourceExplanation: `2026 ${subNicheName} Industry Report Benchmark (${vBenchmark.defaultCogsPct}%)`,
    },
    refundRatePct: qwenData?.discoveredFields?.refundRatePct || {
      value: vBenchmark.avgRefundRatePct,
      sourceExplanation: `2026 ${subNicheName} Industry Report Benchmark (${vBenchmark.avgRefundRatePct}%)`,
    },
    competitors: finalCompetitors,
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
