import { NextRequest, NextResponse } from 'next/server'
import { normalizeDomain, isValidDomain } from '@/lib/utils/validation'
import { getAuditReport } from '@/lib/data/reportStore'
import { generatePdfBuffer } from '@/lib/utils/pdfGenerator'
import { AuditReportResult } from '@/lib/cqi/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { domain, report: passedReport, agencyName } = body

    let report: AuditReportResult | null = passedReport || null

    if (!report && domain) {
      const normalized = normalizeDomain(domain)
      if (!normalized || !isValidDomain(normalized)) {
        return NextResponse.json({ error: 'Invalid domain format.' }, { status: 400 })
      }
      report = getAuditReport(normalized)
    }

    if (!report) {
      return NextResponse.json(
        { error: 'No audit report found to generate PDF.' },
        { status: 404 }
      )
    }

    const pdfBuffer = await generatePdfBuffer(report, agencyName)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cqi-${report.domain}-report.pdf"`,
      },
    })
  } catch (err: unknown) {
    const errObj = err as Error
    console.error('[API Export PDF Error]', errObj)
    return NextResponse.json(
      { error: errObj.message || 'PDF export generation error.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const domain = req.nextUrl.searchParams.get('domain')
    const agencyName = req.nextUrl.searchParams.get('agency') || undefined
    if (!domain) {
      return NextResponse.json({ error: 'Domain parameter is required.' }, { status: 400 })
    }

    const clean = normalizeDomain(domain)
    const report = getAuditReport(clean)
    if (!report) {
      return NextResponse.json({ error: 'No audit report found.' }, { status: 404 })
    }

    const pdfBuffer = await generatePdfBuffer(report, agencyName)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="cqi-${clean}-report.pdf"`,
      },
    })
  } catch (err: unknown) {
    const errObj = err as Error
    return NextResponse.json({ error: errObj.message || 'PDF export generation error.' }, { status: 500 })
  }
}
