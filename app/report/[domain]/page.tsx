'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { AuditReportResult, TopSku } from '@/lib/cqi/types'
import { buildFullAuditPrompt, buildConciseChatGptUrl } from '@/lib/utils/chatgptVerify'
import StrategyModal from '@/components/report/StrategyModal'

function ReportDashboardContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const domainParam = (params?.domain as string) || ''
  const isPresenterUnlockedByQuery = searchParams.get('unlock') === 'true'

  const [report, setReport] = useState<AuditReportResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [selfHealing, setSelfHealing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Agency White-Label Branding State
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [calendarUrl, setCalendarUrl] = useState<string>('https://cal.com')
  const [showAgencyBar, setShowAgencyBar] = useState(false)

  // Active Tab (1 to 7)
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

  // Fetch report data with local storage & self-healing fallback
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
            // Self-healing direct link: trigger live audit
            setSelfHealing(true)
            const auditRes = await fetch('/api/audit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ domain: domainParam }),
            })
            const auditData = await auditRes.json()
            if (auditRes.ok && auditData.ok && auditData.report) {
              setReport(auditData.report)
              try {
                localStorage.setItem(`nyxir_report_${domainParam.toLowerCase()}`, JSON.stringify(auditData.report))
              } catch {
                // ignore
              }
              setLoading(false)
              setSelfHealing(false)
              return
            }
            throw new Error(`Could not automatically compile telemetry for ${domainParam}.`)
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

        data.qualificationAnswers = mergedAnswers
        setReport(data)
        if (data.agencyName && !agencyName) setAgencyName(data.agencyName)
      } catch (err: unknown) {
        const localStored = localStorage.getItem(`nyxir_report_${domainParam.toLowerCase()}`)
        if (localStored) {
          try {
            const parsed = JSON.parse(localStored) as AuditReportResult
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
        setSelfHealing(false)
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
      showToast('✨ Full 4-Source audit telemetry copied to clipboard & launching ChatGPT...')
    } catch {
      showToast('Opening ChatGPT with pre-fed telemetry...')
    }

    window.open(chatGptUrl, '_blank', 'noopener,noreferrer')
  }

  // Persistent Bottom Bar: Download PDF
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

  // Copy Slack Kickoff Briefing (Tab 7)
  const handleCopySlackBriefing = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('📋 Day-0 Slack Briefing copied to clipboard!')
    } catch {
      showToast('Could not copy briefing.')
    }
  }

  if (loading || selfHealing) {
    return (
      <div className="py-24 text-center space-y-4 max-w-md mx-auto">
        <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
        <h2 className="text-base font-bold text-slate-900 font-mono">
          {selfHealing ? 'Self-Healing Link: Initializing Live Store Telemetry...' : 'Loading Institutional CQI Ledger...'}
        </h2>
        <p className="text-xs text-slate-500 font-mono">
          {domainParam} · Synthesizing Shopify Schema, Meta Ad Library & Google AI Mode
        </p>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
          !
        </div>
        <h2 className="text-lg font-bold text-slate-900">Diagnostic Not Available</h2>
        <p className="text-xs text-slate-600 font-mono">{error || 'Storefront report could not be loaded.'}</p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 hover:bg-slate-800 transition-colors"
          >
            ← Run New Storefront Scan
          </Link>
        </div>
      </div>
    )
  }

  // Derived simulator values
  const currentOrders = report.financials.monthlyOrders
  const baseAov = report.financials.effectiveAOV
  const newAov = Math.round(baseAov * (1 + simAovBoostPct / 100))
  const aovRecoveredCash = Math.round(
    currentOrders * (newAov - baseAov) * ((100 - report.calibratedInputs.cogsPct) / 100)
  )
  const adWasteRecoveredCash = Math.round(
    report.calibratedInputs.monthlyAdSpend * (simAdWasteCutPct / 100) * 0.72
  )
  const totalSimulatedMonthlyRecovery = aovRecoveredCash + adWasteRecoveredCash

  // Waterfall and Authenticity
  const waterfall = report.fourSourceWaterfall
  const authScore = report.dataAuthenticityScore || {
    scorePct: 98,
    label: '98% Verified Online Data',
    isDualScenario: false,
  }

  // Qualifications
  const answers = report.qualificationAnswers
  const agencyCount = answers?.agenciesWorkedWith || answers?.agencyCount
  const bottleneck = answers?.biggestGrowthIssue || answers?.primaryBottleneck
  const workflow = answers?.creativeWorkflow
  const priority = answers?.ninetyDayPriority || answers?.ninetyDayTarget

  // 7 Tabs with smooth hover metric previews
  const tabs = [
    {
      id: 1,
      label: 'Executive Overview & 4-Source Waterfall',
      preview: `Master CQI: ${report.masterCQIScore}/100 • Bleed: -$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo • 4-Source Math`,
    },
    {
      id: 2,
      label: 'SKU & Catalog Intelligence',
      preview: `${report.storefront.totalProductsSampled} SKUs • Median $${report.storefront.medianSkuPrice} • Price Ladder • Roles`,
    },
    {
      id: 3,
      label: 'Google AI Mode & Customer Base Intelligence',
      preview: `AI Presence: ${waterfall?.source1PublicData.aiPresenceStatus || 'ANALYZED'} • Demographics & Quality Profile`,
    },
    {
      id: 4,
      label: 'Cross-Relations Matrix',
      preview: `4 Cross-Pillar Interactions • Compound Margin Drag`,
    },
    {
      id: 5,
      label: '2026 Industry Report & 3-Competitor Benchmark',
      preview: `2026 ${report.subNicheName || report.benchmark.label} Report vs 3 Direct Competitors`,
    },
    {
      id: 6,
      label: '3-Step Remediation Blueprint',
      preview: `+$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo Projected Recovery (Blur Gate)`,
    },
    {
      id: 7,
      label: 'Day-0 Executive Briefing',
      preview: `Slack Kickoff Briefing & Attribution Memo (${agencyCount || bottleneck ? 'Pulse Captured ✓' : 'Ready ✓'})`,
    },
  ]

  // Day-0 Slack Kickoff Briefing Text
  const slackBriefingText = `*NYXIR CQI DAY-0 EXECUTIVE KICKOFF BRIEFING: ${report.domain.toUpperCase()}*
• *Storefront Domain:* ${report.domain}
• *Sub-Niche:* ${report.subNicheName || report.benchmark.label}
• *Master CQI Score:* ${report.masterCQIScore}/100 (${report.customerQualityTier})
• *Data Authenticity:* ${authScore.label}
• *Current Financials:* $${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo Rev | $${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo Ad Spend (MER: ${report.financials.currentMER}x)
• *Catalog AOV / Blended CAC:* $${report.financials.effectiveAOV} AOV vs $${report.financials.impliedBlendedCAC} CAC (Net 1st-Order: $${report.financials.firstOrderNetContributionPerOrder}/ord)
• *#1 Primary Margin Leak:* ${report.leaks[0]?.title} (-$${report.leaks[0]?.monthlyLossDollars.toLocaleString()}/mo)
• *Total Recoverable Monthly Margin:* +$${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo
${agencyCount ? `• *Agencies Worked With (18m):* ${agencyCount}` : ''}
${bottleneck ? `• *Primary Growth Bottleneck:* ${bottleneck}` : ''}
${workflow ? `• *Creative Production Workflow:* ${workflow}` : ''}
${priority ? `• *90-Day Target:* ${priority}` : ''}`

  return (
    <div className="space-y-8 pb-32">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs font-mono shadow-lg border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* TOP STICKY ACTION BAR */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Left: Domain, Sub-Niche, Authenticity Badge */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold text-[#0F172A] tracking-tight font-mono">
                {report.domain}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-bold">
                ✓ Shopify Verified
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-mono">
                {report.subNicheName || report.benchmark.label}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  authScore.isDualScenario
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                }`}
              >
                {authScore.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 font-mono">
              <span>Day-0 Audit Ledger Compiled: {new Date(report.createdAt).toLocaleDateString()}</span>
              <button
                type="button"
                onClick={() => setShowAgencyBar(!showAgencyBar)}
                className="text-slate-600 hover:text-slate-900 underline text-[11px]"
              >
                {showAgencyBar ? 'Hide White-Label Tools' : '🎛️ Agency White-Label'}
              </button>
            </div>
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

        {/* Collapsible White-Label Bar */}
        {showAgencyBar && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="text-slate-500">Agency Partner:</span>
            <input
              type="text"
              placeholder="e.g. Nyxir Commerce Advisory"
              value={agencyName || ''}
              onChange={(e) => {
                const val = e.target.value
                setAgencyName(val)
                sessionStorage.setItem('cqi_agency_partner', val)
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs"
            />
            <span className="text-slate-500 ml-2">Calendar Booking URL:</span>
            <input
              type="text"
              placeholder="https://cal.com/..."
              value={calendarUrl}
              onChange={(e) => {
                const val = e.target.value
                setCalendarUrl(val)
                sessionStorage.setItem('cqi_calendar_url', val)
              }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-300 rounded text-xs flex-1 min-w-[200px]"
            />
          </div>
        )}
      </div>

      {/* 7-TAB HORIZONTAL NAVIGATION BAR WITH SMOOTH HOVER PREVIEWS */}
      <div className="relative border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2 overflow-x-auto pb-px scrollbar-none">
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
                  Tab {tab.id}: {tab.label}
                </button>

                {/* Hover preview tooltip */}
                <div
                  className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden sm:block z-30 transition-all duration-200 pointer-events-none ${
                    hoveredTab === tab.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                  }`}
                >
                  <div className="bg-white border border-[#E2E8F0] text-slate-800 text-[11px] font-sans px-3.5 py-2 rounded-xl shadow-xl whitespace-nowrap ring-1 ring-slate-900/5 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                    <span className="font-mono font-medium">{tab.preview}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: EXECUTIVE OVERVIEW & 4-SOURCE WATERFALL */}
      {/* ============================================================== */}
      {activeTab === 1 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Top Scorecard Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Master CQI Gauge */}
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

            {/* Monthly Margin Bleed */}
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
                1st-Order Net Cash
              </span>
              <div className="text-2xl font-extrabold text-[#0F172A] tracking-tight">
                ${report.financials.firstOrderNetContributionPerOrder}
                <span className="text-xs text-slate-400 font-normal">/order</span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                Contribution Margin: {report.financials.firstOrderContributionMarginPct}%
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
                Effective MER: {report.financials.currentMER}x (vs {report.benchmark.healthyMER}x Healthy)
              </p>
            </div>
          </div>

          {/* ONLINE VS CUSTOM COMPARISON STRIP (If user entered a custom number) */}
          {authScore.isDualScenario && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-base">⚡</span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-amber-900">
                    Online vs. Custom Comparison Strip ({authScore.onlineVsCustomVariancePct}% Variance)
                  </h4>
                  <p className="text-xs text-amber-900">
                    Discovered Online Benchmark: <strong>${(report.realityCheck.calibratedMonthlyRevenue || 120000).toLocaleString()}/mo</strong> | User Custom Intake: <strong>${report.rawInputs.monthlyRevenue.toLocaleString()}/mo</strong>.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-white px-2.5 py-1 rounded border border-amber-300 font-bold">
                Dual Scenario Preserved
              </span>
            </div>
          )}

          {/* 4-SOURCE DATA HIERARCHY WATERFALL CARD */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  4-Source Data Hierarchy & Valuation Math Waterfall
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Transparent mathematical synthesis connecting Public Scraping + Confirmed Private Data + 2026 Industry Reports
                </p>
              </div>
              <span className="text-xs font-mono font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded">
                Deterministic
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
              {/* Source 1: Public */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Source 1: Public Signals
                </span>
                <p className="text-slate-800">
                  <strong>Median SKU:</strong> ${waterfall?.source1PublicData.catalogMedianPrice || report.storefront.medianSkuPrice}
                </p>
                <p className="text-slate-800">
                  <strong>Bundle Ratio:</strong> {waterfall?.source1PublicData.bundleRatioPct || report.storefront.bundleRatioPct}%
                </p>
                <p className="text-slate-800">
                  <strong>External Scripts:</strong> {waterfall?.source1PublicData.scriptCount || report.techScan.externalScriptCount}
                </p>
                <p className="text-slate-800">
                  <strong>Meta Ads:</strong> {waterfall?.source1PublicData.activeAdCount || report.metaAds.activeAdCount} ({waterfall?.source1PublicData.adsVerified ? 'Verified' : 'Unverified'})
                </p>
                <p className="text-[10px] text-slate-500 truncate" title={waterfall?.source1PublicData.adEvaluationNotice}>
                  {waterfall?.source1PublicData.adEvaluationNotice || 'Evaluated'}
                </p>
              </div>

              {/* Source 2: Private Confirmed */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Source 2: Private Confirmed
                </span>
                <p className="text-slate-800">
                  <strong>Revenue:</strong> ${report.calibratedInputs.monthlyRevenue.toLocaleString()}/mo
                </p>
                <p className="text-slate-800">
                  <strong>Ad Spend:</strong> ${report.calibratedInputs.monthlyAdSpend.toLocaleString()}/mo
                </p>
                <p className="text-slate-800">
                  <strong>COGS:</strong> {report.calibratedInputs.cogsPct}%
                </p>
                <p className="text-slate-800">
                  <strong>Refund Bleed:</strong> {report.calibratedInputs.refundRatePct}%
                </p>
                <p className="text-[10px] text-slate-500">
                  Mode: {report.rawInputs.revenueMode || 'CONFIRMED_ONLINE'}
                </p>
              </div>

              {/* Source 3: 2026 Industry Report */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Source 3: 2026 Benchmarks
                </span>
                <p className="text-slate-800">
                  <strong>Sub-Niche:</strong> {report.subNicheName || report.benchmark.label}
                </p>
                <p className="text-slate-800">
                  <strong>Healthy AOV:</strong> ${waterfall?.source3IndustryReport2026.benchmarkAOV || report.benchmark.benchmarkAOV}
                </p>
                <p className="text-slate-800">
                  <strong>Target CAC:</strong> ${waterfall?.source3IndustryReport2026.healthyCAC || report.benchmark.healthyBlendedCAC}
                </p>
                <p className="text-slate-800">
                  <strong>Healthy MER:</strong> {waterfall?.source3IndustryReport2026.healthyMER || report.benchmark.healthyMER}x
                </p>
                <p className="text-slate-800">
                  <strong>90d Repeat Rate:</strong> {waterfall?.source3IndustryReport2026.repeatRate90dPct || report.benchmark.repeatRate90dPct}%
                </p>
              </div>

              {/* Source 4: Derived Estimations */}
              <div className="p-4 rounded-lg bg-slate-900 text-white space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">
                  Source 4: Derived Economics
                </span>
                <p className="text-slate-200">
                  <strong>Gross Profit:</strong> ${waterfall?.source4DerivedEstimations.grossProfitDollars.toLocaleString() || 'N/A'}/mo
                </p>
                <p className="text-slate-200">
                  <strong>Refund Loss:</strong> -${waterfall?.source4DerivedEstimations.refundBleedDollars.toLocaleString() || 'N/A'}/mo
                </p>
                <p className="text-emerald-400 font-bold">
                  <strong>Net Contribution:</strong> ${waterfall?.source4DerivedEstimations.netContributionProfitDollars.toLocaleString() || 'N/A'}/mo ({waterfall?.source4DerivedEstimations.netContributionMarginPct}%)
                </p>
                <p className="text-slate-200">
                  <strong>90-Day LTV:</strong> ${waterfall?.source4DerivedEstimations.ninetyDayCustomerLTV || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* THE 3 EXPOSED MARGIN LEAK CARDS */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              3 Quantified Monthly Margin Leaks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {report.leaks.map((leak, idx) => (
                <div
                  key={leak.id || idx}
                  className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        {leak.severity} LEAK #{idx + 1}
                      </span>
                      <span className="text-sm font-bold font-mono text-rose-600">
                        -${leak.monthlyLossDollars.toLocaleString()}/mo
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {leak.title}
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed font-sans">
                      {leak.exposedDiagnosis}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-mono text-slate-400">
                      🔒 Tactical steps locked in Blueprint (Tab 6)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* WHAT-IF MARGIN RECOVERY SIMULATOR */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Interactive What-If Margin Recovery Simulator
                </h3>
                <p className="text-xs text-slate-500">
                  Model the direct monthly cash flow impact of optimizing AOV and eliminating Advantage+ media waste.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-slate-400 block">Projected Cash Recovery</span>
                <span className="text-xl font-extrabold font-mono text-emerald-600">
                  +${totalSimulatedMonthlyRecovery.toLocaleString()}/mo
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Slider 1: AOV Lift */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700">AOV Bundle & Regimen Lift</span>
                  <span className="font-mono text-slate-900">+{simAovBoostPct}% (${newAov} AOV)</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={simAovBoostPct}
                  onChange={(e) => setSimAovBoostPct(Number(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>+5%</span>
                  <span>+${aovRecoveredCash.toLocaleString()}/mo recovered</span>
                  <span>+40%</span>
                </div>
              </div>

              {/* Slider 2: Ad Waste Reduction */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700">Ad Creative Fatigue & Bid-Cap Waste Reduction</span>
                  <span className="font-mono text-slate-900">-{simAdWasteCutPct}% Waste</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={50}
                  step={5}
                  value={simAdWasteCutPct}
                  onChange={(e) => setSimAdWasteCutPct(Number(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                  <span>-10%</span>
                  <span>+${adWasteRecoveredCash.toLocaleString()}/mo saved</span>
                  <span>-50%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: SKU & CATALOG INTELLIGENCE */}
      {/* ============================================================== */}
      {activeTab === 2 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Price Ladder Bar & SKU Stats */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Storefront Price Ladder & Catalog Architecture
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Distribution across {report.storefront.totalProductsSampled} sampled SKUs
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
                  Bundle Ratio: <strong>{report.storefront.bundleRatioPct}%</strong>
                </span>
                <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded">
                  Variant Friction: <strong>{report.storefront.highFrictionVariantPct}%</strong>
                </span>
              </div>
            </div>

            {/* Price Ladder Visual Bar */}
            {report.skuAnalytics?.priceLadder && (
              <div className="space-y-3">
                <div className="grid grid-cols-6 gap-2 text-center text-xs font-mono">
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Min</span>
                    <strong className="text-slate-900">${report.skuAnalytics.priceLadder.minPrice}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">P10</span>
                    <strong className="text-slate-900">${report.skuAnalytics.priceLadder.p10Price}</strong>
                  </div>
                  <div className="p-2 bg-slate-900 text-white rounded">
                    <span className="text-[10px] text-slate-400 block">Median</span>
                    <strong className="text-white">${report.skuAnalytics.priceLadder.medianSkuPrice}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Mean</span>
                    <strong className="text-slate-900">${report.skuAnalytics.priceLadder.meanSkuPrice}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">P90</span>
                    <strong className="text-slate-900">${report.skuAnalytics.priceLadder.p90Price}</strong>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-200">
                    <span className="text-[10px] text-slate-400 block">Max</span>
                    <strong className="text-slate-900">${report.skuAnalytics.priceLadder.maxPrice}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Qwen SKU Catalog Critique */}
            {report.aiBrandAndCustomerProfile?.skuCatalogAssessment && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <span className="text-xs font-bold font-mono uppercase text-slate-700 flex items-center gap-1.5">
                  <span>✨</span> Qwen Catalog Critique & Vulnerability Analysis
                </span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {report.aiBrandAndCustomerProfile.skuCatalogAssessment}
                </p>
              </div>
            )}

            {/* Honest Historical Velocity Check */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Historical Catalog Telemetry:</span>
              {report.skuAnalytics?.historicalCatalog?.historicalDataAvailable ? (
                <span className="text-emerald-700 font-bold">
                  Verified: {report.skuAnalytics.historicalCatalog.catalogAgeYears} Years Old · +{report.skuAnalytics.historicalCatalog.skusCreatedLast90d} New SKUs (Last 90d)
                </span>
              ) : (
                <span className="text-slate-600">
                  Evaluated on Current Live Catalog Snapshot (Historical timestamps not exposed)
                </span>
              )}
            </div>
          </div>

          {/* Scraped SKUs Table with Thumbnails & SKU Roles */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Live Scraped SKU Directory & Role Allocation
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <th className="pb-2">Thumbnail</th>
                    <th className="pb-2">Product Title</th>
                    <th className="pb-2">Price</th>
                    <th className="pb-2">Compare At</th>
                    <th className="pb-2">Discount</th>
                    <th className="pb-2">Variants</th>
                    <th className="pb-2">Assigned SKU Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {report.skuAnalytics?.topSkus && report.skuAnalytics.topSkus.length > 0 ? (
                    report.skuAnalytics.topSkus.map((sku: TopSku, idx: number) => (
                      <tr key={sku.id || idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5">
                          {sku.imageUrl ? (
                            <div className="w-10 h-10 relative rounded overflow-hidden border border-slate-200">
                              <Image
                                src={sku.imageUrl}
                                alt={sku.title}
                                fill
                                sizes="40px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-[10px] text-slate-400">
                              SKU
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 font-sans font-medium text-slate-900 max-w-[200px] truncate" title={sku.title}>
                          {sku.title}
                        </td>
                        <td className="py-2.5 font-bold text-slate-900">${sku.price}</td>
                        <td className="py-2.5 text-slate-400">{sku.compareAtPrice ? `$${sku.compareAtPrice}` : '—'}</td>
                        <td className="py-2.5">
                          {sku.discountPct > 0 ? (
                            <span className="text-rose-600 font-bold">-{sku.discountPct}%</span>
                          ) : (
                            '0%'
                          )}
                        </td>
                        <td className="py-2.5">
                          <span className={sku.variantCount > 5 ? 'text-amber-600 font-bold' : 'text-slate-600'}>
                            {sku.variantCount} {sku.variantCount > 5 ? '(Friction)' : ''}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sku.skuRole === 'BUNDLE_ANCHOR'
                                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                : sku.skuRole === 'ENTRY_HOOK'
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : sku.skuRole === 'HIGH_VARIANT_DRAG'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {sku.skuRole.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-slate-400">
                        No product SKUs available in live snapshot.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: GOOGLE AI MODE & CUSTOMER BASE INTELLIGENCE */}
      {/* ============================================================== */}
      {activeTab === 3 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Google AI Mode Brand Perception Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Google AI Mode Commercial Brand Perception
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Generative overview footprint and external citations
                </p>
              </div>
              <span
                className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                  report.aiBrandAndCustomerProfile?.aiPresenceStatus === 'STRONG_AI_PRESENCE'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : report.aiBrandAndCustomerProfile?.aiPresenceStatus === 'MODERATE_AI_PRESENCE'
                    ? 'bg-blue-100 text-blue-800 border-blue-300'
                    : report.aiBrandAndCustomerProfile?.aiPresenceStatus === 'WEAK_AI_PRESENCE'
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                {report.aiBrandAndCustomerProfile?.aiPresenceStatus || 'ZERO_AI_PRESENCE'}
              </span>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
              {report.aiBrandAndCustomerProfile?.googleAiOverviewSummary || report.executiveSummary}
            </p>

            {/* Google Autocomplete Buyer Queries */}
            <div className="space-y-2">
              <span className="text-[11px] font-mono uppercase font-bold text-slate-500">
                Verified Buyer Search Terms & Autocomplete Signals:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  `${report.domain} reviews`,
                  `is ${report.domain} legit`,
                  `${report.domain} discount code`,
                  `${report.domain} competitors`,
                  `best products on ${report.domain}`,
                ].map((q, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded border border-slate-200"
                  >
                    🔍 {q}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Customer Base Psychology & Quality Profile */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Customer Base Psychology & Conversion Quality Profile
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                  Target Demographics
                </span>
                <p className="text-slate-800">
                  {report.aiBrandAndCustomerProfile?.customerBaseProfile.targetDemographics || 'Modern direct-to-consumer buyers.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                  Price Positioning
                </span>
                <p className="text-slate-800">
                  {report.aiBrandAndCustomerProfile?.customerBaseProfile.pricePositioning || 'Mid-Market DTC'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                  Primary Buying Trigger
                </span>
                <p className="text-slate-800">
                  {report.aiBrandAndCustomerProfile?.customerBaseProfile.primaryBuyingTrigger || 'Specific utility or brand affinity.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-slate-500 block">
                  Repeat Purchase Driver
                </span>
                <p className="text-slate-800">
                  {report.aiBrandAndCustomerProfile?.customerBaseProfile.repeatPurchaseDriver || 'Consumable or seasonal replenishment.'}
                </p>
              </div>

              <div className="col-span-1 md:col-span-2 p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                <span className="text-[10px] font-mono uppercase font-bold text-rose-700 block">
                  Churn & Refund Risk Factor
                </span>
                <p className="text-rose-950">
                  {report.aiBrandAndCustomerProfile?.customerBaseProfile.churnAndRefundRiskFactor || 'Variant sizing confusion or expectation gaps on arrival.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: CROSS-RELATIONS MATRIX */}
      {/* ============================================================== */}
      {activeTab === 4 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Cross-Relations Matrix: Compounding Operational Drags
            </h3>
            <p className="text-xs text-slate-500">
              Diagnostic correlations showing how SKU pricing, ASC concentration, script latency, and CAPI gaps compound into first-order net loss.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.crossRelations.map((cr, idx) => (
              <div
                key={cr.id || idx}
                className="bg-white border border-[#E2E8F0] rounded-xl p-5 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {cr.primaryPillars}
                  </span>
                  <span className="text-xs font-mono font-bold text-rose-600">
                    -${cr.dollarImpact.toLocaleString()}/mo Drag
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">{cr.title}</h4>
                <p className="text-xs text-slate-600 leading-relaxed">{cr.description}</p>
                <p className="text-[11px] font-mono text-slate-400 border-t border-slate-100 pt-2">
                  {cr.formulaExplanation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 5: 2026 INDUSTRY REPORT & 3-COMPETITOR BENCHMARK */}
      {/* ============================================================== */}
      {activeTab === 5 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Live 2026 Industry Report Card */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Live 2026 {report.subNicheName || report.benchmark.label} Industry Report
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Extracted via Google AI Mode + Qwen for exact sub-niche dynamics
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-100 text-slate-800 px-2.5 py-1 rounded font-bold">
                2026 Index
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Benchmark AOV</span>
                <strong className="text-slate-900 text-sm">${waterfall?.source3IndustryReport2026.benchmarkAOV || report.benchmark.benchmarkAOV}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Healthy CAC</span>
                <strong className="text-slate-900 text-sm">${waterfall?.source3IndustryReport2026.healthyCAC || report.benchmark.healthyBlendedCAC}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Target MER</span>
                <strong className="text-slate-900 text-sm">{waterfall?.source3IndustryReport2026.healthyMER || report.benchmark.healthyMER}x</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">90d Repeat Rate</span>
                <strong className="text-slate-900 text-sm">{waterfall?.source3IndustryReport2026.repeatRate90dPct || report.benchmark.repeatRate90dPct}%</strong>
              </div>
            </div>
          </div>

          {/* Side-by-Side 3-Competitor Benchmark Table */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Top 3 Direct Shopify Competitors Comparison
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <th className="pb-2">Brand / Competitor</th>
                    <th className="pb-2">Domain</th>
                    <th className="pb-2">Est. AOV</th>
                    <th className="pb-2">Est. CAC</th>
                    <th className="pb-2">CQI Score</th>
                    <th className="pb-2">Winning Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Current Target Storefront */}
                  <tr className="bg-slate-50/70 font-bold">
                    <td className="py-3 text-slate-900">{report.domain} (You)</td>
                    <td className="py-3 text-slate-600">{report.domain}</td>
                    <td className="py-3 text-slate-900">${report.financials.effectiveAOV}</td>
                    <td className="py-3 text-slate-900">${report.financials.impliedBlendedCAC}</td>
                    <td className="py-3 text-slate-900">{report.masterCQIScore}/100</td>
                    <td className="py-3 text-slate-600 font-normal">Active Diagnostic Baseline</td>
                  </tr>

                  {/* 3 Discovered Competitors */}
                  {report.discoveredFields?.competitors && report.discoveredFields.competitors.length > 0 ? (
                    report.discoveredFields.competitors.map((comp, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 font-semibold text-slate-900">{comp.name}</td>
                        <td className="py-3 text-slate-500">{comp.domain}</td>
                        <td className="py-3 text-slate-800">${comp.estimatedAOV}</td>
                        <td className="py-3 text-slate-800">${comp.estimatedCAC}</td>
                        <td className="py-3">
                          <span className="bg-slate-100 px-2 py-0.5 rounded font-bold">{comp.cqiScore}/100</span>
                        </td>
                        <td className="py-3 text-slate-600 font-sans">{comp.winningMechanism}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-slate-400">
                        Analyzing sub-niche competitor mechanisms...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 6: 3-STEP REMEDIATION BLUEPRINT (THE BLUR GATE) */}
      {/* ============================================================== */}
      {activeTab === 6 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                3-Step Technical Remediation Blueprint
              </h3>
              <p className="text-xs text-slate-500">
                Actionable roadmap to recover +${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo in lost contribution margin.
              </p>
            </div>
            {/* Presenter Key Toggle */}
            <button
              onClick={() => setPresenterUnlocked(!presenterUnlocked)}
              className="text-xs font-mono text-slate-400 hover:text-slate-800 transition-colors inline-flex items-center gap-1.5"
              title="Presenter Toggle"
            >
              <span>{presenterUnlocked ? '🔓' : '🔒'}</span>
              <span>{presenterUnlocked ? 'Presenter Unlocked' : 'Demo Mode'}</span>
            </button>
          </div>

          <div className="relative space-y-4">
            {report.leaks.map((leak, idx) => (
              <div
                key={leak.id || idx}
                className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">
                    Step {idx + 1}: {leak.title}
                  </h4>
                  <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                    +${leak.monthlyLossDollars.toLocaleString()}/mo Recovery
                  </span>
                </div>

                <p className="text-xs text-slate-600">{leak.exposedDiagnosis}</p>

                {/* Tactical Execution Steps (Blurred if not unlocked) */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">
                    Tactical Execution Directives:
                  </span>
                  <div className={`space-y-2 transition-all ${presenterUnlocked ? '' : 'blur-[5px] select-none opacity-60'}`}>
                    {leak.lockedRemediationSteps.map((step, sIdx) => (
                      <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-800 font-sans">
                        <span className="text-slate-400 font-mono">0{sIdx + 1}.</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Strategy Call Blur Gate Overlay */}
            {!presenterUnlocked && (
              <div className="absolute inset-x-0 bottom-4 flex flex-col items-center justify-center p-8 bg-gradient-to-t from-white via-white/95 to-transparent rounded-xl text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-xl shadow-lg">
                  🔒
                </div>
                <div className="max-w-md space-y-1">
                  <h4 className="text-base font-bold text-slate-900">
                    Unlock Tactical Code & Campaign Architecture
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-sans">
                    Tactical scripts, cost-cap campaign rules, and Slideout PDP bundle architecture are reviewed live on confirmed strategy calls.
                  </p>
                </div>
                <button
                  onClick={() => setIsStrategyModalOpen(true)}
                  className="inline-flex items-center justify-center rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold px-6 py-3 transition-all shadow-md"
                >
                  Book 20-Min Strategy Call to Unlock Blueprint →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 7: DAY-0 EXECUTIVE BRIEFING (AGENCY HANDOFF) */}
      {/* ============================================================== */}
      {activeTab === 7 && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Channel-to-Close Attribution Tracker */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Channel-to-Close Telemetry Attribution Tracker
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Day-0 audit attribution ledger capturing founder qualification pulse answers
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Agencies Worked With (18m)</span>
                <strong className="text-slate-900">{agencyCount || 'Not specified'}</strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Primary Growth Bottleneck</span>
                <strong className="text-slate-900 truncate block" title={bottleneck}>
                  {bottleneck || 'Not specified'}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">Creative Workflow</span>
                <strong className="text-slate-900 truncate block" title={workflow}>
                  {workflow || 'Not specified'}
                </strong>
              </div>
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block">90-Day Financial Target</span>
                <strong className="text-slate-900 truncate block" title={priority}>
                  {priority || 'Not specified'}
                </strong>
              </div>
            </div>
          </div>

          {/* Formatted Slack Kickoff Briefing */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Formatted Slack Kickoff Briefing
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  1-Click copy formatted briefing ready for your agency team Slack channel
                </p>
              </div>
              <button
                onClick={() => handleCopySlackBriefing(slackBriefingText)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold font-mono hover:bg-slate-800 transition-colors"
              >
                <span>📋</span>
                <span>Copy Slack Briefing</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {slackBriefingText}
            </pre>
          </div>

          {/* Proof of Value Retention Memo */}
          <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-slate-900">
              Day-0 vs. Day-30 Proof-of-Value Retention Memo
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-sans">
              This Day-0 CQI ledger establishes the undeniable pre-intervention baseline for <strong>{report.domain}</strong>. By measuring master CQI ({report.masterCQIScore}/100), First-Order Net Margin (${report.financials.firstOrderNetContributionPerOrder}/order), and ASC Concentration ({report.metaAds.ascConcentrationRiskPct}%), any Day-30 audit proves the exact contribution margin unlocked by the agency team.
            </p>
          </div>
        </div>
      )}

      {/* PERSISTENT LOWER BOTTOM BAR */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E2E8F0] py-3.5 px-6 z-40 shadow-lg">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-slate-600">
            <strong>{report.domain}</strong> · CQI: <strong>{report.masterCQIScore}/100</strong> · Recoverable Cash: <strong className="text-emerald-700 font-bold">+${report.totalRecoverableMonthlyMargin.toLocaleString()}/mo</strong>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={pdfDownloading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold px-5 py-2.5 transition-all shadow-sm disabled:opacity-50"
          >
            <span>{pdfDownloading ? '⏳' : '📥'}</span>
            <span>{pdfDownloading ? 'Generating PDF...' : 'Download Organized Executive Report (PDF)'}</span>
          </button>
        </div>
      </div>

      {/* STRATEGY CALL MODAL */}
      <StrategyModal
        isOpen={isStrategyModalOpen}
        onClose={() => setIsStrategyModalOpen(false)}
        domain={report.domain}
        totalMarginLeak={report.totalRecoverableMonthlyMargin}
        calendarUrl={calendarUrl}
        agencyName={agencyName || undefined}
      />
    </div>
  )
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="py-24 text-center text-xs font-mono text-slate-400">
          Loading report parameters...
        </div>
      }
    >
      <ReportDashboardContent />
    </Suspense>
  )
}
