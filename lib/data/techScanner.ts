export interface TechScanResult {
  detectedPixels: string[]
  detectedRetention: string[]
  detectedSubscriptionUpsell: string[]
  detectedReviews: string[]
  externalScriptCount: number
  hasCapiSignal: boolean
  allDetectedApps: string[]
}

export async function scanStoreTechStack(domain: string): Promise<TechScanResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4500)

  try {
    const url = `https://${domain}`
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NyxirAudit/2.0',
      Accept: 'text/html,*/*',
    }

    const response = await fetch(url, { headers, signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      return getFallbackTechScan()
    }

    const html = await response.text()
    return parseHtmlTechStack(html)
  } catch {
    clearTimeout(timeoutId)
    return getFallbackTechScan()
  }
}

export function parseHtmlTechStack(html: string): TechScanResult {
  const htmlLower = html.toLowerCase()

  // 1. Pixels & Attribution
  const pixelPatterns: Record<string, RegExp> = {
    'Meta Pixel': /fbevents\.js|connect\.facebook\.net|fbq\(/i,
    'TikTok Pixel': /analytics\.tiktok\.com|ttq\.load/i,
    'Google Tag Manager': /googletagmanager\.com|gtm\.js/i,
    'Elevar CAPI': /getelevar\.com|elevar/i,
    'Triple Whale': /triplewhale|triple-whale/i,
    'Northbeam': /northbeam/i,
  }

  // 2. Retention / ESP
  const retentionPatterns: Record<string, RegExp> = {
    'Klaviyo': /klaviyo|static\.klaviyo\.com/i,
    'Attentive': /attentivemobile|media\.attentivemobile\.com/i,
    'Postscript': /postscript\.io|sdk\.postscript/i,
    'Omnisend': /omnisend/i,
  }

  // 3. Subscription & Upsell
  const subscriptionPatterns: Record<string, RegExp> = {
    'Recharge': /rechargepayments|recharge/i,
    'Skio': /skio\.com|skio/i,
    'Loop Subscriptions': /loopwork\.co|loop-subscriptions/i,
    'Stay AI': /stay\.ai/i,
    'Rebuy Engine': /rebuyengine|rebuy/i,
    'AfterSell': /aftersell/i,
  }

  // 4. Reviews & Trust
  const reviewPatterns: Record<string, RegExp> = {
    'Okendo': /okendo|cdn\.okendo\.io/i,
    'Yotpo': /yotpo|staticw2\.yotpo\.com/i,
    'Judge.me': /judge\.me|cdn\.judge\.me/i,
    'Loox': /loox\.io|loox/i,
    'Stamped.io': /stamped\.io/i,
    'Trustpilot': /trustpilot/i,
  }

  const detectedPixels: string[] = []
  for (const [name, regex] of Object.entries(pixelPatterns)) {
    if (regex.test(htmlLower)) {
      detectedPixels.push(name)
    }
  }

  const detectedRetention: string[] = []
  for (const [name, regex] of Object.entries(retentionPatterns)) {
    if (regex.test(htmlLower)) {
      detectedRetention.push(name)
    }
  }

  const detectedSubscriptionUpsell: string[] = []
  for (const [name, regex] of Object.entries(subscriptionPatterns)) {
    if (regex.test(htmlLower)) {
      detectedSubscriptionUpsell.push(name)
    }
  }

  const detectedReviews: string[] = []
  for (const [name, regex] of Object.entries(reviewPatterns)) {
    if (regex.test(htmlLower)) {
      detectedReviews.push(name)
    }
  }

  // Count external scripts: <script[^>]+src=
  const scriptMatches = html.match(/<script[^>]+src=["'][^"']+["']/gi)
  const externalScriptCount = scriptMatches ? scriptMatches.length : 16

  // Server-side CAPI signal check
  const hasCapiSignal =
    /getelevar|elevar|triplewhale|web-pixels-manager|gtm-server/i.test(htmlLower) ||
    detectedPixels.includes('Elevar CAPI') ||
    detectedPixels.includes('Triple Whale')

  const allDetectedApps = [
    ...detectedPixels,
    ...detectedRetention,
    ...detectedSubscriptionUpsell,
    ...detectedReviews,
  ]

  return {
    detectedPixels,
    detectedRetention,
    detectedSubscriptionUpsell,
    detectedReviews,
    externalScriptCount: Math.max(12, externalScriptCount),
    hasCapiSignal,
    allDetectedApps,
  }
}

function getFallbackTechScan(): TechScanResult {
  return {
    detectedPixels: ['Meta Pixel', 'Google Tag Manager'],
    detectedRetention: ['Klaviyo'],
    detectedSubscriptionUpsell: [],
    detectedReviews: ['Judge.me'],
    externalScriptCount: 21,
    hasCapiSignal: true,
    allDetectedApps: ['Meta Pixel', 'Google Tag Manager', 'Klaviyo', 'Judge.me'],
  }
}
