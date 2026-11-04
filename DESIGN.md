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
- `js/viz-kit.js` -> the shared figure scaffolding every chapter loads after D3: the card with its title and status pill, axes, reference lines and buttons
- `js/epr-viz.js` -> legacy. The first CUSUM figures were built on it; no chapter loads it now

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
separate enlarged "hero" vial. Code: `drawVial` in `js/cusum.js`, styles under
"CUSUM chapter figures" in `assets/theme.scss`.

### Anatomy

1. **Grey aluminium cap** (`cap`) with a thin lighter highlight strip (`capHi`). The cap goes on only when the vial is full, so the filler nozzle pours into an open neck.
2. **Short neck** (`glass`), narrower than the body.
3. **Squat glass body** (`glass`, outline `glassStroke`), about 1.4 times taller than wide, with softly rounded corners. Keep it squat; a tall narrow body reads as a test tube.
4. **One gloss highlight:** a single thin white streak on the left of the body. This is what makes flat glass read as glass; do not use gradients or multiple streaks.
5. **Teal liquid** (`expected`) at about 38% opacity, up to the fill line for a vial on target.
6. **Amber top** (`alarm`) only when the vial went over the line, drawn as a band above the liquid.

No label or barcode: at belt size that detail is noise. Keep the vial clean.

### The chosen vial

The vial being read gets a cobalt **ring** and a faint cobalt **column** that runs
down through its bar and its CUSUM point, so one glance links all three rows. By
default this is the newest vial; hovering or tapping another moves it. Everything
earlier stays on the belt in order, so the learner sees the whole run.

### Sizing and honest scale

Each vial sits in its own slot of the shared vial axis, directly above its bar and
its CUSUM point, and its width comes from the slot (about half of it on a desktop,
a little more on a phone). Inside a vial the fill uses one ruler: the space above
the fill line holds +0.5 mL, so every fill the game can make (2.70 to 3.48 mL) is
drawn to scale, under-filled vials below the line, over-filled ones in amber above
it. The exact running total lives in the CUSUM row, not in the vial.

### Do / don't

- Do keep the body squat and the cap grey. Don't make it tall, and don't use a black or coloured cap.
- Do show teal fill, amber only when over. Don't add labels, barcodes, or a second gloss streak.
- Do ring one vial at a time. Don't highlight more than one.

---

## 5. The CUSUM figures

Both figures in `cusum.qmd` follow the Farrington pattern (section 10): a
`.viz-card` made by `VIZ.card` with a title and a status pill, a monospace
**readout box above the plot**, an SVG laid out in pixels from the card width
(so a 13px label stays 13px on a phone), and a foot with a hint and any buttons.
Each sits in a Quarto figure (`::: {#fig-cusum-line}`, `::: {#fig-cusum-threshold}`)
with a caption, and the text points to it with `@fig-...`. Shared code is in
`js/cusum-core.js`; styles are the `.cusum-*` rules in `assets/theme.scss`.

### Figure 1: the vaccine line (`js/cusum.js`)

Three rows on one vial axis, so every vial lines up above its bar and its point:

1. **Belt.** It starts with 3 vials. Each click on **Fill next vial** brings the next one: a nozzle pours, the liquid rises, then the cap goes on. **New batch** starts again with a fresh hidden drift.
2. **Fill volume (mL).** Each vial's fill as a bar from the 3.0 target (amber over, teal under), on a fixed axis of 2.68 to 3.52 mL. A dotted amber line marks **3.05 = 3.0 + K**, the value the CUSUM actually subtracts, so a learner can see why a vial a little over target still pulls the sum down.
3. **CUSUM (mL).** The statistic with the dashed `H = 0.5` line. The bar grows and the CUSUM segment draws while the vial fills, so the three rows move together.

The rule is the exact one-sided CUSUM, kept in hundredths of a mL so every sum
in the readout adds up: `S_t = max(0, S_(t-1) + (x_t - 3.05))`, signal when
`S_t >= 0.5` (target 3.0, sd 0.1, K = 0.05 = 0.5 sd, H = 0.5 = 5 sd). The chapter
uses `>=` for both figures. From the 4th, 5th or 6th vial the filler overfills
by 0.18 mL; fills are normal with the noise cut at 3 sd. Over many batches the
signal comes at about vial 8 (6 to 10 for most batches), about 3 vials after the
drift starts, and about 1 batch in 50 has no signal within 12 vials.

