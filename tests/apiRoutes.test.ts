import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as validatePost } from '../app/api/validate-shopify/route'
import { POST as auditPost } from '../app/api/audit/route'
import { GET as reportGet, PATCH as reportPatch } from '../app/api/report/route'
import { POST as exportPdfPost } from '../app/api/export-pdf/route'
import { NextRequest } from 'next/server'

describe('Backend API Pipeline Routes', () => {
  it('validates Shopify domains and rejects SSRF attempts', async () => {
    const badReq = new NextRequest('http://localhost:3000/api/validate-shopify', {
      method: 'POST',
      body: JSON.stringify({ url: '127.0.0.1' }),
    })
    const res = await validatePost(badReq)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.ok).toBe(false)
    expect(json.code).toBe('INVALID_URL')
  })

  it('runs complete audit pipeline and persists report for retrieval', async () => {
    const auditReq = new NextRequest('http://localhost:3000/api/audit', {
      method: 'POST',
      body: JSON.stringify({
        domain: 'gymshark.com',
        vertical: 'apparel',
        monthlyRevenue: 100000, // triggers enterprise reality check
        monthlyAdSpend: 25000,
        cogsPct: 36,
        refundRatePct: 20,
      }),
    })

    const auditRes = await auditPost(auditReq)
    expect(auditRes.status).toBe(200)
    const auditJson = await auditRes.json()
    expect(auditJson.ok).toBe(true)
    expect(auditJson.report).toBeDefined()
    expect(auditJson.report.domain).toBe('gymshark.com')
    expect(auditJson.report.realityCheck.overrideApplied).toBe(true)
    expect(auditJson.report.masterCQIScore).toBeGreaterThan(0)
    expect(auditJson.report.leaks.length).toBe(3)

    // Verify GET /api/report retrieves this exact report
    const getReq = new NextRequest('http://localhost:3000/api/report?domain=gymshark.com')
    const getRes = await reportGet(getReq)
    expect(getRes.status).toBe(200)
    const getJson = await getRes.json()
    expect(getJson.domain).toBe('gymshark.com')

    // Verify PATCH /api/report updates qualification answers
    const patchReq = new NextRequest('http://localhost:3000/api/report', {
      method: 'PATCH',
      body: JSON.stringify({
        domain: 'gymshark.com',
        qualificationAnswers: {
          agencyCount: '2–3 Agencies',
          primaryBottleneck: 'Meta Advantage+ creative fatigue',
        },
      }),
    })
    const patchRes = await reportPatch(patchReq)
    expect(patchRes.status).toBe(200)
    const patchJson = await patchRes.json()
    expect(patchJson.ok).toBe(true)
    expect(patchJson.report.qualificationAnswers.agencyCount).toBe('2–3 Agencies')

    // Verify POST /api/export-pdf generates PDF buffer
    const pdfReq = new NextRequest('http://localhost:3000/api/export-pdf', {
      method: 'POST',
      body: JSON.stringify({ domain: 'gymshark.com' }),
    })
    const pdfRes = await exportPdfPost(pdfReq)
    expect(pdfRes.headers.get('content-type')).toBe('application/pdf')
  }, 40000)
})
