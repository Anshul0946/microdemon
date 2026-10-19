'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { VERTICAL_BENCHMARKS, EcommerceVertical } from '@/lib/config/benchmarks'
import { normalizeDomain } from '@/lib/utils/validation'
import { DiscoveryPayload, TopSku } from '@/lib/cqi/types'

export default function ConfigurePage() {
  const router = useRouter()
  const params = useParams()
  const rawDomain = (params?.domain as string) || ''
  const domain = normalizeDomain(rawDomain)

  const [_loadingDiscovery, setLoadingDiscovery] = useState(true)
  const [discovery, setDiscovery] = useState<DiscoveryPayload | null>(null)

  // Modes for Confirm vs Custom
  const [revenueMode, setRevenueMode] = useState<'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE' | 'BLENDED'>('CONFIRMED_ONLINE')
  const [adSpendMode, setAdSpendMode] = useState<'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE' | 'BLENDED'>('CONFIRMED_ONLINE')
  const [cogsMode, setCogsMode] = useState<'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'>('CONFIRMED_ONLINE')
  const [refundMode, setRefundMode] = useState<'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'>('CONFIRMED_ONLINE')
  const [verticalMode, setVerticalMode] = useState<'CONFIRMED_ONLINE' | 'CUSTOM_USER_OVERRIDE'>('CONFIRMED_ONLINE')

  // Values
  const [vertical, setVertical] = useState<EcommerceVertical>('supplements')

  // Custom User Inputs
  const [customRevenue, setCustomRevenue] = useState<number>(120000)
  const [customAdSpend, setCustomAdSpend] = useState<number>(40000)
  const [customCogs, setCustomCogs] = useState<number>(24)
  const [customRefund, setCustomRefund] = useState<number>(6)

  useEffect(() => {
    if (!domain) return

    const loadDiscoveryData = async () => {
      try {
        const stored = sessionStorage.getItem(`cqi_discovery_${domain}`)
        if (stored) {
          const parsed = JSON.parse(stored) as DiscoveryPayload
          initFromDiscovery(parsed)
          setLoadingDiscovery(false)
          return
        }

        // Fetch discovery live
        const res = await fetch(`/api/discover?domain=${encodeURIComponent(domain)}`)
        const data = await res.json()
        if (res.ok && data.ok) {
          sessionStorage.setItem(`cqi_discovery_${domain}`, JSON.stringify(data))
          initFromDiscovery(data)
        }
      } catch {
        // fallback
      } finally {
        setLoadingDiscovery(false)
      }
    }

    loadDiscoveryData()
  }, [domain])

  const initFromDiscovery = (data: DiscoveryPayload) => {
    setDiscovery(data)
    const fields = data.discoveredFields
    if (fields) {
      setVertical(fields.vertical)
      setCustomRevenue(fields.monthlyRevenue.value)
      setCustomAdSpend(fields.monthlyAdSpend.value)
      setCustomCogs(fields.cogsPct.value)
      setCustomRefund(fields.refundRatePct.value)
    }
  }

  const discoveredRev = discovery?.discoveredFields?.monthlyRevenue?.value || 120000
  const discoveredAdSpend = discovery?.discoveredFields?.monthlyAdSpend?.value || 40000
  const discoveredCogs = discovery?.discoveredFields?.cogsPct?.value || 24
  const discoveredRefund = discovery?.discoveredFields?.refundRatePct?.value || 6

  // Variance calculations
  const revDeltaPct = Math.round(Math.abs((customRevenue - discoveredRev) / Math.max(1, discoveredRev)) * 100)
  const isRevConflict = revenueMode !== 'CONFIRMED_ONLINE' && revDeltaPct > 35

  const adSpendDeltaPct = Math.round(Math.abs((customAdSpend - discoveredAdSpend) / Math.max(1, discoveredAdSpend)) * 100)
  const isAdSpendConflict = adSpendMode !== 'CONFIRMED_ONLINE' && adSpendDeltaPct > 35

  // Effective values passed to next step
  const effectiveRevenue =
    revenueMode === 'CONFIRMED_ONLINE'
      ? discoveredRev
      : revenueMode === 'BLENDED'
      ? Math.round((discoveredRev + customRevenue) / 2)
      : customRevenue

  const effectiveAdSpend =
    adSpendMode === 'CONFIRMED_ONLINE'
      ? discoveredAdSpend
      : adSpendMode === 'BLENDED'
      ? Math.round((discoveredAdSpend + customAdSpend) / 2)
      : customAdSpend

  const effectiveCogs = cogsMode === 'CONFIRMED_ONLINE' ? discoveredCogs : customCogs
  const effectiveRefund = refundMode === 'CONFIRMED_ONLINE' ? discoveredRefund : customRefund

  // Current MER
  const currentMER = Number((effectiveRevenue / Math.max(1, effectiveAdSpend)).toFixed(2))
  const healthyMER = discovery?.discoveredFields?.industryReport2026?.healthyMER || VERTICAL_BENCHMARKS[vertical]?.healthyMER || 3.0
  const isHealthyMER = currentMER >= healthyMER

  const handleLaunchScan = (e: React.FormEvent) => {
    e.preventDefault()
    const query = new URLSearchParams({
      vertical,
      monthlyRevenue: effectiveRevenue.toString(),
      monthlyAdSpend: effectiveAdSpend.toString(),
      cogsPct: effectiveCogs.toString(),
      refundRatePct: effectiveRefund.toString(),
      revenueMode,
      adSpendMode,
      cogsMode,
      refundMode,
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

  const pLadder = discovery?.skuAnalytics?.priceLadder
  const top4Skus: TopSku[] = discovery?.skuAnalytics?.topSkus?.slice(0, 4) || []
  const aiStatus = discovery?.aiBrandAndCustomerProfile?.aiPresenceStatus || 'ZERO_AI_PRESENCE'

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Back navigation */}
      <nav className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Change Target Storefront
        </Link>
        <span className="text-xs font-mono text-slate-400">Step 2 of 3: Baseline Intake</span>
      </nav>

      {/* TOP DISCOVERY SUMMARY CARD */}
      <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {discovery?.storeTitle || domain.split('.')[0].toUpperCase()}
              </h1>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                {domain}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-600">
              Sub-Niche:{' '}
              <strong className="text-slate-900">
                {discovery?.discoveredFields?.subNicheName || 'Modern E-Commerce Storefront'}
              </strong>
            </p>
          </div>

          {/* Google AI Presence Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
                aiStatus === 'STRONG_AI_PRESENCE'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : aiStatus === 'MODERATE_AI_PRESENCE'
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : aiStatus === 'WEAK_AI_PRESENCE'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-slate-100 text-slate-700 border border-slate-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  aiStatus === 'STRONG_AI_PRESENCE'
                    ? 'bg-emerald-600'
                    : aiStatus === 'MODERATE_AI_PRESENCE'
                    ? 'bg-blue-600'
                    : aiStatus === 'WEAK_AI_PRESENCE'
                    ? 'bg-amber-500'
                    : 'bg-slate-400'
                }`}
              />
              {aiStatus.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Real Scraped SKU Showcase & Price Ladder */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
              Storefront Price Ladder (Scraped Snapshot)
            </p>
            {pLadder ? (
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-slate-500">P10 Entry: ${pLadder.p10Price}</span>
                  <span className="text-slate-900 font-bold">Median SKU: ${pLadder.medianSkuPrice}</span>
                  <span className="text-slate-500">P90 Ceiling: ${pLadder.p90Price}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                  <div className="bg-slate-400 h-full w-[25%]" />
                  <div className="bg-slate-900 h-full w-[50%]" />
                  <div className="bg-slate-400 h-full w-[25%]" />
                </div>
                <p className="text-[10px] text-slate-500 font-mono text-center">
                  Min ${pLadder.minPrice} · Mean ${pLadder.meanSkuPrice} · Max ${pLadder.maxPrice} ({discovery?.skuAnalytics?.totalProductsSampled || 0} Products Sampled)
                </p>
              </div>
            ) : (
              <div className="h-16 bg-slate-100 animate-pulse rounded-lg" />
            )}
          </div>

          {/* 4 Scraped SKU Thumbnails */}
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2">
              Live Scraped SKUs
            </p>
            <div className="grid grid-cols-4 gap-2">
              {top4Skus.length > 0 ? (
                top4Skus.map((sku, idx) => (
                  <div
                    key={sku.id || idx}
                    className="group relative bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex flex-col items-center text-center overflow-hidden"
                  >
                    {sku.imageUrl ? (
                      <div className="w-12 h-12 relative mb-1">
                        <Image
                          src={sku.imageUrl}
                          alt={sku.title}
                          fill
                          sizes="48px"
                          className="object-cover rounded"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-slate-200 rounded flex items-center justify-center text-xs text-slate-400 mb-1">
                        SKU
                      </div>
                    )}
                    <span className="text-[9px] font-mono font-bold text-slate-900 truncate w-full">
                      ${sku.price}
                    </span>
                    <span className="text-[8px] text-slate-500 truncate w-full" title={sku.title}>
                      {sku.title}
                    </span>
                  </div>
                ))
              ) : (
                <div className="col-span-4 text-xs font-mono text-slate-400 py-3 text-center">
                  Indexing catalog SKUs...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Brand & Customer Base Preview */}
        {discovery?.aiBrandAndCustomerProfile && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
              <span>✨</span> Google AI Mode Brand Perception
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {discovery.aiBrandAndCustomerProfile.googleAiOverviewSummary}
            </p>
            <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div>
                <strong className="text-slate-800">Target Demographics:</strong>{' '}
                {discovery.aiBrandAndCustomerProfile.customerBaseProfile.targetDemographics}
              </div>
              <div>
                <strong className="text-slate-800">Buying Trigger:</strong>{' '}
                {discovery.aiBrandAndCustomerProfile.customerBaseProfile.primaryBuyingTrigger}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FORM: 5 CONFIRM OR CUSTOM CARDS */}
      <form onSubmit={handleLaunchScan} className="space-y-6">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-lg font-bold text-slate-900">
            Confirm Discovered Financials or Add Custom
          </h2>
          <p className="text-xs text-slate-500">
            Data found online is pre-filled. You can confirm discovered values with one click or provide your own custom numbers.
          </p>
        </div>

        {/* CARD 1: CATEGORY & COMPETITORS */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Parameter 1 of 5</span>
              <h3 className="text-sm font-bold text-slate-900">E-Commerce Category & Industry Competitors</h3>
              <p className="text-xs text-slate-500">
                Discovered Sub-Niche: <strong className="text-slate-800">{discovery?.discoveredFields?.subNicheName || 'Health & Wellness'}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setVerticalMode('CONFIRMED_ONLINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  verticalMode === 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Confirm Auto-Detected
              </button>
              <button
                type="button"
                onClick={() => setVerticalMode('CUSTOM_USER_OVERRIDE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  verticalMode === 'CUSTOM_USER_OVERRIDE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✏️ Select Different
              </button>
            </div>
          </div>

          {verticalMode === 'CUSTOM_USER_OVERRIDE' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 pt-2">
              {verticalOptions.map((opt) => {
                const isSelected = vertical === opt.id
                return (
                  <button
                    type="button"
                    key={opt.id}
                    onClick={() => {
                      setVertical(opt.id)
                      const b = VERTICAL_BENCHMARKS[opt.id]
                      if (b) {
                        setCustomCogs(b.defaultCogsPct)
                        setCustomRefund(b.avgRefundRatePct)
                      }
                    }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>{opt.icon}</span>
                      <span className="text-xs font-bold">{opt.title}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* CARD 2: MONTHLY REVENUE */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Parameter 2 of 5</span>
              <h3 className="text-sm font-bold text-slate-900">Estimated Monthly Gross Revenue</h3>
              <p className="text-xs text-slate-500">
                {discovery?.discoveredFields?.monthlyRevenue?.sourceExplanation || 'Derived from catalog volume & store signals'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRevenueMode('CONFIRMED_ONLINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  revenueMode === 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Confirm ${discoveredRev.toLocaleString()}/mo
              </button>
              <button
                type="button"
                onClick={() => setRevenueMode('CUSTOM_USER_OVERRIDE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  revenueMode !== 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✏️ Enter Custom Value
              </button>
            </div>
          </div>

          {revenueMode !== 'CONFIRMED_ONLINE' && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Custom Monthly Revenue:</span>
                <span className="font-mono text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded font-bold">
                  ${customRevenue.toLocaleString()}/mo
                </span>
              </div>
              <input
                type="range"
                min={15000}
                max={5000000}
                step={5000}
                value={customRevenue}
                onChange={(e) => setCustomRevenue(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />

              {/* DYNAMIC CONFLICT & AUTHENTICITY GUARD (AMBER RESOLUTION BOX) */}
              {isRevConflict && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold text-sm">⚠️</span>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-amber-900">
                        Online vs. Custom Input Variance ({revDeltaPct}% Difference)
                      </h4>
                      <p className="text-xs text-amber-900 mt-1">
                        Google AI Mode & storefront signals indicate <strong>${discoveredRev.toLocaleString()}/mo</strong> ({discovery?.discoveredFields?.monthlyRevenue?.sourceExplanation}), while you entered <strong>${customRevenue.toLocaleString()}/mo</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setRevenueMode('CONFIRMED_ONLINE')}
                      className="p-2.5 rounded-lg text-xs font-medium text-left border bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                    >
                      <strong className="block text-[11px]">1. Keep Verified Online</strong>
                      <span className="text-[10px] opacity-80">${discoveredRev.toLocaleString()}/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevenueMode('CUSTOM_USER_OVERRIDE')}
                      className={`p-2.5 rounded-lg text-xs font-medium text-left border ${
                        revenueMode === 'CUSTOM_USER_OVERRIDE'
                          ? 'bg-amber-900 text-white border-amber-900'
                          : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      <strong className="block text-[11px]">2. Use My Custom Number</strong>
                      <span className="text-[10px] opacity-80">${customRevenue.toLocaleString()}/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRevenueMode('BLENDED')}
                      className={`p-2.5 rounded-lg text-xs font-medium text-left border ${
                        revenueMode === 'BLENDED'
                          ? 'bg-amber-900 text-white border-amber-900'
                          : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      <strong className="block text-[11px]">3. Blend Both Signals</strong>
                      <span className="text-[10px] opacity-80">${Math.round((discoveredRev + customRevenue) / 2).toLocaleString()}/mo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 3: MONTHLY AD SPEND */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Parameter 3 of 5</span>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Monthly Paid Media Ad Spend</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    isHealthyMER ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  Implied MER: {currentMER}x {isHealthyMER ? '(Healthy)' : '(Under Pressure)'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {discovery?.discoveredFields?.monthlyAdSpend?.sourceExplanation || 'Modeled from live Meta ad density'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAdSpendMode('CONFIRMED_ONLINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  adSpendMode === 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Confirm ${discoveredAdSpend.toLocaleString()}/mo
              </button>
              <button
                type="button"
                onClick={() => setAdSpendMode('CUSTOM_USER_OVERRIDE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  adSpendMode !== 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✏️ Enter Custom Value
              </button>
            </div>
          </div>

          {adSpendMode !== 'CONFIRMED_ONLINE' && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Custom Monthly Ad Spend:</span>
                <span className="font-mono text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded font-bold">
                  ${customAdSpend.toLocaleString()}/mo
                </span>
              </div>
              <input
                type="range"
                min={3000}
                max={1500000}
                step={1000}
                value={customAdSpend}
                onChange={(e) => setCustomAdSpend(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />

              {/* DYNAMIC CONFLICT & AUTHENTICITY GUARD (AMBER RESOLUTION BOX) */}
              {isAdSpendConflict && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold text-sm">⚠️</span>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider font-mono text-amber-900">
                        Online vs. Custom Ad Spend Variance ({adSpendDeltaPct}% Difference)
                      </h4>
                      <p className="text-xs text-amber-900 mt-1">
                        Discovered ad telemetry signals indicate <strong>${discoveredAdSpend.toLocaleString()}/mo</strong>, while you entered <strong>${customAdSpend.toLocaleString()}/mo</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAdSpendMode('CONFIRMED_ONLINE')}
                      className="p-2.5 rounded-lg text-xs font-medium text-left border bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50"
                    >
                      <strong className="block text-[11px]">1. Keep Verified Online</strong>
                      <span className="text-[10px] opacity-80">${discoveredAdSpend.toLocaleString()}/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdSpendMode('CUSTOM_USER_OVERRIDE')}
                      className={`p-2.5 rounded-lg text-xs font-medium text-left border ${
                        adSpendMode === 'CUSTOM_USER_OVERRIDE'
                          ? 'bg-amber-900 text-white border-amber-900'
                          : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      <strong className="block text-[11px]">2. Use My Custom Number</strong>
                      <span className="text-[10px] opacity-80">${customAdSpend.toLocaleString()}/mo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdSpendMode('BLENDED')}
                      className={`p-2.5 rounded-lg text-xs font-medium text-left border ${
                        adSpendMode === 'BLENDED'
                          ? 'bg-amber-900 text-white border-amber-900'
                          : 'bg-white text-slate-800 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      <strong className="block text-[11px]">3. Blend Both Signals</strong>
                      <span className="text-[10px] opacity-80">${Math.round((discoveredAdSpend + customAdSpend) / 2).toLocaleString()}/mo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 4: COGS & FULFILLMENT % */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Parameter 4 of 5</span>
              <h3 className="text-sm font-bold text-slate-900">Landed COGS & Fulfillment (% of Revenue)</h3>
              <p className="text-xs text-slate-500">
                {discovery?.discoveredFields?.cogsPct?.sourceExplanation || '2026 Industry Report Benchmark'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCogsMode('CONFIRMED_ONLINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  cogsMode === 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Confirm {discoveredCogs}%
              </button>
              <button
                type="button"
                onClick={() => setCogsMode('CUSTOM_USER_OVERRIDE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  cogsMode !== 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✏️ Custom COGS
              </button>
            </div>
          </div>

          {cogsMode !== 'CONFIRMED_ONLINE' && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Custom COGS Percentage:</span>
                <span className="font-mono text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded font-bold">
                  {customCogs}%
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={75}
                step={1}
                value={customCogs}
                onChange={(e) => setCustomCogs(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* CARD 5: 30-DAY REFUND RATE % */}
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 md:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-mono text-slate-400 uppercase font-semibold">Parameter 5 of 5</span>
              <h3 className="text-sm font-bold text-slate-900">30-Day Return & Refund Bleed (%)</h3>
              <p className="text-xs text-slate-500">
                {discovery?.discoveredFields?.refundRatePct?.sourceExplanation || '2026 Industry Report Benchmark'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRefundMode('CONFIRMED_ONLINE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  refundMode === 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✓ Confirm {discoveredRefund}%
              </button>
              <button
                type="button"
                onClick={() => setRefundMode('CUSTOM_USER_OVERRIDE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors ${
                  refundMode !== 'CONFIRMED_ONLINE'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ✏️ Custom Refund %
              </button>
            </div>
          </div>

          {refundMode !== 'CONFIRMED_ONLINE' && (
            <div className="space-y-4 pt-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-700">Custom Refund Rate:</span>
                <span className="font-mono text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded font-bold">
                  {customRefund}%
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={40}
                step={1}
                value={customRefund}
                onChange={(e) => setCustomRefund(Number(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* CTA Launch Diagnostic Scan */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-mono">
            Ready to compile 4-Source Data Hierarchy & CQI Ledger
          </div>
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
