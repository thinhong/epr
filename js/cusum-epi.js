(function () {
  "use strict";

  function init() {
    if (!window.EPR) return;
    EPR.injectStyles();
    var mount = document.getElementById("cusum-epi");
    if (!mount || mount.getAttribute("data-built") === "1") return;
    mount.setAttribute("data-built", "1");
    build(mount);
  }

  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  // surveillance::algo.cusum defaults
  var K = 1.04, H = 2.26;
  var COUNTS = [9, 8, 11, 7, 9, 10, 5, 9, 11, 5, 9, 7, 10, 6, 12, 9, 9, 11, 7, 8, 10, 12, 8, 14, 16, 12, 14, 10, 8, 5, 10, 5, 6, 4, 5, 6, 7, 5, 7, 8];
  var N = COUNTS.length, B = 13;
  var ML = 56, MR = 22, CW = 760, STEP = (CW - ML - MR) / (N - 1);
  var MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
  function xMap(i) { return ML + i * STEP; }

  function build(mount) {
    var C = EPR.colors();
    var m = 0, i; for (i = 0; i < B; i++) m += COUNTS[i]; m = Math.round(m / B); var sm = Math.sqrt(m);
    var z = [], S = [], U = [], prev = 0, alarm = -1;
    for (i = 0; i < N; i++) { z.push(null); S.push(null); U.push(null); }
    for (i = B; i < N; i++) {
      z[i] = (COUNTS[i] - m) / sm;
      U[i] = Math.max(0, Math.ceil(m + sm * (H + K - prev)));
      var s = Math.max(0, prev + (z[i] - K));
      S[i] = s; if (alarm < 0 && s >= H) alarm = i; prev = s;
    }

    mount.innerHTML =
      '<div class="epr-fig" style="position:relative">' +
        '<svg class="epr-chart" id="ce-chart" viewBox="0 0 760 336" style="touch-action:none;cursor:crosshair" role="img" aria-label="Weekly cases with the CUSUM case threshold on top and the standardized CUSUM below; hover to compute each week"></svg>' +
      '</div>';
    var $ = function (id) { return mount.querySelector(id); };
    var chart = $("#ce-chart");

    var TITLE = C.heading;
    var A0 = 46, A1 = 178, B0 = 258, B1 = 316;   // cases plot / cusum plot; card lives in the gap 178..258
    var maxA = Math.max(Math.max.apply(null, COUNTS), Math.max.apply(null, U.slice(B))) + 2;
    var maxS = 0; for (i = B; i < N; i++) if (S[i] > maxS) maxS = S[i];
    var maxB = Math.max(H * 1.5, maxS * 1.18), bw = Math.min(16, STEP * 0.7);
    function y1(v) { return A1 - v / maxA * (A1 - A0); }
    function y2(v) { return B1 - Math.min(v, maxB) / maxB * (B1 - B0); }

    function drawChart(hi) {
      clear(chart);
      var g = svg("g", {}, chart), j;
      var refR = xMap(B - 1) + STEP / 2;
      svg("rect", { x: ML - bw / 2 - 2, y: A0 - 6, width: refR - (ML - bw / 2 - 2), height: A1 - (A0 - 6), fill: C.ink, opacity: 0.04 }, g);
      svg("text", { x: (ML - bw / 2 + refR) / 2, y: A0 - 8, "font-size": 13, fill: C.muted, "text-anchor": "middle" }, g).textContent = "reference weeks";
      svg("text", { x: ML, y: 24, "font-size": 16, "font-weight": 600, fill: TITLE }, g).textContent = "Weekly cases";
      svg("text", { x: ML, y: 248, "font-size": 16, "font-weight": 600, fill: TITLE }, g).textContent = "CUSUM";
      svg("line", { x1: ML, y1: A1, x2: CW - MR, y2: A1, stroke: C.muted, "stroke-width": 1 }, g);
      svg("line", { x1: ML, y1: B1, x2: CW - MR, y2: B1, stroke: C.muted, "stroke-width": 1 }, g);
      [5, 10, 15].forEach(function (t) { if (t < maxA) svg("text", { x: ML - 8, y: y1(t) + 5, "font-size": 13, fill: C.muted, "text-anchor": "end" }, g).textContent = t; });
      svg("line", { x1: ML, y1: y1(m), x2: CW - MR, y2: y1(m), stroke: C.expected, "stroke-width": 1.4, "stroke-dasharray": "4 5" }, g);
      svg("text", { x: CW - MR, y: y1(m) - 6, "font-size": 14, fill: C.expectedInk, "text-anchor": "end" }, g).textContent = "expected m = " + m;
      for (i = 0; i < N; i++) {
        var ref = i < B, over = !ref && COUNTS[i] >= U[i];
        var col = ref ? C.inactive : (over ? C.alarmStrong : C.accent);
        svg("rect", { x: xMap(i) - bw / 2, y: y1(COUNTS[i]), width: bw, height: A1 - y1(COUNTS[i]), rx: 2.5, fill: col, opacity: i === hi ? 1 : (ref ? 0.5 : 0.68) }, g);
      }
      var du = "";
      for (i = B; i < N; i++) { var xa = xMap(i) - STEP / 2, xb = xMap(i) + STEP / 2, yu = y1(U[i]).toFixed(1); du += (i === B ? "M" : "L") + xa.toFixed(1) + " " + yu + " L" + xb.toFixed(1) + " " + yu + " "; }
      svg("path", { d: du, fill: "none", stroke: C.alarmStrong, "stroke-width": 1.8, "stroke-dasharray": "5 3" }, g);
      svg("text", { x: xMap(B) - STEP / 2, y: y1(U[B]) - 7, "font-size": 14, "font-weight": 600, fill: C.alarmStrongInk }, g).textContent = "threshold Uₜ (cases)";
      svg("line", { x1: ML, y1: y2(H), x2: CW - MR, y2: y2(H), stroke: C.alarmStrong, "stroke-width": 2, "stroke-dasharray": "6 4" }, g);
      svg("text", { x: CW - MR, y: y2(H) - 7, "font-size": 14, "font-weight": 600, fill: C.alarmStrongInk, "text-anchor": "end" }, g).textContent = "h = 2.26";
      svg("text", { x: ML - 8, y: y2(0) + 5, "font-size": 13, fill: C.muted, "text-anchor": "end" }, g).textContent = "0";
      var dl = "", da = "M" + xMap(B).toFixed(1) + " " + y2(0).toFixed(1) + " ";
      for (i = B; i < N; i++) { var p = xMap(i).toFixed(1) + " " + y2(S[i]).toFixed(1); dl += (i === B ? "M" : "L") + p + " "; da += "L" + p + " "; }
      da += "L" + xMap(N - 1).toFixed(1) + " " + y2(0).toFixed(1) + " Z";
      svg("path", { d: da, fill: C.accent, opacity: 0.1 }, g);
      svg("path", { d: dl, fill: "none", stroke: C.accent, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
      for (i = B; i < N; i++) svg("circle", { cx: xMap(i), cy: y2(S[i]), r: i === hi ? 5 : 2.6, fill: S[i] >= H ? C.alarmStrong : C.accent, stroke: "#fff", "stroke-width": i === hi ? 1.4 : 0 }, g);
      if (alarm >= 0) {
        svg("circle", { cx: xMap(alarm), cy: y2(S[alarm]), r: 4.4, fill: C.alarmStrong }, g);
        svg("text", { x: xMap(alarm), y: y2(S[alarm]) - 11, "font-size": 13, "font-weight": 600, fill: C.alarmStrongInk, "text-anchor": "middle" }, g).textContent = "signal";
      }
      for (j = 0; j < N; j += 5) svg("text", { x: xMap(j), y: 332, "font-size": 13, fill: C.muted, "text-anchor": "middle" }, g).textContent = (j + 1);
      if (hi >= 0 && hi % 5 !== 0) svg("text", { x: xMap(hi), y: 332, "font-size": 13, "font-weight": 700, fill: C.accent, "text-anchor": "middle" }, g).textContent = (hi + 1);
      if (hi >= 0) {
        svg("line", { x1: xMap(hi), y1: A0 - 8, x2: xMap(hi), y2: A1, stroke: C.accent, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.6 }, g);
        svg("line", { x1: xMap(hi), y1: B0, x2: xMap(hi), y2: B1, stroke: C.accent, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.6 }, g);
        if (hi >= B) { svg("circle", { cx: xMap(hi), cy: y1(U[hi]), r: 6.5, fill: C.alarmStrong, opacity: 0.16 }, g); svg("circle", { cx: xMap(hi), cy: y1(U[hi]), r: 3.3, fill: C.alarmStrong, stroke: "#fff", "stroke-width": 1 }, g); }
      }
      drawCard(g, hi);
    }

    function drawCard(g, hi) {
      var cw = 394, ch = 64, cx0 = CW - MR - cw, cy0 = 186, px = cx0 + 15, yy = cy0 + 21;
      svg("rect", { x: cx0, y: cy0, width: cw, height: ch, rx: 11, fill: "#ffffff", stroke: C.grid }, g);
      function T(row, str, size, col, mono, bold) { var a = { x: px, y: yy + row * 19, "font-size": size, fill: col }; if (mono) a["font-family"] = MONO; if (bold) a["font-weight"] = bold; svg("text", a, g).textContent = str; }
      if (hi < 0) {
        T(0, "CUSUM at each week", 13, C.muted, 0, 0);
        T(1, "S = max(0, S(t-1) + (z − 1.04))", 14, C.ink, 1, 0);
        T(2, "U = ⌈m + √m(h + k − S(t-1))⌉", 14, C.ink, 1, 0);
      } else if (hi < B) {
        T(0, "Week " + (hi + 1) + "  ·  " + COUNTS[hi] + " cases", 13, C.muted, 0, 0);
        T(1, "reference week", 14, C.ink, 1, 0);
        T(2, "used to set   m = " + m, 14, C.expectedInk, 1, 700);
      } else {
        var prevS = hi > B ? S[hi - 1] : 0, sig = COUNTS[hi] >= U[hi], vcol = sig ? C.alarmStrongInk : C.accent;
        T(0, "Week " + (hi + 1) + "  ·  " + COUNTS[hi] + " cases  ·  z = " + z[hi].toFixed(2), 13, C.muted, 0, 0);
        T(1, "S = max(0, " + prevS.toFixed(2) + " + (" + z[hi].toFixed(2) + " − 1.04)) = " + S[hi].toFixed(2), 14, C.ink, 1, 0);
        T(2, "U = ⌈" + m + " + √" + m + "(2.26 + 1.04 − " + prevS.toFixed(2) + ")⌉ = " + U[hi] + (sig ? "   ▲" : ""), 14, vcol, 1, 700);
      }
    }

    function weekFromEvent(e) {
      var r = chart.getBoundingClientRect();
      if (!r.width) return -1;
      var vx = (e.clientX - r.left) / r.width * CW;
      return EPR.clamp(Math.round((vx - ML) / STEP), 0, N - 1);
    }
    function onHover(e) { var i = weekFromEvent(e); if (i < 0) return; drawChart(i); }
    function offHover() { drawChart(-1); }
    chart.addEventListener("pointermove", onHover);
    chart.addEventListener("pointerdown", onHover);
    chart.addEventListener("pointerleave", offHover);
    chart.addEventListener("pointerup", offHover);
    chart.addEventListener("pointercancel", offHover);

    drawChart(-1);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
