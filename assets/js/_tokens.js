// ============================================================
//  EPR widget design tokens (shared vocabulary with idm4b)
//  Mirrors assets/tokens.css. Prefer the live CSS custom
//  properties so widgets track the page theme; fall back to
//  these literals if the stylesheet is not ready.
//  Each surveillance role has [line, ink]: line = vivid
//  (strokes/fills), ink = AA-safe on white (text/labels).
//
//  NOTE: the book's live figures (js/cusum.js, js/cusum-epi.js)
//  read the tokens through the global `EPR` object in
//  js/epr-viz.js. This module is the ES-module mirror kept for
//  parity with idm4b and for any future module-based figure.
// ============================================================

export function cssVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  } catch (e) {
    return fallback;
  }
}

// Harbor core (mirrors idm4b).
export const CORE = {
  oxBlue: "#002147", oxBlue2: "#0a3161", cobalt: "#1B4DC7", cobalt2: "#143aa6",
  ink: "#14263b", ink2: "#42566b", ink3: "#647587",
  surface: "#f1f6fd", surface2: "#e6f0fb",
  border: "#e3edf9", borderStrong: "#cfe0f2", white: "#ffffff",
};

// EPR surveillance roles: [line, ink].
export const ROLES = {
  expected:    ["#0E9AAB", "#0A6E7D"], // in-control baseline (teal)
  accent:      ["#1B4DC7", "#1B4DC7"], // live statistic / primary (cobalt)
  alarm:       ["#E0960A", "#9A5B00"], // soft limit / over target (amber)
  alarmStrong: ["#E0574E", "#C1343F"], // hard stop H / alarm (red)
  inactive:    ["#aab8cc", "#647587"], // pre-monitoring / reference bars
};

// Convenience: role -> vivid line colour and readable ink colour.
export const LINE = {
  expected: ROLES.expected[0], accent: ROLES.accent[0], alarm: ROLES.alarm[0],
  alarmStrong: ROLES.alarmStrong[0], inactive: ROLES.inactive[0],
};
export const INK = {
  expected: ROLES.expected[1], accent: ROLES.accent[1], alarm: ROLES.alarm[1],
  alarmStrong: ROLES.alarmStrong[1], inactive: ROLES.inactive[1],
};

// Illustration tokens (vaccine vial + conveyor) - neutral machine greys.
export const ILLUS = {
  glass: "#eef3f8", glassStroke: "#9aa7b5",
  cap: "#8b95a1", capHi: "#b9c1ca", capEdge: "#6f7882", crimp: "#7e8893",
  belt: "#8b98a8", roller: "#b6c0cc",
};

export const MOTION = {
  fast: 180, base: 240, slow: 340,
  ease: "cubic-bezier(.22,.61,.36,1)",
};

export const FONT = {
  sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  serif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
};

// ---- Widget type scale (px) ----
// Use these for ALL widget text so sizes stay consistent across figures.
// Draw SVG widgets at their real container width (1 viewBox unit == 1 CSS
// pixel) so these are the true on-screen sizes. Floor is 12px so text
// stays legible on phones.
export const TYPE = {
  axis:    12, // axis ticks (smallest)
  caption: 13, // captions, secondary labels
  label:   14, // axis titles, series labels
  body:    15, // readouts, body copy
  title:   16, // panel headers
  value:   20, // emphasized numbers
  display: 26, // hero numbers
};

// Responsive font-size for HTML widget text (CSS string). Never below the
// floor, grows gently with viewport, caps at px. e.g. el.style.fontSize = fs(15).
export function fs(px, floor) {
  const lo = floor || Math.max(12, Math.round(px * 0.86));
  return `clamp(${lo}px, calc(${px - 2}px + 0.3vw), ${px}px)`;
}

// True when the reader asked the OS to reduce motion. Guard any
// auto-playing animation with this so it can be skipped or shortened.
export function reduceMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}
