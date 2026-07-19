# EPR design guide

The house style for the **Epidemic Preparedness and Response** book and every
interactive illustration in it. Read this before adding or changing any figure
so the whole book stays visually consistent.

The book shares its design system, **"Harbor"**, with the companion book
*Infectious disease modelling for babies* (idm4b): Oxford blue and cobalt on
white, Source Serif 4 headings over an Inter body, and every semantic colour
split into a vivid *line* tone (for strokes and fills) and a darker *ink* tone
(for text). Keeping the two books on one system means a value learned in one
place holds in the other.

The single source of truth for values is code, not this file:

- `_quarto.yml` -> theme is `[cosmo, assets/theme.scss]`, with fonts from `assets/head-fonts.html` and runtime tokens from `assets/tokens.css`
- `assets/theme.scss` -> Bootstrap/Quarto SCSS: the Harbor design tokens, type, and page component rules
- `assets/tokens.css` -> CSS custom properties read by the figures at run time: the Harbor core (`--ox-blue`, `--cobalt`, ...) plus the EPR semantic and illustration tokens (`--epr-*`)
- `assets/js/_tokens.js` -> the same tokens as an ES module, kept for parity with idm4b
- `js/epr-viz.js` -> the `--epr-*` tokens as a JS fallback (`EPR.colors()`), plus shared math, tweening and the injected component CSS

This document explains *what the values mean and how to use them*. If a value
here ever disagrees with the code, the code wins; fix this file.

---

## 1. Principles

1. **Clinical calm.** White canvas, soft slate ink, cool accents (Oxford blue, cobalt). No gradients, no drop shadows beyond a faint contact shadow, no clutter. Flat, modern, quiet.
2. **The metaphor is the lesson.** An "illustration" here is a playable cartoon or game that builds intuition (the bottle filling line for CUSUM), not an abstract chart in nice colours.
3. **One honest scale.** When a picture encodes a quantity, the measuring element uses one pixels-per-unit ruler. Never fudge it to make a value readable.
4. **Simple over detailed.** Prefer a clean silhouette to fussy realism. Add detail only where it teaches something; drop it everywhere else.
5. **Mobile first, gesture friendly.** Big type, big tap targets, smooth on a phone. Time always flows left to right.
6. **Design before code.** Agree a storyboard and a static mockup before building. Prefer a single screen where everything is visible and live over a Next/Back wizard.
7. **Never use the em dash.** Use a comma, a colon, or "->".

---

## 2. Colour

Harbor. Colour-blind safe: meaning is carried by blue vs amber/teal (not red/green), plus position and shape. Red and amber are always backed by a second cue (a lit lamp, a dashed line, the word "OVERFLOW").

**Two tones per role.** Every semantic colour has a *line* tone and an *ink*
tone. Use the line tone for strokes, fills and markers; use the ink tone for any
**text**, so small labels stay WCAG AA on white. In the figure scripts these are
`EPR.color("expected")` (line) and `EPR.color("expectedInk")` (text).

### Core tokens

| Token | Hex | Role |
|---|---|---|
| `ink` | `#14263b` | Foreground text, chart labels |
| `heading` | `#002147` | Headings, in-figure panel titles (Oxford blue) |
| `muted` | `#647587` | Secondary labels, axes, ticks, rim |
| `grid` | `#e3edf9` | Hairlines, card borders, faint fills |
| `surface` | `#ffffff` | Page and card background |
| `surfaceAlt` | `#f1f6fd` | Inset panels, chips, code blocks |

### Semantic roles (line / ink)

| Role | line | ink | Where |
|---|---|---|---|
| `expected` (teal) | `#0E9AAB` | `#0A6E7D` | In-control baseline, in-spec liquid, target line and its label |
| `accent` (cobalt) | `#1B4DC7` | `#1B4DC7` | The live statistic, primary buttons, the current vial ring |
| `alarm` (amber) | `#E0960A` | `#9A5B00` | Overfill above the line (wasted dose), over-target bars |
| `alarmStrong` (red) | `#E0574E` | `#C1343F` | Threshold H, overflow liquid, STOP stamp, lit alarm |
| `inactive` | `#aab8cc` | `#647587` | Pre-monitoring / reference bars |

