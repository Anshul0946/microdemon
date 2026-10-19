# 03 — CQI Design System

This file defines how CQI looks and feels.

Goal: CQI should feel like an **institutional audit console**, not a generic SaaS landing page.

Tone keywords: **authoritative**, **precise**, **dark**, **data‑led**, **no fluff**.

All UI must use the tokens and patterns here. No ad‑hoc colors or styles.

---

## 1. Global theme (light-neutral)

CQI utilizes a **light/neutral theme** to ensure high contrast, clear readability, and a modern corporate look.

Base rules:

- Page background is off-white/light grey.
- Cards and panels are elevated white surfaces with subtle shadows.
- Text is dark grey/slate to ensure crisp contrast.
- Color is used for **meaning** (risk, evidence, CQI grade), not decoration.

---

## 2. Design tokens (globals.css)

Define these tokens in `app/globals.css` (or the main CSS file) and use them everywhere.

```css
:root {
  /* Background surfaces */
  --color-bg:             #f8fafc;  /* main page background (slate-50) */
  --color-surface:        #ffffff;  /* base card surface (white) */
  --color-surface-2:      #f1f5f9;  /* elevated card surface (slate-100) */
  --color-surface-3:      #e2e8f0;  /* deepest surface layer (slate-200) */
  --color-border:         rgba(15, 23, 42, 0.08);  /* slate-900 at 8% opacity */
  --color-border-strong:  rgba(15, 23, 42, 0.16);  /* slate-900 at 16% opacity */

  /* Text */
  --color-text:           #0f172a;  /* slate-900 text */
  --color-text-muted:     #475569;  /* slate-600 muted text */
  --color-text-faint:     #94a3b8;  /* slate-400 faint text */
  --color-text-inverse:   #ffffff;  /* white text on accent backgrounds */

  /* Accent (institutional corporate teal/blue) */
  --color-accent:         #0d9488;  /* teal-600 */
  --color-accent-hover:   #0f766e;  /* teal-700 */
  --color-accent-dim:     rgba(13, 148, 136, 0.08);

  /* Status colors */
  --color-danger:         #dc2626;  /* red-600 */
  --color-danger-dim:     rgba(220, 38, 38, 0.06);
  --color-warning:        #d97706;  /* amber-600 */
  --color-warning-dim:    rgba(217, 119, 6, 0.06);
  --color-success:        #16a34a;  /* green-600 */
  --color-success-dim:    rgba(22, 163, 74, 0.06);

  /* CQI grade colors (institutional grade levels) */
  --color-grade-a:        #16a34a;  /* 85–100: Asset Compounder */
  --color-grade-b:        #84cc16;  /* 70–84: Efficiency Opportunity */
  --color-grade-c:        #d97706;  /* 55–69: Signal Contaminated */
  --color-grade-d:        #ea580c;  /* 40–54: Structurally Leaking */
  --color-grade-f:        #dc2626;  /* 0–39: Capital Destruction Risk */

  /* Spacing scale */
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */

  /* Radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Fonts */
  --font-display: 'Syne', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body:    'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;

  /* Type scale */
  --text-xs:   0.75rem;   /* 12px – labels, badges */
  --text-sm:   0.875rem;  /* 14px – secondary text, buttons */
  --text-base: 1rem;      /* 16px – primary body copy */
  --text-lg:   1.125rem;  /* 18px – card headings */
  --text-xl:   1.25rem;   /* 20px – section headings */
  --text-2xl:  1.5rem;    /* 24px – module titles */
  --text-3xl:  1.875rem;  /* 30px – CQI grade display */
  --text-4xl:  2.25rem;   /* 36px – hero numbers */
  --text-hero: 3.5rem;    /* 56px – home hero headline only */
}
```

---

## 3. Fonts (Next.js layout)

Load fonts in `app/layout.tsx` using `<Head>` or metadata:

```tsx
{/* app/layout.tsx head section */}
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link
  href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
  rel="stylesheet"
/>
```

Usage rules:

- `--font-display` (Syne)
  - For CQI grade number, module titles, hero headline.
  - Not for long body text.
- `--font-body` (Inter)
  - All body text, labels, buttons.
- `--font-mono` (JetBrains Mono)
  - All numeric output: dollar amounts, percentages, metrics.