At the signal the line stops: a red **STOP** stamp lands on the vial, the point
turns red with the word "signal", the pill reads **Line stopped**, and **New
batch** becomes the primary button. Then the figure reveals where the overfill
began, with a dashed amber line through rows 2 and 3 and a hint such as "Signal
at vial 8. The overfill began at vial 5." That gap is the detection delay, the
idea the game is there to teach.

The readout shows, for the chosen vial, the rule, the numbers put in, and the
result: `S5 = max(0, S4 + (x5 - 3.05))`, `= max(0, 0.15 + (3.16 - 3.05))`,
`= max(0, 0.26) = 0.26 < H`.

### Figure 2: the epidemic threshold (`js/cusum-epi.js`)

`surveillance::algo.cusum` exactly, with its defaults (k = 1.04, h = 2.26,
`trans = "standard"`, no reset), checked against the package source. Two panels
on one week axis: weekly cases with the expected count `m` (teal dashed) and the
case threshold `U_t` (red dashed step), and the standardised CUSUM `S_t` with
its `h` line. Weeks 1 to 13 are the reference weeks: teal bars on a shaded band,
because they are the baseline whose mean is `m` (the same teal as the `m` line).
Monitored weeks are cobalt, and weeks that signal are red.

The package does not round `m`, so the reference weeks are chosen to average
exactly 8 (104/13). The counts are also chosen so that every sum in the readout
adds up at two decimals. If you change the data, rerun that check.

At rest the readout works through the first signal week; hovering or tapping
another week shows its `z`, `S`, `U` and verdict, with `h + k` kept as
`2.26 + 1.04` and the value inside the ceiling shown before rounding up.

### Interaction (both figures)

- A mouse hovers. A finger taps, or drags sideways to scrub; the SVG has `touch-action: pan-y`, so dragging up or down still scrolls the page. A tap elsewhere goes back to the default.
- The SVG is a keyboard slider (`role="slider"`): Left and Right step, Home and End jump, Escape resets.
- The readout box gets the height of its tallest state at the current width (`CUSUM.fitBox`), so nothing below it jumps while the reader explores.
- Under `prefers-reduced-motion` the fill is instant.

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
- **Tap targets** are at least 44px tall on touch screens (`pointer: coarse`).
- **Animate with** `EPR.tween` (requestAnimationFrame, cubic ease). Keep transitions short (about 240ms) so the line never feels laggy.
- **Respect `prefers-reduced-motion`.** `EPR.tween`, the alarm pulse and the leak drip already fall back to an instant state; anything new must do the same.
- **Immediate feedback:** on the same click, fill the vial, grow its bar and step the CUSUM.

---

## 8. Accessibility

- Each figure `<svg>` has `role="img"` and a plain-language `aria-label` (or `<title>` + `<desc>`) describing what it shows.
- Text and meaningful marks meet WCAG AA contrast on white. This is why text uses the **ink** tone, not the line tone. Buttons have a visible `:focus-visible` ring (`accentSoft`).
- Never rely on colour alone; pair it with shape, position or a word.

---

## 9. Adding a new illustration

