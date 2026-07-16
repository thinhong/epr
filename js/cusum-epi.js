(function () {
  "use strict";

  function init() {
    if (!window.EPR) return;
    EPR.injectStyles();
    var mount = document.getElementById("cusum-epi");
    if (!mount) return;
    if (mount.getAttribute("data-built") === "1") return;
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
  function lin(d0, d1, r0, r1) { return function (v) { return r0 + (v - d0) / (d1 - d0) * (r1 - r0); }; }

  // surveillance::algo.cusum defaults
  var K = 1.04, H = 2.26;
  // clean fixed data: reference weeks 1..B (mean exactly 8), then monitoring with an outbreak from ONSET
  var COUNTS = [8, 7, 9, 8, 6, 9, 8, 7, 10, 8, 7, 9, 8,   9, 7, 8, 6, 9, 8, 7, 8,   11, 13, 12, 15, 14, 16, 15, 17, 16, 18, 15, 17, 16, 18, 17, 15, 16, 18, 16];
  var N = COUNTS.length, B = 13, ONSET = 21;

  function build(mount) {
    var C = EPR.colors();
    var m = 0, i; for (i = 0; i < B; i++) m += COUNTS[i]; m = m / B; var sm = Math.sqrt(m);
    var z = [], S = [], U = [], prev = 0, alarm = -1;
    for (i = 0; i < N; i++) { z.push(null); S.push(null); U.push(null); }
    for (i = B; i < N; i++) {
      z[i] = (COUNTS[i] - m) / sm;
      U[i] = Math.max(0, Math.ceil(m + sm * (H + K - prev)));
      var s = Math.max(0, prev + (z[i] - K));
      S[i] = s; if (alarm < 0 && s >= H) alarm = i; prev = s;
    }
    var st = { cur: alarm >= 0 ? Math.min(N - 1, alarm + 2) : N - 1, dragging: false };

    mount.innerHTML =
      '<div class="epr-fig">' +
        '<div class="epr-head"><div><div class="epr-kicker">surveillance::algo.cusum (package defaults)</div>' +
        '<div class="epr-title">Computing an epidemic threshold with CUSUM</div></div></div>' +
        '<div id="ce-formula"></div>' +
        '<svg class="epr-chart" id="ce-chart" viewBox="0 0 760 286" role="img" aria-label="Weekly cases with the CUSUM case-count threshold, and the standardized CUSUM below; drag to scrub" style="touch-action:none;cursor:ew-resize"></svg>' +
        '<div class="epr-hint" id="ce-hint" style="min-height:3.4em"></div>' +
      '</div>';

    var $ = function (id) { return mount.querySelector(id); };
    var chart = $("#ce-chart"), hint = $("#ce-hint"), fbox = $("#ce-formula");

    function leg(color, text) { return '<span class="epr-leg"><span class="epr-sw" style="background:' + color + '"></span>' + text + '</span>'; }
    fbox.innerHTML =
      '<div class="epr-formula" style="text-align:left;font-size:1.02rem;line-height:1.7">' +
        '<b>1.</b> expected level <span class="mu">m</span> = mean of the reference weeks = <b>' + m.toFixed(0) + '</b> cases/wk &nbsp;<span style="color:var(--epr-muted,#64748b)">(default <code>m=NULL</code>)</span><br>' +
        '<b>2.</b> standardize: <span class="s">z</span><sub>t</sub> = ( x<sub>t</sub> &minus; <span class="mu">m</span> ) / &radic;<span class="mu">m</span> &nbsp;<span style="color:var(--epr-muted,#64748b)">(<code>trans="standard"</code>)</span><br>' +
        '<b>3.</b> accumulate: <span class="s">S</span><sub>t</sub> = max( 0 , <span class="s">S</span><sub>t-1</sub> + ( <span class="s">z</span><sub>t</sub> &minus; <span class="k">k</span> ) ) , alarm when <span class="s">S</span><sub>t</sub> &#8805; <span class="h">h</span> &nbsp;<span style="color:var(--epr-muted,#64748b)">(<span class="k">k=1.04</span>, <span class="h">h=2.26</span>, no reset)</span>' +
      '</div>' +
      '<div class="epr-legend">' + leg(C.expected, "expected m") + leg(C.accent, "CUSUM Sₜ") + leg(C.alarmStrong, "Uₜ = same threshold written in cases") + '</div>';

    var ML = 52, MR = 20, CW = 760, A0 = 30, A1 = 150, B0 = 182, B1 = 266;
    var x = lin(0, N - 1, ML, CW - MR);
    var maxA = Math.max(Math.max.apply(null, COUNTS), Math.max.apply(null, U.slice(B))) + 2;
    var y1 = lin(0, maxA, A1, A0);
    var maxB = H * 2.8;
    var y2 = lin(0, maxB, B1, B0);
    function cy2(v) { return Math.max(B0, Math.min(B1, y2(v))); }

    function drawChart() {
      clear(chart);
      var g = svg("g", {}, chart), cur = st.cur, j;
      svg("rect", { x: ML, y: A0, width: x(B - 0.5) - ML, height: B1 - A0, fill: C.ink, opacity: 0.045 }, g);
      svg("text", { x: ML + 4, y: A0 + 13, "font-size": 11, fill: C.muted }, g).textContent = "reference weeks → m";
      svg("line", { x1: x(B - 0.5), y1: A0, x2: x(B - 0.5), y2: B1, stroke: C.muted, "stroke-width": 1.1, "stroke-dasharray": "3 4", opacity: 0.7 }, g);
      svg("text", { x: x(B - 0.5) + 5, y: B1 - 6, "font-size": 11, fill: C.muted }, g).textContent = "monitoring";
      svg("text", { x: ML, y: A0 - 11, "font-size": 12.5, "font-weight": 600, fill: C.ink }, g).textContent = "weekly cases";
      svg("text", { x: ML, y: B0 - 11, "font-size": 12.5, "font-weight": 600, fill: C.ink }, g).textContent = "CUSUM Sₜ (standardized)";
      svg("line", { x1: ML, y1: A1, x2: CW - MR, y2: A1, stroke: C.muted, "stroke-width": 1 }, g);
      svg("line", { x1: ML, y1: B1, x2: CW - MR, y2: B1, stroke: C.muted, "stroke-width": 1 }, g);
      // expected m line
      svg("line", { x1: ML, y1: y1(m), x2: CW - MR, y2: y1(m), stroke: C.expected, "stroke-width": 1.4, "stroke-dasharray": "4 5" }, g);
      svg("text", { x: CW - MR, y: y1(m) - 4, "font-size": 11, fill: C.expected, "text-anchor": "end" }, g).textContent = "expected m = " + m.toFixed(0);
      [5, 10, 15].forEach(function (t) { if (t < maxA) { svg("text", { x: ML - 7, y: y1(t) + 4, "font-size": 10.5, fill: C.muted, "text-anchor": "end" }, g).textContent = t; } });
      // bars
      var bw = Math.min(13, (CW - MR - ML) / N * 0.62);
      for (i = 0; i < N; i++) {
        var col = i < B ? "#b8c4d4" : (U[i] != null && COUNTS[i] >= U[i] ? C.alarmStrong : C.accent);
        svg("rect", { x: x(i) - bw / 2, y: y1(COUNTS[i]), width: bw, height: A1 - y1(COUNTS[i]), rx: 2, fill: col, opacity: i < B ? 0.5 : 0.62 }, g);
      }
      // Uₜ threshold (step line)
      var du = "";
      for (i = B; i < N; i++) du += (i === B ? "M" : "L") + x(i).toFixed(1) + " " + y1(U[i]).toFixed(1) + " ";
      svg("path", { d: du, fill: "none", stroke: C.alarmStrong, "stroke-width": 1.8, "stroke-dasharray": "5 3" }, g);
      svg("text", { x: x(B) + 5, y: y1(U[B]) - 6, "font-size": 11, "font-weight": 600, fill: C.alarmStrong }, g).textContent = "Uₜ epidemic threshold (cases)";
      // panel B
      svg("line", { x1: ML, y1: y2(H), x2: CW - MR, y2: y2(H), stroke: C.alarmStrong, "stroke-width": 2, "stroke-dasharray": "6 4" }, g);
      svg("text", { x: CW - MR, y: y2(H) - 5, "font-size": 12, "font-weight": 600, fill: C.alarmStrong, "text-anchor": "end" }, g).textContent = "h = 2.26";
      svg("text", { x: ML - 7, y: y2(0) + 4, "font-size": 10.5, fill: C.muted, "text-anchor": "end" }, g).textContent = "0";
      var dl = "", da = "M" + x(B).toFixed(1) + " " + cy2(0).toFixed(1) + " ";
      for (i = B; i <= cur; i++) { dl += (i === B ? "M" : "L") + x(i).toFixed(1) + " " + cy2(S[i]).toFixed(1) + " "; da += "L" + x(i).toFixed(1) + " " + cy2(S[i]).toFixed(1) + " "; }
      da += "L" + x(cur).toFixed(1) + " " + cy2(0).toFixed(1) + " Z";
      svg("path", { d: da, fill: C.accentSoft }, g);
      svg("path", { d: dl, fill: "none", stroke: C.accent, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
      if (alarm >= 0 && alarm <= cur) {
        svg("line", { x1: x(alarm), y1: B0, x2: x(alarm), y2: B1, stroke: C.alarmStrong, "stroke-width": 2, opacity: 0.4 }, g);
        svg("circle", { cx: x(alarm), cy: cy2(S[alarm]), r: 4.2, fill: C.alarmStrong }, g);
        svg("text", { x: x(alarm), y: B0 + 12, "font-size": 11, "font-weight": 600, fill: C.alarmStrong, "text-anchor": "middle" }, g).textContent = "epidemic signal";
      }
      // cursor + handle
      svg("line", { x1: x(cur), y1: A0 - 4, x2: x(cur), y2: B1, stroke: C.ink, "stroke-width": 1.6, opacity: 0.6 }, g);
      svg("circle", { cx: x(cur), cy: y1(COUNTS[cur]), r: 3.4, fill: C.ink }, g);
      var hub = svg("g", {}, g);
      svg("circle", { cx: x(cur), cy: A0 - 4, r: 6.5, fill: C.accent, stroke: "#fff", "stroke-width": 2 }, hub);
      svg("text", { x: x(cur), y: A0 - 15, "font-size": 11, "font-weight": 600, fill: C.ink, "text-anchor": "middle" }, hub).textContent = "wk " + (cur + 1);
      svg("text", { x: (ML + CW - MR) / 2, y: 282, "font-size": 11.5, fill: C.muted, "text-anchor": "middle" }, g).textContent = "drag across the plot to move the cursor; the CUSUM below follows";
    }

    function render() {
      var i = st.cur, sig = S[i] >= H, p = i > B ? S[i - 1] : 0;
      hint.className = "epr-hint " + (sig ? "bad" : "");
      hint.innerHTML = "<b>Week " + (i + 1) + ":</b> " + COUNTS[i] + " cases. " +
        "Standardize &rarr; z = (" + COUNTS[i] + " &minus; " + m.toFixed(0) + ")/&radic;" + m.toFixed(0) + " = <b>" + z[i].toFixed(2) + "</b>. " +
        "Accumulate &rarr; Sₜ = max(0, " + p.toFixed(2) + " + (" + z[i].toFixed(2) + " &minus; 1.04)) = <b>" + S[i].toFixed(2) + "</b>. " +
        (sig ? "Sₜ &#8805; h = 2.26, an epidemic signal (the case threshold Uₜ is " + U[i] + ")." : "Sₜ &lt; h = 2.26, no signal yet.");
      drawChart();
    }

    function setCur(i) { i = Math.max(B, Math.min(N - 1, Math.round(i))); if (i === st.cur) return; st.cur = i; render(); }
    function weekFromEvent(ev) {
      var r = chart.getBoundingClientRect();
      var vbx = (ev.clientX - r.left) / r.width * CW;
      return (vbx - ML) / (CW - MR - ML) * (N - 1);
    }
    chart.addEventListener("pointerdown", function (ev) { st.dragging = true; try { chart.setPointerCapture(ev.pointerId); } catch (e) {} setCur(weekFromEvent(ev)); ev.preventDefault(); });
    chart.addEventListener("pointermove", function (ev) { if (st.dragging) setCur(weekFromEvent(ev)); });
    chart.addEventListener("pointerup", function () { st.dragging = false; });
    chart.addEventListener("pointercancel", function () { st.dragging = false; });

    render();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
