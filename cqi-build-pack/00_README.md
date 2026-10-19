# CQI Micro-SaaS — Complete Build Pack

READ THIS FIRST BEFORE TOUCHING ANY OTHER FILE.

---

## What is this folder?

This folder is the **single source of truth** for building the CQI (Customer Quality Index)
micro-SaaS inside Antigravity. Every file here serves a specific purpose. Nothing is redundant.
Nothing is optional.

CQI is already fully defined in the product blueprint (`01_PRODUCT_BLUEPRINT.md`), and all
other files exist to implement that blueprint — not to change it.

---

## How to use these files

1. Put this entire folder into your Antigravity workspace root.
2. Antigravity auto-loads `agent.md` and `rules.md` as its system instructions.
3. Before writing any code:
   - Read `agent.md`
   - Read `rules.md`
   - Read `01_PRODUCT_BLUEPRINT.md`
   - Read `02_ARCHITECTURE.md`
   - Read `03_DESIGN_SYSTEM.md`
   - Read `04_DATA_LAYER.md`
4. Only then open the PART file for the current build step:
   - Start with `PART_1_UI_FOUNDATION.md`
   - Do **not** open or implement later parts until the current part’s checklist passes.

Think of this folder as the “operating manual” for the AI engineer. It tells it
**exactly** what to build, in what order, and what it is not allowed to touch.

---

## File map (high-level index)

| File                             | Purpose                                                        | Read when             |
|----------------------------------|----------------------------------------------------------------|-----------------------|
| `00_README.md`                   | Orientation + file map + core rules                           | First                 |
| `agent.md`                       | Antigravity agent identity + behavior                         | First                 |
| `rules.md`                       | Non‑negotiable architecture/design rules                      | First                 |
| `01_PRODUCT_BLUEPRINT.md`        | Full CQI product blueprint (concept, modules, formulas)       | Before any code       |
| `02_ARCHITECTURE.md`            | Tech stack, repo tree, data flow, env vars, schema            | Before any code       |
| `03_DESIGN_SYSTEM.md`           | Colors, type, spacing, component patterns, anti‑patterns      | Before any UI         |
| `04_DATA_LAYER.md`              | Shared data layer: Apify, NIM, Supabase, CQI types            | Before any modules    |
| `PART_1_UI_FOUNDATION.md`       | Build task: shell UI + intake + thin `/api/audit` slice       | Phase 1               |
| `PART_2_MODULE1_AD_SIGNAL.md`   | Build task: Module 1 (Ad Signal Contamination Matrix)         | Phase 2               |
| `PART_3_MODULE2_STOCKOUT.md`    | Build task: Module 2 (Best‑Seller Stockout Conflict Ledger)   | Phase 3               |
| `PART_4_MODULE3_TECHSTACK.md`   | Build task: Module 3 (Tech Stack Redundancy Paradox)          | Phase 4               |
| `PART_5_MODULE4_AI_VISIBILITY.md` | Build task: Module 4 (Conversational Engine Invisibility)    | Phase 5               |
| `PART_6_MODULE5_VALUATION.md`   | Build task: Module 5 (Terminal Enterprise Valuation Markdown) | Phase 6               |
| `PART_7_COMPETITIVE_BENCHMARK.md` | Build task: Competitive shadow benchmark                     | Phase 7               |
| `PART_8_PDF_EXPORT.md`          | Build task: PDF export + Resolution Protocol page             | Phase 8               |
| `QA_CHECKLIST.md`               | Phase-by-phase gate checklist                                 | After each part       |

---

## Build philosophy

This project is **not** “build everything at once.” It is a controlled sequence
of thin slices. Each part:

- Adds a small, coherent piece of functionality
- Has a clearly defined scope
- Has a clear **“do not do these things yet”** section
- Has tests and QA criteria that must pass before moving on

This is how we prevent regressions and keep each module cleanly separated.

---

## Build sequence (very important)

```text
Part 1 → QA → Pass → Part 2 → QA → Pass → Part 3 → QA → Pass → ... → Part 8
```

- You are not allowed to start Part 2 until:
  - All Part 1 tasks are implemented, and
  - All Part 1 items in `QA_CHECKLIST.md` are satisfied.

Repeat this pattern for each subsequent part.

---

## “Source of truth” hierarchy

If there is ever a conflict:

1. **Product blueprint (`01_PRODUCT_BLUEPRINT.md`) wins.**
2. Then `rules.md` (non‑negotiable constraints).
3. Then `02_ARCHITECTURE.md` (wiring and env).
4. Then `03_DESIGN_SYSTEM.md` (visual rules).
5. Then `04_DATA_LAYER.md` (data + types).
6. PART files only define the *order and scope* of implementation.

Never change formulas, module meanings, or high-level behavior
without updating the product blueprint first.

---

## Critical rules (summary)

These are spelled out in more detail in `rules.md`, but this is the short list:

1. **One part at a time**  
   Never implement a later part while working on an earlier one.

2. **Shared data layer only**  
   All calls to Apify, Supabase, NIM/Bedrock must go through `lib/data/`.

3. **No math in AI**  
   All CQI scores, financial calculations, risk discounts, equity loss,
   and module metrics are computed in TypeScript (`lib/cqi/*`).

4. **Max 10 ads per network**  
   Meta and Google data is always capped at 10 ads per brand.

5. **Zero authentication in v1**  
   No login, signup, or email gate.

6. **NVIDIA NIM for dev; swap via env only**  
   AI model wrapper must be OpenAI‑compatible. Switching to production model
   must be possible by changing environment variables only.

7. **Design system is locked**  
   All UI uses tokens and patterns from `03_DESIGN_SYSTEM.md`.
   No arbitrary colors, spacing, or fonts.

8. **Tests and QA before “done”**  
   A part is not complete until:
   - Its unit tests pass.
   - Its integration tests pass.
   - All relevant items in `QA_CHECKLIST.md` are checked.

---

## How to start (for Antigravity or any AI agent)

1. Read `agent.md` and `rules.md` completely.
2. Read `01_PRODUCT_BLUEPRINT.md` to internalize what CQI is.
3. Read `02_ARCHITECTURE.md`, `03_DESIGN_SYSTEM.md`, `04_DATA_LAYER.md`.
4. Open `PART_1_UI_FOUNDATION.md` and follow it **exactly**, no extra features.
5. After Part 1 passes QA, proceed to Part 2, and so on.

If you are ever unsure whether a change is in scope for the current part,
**you must not implement it yet**. Leave a `// TODO: confirm scope` comment and continue.