---

## 4. Layout system

### 4.1 Page layout

- Max content width: `1200px`.
- Center with `mx-auto`.
- Horizontal padding: `px-6` (mobile), `px-10` (desktop).
- Section vertical spacing: `py-12` (mobile), up to `py-16` (desktop).

Example shell:

```tsx
// app/layout.tsx (body)
<body className="bg-cqi-bg text-cqi-text font-body antialiased">
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1 px-6 md:px-10 py-10">
      {children}
    </main>
    <Footer />
  </div>
</body>
```

### 4.2 Grid vs flex

- Use **CSS Grid** for macro layout (two columns on desktop: intake vs results).
- Use **Flexbox** inside components (rows, alignments, badges, etc.).

Example home layout:

```tsx
<div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
  {/* Left: hero + intake */}
  <section>...</section>

  {/* Right: execution log + quick summary */}
  <aside>...</aside>
</div>
```

---

## 5. Component patterns

### 5.1 Card

Standard card used for modules, executive summary, and info blocks.

```css
/* Conceptual CSS; implemented via Tailwind classes */
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}
```

Tailwind example:

```tsx
<div className="bg-cqi-surface border border-cqi-border rounded-xl p-6">
  {children}
</div>
```

Nested card (inside another card):

```tsx
<div className="bg-[color:var(--color-surface-2)] border border-cqi-border rounded-lg p-4">
  {children}
</div>
```

### 5.2 Primary button

For main CTAs (e.g., “Run CQI Diagnostic”, “Export PDF”):

```tsx
<button
  className="
    inline-flex items-center justify-center
    rounded-md
    bg-cqi-accent
    text-[color:var(--color-text-inverse)]
    text-sm font-semibold
    px-5 py-2.5
    hover:bg-[color:var(--color-accent-hover)]
    transition-colors
  "
>
  Run CQI Diagnostic
</button>
```

### 5.3 Ghost button

For secondary actions:

```tsx
<button
  className="
    inline-flex items-center justify-center
    rounded-md
    border border-cqi-border
    text-cqi-text
    text-sm font-medium
    px-4 py-2
    bg-transparent
    hover:border-[color:var(--color-border-strong)]
    transition-colors
  "
>
  View Methodology
</button>
```

### 5.4 Data row pattern

Used for metric lists inside modules.

```tsx
<div className="flex items-center justify-between py-2 border-b border-cqi-border last:border-b-0">
  <span className="text-xs text-cqi-muted">Metric label</span>
  <span className="font-mono text-sm text-cqi-text">123.4%</span>
</div>
```

---

## 6. CQI gauge and evidence badge

### 6.1 CQI Gauge

Visual representation of 0–100 score.

Guidelines:

- Use SVG arc with stroke based on grade color:
  - 85–100 → `--color-grade-a`
  - 70–84  → `--color-grade-b`
  - 55–69  → `--color-grade-c`
  - 40–54  → `--color-grade-d`
  - 0–39   → `--color-grade-f`
- In the center:
  - Grade number in Syne (`--font-display`), `--text-3xl`.
  - Label below (e.g., “Asset Compounder”) in small caps.

### 6.2 Evidence badge

Appears in the Executive Summary card, top-right.

States:

- FULL EVIDENCE → green tone
- PARTIAL EVIDENCE → yellow tone
- SIMULATION MODE → red tone

Example:

```tsx
function EvidenceBadge({ mode }: { mode: 'full' | 'partial' | 'simulated' }) {
  const config = {
    full: {
      label: 'FULL EVIDENCE',
      bg: 'bg-[color:var(--color-success-dim)]',
      border: 'border-[color:var(--color-success)]',
      text: 'text-[color:var(--color-success)]',
    },
    partial: {
      label: 'PARTIAL EVIDENCE',
      bg: 'bg-[color:var(--color-warning-dim)]',
      border: 'border-[color:var(--color-warning)]',
      text: 'text-[color:var(--color-warning)]',
    },
    simulated: {
      label: 'SIMULATION MODE',
      bg: 'bg-[color:var(--color-danger-dim)]',
      border: 'border-[color:var(--color-danger)]',
      text: 'text-[color:var(--color-danger)]',
    },
  }[mode]

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-semibold tracking-[0.12em]',
        config.bg,
        config.border,
        config.text,
      ].join(' ')}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  )
}
```

