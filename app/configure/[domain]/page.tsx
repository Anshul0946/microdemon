'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { VERTICAL_BENCHMARKS, EcommerceVertical } from '@/lib/config/benchmarks'
import { normalizeDomain } from '@/lib/utils/validation'

export default function ConfigurePage() {
  const router = useRouter()
  const params = useParams()
  const rawDomain = (params?.domain as string) || ''
  const domain = normalizeDomain(rawDomain)

  // Pre-extracted catalog preview from Step 1
  const [catalogPreview, setCatalogPreview] = useState<{
    storeTitle: string
    sampleProductCount: number
    medianPrice: number
    detectedCurrency: string
  } | null>(null)

  // 5 Private Baseline Inputs
  const [vertical, setVertical] = useState<EcommerceVertical>('supplements')
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(150000)
  const [monthlyAdSpend, setMonthlyAdSpend] = useState<number>(50000)
  const [cogsPct, setCogsPct] = useState<number>(24)
  const [refundRatePct, setRefundRatePct] = useState<number>(6)

  useEffect(() => {
    if (!domain) return
    try {
      const stored = sessionStorage.getItem(`cqi_preview_${domain}`)
      if (stored) {
        setCatalogPreview(JSON.parse(stored))
      }
    } catch {
      // ignore
    }
  }, [domain])

  // When vertical changes, auto-calibrate COGS and Refund to 2026 benchmarks
  const handleSelectVertical = (v: EcommerceVertical) => {
    setVertical(v)
    const bench = VERTICAL_BENCHMARKS[v]
    if (bench) {
      setCogsPct(bench.defaultCogsPct)
      setRefundRatePct(bench.avgRefundRatePct)
    }
  }

  // Live Implied MER
  const currentMER = Number((monthlyRevenue / Math.max(1, monthlyAdSpend)).toFixed(2))
  const healthyMER = VERTICAL_BENCHMARKS[vertical]?.healthyMER || 3.0
  const isHealthyMER = currentMER >= healthyMER

  const handleLaunchScan = (e: React.FormEvent) => {
    e.preventDefault()
    const query = new URLSearchParams({
      vertical,
      monthlyRevenue: monthlyRevenue.toString(),
      monthlyAdSpend: monthlyAdSpend.toString(),
      cogsPct: cogsPct.toString(),
      refundRatePct: refundRatePct.toString(),
    }).toString()

    router.push(`/run/${encodeURIComponent(domain)}?${query}`)
  }

  const verticalOptions: Array<{ id: EcommerceVertical; title: string; subtitle: string; icon: string }> = [
    { id: 'supplements', title: 'Supplements & Health', subtitle: 'Benchmark: AG1 / Thorne', icon: '💊' },
    { id: 'skincare', title: 'Skincare & Beauty', subtitle: 'Benchmark: Summer Fridays', icon: '✨' },
    { id: 'apparel', title: 'Apparel & Fashion', subtitle: 'Benchmark: Vuori / Gymshark', icon: '👕' },
    { id: 'food_bev', title: 'Food & Beverage', subtitle: 'Benchmark: Magic Spoon', icon: '🥣' },
    { id: 'home_lifestyle', title: 'Home & Lifestyle', subtitle: 'Benchmark: Our Place', icon: '🏡' },
    { id: 'pets', title: 'Pet Health & Food', subtitle: 'Benchmark: Native Pet', icon: '🐾' },
  ]

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Back link */}
      <nav>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Change Target Storefront
        </Link>
      </nav>

      {/* Verified Shopify Confirmation Banner */}
      <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
            ✓
          </span>
          <div>
            <p className="font-semibold text-xs text-emerald-900 uppercase tracking-wider font-mono">
              Verified Shopify Storefront
            </p>
            <p className="text-sm font-bold text-slate-900 font-mono">
              {domain}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-600 flex items-center gap-3">
          <span className="bg-white/80 px-2.5 py-1 rounded border border-emerald-200">
            {catalogPreview?.sampleProductCount ? `${catalogPreview.sampleProductCount}+ Sample SKUs` : 'Storefront Indexed'}
          </span>
          <span className="bg-white/80 px-2.5 py-1 rounded border border-emerald-200">
            Detected Median Price: <strong className="text-slate-900">${catalogPreview?.medianPrice || 68}</strong>
          </span>
        </div>
      </div>

      {/* Step Header */}
      <div className="space-y-1 border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Step 2: Private Economic Baseline Calibration
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Public telemetry (SKUs, pixels, and ad density) has already been captured. We only ask for the 5 private financial baselines required to compute your deterministic CQI ledger.
        </p>
      </div>

      <form onSubmit={handleLaunchScan} className="space-y-8">
        {/* Input 1: Vertical Selector */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
            1. E-Commerce Category Vertical (Auto-Calibrates 2026 Industry Benchmarks)
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {verticalOptions.map((opt) => {
              const isSelected = vertical === opt.id
              return (
                <button
                  type="button"
                  key={opt.id}
                  onClick={() => handleSelectVertical(opt.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm ring-2 ring-slate-900 ring-offset-2'
                      : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="text-lg">{opt.icon}</span>
                    {isSelected && <span className="text-[10px] font-mono bg-white/20 px-1.5 py-0.5 rounded">Active</span>}
                  </div>
                  <div>
                    <p className={`font-semibold text-xs ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                      {opt.title}
                    </p>
                    <p className={`text-[10px] mt-0.5 font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {opt.subtitle}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 md:p-8 space-y-6 shadow-sm">
          {/* Input 2: Monthly Revenue */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>2. Estimated Monthly Gross Revenue</span>
              <span className="font-mono text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                ${monthlyRevenue.toLocaleString()}/mo
              </span>
            </div>
            <input
              type="range"
              min={15000}
              max={5000000}
              step={5000}
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>$15,000</span>
              <span>$1,000,000</span>
              <span>$5,000,000+</span>
            </div>
          </div>

          {/* Input 3: Monthly Ad Spend */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                3. Monthly Paid Media Ad Spend
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    isHealthyMER
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Implied MER: {currentMER}x {isHealthyMER ? '(Healthy)' : '(Under Pressure)'}
                </span>
              </span>
              <span className="font-mono text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                ${monthlyAdSpend.toLocaleString()}/mo
              </span>
            </div>
            <input
              type="range"
              min={3000}
              max={1500000}
              step={1000}
              value={monthlyAdSpend}
              onChange={(e) => setMonthlyAdSpend(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>$3,000</span>
              <span>$250,000</span>
              <span>$1,500,000+</span>
            </div>
          </div>

          {/* Input 4: Landed COGS */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>4. Landed COGS & Fulfillment (% of Revenue)</span>
              <span className="font-mono text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {cogsPct}%
              </span>
            </div>
            <input
              type="range"
              min={15}
              max={70}
              step={1}
              value={cogsPct}
              onChange={(e) => setCogsPct(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>15% (High Margin)</span>
              <span>Benchmark Default: {VERTICAL_BENCHMARKS[vertical]?.defaultCogsPct}%</span>
              <span>70% (Heavy COGS)</span>
            </div>
          </div>

          {/* Input 5: 30-Day Return / Refund Rate */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-700">
              <span>5. 30-Day Return / Refund Rate (%)</span>
              <span className="font-mono text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {refundRatePct}%
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={35}
              step={1}
              value={refundRatePct}
              onChange={(e) => setRefundRatePct(Number(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1% (Low Returns)</span>
              <span>Category Norm: {VERTICAL_BENCHMARKS[vertical]?.avgRefundRatePct}%</span>
              <span>35% (High Apparel Friction)</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-sm px-8 py-3.5 shadow-sm transition-colors"
          >
            Launch Deep Telemetry Scan →
          </button>
        </div>
      </form>
    </div>
  )
}
