'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const router = useRouter()
  const [domainInput, setDomainInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorState, setErrorState] = useState<{
    code: 'INVALID_URL' | 'UNREACHABLE_DOMAIN' | 'NOT_SHOPIFY' | 'SERVER_ERROR'
    message: string
  } | null>(null)

  const handleVerifyAndProceed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domainInput.trim()) return

    setLoading(true)
    setErrorState(null)

    try {
      const res = await fetch('/api/validate-shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: domainInput.trim() }),
      })

      const data = await res.json()

      if (!res.ok || !data.ok) {
        setErrorState({
          code: data.code || 'SERVER_ERROR',
          message: data.message || 'Domain verification failed. Please try again.',
        })
        setLoading(false)
        return
      }

      // Valid Shopify Storefront!
      // Persist pre-extracted catalog metrics so Configure page never re-asks redundant questions
      try {
        sessionStorage.setItem(
          `cqi_preview_${data.domain}`,
          JSON.stringify({
            storeTitle: data.storeTitle,
            sampleProductCount: data.sampleProductCount,
            medianPrice: data.medianPrice,
            detectedCurrency: data.detectedCurrency,
          })
        )
        if (data.discovery) {
          sessionStorage.setItem(`cqi_discovery_${data.domain}`, JSON.stringify(data.discovery))
        }
      } catch {
        // ignore
      }

      router.push(`/configure/${encodeURIComponent(data.domain)}`)
    } catch (_err: unknown) {
      setErrorState({
        code: 'UNREACHABLE_DOMAIN',
        message: 'Network error connecting to verification gateway. Please check your connection and retry.',
      })
      setLoading(false)
    }
  }

  return (
    <div className="py-12 md:py-20 flex flex-col items-center justify-center text-center max-w-2xl mx-auto space-y-8">
      {/* Institutional Top Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-medium text-slate-700">
        <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse"></span>
        NYXIR CQI — DAY-0 STORE TELEMETRY & CUSTOMER QUALITY DIAGNOSTIC
      </div>

      {/* Hero Headline */}
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-[#0F172A] leading-tight">
          Quantify Customer Quality & Uncover Hidden Margin Leaks
        </h1>
        <p className="text-base text-slate-600 leading-relaxed max-w-xl mx-auto font-normal">
          The institutional diagnostic engine for Shopify brands. We crawl public storefront nodes, Meta ad libraries, and DOM script architecture to calculate your 5-pillar CQI ledger and recover lost first-order contribution margin.
        </p>
      </div>

      {/* Main Gatekeeper Card */}
      <div className="w-full bg-white border border-[#E2E8F0] rounded-xl p-6 md:p-8 shadow-sm space-y-6 text-left">
        <form onSubmit={handleVerifyAndProceed} className="space-y-4">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Target Shopify Storefront Domain
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. gymshark.com or drinkag1.com"
              value={domainInput}
              onChange={(e) => {
                setDomainInput(e.target.value)
                if (errorState) setErrorState(null)
              }}
              disabled={loading}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white placeholder:text-slate-400"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="sm:w-56 inline-flex items-center justify-center rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-sm font-semibold px-5 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Verifying Store...
                </span>
              ) : (
                'Verify & Initialize Diagnostic →'
              )}
            </button>
          </div>
        </form>

        {/* Dynamic Gatekeeper Feedback Alerts */}
        {errorState && (
          <div
            className={`p-4 rounded-lg border text-sm font-sans ${
              errorState.code === 'NOT_SHOPIFY'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg">
                {errorState.code === 'NOT_SHOPIFY' ? '⚠️' : '🚨'}
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-xs tracking-wide uppercase">
                  {errorState.code === 'NOT_SHOPIFY'
                    ? 'Non-Shopify Architecture Detected'
                    : errorState.code === 'UNREACHABLE_DOMAIN'
                    ? 'Store Unreachable'
                    : 'Invalid Domain Format'}
                </p>
                <p className="text-xs leading-relaxed">{errorState.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Trust & Methodology Micro-Pills */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-mono gap-2">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            $0 Public Telemetry Node
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Zero Login / OAuth Required
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-900"></span>
            Deterministic 5-Pillar Ledger
          </span>
        </div>
      </div>
    </div>
  )
}
