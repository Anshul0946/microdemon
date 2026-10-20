import { NextRequest, NextResponse } from 'next/server'
import { validateDomainSyntax } from '@/lib/utils/validation'
import { validateShopifyStore } from '@/lib/data/shopifyValidator'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawUrl = body.url || body.domain

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_URL',
          message: 'Invalid URL format. Please enter a valid domain (e.g., gymshark.com).',
        },
        { status: 400 }
      )
    }

    const syntax = validateDomainSyntax(rawUrl)
    if (!syntax.isValidSyntax) {
      return NextResponse.json(
        {
          ok: false,
          code: 'INVALID_URL',
          message: syntax.error || 'Invalid URL format. Please enter a valid domain (e.g., gymshark.com).',
        },
        { status: 400 }
      )
    }

    const result = await validateShopifyStore(syntax.normalizedDomain)
    if (!result.ok) {
      const status = result.code === 'NOT_SHOPIFY' ? 422 : 400
      return NextResponse.json(result, { status })
    }

    let discovery = null
    try {
      const { runStep1StoreDiscovery } = await import('@/lib/data/discovery')
      discovery = await runStep1StoreDiscovery(syntax.normalizedDomain)
    } catch {
      // discovery will be fetched on configure page if needed
    }

    return NextResponse.json({ ...result, discovery }, { status: 200 })
  } catch (err: unknown) {
    const errObj = err as Error
    return NextResponse.json(
      {
        ok: false,
        code: 'UNREACHABLE_DOMAIN',
        message: errObj.message || 'An unexpected verification error occurred.',
      },
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

  const result = await validateShopifyStore(syntax.normalizedDomain)
  const status = result.ok ? 200 : result.code === 'NOT_SHOPIFY' ? 422 : 400
  return NextResponse.json(result, { status })
}
