import { describe, it, expect } from 'vitest'
import { getApifyKeys, getNextApifyKey, getGroqApiKey } from '../lib/config/keys'
import { VERTICAL_BENCHMARKS, EcommerceVertical } from '../lib/config/benchmarks'

describe('Configuration & Benchmarks Verification', () => {
  it('loads Apify keys and rotates correctly', () => {
    const keys = getApifyKeys()
    expect(keys.length).toBeGreaterThanOrEqual(1)
    
    const key1 = getNextApifyKey()
    expect(key1).toBeTruthy()
    expect(typeof key1).toBe('string')

    // If there are multiple keys, ensure rotation works
    if (keys.length > 1) {
      const key2 = getNextApifyKey()
      expect(key2).toBeTruthy()
      expect(key2).not.toBe(key1)
    }
  })

  it('loads Groq API key', () => {
    const groqKey = getGroqApiKey()
    expect(groqKey).toBeTruthy()
    expect(groqKey?.startsWith('gsk_')).toBe(true)
  })

  it('contains all 6 e-commerce vertical benchmarks with complete data', () => {
    const expectedVerticals: EcommerceVertical[] = [
      'supplements',
      'skincare',
      'apparel',
      'food_bev',
      'home_lifestyle',
      'pets',
    ]

    for (const v of expectedVerticals) {
      const benchmark = VERTICAL_BENCHMARKS[v]
      expect(benchmark).toBeDefined()
      expect(benchmark.id).toBe(v)
      expect(benchmark.benchmarkAOV).toBeGreaterThan(0)
      expect(benchmark.grossMarginPct).toBeGreaterThan(0)
      expect(benchmark.defaultCogsPct).toBeGreaterThan(0)
      expect(benchmark.avgRefundRatePct).toBeGreaterThan(0)
      expect(benchmark.healthyMER).toBeGreaterThan(0)
      expect(benchmark.healthyBlendedCAC).toBeGreaterThan(0)
      expect(benchmark.repeatRate90dPct).toBeGreaterThan(0)
      expect(benchmark.healthyBundleRatioPct).toBeGreaterThan(0)
      expect(benchmark.maxHealthyScripts).toBeGreaterThan(0)
      
      // Leader Brand Profile
      expect(benchmark.leaderBrand).toBeDefined()
      expect(benchmark.leaderBrand.name).toBeTruthy()
      expect(benchmark.leaderBrand.domain).toBeTruthy()
      expect(benchmark.leaderBrand.cqiScore).toBeGreaterThanOrEqual(80)
      expect(benchmark.leaderBrand.pillars.unitEconomics).toBeGreaterThan(0)
      expect(benchmark.leaderBrand.winningEdgeSummary).toBeTruthy()
    }
  })
})
