export function formatCurrency(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(val)
}

export function formatCurrencyCompact(val: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(val)
}

export function formatPercent(val: number, decimals = 0): string {
  return `${val.toFixed(decimals)}%`
}

export function formatDelta(val: number, isCurrency = false): string {
  const prefix = val > 0 ? '+' : ''
  if (isCurrency) {
    return `${prefix}${formatCurrency(val)}`
  }
  return `${prefix}${val}`
}

export function decodeHtmlEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&quot;|&#x22;/gi, '"')
    .replace(/&#x26;/gi, '&')
    .replace(/&#x2F;/gi, '/')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}
