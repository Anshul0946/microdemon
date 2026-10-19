import PDFDocument from 'pdfkit'
import { AuditReportResult } from '@/lib/cqi/types'
import { decodeHtmlEntities } from '@/lib/utils/formatters'

export function generatePdfBuffer(report: AuditReportResult, agencyName?: string): Promise<Buffer> {
  const activeAgency = agencyName || report.agencyName

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))

      const fontRegular = 'Helvetica'
      const fontBold = 'Helvetica-Bold'

      // ==========================================
      // PAGE 1: COVER & EXECUTIVE SCORECARD
      // ==========================================
      doc.rect(0, 0, 595, 12).fill('#0F172A') // Top accent stripe

      if (activeAgency) {
        doc
          .font(fontBold)
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(`PREPARED IN PARTNERSHIP WITH ${activeAgency.toUpperCase()}`, 40, 22)
      }

      doc
        .font(fontBold)
        .fontSize(20)
        .fillColor('#0F172A')
        .text('NYXIR CQI DIAGNOSTIC ENGINE', 40, activeAgency ? 36 : 35)

      doc
        .font(fontRegular)
        .fontSize(9.5)
        .fillColor('#64748B')
        .text(
          activeAgency
            ? `audit.${activeAgency.toLowerCase().replace(/[^a-z0-9]/g, '')}.com • Powered by Nyxir Infrastructure`
            : 'INSTITUTIONAL DAY-0 STORE TELEMETRY & MARGIN LEAK REPORT',
          40,
          activeAgency ? 60 : 60
        )

      doc.moveTo(40, 78).lineTo(555, 78).strokeColor('#E2E8F0').stroke()

      // Target Box
      doc.rect(40, 90, 515, 60).fillAndStroke('#F8FAFC', '#E2E8F0')
      doc.font(fontBold).fontSize(12).fillColor('#0F172A').text(report.domain.toUpperCase(), 55, 102)
      doc.font(fontRegular).fontSize(9).fillColor('#475569').text(`Vertical Category: ${decodeHtmlEntities(report.subNicheName || report.benchmark.label)}`, 55, 120)
      doc.font(fontRegular).fontSize(9).fillColor('#475569').text(`Audit Timestamp: ${new Date(report.createdAt).toLocaleDateString('en-US', { dateStyle: 'long' })}`, 55, 134)

      if (report.realityCheck.overrideApplied) {
        doc.font(fontBold).fontSize(8).fillColor('#B45309').text('[CALIBRATED TO VERIFIED MARKET FLOOR]', 340, 102)
      }

      // Master Score Hero Box
      doc.rect(40, 165, 515, 80).fillAndStroke('#FFFFFF', '#E2E8F0')
      doc.font(fontBold).fontSize(10).fillColor('#64748B').text('MASTER CUSTOMER QUALITY INDEX (CQI)', 55, 178)
      doc.font(fontBold).fontSize(34).fillColor('#0F172A').text(`${report.masterCQIScore}`, 55, 196)
      doc.font(fontBold).fontSize(14).fillColor('#64748B').text('/100', 105, 212)
      doc.font(fontBold).fontSize(12).fillColor('#0F172A').text(report.customerQualityTier, 165, 198)
      doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text(report.tierDescription, 165, 216, { width: 370 })

      // Financial Metrics Row
      doc.font(fontBold).fontSize(11).fillColor('#0F172A').text('CORE UNIT ECONOMICS & FIRST-ORDER MARGIN', 40, 260)
      doc.moveTo(40, 275).lineTo(555, 275).strokeColor('#E2E8F0').stroke()

      const boxW = 120
      const boxH = 48
      const boxY = 285

      const metrics = [
        { label: 'CATALOG AOV', value: `$${report.financials.effectiveAOV}` },
        { label: 'BLENDED CAC', value: `$${report.financials.impliedBlendedCAC}` },
        { label: 'MARKETING EFFICIENCY (MER)', value: `${report.financials.currentMER}x` },
        { label: '1ST ORDER NET MARGIN', value: `$${report.financials.firstOrderNetContributionPerOrder}` },
      ]

      metrics.forEach((m, idx) => {
        const x = 40 + idx * 130
        doc.rect(x, boxY, boxW, boxH).fillAndStroke('#F8FAFC', '#E2E8F0')
        doc.font(fontBold).fontSize(7.5).fillColor('#64748B').text(m.label, x + 8, boxY + 8)
        doc.font(fontBold).fontSize(13).fillColor('#0F172A').text(m.value, x + 8, boxY + 24)
      })

      // Five Pillars Breakdown
      doc.font(fontBold).fontSize(11).fillColor('#0F172A').text('5-PILLAR DIAGNOSTIC TELEMETRY BREAKDOWN', 40, 355)
      doc.moveTo(40, 370).lineTo(555, 370).strokeColor('#E2E8F0').stroke()

      const pillars = [
        { name: 'P1: Unit Economics & First-Order Margin', score: report.pillars.unitEconomics, weight: '25%' },
        { name: 'P2: Paid Ad Signal & Advantage+ Concentration', score: report.pillars.adSignal, weight: '25%' },
        { name: 'P3: Offer Architecture & Catalog AOV Extraction', score: report.pillars.offerArchitecture, weight: '20%' },
        { name: 'P4: Signal Integrity & Retention Infrastructure', score: report.pillars.techStack, weight: '15%' },
        { name: 'P5: Brand Authority & AI Search Footprint', score: report.pillars.brandAuthority, weight: '15%' },
      ]

      let pY = 380
      pillars.forEach((p) => {
        doc.rect(40, pY, 515, 26).fillAndStroke('#FFFFFF', '#E2E8F0')
        doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(p.name, 50, pY + 8)
        doc.font(fontRegular).fontSize(8).fillColor('#64748B').text(`Weight: ${p.weight}`, 370, pY + 8)
        doc.font(fontBold).fontSize(9.5).fillColor('#0F172A').text(`${p.score}/100`, 480, pY + 8)
        pY += 32
      })

      // Three Quantified Margin Leaks
      doc.font(fontBold).fontSize(11).fillColor('#0F172A').text('IDENTIFIED MONTHLY DOLLAR MARGIN LEAKS', 40, 560)
      doc.moveTo(40, 575).lineTo(555, 575).strokeColor('#E2E8F0').stroke()

      let leakY = 585
      report.leaks.forEach((leak) => {
        doc.rect(40, leakY, 515, 52).fillAndStroke('#FFFBEB', '#FDE68A')
        doc.font(fontBold).fontSize(9).fillColor('#92400E').text(leak.title.toUpperCase(), 50, leakY + 8)
        doc.font(fontBold).fontSize(10).fillColor('#B45309').text(`-$${leak.monthlyLossDollars.toLocaleString()}/mo`, 440, leakY + 8)
        doc.font(fontRegular).fontSize(7.5).fillColor('#78350F').text(leak.exposedDiagnosis, 50, leakY + 22, { width: 490 })
        leakY += 60
      })

      // Footer
      doc
        .font(fontRegular)
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(
          `Nyxir CQI Diagnostics • Prepared by ${activeAgency || 'Institutional Diagnostic Partner'} — Confidential E-Commerce Operational Report`,
          40,
          785
        )

      // ==========================================
      // PAGE 2: CROSS-RELATIONS & BENCHMARK
      // ==========================================
      doc.addPage()
      doc.rect(0, 0, 595, 12).fill('#0F172A')

      doc.font(fontBold).fontSize(14).fillColor('#0F172A').text('CROSS-PILLAR COMPOUNDING CORRELATIONS', 40, 35)
      doc.moveTo(40, 52).lineTo(555, 52).strokeColor('#E2E8F0').stroke()

      let crY = 65
      report.crossRelations.forEach((cr) => {
        doc.rect(40, crY, 515, 56).fillAndStroke('#F8FAFC', '#E2E8F0')
        doc.font(fontBold).fontSize(9.5).fillColor('#0F172A').text(cr.title, 50, crY + 8)
        doc.font(fontBold).fontSize(8).fillColor('#B45309').text(`Compound Impact: -$${cr.dollarImpact.toLocaleString()}/mo`, 380, crY + 8)
        doc.font(fontRegular).fontSize(8).fillColor('#475569').text(cr.description, 50, crY + 22, { width: 495 })
        crY += 66
      })

      // Category Leader Comparison Table
      const leader = report.dynamicCompetitor || report.benchmark.leaderBrand
      doc.font(fontBold).fontSize(14).fillColor('#0F172A').text(`CATEGORY LEADER BENCHMARK: ${leader.name.toUpperCase()}`, 40, crY + 15)
      doc.moveTo(40, crY + 32).lineTo(555, crY + 32).strokeColor('#E2E8F0').stroke()

      doc.rect(40, crY + 40, 515, 75).fillAndStroke('#FFFFFF', '#E2E8F0')
      doc.font(fontBold).fontSize(9).fillColor('#0F172A').text('Metric', 50, crY + 48)
      doc.font(fontBold).fontSize(9).fillColor('#0F172A').text(report.domain, 240, crY + 48)
      doc.font(fontBold).fontSize(9).fillColor('#0F172A').text(leader.name.split(' ')[0], 420, crY + 48)

      doc.moveTo(45, crY + 62).lineTo(550, crY + 62).strokeColor('#E2E8F0').stroke()

      doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text('CQI Score', 50, crY + 68)
      doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(`${report.masterCQIScore}/100`, 240, crY + 68)
      doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(`${leader.cqiScore}/100`, 420, crY + 68)

      doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text('Average Order Value (AOV)', 50, crY + 82)
      doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(`$${report.financials.effectiveAOV}`, 240, crY + 82)
      doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(`$${leader.aov}`, 420, crY + 82)

      doc.font(fontRegular).fontSize(8.5).fillColor('#475569').text('Catalog Bundle Ratio', 50, crY + 96)
      doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(`${report.storefront.bundleRatioPct}%`, 240, crY + 96)
      doc.font(fontBold).fontSize(8.5).fillColor('#0F172A').text(`${leader.bundleRatioPct}%`, 420, crY + 96)

      // Footer
      doc
        .font(fontRegular)
        .fontSize(8)
        .fillColor('#94A3B8')
        .text(
          `Nyxir CQI Diagnostics • Prepared by ${activeAgency || 'Institutional Diagnostic Partner'} — Confidential E-Commerce Operational Report`,
          40,
          785
        )

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

export const generateExecutivePdf = generatePdfBuffer

