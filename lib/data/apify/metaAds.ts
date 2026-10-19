import { runApifyActor } from './client'

export interface MetaAdTelemetry {
  activeAdCount: number
  videoAdSharePct: number
  staticAdSharePct: number
  discountCopySharePct: number
  ascConcentrationRiskPct: number
  evidence: 'LIVE_SCRAPED' | 'BENCHMARK_ESTIMATED'
  evergreenAds90dPlusPct: number
  scalingAds30to90dPct: number
  testingAds7to30dPct: number
  freshLaunchesUnder7dPct: number
  oldestActiveAdDays: number
}

const DISCOUNT_PATTERN = /\b(\d+%\s*off|\b\d+%\b|\bsale\b|\bcode\b|\bdiscount\b|\bfree shipping\b|\bbogo\b)/i

interface RawAdRecord {
  mediaType?: string
  format?: string
  creativeType?: string
  videoUrl?: string
  video_url?: string
  videoHdUrl?: string
  videos?: unknown
  videoUrls?: string[]
  imageUrls?: string[]
  hasVideo?: boolean
  adText?: string
  primaryText?: string
  bodyText?: string
  headline?: string
  title?: string
  start_date?: number | string
  startDate?: number | string
  creation_time?: number | string
  total_active_time?: number | string
}

export async function fetchMetaAdTelemetry(
  brandNameOrDomain: string,
  monthlyAdSpend = 25000,
  brandScale: 'SMB' | 'MID_MARKET' | 'ENTERPRISE' = 'MID_MARKET'
): Promise<MetaAdTelemetry> {
  // Extract brand keyword cleanly from domain (e.g. allbirds.com -> allbirds, gymshark.com -> gymshark)
  const cleanBrand = brandNameOrDomain
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .split('.')[0]
    .toLowerCase()
    .trim()

  const adLibraryUrl = `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=${encodeURIComponent(cleanBrand)}`

  // Support inputs for both memo23 and curious_coder actors
  const input = {
    searchTerms: [cleanBrand],
    startUrls: [{ url: adLibraryUrl }],
    urls: [{ url: adLibraryUrl }],
    maxItems: 60,
    activeStatus: 'active',
  }

  // 1. Try primary Cheerio-based actor with 14000ms timeout
  const primaryResult = await runApifyActor<RawAdRecord>(
    'memo23~facebook-ads-library-scraper-cheerio',
    input,
    14000
  )

  let adItems = primaryResult.data

  // 2. If primary returned null or empty, try curious_coder fallback
  if (!adItems || adItems.length === 0) {
    const fallbackResult = await runApifyActor<RawAdRecord>(
      'curious_coder~facebook-ads-library-scraper',
      input,
      12000
    )
    adItems = fallbackResult.data
  }

  if (adItems && adItems.length > 0) {
    let videoCount = 0
    let discountCount = 0
    const hookMap: Record<string, number> = {}

    const nowMs = Date.now()
    let evergreenCount = 0
    let scalingCount = 0
    let testingCount = 0
    let freshCount = 0
    let maxAgeDays = 0

    for (const ad of adItems) {
      // Check video media
      const mediaType = (ad.mediaType || ad.format || ad.creativeType || '').toLowerCase()
      const hasVideo =
        Boolean(ad.hasVideo) ||
        (Array.isArray(ad.videoUrls) && ad.videoUrls.length > 0) ||
        mediaType.includes('video') ||
        Boolean(ad.videoUrl || ad.video_url || ad.videoHdUrl || ad.videos)

      if (hasVideo) {
        videoCount++
      }

      // Check discount text in body, caption, or headline
      const text = `${ad.adText || ''} ${ad.primaryText || ''} ${ad.bodyText || ''} ${ad.headline || ''} ${ad.title || ''}`
      if (DISCOUNT_PATTERN.test(text)) {
        discountCount++
      }

      // Check hook/headline concentration
      const hook = (ad.headline || ad.title || ad.adText || '').slice(0, 35).toLowerCase().trim()
      if (hook) {
        hookMap[hook] = (hookMap[hook] || 0) + 1
      }

      // Compute ad age and bucket distribution
      let adDays = 0
      const rawDate = ad.start_date || ad.startDate || ad.creation_time
      if (rawDate) {
        let ts = 0
        if (typeof rawDate === 'number') {
          ts = rawDate > 1e11 ? rawDate : rawDate * 1000
        } else if (typeof rawDate === 'string') {
          ts = new Date(rawDate).getTime()
        }
        if (ts && !isNaN(ts) && ts > 0) {
          adDays = Math.max(0, Math.floor((nowMs - ts) / (1000 * 60 * 60 * 24)))
        }
      }

      if (adDays > maxAgeDays) maxAgeDays = adDays

      if (adDays >= 90) {
        evergreenCount++
      } else if (adDays >= 30) {
        scalingCount++
      } else if (adDays >= 7) {
        testingCount++
      } else {
        freshCount++
      }
    }

    const totalAds = adItems.length
    const videoAdSharePct = Math.round((videoCount / totalAds) * 100)
    const staticAdSharePct = 100 - videoAdSharePct
    const discountCopySharePct = Math.round((discountCount / totalAds) * 100)

    // Calculate ASC concentration: max repetitive hooks / totalAds
    let maxRepetitive = 1
    for (const count of Object.values(hookMap)) {
      if (count > maxRepetitive) maxRepetitive = count
    }
    const ascConcentrationRiskPct = Math.min(
      95,
      Math.max(15, Math.round((maxRepetitive / totalAds) * 100))
    )

    const oldestActiveAdDays = maxAgeDays > 0 ? maxAgeDays : 85

    return {
      activeAdCount: totalAds,
      videoAdSharePct,
      staticAdSharePct,
      discountCopySharePct,
      ascConcentrationRiskPct,
      evidence: 'LIVE_SCRAPED',
      evergreenAds90dPlusPct: Math.round((evergreenCount / totalAds) * 100),
      scalingAds30to90dPct: Math.round((scalingCount / totalAds) * 100),
      testingAds7to30dPct: Math.round((testingCount / totalAds) * 100),
      freshLaunchesUnder7dPct: Math.round((freshCount / totalAds) * 100),
      oldestActiveAdDays,
    }
  }

  // Scale-calibrated estimator fallback
  return getBenchmarkEstimatedAds(monthlyAdSpend, brandScale)
}

