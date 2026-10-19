import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateDomainSyntax, normalizeDomain } from '../lib/utils/validation'
import { validateShopifyStore } from '../lib/data/shopifyValidator'

describe('Domain Validation & SSRF Guard', () => {
  it('normalizes domains by removing protocol, www, and query strings', () => {
    expect(normalizeDomain('https://www.gymshark.com/collections/all?page=1')).toBe('gymshark.com')
    expect(normalizeDomain('http://summerfridays.com/products/lip-butter-balm')).toBe('summerfridays.com')
    expect(normalizeDomain('drinkag1.com/')).toBe('drinkag1.com')
  })

  it('rejects SSRF patterns and private networks', () => {
    expect(validateDomainSyntax('localhost').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('internal.local').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('127.0.0.1').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('192.168.1.10').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('10.0.0.5').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('169.254.169.254').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('0.0.0.0').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('http://127.0.0.1:8080').isValidSyntax).toBe(false)
  })

  it('rejects invalid domain syntax missing TLD or invalid characters', () => {
    expect(validateDomainSyntax('').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('justaword').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('invalid..domain.com').isValidSyntax).toBe(false)
    expect(validateDomainSyntax('brand..').isValidSyntax).toBe(false)
  })

  it('approves valid public e-commerce store domains', () => {
    const valid1 = validateDomainSyntax('gymshark.com')
    expect(valid1.isValidSyntax).toBe(true)
    expect(valid1.normalizedDomain).toBe('gymshark.com')

    const valid2 = validateDomainSyntax('https://www.allbirds.co.uk/pages/about')
    expect(valid2.isValidSyntax).toBe(true)
    expect(valid2.normalizedDomain).toBe('allbirds.co.uk')
  })
})

describe('Shopify Gatekeeper Validator', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('identifies a verified Shopify store from products.json and extracts catalog prices', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            products: [
              {
                id: 1,
                title: 'Daily Greens',
                variants: [{ price: '79.00' }, { price: '99.00' }],
              },
              {
                id: 2,
                title: 'Vitamin D3/K2',
                variants: [{ price: '35.00' }],
              },
            ],
          }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'x-shopid': '123456' }),
        text: async () => '<html><head><title>AG1 Store</title></head><body><script src="https://cdn.shopify.com/s/files/1/test.js"></script></body></html>',
      })
    })

    const result = await validateShopifyStore('mock-shopify.com')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.domain).toBe('mock-shopify.com')
      expect(result.sampleProductCount).toBe(2)
      expect(result.medianPrice).toBeGreaterThan(0)
      expect(result.detectedCurrency).toBe('USD')
    }
  })

  it('rejects a non-Shopify domain that has no Shopify signatures', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/products.json')) {
        return Promise.resolve({
          ok: false,
          status: 404,
          json: async () => ({}),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '<html><head><title>Just A Regular Blog - WordPress</title></head><body>Hello world</body></html>',
      })
    })

    const result = await validateShopifyStore('regular-blog.org')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('NOT_SHOPIFY')
    }
  })

  it('returns UNREACHABLE_DOMAIN if network fails completely', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND mock-unreachable.invalid'))

    const result = await validateShopifyStore('mock-unreachable.invalid')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('UNREACHABLE_DOMAIN')
    }
  })
})
