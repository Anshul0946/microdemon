'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function Header() {
  const searchParams = useSearchParams()
  const [agencyName, setAgencyName] = useState<string | null>(null)
  const [calendarUrl, setCalendarUrl] = useState<string>('https://cal.com')
  const [isWhiteLabelBarOpen, setIsWhiteLabelBarOpen] = useState(false)
  const [inputAgencyName, setInputAgencyName] = useState('')
  const [inputCalendarUrl, setInputCalendarUrl] = useState('')

  useEffect(() => {
    // 1. Check URL query
    const agencyFromQuery = searchParams.get('agency')
    const calFromQuery = searchParams.get('cal')

    if (agencyFromQuery) {
      setAgencyName(agencyFromQuery)
      setInputAgencyName(agencyFromQuery)
      try {
        sessionStorage.setItem('cqi_agency_partner', agencyFromQuery)
      } catch {
        // ignore
      }
    } else {
      // 2. Check sessionStorage
      try {
        const storedAgency = sessionStorage.getItem('cqi_agency_partner')
        if (storedAgency) {
          setAgencyName(storedAgency)
          setInputAgencyName(storedAgency)
        }
      } catch {
        // ignore
      }
    }

    if (calFromQuery) {
      setCalendarUrl(calFromQuery)
      setInputCalendarUrl(calFromQuery)
      try {
        sessionStorage.setItem('cqi_calendar_url', calFromQuery)
      } catch {
        // ignore
      }
    } else {
      try {
        const storedCal = sessionStorage.getItem('cqi_calendar_url')
        if (storedCal) {
          setCalendarUrl(storedCal)
          setInputCalendarUrl(storedCal)
        }
      } catch {
        // ignore
      }
    }
  }, [searchParams])

  const handleApplyBranding = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanAgency = inputAgencyName.trim()
    const cleanCal = inputCalendarUrl.trim() || 'https://cal.com'

    if (cleanAgency) {
      setAgencyName(cleanAgency)
      setCalendarUrl(cleanCal)
      try {
        sessionStorage.setItem('cqi_agency_partner', cleanAgency)
        sessionStorage.setItem('cqi_calendar_url', cleanCal)
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cqi_agency_updated', {
            detail: { agencyName: cleanAgency, calendarUrl: cleanCal },
          })
        )
      }
    } else {
      setAgencyName(null)
      try {
        sessionStorage.removeItem('cqi_agency_partner')
      } catch {
        // ignore
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cqi_agency_updated', {
            detail: { agencyName: null, calendarUrl: cleanCal },
          })
        )
      }
    }
    setIsWhiteLabelBarOpen(false)
  }

  const handleClearBranding = () => {
    setAgencyName(null)
    setInputAgencyName('')
    setInputCalendarUrl('')
    setCalendarUrl('https://cal.com')
    try {
      sessionStorage.removeItem('cqi_agency_partner')
      sessionStorage.removeItem('cqi_calendar_url')
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('cqi_agency_updated', {
          detail: { agencyName: null, calendarUrl: 'https://cal.com' },
        })
      )
    }
    setIsWhiteLabelBarOpen(false)
  }

  const brandHost = agencyName
    ? `audit.${agencyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`
    : null

  return (
    <header className="sticky top-0 z-50 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#E2E8F0]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] flex items-center justify-center text-white font-bold text-xs tracking-wider shadow-sm">
              NX
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-[#0F172A]">
                NYXIR <span className="font-semibold text-slate-500">CQI</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase text-slate-400 font-mono">
                Diagnostic Engine
              </span>
            </div>
          </Link>

          {agencyName ? (
            <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-medium text-slate-700">
                <span className="font-bold text-slate-900">{brandHost}</span>
                <span className="text-slate-400 ml-1.5 text-[11px]">— Powered by Nyxir Infrastructure</span>
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-slate-200">
              <span className="text-xs font-mono text-slate-400">Institutional Partner Suite</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* White-Label Control Toggle */}
          <button
            onClick={() => setIsWhiteLabelBarOpen(!isWhiteLabelBarOpen)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              isWhiteLabelBarOpen || agencyName
                ? 'bg-slate-100 border-slate-300 text-slate-900'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            title="Configure White-Label Agency Branding"
          >
            <span>🎛️</span>
            <span className="hidden sm:inline">Agency White-Label Preview</span>
            {agencyName && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-[#0F172A] text-white text-xs font-medium px-3.5 py-2 hover:bg-slate-800 transition-colors shadow-sm"
          >
            📅 Book Strategy Call
          </a>
        </div>
      </div>

      {/* Collapsible White-Label Control Bar */}
      {isWhiteLabelBarOpen && (
        <div className="border-t border-slate-200 bg-slate-50/95 px-6 py-3.5 shadow-inner animate-in fade-in slide-in-from-top-1 duration-150">
          <form
            onSubmit={handleApplyBranding}
            className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
          >
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="flex-1">
                <label className="block text-[10px] font-mono uppercase text-slate-500 mb-0.5">
                  Agency Partner Name
                </label>
                <input
                  type="text"
                  value={inputAgencyName}
                  onChange={(e) => setInputAgencyName(e.target.value)}
                  placeholder="e.g. ScaleLab Media"
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[10px] font-mono uppercase text-slate-500 mb-0.5">
                  Presenter Calendar URL (Optional)
                </label>
                <input
                  type="text"
                  value={inputCalendarUrl}
                  onChange={(e) => setInputCalendarUrl(e.target.value)}
                  placeholder="e.g. https://cal.com/scalelab"
                  className="w-full bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 md:pt-3">
              <button
                type="submit"
                className="rounded-md bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-slate-800 transition-colors shadow-sm"
              >
                Apply Branding
              </button>
              {agencyName && (
                <button
                  type="button"
                  onClick={handleClearBranding}
                  className="rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-medium px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsWhiteLabelBarOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
              >
                ✕
              </button>
            </div>
          </form>
        </div>
      )}
    </header>
  )
}
