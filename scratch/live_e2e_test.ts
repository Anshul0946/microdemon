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
  runStep1StoreDiscovery,
  resolveActiveQwenOrGroqModel,
} from '../lib/data'
import { VERTICAL_BENCHMARKS } from '../lib/config/benchmarks'
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
  // TEST A: STRICT GATEKEEPER & GROQ MODEL RESOLUTION
  // ==========================================
  log('[TEST A] Running Strict Gatekeeper Check & Groq Model Discovery...')

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

  // Verify HTML entity decoding
  if (storeResult.storeTitle.includes('&amp;')) {
    throw new Error(`storeTitle contains raw &amp; instead of decoded entity: "${storeResult.storeTitle}"`)
  }
  log(`✓ Confirmed Shopify Storefront: domain=${storeResult.domain}, storeTitle="${storeResult.storeTitle}", SKUs=${storeResult.sampleProductCount}, medianPrice=$${storeResult.medianPrice}, currency=${storeResult.detectedCurrency}`)

  // 3. Groq Dynamic Model Resolution Check (Zero 404s)
  const groqKey = getGroqApiKey()
  if (groqKey) {
    const resolvedModel = await resolveActiveQwenOrGroqModel(groqKey)
    log(`✓ Confirmed Groq Model Discovery: activeModel="${resolvedModel}" (Zero HTTP 404 errors)`)
  } else {
    log('⚠️ Groq API Key not found; running with calibrated baseline.')
  }

  // ==========================================
  // TEST B: STEP 1 DISCOVERY ENGINE & AI PARSER
  // ==========================================
  log('\n[TEST B] Executing Step 1 Store Discovery & Google AI Mode Parser...')
  const targetDomain = 'allbirds.com'
  const discovery = await runStep1StoreDiscovery(targetDomain)

  log(`Discovery Result for ${targetDomain}:`)
  log(`- Auto-Detected Vertical: ${discovery.discoveredFields.vertical} (${discovery.discoveredFields.subNicheName})`)
  log(`- AI Presence Status: ${discovery.aiBrandAndCustomerProfile.aiPresenceStatus}`)
  log(`- Google AI Overview Summary: ${discovery.aiBrandAndCustomerProfile.googleAiOverviewSummary.slice(0, 180)}...`)
  log(`- Target Demographics: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.targetDemographics}`)
  log(`- Price Positioning: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.pricePositioning}`)
  log(`- Primary Buying Trigger: ${discovery.aiBrandAndCustomerProfile.customerBaseProfile.primaryBuyingTrigger}`)
  log(`- Scraped SKUs Sampled: ${discovery.skuAnalytics.totalProductsSampled} products (${discovery.skuAnalytics.bundleRatioPct}% bundles)`)
  log(`- Scraped Top SKUs with Roles: ${discovery.skuAnalytics.topSkus.length} items`)
  discovery.skuAnalytics.topSkus.slice(0, 3).forEach((sku) => {
    log(`  * [${sku.skuRole}] ${sku.title}: $${sku.price} (Variants: ${sku.variantCount})`)
  })
  log(`- 3 Dynamic Competitors Discovered:`)
  discovery.discoveredFields.competitors.forEach((comp, idx) => {
    log(`  ${idx + 1}) ${comp.name} (${comp.domain}) — CQI: ${comp.cqiScore}/100, AOV: $${comp.estimatedAOV}, Winning Mechanism: ${comp.winningMechanism}`)
  })
  log(`- 2026 Industry Report Benchmark AOV: $${discovery.discoveredFields.industryReport2026.benchmarkAOV}, Healthy MER: ${discovery.discoveredFields.industryReport2026.healthyMER}x`)

  // ==========================================
  // TEST C: FULL AUDIT PIPELINE WITH 4-SOURCE WATERFALL
  // ==========================================
  log('\n[TEST C] Compiling Full CQI Audit Pipeline & 4-Source Math Waterfall...')
  const vertical = discovery.discoveredFields.vertical
  const benchmark = VERTICAL_BENCHMARKS[vertical]

  const rawInputs: PrivateIntakeInputs = {
    vertical,
    monthlyRevenue: 120000, // Deliberate test value
    monthlyAdSpend: 10000,
    cogsPct: 36,
    refundRatePct: 22,
    revenueMode: 'CUSTOM_USER_OVERRIDE',
    adSpendMode: 'CUSTOM_USER_OVERRIDE',
  }

  const qualificationPulse = {
    agencyCount: '2–3 Agencies',
    primaryBottleneck: 'Meta Advantage+ dumping budget into 1–2 fatiguing ads',
    creativeWorkflow: 'Hybrid (Human Hooks + AI Edits)',
    ninetyDayTarget: 'Cut Blended CAC by 20–30%',
  }

  const [catalogSettled, techSettled, adsSettled, searchSettled] = await Promise.allSettled([
    scrapeShopifyCatalog(targetDomain),
    scanStoreTechStack(targetDomain),
    fetchMetaAdTelemetry(targetDomain, rawInputs.monthlyAdSpend),
    fetchGoogleSearchAndCheckScale(targetDomain, rawInputs.monthlyRevenue, rawInputs.monthlyAdSpend),
  ])

  const storefront = catalogSettled.status === 'fulfilled' ? catalogSettled.value : await scrapeShopifyCatalog(targetDomain)
  const techScan = techSettled.status === 'fulfilled' ? techSettled.value : await scanStoreTechStack(targetDomain)
  const metaAds = adsSettled.status === 'fulfilled' ? adsSettled.value : await fetchMetaAdTelemetry(targetDomain, rawInputs.monthlyAdSpend)
  const searchSummary = searchSettled.status === 'fulfilled' ? searchSettled.value : await fetchGoogleSearchAndCheckScale(targetDomain, rawInputs.monthlyRevenue, rawInputs.monthlyAdSpend)

  // Groq Universal Scale Assessment & Blunder Guard
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

  const calibratedInputs: PrivateIntakeInputs = {
    vertical,
    monthlyRevenue: realityCheck.overrideApplied ? realityCheck.calibratedMonthlyRevenue : rawInputs.monthlyRevenue,
    monthlyAdSpend: realityCheck.overrideApplied ? realityCheck.calibratedAdSpend : rawInputs.monthlyAdSpend,
    cogsPct: rawInputs.cogsPct,
    refundRatePct: rawInputs.refundRatePct,
    revenueMode: rawInputs.revenueMode,
    adSpendMode: rawInputs.adSpendMode,
  }

  const financials = computeFinancialMetrics(calibratedInputs, storefront, benchmark)
  const pillars = computePillarScores(calibratedInputs, financials, storefront, techScan, metaAds, benchmark, searchSummary.reviewSentimentScore)
  const masterCQIScore = computeMasterCQI(pillars)
  const { tier: customerQualityTier, description: tierDescription } = getCustomerQualityTier(masterCQIScore)
  const leaks = computeMarginLeaks(calibratedInputs, financials, pillars, storefront, techScan, benchmark)
  const totalRecoverableMonthlyMargin = leaks.reduce((sum, l) => sum + l.monthlyLossDollars, 0)
  const crossRelations = computeCrossRelations(financials, pillars, storefront, techScan, metaAds, benchmark, calibratedInputs.monthlyAdSpend)

  const aiBriefing = await synthesizeExecutiveBriefing(
    targetDomain,
    masterCQIScore,
    leaks[0]?.title || 'Ad Concentration Bleed',
    leaks[0]?.monthlyLossDollars || 25000,
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
    discovery.aiBrandAndCustomerProfile.aiPresenceStatus,
    qualificationPulse
  )

  const dataAuthenticityScore = computeDataAuthenticityScore(
    rawInputs,
    realityCheck.calibratedMonthlyRevenue,
    realityCheck.calibratedAdSpend
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
    skuAnalytics: storefront.skuAnalytics,
    aiBrandAndCustomerProfile: discovery.aiBrandAndCustomerProfile,
    discoveredFields: discovery.discoveredFields,
    fourSourceWaterfall,
    dataAuthenticityScore,
    createdAt: new Date().toISOString(),
  }

  log(`\nComputed Diagnostic Scores for ${targetDomain}:`)
  log(`- Master CQI Score: ${report.masterCQIScore}/100 (${report.customerQualityTier})`)
  log(`- Data Authenticity: ${dataAuthenticityScore.label} (${dataAuthenticityScore.scorePct}%)`)
  log(`- 4-Source Derived Gross Profit: $${fourSourceWaterfall.source4DerivedEstimations.grossProfitDollars.toLocaleString()}/mo`)
  log(`- 4-Source Net Contribution Cash: $${fourSourceWaterfall.source4DerivedEstimations.netContributionProfitDollars.toLocaleString()}/mo (${fourSourceWaterfall.source4DerivedEstimations.netContributionMarginPct}%)`)
  log(`- Implied Blended CAC: $${fourSourceWaterfall.source4DerivedEstimations.impliedBlendedCAC}`)
  log(`- 90-Day LTV: $${fourSourceWaterfall.source4DerivedEstimations.ninetyDayCustomerLTV}`)
  log(`- Total Recoverable Monthly Cash Bleed: -$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo`)

  // ==========================================
  // TEST D: VERIFY CHATGPT URL & PDF BINARY
  // ==========================================
  log('\n[TEST D] Verifying ChatGPT Pre-Fed URL & Executive PDF Generation...')

  const chatGptUrl = buildChatGptVerifyUrl(report)
  const fullPrompt = buildFullAuditPrompt(report)
  log(`ChatGPT URL generated: length=${chatGptUrl.length} characters (Limit: <3800 chars)`)
  log(`Full Audit Prompt sample:\n${fullPrompt.slice(0, 320)}...`)

  if (chatGptUrl.length >= 3800) {
    throw new Error(`ChatGPT URL length (${chatGptUrl.length}) exceeds 3800 char ceiling.`)
  }
  log('✓ Confirmed: ChatGPT URL length is well within safe browser limits.')

  const agencyBranding = 'Nyxir Commerce Advisory'
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
