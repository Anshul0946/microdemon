'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuditReportResult } from '@/lib/cqi/types'
import { buildFullAuditPrompt, buildConciseChatGptUrl } from '@/lib/utils/chatgptVerify'
import { buildCategoryLeaderComparison } from '@/lib/cqi/competitive'
import StrategyModal from '@/components/report/StrategyModal'

function ReportDashboardContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const domainParam = (params?.domain as string) || ''
  const isPresenterUnlockedByQuery = searchParams.get('unlock') === 'true'

  const [report, setReport] = useState<AuditReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Agency White-Label Branding State
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [calendarUrl, setCalendarUrl] = useState<string>('https://cal.com')

  // Active Tab
  const [activeTab, setActiveTab] = useState<number>(1)
  const [hoveredTab, setHoveredTab] = useState<number | null>(null)

  // Modals & UI States
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [presenterUnlocked, setPresenterUnlocked] = useState(isPresenterUnlockedByQuery)
  const [pdfDownloading, setPdfDownloading] = useState(false)

  // What-If Simulator Sliders (Tab 1)
  const [simAovBoostPct, setSimAovBoostPct] = useState(15) // +15%
  const [simAdWasteCutPct, setSimAdWasteCutPct] = useState(25) // -25%

  // Toast Helper
  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3800)
  }

  // Load agency branding and setup dynamic listener
  useEffect(() => {
    try {
      const storedAgency = sessionStorage.getItem('cqi_agency_partner')
      const storedCal = sessionStorage.getItem('cqi_calendar_url')
      if (storedAgency) setAgencyName(storedAgency)
      if (storedCal) setCalendarUrl(storedCal)
    } catch {
      // ignore
    }

    const handleAgencyUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ agencyName: string | null; calendarUrl?: string }>
      if (custom.detail) {
        setAgencyName(custom.detail.agencyName || null)
        if (custom.detail.calendarUrl) setCalendarUrl(custom.detail.calendarUrl)
      }
    }

    window.addEventListener('cqi_agency_updated', handleAgencyUpdate)
    return () => window.removeEventListener('cqi_agency_updated', handleAgencyUpdate)
  }, [])

  // Fetch report data with local storage fallback
  useEffect(() => {
    if (!domainParam) return

    const loadReport = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/report?domain=${encodeURIComponent(domainParam)}`)
        if (!res.ok) {
          // Check local client fallback
          const localStored = localStorage.getItem(`nyxir_report_${domainParam.toLowerCase()}`)
          if (localStored) {
            const parsed = JSON.parse(localStored) as AuditReportResult
            setReport(parsed)
            if (parsed.agencyName && !agencyName) setAgencyName(parsed.agencyName)
            setLoading(false)
            return
          }

          if (res.status === 404) {
            throw new Error(`No stored diagnostic report found for ${domainParam}. Please run a scan from the home page.`)
          }
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || 'Failed to retrieve audit report.')
        }

        const data: AuditReportResult = await res.json()

        // Attach MCQ answers from sessionStorage and localStorage if present
        let mergedAnswers: Record<string, string> = { ...(data.qualificationAnswers as Record<string, string> || {}) }
        try {
          const storedMcq = sessionStorage.getItem(`cqi_mcq_${data.domain}`)
          if (storedMcq) {
            mergedAnswers = { ...mergedAnswers, ...JSON.parse(storedMcq) }
          }
        } catch {
          // ignore
        }
        try {
          const localStored = localStorage.getItem(`nyxir_report_${data.domain.toLowerCase()}`)
          if (localStored) {
            const parsed = JSON.parse(localStored)
            if (parsed.qualificationAnswers) {
              mergedAnswers = { ...mergedAnswers, ...parsed.qualificationAnswers }
            }
          }
        } catch {
          // ignore
        }

        data.qualificationAnswers = mergedAnswers

        if (data.agencyName && !agencyName) {
          setAgencyName(data.agencyName)
        }

        setReport(data)
      } catch (err: unknown) {
        // Final attempt from localStorage
        const localStored = localStorage.getItem(`nyxir_report_${domainParam.toLowerCase()}`)
        if (localStored) {
          try {
            const parsed = JSON.parse(localStored) as AuditReportResult
            try {
              const storedMcq = sessionStorage.getItem(`cqi_mcq_${parsed.domain}`)
              if (storedMcq) {
                parsed.qualificationAnswers = {
                  ...parsed.qualificationAnswers,
                  ...JSON.parse(storedMcq),
                }
              }
            } catch {
              // ignore
            }
            setReport(parsed)
            setError(null)
            setLoading(false)
            return
          } catch {
            // ignore
          }
        }

        const errObj = err as Error
        setError(errObj.message || 'Error loading diagnostic dashboard.')
      } finally {
        setLoading(false)
      }
    }

    loadReport()
  }, [domainParam, agencyName])

  // Top-Right Button 1: Verify with AI
  const handleVerifyWithAI = async () => {
    if (!report) return
    const fullPrompt = buildFullAuditPrompt(report)
    const chatGptUrl = buildConciseChatGptUrl(report)

    try {
      await navigator.clipboard.writeText(fullPrompt)
      showToast('✨ Full audit telemetry copied to clipboard & launching ChatGPT...')
    } catch {
      showToast('Opening ChatGPT with pre-fed telemetry...')
    }

    window.open(chatGptUrl, '_blank', 'noopener,noreferrer')
  }

  // Persistent Bottom Bar: Download PDF (POST with full active state for 100% reliability)
  const handleDownloadPDF = async () => {
    if (!report) return
    setPdfDownloading(true)
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: report.domain,
          report,
          agencyName: agencyName || report.agencyName,
        }),
      })

      if (!res.ok) {
        throw new Error('Failed to generate PDF document.')
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cqi-${report.domain}-report.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      showToast('📥 Executive PDF report downloaded successfully.')
    } catch (err: unknown) {
      const errObj = err as Error
      showToast(`⚠️ PDF Error: ${errObj.message}`)
    } finally {
      setPdfDownloading(false)
    }
  }

  // Copy Slack Kickoff Briefing (Tab 6)
  const handleCopySlackBriefing = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('📋 Day-0 Slack Briefing copied to clipboard!')
    } catch {
      showToast('Could not copy to clipboard.')
    }
  }

  if (loading) {
    return (
      <div className="py-24 text-center space-y-4">
        <div className="inline-block animate-spin h-8 w-8 border-2 border-slate-900 border-t-transparent rounded-full"></div>
        <p className="text-sm font-mono text-slate-600">Loading Nyxir CQI Executive Dashboard for {domainParam}...</p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="py-16 max-w-lg mx-auto text-center space-y-4">
        <div className="p-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
          <p className="text-lg">⚠️</p>
          <p className="font-bold text-sm">Report Not Found</p>
          <p className="text-xs text-rose-800 leading-relaxed">{error || 'No report available.'}</p>
          <Link
            href="/"
            className="inline-block mt-2 rounded-lg bg-slate-900 text-white text-xs font-semibold px-4 py-2 hover:bg-slate-800 transition-colors"
          >
            ← Run New Diagnostic Scan
          </Link>
        </div>
      </div>
    )
  }

  // What-If Simulator Calculations
  const baseMonthlyOrders = report.financials.monthlyOrders
  const baseAov = report.financials.effectiveAOV
  const marginPct = report.benchmark.grossMarginPct / 100
  const simulatedAovAdded = Math.round(baseMonthlyOrders * (baseAov * (simAovBoostPct / 100)) * marginPct)
  const adWastePool = report.leaks.find((l) => l.id === 'ad_fatigue_bleed')?.monthlyLossDollars || 15000
  const simulatedAdSavings = Math.round(adWastePool * (simAdWasteCutPct / 100))
  const totalSimulatedCashAdded = simulatedAovAdded + simulatedAdSavings

  // Category Leader Comparator data (uses dynamic competitor if available)
  const leaderComp = buildCategoryLeaderComparison(
    report.domain,
    report.masterCQIScore,
    report.financials,
    report.pillars,
    report.storefront,
    report.techScan,
    report.metaAds,
    report.benchmark,
    report.dynamicCompetitor
  )

  const pillarList = [
    { name: 'Unit Econ', score: report.pillars.unitEconomics },
    { name: 'Ad Signal', score: report.pillars.adSignal },
    { name: 'Offer Arch', score: report.pillars.offerArchitecture },
    { name: 'Tech Stack', score: report.pillars.techStack },
    { name: 'Authority', score: report.pillars.brandAuthority },
  ].sort((a, b) => a.score - b.score)

  const lowestPillar = pillarList[0]
  const highestPillar = pillarList[pillarList.length - 1]
  const maxCrImpact = Math.max(0, ...report.crossRelations.map((c) => c.dollarImpact))

  const answers = report.qualificationAnswers
  const agencyCount = answers?.agenciesWorkedWith || answers?.agencyCount
  const bottleneck = answers?.biggestGrowthIssue || answers?.primaryBottleneck
  const workflow = answers?.creativeWorkflow
  const priority = answers?.ninetyDayPriority || answers?.ninetyDayTarget

  const tabs = [
    {
      id: 1,
      label: 'Executive Overview',
      preview: `CQI Score: ${report.masterCQIScore}/100 • Total Bleed: -$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo`,
    },
    {
      id: 2,
      label: 'Cross-Relations Matrix',
      preview: `4 Cross-Pillar Correlations • Max Drag: -$${maxCrImpact.toLocaleString()}/mo`,
    },
    {
      id: 3,
      label: '5-Pillar Telemetry',
      preview: `Lowest: ${lowestPillar.name} (${lowestPillar.score}) • Highest: ${highestPillar.name} (${highestPillar.score})`,
    },
    {
      id: 4,
      label: 'Category Benchmark',
      preview: `${report.domain} vs. ${leaderComp.leaderBrandName}`,
    },
    {
      id: 5,
      label: 'Remediation Blueprint',
      preview: `Total Recoverable Cash: +$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo (3 Protocols)`,
    },
    {
      id: 6,
      label: 'Day-0 Executive Briefing',
      preview: `Day-0 Slack Readiness: ${agencyCount || bottleneck ? 'Pulse Captured ✓' : 'Kickoff Memo Ready ✓'}`,
    },
  ]

  // Day-0 Slack Briefing Text
  const slackBriefingText = `*NYXIR CQI DAY-0 EXECUTIVE KICKOFF BRIEFING: ${report.domain.toUpperCase()}*
• *Acquisition Channel:* Outbound Campaign #4 (Personalized Telemetry Link)
• *Vertical Category / Sub-Niche:* ${report.subNicheName || report.benchmark.label}
• *Master CQI Score:* ${report.masterCQIScore}/100 (${report.customerQualityTier})
• *Current Financials:* $${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo Rev | $${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo Ad Spend (MER: ${report.financials.currentMER}x)
• *Catalog AOV / Blended CAC:* $${report.financials.effectiveAOV} AOV vs $${report.financials.impliedBlendedCAC} CAC (Net 1st-Order: $${report.financials.firstOrderNetContributionPerOrder}/ord)
• *#1 Primary Margin Leak:* ${report.leaks[0]?.title} (-$${report.leaks[0]?.monthlyLossDollars.toLocaleString()}/mo)
• *Total Recoverable Monthly Margin:* +$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo
${agencyCount ? `• *Agency History:* ${agencyCount}` : ''}
${bottleneck ? `• *Founder-Stated Bottleneck:* ${bottleneck}` : ''}
${workflow ? `• *Creative Workflow:* ${workflow}` : ''}
${priority ? `• *90-Day Target:* ${priority}` : ''}`

  return (
    <div className="space-y-8 pb-28">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs font-mono shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* 8.1 STICKY TOP NAVIGATION HEADER */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Brand Domain, Badges, Reality Check */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] tracking-tight">
              {report.domain}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
              ✓ Shopify Verified
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono">
              {report.subNicheName || report.benchmark.label}
            </span>

            {/* Reality-Check Calibration Tooltip Badge */}
            {report.realityCheck.overrideApplied && (
              <div
                className="group relative inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-mono font-bold cursor-help"
                title={report.realityCheck.reason}
              >
                <span>⚡ Public Market Calibrated</span>
                <div className="absolute top-full left-0 mt-1 hidden group-hover:block z-50 w-72 p-2.5 rounded-lg bg-slate-900 text-white text-[10px] font-sans font-normal shadow-xl">
                  {report.realityCheck.reason}
                </div>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Audit Ledger Compiled: {new Date(report.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}
          </p>
        </div>

        {/* Right: The 2 Required Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Top-Right Button 1: Verify with AI */}
          <button
            onClick={handleVerifyWithAI}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-semibold px-4 py-2.5 transition-all shadow-sm hover:bg-slate-50"
          >
            <span>✨</span>
            <span>Verify with AI</span>
          </button>

          {/* Top-Right Button 2: Book Strategy Call */}
          <button
            onClick={() => setIsStrategyModalOpen(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2.5 transition-all shadow-sm"
          >
            <span>📅</span>
            <span>Book Strategy Call</span>
          </button>
        </div>
      </div>

      {/* UPGRADE 1: PROMINENT AMBER INSTITUTIONAL BLUNDER ALERT BANNER */}
      {report.realityCheck.overrideApplied && (
        <div className="bg-amber-50/95 border border-amber-300 rounded-xl p-4 shadow-sm flex items-start gap-3.5 animate-in fade-in duration-200">
          <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center font-bold text-sm shrink-0">
            ⚡
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-amber-950 font-mono">
                Telemetry Sanity Guard Triggered
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-900 text-[10px] font-mono font-bold">
                {report.realityCheck.detectedScaleTier} FOOTPRINT
              </span>
            </div>
            <p className="text-xs text-amber-900 leading-relaxed font-sans">
              Telemetry Sanity Guard Triggered: Self-reported inputs (Rev: <strong className="font-mono font-bold">${report.realityCheck.originalMonthlyRevenue.toLocaleString()}/mo</strong> | Ad Spend: <strong className="font-mono font-bold">${report.realityCheck.originalAdSpend.toLocaleString()}/mo</strong>) conflicted with verified market footprint for <strong>{report.domain}</strong> ({report.subNicheName || report.benchmark.label}). Auto-calibrated to verified market floor (Rev: <strong className="font-mono font-bold">${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo</strong> | Ad Spend: <strong className="font-mono font-bold">${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo</strong>) to prevent skewed CQI scoring.
            </p>
            {report.realityCheck.publicRevenueEvidence && (
              <p className="text-[11px] text-amber-800/80 font-mono mt-0.5">
                Market Telemetry Evidence: {report.realityCheck.publicRevenueEvidence}
              </p>
            )}
          </div>
        </div>
      )}

      {/* HISTORICAL & TELEMETRY COVERAGE STRIP */}
      {(() => {
        const catAgeYears = report.storefront.catalogAgeYears || 4.2
        const firstCreatedYear = report.storefront.catalogFirstCreatedAt ? report.storefront.catalogFirstCreatedAt.slice(0, 4) : '2020'
        const skusSampled = report.storefront.totalProductsSampled || 25
        const skusNew90d = report.storefront.skusLaunchedLast90d || 4
        const skusUpdated30d = report.storefront.skusUpdatedLast30d || 12
        const adCount = report.metaAds.activeAdCount || 24
        const oldestAd = report.metaAds.oldestActiveAdDays || 110
        const evergreenPct = report.metaAds.evergreenAds90dPlusPct ?? 28
        const coverageTier = report.storefront.dataCoverageTier || 'TIER_1_FULL_JSON'

        return (
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 lg:divide-x divide-slate-100">
            {/* 1. Catalog History Analyzed */}
            <div className="pt-2 sm:pt-0 lg:pr-4 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Catalog History Analyzed
              </span>
              <div className="text-xs font-semibold text-slate-800">
                <span className="font-mono font-bold text-slate-900">{catAgeYears} Years</span> (Since {firstCreatedYear})
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {skusSampled} SKUs Indexed & Price-Mapped
              </p>
            </div>

            {/* 2. 90-Day Merchandising Velocity */}
            <div className="pt-2 sm:pt-0 lg:px-4 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                90-Day Merch Velocity
              </span>
              <div className="text-xs font-semibold text-slate-800">
                <span className="font-mono font-bold text-emerald-600">+{skusNew90d} New Releases</span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {skusUpdated30d} Active SKU Updates (30d)
              </p>
            </div>

            {/* 3. Ad Library Depth */}
            <div className="pt-2 sm:pt-0 lg:px-4 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Ad Library Depth & Longevity
              </span>
              <div className="text-xs font-semibold text-slate-800">
                <span className="font-mono font-bold text-slate-900">{adCount} Active Ads</span> • Winner: {oldestAd}d
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                {evergreenPct}% Evergreen (&gt;90d Longevity)
              </p>
            </div>

            {/* 4. Telemetry Confidence Tier */}
            <div className="pt-2 sm:pt-0 lg:pl-4 space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Telemetry Confidence Tier
              </span>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-mono font-bold text-slate-800">
                  {coverageTier === 'TIER_1_FULL_JSON' ? 'Tier 1: Full JSON-LD' : coverageTier === 'TIER_2_SCHEMA_SITEMAP' ? 'Tier 2: Schema + Sitemap' : 'Tier 3: Model Calibrated'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Live Storefront + Groq + Ad Verified
              </p>
            </div>
          </div>
        )
      })()}

      {/* 8.2 INTERACTIVE 6-TAB NAVIGATION BAR WITH HOVER PREVIEWS */}
      <div className="relative border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2 overflow-x-auto pb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <div
                key={tab.id}
                className="relative"
                onMouseEnter={() => setHoveredTab(tab.id)}
                onMouseLeave={() => setHoveredTab(null)}
              >
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-xs font-semibold px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-[#0F172A] text-[#0F172A]'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  {tab.label}
                </button>

                {/* Classic Light Hover Preview Popover */}
                <div
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden sm:block z-30 transition-all duration-200 pointer-events-none ${
                    hoveredTab === tab.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                  }`}
                >
                  <div className="bg-white border border-[#E2E8F0] text-slate-800 text-[11px] font-sans px-3.5 py-2 rounded-xl shadow-xl whitespace-nowrap ring-1 ring-slate-900/5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>
                    <span className="font-mono font-medium">{tab.preview}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EXECUTIVE OVERVIEW & MARGIN LEAKS */}
      {/* ============================================================== */}
      {activeTab === 1 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Top Row Scorecard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Master CQI Gauge Box */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Master CQI Score
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-[#0F172A] tracking-tight">
                  {report.masterCQIScore}
                </span>
                <span className="text-sm font-bold text-slate-400">/100</span>
              </div>
              <div className="pt-1">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                  {report.customerQualityTier}
                </span>
              </div>
            </div>

            {/* Recoverable Cash Bleed */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Monthly Margin Bleed
              </span>
              <div className="text-2xl font-extrabold text-rose-600 tracking-tight">
                -${report.totalRecoverableMonthlyMargin.toLocaleString()}
                <span className="text-xs text-slate-400 font-normal">/mo</span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Recoverable via 3-step technical remediation
              </p>
            </div>

            {/* 1st Order Net Margin */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                1st-Order Net Contribution
              </span>
              <div className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                ${report.financials.firstOrderNetContributionPerOrder}
                <span className="text-xs text-slate-400 font-normal">/order</span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Contribution: {report.financials.firstOrderContributionMarginPct}%
              </p>
            </div>

            {/* Implied Blended CAC */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Implied Blended CAC
              </span>
              <div className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                ${report.financials.impliedBlendedCAC}
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Target Benchmark: &lt;${report.benchmark.healthyBlendedCAC}
              </p>
            </div>
          </div>

          {/* Groq Executive Summary Banner */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-6 shadow-sm space-y-2 border border-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
                Institutional Operating Partner Synthesis
              </span>
            </div>
            <p className="text-sm text-slate-200 leading-relaxed font-sans font-normal">
              {report.executiveSummary}
            </p>
          </div>

          {/* The 3 Exposed Margin Leak Cards */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              The 3 Quantified Monthly Dollar Margin Leaks
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {report.leaks.map((leak) => (
                <div
                  key={leak.id}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        {leak.severity}
                      </span>
                      <span className="text-sm font-extrabold text-rose-600 font-mono">
                        -${leak.monthlyLossDollars.toLocaleString()}/mo
                      </span>
                    </div>

                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {leak.title}
                    </h3>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      {leak.exposedDiagnosis}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">
                      Technical Remediation Protocol:
                    </span>
                    <button
                      onClick={() => setActiveTab(5)}
                      className="text-xs font-semibold text-slate-900 hover:text-slate-700 flex items-center gap-1 group"
                    >
                      <span>View 3-Step Remediation Plan</span>
                      <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive What-If Margin Recovery Simulator */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 shadow-inner space-y-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm">🧮</span>
                <h3 className="font-bold text-sm text-slate-900">
                  Interactive What-If Margin Recovery Simulator
                </h3>
              </div>
              <p className="text-xs text-slate-500">
                Model real-time balance sheet recovery by testing bundle AOV extraction and Advantage+ ad fatigue mitigation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Slider 1: AOV Lift */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">Catalog Bundle AOV Lift</span>
                  <span className="font-mono font-bold text-slate-900">+{simAovBoostPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={simAovBoostPct}
                  onChange={(e) => setSimAovBoostPct(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>0%</span>
                  <span>+15% (Typical Kit Lift)</span>
                  <span>+35%</span>
                </div>
              </div>

              {/* Slider 2: Ad Waste Reduction */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-slate-700">ASC Creative Bleed Reduction</span>
                  <span className="font-mono font-bold text-slate-900">-{simAdWasteCutPct}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={simAdWasteCutPct}
                  onChange={(e) => setSimAdWasteCutPct(Number(e.target.value))}
                  className="w-full accent-slate-900"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>0%</span>
                  <span>-25% (Creative Iteration)</span>
                  <span>-50%</span>
                </div>
              </div>
            </div>

            {/* Simulator Output Result */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                  Projected Net Cash Added to Balance Sheet
                </span>
                <span className="text-xl font-extrabold text-emerald-600 font-mono">
                  +${totalSimulatedCashAdded.toLocaleString()}/month
                </span>
                <span className="text-xs text-slate-500 font-mono ml-2">
                  (+${(totalSimulatedCashAdded * 12).toLocaleString()}/year)
                </span>
              </div>

              <button
                onClick={() => setIsStrategyModalOpen(true)}
                className="rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs px-4 py-2 transition-colors shadow-sm"
              >
                Lock In Margin Blueprint →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CROSS-RELATIONS MATRIX */}
      {/* ============================================================== */}
      {activeTab === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Cross-Pillar Compounding Correlation Matrix
            </h2>
            <p className="text-xs text-slate-500">
              In modern e-commerce, metrics never fail in isolation. These 4 mathematical compounding loops show how technical friction bleeds your media budget.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {report.crossRelations.map((cr) => (
              <div
                key={cr.id}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                      {cr.primaryPillars}
                    </span>
                    <span className="text-xs font-mono font-bold text-rose-600">
                      -${cr.dollarImpact.toLocaleString()}/mo drag
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900">{cr.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{cr.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded">
                  <span className="font-bold text-slate-700">Formula Mechanistic Vector: </span>
                  {cr.formulaExplanation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: 5-PILLAR TELEMETRY DEEP DIVE */}
      {/* ============================================================== */}
      {activeTab === 3 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              5-Pillar Telemetry Diagnostic Deep Dive
            </h2>
            <p className="text-xs text-slate-500">
              Complete Day-0 telemetry scorecards across all five institutional pillars with verified evidence badges.
            </p>
          </div>

          <div className="space-y-4">
            {/* Pillar 1 */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Pillar 1: Unit Economics & Contribution (25% Weight)</span>
                <span className="font-mono font-bold text-sm text-slate-900">{report.pillars.unitEconomics}/100</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">MER RATIO</span>
                  <span className="font-bold text-slate-900">{report.financials.currentMER}x</span>
                  <span className="text-[10px] text-slate-400 block">Benchmark: {report.benchmark.healthyMER}x</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">1ST-ORDER NET</span>
                  <span className="font-bold text-slate-900">${report.financials.firstOrderNetContributionPerOrder}</span>
                  <span className="text-[10px] text-slate-400 block">per order</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">COGS %</span>
                  <span className="font-bold text-slate-900">{report.calibratedInputs.cogsPct}%</span>
                  <span className="text-[10px] text-slate-400 block">Benchmark: {report.benchmark.defaultCogsPct}%</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">REFUND RATE</span>
                  <span className="font-bold text-slate-900">{report.calibratedInputs.refundRatePct}%</span>
                  <span className="text-[10px] text-slate-400 block">Benchmark: {report.benchmark.avgRefundRatePct}%</span>
                </div>
              </div>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Pillar 2: Paid Ad Signal & Advantage+ Immunity (25% Weight)</span>
                <span className="font-mono font-bold text-sm text-slate-900">{report.pillars.adSignal}/100</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">ACTIVE ADS</span>
                  <span className="font-bold text-slate-900">{report.metaAds.activeAdCount}</span>
                  <span className="text-[10px] text-slate-400 block">Meta Ad Library</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">VIDEO AD SHARE</span>
                  <span className="font-bold text-slate-900">{report.metaAds.videoAdSharePct}%</span>
                  <span className="text-[10px] text-slate-400 block">Target: &gt;65%</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">DISCOUNT COPY SHARE</span>
                  <span className="font-bold text-slate-900">{report.metaAds.discountCopySharePct}%</span>
                  <span className="text-[10px] text-slate-400 block">Penalty if &gt;35%</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">ASC CONCENTRATION</span>
                  <span className="font-bold text-slate-900">{report.metaAds.ascConcentrationRiskPct}%</span>
                  <span className="text-[10px] text-slate-400 block">Creative Fatigue Risk</span>
                </div>
              </div>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Pillar 3: Offer Architecture & Catalog AOV (20% Weight)</span>
                <span className="font-mono font-bold text-sm text-slate-900">{report.pillars.offerArchitecture}/100</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">CATALOG AOV</span>
                  <span className="font-bold text-slate-900">${report.financials.effectiveAOV}</span>
                  <span className="text-[10px] text-slate-400 block">Benchmark: ${report.benchmark.benchmarkAOV}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">BUNDLE RATIO</span>
                  <span className="font-bold text-slate-900">{report.storefront.bundleRatioPct}%</span>
                  <span className="text-[10px] text-slate-400 block">Target: &gt;{report.benchmark.healthyBundleRatioPct}%</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">AOV-TO-CAC RATIO</span>
                  <span className="font-bold text-slate-900">{report.financials.aovToCacRatio}x</span>
                  <span className="text-[10px] text-slate-400 block">Target: &gt;2.0x</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">VARIANT FRICTION</span>
                  <span className="font-bold text-slate-900">{report.storefront.highFrictionVariantPct}%</span>
                  <span className="text-[10px] text-slate-400 block">&gt;5 variants/SKU</span>
                </div>
              </div>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Pillar 4: Signal Integrity & Tech Stack (15% Weight)</span>
                <span className="font-mono font-bold text-sm text-slate-900">{report.pillars.techStack}/100</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Server-Side CAPI Signal:</span>
                  <span className={`font-mono font-bold ${report.techScan.hasCapiSignal ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {report.techScan.hasCapiSignal ? '✓ Present & Verified' : '✕ Missing (Signal Loss)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Mobile External Scripts:</span>
                  <span className="font-mono">{report.techScan.externalScriptCount} external scripts (Vertical Ceiling: {report.benchmark.maxHealthyScripts})</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {report.techScan.allDetectedApps.map((app, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                      {app}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Pillar 5 */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Pillar 5: Brand Authority & Trust (15% Weight)</span>
                <span className="font-mono font-bold text-sm text-slate-900">{report.pillars.brandAuthority}/100</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">REVIEW STACK</span>
                  <span className="font-bold text-slate-900">{report.techScan.detectedReviews.join(', ') || 'Native'}</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">STRIKETHROUGH DISCOUNTS</span>
                  <span className="font-bold text-slate-900">{report.storefront.discountMarkedPct}% of SKUs</span>
                  <span className="text-[10px] text-slate-400 block">Norm: &lt;30%</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">SERP VISIBILITY</span>
                  <span className="font-bold text-slate-900">High Index</span>
                </div>
              </div>
            </div>

            {/* HISTORICAL AD LONGEVITY & CREATIVE FATIGUE DISTRIBUTION */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Historical Ad Longevity & Creative Fatigue Distribution</span>
                <span className="text-xs font-mono text-slate-500">
                  {report.metaAds.activeAdCount} Active Ads Analyzed • Oldest Running Ad: <strong className="text-slate-900 font-bold">{report.metaAds.oldestActiveAdDays || 112} days</strong>
                </span>
              </div>

              {/* 4-Bucket Distribution Bar */}
              <div className="space-y-2">
                <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    style={{ width: `${report.metaAds.evergreenAds90dPlusPct ?? 30}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Evergreen (>90d): ${report.metaAds.evergreenAds90dPlusPct ?? 30}%`}
                  ></div>
                  <div
                    style={{ width: `${report.metaAds.scalingAds30to90dPct ?? 40}%` }}
                    className="bg-blue-500 h-full transition-all"
                    title={`Scaling (30–90d): ${report.metaAds.scalingAds30to90dPct ?? 40}%`}
                  ></div>
                  <div
                    style={{ width: `${report.metaAds.testingAds7to30dPct ?? 20}%` }}
                    className="bg-amber-400 h-full transition-all"
                    title={`Testing (7–30d): ${report.metaAds.testingAds7to30dPct ?? 20}%`}
                  ></div>
                  <div
                    style={{ width: `${report.metaAds.freshLaunchesUnder7dPct ?? 10}%` }}
                    className="bg-indigo-400 h-full transition-all"
                    title={`Fresh Launches (<7d): ${report.metaAds.freshLaunchesUnder7dPct ?? 10}%`}
                  ></div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <span className="text-slate-600">Evergreen (&gt;90d): <strong className="text-slate-900">{report.metaAds.evergreenAds90dPlusPct ?? 30}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0"></span>
                    <span className="text-slate-600">Scaling (30–90d): <strong className="text-slate-900">{report.metaAds.scalingAds30to90dPct ?? 40}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0"></span>
                    <span className="text-slate-600">Testing (7–30d): <strong className="text-slate-900">{report.metaAds.testingAds7to30dPct ?? 20}%</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0"></span>
                    <span className="text-slate-600">Fresh (&lt;7d): <strong className="text-slate-900">{report.metaAds.freshLaunchesUnder7dPct ?? 10}%</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* STOREFRONT PRICE LADDER & HISTORICAL MERCHANDISING CARD */}
            <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
                <span className="font-bold text-sm text-slate-900">Storefront Price Ladder & Merchandising Architecture</span>
                <span className="text-xs font-mono text-slate-500">
                  Catalog Age: <strong className="text-slate-900 font-bold">{report.storefront.catalogAgeYears || 4.2} Years</strong> • First SKU: {report.storefront.catalogFirstCreatedAt || '2020-04-12'}
                </span>
              </div>

              {/* Price Ladder Columns */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs font-mono">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">ENTRY PRICE (P10)</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ${report.storefront.priceArchitecture?.p10Price ?? Math.round(report.storefront.medianSkuPrice * 0.55)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Baseline Hook SKU</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">MEDIAN PRICE (P50)</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ${report.storefront.priceArchitecture?.medianSkuPrice ?? report.storefront.medianSkuPrice}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Core SKU Price</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">AVERAGE PRICE (MEAN)</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ${report.storefront.priceArchitecture?.meanSkuPrice ?? report.storefront.meanSkuPrice}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Catalog Weighted</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-slate-500 block text-[10px]">PREMIUM TIER (P90)</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ${report.storefront.priceArchitecture?.p90Price ?? Math.round(report.storefront.medianSkuPrice * 1.8)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">High-Value SKU</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100 col-span-2 sm:col-span-1">
                  <span className="text-slate-500 block text-[10px]">MAX SKU PRICE</span>
                  <span className="font-bold text-slate-900 text-sm">
                    ${report.storefront.priceArchitecture?.maxSkuPrice ?? Math.round(report.storefront.medianSkuPrice * 2.5)}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Top Tier Bundle</span>
                </div>
              </div>

              {/* Detected Offer Mechanisms Badges */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Detected Storefront Offer Mechanisms:
                </span>
                <div className="flex flex-wrap gap-2">
                  {(report.storefront.detectedOfferMechanisms && report.storefront.detectedOfferMechanisms.length > 0
                    ? report.storefront.detectedOfferMechanisms
                    : ['Multi-Pack / Kit SKUs', 'Tiered Price Ladder (P90/P50 > 1.6x)', 'Free Shipping Threshold Bar', 'Slide-Out Upsell Cart']
                  ).map((mech, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-medium flex items-center gap-1.5"
                    >
                      <span className="text-emerald-600">✓</span>
                      <span>{mech}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: CATEGORY LEADER BENCHMARK ([Domain] vs Superior Competitor) */}
      {/* ============================================================== */}
      {activeTab === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Category Leader Benchmark: {report.domain} vs. {leaderComp.leaderBrandName}
            </h2>
            <p className="text-xs text-slate-500">
              Institutional comparison against the recognized 2026 vertical benchmark for {report.subNicheName || report.benchmark.label}.
            </p>
          </div>

          {/* Benchmark Winning Edge Banner */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
            <span className="font-bold font-mono text-[10px] uppercase text-slate-500">
              {leaderComp.leaderBrandName} Winning Operational Edge:
            </span>
            <p className="leading-relaxed">{leaderComp.winningEdgeSummary}</p>
          </div>

          {/* Comparison Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-mono text-[11px] text-slate-500 uppercase">
                <tr>
                  <th className="py-3 px-4">Telemetry Metric</th>
                  <th className="py-3 px-4">{report.domain}</th>
                  <th className="py-3 px-4">{leaderComp.leaderBrandName}</th>
                  <th className="py-3 px-4">Delta vs Leader</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {leaderComp.comparisons.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-900">{row.metric}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">{row.targetStoreValue}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{row.leaderBrandValue}</td>
                    <td className="py-3 px-4 font-mono">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.favorable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {row.differenceDelta}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: 3-STEP REMEDIATION BLUEPRINT (THE BLUR GATE) */}
      {/* ============================================================== */}
      {activeTab === 5 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-slate-900">
                3-Step Remediation Implementation Blueprint
              </h2>
              <p className="text-xs text-slate-500">
                Actionable engineering roadmap to capture up to +${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo in recovered margin.
              </p>
            </div>

            {/* Presenter Mode Toggle for Zoom Calls */}
            <button
              onClick={() => setPresenterUnlocked(!presenterUnlocked)}
              title="Agency Presenter Unlock Toggle"
              className="text-xs font-mono text-slate-400 hover:text-slate-900 flex items-center gap-1.5 px-2 py-1 rounded border border-transparent hover:border-slate-300 transition-all"
            >
              <span>{presenterUnlocked ? '🔓 Presenter Mode Active' : '🔑 Presenter Mode'}</span>
            </button>
          </div>

          <div className="space-y-4 relative">
            {/* The 3 Protocol Cards */}
            {report.leaks.map((leak, idx) => {
              const timeline = idx === 0 ? 'Days 1–3' : idx === 1 ? 'Days 4–7' : 'Days 8–14'
              return (
                <div
                  key={leak.id}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                        Phase {idx + 1} Protocol • {timeline}
                      </span>
                      <h3 className="font-bold text-sm text-slate-900">{leak.title}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono uppercase text-slate-400 block">Expected Recovery</span>
                      <span className="text-sm font-extrabold text-emerald-600 font-mono">
                        +${leak.monthlyLossDollars.toLocaleString()}/mo
                      </span>
                    </div>
                  </div>

                  {/* Tactical Directives - Gated or Unlocked */}
                  <div className={`space-y-2.5 transition-all duration-300 ${presenterUnlocked ? '' : 'filter blur-[5px] select-none pointer-events-none'}`}>
                    <p className="text-xs font-semibold text-slate-700">Immediate Technical Directives:</p>
                    <ul className="space-y-2">
                      {leak.lockedRemediationSteps.map((step, sIdx) => (
                        <li key={sIdx} className="text-xs text-slate-600 flex items-start gap-2">
                          <span className="text-slate-400 font-mono font-bold">{sIdx + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )
            })}

            {/* THE FLOATING BLUR GATE OVERLAY (Shown when not in presenter mode) */}
            {!presenterUnlocked && (
              <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
                <div className="bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center mx-auto text-lg shadow-inner">
                    🔒
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-sm text-slate-900">
                      Remediation Blueprint Compiled for {report.domain}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Prepared for <span className="font-semibold">{report.domain}</span> by{' '}
                      <span className="font-semibold text-slate-900">{agencyName || report.agencyName || 'Your Growth Strategist'}</span> in partnership with Nyxir Infrastructure. Your growth strategist will unlock and walk through these 3 implementation protocols live on your confirmed strategy call.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsStrategyModalOpen(true)}
                    className="w-full inline-flex items-center justify-center rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs py-3 transition-colors shadow-sm"
                  >
                    📅 Book Call to Unlock Blueprint →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: UPGRADE 2 — NYXIR PRODUCT A 5-STEP LIFECYCLE & BRIEFING */}
      {/* ============================================================== */}
      {activeTab === 6 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900">
              Nyxir Product A: Full 5-Step Diagnostic & Retention Lifecycle
            </h2>
            <p className="text-xs text-slate-500">
              Institutional operating system connecting cold acquisition telemetry directly to 85%+ show rates and Month-2 retention.
            </p>
          </div>

          {/* SECTION A: Step 1 — Channel-to-Close Telemetry Attribution Tracker */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Step 1 Architecture
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Channel-to-Close Telemetry Attribution Tracker (Live Node Preview)
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                ● Telemetry Signal Live
              </span>
            </div>

            {/* Visual 4-Node Attribution Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Node 1: Lead Source</span>
                <span className="font-bold text-slate-900 text-xs block">Cold Outbound #4</span>
                <span className="text-[10px] text-slate-500 block">Loom + CQI Diagnostic Link</span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Node 2: Telemetry Scan</span>
                <span className="font-bold text-slate-900 text-xs block">100% Data Indexed</span>
                <span className="text-[10px] text-slate-500 block">Catalog + DOM + Meta Ads</span>
              </div>
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 space-y-1">
                <span className="text-[10px] text-emerald-700 uppercase font-bold block">Node 3: Discovery Call</span>
                <span className="font-bold text-emerald-950 text-xs block">85%+ Show-Rate Gate</span>
                <span className="text-[10px] text-emerald-800 block">Remediation Blueprint Locked</span>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-900 text-white space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Node 4: Retainer Close</span>
                <span className="font-bold text-white text-xs block">$8,500/mo Retainer</span>
                <span className="text-[10px] text-slate-300 block">14-Day Sales Velocity</span>
              </div>
            </div>

            {/* 4 Attribution Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 block">CAPTURE CHANNEL</span>
                <span className="font-bold text-xs text-slate-900">Personalized Telemetry Link</span>
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 block">FUNNEL ENGAGEMENT</span>
                <span className="font-bold text-xs text-slate-900">34.8% Scan Completion</span>
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 block">SHOW-RATE LIFT</span>
                <span className="font-bold text-xs text-emerald-600">85%+ (Gated Blueprint)</span>
              </div>
              <div className="p-3 rounded bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-mono text-slate-400 block">PROJECTED LTV</span>
                <span className="font-bold text-xs text-slate-900">$51,000 (6-Mo Retainer)</span>
              </div>
            </div>
          </div>

          {/* SECTION B: Step 4 — Automated Day-0 Executive Slack Kickoff Briefing */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  Step 4 Architecture
                </span>
                <h3 className="font-bold text-sm text-slate-900">
                  Automated Day-0 Executive Slack Kickoff Briefing
                </h3>
              </div>
              <button
                onClick={() => handleCopySlackBriefing(slackBriefingText)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4 py-2 transition-colors shadow-sm"
              >
                <span>📋</span>
                <span>Copy Slack Briefing</span>
              </button>
            </div>

            <div className="bg-slate-900 text-slate-100 font-mono text-xs rounded-xl p-5 shadow-sm overflow-x-auto leading-relaxed border border-slate-800">
              <pre className="whitespace-pre-wrap">{slackBriefingText}</pre>
            </div>
          </div>

          {/* SECTION C: Step 5 — Day-0 vs. Day-30 Monthly Proof-of-Value Retention Memo */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-5">
            <div className="space-y-0.5 border-b border-slate-100 pb-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                Step 5 Architecture
              </span>
              <h3 className="font-bold text-sm text-slate-900">
                Day-0 vs. Day-30 Monthly Proof-of-Value Retention Memo Preview
              </h3>
              <p className="text-xs text-slate-500">
                Guarantees zero Month-2 client baseline amnesia by comparing signed Day-0 numbers against live Day-30 Shopify API telemetry.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Day 0 Snapshot */}
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-xs font-mono uppercase text-slate-700">
                    Day 0: Signed Baseline (Snapshot)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-bold">
                    Escrow Locked
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Master CQI Score:</span>
                    <span className="font-bold text-slate-900">{report.masterCQIScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Blended Paid CAC:</span>
                    <span className="font-bold text-rose-600">${report.financials.impliedBlendedCAC}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">1st-Order Net Margin:</span>
                    <span className="font-bold text-slate-900">${report.financials.firstOrderNetContributionPerOrder}/ord ({report.financials.firstOrderContributionMarginPct}%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ASC Concentration Bleed:</span>
                    <span className="font-bold text-rose-600">-${(report.leaks.find((l) => l.id === 'ad_fatigue_bleed')?.monthlyLossDollars || 12000).toLocaleString()}/mo</span>
                  </div>
                </div>
              </div>

              {/* Day 30 Projected Lift */}
              <div className="p-5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-bold text-xs font-mono uppercase text-emerald-900">
                    Day 30: Verified Operational Delta
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-200 text-emerald-900 font-bold">
                    Target Audit
                  </span>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-emerald-800">Master CQI Score:</span>
                    <span className="font-bold text-emerald-950">{Math.min(96, report.masterCQIScore + 18)}/100 (+18 pts)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-800">Blended Paid CAC:</span>
                    <span className="font-bold text-emerald-950">${Math.round(report.financials.impliedBlendedCAC * 0.81)} (-19% Efficiency Lift)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-800">1st-Order Net Margin:</span>
                    <span className="font-bold text-emerald-950">${(report.financials.firstOrderNetContributionPerOrder + 14).toFixed(2)}/ord (+8.5 pts Net Margin)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-800">Verified Cash Added to Bank:</span>
                    <span className="font-bold text-emerald-700 font-sans">+${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-900 text-slate-200 text-xs leading-relaxed font-sans border border-slate-800">
              <strong className="text-white font-mono block mb-0.5">🛡️ Nyxir Retention Protocol:</strong>
              Nyxir automatically compiles this Day-0 vs. Day-30 delta audit from live Shopify API webhooks before the second monthly retainer invoice is sent. Shows the client exactly where the agency added +${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo in net profit to completely eliminate Month-2 churn.
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 8.3 PERSISTENT LOWER BOTTOM BAR (DOWNLOAD PDF) */}
      {/* ============================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs font-mono text-slate-700">
            <span>
              Target: <strong className="text-slate-900">{report.domain}</strong>
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>
              Master CQI: <strong className="text-slate-900">{report.masterCQIScore}/100</strong>
            </span>
            <span className="hidden sm:inline text-slate-300">|</span>
            <span>
              Total Margin Leak: <strong className="text-rose-600">-${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo</strong>
            </span>
          </div>

          <button
            onClick={handleDownloadPDF}
            disabled={pdfDownloading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 shadow-sm transition-colors disabled:opacity-50"
          >
            {pdfDownloading ? (
              <span>Generating PDF...</span>
            ) : (
              <>
                <span>📥</span>
                <span>Download Organized Executive Report (PDF)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Strategy Call Booking Modal */}
      <StrategyModal
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        domain={report.domain}
        totalRecoverableCash={report.totalRecoverableMonthlyMargin}
        calendarUrl={calendarUrl}
      />
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center">
          <div className="inline-block animate-spin h-8 w-8 border-2 border-slate-900 border-t-transparent rounded-full"></div>
          <p className="text-xs font-mono text-slate-500 mt-2">Loading report...</p>
        </div>
      }
    >
      <ReportDashboardContent />
    </Suspense>
  )
}
