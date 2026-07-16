# EPR design guide

The house style for the **Epidemic Preparedness and Response** book and every
interactive illustration in it. Read this before adding or changing any figure
so the whole book stays visually consistent.

The single source of truth for values is code, not this file:

- `_brand.yml` -> Quarto theme colours and fonts
- `epr.scss` -> CSS custom properties (`--epr-*`), including illustration tokens
- `js/epr-viz.js` -> the same tokens as a JS fallback (`EPR.colors()`), plus shared math, tweening and injected component CSS

This document explains *what the values mean and how to use them*. If a value
here ever disagrees with the code, the code wins; fix this file.

---

## 1. Principles

1. **Clinical calm.** White canvas, soft slate ink, one cool accent. No gradients, no drop shadows beyond a faint contact shadow, no clutter. Flat, modern, quiet.
2. **The metaphor is the lesson.** An "illustration" here is a playable cartoon or game that builds intuition (the bottle filling line for CUSUM), not an abstract chart in nice colours.
3. **One honest scale.** When a picture encodes a quantity, the measuring element uses one pixels-per-unit ruler. Never fudge it to make a value readable.
4. **Simple over detailed.** Prefer a clean silhouette to fussy realism. Add detail only where it teaches something; drop it everywhere else.
5. **Mobile first, gesture friendly.** Big type, big tap targets, smooth on a phone. Time always flows left to right.
6. **Design before code.** Agree a storyboard and a static mockup before building. Prefer a single screen where everything is visible and live over a Next/Back wizard.
7. **Never use the em dash.** Use a comma, a colon, or "->".

---

## 2. Colour

Colour-blind safe: meaning is carried by blue vs amber/teal (not red/green), plus position and shape. Red and amber are always backed by a second cue (a lit lamp, a dashed line, the word "OVERFLOW").

### Core tokens

| Token | Hex | Role |
|---|---|---|
| `ink` | `#1f2933` | Foreground text, chart labels |
| `muted` | `#64748b` | Secondary labels, axes, ticks, rim |
| `grid` | `#e7ecf1` | Hairlines, card borders, faint fills |
| `surface` | `#ffffff` | Page and card background |
| `surfaceAlt` | `#f4f7fa` | Inset panels, chips |
| `expected` (teal) | `#0f9b8e` | In-control baseline, in-spec liquid, "drift began" marker |
| `accent` (blue) | `#2563eb` | The active statistic, primary buttons, the current vial ring |
| `accentSoft` | `rgba(37,99,235,.13)` | Area under the live statistic, focus ring |
| `alarm` (amber) | `#d97706` | Overfill above the line (wasted dose), over-target bars |
| `alarmStrong` (red) | `#dc2626` | Threshold H, overflow liquid, lit alarm lamp |

### Illustration tokens (vial + conveyor)

| Token | Hex | Use |
|---|---|---|
| `glass` | `#eef3f8` | Glass body and neck fill |
| `glassStroke` | `#9aa7b5` | Glass outline |
| `cap` | `#8b95a1` | Aluminium cap base |
| `capHi` | `#b9c1ca` | Cap highlight |
| `belt` | `#8b98a8` | Conveyor belt |
| `roller` | `#b6c0cc` | Belt rollers |
| `capEdge` `crimp` | `#6f7882` `#7e8893` | Optional cap detail, for larger vials only |

Liquid meniscus shades used in code: amber light `#f0a83a`, red light `#f0726b`.
Read tokens at run time with `EPR.color("expected")` or `EPR.colors()`; never
hard-code a hex in a chapter script except pure white highlights (`#ffffff`).

---

## 3. Typography

- **Family:** Inter (Google), weights 400/500/600/700. Monospace for formulas only: Iosevka, then system mono.
- **Body:** ~18px, line-height 1.65. Headings 600 weight.
- **In SVG figures:** no label below 10.5px in the 760-wide viewBox, and never below 12px for anything the learner must read (chips, axis numbers, the weight bubble). Use `font-variant-numeric: tabular-nums` for any changing number so it does not jiggle.

---

## 4. The vaccine vial (signature component)

Every vial in the book is the same object: a small, **squat** glass vaccine vial
with a grey aluminium cap. It is drawn directly on the conveyor belt; there is no
separate enlarged "hero" vial. Code: `beltVial` in `js/cusum.js`.

### Anatomy

1. **Grey aluminium cap** (`cap`) with a thin lighter highlight strip (`capHi`).
2. **Short neck** (`glass`), narrower than the body.
3. **Squat glass body** (`glass`, outline `glassStroke`), roughly 1.4 times taller than wide, with softly rounded corners. Keep it squat; a tall narrow body reads as a test tube.
4. **One gloss highlight:** a single thin white streak on the left of the body. This is what makes flat glass read as glass; do not use gradients or multiple streaks.
5. **Teal liquid** (`expected`) at ~34% opacity, filled to a consistent line.
6. **Amber top** (`alarm`) only when the vial went over the line, drawn as a small band above the liquid.

No label or barcode: at belt size that detail is noise. Keep the vial clean.

### Current vial

