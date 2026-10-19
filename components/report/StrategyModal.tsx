'use client'

import React from 'react'

interface StrategyModalProps {
  isOpen: boolean
  onClose: () => void
  domain: string
  totalRecoverableCash?: number
  totalMarginLeak?: number
  calendarUrl?: string
  agencyName?: string
}

export default function StrategyModal({
  isOpen,
  onClose,
  domain,
  totalRecoverableCash,
  totalMarginLeak,
  calendarUrl = 'https://cal.com',
  agencyName,
}: StrategyModalProps) {
  const recoverableAmount = totalRecoverableCash ?? totalMarginLeak ?? 0
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-lg w-full p-6 md:p-8 shadow-xl space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 text-lg font-bold"
        >
          ✕
        </button>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            REMEDIATION UNLOCK PROTOCOL
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Book CQI Strategy Call for {domain}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {agencyName ? `${agencyName} Growth Team` : 'Your growth partner'} will review your live telemetry, unlock the 3-step remediation blueprint, and establish your implementation roadmap to capture up to <strong>+${recoverableAmount.toLocaleString()}/month</strong> in recoverable margin.
          </p>
        </div>

        {/* Schedule Info Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-semibold">Call Format:</span>
            <span>30-Min Zoom Architecture Review</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-semibold">Agenda:</span>
            <span>Unblurring Remediation Protocols & ASC Sandbox</span>
          </div>
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-semibold">Target Value:</span>
            <span className="font-bold text-emerald-700">+${recoverableAmount.toLocaleString()}/mo</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full inline-flex items-center justify-center rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-semibold text-sm py-3.5 shadow-sm transition-colors text-center"
          >
            Confirm Date & Time on Calendar →
          </a>
          <button
            type="button"
            onClick={onClose}
            className="w-full text-center text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            Cancel and Return to Report
          </button>
        </div>
      </div>
    </div>
  )
}
