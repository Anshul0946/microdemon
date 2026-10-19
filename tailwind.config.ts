import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'cqi-bg': 'var(--color-bg)',
        'cqi-surface': 'var(--color-surface)',
        'cqi-surface-2': 'var(--color-surface-2)',
        'cqi-surface-3': 'var(--color-surface-3)',
        'cqi-accent': 'var(--color-accent)',
        'cqi-accent-dim': 'var(--color-accent-dim)',
        'cqi-text': 'var(--color-text)',
        'cqi-muted': 'var(--color-text-muted)',
        'cqi-border': 'var(--color-border)',
        'cqi-danger': 'var(--color-danger)',
        'cqi-danger-dim': 'var(--color-danger-dim)',
        'cqi-warning': 'var(--color-warning)',
        'cqi-warning-dim': 'var(--color-warning-dim)',
        'cqi-success': 'var(--color-success)',
        'cqi-success-dim': 'var(--color-success-dim)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
    },
  },
  plugins: [],
}

export default config