Cobalt is dark enough to be AA as text, so `accent` uses one value for both line
and ink. `accentSoft` = `rgba(27,77,199,.13)` for the area under the live
statistic and the focus ring; `band` = `rgba(14,154,171,.14)` for the expected
range.

### Illustration tokens (vial + conveyor)

Neutral machine greys, unchanged by Harbor (idm4b has no such parts).

| Token | Hex | Use |
|---|---|---|
| `glass` | `#eef3f8` | Glass body and neck fill |
| `glassStroke` | `#9aa7b5` | Glass outline |
| `cap` | `#8b95a1` | Aluminium cap base |
| `capHi` | `#b9c1ca` | Cap highlight |
| `belt` | `#8b98a8` | Conveyor belt |
| `roller` | `#b6c0cc` | Belt rollers |
| `capEdge` `crimp` | `#6f7882` `#7e8893` | Optional cap detail, for larger vials only |

Read tokens at run time with `EPR.color("expected")` or `EPR.colors()`; never
hard-code a hex in a chapter script except pure white highlights (`#ffffff`).

---

## 3. Typography

- **Body:** Inter (Google), weights 400/500/600/700.
- **Headings:** Source Serif 4 (Google), weights 600/700, in Oxford blue. This is the one place the book reads as "serif".
- **Monospace:** JetBrains Mono, for code blocks, inline code and figure formulas.
- **Base:** root 15px, line-height 1.62.
- **In SVG figures:** figure text stays sans (Inter), even though page headings are serif. Keep a clear hierarchy in the 760-wide viewBox: panel titles about 16px in `heading`, axis and tick numbers about 13 to 14px in `muted`, threshold labels about 14px in the role's **ink** tone. Nothing the learner must read should be smaller than 12px. Use `font-variant-numeric: tabular-nums` for changing numbers.

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

Each vial appears in order left to right, sized to the shared axis spacing so it
sits directly above its own volume bar and CUSUM point (not oversized). Inside a
vial, fill is shown honestly at 80 px per mL around the 3.0 line: under-target
vials show teal liquid below the line, over-target vials show a small amber band
above it. The exact running total lives in the CUSUM chart, not in the vial.

### Do / don't

- Do keep the body squat and the cap grey. Don't make it tall, and don't use a black or coloured cap.
- Do show teal fill, amber only when over. Don't add labels, barcodes, or a second gloss streak.
- Do ring the current vial and float its weight bubble. Don't highlight more than one vial.

---

## 5. The CUSUM figure: three aligned rows

Three rows stacked on ONE shared vial-number x-axis (`CML=54`, `CMR=22`,
`CW=760`, `xMap(i)`), so every vial lines up above its bar and its CUSUM point:

1. **Belt** (row 1): a small game (see Game feel below). It starts with 3 vials and each click fills the next one.
2. **Volume bars** (row 2): each vial's fill drawn from the 3.0 target line on a zoomed axis (about 2.72 to 3.5 mL) so the drift is visible; amber over target, teal under.
3. **CUSUM** (row 3): the exact statistic with a dashed H line, a signal dot when it crosses, and small vial-number ticks.

**Game feel.** The belt is styled as a live vaccine line: a conveyor with end
drums and motion chevrons, glossy vials with a soft contact shadow, and a status
pill (Running / Line stopped / Batch done) at the top right. It starts with 3
vials. Clicking **Fill next vial** brings out the next vial and a filler nozzle
dispenses into it, the liquid rising with `EPR.tween`. When the CUSUM crosses H a
red **STOP** stamp drops onto the offending vial, its ring turns red, and the pill
reads Line stopped. **New batch** reshuffles a fresh hidden drift. Both widgets
run at page width (no `.column-page`). Under `prefers-reduced-motion` the fill is
instant.

