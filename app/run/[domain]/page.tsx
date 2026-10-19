'use client'

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { normalizeDomain } from '@/lib/utils/validation'
import { AgencyQualificationAnswers } from '@/lib/cqi/types'

function RunContent() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const rawDomain = (params?.domain as string) || ''
  const domain = normalizeDomain(rawDomain)

  // Progress animation state
  const [progress, setProgress] = useState(5)
  const [stageText, setStageText] = useState('Parsing Shopify /products.json SKU pricing & bundle architecture...')
  const [auditDone, setAuditDone] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)

  // 4 MCQs state
  const [currentMCQ, setCurrentMCQ] = useState(0)
  const [answers, setAnswers] = useState<AgencyQualificationAnswers>({
    agenciesWorkedWith: '',
    biggestGrowthIssue: '',
    creativeWorkflow: '',
    ninetyDayPriority: '',
  })
  const [mcqDone, setMcqDone] = useState(false)

  // Avoid multiple runs
  const hasTriggeredRef = useRef(false)

  // Stage text updater based on progress
  useEffect(() => {
    if (progress < 25) {
      setStageText('Parsing Shopify /products.json SKU pricing & bundle architecture...')
    } else if (progress < 50) {
      setStageText('Scanning DOM <head> for CAPI, retention stack & mobile script drag...')
    } else if (progress < 75) {
      setStageText('Querying Apify Meta Ad Library & Google AI Search benchmarks...')
    } else if (progress < 100) {
      setStageText('Running Reality-Check Guard & computing 5-Pillar CQI Ledger...')
    } else {
      setStageText('Diagnostic compilation complete. Preparing executive report...')
    }
  }, [progress])

  // Progress simulation ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92 && !auditDone) {
          return 92 // Hold at 92% until API actually returns
        }
        if (prev >= 100) {
          clearInterval(timer)
          return 100
        }
        return prev + 1
      })
    }, 90)

    return () => clearInterval(timer)
  }, [auditDone])

  // Background audit trigger
  useEffect(() => {
    if (!domain || hasTriggeredRef.current) return
    hasTriggeredRef.current = true

    const runTelemetry = async () => {
      try {
        let agencyPartner: string | null = null
        try {
          agencyPartner = sessionStorage.getItem('cqi_agency_partner')
        } catch {
          // ignore
        }

        const payload = {
          domain,
          vertical: searchParams.get('vertical') || 'supplements',
          monthlyRevenue: Number(searchParams.get('monthlyRevenue') || '150000'),
          monthlyAdSpend: Number(searchParams.get('monthlyAdSpend') || '50000'),
          cogsPct: Number(searchParams.get('cogsPct') || '24'),
          refundRatePct: Number(searchParams.get('refundRatePct') || '6'),
          agencyName: agencyPartner || undefined,
        }

        const res = await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Diagnostic scan failed.')
        }

        if (data.report) {
          try {
            localStorage.setItem(`nyxir_report_${domain.toLowerCase()}`, JSON.stringify(data.report))
          } catch {
            // ignore
          }
        }

        setProgress(100)
        setAuditDone(true)
      } catch (err: unknown) {
        const errObj = err as Error
        console.error('[Run Diagnostic Error]', errObj)
        setAuditError(errObj.message || 'Error occurred during telemetry scan.')
      }
    }

    runTelemetry()
  }, [domain, searchParams])

  const syncQualificationAnswers = useCallback((currentAnswers: AgencyQualificationAnswers) => {
    const merged = {
      ...currentAnswers,
      agencyCount: currentAnswers.agenciesWorkedWith || currentAnswers.agencyCount,
      primaryBottleneck: currentAnswers.biggestGrowthIssue || currentAnswers.primaryBottleneck,
      ninetyDayTarget: currentAnswers.ninetyDayPriority || currentAnswers.ninetyDayTarget,
    }

    try {
      sessionStorage.setItem(`cqi_mcq_${domain}`, JSON.stringify(merged))
    } catch {
      // ignore
    }

    try {
      const rawLocal = localStorage.getItem(`nyxir_report_${domain.toLowerCase()}`)
      if (rawLocal) {
        const parsed = JSON.parse(rawLocal)
        parsed.qualificationAnswers = {
          ...parsed.qualificationAnswers,
          ...merged,
        }
        localStorage.setItem(`nyxir_report_${domain.toLowerCase()}`, JSON.stringify(parsed))
      }
    } catch {
      // ignore
    }

    fetch('/api/report', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain,
        qualificationAnswers: merged,
      }),
    }).catch(() => {})
  }, [domain])

  // Handshake redirection: trigger once both audit is done and MCQs are done (or skipped)
  useEffect(() => {
    if (auditDone && (mcqDone || currentMCQ >= 4)) {
      syncQualificationAnswers(answers)

      const redirectTimer = setTimeout(() => {
        router.push(`/report/${encodeURIComponent(domain)}`)
      }, 700)

      return () => clearTimeout(redirectTimer)
    }
  }, [auditDone, mcqDone, currentMCQ, domain, answers, router, syncQualificationAnswers])

  const mcqQuestions = [
    {
      id: 'agenciesWorkedWith' as const,
      title: 'MCQ 1: How many paid media agencies have you worked with in the past 18 months?',
      options: [
        '0 (In-House Only)',
        '1 Agency',
        '2–3 Agencies',
        '4+ Agencies',
      ],
    },
    {
      id: 'biggestGrowthIssue' as const,
      title: 'MCQ 2: What do you believe is your biggest paid growth issue right now?',
      options: [
        'Meta Advantage+ dumping budget into 1–2 fatiguing ads',
        'High CAC / Losing money on first-time orders',
        'Low 60-day repeat purchase rate',
        'Creative bottleneck / AI ads failing to convert',
      ],
    },
    {
      id: 'creativeWorkflow' as const,
      title: 'MCQ 3: How is your ad creative currently produced?',
      options: [
        '100% Human UGC / Studio',
        'Hybrid (Human Hooks + AI Edits)',
        'Mostly AI / Automated',
        'Ad-Hoc / Founder-Led',
      ],
    },
    {
      id: 'ninetyDayPriority' as const,
      title: 'MCQ 4: What is your #1 90-day priority?',
      options: [
        'Cut Blended CAC by 20–30%',
        'Scale top-line revenue 2x profitably',
        'Increase AOV & bundle conversion rate',
      ],
    },
  ]

  const handleSelectOption = (questionKey: keyof AgencyQualificationAnswers, option: string) => {
    const updated = { ...answers, [questionKey]: option }
    setAnswers(updated)
    syncQualificationAnswers(updated)

    if (currentMCQ + 1 < mcqQuestions.length) {
      setCurrentMCQ((prev) => prev + 1)
    } else {
      setMcqDone(true)
    }
  }

  const handleSkipMCQs = () => {
    syncQualificationAnswers(answers)
    setMcqDone(true)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6">
      {/* Top Section — Progress Bar & Telemetry Status */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center text-xs">
          <span className="font-mono text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse"></span>
            Telemetry Pipeline Active
          </span>
          <span className="font-mono font-bold text-slate-900">{progress}%</span>
        </div>

        {/* Smooth Continuous Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className="bg-[#0F172A] h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Live Stage Pill */}
        <div className="flex items-center gap-2 text-xs font-mono text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          <svg className="animate-spin h-3.5 w-3.5 text-slate-900 flex-shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span className="truncate">{stageText}</span>
        </div>

        {auditError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-mono">
            ⚠️ {auditError}
          </div>
        )}
      </div>

      {/* Center Section — 4 In-Flight Executive Qualification MCQs */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="space-y-1 border-b border-slate-100 pb-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-slate-500">
              Executive Qualification Pulse • {Math.min(currentMCQ + 1, 4)} of 4
            </span>
            <button
              onClick={handleSkipMCQs}
              className="text-[11px] font-mono text-slate-400 hover:text-slate-800 underline transition-colors"
            >
              Skip to Report →
            </button>
          </div>
          <p className="text-xs text-slate-600">
            While Nyxir compiles your store telemetry, complete these 4 quick diagnostic pulses to calibrate your remediation blueprint:
          </p>
        </div>

        {!mcqDone && currentMCQ < mcqQuestions.length ? (
          <div className="space-y-4">
            <h2 className="text-sm md:text-base font-bold text-slate-900">
              {mcqQuestions[currentMCQ].title}
            </h2>

            <div className="space-y-2.5">
              {mcqQuestions[currentMCQ].options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    handleSelectOption(
                      mcqQuestions[currentMCQ].id as keyof AgencyQualificationAnswers,
                      option
                    )
                  }
                  className="w-full p-3.5 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 text-left text-xs font-medium text-slate-800 transition-all flex items-center justify-between group"
                >
                  <span>{option}</span>
                  <span className="text-slate-300 group-hover:text-slate-900 transition-colors">
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto text-sm font-bold">
              ✓
            </div>
            <p className="text-sm font-bold text-slate-900">Diagnostic Pulses Recorded</p>
            <p className="text-xs text-slate-500 font-mono">
              {auditDone ? 'Finalizing report render...' : 'Waiting for parallel telemetry to complete...'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RunPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 font-mono text-xs text-slate-400">Loading diagnostic runner...</div>}>
      <RunContent />
    </Suspense>
  )
}
