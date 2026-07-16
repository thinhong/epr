(function () {
  "use strict";

  function init() {
    if (!window.EPR) return;
    EPR.injectStyles();
    injectGameStyles();
    var mount = document.getElementById("cusum-game");
    if (!mount) return;
    if (mount.getAttribute("data-built") === "1") return;
    mount.setAttribute("data-built", "1");
    build(mount);
  }

  function injectGameStyles() {
    if (document.getElementById("epr-cusum-styles")) return;
    var css =
      ".epr-fig .epr-hint{font-size:1.02rem;color:var(--ink);margin:6px 0 10px;background:var(--surfaceAlt);border-radius:10px;padding:9px 13px;border-left:4px solid var(--accent)}" +
      ".epr-fig .epr-hint.good{border-left-color:var(--expected)}.epr-fig .epr-hint.warn{border-left-color:var(--alarm)}.epr-fig .epr-hint.bad{border-left-color:var(--alarmStrong)}" +
      ".epr-fig .epr-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 2px}" +
      ".epr-fig .epr-seg{display:inline-flex;border:1px solid var(--grid);border-radius:10px;overflow:hidden}" +
      ".epr-fig .epr-seg button{appearance:none;border:0;background:var(--surface);color:var(--muted);font:inherit;font-size:.95rem;font-weight:500;padding:9px 15px;min-height:44px;cursor:pointer}" +
      ".epr-fig .epr-seg button.on{background:var(--accent);color:#fff}" +
      ".epr-fig .epr-spin{font-variant-numeric:tabular-nums}" +
      ".epr-fig .epr-charts{margin-top:4px}";
    var s = document.createElement("style");
    s.id = "epr-cusum-styles"; s.textContent = css;
    document.head.appendChild(s);
  }

  var NS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, s) { parent.textContent = s; return parent; }
  function clear(n) { while (n && n.firstChild) n.removeChild(n.firstChild); }

  // ---- exact CUSUM model ----
  // x_t = vial fill (mL). S_t = max(0, S_{t-1} + (x_t - MU0 - K)); signal when S_t > H.
  // K = k*sigma allowance, H = h*sigma decision interval (k=0.5, h=5). UCL = MU0 + 3*sigma (per-vial rule).
  var N = 40, MU0 = 3.0, SIGMA = 0.1, K = 0.05, H = 0.5, UCL = 3.30, DELTA = 0.15;

  // ---- belt window geometry ----
  var WIN = 6, WL = 56, WR = 512, SLOTW = (WR - WL) / WIN, BBASE = 150;
  var VHW = 20, VTOP = 90, VFL = 117, VSC = 80;
  function winX(s) { return WL + (s + 0.5) * SLOTW; }
  // ---- shared chart x-axis ----
  var CML = 56, CMR = 24, CW = 760;
  function xMap(i) { return CML + (i + 0.5) * ((CW - CML - CMR) / N); }

  function build(mount) {
    var C = EPR.colors();
    var LIQ = C.expected, OVER = C.alarm, GLASS = C.glass, GST = C.glassStroke,
        CAP = C.cap, CAPHI = C.capHi, BELT = C.belt, BELT_HI = "#aab6c4", ROLLER = C.roller;
    var st = { mode: "cusum", formula: false, step: -1, round: null, stop: -1, revealed: false, ended: false };

    mount.innerHTML =
      '<div class="epr-fig">' +
        '<div class="epr-head"><div><div class="epr-kicker">Precision vaccine line</div>' +
        '<div class="epr-title">Spot the drift with CUSUM</div></div></div>' +
        '<div class="epr-hint" id="g-hint"></div>' +
        '<svg class="epr-stage" id="g-stage" viewBox="0 0 760 178" role="img" aria-label="A conveyor belt window showing the six most recent vaccine vials being filled, newest on the right"></svg>' +
        '<div class="epr-readouts" id="g-read"></div>' +
        '<div class="epr-bar">' +
          '<button class="epr-btn primary" id="g-next">&#9654; Next vial</button>' +
          '<button class="epr-btn" id="g-reset">&#8635; New batch</button>' +
          '<span class="epr-spacer"></span>' +
          '<span class="epr-seg" id="g-mode"><button data-m="shewhart">Per vial</button><button data-m="cusum" class="on">CUSUM</button></span>' +
          '<button class="epr-chiptog" id="g-formula">Formula</button>' +
        '</div>' +
        '<div class="epr-charts">' +
          '<svg class="epr-chart" id="g-bars" viewBox="0 0 760 150" role="img" aria-label="Bar chart of each vial fill volume in millilitres versus the 3.0 target and the per-vial 3.30 limit"></svg>' +
          '<svg class="epr-chart" id="g-chart" viewBox="0 0 760 150" role="img" aria-label="CUSUM chart: accumulated evidence of overfilling versus vial number, with the H alarm line"></svg>' +
        '</div>' +
        '<div id="g-formula-box"></div>' +
        '<div class="epr-result" id="g-result"></div>' +
      '</div>';

    var $ = function (id) { return mount.querySelector(id); };
    var stage = $("#g-stage"), bars = $("#g-bars"), chart = $("#g-chart"), hint = $("#g-hint"),
        read = $("#g-read"), result = $("#g-result"), formulaBox = $("#g-formula-box");

    var S = {};
    buildStage();
    function buildStage() {
      clear(stage);
      var g = svg("g", {}, stage), sx, rx;
      // belt
      var belt = svg("g", {}, g);
      svg("rect", { x: WL - 12, y: BBASE, width: (WR + 12) - (WL - 12), height: 8, fill: BELT }, belt);
      svg("rect", { x: WL - 12, y: BBASE, width: (WR + 12) - (WL - 12), height: 3, fill: BELT_HI }, belt);
      for (rx = WL - 6; rx < WR + 12; rx += 30) svg("circle", { cx: rx, cy: BBASE + 13, r: 5, fill: ROLLER, stroke: BELT, "stroke-width": 1 }, belt);
      // static fill-line reference across the window
      svg("line", { x1: WL, y1: VFL, x2: WR, y2: VFL, stroke: LIQ, "stroke-width": 1.2, "stroke-dasharray": "4 5", opacity: 0.7 }, g);
      svg("text", { x: WR + 2, y: VFL + 4, "font-size": 10.5, fill: LIQ }, g).textContent = "3.0 mL";
      // clipped sliding group
      var defs = svg("defs", {}, g);
      var cp = svg("clipPath", { id: "eprWin" }, defs);
      svg("rect", { x: WL, y: 64, width: WR - WL, height: 92 }, cp);
      var clipG = svg("g", { "clip-path": "url(#eprWin)" }, g);
      S.beltG = svg("g", {}, clipG);
      // weight bubble (fixed above the newest slot)
      S.wBubble = svg("g", { opacity: 0 }, g);
      svg("rect", { x: -31, y: -13, width: 62, height: 22, rx: 7, fill: C.ink }, S.wBubble);
      svg("path", { d: "M -5 9 L 0 14 L 5 9 Z", fill: C.ink }, S.wBubble);
      S.wText = svg("text", { x: 0, y: 3.5, "font-size": 12.5, "font-weight": 700, fill: "#fff", "text-anchor": "middle" }, S.wBubble);
      // counter + progress
      svg("rect", { x: 556, y: 20, width: 150, height: 22, rx: 7, fill: C.surfaceAlt, stroke: C.grid }, g);
      S.count = svg("text", { x: 566, y: 35, "font-size": 11.5, fill: C.muted }, g);
      svg("rect", { x: 556, y: 47, width: 150, height: 5, rx: 2.5, fill: C.grid }, g);
      S.prog = svg("rect", { x: 556, y: 47, width: 0, height: 5, rx: 2.5, fill: C.accent }, g);
    }

    function beltVial(cx, vol, isCur, idx) {
      var g = S.beltG, over = vol >= MU0;
      // cap
      svg("rect", { x: cx - 12, y: VTOP - 15, width: 24, height: 14, rx: 3.8, fill: CAP }, g);
      svg("rect", { x: cx - 9, y: VTOP - 13, width: 8, height: 4, rx: 1.2, fill: CAPHI }, g);
      // neck
      svg("rect", { x: cx - 7, y: VTOP - 2, width: 14, height: 4, fill: GLASS, stroke: GST, "stroke-width": 0.5 }, g);
      // body + clip
      var cid = "bv" + idx;
      var cp = svg("clipPath", { id: cid }, g);
      svg("rect", { x: cx - VHW, y: VTOP, width: 40, height: BBASE - VTOP, rx: 10 }, cp);
      svg("rect", { x: cx - VHW, y: VTOP, width: 40, height: BBASE - VTOP, rx: 10, fill: GLASS, stroke: GST, "stroke-width": 0.9 }, g);
      var cg = svg("g", { "clip-path": "url(#" + cid + ")" }, g);
      if (over) {
        svg("rect", { x: cx - VHW, y: VFL, width: 40, height: BBASE - VFL, fill: LIQ, opacity: 0.34 }, cg);
        var ah = Math.min((vol - MU0) * VSC, VFL - VTOP - 2);
        if (ah > 0.3) svg("rect", { x: cx - VHW, y: VFL - ah, width: 40, height: ah, fill: OVER, opacity: 0.9 }, cg);
      } else {
        var topY = Math.min(BBASE - 2, VFL + (MU0 - vol) * VSC);
        svg("rect", { x: cx - VHW, y: topY, width: 40, height: BBASE - topY, fill: LIQ, opacity: 0.34 }, cg);
      }
      svg("rect", { x: cx - 15, y: VTOP + 8, width: 4, height: 44, rx: 2, fill: "#ffffff", opacity: 0.55 }, cg);
      if (isCur) svg("rect", { x: cx - 23, y: VTOP - 17, width: 46, height: (BBASE - VTOP) + 19, rx: 7, fill: "none", stroke: C.accent, "stroke-width": 2 }, g);
    }

    function renderBelt(withOutgoing) {
      clear(S.beltG);
      var baseIdx = st.step - (WIN - 1);
      var lo = withOutgoing ? baseIdx - 1 : baseIdx;
      for (var i = Math.max(0, lo); i <= st.step; i++) beltVial(winX(i - baseIdx), st.round.x[i], i === st.step, i);
    }
    function slideBelt() {
      if (EPR.reducedMotion() || st.step === 0) { renderBelt(false); S.beltG.removeAttribute("transform"); return; }
      renderBelt(true);
      S.beltG.setAttribute("transform", "translate(" + SLOTW + ",0)");
      EPR.tween(SLOTW, 0, 300, function (t) { S.beltG.setAttribute("transform", "translate(" + t + ",0)"); }, function () { renderBelt(false); S.beltG.setAttribute("transform", "translate(0,0)"); });
    }
    function showWeight(vol) {
      S.wBubble.setAttribute("transform", "translate(" + winX(WIN - 1) + ",54)");
      S.wText.textContent = vol.toFixed(2) + " mL";
      S.wBubble.setAttribute("opacity", 1);
    }
    function setCounter() {
      S.count.textContent = st.step < 0 ? "no vials yet" : ("vial " + (st.step + 1) + " of " + N);
      S.prog.setAttribute("width", st.step < 0 ? 0 : 150 * (st.step + 1) / N);
    }

    function newRound() {
      var seed = Math.floor(Math.random() * 1e9), rnd = EPR.rng(seed), z = [];
      for (var i = 0; i < N; i++) z.push(EPR.gauss(rnd));
      st.round = { z: z, driftStart: 12 + Math.floor(rnd() * (N - 20)) };
      buildData();
      st.step = -1; st.stop = -1; st.revealed = false; st.ended = false;
      clear(S.beltG); S.beltG.removeAttribute("transform"); S.wBubble.setAttribute("opacity", 0);
      result.classList.remove("show");
      setCounter(); renderReadouts(); drawBars(); drawCusum();
      setHint("Each vial should fill to the <b>3.0 mL</b> line. Click <b>Next vial</b>. Watch the volume bars and the <b>CUSUM</b> build: it flags a sustained drift long before any single vial looks wrong.", "");
    }
    function buildData() {
      var r = st.round, x = [], Sp = [], prev = 0;
      for (var i = 0; i < N; i++) {
        x.push(EPR.round(MU0 + (i >= r.driftStart ? DELTA : 0) + r.z[i] * SIGMA, 2));
        prev = Math.max(0, prev + (x[i] - MU0 - K)); Sp.push(prev);
      }
      r.x = x; r.S = Sp;
      r.cusumAlarm = firstCusum(N - 1);
    }
    function firstCusum(upto) { for (var i = 0; i <= upto; i++) if (st.round.S[i] > H) return i; return -1; }
    function firstShew(upto) { for (var i = 0; i <= upto; i++) if (st.round.x[i] > UCL) return i; return -1; }
    function stopFor(upto) { return st.mode === "cusum" ? firstCusum(upto) : firstShew(upto); }

    function nextBottle() {
      if (st.ended || st.step >= N - 1) return;
      st.step++;
      slideBelt();
      showWeight(st.round.x[st.step]);
      setCounter(); renderReadouts(); drawBars(); drawCusum();
      var s = stopFor(st.step);
      if (s >= 0) { st.stop = s; st.ended = true; st.revealed = true; showResult(); }
      else if (st.step >= N - 1) { st.ended = true; st.revealed = true; showResult(); }
    }

    function chip(l, v, c) { return '<div class="epr-chip ' + (c || "") + '"><span>' + l + '</span><span class="v epr-spin">' + v + '</span></div>'; }
    function renderReadouts() {
      if (st.step < 0) { read.innerHTML = chip("vials", "0 of " + N) + chip("CUSUM", "0.00", "good") + chip("status", "ready", ""); return; }
      var v = st.round.x[st.step], dev = v - MU0, s = st.round.S[st.step];
      var sig = st.stop >= 0 && st.stop === st.step;
      read.innerHTML =
        chip("vial", "#" + (st.step + 1)) +
        chip("fill", v.toFixed(2) + " mL", v > UCL ? "bad" : (dev > 0 ? "warn" : "")) +
        chip("over target", (dev >= 0 ? "+" : "") + dev.toFixed(2), dev > 0 ? "warn" : "good") +
        chip("CUSUM", s.toFixed(2), s > H ? "bad" : "") +
        chip("status", st.ended ? (st.stop >= 0 ? "SIGNAL" : "no signal") : "running", st.stop >= 0 ? "bad" : "good");
    }

    function setHint(html, cls) { hint.className = "epr-hint " + (cls || ""); hint.innerHTML = html; }

    // ---- volume bar chart ----
    function drawBars() {
      clear(bars);
      var g = svg("g", {}, bars), i;
      var bt = 34, bb = 126, vmin = 2.74, vmax = 3.34;
      var bw = ((CW - CML - CMR) / N) * 0.6;
      function yV(v) { return bb - (v - vmin) / (vmax - vmin) * (bb - bt); }
      svg("text", { x: CML, y: 18, "font-size": 12, "font-weight": 600, fill: C.ink }, g).textContent = "Volume of each vial (mL)";
      [2.8, 3.0, 3.2].forEach(function (v) { svg("text", { x: CML - 8, y: yV(v) + 4, "font-size": 10, fill: C.muted, "text-anchor": "end" }, g).textContent = v.toFixed(1); });
      var y0 = yV(MU0);
      var shewStop = st.mode === "shewhart" ? st.stop : -1;
      for (i = 0; i <= st.step; i++) {
        var v = st.round.x[i], over = v > MU0, yv = yV(v);
        var col = (v > UCL) ? C.alarmStrong : (over ? OVER : LIQ);
        svg("rect", { x: xMap(i) - bw / 2, y: Math.min(yv, y0), width: bw, height: Math.max(0.6, Math.abs(yv - y0)), rx: 1, fill: col, opacity: 0.85 }, g);
        if (i === shewStop) svg("circle", { cx: xMap(i), cy: yv - 4, r: 3, fill: C.alarmStrong }, g);
      }
      svg("line", { x1: CML, y1: y0, x2: CW - CMR, y2: y0, stroke: LIQ, "stroke-width": 1.3, "stroke-dasharray": "4 4" }, g);
      svg("text", { x: CW - CMR, y: y0 - 4, "font-size": 10.5, fill: LIQ, "text-anchor": "end" }, g).textContent = "target 3.0";
      svg("line", { x1: CML, y1: yV(UCL), x2: CW - CMR, y2: yV(UCL), stroke: C.alarmStrong, "stroke-width": 1.3, "stroke-dasharray": "2 3", opacity: 0.85 }, g);
      svg("text", { x: CW - CMR, y: yV(UCL) - 4, "font-size": 10.5, fill: C.alarmStrong, "text-anchor": "end" }, g).textContent = "per-vial limit 3.30";
      if (st.revealed) {
        var d = st.round.driftStart;
        svg("line", { x1: xMap(d), y1: bt, x2: xMap(d), y2: bb, stroke: LIQ, "stroke-width": 1.3, "stroke-dasharray": "3 4" }, g);
        svg("text", { x: xMap(d) + 3, y: bt + 10, "font-size": 10, fill: LIQ }, g).textContent = "drift began";
      }
    }

    // ---- CUSUM chart ----
    function drawCusum() {
      clear(chart);
      var g = svg("g", {}, chart), i;
      var ct = 34, cb = 126, cmax = 2.0;
      function yC(c) { return cb - Math.min(c, cmax) / cmax * (cb - ct); }
      svg("text", { x: CML, y: 18, "font-size": 12, "font-weight": 600, fill: C.ink }, g).textContent = "CUSUM: accumulated evidence of overfilling";
      svg("line", { x1: CML, y1: cb, x2: CW - CMR, y2: cb, stroke: C.muted, "stroke-width": 1 }, g);
      [0, 0.5, 1.0, 1.5, 2.0].forEach(function (c) { svg("text", { x: CML - 8, y: yC(c) + 4, "font-size": 10, fill: C.muted, "text-anchor": "end" }, g).textContent = c.toFixed(1); });
      if (st.step >= 0) {
        var area = "M" + xMap(0).toFixed(1) + " " + cb + " ";
        var line = "";
        for (i = 0; i <= st.step; i++) { var p = xMap(i).toFixed(1) + " " + yC(st.round.S[i]).toFixed(1); area += "L" + p + " "; line += (i ? "L" : "M") + p + " "; }
        area += "L" + xMap(st.step).toFixed(1) + " " + cb + " Z";
        svg("path", { d: area, fill: C.accent, opacity: 0.12 }, g);
        svg("path", { d: line, fill: "none", stroke: C.accent, "stroke-width": 2.3, "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
      }
      svg("line", { x1: CML, y1: yC(H), x2: CW - CMR, y2: yC(H), stroke: C.alarmStrong, "stroke-width": 2, "stroke-dasharray": "6 4" }, g);
      svg("text", { x: CML + 4, y: yC(H) - 5, "font-size": 11, "font-weight": 600, fill: C.alarmStrong }, g).textContent = "H = 0.5 (alarm)";
      if (st.mode === "cusum" && st.stop >= 0) svg("circle", { cx: xMap(st.stop), cy: yC(st.round.S[st.stop]), r: 4.2, fill: C.alarmStrong }, g);
      if (st.revealed) {
        var d = st.round.driftStart;
        svg("line", { x1: xMap(d), y1: ct, x2: xMap(d), y2: cb, stroke: LIQ, "stroke-width": 1.3, "stroke-dasharray": "3 4" }, g);
      }
      svg("text", { x: (CML + CW - CMR) / 2, y: cb + 20, "font-size": 11, fill: C.muted, "text-anchor": "middle" }, g).textContent = "vial number";
    }

    function renderFormula() {
      if (!st.formula) { formulaBox.innerHTML = ""; return; }
      formulaBox.innerHTML =
        '<div class="epr-formula"><span class="s">S</span> = max( 0 , <span class="s">S</span> + ( fill &minus; <span class="mu">3.0</span> &minus; <span class="k">0.05</span> ) ) &nbsp; signal when <span class="s">S</span> &gt; <span class="h">0.5</span></div>' +
        '<div class="epr-legend">' + leg(C.expected, "3.0 = target fill (μ₀)") + leg(C.alarm, "0.05 = allowance K = 0.5σ") + leg(C.alarmStrong, "0.5 = decision interval H = 5σ") + '</div>';
    }
    function leg(color, text) { return '<span class="epr-leg"><span class="epr-sw" style="background:' + color + '"></span>' + text + '</span>'; }

    function reevaluate() {
      if (!st.round || st.step < 0) { st.ended = false; st.stop = -1; return; }
      st.stop = stopFor(st.step);
      st.ended = st.stop >= 0 || st.step >= N - 1;
      if (st.ended) { st.revealed = true; showResult(); }
      else { result.classList.remove("show"); setHint("Now using the <b>" + (st.mode === "cusum" ? "CUSUM" : "per-vial 3.30 limit") + "</b> rule. Keep clicking <b>Next vial</b>.", ""); }
    }
    function showResult() {
      var r = st.round, ds = r.driftStart, cls, msg = "<b>Batch over.</b> The filler began overfilling at vial " + (ds + 1) + " (teal line). ";
      if (st.mode === "cusum") {
        if (st.stop >= 0) { msg += "CUSUM signalled at vial " + (st.stop + 1) + ", " + (st.stop - ds) + " vial" + (st.stop - ds === 1 ? "" : "s") + " after the drift. Stop and recalibrate."; cls = (st.stop < ds) ? "bad" : "good"; if (st.stop < ds) msg += " (That was before the drift, a false alarm.)"; }
        else { msg += "CUSUM did not reach H in these " + N + " vials."; cls = "warn"; }
      } else {
        if (st.stop >= 0) { msg += "A single vial crossed the 3.30 limit at vial " + (st.stop + 1) + "."; cls = "warn"; }
        else { msg += "<b>No single vial ever crossed the 3.30 limit</b>, so per-vial monitoring missed the drift and the whole batch shipped over target. CUSUM would have caught it at vial " + (r.cusumAlarm + 1) + "."; cls = "bad"; }
      }
      result.className = "epr-result show " + cls; result.innerHTML = msg;
      drawBars(); drawCusum(); renderReadouts();
      setHint("Batch over. Hit <b>New batch</b> for a fresh hidden drift, or switch the rule to replay this same batch.", "");
    }

    $("#g-next").onclick = nextBottle;
    $("#g-reset").onclick = newRound;
    mount.querySelectorAll("#g-mode button").forEach(function (b) {
      b.onclick = function () {
        st.mode = b.getAttribute("data-m");
        mount.querySelectorAll("#g-mode button").forEach(function (o) { o.classList.toggle("on", o === b); });
        reevaluate(); renderReadouts(); drawBars(); drawCusum();
      };
    });
    $("#g-formula").onclick = function () { st.formula = !st.formula; $("#g-formula").classList.toggle("on", st.formula); renderFormula(); };

    newRound();
    renderFormula();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
