import { NextRequest, NextResponse } from 'next/server'
import { validateDomainSyntax } from '@/lib/utils/validation'
import { validateShopifyStore } from '@/lib/data/shopifyValidator'
import { runStep1StoreDiscovery } from '@/lib/data/discovery'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawUrl = body.url || body.domain

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { ok: false, code: 'INVALID_URL', message: 'Domain or URL is required.' },
        { status: 400 }
      )
    }

    const syntax = validateDomainSyntax(rawUrl)
    if (!syntax.isValidSyntax) {
      return NextResponse.json(
        { ok: false, code: 'INVALID_URL', message: syntax.error || 'Invalid domain syntax.' },
        { status: 400 }
      )
    }

    const domain = syntax.normalizedDomain

    // Quick verification first
    const check = await validateShopifyStore(domain)
    if (!check.ok) {
      const status = check.code === 'NOT_SHOPIFY' ? 422 : 400
      return NextResponse.json(check, { status })
    }

    const discovery = await runStep1StoreDiscovery(domain)
    return NextResponse.json(discovery, { status: 200 })
  } catch (err: unknown) {
    const e = err as Error
    return NextResponse.json(
      { ok: false, code: 'DISCOVERY_ERROR', message: e.message || 'Discovery synthesis failed.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url') || req.nextUrl.searchParams.get('domain')
  if (!urlParam) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_URL', message: 'URL parameter is missing.' },
      { status: 400 }
    )
  }

  const syntax = validateDomainSyntax(urlParam)
  if (!syntax.isValidSyntax) {
    return NextResponse.json(
      { ok: false, code: 'INVALID_URL', message: syntax.error || 'Invalid URL format.' },
      { status: 400 }
    )
  }

  const domain = syntax.normalizedDomain
  const check = await validateShopifyStore(domain)
  if (!check.ok) {
    const status = check.code === 'NOT_SHOPIFY' ? 422 : 400
    return NextResponse.json(check, { status })
  }

  const discovery = await runStep1StoreDiscovery(domain)
  return NextResponse.json(discovery, { status: 200 })
}
