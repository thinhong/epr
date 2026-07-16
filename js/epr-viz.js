(function (global) {
  "use strict";

  var EPR = {};

  var FALLBACK = {
    ink: "#1f2933",
    muted: "#64748b",
    grid: "#e7ecf1",
    surface: "#ffffff",
    surfaceAlt: "#f4f7fa",
    expected: "#0f9b8e",
    band: "rgba(15,155,142,0.14)",
    accent: "#2563eb",
    accentSoft: "rgba(37,99,235,0.13)",
    alarm: "#d97706",
    alarmStrong: "#dc2626",
    good: "#0f9b8e",
    glass: "#eef3f8",
    glassStroke: "#9aa7b5",
    cap: "#8b95a1",
    capHi: "#b9c1ca",
    capEdge: "#6f7882",
    crimp: "#7e8893",
    belt: "#8b98a8",
    roller: "#b6c0cc"
  };

  EPR.color = function (name) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue("--epr-" + name);
      if (v && v.trim()) return v.trim();
    } catch (e) {}
    return FALLBACK[name] || "#000000";
  };

  EPR.colors = function () {
    var o = {};
    for (var k in FALLBACK) { if (FALLBACK.hasOwnProperty(k)) o[k] = EPR.color(k); }
    return o;
  };

  EPR.reducedMotion = function () {
    try { return global.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  };

  EPR.round = function (n, dp) {
    var f = Math.pow(10, dp || 0);
    return Math.round(n * f) / f;
  };

  EPR.clamp = function (n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  };

  EPR.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  EPR.gauss = function (rnd) {
    var u = 0, v = 0;
    while (u === 0) u = rnd();
    while (v === 0) v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  EPR.series = function (opts) {
    var n = opts.n, mu0 = opts.mu0, sigma = opts.sigma;
    var ds = opts.driftStart, delta = opts.delta, seed = opts.seed == null ? 7 : opts.seed;
    var rnd = EPR.rng(seed), out = [];
    for (var i = 0; i < n; i++) {
      var mean = mu0 + (i >= ds ? delta : 0);
      out.push(EPR.round(mean + EPR.gauss(rnd) * sigma, 1));
    }
    return out;
  };

  EPR.cusumUpper = function (x, mu0, k) {
    var S = [], prev = 0;
    for (var i = 0; i < x.length; i++) {
      var s = Math.max(0, prev + (x[i] - mu0) - k);
      S.push(s); prev = s;
    }
    return S;
  };

  EPR.cusumLower = function (x, mu0, k) {
    var S = [], prev = 0;
    for (var i = 0; i < x.length; i++) {
      var s = Math.max(0, prev + (mu0 - x[i]) - k);
      S.push(s); prev = s;
    }
    return S;
  };

  EPR.accumNoLeak = function (x, mu0) {
    var S = [], prev = 0;
    for (var i = 0; i < x.length; i++) {
      var s = Math.max(0, prev + (x[i] - mu0));
      S.push(s); prev = s;
    }
    return S;
  };

  EPR.cusumNoFloor = function (x, mu0, k) {
    var S = [], prev = 0;
    for (var i = 0; i < x.length; i++) {
      var s = prev + (x[i] - mu0 - k);
      S.push(s); prev = s;
    }
    return S;
  };

  EPR.firstCross = function (S, h) {
    for (var i = 0; i < S.length; i++) { if (S[i] > h) return i; }
    return -1;
  };

  EPR.siegmundARL = function (delta, k, h) {
    var d = delta - k;
    var b = h + 1.166;
    if (Math.abs(d) < 1e-6) return b * b;
    return (Math.exp(-2 * d * b) + 2 * d * b - 1) / (2 * d * d);
  };

  EPR.tween = function (from, to, dur, onUpdate, onDone) {
    if (EPR.reducedMotion() || dur <= 0) {
      onUpdate(to);
      if (onDone) onDone();
      return { stop: function () {} };
    }
    var start = null, raf = null, stopped = false;
    function ease(t) { return 1 - Math.pow(1 - t, 3); }
    function frame(ts) {
      if (stopped) return;
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      onUpdate(from + (to - from) * ease(p));
      if (p < 1) { raf = global.requestAnimationFrame(frame); }
      else if (onDone) onDone();
    }
    raf = global.requestAnimationFrame(frame);
    return { stop: function () { stopped = true; if (raf) global.cancelAnimationFrame(raf); } };
  };

  EPR.injectStyles = function () {
    if (document.getElementById("epr-viz-styles")) return;
    var css =
".epr-fig{--ink:var(--epr-ink,#1f2933);--muted:var(--epr-muted,#64748b);--grid:var(--epr-grid,#e7ecf1);--surface:var(--epr-surface,#fff);--surfaceAlt:var(--epr-surfaceAlt,#f4f7fa);--expected:var(--epr-expected,#0f9b8e);--accent:var(--epr-accent,#2563eb);--alarm:var(--epr-alarm,#d97706);--alarmStrong:var(--epr-alarmStrong,#dc2626);" +
"font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);background:var(--surface);border:1px solid var(--grid);border-radius:16px;padding:18px 18px 16px;max-width:860px;margin:0 auto;line-height:1.55}" +
".epr-fig *{box-sizing:border-box}" +
".epr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px}" +
".epr-kicker{font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--accent);font-weight:600}" +
".epr-title{font-size:1.32rem;font-weight:600;margin:2px 0 0}" +
".epr-dots{display:flex;gap:7px;align-items:center;padding-top:4px}" +
".epr-dot{width:9px;height:9px;border-radius:50%;background:var(--grid);transition:background .2s,transform .2s}" +
".epr-dot.on{background:var(--accent);transform:scale(1.25)}" +
".epr-caption{font-size:1.08rem;color:var(--ink);margin:10px 0 12px;min-height:3.2em}" +
".epr-caption b{color:var(--accent);font-weight:600}" +
".epr-readouts{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}" +
".epr-chip{background:var(--surfaceAlt);border-radius:10px;padding:7px 12px;font-size:.95rem;color:var(--muted);display:flex;gap:7px;align-items:baseline}" +
".epr-chip .v{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums;font-size:1.05rem}" +
".epr-chip.warn .v{color:var(--alarm)}.epr-chip.bad .v{color:var(--alarmStrong)}.epr-chip.good .v{color:var(--expected)}" +
".epr-stage,.epr-chart{display:block;width:100%;height:auto;margin:2px 0}" +
".epr-chart.hidden,.epr-stage.hidden{display:none}" +
".epr-result{border-radius:12px;padding:11px 14px;margin:10px 0 2px;font-size:1.02rem;font-weight:500;display:none}" +
".epr-result.show{display:block}" +
".epr-result.good{background:rgba(15,155,142,.12);color:#0b6e58}" +
".epr-result.warn{background:rgba(217,119,6,.12);color:#9a5a06}" +
".epr-result.bad{background:rgba(220,38,38,.10);color:#a3271f}" +
".epr-controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}" +
".epr-spacer{flex:1 1 auto}" +
".epr-btn{appearance:none;border:1px solid var(--grid);background:var(--surface);color:var(--ink);font:inherit;font-size:1rem;font-weight:500;min-height:46px;padding:0 18px;border-radius:11px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;transition:background .15s,border-color .15s,transform .05s}" +
".epr-btn:hover{background:var(--surfaceAlt)}" +
".epr-btn:active{transform:scale(.98)}" +
".epr-btn:focus-visible{outline:3px solid var(--accentSoft,rgba(37,99,235,.3));outline-offset:2px}" +
".epr-btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}" +
".epr-btn.primary:hover{filter:brightness(1.06)}" +
".epr-btn.danger{background:var(--alarmStrong);border-color:var(--alarmStrong);color:#fff;font-weight:600;min-height:52px;padding:0 26px;font-size:1.08rem}" +
".epr-btn.danger:hover{filter:brightness(1.05)}" +
".epr-btn:disabled{opacity:.45;cursor:default}" +
".epr-scrub{flex:1 1 180px;min-width:140px;accent-color:var(--accent);height:30px}" +
".epr-sliders{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px 18px;width:100%;margin-top:4px}" +
".epr-slider{display:flex;flex-direction:column;gap:3px}" +
".epr-slider .lab{display:flex;justify-content:space-between;font-size:.95rem;color:var(--muted)}" +
".epr-slider .lab .val{color:var(--ink);font-weight:600;font-variant-numeric:tabular-nums}" +
".epr-slider input{width:100%;accent-color:var(--accent);height:28px}" +
".epr-toggle{display:flex;gap:8px;flex-wrap:wrap}" +
".epr-chiptog{border:1px solid var(--grid);background:var(--surface);color:var(--muted);border-radius:999px;padding:8px 15px;font-size:.95rem;font-weight:500;cursor:pointer;min-height:42px}" +
".epr-chiptog.on{background:var(--accentSoft,rgba(37,99,235,.13));color:var(--accent);border-color:var(--accent)}" +
".epr-formula{background:var(--surfaceAlt);border-radius:12px;padding:14px 16px;margin:8px 0 4px;font-size:1.16rem;font-family:'Iosevka',ui-monospace,'SF Mono',Menlo,Consolas,monospace;text-align:center;font-variant-numeric:tabular-nums;overflow-x:auto}" +
".epr-formula .mu{color:var(--expected);font-weight:600}.epr-formula .k{color:var(--alarm);font-weight:600}.epr-formula .s{color:var(--accent);font-weight:600}.epr-formula .h{color:var(--alarmStrong);font-weight:600}" +
".epr-legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin:6px 0 2px;font-size:.95rem;color:var(--muted)}" +
".epr-leg{display:flex;align-items:center;gap:7px}" +
".epr-sw{width:14px;height:14px;border-radius:4px;flex:none}" +
"@media (max-width:560px){.epr-fig{padding:15px 13px}.epr-title{font-size:1.18rem}.epr-caption{font-size:1.05rem}.epr-btn{flex:1 1 auto;justify-content:center}.epr-controls{gap:8px}}";
    var s = document.createElement("style");
    s.id = "epr-viz-styles";
    s.textContent = css;
    document.head.appendChild(s);
  };

  global.EPR = EPR;
})(typeof window !== "undefined" ? window : this);