export function getBenchmarkEstimatedAds(
  monthlyAdSpend: number,
  brandScale: 'SMB' | 'MID_MARKET' | 'ENTERPRISE' = 'MID_MARKET'
): MetaAdTelemetry {
  let estimatedAdCount = Math.max(12, Math.round(monthlyAdSpend / 1400))
  let evergreen = 18
  let scaling = 38
  let testing = 28
  let fresh = 16
  let oldestDays = 112

  if (brandScale === 'ENTERPRISE' || monthlyAdSpend >= 100000) {
    estimatedAdCount = Math.max(48, Math.min(220, Math.round(monthlyAdSpend / 32000)))
    evergreen = 32
    scaling = 41
    testing = 18
    fresh = 9
    oldestDays = 265
  } else if (brandScale === 'SMB' || monthlyAdSpend < 25000) {
    estimatedAdCount = Math.max(8, Math.min(24, Math.round(monthlyAdSpend / 1800)))
    evergreen = 8
    scaling = 25
    testing = 42
    fresh = 25
    oldestDays = 64
  }

  return {
    activeAdCount: estimatedAdCount,
    videoAdSharePct: 62,
    staticAdSharePct: 38,
    discountCopySharePct: 34,
    ascConcentrationRiskPct: 42,
    evidence: 'BENCHMARK_ESTIMATED',
    evergreenAds90dPlusPct: evergreen,
    scalingAds30to90dPct: scaling,
    testingAds7to30dPct: testing,
    freshLaunchesUnder7dPct: fresh,
    oldestActiveAdDays: oldestDays,
  }
}
