export type EcommerceVertical =
  | 'supplements'
  | 'skincare'
  | 'apparel'
  | 'food_bev'
  | 'home_lifestyle'
  | 'pets';

export interface VerticalBenchmark {
  id: EcommerceVertical;
  label: string;
  benchmarkAOV: number;
  grossMarginPct: number;       // e.g. 76 means 76% gross margin (24% COGS)
  defaultCogsPct: number;       // e.g. 24%
  avgRefundRatePct: number;     // e.g. 6%
  healthyMER: number;           // e.g. 2.8x (Revenue / Ad Spend)
  healthyBlendedCAC: number;    // $
  repeatRate90dPct: number;     // %
  healthyBundleRatioPct: number;// % of catalog that should be bundles/kits
  maxHealthyScripts: number;    // External scripts threshold before mobile CR drops
  leaderBrand: {
    name: string;
    domain: string;
    cqiScore: number;
    aov: number;
    blendedCAC: number;
    bundleRatioPct: number;
    activeAdCount: number;
    videoAdSharePct: number;
    scriptCount: number;
    repeatRate90dPct: number;
    pillars: {
      unitEconomics: number;
      adSignal: number;
      offerArchitecture: number;
      techStack: number;
      brandAuthority: number;
    };
    winningEdgeSummary: string;
  };
}

