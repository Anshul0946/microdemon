import { validateDomainSyntax } from '@/lib/utils/validation'
import { decodeHtmlEntities } from '@/lib/utils/formatters'

export interface ShopifyValidationSuccess {
  ok: true
  domain: string
  storeTitle: string
  sampleProductCount: number
  medianPrice: number
  detectedCurrency: string
}

export interface ShopifyValidationFailure {
  ok: false
  code: 'INVALID_URL' | 'UNREACHABLE_DOMAIN' | 'NOT_SHOPIFY'
  message: string
}

export type ShopifyValidationResult = ShopifyValidationSuccess | ShopifyValidationFailure

const SHOPIFY_FINGERPRINTS = [
  'cdn.shopify.com',
  'window.shopify',
  'shopify.theme',
  'shopify-digital-wallet',
  'x-shopid',
  'myshopify.com',
  'shopify-features',
  'shopify-payment-button',
]

export async function validateShopifyDomain(url: string): Promise<ShopifyValidationResult> {
  const syntax = validateDomainSyntax(url)
  if (!syntax.isValidSyntax) {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: syntax.error || 'Invalid URL format.',
    }
  }
  return validateShopifyStore(syntax.normalizedDomain)
}

export async function validateShopifyStore(normalizedDomain: string): Promise<ShopifyValidationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 4500)

  try {
    const productsUrl = `https://${normalizedDomain}/products.json?limit=5`
    const homeUrl = `https://${normalizedDomain}`

    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NyxirAudit/2.0',
      Accept: 'text/html,application/json,*/*',
    }

    const [productsResult, homeResult] = await Promise.allSettled([
      fetch(productsUrl, { headers, signal: controller.signal }),
      fetch(homeUrl, { headers, signal: controller.signal }),
    ])

    clearTimeout(timeoutId)

    // Check if both failed with network errors
    const productsFailed = productsResult.status === 'rejected'
    const homeFailed = homeResult.status === 'rejected'

    if (productsFailed && homeFailed) {
      return {
        ok: false,
        code: 'UNREACHABLE_DOMAIN',
        message: 'Domain is unreachable or offline. Please check the spelling and try again.',
      }
    }

    let isShopify = false
    let sampleProducts: Array<{
      title: string
      variants?: Array<{ price: string | number; currency?: string }>
    }> = []
    const detectedCurrency = 'USD'
    let storeTitle = normalizedDomain.split('.')[0].toUpperCase()

    // 1. Inspect products.json response
    if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
      try {
        const json = await productsResult.value.json()
        if (json && Array.isArray(json.products)) {
          isShopify = true
          sampleProducts = json.products
        }
      } catch {
        // Not valid JSON, continue checking homepage
      }
    }

    // 2. Inspect homepage HTML and headers
    if (homeResult.status === 'fulfilled') {
      const res = homeResult.value
      // Check headers
      const xShopId = res.headers.get('x-shopid')
      if (xShopId) {
        isShopify = true
      }

      if (res.ok) {
        try {
          const html = await res.text()
          const htmlLower = html.toLowerCase()

          // Extract title tag
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          if (titleMatch && titleMatch[1]) {
            const rawTitle = titleMatch[1].trim().split(/[-|–]/)[0].trim() || storeTitle
            storeTitle = decodeHtmlEntities(rawTitle)
          }

          // Check fingerprints
          for (const fp of SHOPIFY_FINGERPRINTS) {
            if (htmlLower.includes(fp)) {
              isShopify = true
              break
            }
          }
        } catch {
          // Ignore read error
        }
      }
    }

    if (!isShopify) {
      return {
        ok: false,
        code: 'NOT_SHOPIFY',
        message:
          'Non-Shopify Store Detected: This URL is not running on Shopify. Nyxir CQI Diagnostics strictly audits Shopify storefronts.',
      }
    }

    // Extract pricing statistics
    const prices: number[] = []
    for (const p of sampleProducts) {
      if (Array.isArray(p.variants)) {
        for (const v of p.variants) {
          const numPrice = typeof v.price === 'string' ? parseFloat(v.price) : Number(v.price)
          if (!isNaN(numPrice) && numPrice > 0) {
            prices.push(numPrice)
          }
        }
      }
    }

    let medianPrice = 65 // standard baseline
    if (prices.length > 0) {
      prices.sort((a, b) => a - b)
      const mid = Math.floor(prices.length / 2)
      medianPrice = prices.length % 2 !== 0 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2)
    }

    return {
      ok: true,
      domain: normalizedDomain,
      storeTitle,
      sampleProductCount: sampleProducts.length,
      medianPrice,
      detectedCurrency,
    }
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const errObj = err as Error
    if (errObj.name === 'AbortError') {
      return {
        ok: false,
        code: 'UNREACHABLE_DOMAIN',
        message: 'Domain verification timed out. The server responded too slowly or is unreachable.',
      }
    }
    return {
      ok: false,
      code: 'UNREACHABLE_DOMAIN',
      message: 'Domain is unreachable or offline. Please check the spelling and try again.',
    }
  }
}
