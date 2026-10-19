import { AuditReportResult } from '@/lib/cqi/types'
import fs from 'fs'
import path from 'path'
import os from 'os'

declare global {
  // eslint-disable-next-line no-var
  var __NYXIR_REPORTS__: Map<string, AuditReportResult> | undefined
}

if (!globalThis.__NYXIR_REPORTS__) {
  globalThis.__NYXIR_REPORTS__ = new Map<string, AuditReportResult>()
}

const memoryStore = globalThis.__NYXIR_REPORTS__
const DISK_CACHE_PATH = path.join(os.tmpdir(), 'nyxir-cqi-reports.json')

function readDiskCache(): Record<string, AuditReportResult> {
  try {
    if (fs.existsSync(DISK_CACHE_PATH)) {
      const raw = fs.readFileSync(DISK_CACHE_PATH, 'utf-8')
      return JSON.parse(raw)
    }
  } catch {
    // Non-blocking disk read fallback
  }
  return {}
}

function writeDiskCache(data: Record<string, AuditReportResult>): void {
  try {
    fs.writeFileSync(DISK_CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8')
  } catch {
    // Non-blocking disk write fallback
  }
}

export function saveAuditReport(report: AuditReportResult): void {
  const key = report.domain.toLowerCase().trim()
  memoryStore.set(key, report)

  try {
    const disk = readDiskCache()
    disk[key] = report
    writeDiskCache(disk)
  } catch {
    // Ignore disk write errors on restricted environments
  }
}

export function getAuditReport(domain: string): AuditReportResult | null {
  const key = domain.toLowerCase().trim()

  // 1. Check memory store
  const fromMem = memoryStore.get(key)
  if (fromMem) return fromMem

  // 2. Check persistent disk cache in os.tmpdir()
  try {
    const disk = readDiskCache()
    if (disk[key]) {
      memoryStore.set(key, disk[key])
      return disk[key]
    }
  } catch {
    // Ignore disk read errors
  }

  return null
}