export const VERTICAL_BENCHMARKS: Record<EcommerceVertical, VerticalBenchmark> = {
  supplements: {
    id: 'supplements',
    label: 'Supplements & Longevity Health',
    benchmarkAOV: 78,
    grossMarginPct: 76,
    defaultCogsPct: 24,
    avgRefundRatePct: 6,
    healthyMER: 2.8,
    healthyBlendedCAC: 42,
    repeatRate90dPct: 38,
    healthyBundleRatioPct: 28,
    maxHealthyScripts: 22,
    leaderBrand: {
      name: 'AG1 / Thorne Tier Benchmark',
      domain: 'drinkag1.com',
      cqiScore: 89,
      aov: 98,
      blendedCAC: 41,
      bundleRatioPct: 42,
      activeAdCount: 140,
      videoAdSharePct: 74,
      scriptCount: 18,
      repeatRate90dPct: 52,
      pillars: { unitEconomics: 91, adSignal: 88, offerArchitecture: 94, techStack: 86, brandAuthority: 85 },
      winningEdgeSummary: 'Locks first-order contribution margin via 90-day subscription starter kits and hybrid UGC/scientific mechanism hooks with <2% discount code reliance.'
    }
  },
  skincare: {
    id: 'skincare',
    label: 'Skincare & Clinical Beauty',
    benchmarkAOV: 68,
    grossMarginPct: 74,
    defaultCogsPct: 26,
    avgRefundRatePct: 8,
    healthyMER: 3.0,
    healthyBlendedCAC: 36,
    repeatRate90dPct: 32,
    healthyBundleRatioPct: 25,
    maxHealthyScripts: 24,
    leaderBrand: {
      name: 'Summer Fridays / Rhode Tier Benchmark',
      domain: 'summerfridays.com',
      cqiScore: 87,
      aov: 76,
      blendedCAC: 32,
      bundleRatioPct: 35,
      activeAdCount: 95,
      videoAdSharePct: 78,
      scriptCount: 19,
      repeatRate90dPct: 41,
      pillars: { unitEconomics: 88, adSignal: 89, offerArchitecture: 86, techStack: 84, brandAuthority: 88 },
      winningEdgeSummary: 'Drives 2.3x AOV-to-CAC ratio through routine regimen builders (3-step sets) and zero strikethrough discount erosion.'
    }
  },
  apparel: {
    id: 'apparel',
    label: 'Apparel & Performance Fashion',
    benchmarkAOV: 92,
    grossMarginPct: 64,
    defaultCogsPct: 36,
    avgRefundRatePct: 22,
    healthyMER: 3.4,
    healthyBlendedCAC: 38,
    repeatRate90dPct: 24,
    healthyBundleRatioPct: 18,
    maxHealthyScripts: 25,
    leaderBrand: {
      name: 'Vuori / Gymshark Tier Benchmark',
      domain: 'vuoriclothing.com',
      cqiScore: 85,
      aov: 118,
      blendedCAC: 37,
      bundleRatioPct: 24,
      activeAdCount: 160,
      videoAdSharePct: 68,
      scriptCount: 21,
      repeatRate90dPct: 34,
      pillars: { unitEconomics: 83, adSignal: 87, offerArchitecture: 84, techStack: 85, brandAuthority: 86 },
      winningEdgeSummary: 'Protects net margin against apparel return rates via multi-pack basics, streamlined mobile size selectors, and server-side CAPI enrichment.'
    }
  },
  food_bev: {
    id: 'food_bev',
    label: 'Functional Food & Beverage',
    benchmarkAOV: 56,
    grossMarginPct: 58,
    defaultCogsPct: 42,
    avgRefundRatePct: 4,
    healthyMER: 2.9,
    healthyBlendedCAC: 29,
    repeatRate90dPct: 36,
    healthyBundleRatioPct: 35,
    maxHealthyScripts: 20,
    leaderBrand: {
      name: 'Magic Spoon / Olipop Tier Benchmark',
      domain: 'magicspoon.com',
      cqiScore: 86,
      aov: 64,
      blendedCAC: 27,
      bundleRatioPct: 48,
      activeAdCount: 110,
      videoAdSharePct: 72,
      scriptCount: 17,
      repeatRate90dPct: 44,
      pillars: { unitEconomics: 85, adSignal: 88, offerArchitecture: 92, techStack: 82, brandAuthority: 83 },
      winningEdgeSummary: 'Eliminates single-item checkout completely; forces 4-box variety customizer packs so AOV stays 2.4x above Paid CAC.'
    }
  },
  home_lifestyle: {
    id: 'home_lifestyle',
    label: 'Home, Kitchen & Lifestyle',
    benchmarkAOV: 135,
    grossMarginPct: 60,
    defaultCogsPct: 40,
    avgRefundRatePct: 11,
    healthyMER: 3.5,
    healthyBlendedCAC: 58,
    repeatRate90dPct: 18,
    healthyBundleRatioPct: 22,
    maxHealthyScripts: 24,
    leaderBrand: {
      name: 'Our Place / Brooklinen Tier Benchmark',
      domain: 'fromourplace.com',
      cqiScore: 84,
      aov: 165,
      blendedCAC: 52,
      bundleRatioPct: 32,
      activeAdCount: 85,
      videoAdSharePct: 65,
      scriptCount: 20,
      repeatRate90dPct: 26,
      pillars: { unitEconomics: 84, adSignal: 83, offerArchitecture: 88, techStack: 81, brandAuthority: 84 },
      winningEdgeSummary: 'Maximizes first-order cash via high-AOV suite bundles and post-purchase accessory upsells.'
    }
  },
  pets: {
    id: 'pets',
    label: 'Pet Health & Accessories',
    benchmarkAOV: 64,
    grossMarginPct: 66,
    defaultCogsPct: 34,
    avgRefundRatePct: 8,
    healthyMER: 3.1,
    healthyBlendedCAC: 34,
    repeatRate90dPct: 33,
    healthyBundleRatioPct: 26,
    maxHealthyScripts: 22,
    leaderBrand: {
      name: 'The Farmer’s Dog / Native Pet Tier Benchmark',
      domain: 'nativepet.com',
      cqiScore: 86,
      aov: 74,
      blendedCAC: 31,
      bundleRatioPct: 34,
      activeAdCount: 90,
      videoAdSharePct: 75,
      scriptCount: 18,
      repeatRate90dPct: 42,
      pillars: { unitEconomics: 86, adSignal: 87, offerArchitecture: 85, techStack: 86, brandAuthority: 86 },
      winningEdgeSummary: 'Combines problem-solution educational video hooks with multi-month autoship bundles.'
    }
  }
};