**Hover to compute.** Pointer over (or drag across, on touch) the CUSUM plot
draws a guide line and highlights that point. The working shows in a **fixed card
pinned in the panel's clear top area** (not a cursor-following tooltip, which
covered the curve). The card shows the general formula at rest, and on hover the
numbers substituted and the value, e.g. `S = max(0, 0.15 + (3.16 - 3.05))` then
`= 0.26`, turning red with a marker when it passes H. Give the plot enough top
headroom that the card never overlaps a bar or the line. The epidemic widget uses
the same pattern for its z / S / U card, placed in a reserved band between
its two panels so it never sits on the plot. Use Pointer Events with
`touch-action: none` for desktop and mobile. Keep on-plot labels minimal.

**Exact CUSUM.** `S_t = max(0, S_{t-1} + (x_t - 3.0 - 0.05))`, signal when
`S_t > 0.5` (allowance K = 0.05 = 0.5 sigma, interval H = 0.5 = 5 sigma; target
3.0, sigma 0.1). Parameters are tuned (drift +0.18 mL starting at vial 4-6, a
12-vial axis) so the alarm lands after about 8 vials; the learner sets the pace
by clicking.

**No tank.** Removed; the CUSUM chart is the accumulator.

**Second widget (epidemic threshold).** `#cusum-epi` (js/cusum-epi.js) shares the
same look and the same hover card. It has two stacked panels on a shared
week axis: weekly case bars with the expected level m and the case threshold Ut
drawn as a dashed step line, and the standardized CUSUM St below with its h line.
The demo data is a realistic epidemic wave (a noisy baseline plus a skewed,
Poisson-like outbreak) so the CUSUM makes a readable bump that crosses h and comes back. Hovering a week shows how that week is computed,
including the case threshold Ut = ceil(m + sqrt(m)(h + k - S at t-1)). The tooltip
and `.epr-chart` styles are a shared component: whichever widget loads first
injects them (ids `epr-cusum-styles` / `epr-epi-styles`).

## 6. Shared chart grammar

Every quantitative chart in the book uses the same conventions:

- Time / sequence on the x axis, left to right.
- The expected level is teal; a muted teal band shows the expected range.
- The live statistic is the cobalt line with a soft cobalt area fill under it.
- The threshold is a dashed line (amber for a soft limit, red for a hard stop H).
- An alarm is a red dot or a short pulse, never colour alone.
- Strokes and fills use a role's line tone; any text uses its ink tone.

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
- Text and meaningful marks meet WCAG AA contrast on white. This is why text uses the **ink** tone, not the line tone. Buttons have a visible `:focus-visible` ring (`accentSoft`).
- Never rely on colour alone; pair it with shape, position or a word.

---

## 9. Adding a new illustration

1. Storyboard the metaphor, mock it up, and get sign-off first.
2. In the chapter `.qmd`, add a mount: `<div id="my-fig" class="epr-mount"></div>`, inside `::: {.column-page}` if it should be wide.
3. Write `js/my-fig.js` as an IIFE: read colours with `EPR.colors()` (line tones for marks, the `*Ink` tones for text), build SVG with the same helpers used in `cusum.js`, call `EPR.injectStyles()` for the shared component CSS.
4. Load the scripts at the end of the `.qmd`: `epr-viz.js` first, then your file.
5. `js/` and `assets/` are already Quarto resources in `_quarto.yml`, so files are copied to the build.

### Editor gotcha (important)

A formatter / watcher on the author's machine reformats `.js` files on save and
has **truncated** them mid-write when edited through the normal file tools. Write
JS files in full with a shell heredoc (`cat > js/file.js <<'EOF' ... EOF`), then
run `node --check js/file.js` in the same step. Verify rendering before moving on
(headless chromium + a screenshot, or the live Quarto preview).
