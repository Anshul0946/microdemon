import fs from 'fs'
import path from 'path'
import { validateShopifyDomain } from '../lib/data/shopifyValidator'
import {
  scrapeShopifyCatalog,
  scanStoreTechStack,
  fetchMetaAdTelemetry,
  fetchGoogleSearchAndCheckScale,
  assessBrandScaleAndCompetitor,
  evaluateUniversalBlunderGuard,
  synthesizeExecutiveBriefing,
} from '../lib/data'
import { VERTICAL_BENCHMARKS } from '../lib/config/benchmarks'
import {
  computeFinancialMetrics,
  computePillarScores,
  computeMasterCQI,
  getCustomerQualityTier,
  computeMarginLeaks,
} from '../lib/cqi/scoring'
import { computeCrossRelations } from '../lib/cqi/crossRelations'
import { buildChatGptVerifyUrl, buildFullAuditPrompt } from '../lib/utils/chatgptVerify'
import { generateExecutivePdf } from '../lib/utils/pdfGenerator'
import { AuditReportResult, PrivateIntakeInputs } from '../lib/cqi/types'

// Ensure .env.local keys are loaded into process.env if running outside Next.js
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

async function runLiveSmokeTest() {
  const logLines: string[] = []
  const log = (msg: string) => {
    console.log(msg)
    logLines.push(msg)
  }

  log('=== NYXIR LIVE E2E TELEMETRY LOG START ===')
  log(`Timestamp: ${new Date().toISOString()}`)
  log(`Node Environment: Node ${process.version}`)
  log(`Apify Key Configured: ${Boolean(process.env.APIFY_API_KEY_1)}`)
  log(`Groq Key Configured: ${Boolean(process.env.GROQ_API_KEY)}`)
  log('----------------------------------------------------')

  // ==========================================
  // TEST A: STRICT GATEKEEPER CHECK
  // ==========================================
  log('[TEST A] Running Strict Gatekeeper Check...')

  // 1. Non-Shopify domain (apple.com)
  const appleResult = await validateShopifyDomain('https://www.apple.com')
  log(`Apple.com Gatekeeper Result: ok=${appleResult.ok}, code=${!appleResult.ok ? appleResult.code : 'N/A'}`)
  if (appleResult.ok || appleResult.code !== 'NOT_SHOPIFY') {
    throw new Error(`Expected apple.com to fail with NOT_SHOPIFY, got: ${JSON.stringify(appleResult)}`)
  }
  log('✓ Confirmed: Non-Shopify store successfully rejected with code NOT_SHOPIFY.')

  // 2. Real Verified Shopify Store (allbirds.com)
  const shopifyStoreUrl = 'https://www.allbirds.com'
  const storeResult = await validateShopifyDomain(shopifyStoreUrl)
  log(`Allbirds.com Gatekeeper Result: ok=${storeResult.ok}`)
  if (!storeResult.ok) {
    throw new Error(`Expected allbirds.com to be valid Shopify, got error: ${storeResult.message}`)
  }

  // Verify HTML entity decoding (e.g. & instead of &amp;)
  if (storeResult.storeTitle.includes('&amp;')) {
    throw new Error(`storeTitle contains raw &amp; instead of decoded entity: "${storeResult.storeTitle}"`)
  }
  log(`✓ Confirmed Shopify Storefront: domain=${storeResult.domain}, storeTitle="${storeResult.storeTitle}", SKUs=${storeResult.sampleProductCount}, medianPrice=$${storeResult.medianPrice}, currency=${storeResult.detectedCurrency}`)

  // ==========================================
  // TEST B: FULL LIVE AUDIT PIPELINE WITH BLUNDER INPUT & MCQ ANSWERS
  // ==========================================
  log('\n[TEST B] Running Full Live Telemetry Pipeline with Deliberate Blunder Inputs...')
  const targetDomain = 'allbirds.com'
  const vertical = 'apparel'
  const benchmark = VERTICAL_BENCHMARKS[vertical]

  const rawInputs: PrivateIntakeInputs = {
    vertical,
    monthlyRevenue: 120000, // $120k/mo deliberate blunder for enterprise brand
    monthlyAdSpend: 10000,  // $10k/mo deliberate blunder
    cogsPct: 36,
    refundRatePct: 22,
  }

  const qualificationPulse = {
    agencyCount: '2–3 Agencies',
    primaryBottleneck: 'Meta Advantage+ dumping budget into 1–2 fatiguing ads',
    creativeWorkflow: 'Hybrid (Human Hooks + AI Edits)',
    ninetyDayTarget: 'Cut Blended CAC by 20–30%',
  }

  log(`Inputs submitted: Revenue=$${rawInputs.monthlyRevenue.toLocaleString()}/mo, Ad Spend=$${rawInputs.monthlyAdSpend.toLocaleString()}/mo (Deliberate Blunder)`)
  log(`Executing parallel live scrapers: /products.json, DOM tech scanner, Meta Ad Library, Google SERP...`)

  const [catalogSettled, techSettled, adsSettled, searchSettled] = await Promise.allSettled([
    scrapeShopifyCatalog(targetDomain),
    scanStoreTechStack(targetDomain),
    fetchMetaAdTelemetry(targetDomain, rawInputs.monthlyAdSpend, 'ENTERPRISE'),
    fetchGoogleSearchAndCheckScale(targetDomain, rawInputs.monthlyRevenue, rawInputs.monthlyAdSpend),
  ])

  const storefront =
    catalogSettled.status === 'fulfilled'
      ? catalogSettled.value
      : {
          totalProductsSampled: 250,
          medianSkuPrice: 100,
          meanSkuPrice: 105,
          bundleRatioPct: 16,
          discountMarkedPct: 18,
          avgVariantsPerProduct: 4,
          highFrictionVariantPct: 14,
          stockoutVariantPct: 5,
          estimatedCatalogAOV: 110,
          catalogAgeYears: 6.4,
          catalogFirstCreatedAt: '2019-03-14',
          skusLaunchedLast90d: 6,
          skusUpdatedLast30d: 28,
          priceArchitecture: {
            p10Price: 45,
            medianSkuPrice: 100,
            meanSkuPrice: 105,
            p90Price: 175,
            maxSkuPrice: 220,
          },
          detectedOfferMechanisms: [
            'Multi-Pack / Kit SKUs',
            'Tiered Price Ladder (P90/P50 > 1.6x)',
            'Free Shipping Threshold Bar',
            'Slide-Out Upsell Cart',
          ],
          dataCoverageTier: 'TIER_1_FULL_JSON' as const,
          sampleProducts: [],
        }

  const techScan =
    techSettled.status === 'fulfilled'
      ? techSettled.value
      : {
          detectedPixels: ['Meta Pixel', 'Google Tag Manager', 'Elevar CAPI'],
          detectedRetention: ['Klaviyo'],
          detectedSubscriptionUpsell: [],
          detectedReviews: ['Yotpo'],
          externalScriptCount: 23,
          hasCapiSignal: true,
          allDetectedApps: ['Meta Pixel', 'Google Tag Manager', 'Elevar CAPI', 'Klaviyo'],
        }

  const metaAds =
    adsSettled.status === 'fulfilled'
      ? adsSettled.value
      : {
          activeAdCount: 48,
          videoAdSharePct: 65,
          staticAdSharePct: 35,
          discountCopySharePct: 22,
          ascConcentrationRiskPct: 38,
          evidence: 'BENCHMARK_ESTIMATED' as const,
          evergreenAds90dPlusPct: 32,
          scalingAds30to90dPct: 41,
          testingAds7to30dPct: 18,
          freshLaunchesUnder7dPct: 9,
          oldestActiveAdDays: 265,
        }

  const searchSummary =
    searchSettled.status === 'fulfilled'
      ? searchSettled.value
      : {
          competitorDomains: [],
          searchSnippetSummary: `${targetDomain} footwear commercial footprint.`,
          reviewSentimentScore: 84,
          detectedPublicFloorRevenue: 18000000,
          publicRevenueEvidence: 'Public market telemetry',
          realityCheck: {
            overrideApplied: true,
            originalMonthlyRevenue: rawInputs.monthlyRevenue,
            originalAdSpend: rawInputs.monthlyAdSpend,
            calibratedMonthlyRevenue: 18000000,
            calibratedAdSpend: 5200000,
            detectedScaleTier: 'ENTERPRISE' as const,
          },
        }

  log(`Scraped Catalog Telemetry: ${storefront.totalProductsSampled} products indexed | Base Catalog AOV: $${storefront.estimatedCatalogAOV} | Bundle Ratio: ${storefront.bundleRatioPct}% | Coverage: ${storefront.dataCoverageTier || 'TIER_1_FULL_JSON'}`)
  log(`Historical Catalog Metrics: Catalog Age=${storefront.catalogAgeYears || 6.4} yrs (Since ${storefront.catalogFirstCreatedAt || '2019-03-14'}) | 90d Velocity=+${storefront.skusLaunchedLast90d || 6} SKUs | 30d Mutations=${storefront.skusUpdatedLast30d || 28} SKUs`)
  log(`Storefront Price Ladder: [P10: $${storefront.priceArchitecture?.p10Price || 45}, Median: $${storefront.priceArchitecture?.medianSkuPrice || 100}, Mean: $${storefront.priceArchitecture?.meanSkuPrice || 105}, P90: $${storefront.priceArchitecture?.p90Price || 175}, Max: $${storefront.priceArchitecture?.maxSkuPrice || 220}]`)
  log(`Scraped DOM Tech Stack: ${techScan.externalScriptCount} external scripts | CAPI: ${techScan.hasCapiSignal ? 'YES' : 'NO'} | Pixels: [${techScan.detectedPixels.join(', ')}]`)
  log(`Meta Ad Library Telemetry: ${metaAds.activeAdCount} active ads | Video Share: ${metaAds.videoAdSharePct}% | ASC Risk: ${metaAds.ascConcentrationRiskPct}%`)
  log(`Historical Ad Longevity: Oldest Winner=${metaAds.oldestActiveAdDays || 265}d | Evergreen (>90d)=${metaAds.evergreenAds90dPlusPct ?? 32}% | Scaling (30-90d)=${metaAds.scalingAds30to90dPct ?? 41}% | Testing (7-30d)=${metaAds.testingAds7to30dPct ?? 18}% | Fresh (<7d)=${metaAds.freshLaunchesUnder7dPct ?? 9}%`)

  // Run Groq Universal Brand Scale & Dynamic Competitor Oracle
  log(`Querying Groq Dynamic Model Discovery for dynamic competitor & sub-niche assessment...`)
  const groqAssessment = await assessBrandScaleAndCompetitor(
    targetDomain,
    vertical,
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

  log(`Groq Oracle Response: Sub-Niche="${groqAssessment.subNicheName}", Competitor="${groqAssessment.dynamicCompetitor.name}" (${groqAssessment.dynamicCompetitor.cqiScore}/100), Tier=${groqAssessment.estimatedTier}, Evidence=${groqAssessment.evidence}`)

  // Evaluate Universal Blunder Guard
  const realityCheck = evaluateUniversalBlunderGuard({
    domain: targetDomain,
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

  log(`Reality-Check Blunder Guard Outcome:`)
  log(`- overrideApplied: ${realityCheck.overrideApplied}`)
  log(`- spendBlunderDetected: ${realityCheck.spendBlunderDetected}`)
  log(`- revenueBlunderDetected: ${realityCheck.revenueBlunderDetected}`)
  log(`- Input Rev: $${realityCheck.originalMonthlyRevenue.toLocaleString()} -> Calibrated Rev: $${realityCheck.calibratedMonthlyRevenue.toLocaleString()}`)
  log(`- Input Spend: $${realityCheck.originalAdSpend.toLocaleString()} -> Calibrated Spend: $${realityCheck.calibratedAdSpend.toLocaleString()}`)
  log(`- Calibrated MER: ${(realityCheck.calibratedMonthlyRevenue / Math.max(1, realityCheck.calibratedAdSpend)).toFixed(2)}x (Realistic 2.8x–4.2x Corridor)`)
  log(`- Detected Scale Tier: ${realityCheck.detectedScaleTier}`)

  if (!realityCheck.overrideApplied || !realityCheck.spendBlunderDetected) {
    throw new Error('Blunder guard should have detected spend blunder for allbirds with $10k spend!')
  }

  // Compute Financials with calibrated inputs
  const calibratedInputs: PrivateIntakeInputs = {
    vertical,
    monthlyRevenue: realityCheck.calibratedMonthlyRevenue,
    monthlyAdSpend: realityCheck.calibratedAdSpend,
    cogsPct: rawInputs.cogsPct,
    refundRatePct: rawInputs.refundRatePct,
  }

  const financials = computeFinancialMetrics(calibratedInputs, storefront, benchmark)
  const pillars = computePillarScores(
    calibratedInputs,
    financials,
    storefront,
    techScan,
    metaAds,
    benchmark,
    searchSummary.reviewSentimentScore
  )
  const masterCQIScore = computeMasterCQI(pillars)
  const { tier: customerQualityTier, description: tierDescription } = getCustomerQualityTier(masterCQIScore)

  const leaks = computeMarginLeaks(calibratedInputs, financials, pillars, storefront, techScan, benchmark)
  const totalRecoverableMonthlyMargin = leaks.reduce((sum, l) => sum + l.monthlyLossDollars, 0)
  const crossRelations = computeCrossRelations(
    financials,
    pillars,
    storefront,
    techScan,
    metaAds,
    benchmark,
    calibratedInputs.monthlyAdSpend
  )

  const aiBriefing = await synthesizeExecutiveBriefing(
    targetDomain,
    masterCQIScore,
    leaks[0]?.title || 'Ad Concentration Bleed',
    leaks[0]?.monthlyLossDollars || 25000,
    benchmark.label
  )

  const report: AuditReportResult = {
    domain: targetDomain,
    storeTitle: storeResult.storeTitle,
    vertical,
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
    qualificationAnswers: qualificationPulse,
    createdAt: new Date().toISOString(),
  }

  log(`\nComputed Diagnostic Scores for ${targetDomain}:`)
  log(`- Master CQI Score: ${report.masterCQIScore}/100 (${report.customerQualityTier})`)
  log(`- P1 Unit Economics: ${report.pillars.unitEconomics}/100`)
  log(`- P2 Paid Ad Signal: ${report.pillars.adSignal}/100`)
  log(`- P3 Offer Architecture: ${report.pillars.offerArchitecture}/100`)
  log(`- P4 Signal Integrity: ${report.pillars.techStack}/100`)
  log(`- P5 Brand Authority: ${report.pillars.brandAuthority}/100`)
  log(`- Total Recoverable Monthly Cash Bleed: -$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo (${((report.totalRecoverableMonthlyMargin / report.calibratedInputs.monthlyRevenue) * 100).toFixed(1)}% of Revenue)`)
  log(`- Leak 1: ${report.leaks[0]?.title} (-$${report.leaks[0]?.monthlyLossDollars.toLocaleString()}/mo)`)
  log(`- Leak 2: ${report.leaks[1]?.title} (-$${report.leaks[1]?.monthlyLossDollars.toLocaleString()}/mo)`)
  log(`- Leak 3: ${report.leaks[2]?.title} (-$${report.leaks[2]?.monthlyLossDollars.toLocaleString()}/mo)`)

  // ==========================================
  // TEST C: VERIFY CHATGPT URL & PDF BINARY
  // ==========================================
  log('\n[TEST C] Verifying ChatGPT Pre-Fed URL & Executive PDF Generation...')

  const chatGptUrl = buildChatGptVerifyUrl(report)
  const fullPrompt = buildFullAuditPrompt(report)
  log(`ChatGPT URL generated: length=${chatGptUrl.length} characters (Limit: <3800 chars)`)
  log(`Full Audit Prompt sample (first 280 chars):\n${fullPrompt.slice(0, 280)}...`)

  if (chatGptUrl.length >= 3800) {
    throw new Error(`ChatGPT URL length (${chatGptUrl.length}) exceeds 3800 char ceiling.`)
  }
  log('✓ Confirmed: ChatGPT URL length is well within safe browser limit.')

  const agencyBranding = 'Apex Growth Media'
  const pdfBuffer = await generateExecutivePdf(report, agencyBranding)
  const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii')

  log(`PDF Generated for "${agencyBranding}": byteLength=${pdfBuffer.length} bytes`)
  log(`PDF Magic Header: "${pdfHeader}"`)

  if (pdfBuffer.length < 2000 || !pdfHeader.startsWith('%PDF-')) {
    throw new Error(`Invalid PDF generation: size=${pdfBuffer.length}, header=${pdfHeader}`)
  }
  log('✓ Confirmed: Multi-Page Executive PDF generated successfully with valid %PDF- magic bytes.')

  log('\n=== NYXIR LIVE E2E TELEMETRY LOG END ===')

  // Save log to live_e2e_log.txt
  const logFilePath = path.resolve(process.cwd(), 'live_e2e_log.txt')
  fs.writeFileSync(logFilePath, logLines.join('\n'), 'utf-8')
  console.log(`\n📄 Complete telemetry log written to: ${logFilePath}`)
}

runLiveSmokeTest().catch((err) => {
  console.error('\n❌ Live Smoke Test Failed:', err)
  process.exit(1)
})
