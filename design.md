# WinBack Design System (design.md)

This document defines the visual language for WinBack, per ERD Part 2 §12.

## 7. Density Stance
**Dense and Professional.** This is a Bloomberg-like finance tool for PE professionals. We prioritize data density, readability, and information scent over airy whitespace. Component padding is compact.

## 1. Color Tokens
Using Tailwind `hsl` values.

- **Background:** `0 0% 100%` (light) / `224 71% 4%` (dark)
- **Foreground:** `222.2 47.4% 11.2%` (light) / `213 31% 91%` (dark)
- **Card:** `0 0% 100%` / `224 71% 4%`
- **Card Foreground:** `222.2 47.4% 11.2%` / `213 31% 91%`
- **Popover:** `0 0% 100%` / `224 71% 4%`
- **Popover Foreground:** `222.2 47.4% 11.2%` / `213 31% 91%`
- **Primary / Accent:** `222.2 47.4% 11.2%` / `210 40% 98%`
- **Primary Foreground:** `210 40% 98%` / `222.2 47.4% 1.2%`
- **Muted:** `210 40% 96.1%` / `223 47% 11%`
- **Muted Foreground:** `215.4 16.3% 46.9%` / `215.4 16.3% 56.9%`
- **Border:** `214.3 31.8% 91.4%` / `216 34% 17%`
- **Input:** `214.3 31.8% 91.4%` / `216 34% 17%`
- **Ring:** `222.2 84% 4.9%` / `216 34% 50%`

**Semantic States (Descriptive, not evaluative):**
- **Positive (Above Median):** `--above-median` - Blue/Cyan (`221 83% 53%` / `217 91% 60%`)
- **Negative (Below Median):** `--below-median` - Indigo/Purple (`262 83% 58%` / `261 51% 51%`)
- **Neutral (Inline):** `--inline-median` - Slate/Gray (`215 16% 47%` / `215 16% 57%`)
- **Attention/Evidence (Crosscheck Flag):** `--attention` - Amber/Orange (`38 92% 50%` / `48 96% 53%`). Reads as "look at this," not "this is bad." `--attention-foreground` - `48 96% 15%` / `48 96% 85%`

## 2. Typography
- **Font Families:** 
  - Sans: `var(--font-geist-sans)`, falling back to `Inter, ui-sans-serif, system-ui, sans-serif`.
  - Mono: `var(--font-geist-mono)`, falling back to `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`.
- **Financial Figures (Tabular):** Apply `tabular-nums` class to all columns of numbers (financials, benchmark table, cap table) to ensure aligned digits. Standalone large numbers (like in the Decision screen's crosscheck card) use proportional by default unless part of a grid comparison.

## 3. Spacing & Layout
- **Page Max-Width:** `max-w-6xl` (approx 1152px) for desktop-first experience.
- **Analysis Split Ratio:** `grid-cols-12` where Benchmark is `col-span-7` and Portfolio Impact is `col-span-5` (approx 58% / 42% split) on `lg` screens.
- **Evidence Drawer:** Width is `w-[500px]` (or `max-w-md` to `max-w-xl`). Uses overlay (Sheet component from shadcn), dimming the background slightly (`backdrop-blur-sm`).

## 4. Component Specs
- **Stage Stepper:** Horizontal list, active stage uses `--stage-active` (Primary color, bold), completed uses `--stage-done` (Muted foreground), pending uses muted.
- **Metric Row:** Dense table row. Target value is bold. Delta indicator uses an arrow or `+`/`-` colored by the descriptive semantic tokens (Above/Below/Inline).
- **Concentration Bar:** Stacked bar or paired horizontal bars. Target sector uses Primary color, others use Muted.
- **Crosscheck Finding Card:** Neutral border. The quantification grid uses `bg-muted/30` with `tabular-nums` for the figures.
- **Evidence Chip:** Default: subtle `bg-muted text-muted-foreground border-border`. Hover: `border-attention text-attention-foreground`. Active: solid `bg-attention/20 text-attention-foreground`.
- **Evidence Drawer:** Header with Doc title/page. Body with paragraphs. Highlighted block gets a soft `--attention` background (`bg-attention/10`). Exact quote gets a stronger `--attention` background (`bg-attention/30 font-medium`).
- **IC Memo Surface:** `bg-background` inside a card with a subtle border. Generous line length (`max-w-none prose prose-sm`).
- **Disabled Card ("Coming Soon"):** `opacity-50 grayscale bg-muted/50 cursor-not-allowed`.

## 5. States
- **Loading:** Progressive reveal with `Skeleton`. For extraction, staged honest copy (e.g., "Classifying documents...", "Extracting financials...") without a single centered spinner.
- **Empty:** Muted text, centered or aligned left depending on context. e.g. "No documents loaded."
- **Error:** Calm inline message in a `bg-destructive/10 border-destructive/30 text-destructive` box with a 'Retry' button.
- **MOCK Badge:** Amber badge (`bg-amber-500/20 text-amber-600 border-amber-500/30`) in header when `run.mock` is true.

## 6. Motion
- **Drawer:** Standard shadcn/ui sheet transition (ease-in-out, ~300ms).
- **Pipeline Stages:** Simple fade-in (`animate-in fade-in duration-300`) for data panels to avoid jarring pops. No heavy animations.
