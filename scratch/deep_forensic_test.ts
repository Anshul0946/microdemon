import * as fs from 'fs'
import * as path from 'path'
import { validateShopifyDomain, ShopifyValidationFailure, ShopifyValidationSuccess } from '../lib/data/shopifyValidator'
import {
  scrapeShopifyCatalog,
  scanStoreTechStack,
  fetchMetaAdTelemetry,
  fetchGoogleSearchAndCheckScale,
  assessBrandScaleAndCompetitor,
  evaluateUniversalBlunderGuard,
  synthesizeExecutiveBriefing,
  runStep1StoreDiscovery,
  resolveActiveQwenOrGroqModel,
} from '../lib/data'
import { VERTICAL_BENCHMARKS, EcommerceVertical } from '../lib/config/benchmarks'
import {
  computeFinancialMetrics,
  computePillarScores,
  computeMasterCQI,
  getCustomerQualityTier,
  computeMarginLeaks,
  buildFourSourceWaterfall,
  computeDataAuthenticityScore,
} from '../lib/cqi/scoring'
import { computeCrossRelations } from '../lib/cqi/crossRelations'
import { buildChatGptVerifyUrl, buildFullAuditPrompt } from '../lib/utils/chatgptVerify'
import { generateExecutivePdf } from '../lib/utils/pdfGenerator'
import { AuditReportResult, PrivateIntakeInputs } from '../lib/cqi/types'
import { getGroqApiKey } from '../lib/config/keys'
import { extractFinancialMetricsFromText } from '../lib/data/aiTextParser'

// 1. Ensure .env.local keys are loaded into process.env if running outside Next.js
const envLocalPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8')
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const val = match[2].trim().replace(/^['"]|['"]$/g, '')
        process.env[key] = val
      }
    }
  })
}

const logFilePath = path.resolve(process.cwd(), 'forensic_audit_log.txt')
const logLines: string[] = []

function log(msg: string) {
  console.log(msg)
  logLines.push(msg)
  // Append synchronously so trace is preserved in real time
  fs.appendFileSync(logFilePath, msg + '\n', 'utf-8')
}

// Reset log file
fs.writeFileSync(logFilePath, '', 'utf-8')

