import { getApifyKeys } from '@/lib/config/keys'

export interface ApifyRunResult<T> {
  data: T[] | null
  evidence: 'LIVE_SCRAPED' | 'BENCHMARK_ESTIMATED'
}

export async function runApifyActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  timeoutMs = 30000,
  keyOffset = 0
): Promise<ApifyRunResult<T>> {
  const keys = getApifyKeys()
  if (!keys || keys.length === 0) {
    console.warn(`[Apify Client] No Apify API keys configured. Using BENCHMARK_ESTIMATED for ${actorId}.`)
    return { data: null, evidence: 'BENCHMARK_ESTIMATED' }
  }

  const cleanActorId = actorId.replace(/^['"]|['"]$/g, '').replace('/', '~')

  for (let step = 0; step < keys.length; step++) {
    const i = (step + keyOffset) % keys.length
    const apiKey = keys[i]
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const queryTimeout = Math.max(15, Math.min(60, Math.floor((timeoutMs - 2000) / 1000)))
      const url = `https://api.apify.com/v2/acts/${encodeURIComponent(cleanActorId)}/run-sync-get-dataset-items?token=${apiKey}&timeout=${queryTimeout}&memory=512`

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data = (await response.json()) as T[]
        if (Array.isArray(data) && data.length > 0) {
          return { data, evidence: 'LIVE_SCRAPED' }
        }
        return { data: [], evidence: 'LIVE_SCRAPED' }
      }

      // Check status codes for rotation
      if (response.status === 401 || response.status === 402 || response.status === 403 || response.status === 429) {
        console.warn(
          `[Apify Client] Key #${i + 1} failed with HTTP ${response.status} for actor ${actorId}. Failing over to next key...`
        )
        continue // Try next key
      }

      if (response.status === 400) {
        const errText = await response.text().catch(() => '')
        if (errText.includes('TIMED-OUT') || errText.includes('run-failed')) {
          console.warn(`[Apify Client] Actor ${actorId} exceeded synchronous execution window. Utilizing calibrated benchmark.`)
        } else {
          console.warn(`[Apify Client] Actor ${actorId} returned HTTP 400: ${errText.slice(0, 150)}`)
        }
        return { data: null, evidence: 'BENCHMARK_ESTIMATED' }
      }

      console.warn(`[Apify Client] Response HTTP ${response.status} for actor ${actorId}.`)
      return { data: null, evidence: 'BENCHMARK_ESTIMATED' }
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      const errObj = err as Error
      if (errObj.name === 'AbortError') {
        console.warn(`[Apify Client] Timeout of ${timeoutMs}ms exceeded for actor ${actorId}.`)
        break // Stop on timeout to avoid blocking Vercel serverless budget
      }
      console.warn(`[Apify Client] Network error with key #${i + 1}: ${errObj.message}`)
    }
  }

  return { data: null, evidence: 'BENCHMARK_ESTIMATED' }
}
