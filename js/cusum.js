(function () {
  "use strict";

  function init() {
    if (!window.EPR) return;
    EPR.injectStyles();
    injectGameStyles();
    var mount = document.getElementById("cusum-game");
    if (!mount || mount.getAttribute("data-built") === "1") return;
    mount.setAttribute("data-built", "1");
    build(mount);
  }

  function injectGameStyles() {
    if (document.getElementById("epr-cusum-styles")) return;
    var css =
      ".epr-fig{box-shadow:0 1px 2px rgba(4,33,71,.06)}" +
      ".epr-fig #g-chart{cursor:crosshair;touch-action:none}" +
      ".epr-fig .epr-bar{gap:14px;margin-top:12px}" +
      ".epr-fig .epr-btn{min-height:40px;padding:0 16px;font-size:.95rem}" +
      ".epr-fig .epr-card{}";
    var s = document.createElement("style"); s.id = "epr-cusum-styles"; s.textContent = css;
    document.head.appendChild(s);
  }

  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }
  function spaces(n) { return new Array(n + 1).join(" "); }

  // exact one-sided CUSUM: S_t = max(0, S_{t-1} + (x_t - MU0 - K)); signal S_t > H
  var MU0 = 3.0, SIGMA = 0.1, K = 0.05, H = 0.5, DELTA = 0.18, N = 12;
  var CML = 54, CMR = 22, CW = 760, STEP = (CW - CML - CMR) / N;
  function xMap(i) { return CML + (i + 0.5) * STEP; }
  // vial geometry
  var VBB = 104, VW = Math.min(STEP * 0.5, 34), VHW = VW / 2, VBODY = VW * 1.42, VBT = VBB - VBODY,
      VCAPW = VW * 0.56, VCAPHW = VCAPW / 2, VCAPH = VW * 0.32, VYFL = VBT + VBODY * 0.42, VSC = 70;

  function build(mount) {
    var C = EPR.colors();
    var LIQ = C.expected, OVER = C.alarm, GLASS = C.glass, GST = C.glassStroke,
        CAP = C.cap, CAPHI = C.capHi, BELT = C.belt, BELT_HI = "#c4cdd8", ROLLER = C.roller, TITLE = C.heading;
    var st = { step: -1, stop: -1, ended: false, round: null, fillFrac: 1 };

    mount.innerHTML =
      '<div class="epr-fig" style="position:relative">' +
        '<svg class="epr-stage" id="g-belt" viewBox="0 0 760 124" role="img" aria-label="A vaccine filling line: click to fill each vial; the line stops if the CUSUM alarms"></svg>' +
        '<svg class="epr-chart" id="g-bars" viewBox="0 0 760 126" role="img" aria-label="Bar chart of each vial fill volume against the 3.0 mL target"></svg>' +
        '<svg class="epr-chart" id="g-chart" viewBox="0 0 760 164" role="img" aria-label="CUSUM chart; hover or drag to see the running computation for each vial"></svg>' +
        '<div class="epr-bar">' +
          '<button class="epr-btn primary" id="g-next">&#9654; Fill next vial</button>' +
          '<button class="epr-btn" id="g-reset">&#8635; New batch</button>' +
        '</div>' +
      '</div>';

    var $ = function (id) { return mount.querySelector(id); };
    var fig = $(".epr-fig"), belt = $("#g-belt"), bars = $("#g-bars"), chart = $("#g-chart"), nextBtn = $("#g-next");

    var beltG;
    (function buildBelt() {
      var g = svg("g", {}, belt), sx, by = VBB;
      svg("text", { x: CML, y: 22, "font-size": 16, "font-weight": 600, fill: TITLE }, g).textContent = "Vaccine fill line";
      svg("ellipse", { cx: CML - 12, cy: by + 4.5, rx: 5.5, ry: 6.5, fill: ROLLER, stroke: BELT, "stroke-width": 1 }, g);
      svg("ellipse", { cx: CW - CMR + 12, cy: by + 4.5, rx: 5.5, ry: 6.5, fill: ROLLER, stroke: BELT, "stroke-width": 1 }, g);
      svg("rect", { x: CML - 12, y: by, width: (CW - CMR + 12) - (CML - 12), height: 9, rx: 2, fill: BELT }, g);
      svg("rect", { x: CML - 12, y: by, width: (CW - CMR + 12) - (CML - 12), height: 2.5, rx: 2, fill: BELT_HI }, g);
      for (sx = CML + 6; sx < CW - CMR - 8; sx += 34) svg("path", { d: "M" + sx + " " + (by + 2.5) + " l4 2 l-4 2", fill: "none", stroke: "#fff", "stroke-width": 1.4, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.3 }, g);
      svg("line", { x1: CML, y1: VYFL, x2: CW - CMR, y2: VYFL, stroke: LIQ, "stroke-width": 1.1, "stroke-dasharray": "3 5", opacity: 0.55 }, g);
      beltG = svg("g", {}, g);
    })();

    function beltVial(g, cx, vol, isCur, fillFrac, alarmed) {
      var over = vol >= MU0;
      var amberH = over ? Math.min((vol - MU0) * VSC, VYFL - VBT - 2) : 0;
      var finalTop = over ? (VYFL - amberH) : Math.min(VBB - 2, VYFL + (MU0 - vol) * VSC);
      var yfill = VBB - fillFrac * (VBB - finalTop);
      svg("ellipse", { cx: cx, cy: VBB + 1.5, rx: VHW + 2, ry: 2.4, fill: "#0f172a", opacity: 0.09 }, g);
      svg("rect", { x: cx - VCAPHW, y: VBT - VCAPH - 1, width: VCAPW, height: VCAPH, rx: 3, fill: CAP }, g);
      svg("rect", { x: cx - VCAPHW + 1.5, y: VBT - VCAPH + 0.5, width: VCAPW * 0.4, height: VCAPH * 0.34, rx: 1, fill: CAPHI }, g);
      svg("ellipse", { cx: cx - VCAPW * 0.12, cy: VBT - VCAPH + 1.6, rx: VCAPW * 0.22, ry: 1.3, fill: "#ffffff", opacity: 0.5 }, g);
      svg("rect", { x: cx - VW * 0.16, y: VBT - 2, width: VW * 0.32, height: 3.5, fill: GLASS, stroke: GST, "stroke-width": 0.5 }, g);
      var bid = "vb" + Math.round(cx);
      svg("rect", { x: cx - VHW, y: VBT, width: VW, height: VBB - VBT, rx: VW * 0.3 }, svg("clipPath", { id: bid }, g));
      svg("rect", { x: cx - VHW, y: VBT, width: VW, height: VBB - VBT, rx: VW * 0.3, fill: GLASS, stroke: GST, "stroke-width": 0.9 }, g);
      var cg = svg("g", { "clip-path": "url(#" + bid + ")" }, g), lg = cg;
      if (fillFrac < 1) { var fid = "vf" + Math.round(cx); svg("rect", { x: cx - VHW, y: yfill, width: VW, height: VBB - yfill }, svg("clipPath", { id: fid }, g)); lg = svg("g", { "clip-path": "url(#" + fid + ")" }, cg); }
      var tealTop = over ? VYFL : finalTop;
      svg("rect", { x: cx - VHW, y: tealTop, width: VW, height: VBB - tealTop, fill: LIQ, opacity: 0.34 }, lg);
      if (amberH > 0.4) svg("rect", { x: cx - VHW, y: VYFL - amberH, width: VW, height: amberH, fill: OVER, opacity: 0.92 }, lg);
      svg("rect", { x: cx - VHW + VW * 0.17, y: VBT + 5, width: 2.6, height: VBODY - 12, rx: 1.3, fill: "#ffffff", opacity: 0.55 }, cg);
      if (isCur && fillFrac < 1) {
        var nt = VBT - VCAPH - 22;
        svg("rect", { x: cx - 11, y: nt, width: 22, height: 9, rx: 3, fill: "#c2ccd6", stroke: GST, "stroke-width": 1 }, g);
        svg("rect", { x: cx - 3, y: nt + 8, width: 6, height: 5, rx: 1, fill: "#9aa7b5" }, g);
        svg("rect", { x: cx - 1.4, y: nt + 13, width: 2.8, height: Math.max(0, yfill - (nt + 13)), fill: LIQ, opacity: 0.6 }, g);
      }
      if (isCur) svg("rect", { x: cx - VHW - 3, y: VBT - VCAPH - 4, width: VW + 6, height: (VBB - VBT) + VCAPH + 6, rx: 6, fill: "none", stroke: alarmed ? C.alarmStrong : C.accent, "stroke-width": 1.8 }, g);
    }

    function drawBelt() {
      clear(beltG);
      var settled = st.fillFrac >= 1;
      var running = !st.ended || !settled;
      var stopped = st.ended && st.stop >= 0 && settled;
      var t = running ? "Running" : (stopped ? "Line stopped" : "Batch done");
      var dotc = running ? C.expected : (stopped ? C.alarmStrong : C.muted);
      var txtc = running ? C.expectedInk : (stopped ? C.alarmStrongInk : C.muted);
      var pw = 122, px = CW - CMR - pw, py = 7;
      svg("rect", { x: px, y: py, width: pw, height: 21, rx: 10.5, fill: C.surface, stroke: C.grid }, beltG);
      svg("circle", { cx: px + 14, cy: py + 10.5, r: 4.5, fill: dotc }, beltG);
      svg("text", { x: px + 26, y: py + 14.5, "font-size": 12.5, "font-weight": 600, fill: txtc }, beltG).textContent = t;
      for (var i = 0; i <= st.step; i++) {
        var isCur = i === st.step, alarmed = stopped && st.stop === i;
        beltVial(beltG, xMap(i), st.round.x[i], isCur, isCur ? st.fillFrac : 1, alarmed);
      }
      if (stopped) {
        var gs = svg("g", { transform: "translate(" + xMap(st.stop) + "," + (VBT + VBODY * 0.42) + ") rotate(-13)" }, beltG);
        svg("rect", { x: -25, y: -12, width: 50, height: 24, rx: 5, fill: "rgba(224,87,78,0.15)", stroke: C.alarmStrong, "stroke-width": 2 }, gs);
        svg("text", { x: 0, y: 5, "font-size": 13, "font-weight": 800, fill: C.alarmStrongInk, "text-anchor": "middle", "letter-spacing": ".08em" }, gs).textContent = "STOP";
      }
    }

    function title(g, s) { svg("text", { x: CML, y: 18, "font-size": 16, "font-weight": 600, fill: TITLE, "letter-spacing": ".01em" }, g).textContent = s; }
    function drawBars() {
      clear(bars);
      var g = svg("g", {}, bars), i;
      var bt = 28, bb = 112, vmin = 2.72, vmax = 3.5, bw = STEP * 0.54;
      function yV(v) { return bb - (v - vmin) / (vmax - vmin) * (bb - bt); }
      title(g, "Vial volume (mL)");
      [2.8, 3.0, 3.2, 3.4].forEach(function (v) { svg("text", { x: CML - 8, y: yV(v) + 5, "font-size": 13.5, fill: C.muted, "text-anchor": "end" }, g).textContent = v.toFixed(1); });
      var y0 = yV(MU0);
      for (i = 0; i <= st.step; i++) { var v = st.round.x[i], yv = yV(v); svg("rect", { x: xMap(i) - bw / 2, y: Math.min(yv, y0), width: bw, height: Math.max(0.8, Math.abs(yv - y0)), rx: 3, fill: v > MU0 ? OVER : LIQ, opacity: 0.92 }, g); }
      svg("line", { x1: CML, y1: y0, x2: CW - CMR, y2: y0, stroke: LIQ, "stroke-width": 1.3, "stroke-dasharray": "3 4" }, g);
      svg("text", { x: CW - CMR, y: y0 - 6, "font-size": 14, fill: C.expectedInk, "text-anchor": "end" }, g).textContent = "target 3.0";
    }

    function drawCusum(hi) {
      clear(chart);
      var g = svg("g", {}, chart), i;
      var ct = 28, cb = 118, cmax = 1.0;
      function yC(c) { return cb - Math.min(c, cmax) / cmax * (cb - ct); }
      title(g, "CUSUM");
      svg("line", { x1: CML, y1: cb, x2: CW - CMR, y2: cb, stroke: C.grid, "stroke-width": 1 }, g);
      [0, 0.5, 1.0].forEach(function (c) { svg("text", { x: CML - 8, y: yC(c) + 5, "font-size": 13.5, fill: C.muted, "text-anchor": "end" }, g).textContent = c.toFixed(1); });
      if (hi != null && hi >= 0 && hi <= st.step) svg("line", { x1: xMap(hi), y1: ct - 4, x2: xMap(hi), y2: cb, stroke: C.accent, "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.55 }, g);
      if (st.step >= 0) {
        var area = "M" + xMap(0).toFixed(1) + " " + cb + " ", line = "";
        for (i = 0; i <= st.step; i++) { var p = xMap(i).toFixed(1) + " " + yC(st.round.S[i]).toFixed(1); area += "L" + p + " "; line += (i ? "L" : "M") + p + " "; }
        area += "L" + xMap(st.step).toFixed(1) + " " + cb + " Z";
        svg("path", { d: area, fill: C.accent, opacity: 0.1 }, g);
        svg("path", { d: line, fill: "none", stroke: C.accent, "stroke-width": 2.4, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
        for (i = 0; i <= st.step; i++) {
          var on = i === hi;
          if (on) svg("circle", { cx: xMap(i), cy: yC(st.round.S[i]), r: 7, fill: C.accent, opacity: 0.16 }, g);
          svg("circle", { cx: xMap(i), cy: yC(st.round.S[i]), r: on ? 4.2 : 2.5, fill: st.round.S[i] > H ? C.alarmStrong : C.accent, stroke: "#fff", "stroke-width": on ? 1.2 : 0 }, g);
          svg("text", { x: xMap(i), y: cb + 18, "font-size": 14, "font-weight": on ? 700 : 500, fill: on ? C.accent : C.muted, "text-anchor": "middle" }, g).textContent = (i + 1);
        }
      }
      svg("line", { x1: CML, y1: yC(H), x2: CW - CMR, y2: yC(H), stroke: C.alarmStrong, "stroke-width": 2, "stroke-dasharray": "6 4" }, g);
      svg("text", { x: CML + 3, y: yC(H) - 7, "font-size": 14, "font-weight": 600, fill: C.alarmStrongInk }, g).textContent = "H = 0.5";
      drawCard(g, hi);
    }
    var MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
    function drawCard(g, hi) {
      var cw = 322, ch = 58, cx0 = CW - CMR - cw, cy0 = 4, px = cx0 + 14, on = hi != null && hi >= 0 && hi <= st.step;
      svg("rect", { x: cx0, y: cy0, width: cw, height: ch, rx: 10, fill: "#ffffff", stroke: C.grid }, g);
      var l1, l2, l3, c2 = C.muted, c3 = C.muted, w3 = 400;
      if (on) {
        var x = st.round.x[hi], prev = hi > 0 ? st.round.S[hi - 1] : 0, Sv = st.round.S[hi], al = Sv > H;
        l1 = "Vial " + (hi + 1) + "  ·  fill " + x.toFixed(2) + " mL";
        l2 = "S = max(0, " + prev.toFixed(2) + " + (" + x.toFixed(2) + " − 3.05))";
        l3 = "   = " + Sv.toFixed(2) + (al ? "   ▲ alarm" : "");
        c2 = C.ink; c3 = al ? C.alarmStrongInk : C.accent; w3 = 700;
      } else {
        l1 = "CUSUM  ·  each vial";
        l2 = "S = max(0, S(t-1) + (fill − 3.05))";
        l3 = "hover the curve to see the numbers";
      }
      svg("text", { x: px, y: cy0 + 18, "font-size": 13, fill: C.muted }, g).textContent = l1;
      svg("text", { x: px, y: cy0 + 37, "font-size": 14, "font-family": MONO, fill: c2 }, g).textContent = l2;
      svg("text", { x: px, y: cy0 + 55, "font-size": 14, "font-family": MONO, "font-weight": w3, fill: c3 }, g).textContent = l3;
    }

    function makeRound() {
      var seed = Math.floor(Math.random() * 1e9), rnd = EPR.rng(seed), z = [], i;
      for (i = 0; i < N; i++) z.push(EPR.gauss(rnd));
      var ds = 3 + Math.floor(rnd() * 3);
      var x = [], Sp = [], prev = 0;
      for (i = 0; i < N; i++) { x.push(EPR.round(MU0 + (i >= ds ? DELTA : 0) + z[i] * SIGMA, 2)); prev = Math.max(0, prev + (x[i] - MU0 - K)); Sp.push(prev); }
      st.round = { x: x, S: Sp, driftStart: ds };
    }
    function resetRun() {
      st.step = 2; st.stop = -1; st.ended = false; st.fillFrac = 1;
      for (var i = 0; i <= st.step; i++) if (st.round.S[i] > H) { st.stop = i; st.ended = true; st.step = i; break; }
      drawBelt(); drawBars(); drawCusum(-1); nextBtn.disabled = st.ended;
    }
    function nextVial() {
      if (st.ended || st.step >= N - 1) return;
      st.step++;
      drawBars(); drawCusum(-1);
      if (st.round.S[st.step] > H) { st.stop = st.step; st.ended = true; }
      else if (st.step >= N - 1) { st.ended = true; }
      nextBtn.disabled = st.ended;
      if (EPR.reducedMotion()) { st.fillFrac = 1; drawBelt(); return; }
      st.fillFrac = 0; drawBelt();
      EPR.tween(0, 1, 430, function (p) { st.fillFrac = p; drawBelt(); }, function () { st.fillFrac = 1; drawBelt(); });
    }
    function newBatch() { makeRound(); resetRun(); }

    function idxFromEvent(e) { var r = chart.getBoundingClientRect(); if (!r.width) return -1; var vx = (e.clientX - r.left) / r.width * CW; return EPR.clamp(Math.round((vx - CML) / STEP - 0.5), 0, st.step); }
    function onHover(e) { if (st.step < 0) return; var i = idxFromEvent(e); if (i < 0) return; drawCusum(i); }
    function offHover() { drawCusum(-1); }
    chart.addEventListener("pointermove", onHover);
    chart.addEventListener("pointerdown", onHover);
    chart.addEventListener("pointerleave", offHover);
    chart.addEventListener("pointerup", offHover);
    chart.addEventListener("pointercancel", offHover);

    nextBtn.onclick = nextVial;
    $("#g-reset").onclick = newBatch;

    newBatch();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
