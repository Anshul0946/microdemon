import { NextRequest, NextResponse } from 'next/server'
import { normalizeDomain, isValidDomain } from '@/lib/utils/validation'
import { getAuditReport, saveAuditReport } from '@/lib/data/reportStore'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get('domain')
    if (!domain) {
      return NextResponse.json({ error: 'Domain query parameter is required.' }, { status: 400 })
    }

    const clean = normalizeDomain(domain)
    if (!clean || !isValidDomain(clean)) {
      return NextResponse.json({ error: 'Invalid domain syntax.' }, { status: 400 })
    }

    const report = getAuditReport(clean)
    if (!report) {
      return NextResponse.json(
        { error: `No audit report found for: ${clean}. Please run a diagnostic scan first.` },
        { status: 404 }
      )
    }

    return NextResponse.json(report, { status: 200 })
  } catch (err: unknown) {
    const errObj = err as Error
    return NextResponse.json({ error: errObj.message || 'Report retrieval error.' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { domain, qualificationAnswers, agencyName } = body

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required.' }, { status: 400 })
    }

    const clean = normalizeDomain(domain)
    const report = getAuditReport(clean)

    if (!report) {
      return NextResponse.json({ error: 'Report not found to update.' }, { status: 404 })
    }

    if (qualificationAnswers) {
      report.qualificationAnswers = {
        ...report.qualificationAnswers,
        ...qualificationAnswers,
      }
    }

    if (agencyName) {
      report.agencyName = agencyName
    }

    saveAuditReport(report)

    return NextResponse.json({ ok: true, report }, { status: 200 })
  } catch (err: unknown) {
    const errObj = err as Error
    return NextResponse.json({ error: errObj.message || 'Report update error.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  return PATCH(req)
}