1. Storyboard the metaphor, mock it up, and get sign-off first.
2. In the chapter `.qmd`, put a mount inside a Quarto figure with a caption: `::: {#fig-my-fig}`, then a raw HTML block with `<div id="viz-my-fig"></div>`, then the caption, then `:::`.
3. Write `js/my-fig.js` as an IIFE: build the card with `VIZ.card`, lay the SVG out in pixels from the card width and redraw on resize, and put the styles in `assets/theme.scss` under a chapter section (marks in a role's line tone, text in its ink tone).
4. Load the scripts at the end of the `.qmd`: D3, then `js/viz-kit.js`, then your files.
5. `js/` and `assets/` are already Quarto resources in `_quarto.yml`, so files are copied to the build.

### Editor gotcha (important)

A formatter / watcher on the author's machine reformats `.js` files on save and
has **truncated** them mid-write when edited through the normal file tools. Write
JS files in full with a shell heredoc (`cat > js/file.js <<'EOF' ... EOF`), then
run `node --check js/file.js` in the same step. Verify rendering before moving on
(headless chromium + a screenshot, or the live Quarto preview).

---

## 10. Farrington figures: pixel layout and drag

The three figures in `farrington.qmd` share their data (`js/farrington-data.js`),
the method (`js/farrington-core.js`, a port of `surveillance::algo.farrington`,
checked against the R source) and one drawing component (`js/farrington-plot.js`).
Styles live in `assets/theme.scss` under "Farrington chapter figures" (`.farr-*`).

- **Pixel layout, not a fixed viewBox.** Each SVG is drawn at the card's real width and redrawn when the width changes (ResizeObserver). A 13px label stays 13px on a phone instead of shrinking with the viewBox. Prefer this for any new figure with small labels.
- **Roles.** Baseline weeks are teal. The fitted line is cobalt: solid over the data, dashed where it is carried forward to this week. The threshold U is a red dashed mark. Downweighted weeks and a rejected trend are amber. Reference values (no outbreak, no downweighting) are grey and dashed.
- **Readout box above the plot** (`.farr-model`), never on it. It shows the fitted equation at rest, and the hovered or tapped week's numbers on demand. A mouse clears it on leaving the plot; a tap elsewhere clears it on touch.
- **Drag handles.** One handle per year, beside its cluster, with `role="slider"`, arrow-key steps and Pointer Events with pointer capture. Only the handle has `touch-action: none`, so the page still scrolls when a finger lands anywhere else. Redraws are throttled with `requestAnimationFrame`.
- **Tap targets.** On touch screens (`pointer: coarse`) the steppers, tabs and Reset button are at least 44px tall.

---

## 11. MEM figures

The Moving Epidemic Method chapter (`mem.qmd`) has six figures, one per step of
Vega et al. (2013), built from real ERVISS data for Croatia.

- **Files.** `js/mem-data.js` (the ERVISS series and the four seasons),
  `js/mem-core.js` (the method itself, no drawing; it also runs in Node),
  `js/mem-shared.js` (the model, the card, steppers and sliders),
  `js/mem-explore.js` (formula strips with live symbols), `js/mem-stage.js`
  (season cells, pooled bars and the histogram on its side), then one file per
  figure: `mem-series`, `mem-map`, `mem-opt`, `mem-threshold`, `mem-intensity`,
  `mem-monitor`.
- **Styles** are in `assets/theme.scss` under "MEM chapter figures". Every
  selector starts with `.mem-fig` (the mount, which is also its `.viz-card`) or
  `.mem-bell`, and the short colour names there map onto the `--epr-*` tokens.
  Write every declaration as `property: value`, with a space after the colon:
  Quarto's SCSS analyser reads `opacity:1` as a selector with a pseudo-class,
  and the render then warns that it could not export the colour variables.
- **Roles.** Pre-epidemic weeks and the expected level are teal. Epidemic weeks
  and the live statistic are cobalt. The epidemic threshold is a red dashed
  line. The intensity thresholds are amber (dotted, dashed and solid for I50,
  I90 and I95). An illustrative week, which is not data, is an outlined bar
  with a labelled band under the axis.
- **Formula strips.** Every symbol marked `\class{t-KEY}{...}` in the TeX is
  live: point at it or tap it to light up its marks, and the line under the
  strip explains it. This works with MathJax CHTML (the book) and SVG.
- **Show how.** Figures 4 and 5 play their steps in order: zoom in, rank, fly
  to the pool, slide into the histogram, add the curve, draw the thresholds.
  Pressing the button again skips to the end. In Figure 6, Play goes on from
  the week shown. With reduced motion, every move is instant.
- **Numbers** (thresholds, alert weeks, levels) were checked against R, with
  the logic of the `mem` package and `sm` for the smoothing. Check them again
  if the data change.
