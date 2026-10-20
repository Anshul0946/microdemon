import fs from 'fs'
import path from 'path'

// Auto-load .env.local when running standalone scripts (e.g. tsx, node, vitest)
if (typeof process !== 'undefined' && process.cwd) {
  try {
    const envLocalPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const val = match[2].trim().replace(/^['"]|['"]$/g, '').trim()
            if (!process.env[key] || process.env[key]?.startsWith('"') || process.env[key]?.startsWith("'")) {
              process.env[key] = val
            }
          }
        }
      }
    }
  } catch {
    // Ignore in edge runtime
  }
}

let currentKeyIndex = 0

export function sanitizeKey(val?: string | null): string | null {
  if (!val) return null
  const cleaned = val.trim().replace(/^['"]|['"]$/g, '').trim()
  return cleaned.length > 0 ? cleaned : null
}

export function getApifyKeys(): string[] {
  return [
    sanitizeKey(process.env.APIFY_API_KEY_1),
    sanitizeKey(process.env.APIFY_API_KEY_2),
    sanitizeKey(process.env.APIFY_API_KEY_3),
  ].filter((k): k is string => Boolean(k))
}

export function getNextApifyKey(): string | null {
  const keys = getApifyKeys()
  if (keys.length === 0) return null
  const key = keys[currentKeyIndex % keys.length]
  currentKeyIndex = (currentKeyIndex + 1) % keys.length
  return key
}

export function getNvidiaApiKey(): string | null {
  return sanitizeKey(process.env.NVIDIA_API_KEY)
}

export function getGroqApiKey(): string | null {
  return getNvidiaApiKey() || sanitizeKey(process.env.GROQ_API_KEY)
}