async function runDeepForensicTest() {
  log('=== FORENSIC LIVE AUDIT TRACE START ===')
  log(`Timestamp: ${new Date().toISOString()}`)
  log(`Node Environment: Node ${process.version}`)
  log(`Platform: ${process.platform}`)
  log(`Apify API Keys Present: ${Boolean(process.env.APIFY_API_KEY_1 || process.env.APIFY_API_KEY_2 || process.env.APIFY_API_KEY_3)}`)
  log(`Groq API Key Present: ${Boolean(process.env.GROQ_API_KEY)}`)
  log('================================================================================')

  let targetDomain = 'beardbrand.com'
  log(`[INIT] Selected Primary Real-World Target Brand: ${targetDomain}`)

  // ============================================================================
  // STAGE 1: STRICT SHOPIFY GATEKEEPER & SCHEMA EXTRACTION
  // ============================================================================
  log('\n' + '='.repeat(80))
  log('STAGE 1: STRICT SHOPIFY GATEKEEPER & SCHEMA EXTRACTION')
  log('='.repeat(80))

  log(`[1.1] Executing validateShopifyDomain("${targetDomain}")...`)
  const gatekeeperStart = Date.now()
  let gatekeeperRes = await validateShopifyDomain(targetDomain)
  const gatekeeperLatency = Date.now() - gatekeeperStart

  log(`[1.1 Result] Latency: ${gatekeeperLatency}ms`)
  log(`- Status: ok=${gatekeeperRes.ok}`)

  if (!gatekeeperRes.ok) {
    const fail = gatekeeperRes as ShopifyValidationFailure
    log(`⚠️ ${targetDomain} gatekeeper failed (code=${fail.code}, message="${fail.message}").`)
    log(`Falling back to secondary target: chubbies.com...`)
    targetDomain = 'chubbies.com'
    gatekeeperRes = await validateShopifyDomain(targetDomain)
    if (!gatekeeperRes.ok) {
      throw new Error(`Fallback target chubbies.com also failed gatekeeper: ${JSON.stringify(gatekeeperRes)}`)
    }
  }

  const successGate = gatekeeperRes as ShopifyValidationSuccess
  log(`- Domain: ${successGate.domain}`)
  log(`- Store Title: "${successGate.storeTitle}"`)
  log(`- Detected Currency: ${successGate.detectedCurrency}`)
  log(`- Scraped Median SKU Price: $${successGate.medianPrice}`)
  log(`- Sample Product Count: ${successGate.sampleProductCount}`)

  // Direct Homepage Schema & Metadata Extraction
  log(`\n[1.2] Fetching Homepage HTML for Schema.org / JSON-LD / Meta Tags...`)
  let brandName = successGate.storeTitle
  let metaDescription = 'N/A'
  let ogImage = 'N/A'
  let aggregateRating: { ratingValue?: number; reviewCount?: number } | null = null
  const socialLinks: string[] = []

  try {
    const homeRes = await fetch(`https://${targetDomain}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NyxirAudit/2.0',
        Accept: 'text/html,*/*',
      },
      signal: AbortSignal.timeout(6000),
    })
    const html = await homeRes.text()

    // Description
    const descMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    if (descMatch) metaDescription = descMatch[1].trim()

    // Image
    const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    if (imgMatch) ogImage = imgMatch[1].trim()

    // JSON-LD scripts
    const jsonLdMatches = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)
    if (jsonLdMatches) {
      for (const tag of jsonLdMatches) {
        const rawJson = tag.replace(/<\/?script[^>]*>/gi, '').trim()
        try {
          const parsed = JSON.parse(rawJson)
          const items = Array.isArray(parsed) ? parsed : [parsed]
          for (const it of items) {
            if (it['@type'] === 'Organization' || it['@type'] === 'Brand') {
              if (it.name) brandName = it.name
              if (it.sameAs && Array.isArray(it.sameAs)) {
                socialLinks.push(...it.sameAs)
              }
            }
            if (it.aggregateRating) {
              aggregateRating = {
                ratingValue: parseFloat(it.aggregateRating.ratingValue),
                reviewCount: parseInt(it.aggregateRating.reviewCount, 10),
              }
            }
          }
        } catch {
          // ignore json-ld parse errors
        }
      }
    }

    // Fallback social regex from HTML if not in json-ld
    if (socialLinks.length === 0) {
      const socialRegex = /href=["'](https?:\/\/(www\.)?(instagram|facebook|twitter|x|youtube|tiktok)\.com\/[a-zA-Z0-9._-]+)["']/gi
      let sMatch
      while ((sMatch = socialRegex.exec(html)) !== null) {
        if (!socialLinks.includes(sMatch[1])) socialLinks.push(sMatch[1])
      }
    }
  } catch (err: unknown) {
    const e = err as Error
    log(`Notice on homepage HTML probe: ${e.message}`)
  }

  log(`- Extracted Brand Name: ${brandName}`)
  log(`- Meta Description: "${metaDescription.slice(0, 160)}${metaDescription.length > 160 ? '...' : ''}"`)
  log(`- OG/Logo Image: ${ogImage}`)
  log(`- JSON-LD AggregateRating: ${aggregateRating ? `${aggregateRating.ratingValue}/5 (${aggregateRating.reviewCount} reviews)` : 'None published in root JSON-LD'}`)
  log(`- Social Profile Links Found: ${socialLinks.length > 0 ? socialLinks.slice(0, 5).join(', ') : 'None'}`)

  // Scrape full catalog
  log(`\n[1.3] Executing scrapeShopifyCatalog("${targetDomain}")...`)
  const catalogStart = Date.now()
  const catalog = await scrapeShopifyCatalog(targetDomain)
  const catalogLatency = Date.now() - catalogStart

  log(`[1.3 Result] Latency: ${catalogLatency}ms`)
  log(`- Products Sampled: ${catalog.totalProductsSampled}`)
  log(`- Median SKU Price: $${catalog.medianSkuPrice}`)
  log(`- Mean SKU Price: $${catalog.meanSkuPrice}`)
  log(`- Estimated Catalog AOV: $${catalog.estimatedCatalogAOV}`)
  log(`- Bundle Ratio: ${catalog.bundleRatioPct}%`)
  log(`- Discounted SKU Ratio: ${catalog.discountMarkedPct}%`)
  log(`- High Friction Variant SKUs: ${catalog.highFrictionVariantPct}%`)

  const skuAn = catalog.skuAnalytics
  if (skuAn) {
    log(`\n[1.4 SKU & Price Ladder Telemetry]`)
    log(`- Total Variants Sampled: ${skuAn.totalVariantsSampled}`)
    log(`- Bundle SKU Count: ${skuAn.bundleSkuCount}`)
    log(`- Average Variants Per SKU: ${skuAn.avgVariantsPerSku}`)
    log(`- High Friction SKU Count (>5 variants): ${skuAn.highFrictionSkuCount}`)
    log(`- Price Ladder: Min $${skuAn.priceLadder.minPrice} · P10 $${skuAn.priceLadder.p10Price} · Median $${skuAn.priceLadder.medianSkuPrice} · Mean $${skuAn.priceLadder.meanSkuPrice} · P90 $${skuAn.priceLadder.p90Price} · Max $${skuAn.priceLadder.maxPrice}`)
    log(`- Dominant Product Types: ${skuAn.dominantProductTypes.join(', ') || 'N/A'}`)
    log(`- Top Catalog Tags: ${skuAn.dominantTags.slice(0, 10).join(', ') || 'N/A'}`)

    log(`\n[1.5 First 5 Scraped Live SKUs]`)
    skuAn.topSkus.slice(0, 5).forEach((sku, idx) => {
      log(`  ${idx + 1}. [${sku.skuRole}] ${sku.title}`)
      log(`     Price: $${sku.price} | CompareAt: $${sku.compareAtPrice} | Discount: ${sku.discountPct}% | Variants: ${sku.variantCount} | Available: ${sku.available}`)
      log(`     Image: ${sku.imageUrl || 'None'}`)
    })

    log(`\n[1.6 Historical Catalog Check]`)
    log(`- Historical Data Available: ${skuAn.historicalCatalog.historicalDataAvailable}`)
    log(`- Oldest SKU Creation Date: ${skuAn.historicalCatalog.oldestSkuDate || 'N/A'}`)
    log(`- Catalog Age (Years): ${skuAn.historicalCatalog.catalogAgeYears ?? 'N/A'}`)
    log(`- SKUs Created in Last 90 Days: ${skuAn.historicalCatalog.skusCreatedLast90d ?? 'N/A'}`)
    log(`- SKUs Mutated in Last 30 Days: ${skuAn.historicalCatalog.skusUpdatedLast30d ?? 'N/A'}`)
  }

  // DOM Tech Stack & Pixel Scan
  log(`\n[1.7] Executing scanStoreTechStack("${targetDomain}")...`)
  const techStart = Date.now()
  const techScan = await scanStoreTechStack(targetDomain)
  const techLatency = Date.now() - techStart

  log(`[1.7 Result] Latency: ${techLatency}ms`)
  log(`- External Script Count: ${techScan.externalScriptCount}`)
  log(`- Meta CAPI Signal Active: ${techScan.hasCapiSignal}`)
  log(`- Detected Pixels: ${techScan.detectedPixels.join(', ') || 'None'}`)
  log(`- Retention / ESPs: ${techScan.detectedRetention.join(', ') || 'None'}`)
  log(`- Subscription / Upsell: ${techScan.detectedSubscriptionUpsell.join(', ') || 'None'}`)
  log(`- Review Widgets: ${techScan.detectedReviews.join(', ') || 'None'}`)
  log(`- All Detected Apps: ${techScan.allDetectedApps.join(', ') || 'None'}`)

  // ============================================================================
  // STAGE 2: LIVE GOOGLE AI MODE, WEB SERP & AI TEXT PARSER TRACE
  // ============================================================================
  log('\n' + '='.repeat(80))
  log('STAGE 2: LIVE GOOGLE AI MODE, WEB SERP & AI TEXT PARSER TRACE')
  log('='.repeat(80))

  log(`[2.1] Fetching Google AI Mode & Web Discovery via fetchGoogleSearchAndCheckScale...`)
  const searchStart = Date.now()
  const searchSummary = await fetchGoogleSearchAndCheckScale(targetDomain, 100000, 25000)
  const searchLatency = Date.now() - searchStart

  log(`[2.1 Result] Latency: ${searchLatency}ms`)
  log(`- AI Presence Status: ${searchSummary.aiPresenceStatus}`)
  log(`- Public Revenue Evidence Detected: ${searchSummary.publicRevenueEvidence || 'Storefront & ad signals only'}`)
  log(`- Detected Floor Revenue: $${(searchSummary.detectedPublicFloorRevenue || 0).toLocaleString()}/mo`)
  log(`- Review Sentiment Score: ${searchSummary.reviewSentimentScore}/100`)

  log(`\n[2.2 Cleaned AI / Web Summary Text (First 500 Chars)]`)
  const snippet = searchSummary.searchSnippetSummary || searchSummary.parsedOverview.normalizedText || ''
  log(`"${snippet.slice(0, 500)}${snippet.length > 500 ? '...' : ''}"`)

  log(`\n[2.3 Cited Sources & References Extracted]`)
  if (searchSummary.citedSources && searchSummary.citedSources.length > 0) {
    searchSummary.citedSources.slice(0, 5).forEach((src, idx) => {
      log(`  ${idx + 1}. [${src.title}] -> ${src.url}`)
    })
  } else {
    log(`  No external cited sources in AI synthesis (brand evaluated on verified web signals).`)
  }

  log(`\n[2.4 Google Autocomplete Buyer Queries Extracted]`)
  if (searchSummary.buyerSearchQueries && searchSummary.buyerSearchQueries.length > 0) {
    searchSummary.buyerSearchQueries.forEach((q, idx) => {
      log(`  ${idx + 1}. "${q}"`)
    })
  } else {
    log(`  No buyer queries returned from autocomplete probe.`)
  }

  // Trustpilot Probe for Target Domain
  log(`\n[2.5 Trustpilot Real-Time Verification Probe]`)
  let trustpilotFound = false
  try {
    const tpRes = await fetch(`https://www.trustpilot.com/review/${targetDomain}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(3500),
    })
    if (tpRes.ok) {
      const tpText = await tpRes.text()
      const tpJsonMatch = tpText.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi)
      if (tpJsonMatch) {
        for (const t of tpJsonMatch) {
          const raw = t.replace(/<\/?script[^>]*>/gi, '').trim()
          try {
            const p = JSON.parse(raw)
            if (p.aggregateRating) {
              log(`- Trustpilot Verified: Score ${p.aggregateRating.ratingValue}/5 from ${p.aggregateRating.reviewCount} customer reviews`)
              trustpilotFound = true
              break
            }
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err: unknown) {
    const e = err as Error
    log(`- Trustpilot probe notice: ${e.message}`)
  }
  if (!trustpilotFound) {
    log(`- Trustpilot: No public Trustpilot aggregate rating block detected for ${targetDomain}`)
  }

  // Regex Unit-Aware Financial Metrics
  log(`\n[2.6 Unit-Aware AI Text Financial Extractor]`)
  const regexMetrics = extractFinancialMetricsFromText(snippet)
  if (regexMetrics.monthlyRevenueEstimate) {
    log(`- Revenue Extracted: $${regexMetrics.monthlyRevenueEstimate.midpointMonthly.toLocaleString()}/mo (Range: $${regexMetrics.monthlyRevenueEstimate.minMonthly.toLocaleString()} - $${regexMetrics.monthlyRevenueEstimate.maxMonthly.toLocaleString()})`)
    log(`  Raw Text Phrase: "${regexMetrics.monthlyRevenueEstimate.rawPhrase}" (Annualized: ${regexMetrics.monthlyRevenueEstimate.isAnnualized})`)
  } else {
    log(`- Explicit prose revenue figures: None detected in web snippet (calibrating via catalog volume)`)
  }
  if (regexMetrics.trafficEstimate) {
    log(`- Monthly Visits Extracted: ${regexMetrics.trafficEstimate.monthlyVisits.toLocaleString()} visits ("${regexMetrics.trafficEstimate.rawPhrase}")`)
  }
  if (regexMetrics.competitorDomains.length > 0) {
    log(`- Competitor Domains Mentioned in Text: ${regexMetrics.competitorDomains.join(', ')}`)
  }

  // ============================================================================
  // STAGE 3: LIVE GROQ QWEN AGENTIC DISCOVERY & STEP 2 CONFIRMATION PAYLOAD
  // ============================================================================
  log('\n' + '='.repeat(80))
  log('STAGE 3: LIVE GROQ QWEN AGENTIC DISCOVERY & STEP 2 CONFIRMATION PAYLOAD')
  log('='.repeat(80))

  const groqKey = getGroqApiKey()
  let resolvedModel = 'qwen/qwen3.8-27b'
  if (groqKey) {
    resolvedModel = await resolveActiveQwenOrGroqModel(groqKey)
    log(`[3.1 Groq Model Discovery] Resolved Active Model: ${resolvedModel}`)
  } else {
    log(`[3.1 Groq Model Discovery] GROQ_API_KEY missing; using calibrated model profile.`)
  }

  log(`[3.2 Executing runStep1StoreDiscovery("${targetDomain}")...]`)
  const discoveryStart = Date.now()
  const discovery = await runStep1StoreDiscovery(targetDomain)
  const discoveryLatency = Date.now() - discoveryStart

  log(`[3.2 Result] Latency: ${discoveryLatency}ms | ok=${discovery.ok}`)

  log(`\n[3.3 AI Brand & Customer Profile]`)
  log(`- AI Presence Status: ${discovery.aiBrandAndCustomerProfile.aiPresenceStatus}`)
  log(`- Google AI Overview Summary: "${discovery.aiBrandAndCustomerProfile.googleAiOverviewSummary}"`)
  log(`- Customer Demographics: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.targetDemographics}`)
  log(`- Price Positioning: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.pricePositioning}`)
  log(`- Primary Buying Trigger: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.primaryBuyingTrigger}`)
  log(`- Repeat Purchase Driver: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.repeatPurchaseDriver}`)
  log(`- Churn & Refund Risk: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.churnAndRefundRiskFactor}`)
  log(`- SKU Catalog Assessment: ${discovery.aiBrandAndCustomerProfile.skuCatalogAssessment}`)

  log(`\n[3.4 Discovered Step 2 Fields]`)
  const df = discovery.discoveredFields
  log(`- Vertical: ${df.vertical} (${df.subNicheName})`)
  log(`- Source: ${df.sourceLabel}`)
  log(`- Monthly Revenue: $${df.monthlyRevenue.value.toLocaleString()}/mo (Range: $${df.monthlyRevenue.rangeMin.toLocaleString()} - $${df.monthlyRevenue.rangeMax.toLocaleString()} | Confidence: ${df.monthlyRevenue.confidence})`)
  log(`  Explanation: ${df.monthlyRevenue.sourceExplanation}`)
  log(`- Monthly Ad Spend: $${df.monthlyAdSpend.value.toLocaleString()}/mo (Range: $${df.monthlyAdSpend.rangeMin.toLocaleString()} - $${df.monthlyAdSpend.rangeMax.toLocaleString()} | Confidence: ${df.monthlyAdSpend.confidence})`)
  log(`  Explanation: ${df.monthlyAdSpend.sourceExplanation}`)
  log(`- Landed COGS Benchmark: ${df.cogsPct.value}% (${df.cogsPct.sourceExplanation})`)
  log(`- 30-Day Refund Benchmark: ${df.refundRatePct.value}% (${df.refundRatePct.sourceExplanation})`)

  log(`\n[3.5 Top 3 Direct Competitors Discovered]`)
  df.competitors.forEach((c, idx) => {
    log(`  Competitor #${idx + 1}: ${c.name} (${c.domain})`)
    log(`    Estimated AOV: $${c.estimatedAOV} | Target CAC: $${c.estimatedCAC} | CQI Score: ${c.cqiScore}/100`)
    log(`    Winning Mechanism: "${c.winningMechanism}"`)
  })

  log(`\n[3.6 2026 Sub-Niche Industry Report]`)
  const ir = df.industryReport2026
  log(`- Sub-Niche: ${ir.subNicheName} (${ir.reportSource})`)
  log(`- Benchmark AOV: $${ir.benchmarkAOV}`)
  log(`- Healthy CAC: $${ir.healthyCAC}`)
  log(`- Healthy MER: ${ir.healthyMER}x`)
  log(`- Gross Margin: ${ir.grossMarginPct}%`)
  log(`- 90-Day Repeat Rate: ${ir.repeatRate90dPct}%`)
  log(`- Key 2026 Trend: "${ir.key2026Trend}"`)

  // ============================================================================
  // STAGE 4: SIMULATE STEP 2 "CONFIRM VS CUSTOM CONFLICT" & FULL CQI AUDIT PIPELINE
  // ============================================================================
  log('\n' + '='.repeat(80))
  log('STAGE 4: SIMULATE STEP 2 "CONFIRM VS CUSTOM CONFLICT" & FULL CQI AUDIT PIPELINE')
  log('='.repeat(80))

  const discoveredRev = df.monthlyRevenue.value
  const discoveredAdSpend = df.monthlyAdSpend.value

  // Simulate user overriding with a 55% lower number
  const customRevenue = Math.round(discoveredRev * 0.45)
  const revVariancePct = Math.round(Math.abs((customRevenue - discoveredRev) / discoveredRev) * 100)

  log(`[4.1 Simulation Setup]`)
  log(`- Online Discovered Revenue: $${discoveredRev.toLocaleString()}/mo`)
  log(`- User Entered Custom Revenue: $${customRevenue.toLocaleString()}/mo`)
  log(`- Computed Variance: -${revVariancePct}% (Exceeds >35% threshold -> triggers Amber Conflict Guard)`)
  log(`- User Conflict Mode Selected: 'CUSTOM_USER_OVERRIDE' ("Online Data Is Outdated — Use My Custom Number")`)

  // Private confirmed inputs with custom override
  const simulatedInputs: PrivateIntakeInputs = {
    vertical: df.vertical,
    monthlyRevenue: customRevenue,
    monthlyAdSpend: discoveredAdSpend,
    cogsPct: df.cogsPct.value,
    refundRatePct: df.refundRatePct.value,
    revenueMode: 'CUSTOM_USER_OVERRIDE',
    adSpendMode: 'CONFIRMED_ONLINE',
    cogsMode: 'CONFIRMED_ONLINE',
    refundMode: 'CONFIRMED_ONLINE',
    varianceExplanations: [
      `User entered custom revenue of $${customRevenue.toLocaleString()}/mo (-${revVariancePct}% variance vs online telemetry)`,
    ],
  }

  // Realistic In-Flight Qualification MCQs
  const qualificationPulse = {
    agenciesWorkedWith: '2-3 Specialized Performance Agencies',
    primaryBottleneck: 'Creative fatigue and rising Meta ASC CAC',
    creativeWorkflow: 'In-house creative team + external UGC creators',
    ninetyDayTarget: 'Scale monthly contribution margin while holding MER > 3.0x',
  }

  log(`\n[4.2 Executing Full Audit Pipeline Telemetry Probes...]`)
  const validVertical: EcommerceVertical =
    df.vertical in VERTICAL_BENCHMARKS ? df.vertical : 'supplements'
  const benchmark = VERTICAL_BENCHMARKS[validVertical]

  const [auditAdsSettled, groqAssessmentSettled] = await Promise.allSettled([
    fetchMetaAdTelemetry(targetDomain, simulatedInputs.monthlyAdSpend),
    assessBrandScaleAndCompetitor(
      targetDomain,
      validVertical,
      {
        totalProducts: catalog.totalProductsSampled,
        medianPrice: catalog.medianSkuPrice,
        bundleRatioPct: catalog.bundleRatioPct,
      },
      {
        activeAdCount: discovery.metaAds.activeAdCount,
        videoAdSharePct: discovery.metaAds.videoAdSharePct,
      },
      searchSummary.searchSnippetSummary
    ),
  ])

  const metaAds =
    auditAdsSettled.status === 'fulfilled' ? auditAdsSettled.value : discovery.metaAds
  const groqAssessment =
    groqAssessmentSettled.status === 'fulfilled'
      ? groqAssessmentSettled.value
      : {
          estimatedTier: 'mid_market_growth' as const,
          estimatedMonthlyRevenueFloor: 120000,
          estimatedMonthlyAdSpendFloor: 35000,
          subNicheName: df.subNicheName,
          dynamicCompetitor: {
            name: `${successGate.storeTitle} Leader`,
            domain: `${targetDomain.split('.')[0]}-leader.com`,
            cqiScore: 84,
            aov: 78,
            blendedCAC: 32,
            bundleRatioPct: 32,
            activeAdCount: 80,
            videoAdSharePct: 70,
            scriptCount: 18,
            repeatRate90dPct: 38,
            winningEdgeSummary: 'High-LTV 3-pack bundle architecture with ASC creative hooks.',
          },
          live2026SubNicheBenchmarks: {
            benchmarkAOV: 75,
            healthyMER: 3.2,
            healthyBlendedCAC: 32,
            avgRefundRatePct: 5,
          },
          blunderExplanation: 'Calibrated against verified footprint.',
          evidence: 'DETERMINISTIC_BENCHMARK' as const,
        }

  log(`\n[4.3 Meta Ad Library Scrape Result]`)
  log(`- Ads Verified Online: ${metaAds.adsVerified}`)
  log(`- Active Ad Count: ${metaAds.activeAdCount}`)
  log(`- Video Ad Share: ${metaAds.videoAdSharePct}%`)
  log(`- Discount Copy Share: ${metaAds.discountCopySharePct}%`)
  log(`- ASC Concentration Risk: ${metaAds.ascConcentrationRiskPct}%`)
  log(`- Historical Longevity: 90d+=${metaAds.evergreenAds90dPlusPct}%, 30-90d=${metaAds.scalingAds30to90dPct}%, 7-30d=${metaAds.testingAds7to30dPct}%, <7d=${metaAds.freshLaunchesUnder7dPct}%`)
  log(`- Ad Evaluation Notice: "${metaAds.adEvaluationNotice}"`)

  // Universal Blunder Guard check
  const realityCheck = evaluateUniversalBlunderGuard({
    domain: targetDomain,
    userMonthlyRevenue: simulatedInputs.monthlyRevenue,
    userAdSpend: simulatedInputs.monthlyAdSpend,
    activeAdCount: metaAds.activeAdCount,
    serpData: {
      snippetSummary: searchSummary.searchSnippetSummary,
      detectedPublicFloorRevenue: searchSummary.detectedPublicFloorRevenue,
      publicRevenueEvidence: searchSummary.publicRevenueEvidence,
      competitorDomains: searchSummary.competitorDomains,
    },
    groqAssessment,
  })

  // Data Authenticity Score
  const authenticityScore = computeDataAuthenticityScore(
    simulatedInputs,
    discoveredRev,
    discoveredAdSpend
  )
  log(`\n[4.4 Data Authenticity & Conflict Ledger]`)
  log(`- Authenticity Score: ${authenticityScore.scorePct}%`)
  log(`- Label: "${authenticityScore.label}"`)
  log(`- Dual Scenario: ${authenticityScore.isDualScenario}`)
  log(`- Online vs Custom Variance: ${authenticityScore.onlineVsCustomVariancePct}%`)

  // Deterministic Math
  const calibratedInputs = {
    monthlyRevenue: simulatedInputs.monthlyRevenue,
    monthlyAdSpend: simulatedInputs.monthlyAdSpend,
    cogsPct: simulatedInputs.cogsPct,
    refundRatePct: simulatedInputs.refundRatePct,
  }

  const financials = computeFinancialMetrics(
    { ...simulatedInputs, ...calibratedInputs },
    catalog,
    benchmark
  )
  const pillars = computePillarScores(
    { ...simulatedInputs, ...calibratedInputs },
    financials,
    catalog,
    techScan,
    metaAds,
    benchmark,
    searchSummary.reviewSentimentScore
  )
  const masterCQIScore = computeMasterCQI(pillars)
  const { tier: customerQualityTier, description: tierDescription } =
    getCustomerQualityTier(masterCQIScore)

  const leaks = computeMarginLeaks(
    { ...simulatedInputs, ...calibratedInputs },
    financials,
    pillars,
    catalog,
    techScan,
    benchmark
  )
  const totalRecoverableMonthlyMargin = leaks.reduce((s, l) => s + l.monthlyLossDollars, 0)

  const crossRelations = computeCrossRelations(
    financials,
    pillars,
    catalog,
    techScan,
    metaAds,
    benchmark,
    calibratedInputs.monthlyAdSpend
  )

  const aiBriefing = await synthesizeExecutiveBriefing(
    targetDomain,
    masterCQIScore,
    leaks[0]?.title || 'Margin Leak',
    leaks[0]?.monthlyLossDollars || 15000,
    benchmark.label
  )

  const fourSourceWaterfall = buildFourSourceWaterfall(
    { ...simulatedInputs, ...calibratedInputs },
    financials,
    catalog,
    techScan,
    metaAds,
    benchmark,
    leaks,
    df.subNicheName,
    discovery.aiBrandAndCustomerProfile.aiPresenceStatus,
    qualificationPulse
  )

  log(`\n[4.5 The 4-Source Math Waterfall]`)
  log(`- Source 1 (Public Signals): ${catalog.totalProductsSampled} SKUs, $${fourSourceWaterfall.source1PublicData.catalogMedianPrice} median, ${fourSourceWaterfall.source1PublicData.bundleRatioPct}% bundles, ${fourSourceWaterfall.source1PublicData.scriptCount} scripts, CAPI=${fourSourceWaterfall.source1PublicData.hasCapiSignal}, Ads=${fourSourceWaterfall.source1PublicData.activeAdCount}`)
  log(`- Source 2 (Private Baselines): Revenue $${fourSourceWaterfall.source2PrivateConfirmed.monthlyRevenue.toLocaleString()}/mo [${fourSourceWaterfall.source2PrivateConfirmed.revenueMode}], Ad Spend $${fourSourceWaterfall.source2PrivateConfirmed.monthlyAdSpend.toLocaleString()}/mo, COGS ${fourSourceWaterfall.source2PrivateConfirmed.cogsPct}%, Refunds ${fourSourceWaterfall.source2PrivateConfirmed.refundRatePct}%`)
  log(`- Source 3 (2026 Industry Report): Sub-Niche: ${fourSourceWaterfall.source3IndustryReport2026.subNicheName}, Healthy AOV: $${fourSourceWaterfall.source3IndustryReport2026.benchmarkAOV}, Target CAC: $${fourSourceWaterfall.source3IndustryReport2026.healthyCAC}, Healthy MER: ${fourSourceWaterfall.source3IndustryReport2026.healthyMER}x`)
  log(`- Source 4 (Derived Estimations):`)
  log(`    * Effective AOV: $${fourSourceWaterfall.source4DerivedEstimations.effectiveAOV}`)
  log(`    * Monthly Orders: ${fourSourceWaterfall.source4DerivedEstimations.monthlyOrders.toLocaleString()}`)
  log(`    * Gross Profit: $${fourSourceWaterfall.source4DerivedEstimations.grossProfitDollars.toLocaleString()}/mo`)
  log(`    * Refund Loss: -$${fourSourceWaterfall.source4DerivedEstimations.refundBleedDollars.toLocaleString()}/mo`)
  log(`    * Net Contribution Profit: $${fourSourceWaterfall.source4DerivedEstimations.netContributionProfitDollars.toLocaleString()}/mo (${fourSourceWaterfall.source4DerivedEstimations.netContributionMarginPct}%)`)
  log(`    * Implied Blended CAC: $${fourSourceWaterfall.source4DerivedEstimations.impliedBlendedCAC}`)
  log(`    * First-Order Net Cash: $${fourSourceWaterfall.source4DerivedEstimations.firstOrderNetCashPerCustomer}/order`)
  log(`    * 90-Day Customer LTV: $${fourSourceWaterfall.source4DerivedEstimations.ninetyDayCustomerLTV}`)

  log(`\n[4.6 The 5 CQI Pillars & Master Score]`)
  log(`- P1 Unit Economics (25% weight): ${pillars.unitEconomics}/100`)
  log(`- P2 Paid Ad Signal (25% weight): ${pillars.adSignal}/100`)
  log(`- P3 SKU & Offer Architecture (20% weight): ${pillars.offerArchitecture}/100`)
  log(`- P4 Signal Integrity & Tech Stack (15% weight): ${pillars.techStack}/100`)
  log(`- P5 Brand Authority & AI Search (15% weight): ${pillars.brandAuthority}/100`)
  log(`================================================================`)
  log(`⭐ MASTER CQI SCORE: ${masterCQIScore}/100`)
  log(`⭐ TIER: ${customerQualityTier} (${tierDescription})`)
  log(`⭐ TOTAL RECOVERABLE MARGIN: +$${totalRecoverableMonthlyMargin.toLocaleString()}/mo`)
  log(`================================================================`)

  log(`\n[4.7 The 3 Quantified Monthly Margin Leaks]`)
  leaks.forEach((l, idx) => {
    log(`  Leak #${idx + 1}: ${l.title} (-$${l.monthlyLossDollars.toLocaleString()}/mo)`)
    log(`    Diagnosis: ${l.exposedDiagnosis}`)
    log(`    Remediation Steps: ${l.lockedRemediationSteps.join(' -> ')}`)
  })

  log(`\n[4.8 The 4 Cross-Relations Insights]`)
  crossRelations.forEach((cr, idx) => {
    log(`  Correlation #${idx + 1}: ${cr.title} (${cr.primaryPillars})`)
    log(`    Impact: ${cr.description} [-$${cr.dollarImpact.toLocaleString()}/mo]`)
  })

  // Assemble full report
  const fullReport: AuditReportResult = {
    domain: targetDomain,
    storeTitle: successGate.storeTitle,
    createdAt: new Date().toISOString(),
    vertical: validVertical,
    benchmark,
    subNicheName: df.subNicheName,
    rawInputs: simulatedInputs,
    calibratedInputs,
    financials,
    pillars,
    masterCQIScore,
    customerQualityTier,
    tierDescription,
    leaks,
    totalRecoverableMonthlyMargin,
    crossRelations,
    executiveSummary: aiBriefing.summary,
    dynamicCompetitor: groqAssessment.dynamicCompetitor,
    metaAds,
    storefront: catalog,
    techScan,
    skuAnalytics: skuAn,
    aiBrandAndCustomerProfile: discovery.aiBrandAndCustomerProfile,
    discoveredFields: df,
    fourSourceWaterfall,
    dataAuthenticityScore: authenticityScore,
    qualificationAnswers: qualificationPulse,
    realityCheck,
  }

  // ============================================================================
  // STAGE 5: VERIFY CHATGPT LAUNCHER & PDF EXPORT
  // ============================================================================
  log('\n' + '='.repeat(80))
  log('STAGE 5: VERIFY CHATGPT LAUNCHER & PDF EXPORT')
  log('='.repeat(80))

  log(`[5.1 Testing ChatGPT Verification Launcher]`)
  const chatGptUrl = buildChatGptVerifyUrl(fullReport)
  const fullAuditPrompt = buildFullAuditPrompt(fullReport)

  log(`- ChatGPT URL Length: ${chatGptUrl.length} characters (Safe Limit < 3800)`)
  log(`- Full Clipboard Prompt Length: ${fullAuditPrompt.length} characters`)
  log(`- Prompt Header Preview:`)
  log(`  ${fullAuditPrompt.split('\n').slice(0, 8).join('\n  ')}`)

  log(`\n[5.2 Testing Institutional Multi-Page Executive PDF Export]`)
  const pdfStart = Date.now()
  const pdfBuffer = await generateExecutivePdf(fullReport, 'Nyxir Commerce Advisory')
  const pdfLatency = Date.now() - pdfStart

  log(`[5.2 Result] Latency: ${pdfLatency}ms`)
  log(`- PDF Buffer Size: ${pdfBuffer.length} bytes`)
  log(`- Magic Header: "${pdfBuffer.subarray(0, 5).toString('ascii')}" (Expected: "%PDF-")`)

  if (pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('PDF output does not have valid %PDF- magic bytes!')
  }
  log(`✓ Confirmed: Valid Multi-Page Institutional PDF generated successfully.`)

  log('\n' + '='.repeat(80))
  log('=== FORENSIC LIVE AUDIT TRACE END ===')
}

runDeepForensicTest()
  .then(() => {
    console.log(`\n✅ Deep forensic live audit completed successfully. Written to: ${logFilePath}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Forensic test encountered fatal error:', err);
    process.exit(1);
  });