The vial being measured (the newest on the belt) gets an **accent ring**
(`accent`, 1.8px) and a dark **weight bubble** floating above it showing the
fill in mL. Everything earlier stays on the belt in order so the learner sees
the whole run.

### Sizing and honest scale

Vials are drawn large in a **sliding window** of 6 (see section 5), so each one
is clearly readable. Inside a vial, fill is shown honestly at 80 px per mL
around the 3.0 line: under-target vials show the teal liquid sitting below the
line, over-target vials show a small amber band above it. The exact running
total lives in the CUSUM chart, not in the vial.

### Do / don't

- Do keep the body squat and the cap grey. Don't make it tall, and don't use a black or coloured cap.
- Do show teal fill, amber only when over. Don't add labels, barcodes, or a second gloss streak.
- Do ring the current vial and float its weight bubble. Don't highlight more than one vial.

---

## 5. Conveyor, charts, and the CUSUM example

The figure has three stacked parts that share one vial-number axis on the two charts.

**Sliding-window belt.** Only the 6 most recent vials are drawn, large. Each
"Next vial" slides the row left by one slot: the new vial enters from the right,
the oldest leaves on the left (the row is clipped at both edges). Animate the
slide with `EPR.tween` (~300ms) and respect `prefers-reduced-motion`. The newest
vial is ringed in accent blue with a weight bubble; a "vial N of 40" counter and
a progress bar show how far the batch has run. The belt has rollers but no legs.

**Volume bar chart.** One bar per vial, drawn from the 3.0 target line on a
zoomed axis (about 2.74 to 3.34 mL) so a 0.15 mL drift is visible. Amber when
over target, teal when under, red if a single vial passes the per-vial 3.30 mL
limit. Show the target line, the per-vial limit, and the revealed drift-onset line.

**CUSUM chart.** The exact one-sided tabular CUSUM (Page 1954):
`S = max(0, S + (volume - 3.0 - K))`, signal when `S > H`, with allowance
`K = 0.05` (k = 0.5σ) and decision interval `H = 0.5` (h = 5σ); target 3.0,
σ = 0.1, so the per-vial limit is 3.30 (μ0 + 3σ). The chart draws S over the
vials with the dashed H line and a red signal dot. One-sided ARL0 is about 930.

The two rules are the lesson: a per-vial 3.30 limit misses a small sustained
drift, while CUSUM accumulates the evidence and signals within a few vials. The
mode toggle switches which rule stops the run.

**No tank.** The old "overfill tank" was a loose stand-in for the accumulator;
the CUSUM chart now shows that accumulator exactly, so the tank was removed.

## 6. Shared chart grammar

Every quantitative chart in the book uses the same conventions:

- Time / sequence on the x axis, left to right.
- The expected level is teal; a muted teal band shows the expected range.
- The live statistic is the blue line with a soft blue area fill under it.
- The threshold is a dashed line (amber for a soft limit, red for a hard stop H).
- An alarm is a red dot or a short pulse, never colour alone.

---

## 7. Motion and gestures

- **One pointer model.** Use Pointer Events (`pointerdown` / `pointermove` / `pointerup`) for any drag, with `setPointerCapture` and CSS `touch-action: none` on the draggable element so a phone does not scroll the page while dragging. Do not ship separate mouse and touch code paths.
- **Tap targets** are at least 44px tall (buttons already are in `epr-viz.js`).
- **Animate with** `EPR.tween` (requestAnimationFrame, cubic ease). Keep transitions short (about 240ms) so the line never feels laggy.
- **Respect `prefers-reduced-motion`.** `EPR.tween`, the alarm pulse and the leak drip already fall back to an instant state; anything new must do the same.
- **Immediate feedback:** show the weight bubble, slide the belt, and update both charts on the same click.

---

## 8. Accessibility

- Each figure `<svg>` has `role="img"` and a plain-language `aria-label` (or `<title>` + `<desc>`) describing what it shows.
- Text and meaningful marks meet WCAG AA contrast on white. Buttons have a visible `:focus-visible` ring (`accentSoft`).
- Never rely on colour alone; pair it with shape, position or a word.

---

## 9. Adding a new illustration

1. Storyboard the metaphor, mock it up, and get sign-off first.
2. In the chapter `.qmd`, add a mount: `<div id="my-fig" class="epr-mount"></div>`, inside `::: {.column-page}` if it should be wide.
3. Write `js/my-fig.js` as an IIFE: read colours with `EPR.colors()`, build SVG with the same helpers used in `cusum.js`, call `EPR.injectStyles()` for the shared component CSS.
4. Load the scripts at the end of the `.qmd`: `epr-viz.js` first, then your file.
5. `js/` is already a Quarto resource in `_quarto.yml`, so files are copied to the build.

### Editor gotcha (important)

A formatter / watcher on the author's machine reformats `.js` files on save and
has **truncated** them mid-write when edited through the normal file tools. Write
JS files in full with a shell heredoc (`cat > js/file.js <<'EOF' ... EOF`), then
run `node --check js/file.js` in the same step. Verify rendering before moving on
(headless jsdom + a rasteriser, or the live Quarto preview).
