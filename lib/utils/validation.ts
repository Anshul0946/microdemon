export interface DomainValidationResult {
  isValidSyntax: boolean
  normalizedDomain: string
  error?: string
}

const PRIVATE_IP_PREFIXES = [
  '127.',
  '10.',
  '169.254.',
  '192.168.',
  '0.0.0.0',
]

export function normalizeDomain(raw: string): string {
  if (!raw) return ''
  let cleaned = raw.trim().toLowerCase()

  // Remove protocol
  cleaned = cleaned.replace(/^(https?:\/\/)+/i, '')
  // Remove www.
  cleaned = cleaned.replace(/^www\./i, '')

  // Remove path, query string, hash, and trailing slashes
  cleaned = cleaned.split('/')[0]
  cleaned = cleaned.split('?')[0]
  cleaned = cleaned.split('#')[0]
  cleaned = cleaned.trim().replace(/\.+$/, '')

  return cleaned
}

export function isValidDomain(domain: string): boolean {
  return validateDomainSyntax(domain).isValidSyntax
}

export function validateDomainSyntax(raw: string): DomainValidationResult {
  if (!raw || typeof raw !== 'string') {
    return {
      isValidSyntax: false,
      normalizedDomain: '',
      error: 'Domain input is empty.',
    }
  }

  const normalized = normalizeDomain(raw)

  if (!normalized) {
    return {
      isValidSyntax: false,
      normalizedDomain: '',
      error: 'Please enter a valid domain name.',
    }
  }

  // Reject localhost, local, internal
  if (
    normalized === 'localhost' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized.endsWith('.localhost')
  ) {
    return {
      isValidSyntax: false,
      normalizedDomain: normalized,
      error: 'Local or internal network domains are prohibited.',
    }
  }

  // Check IPv4 pattern and private subnets
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const ipMatch = normalized.match(ipv4Regex)
  if (ipMatch) {
    return {
      isValidSyntax: false,
      normalizedDomain: normalized,
      error: 'Direct IP addresses are prohibited. Please provide a storefront domain.',
    }
  }

  // Check IPv6 pattern or prefix
  if (normalized.includes(':') || normalized.startsWith('[') || normalized.endsWith(']')) {
    return {
      isValidSyntax: false,
      normalizedDomain: normalized,
      error: 'IPv6 addresses are prohibited.',
    }
  }

  // Check private IP prefixes in general
  for (const prefix of PRIVATE_IP_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return {
        isValidSyntax: false,
        normalizedDomain: normalized,
        error: 'Private network addresses are prohibited.',
      }
    }
  }

  // Validate standard domain syntax with valid TLD:
  // Must consist of valid labels (alphanumeric, hyphens not leading/trailing), separated by dots,
  // and ending with an alphabetic TLD of at least 2 characters.
  const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
  if (!domainRegex.test(normalized)) {
    return {
      isValidSyntax: false,
      normalizedDomain: normalized,
      error: 'Invalid domain syntax. Expected format: brand.com',
    }
  }

  return {
    isValidSyntax: true,
    normalizedDomain: normalized,
  }
}