---

## 7. Execution log

Execution log is a **terminal-like panel** that shows pipeline steps while running.

Visual:

- Background: `--color-surface-3`
- Border: `--color-border`
- Font: `--font-mono`, `--text-sm`
- Text: `--color-text-muted`

Each line begins with a glyph:

- Active step → `●` colored in accent
- Completed → `✓` colored in success
- Failed / fallback → `✗` colored in danger
- Pending → `○` faint

Example:

```tsx
<div className="bg-[color:var(--color-surface-3)] border border-cqi-border rounded-xl p-4 font-mono text-xs text-cqi-muted">
  <div className="flex items-center gap-2">
    <span className="text-cqi-accent">●</span>
    <span>Validating domain…</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-cqi-success">✓</span>
    <span>Shopify store data fetched</span>
  </div>
  <div className="flex items-center gap-2">
    <span className="text-cqi-muted">○</span>
    <span>Running data normalization</span>
  </div>
</div>
```

---

## 8. Module card layout

Each module (1–5) follows the same structural layout to keep report consistent.

Structure:

```text
┌─────────────────────────────────────────────────────────────┐
│ MODULE N LABEL (xs, uppercase, muted)                       │
│ Module Title (2xl, display font)          [Small grade tag] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CURRENT STATE (left column)                               │
│  ───────────────────────────────────                        │
│  [Key number, mono, large]                                 │
│  [2–4 data rows with metrics]                              │
│                                                             │
│  DREAM STATE (right column)                                │
│  ───────────────────────────────────                        │
│  [Short paragraph: what “fixed” looks like]                │
│  [Dollar impact of fixing, mono font]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Implementation pattern:

- Use a responsive grid:
  - Mobile: stacked (current then dream).
  - Desktop: two columns.

Example skeleton:

```tsx
<div className="bg-cqi-surface border border-cqi-border rounded-xl p-6 space-y-4">
  <header className="flex items-start justify-between gap-4">
    <div>
      <p className="text-[10px] font-semibold tracking-[0.18em] text-cqi-muted">
        MODULE 1 — AD SIGNAL CONTAMINATION MATRIX
      </p>
      <h2 className="mt-1 text-2xl font-display">Ad Signal Integrity</h2>
    </div>
    {/* Optional small chip showing risk / grade within the module */}
  </header>

  <div className="grid gap-6 md:grid-cols-2">
    {/* Current state */}
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-[0.16em] text-cqi-muted">
        CURRENT STATE
      </h3>
      {/* key number + data rows */}
    </section>

    {/* Dream state */}
    <section className="space-y-3">
      <h3 className="text-xs font-semibold tracking-[0.16em] text-cqi-muted">
        DREAM STATE
      </h3>
      {/* description + dollar impact */}
    </section>
  </div>
</div>
```

---

## 9. Tailwind configuration

Tailwind must be configured to read these CSS variables as theme tokens.

```ts
// tailwind.config.ts
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
        'cqi-text': 'var(--color-text)',
        'cqi-muted': 'var(--color-text-muted)',
        'cqi-border': 'var(--color-border)',
        'cqi-danger': 'var(--color-danger)',
        'cqi-warning': 'var(--color-warning)',
        'cqi-success': 'var(--color-success)',
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
```

Use these keys (`cqi-bg`, `cqi-surface`, etc.) instead of raw hex values.

---

## 10. Visual anti-patterns (NEVER use)

To keep CQI out of “generic SaaS” territory, avoid:

- ❌ Gradients (backgrounds, buttons, text)
- ❌ Blurry blobs, abstract shapes, or random decorative SVGs
- ❌ Icons inside colored circles as section headers
- ❌ Emoji in headings or body text
- ❌ Centered long-form body text (only hero headline may be centered)
- ❌ Dark mode (CQI is light/neutral themed)
- ❌ Random Tailwind grays (`text-gray-500`, etc.) instead of tokens
- ❌ Overly rounded “pill” cards everywhere (use the radius tokens)

If a visual choice is not clearly aligned with this design system, do not use it.

---

Use this file as the **single reference** for colors, type, spacing, and component styles.
Any new component must fit into this system, not invent a new one.