/* ============================================================
   CUSUM figure 1: a vaccine filling line (#viz-cusum-line)
   Three rows on one vial axis: the belt, each vial's fill against
   the 3.0 mL target, and the CUSUM
       S_t = max(0, S_(t-1) + (x_t - 3.05)),   signal when S_t >= H,
   where 3.05 is the target plus a slack K = 0.05 mL, and H = 0.5.
   Fills are kept in hundredths of a mL, so every sum in the readout
   adds up exactly. Somewhere after vial 3 the filler starts to
   overfill by 0.18 mL, and the line stops at the first signal.
   ============================================================ */

(function () {
  const MOUNT = '#viz-cusum-line';
  const el = document.querySelector(MOUNT);
  if (!el) return;
  const missing = [];
  if (typeof d3 === 'undefined') missing.push('d3');
  if (typeof VIZ === 'undefined') missing.push('viz-kit.js');
  if (typeof CUSUM === 'undefined') missing.push('cusum-core.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load. Not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check the script list at the end of the chapter.</div>';
    return;
  }

  // Everything in hundredths of a mL.
  const TARGET = 300, K = 5, H = 50, SD = 10, SHIFT = 18, N = 12, START = 3;
  const LO = 268, HI = 352, SMAX = 100;          // fill axis 2.68 to 3.52 mL, CUSUM axis 0 to 1.0 mL
  const mL = v => CUSUM.num(v / 100, 2);
  const nb = t => t.replace(/ /g, '\u00a0');      // keep a piece of a formula on one line
  const st = { x: [], S: [], drift: 0, alarm: -1, shown: 0, sel: null, p: 1, raf: 0 };

  /* ---- the card ------------------------------------------------ */
  el.classList.add('cusum-card');
  const card = VIZ.card(MOUNT, { title: 'Catching a small overfill', status: 'Running' });
  const box = card.body.append('div').attr('class', 'cusum-model').attr('aria-live', 'polite');
  const chart = card.body.append('div').attr('class', 'cusum-chart');
  const foot = card.body.append('div').attr('class', 'cusum-foot');
  const hint = foot.append('p').attr('class', 'cusum-hint');
  const acts = foot.append('div').attr('class', 'cusum-actions');
  const nextBtn = acts.append('button').attr('type', 'button').text('Fill next vial').on('click', fillNext);
  const newBtn = acts.append('button').attr('type', 'button').text('New batch').on('click', newBatch);
  const svg = chart.append('svg').attr('role', 'slider').attr('aria-label', 'Vial').attr('aria-valuemin', 1);
  let L = null, G = null;

  /* ---- the batch ----------------------------------------------- */
  function makeBatch() {
    const g = d3.randomNormal(0, 1);
    const noise = () => { let v; do { v = g(); } while (Math.abs(v) > 3); return v; };   // fills stay within 3 sd
    st.drift = START + Math.floor(Math.random() * 3);             // first overfilled vial: the 4th, 5th or 6th
    st.x = d3.range(N).map(i => Math.round(TARGET + (i >= st.drift ? SHIFT : 0) + SD * noise()));
    let s = 0;
    st.S = st.x.map(v => (s = Math.max(0, s + (v - TARGET - K))));
    st.alarm = st.S.findIndex(v => v >= H);
    st.shown = st.alarm >= 0 && st.alarm < START ? st.alarm + 1 : START;
    st.sel = null;
  }
  const ended = () => st.shown >= N || (st.alarm >= 0 && st.shown > st.alarm);
  const done = () => ended() && st.p >= 1;
  const stopped = () => done() && st.alarm >= 0;
  const current = () => (st.sel != null ? st.sel : st.shown - 1);

  function newBatch() {
    stopFill();
    makeBatch();
    picker.reset();
    CUSUM.fitBox(box, d3.range(N).map(readout));
    draw();
  }

  /* One click fills one vial: the liquid rises, its bar grows and
     the CUSUM steps on, together. A click during a fill completes it
     at once and starts the next vial. */
  function fillNext() {
    if (ended()) return;
    stopFill();
    st.shown += 1;
    st.sel = null;
    picker.reset();
    const ms = VIZ.dur(560);
    if (ms) st.p = 0;
    draw();
    if (!ms) return;
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / ms);
      st.p = d3.easeCubicOut(k);
      if (k < 1) { drawData(); drawSel(); st.raf = requestAnimationFrame(tick); }
      else { st.raf = 0; st.p = 1; draw(); }
    };
    st.raf = requestAnimationFrame(tick);
  }
  function stopFill() {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
    st.p = 1;
  }

  /* ---- layout, in pixels from the card width -------------------- */
  function layout(width) {
    const W = Math.max(300, width || 640), small = W < 520;
    const M = { l: small ? 34 : 46, r: small ? 52 : 86 };
    const step = (W - M.l - M.r) / N;
    const vw = Math.max(9, Math.min(26, step * (small ? 0.62 : 0.54)));   // vial body width
    const bh = vw * 1.36, capH = Math.max(3, vw * 0.3), neckH = Math.max(2, vw * 0.1);
    const capTop = Math.max(14, vw * 0.5 + 9);                           // room above for the nozzle
    const y0 = capTop + capH + neckH, beltY = y0 + bh;                   // y0: top of the glass body
    const yT = y0 + bh * 0.4;                                            // fill line, 3.0 mL
    const vsc = (yT - y0 - 1.5) / 0.5;                                   // px per mL in a vial: room for +0.5 mL
    const bT = beltY + 46, bB = bT + (small ? 84 : 96);
    const cT = bB + 46, cB = cT + (small ? 84 : 100);
    const Ht = cB + 28;
    L = { W, Ht, small, M, step, vw, bh, capH, neckH, capTop, y0, beltY, yT, vsc, bT, bB, cT, cB,
          x: i => M.l + (i + 0.5) * step,
          yb: d3.scaleLinear().domain([LO, HI]).range([bB, bT]).clamp(true),
          yc: d3.scaleLinear().domain([0, SMAX]).range([cB, cT]).clamp(true) };

    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', Ht).attr('viewBox', `0 0 ${W} ${Ht}`).classed('is-small', small);
    const root = svg.append('g');
    G = {};
    ['col', 'belt', 'vials', 'bars', 'barsRef', 'cus', 'cusRef', 'marks', 'sel', 'top', 'ticks']
      .forEach(k => { G[k] = root.append('g'); });

    // the belt: full width, with end drums and motion chevrons
    const by = beltY;
    G.belt.append('rect').attr('class', 'cusum-beltbar').attr('x', 6).attr('y', by).attr('width', W - 12).attr('height', 8).attr('rx', 4);
    G.belt.append('rect').attr('class', 'cusum-belt-hi').attr('x', 10).attr('y', by + 1).attr('width', W - 20).attr('height', 2).attr('rx', 1);
    for (let cx = 24; cx < W - 18; cx += 30) {
      G.belt.append('path').attr('class', 'cusum-chev').attr('d', `M${cx},${by + 2.6}l3.4,1.5l-3.4,1.5`);
    }
    [6, W - 6].forEach(cx => G.belt.append('circle').attr('class', 'cusum-drum').attr('cx', cx).attr('cy', by + 4).attr('r', 6));
    G.belt.append('line').attr('class', 'cusum-fillline').attr('x1', 14).attr('x2', W - 14).attr('y1', yT).attr('y2', yT);

    // row labels
    G.ticks.append('text').attr('class', 'cusum-label').attr('x', 0).attr('y', bT - 16).text('Fill volume (mL)');
    G.ticks.append('text').attr('class', 'cusum-label').attr('x', 0).attr('y', cT - 16).text('CUSUM (mL)');

    // fill row: axis, the 3.0 target and the 3.05 that the CUSUM uses
    G.barsRef.append('g').attr('class', 'viz-axis viz-axis--bare').attr('transform', `translate(${M.l},0)`)
      .call(d3.axisLeft(L.yb).tickValues([280, 300, 320, 340]).tickFormat(v => (v / 100).toFixed(1)).tickSize(0).tickPadding(8));
    refLine(G.barsRef, 'is-target', L.yb(TARGET));
    refLine(G.barsRef, 'is-k', L.yb(TARGET + K));
    labels(G.barsRef, [
      { y: L.yb(TARGET), cls: 'is-target', txt: small ? 'target' : 'target 3.0' },
      { y: L.yb(TARGET + K), cls: 'is-k', txt: small ? '+K' : '3.0 + K' }
    ]);

    // CUSUM row: axis, baseline and the decision interval H
    G.cusRef.append('line').attr('class', 'cusum-base').attr('x1', M.l).attr('x2', W - M.r).attr('y1', cB + 0.5).attr('y2', cB + 0.5);
    G.cusRef.append('g').attr('class', 'viz-axis viz-axis--bare').attr('transform', `translate(${M.l},0)`)
      .call(d3.axisLeft(L.yc).tickValues([0, 50, 100]).tickFormat(v => (v ? (v / 100).toFixed(1) : '0')).tickSize(0).tickPadding(8));
    refLine(G.cusRef, 'is-h', L.yc(H));
    labels(G.cusRef, [{ y: L.yc(H), cls: 'is-h', txt: small ? 'H' : 'H = 0.5' }]);

    // vial numbers
    G.ticks.append('text').attr('class', 'cusum-tick is-unit').attr('x', M.l - 8).attr('y', cB + 19).text('vial');
    G.ticks.selectAll('text.cusum-vtick').data(d3.range(N)).join('text')
      .attr('class', 'cusum-tick cusum-vtick').attr('x', L.x).attr('y', cB + 19).text(i => i + 1);
  }
  function refLine(g, cls, y) {
    g.append('line').attr('class', 'cusum-refline ' + cls)
      .attr('x1', L.M.l).attr('x2', L.W - L.M.r).attr('y1', y).attr('y2', y);
  }
  function labels(g, list) {
    CUSUM.spread(list, L.small ? 14 : 16).forEach(d => g.append('text')
      .attr('class', 'cusum-ref ' + d.cls).attr('x', L.W - L.M.r + 8).attr('y', d.y).text(d.txt));
  }

  /* ---- the marks that change with each vial --------------------- */
  // a glass-shaped cup: a rectangle with rounded bottom corners
  function cup(cx, top, bot, hw, r) {
    const h = bot - top;
    if (h <= 0.3) return null;
    r = Math.max(0, Math.min(r, h, hw));
    return `M${cx - hw},${top}H${cx + hw}V${bot - r}A${r},${r} 0 0 1 ${cx + hw - r},${bot}` +
           `H${cx - hw + r}A${r},${r} 0 0 1 ${cx - hw},${bot - r}Z`;
  }

  function drawVial(g, i, f) {
    const { vw, bh, capH, neckH, y0, beltY, yT, vsc } = L;
    const cx = L.x(i), hw = vw / 2, r = Math.min(vw * 0.28, 7), v = st.x[i];
    const bot = beltY - 1.2, inner = hw - 1.2;
    const surf = yT - (v - TARGET) / 100 * vsc;            // the settled liquid surface
    const now = bot - f * (bot - surf);                    // rises while the vial fills
    const overH = v > TARGET && now < yT ? yT - now : 0;   // amber: above the 3.0 line
    const capW = vw * 0.62, capY = y0 - neckH - capH, capped = f >= 1 ? null : 'none';
    g.select('.cusum-shadow').attr('cx', cx).attr('cy', beltY + 0.5).attr('rx', hw + 2).attr('ry', 2.2);
    g.select('.cusum-neck').attr('x', cx - vw * 0.18).attr('y', y0 - neckH - 0.5).attr('width', vw * 0.36).attr('height', neckH + 1.5);
    g.select('.cusum-body').attr('x', cx - hw).attr('y', y0).attr('width', vw).attr('height', bh).attr('rx', r);
    g.select('.cusum-liquid').attr('d', cup(cx, Math.max(now, v > TARGET ? yT : now), bot, inner, r - 1.2));
    g.select('.cusum-over').attr('x', cx - inner).attr('y', yT - overH).attr('width', 2 * inner).attr('height', overH);
    g.select('.cusum-gloss').attr('x', cx - hw + vw * 0.16).attr('y', y0 + 3)
      .attr('width', Math.max(1.4, vw * 0.09)).attr('height', Math.max(0, bh - 8)).attr('rx', 1);
    // the cap goes on once the vial is full
    g.select('.cusum-cap').attr('x', cx - capW / 2).attr('y', capY).attr('width', capW).attr('height', capH)
      .attr('rx', Math.min(2.5, capH / 2)).style('display', capped);
    g.select('.cusum-cap-hi').attr('x', cx - capW / 2 + 1.2).attr('y', capY + 0.8).attr('width', capW * 0.38)
      .attr('height', Math.max(1, capH * 0.32)).attr('rx', 0.8).style('display', capped);
  }

  function drawData() {
    const { x, yb, yc, vw, step } = L;
    const n = st.shown, last = n - 1, p = st.p;
    const grow = i => (i === last ? p : 1);
    const fillAt = i => TARGET + grow(i) * (st.x[i] - TARGET);

    G.vials.selectAll('g.cusum-vial').data(d3.range(n), i => i)
      .join(enter => {
        const g = enter.append('g').attr('class', 'cusum-vial');
        ['ellipse.cusum-shadow', 'rect.cusum-neck', 'rect.cusum-body', 'path.cusum-liquid', 'rect.cusum-over',
         'rect.cusum-gloss', 'rect.cusum-cap', 'rect.cusum-cap-hi'].forEach(s => {
          const [tag, cls] = s.split('.');
          g.append(tag).attr('class', cls);
        });
        return g;
      })
      .each(function (i) { drawVial(d3.select(this), i, grow(i)); });

    const bw = Math.min(step * 0.5, 22), y3 = yb(TARGET);
    G.bars.selectAll('rect').data(d3.range(n), i => i).join('rect')
      .attr('class', i => 'cusum-bar ' + (st.x[i] > TARGET ? 'is-over' : 'is-under'))
      .attr('x', i => x(i) - bw / 2).attr('width', bw).attr('rx', Math.min(3, bw / 4))
      .attr('y', i => Math.min(yb(fillAt(i)), y3))
      .attr('height', i => Math.max(1, Math.abs(yb(fillAt(i)) - y3)));

    // the CUSUM path; while a vial fills, its segment is drawn part of the way
    const pts = d3.range(n).map(i => {
      if (i === last && p < 1 && i > 0) {
        const ax = x(i - 1), ay = yc(st.S[i - 1]);
        return [ax + p * (x(i) - ax), ay + p * (yc(st.S[i]) - ay)];
      }
      return [x(i), yc(st.S[i])];
    });
    G.cus.selectAll('path.cusum-S-area').data([pts]).join('path').attr('class', 'cusum-S-area')
      .attr('d', d3.area().y0(L.cB));
    G.cus.selectAll('path.cusum-S').data([pts]).join('path').attr('class', 'cusum-S').attr('d', d3.line());
    G.cus.selectAll('circle').data(d3.range(n).filter(i => i !== last || p >= 1), i => i).join('circle')
      .attr('class', i => 'cusum-pt' + (st.S[i] >= H ? ' is-alarm' : ''))
      .attr('cx', x).attr('cy', i => yc(st.S[i])).attr('r', L.small ? 2.6 : 3);

    G.marks.selectAll('*').remove();
    G.top.selectAll('*').remove();
    if (stopped()) {
      const a = st.alarm, w = Math.max(30, Math.min(48, vw * 2)), h = w * 0.44;
      G.marks.append('text').attr('class', 'cusum-annot').attr('x', x(a)).attr('y', yc(st.S[a]) - 11).text('signal');
      const stamp = G.top.append('g').attr('class', 'cusum-stamp')
        .attr('transform', `translate(${x(a)},${L.y0 + L.bh * 0.45}) rotate(-12)`);
      stamp.append('rect').attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h).attr('rx', 4);
      stamp.append('text').attr('y', 0.5).style('font-size', (h * 0.56).toFixed(1) + 'px').text('STOP');
    }
    if (done()) {                                          // reveal where the overfill began
      const xd = x(st.drift) - step / 2;
      G.marks.append('line').attr('class', 'cusum-drift').attr('x1', xd).attr('x2', xd).attr('y1', L.bT - 4).attr('y2', L.cB);
      G.marks.append('text').attr('class', 'cusum-drift-label').attr('x', xd + 5).attr('y', L.bT + 8).text('overfill starts');
    }
    if (p < 1) {                                           // the filler nozzle and its stream
      const cx = x(last), headW = Math.max(12, vw * 0.9), tip = L.y0 - L.neckH - 3;
      const bot = L.beltY - 1.2, surf = L.yT - (st.x[last] - TARGET) / 100 * L.vsc;
      const level = bot - p * (bot - surf), sw = Math.max(1.4, vw * 0.11);
      G.marks.append('rect').attr('class', 'cusum-nozzle').attr('x', cx - headW / 2).attr('y', tip - 10)
        .attr('width', headW).attr('height', 6).attr('rx', 2);
      G.marks.append('rect').attr('class', 'cusum-nozzle').attr('x', cx - sw).attr('y', tip - 5)
        .attr('width', 2 * sw).attr('height', 5).attr('rx', 1);
      G.marks.append('rect').attr('class', 'cusum-stream').attr('x', cx - sw / 2).attr('y', tip)
        .attr('width', sw).attr('height', Math.max(0, level - tip));
    }
  }

  /* ---- the chosen vial: band, ring, point, number ---------------- */
  function drawSel() {
    const n = st.shown;
    if (!n) return;
    const c = current(), { x, yc, vw } = L;
    const bandW = Math.min(L.step - 2, vw + 16), sig = st.S[c] >= H;
    const settledPt = c !== n - 1 || st.p >= 1;
    G.col.selectAll('rect').data([c]).join('rect').attr('class', 'cusum-col')
      .attr('x', x(c) - bandW / 2).attr('width', bandW)
      .attr('y', L.capTop - 6).attr('height', L.cB + 4 - (L.capTop - 6)).attr('rx', 7);
    G.sel.selectAll('rect.cusum-ring').data([c]).join('rect')
      .attr('class', 'cusum-ring' + (stopped() && c === st.alarm ? ' is-alarm' : ''))
      .attr('x', x(c) - vw / 2 - 3).attr('y', L.capTop - 3)
      .attr('width', vw + 6).attr('height', L.beltY - L.capTop + 1).attr('rx', 5);
    G.sel.selectAll('circle.cusum-halo').data(settledPt ? [c] : []).join('circle')
      .attr('class', 'cusum-halo' + (sig ? ' is-alarm' : '')).attr('cx', x(c)).attr('cy', yc(st.S[c])).attr('r', 8);
    G.sel.selectAll('circle.cusum-pt').data(settledPt ? [c] : []).join('circle')
      .attr('class', 'cusum-pt' + (sig ? ' is-alarm' : '')).attr('cx', x(c)).attr('cy', yc(st.S[c])).attr('r', 4.4);
    // on a narrow phone only every other vial number fits; the chosen one always shows
    const thin = L.step < 19;
    G.ticks.selectAll('text.cusum-vtick').classed('is-sel', i => i === c).classed('is-hidden', i => thin && i !== c && i % 2 === 1);
    svg.attr('aria-valuemax', n).attr('aria-valuenow', c + 1)
      .attr('aria-valuetext', `Vial ${c + 1}: fill ${mL(st.x[c])} mL, CUSUM ${mL(st.S[c])}${sig ? ', signal' : ''}`);
  }

  /* ---- words ----------------------------------------------------- */
  function readout(i) {
    const n = i + 1, v = st.x[i], prev = i ? st.S[i - 1] : 0, s = st.S[i];
    const sig = s >= H, sub = k => `<sub>${k}</sub>`;
    return `<div class="r"><span class="cusum-head">Vial ${n}</span><span class="cusum-dim"> \u00b7 </span>fill x${sub(n)} = ${mL(v)} mL</div>` +
      `<div class="r cusum-dim">S${sub(n)} = max(0, S${sub(n - 1)} + (x${sub(n)} \u2212 3.05))</div>` +
      `<div class="r">   = max(0, ${nb(`${mL(prev)} + (${mL(v)} \u2212 3.05))`)}</div>` +
      `<div class="r">   = max(0, ${nb(`${mL(prev + v - TARGET - K)})`)} =\u00a0<b${sig ? ' class="is-alarm"' : ''}>${mL(s)}</b>` +
      (sig ? ' <span class="is-alarm">\u2265 H, signal</span>' : ' &lt; H') + '</div>';
  }

  function say() {
    box.html(st.shown ? readout(current()) : '');
    if (!done()) card.setStatus('Running', 'ok');
    else card.setStatus(st.alarm >= 0 ? 'Line stopped' : 'Batch done', st.alarm >= 0 ? 'alarm' : 'idle');
    hint.html(!done() ? 'Hover over or tap a vial to see its working.'
      : st.alarm >= 0 ? `<b>Signal at vial ${st.alarm + 1}.</b> The overfill began at vial ${st.drift + 1}.`
      : `<b>No signal in ${N} vials.</b> The overfill began at vial ${st.drift + 1}.`);
    nextBtn.property('disabled', ended()).attr('class', 'viz-btn ' + (done() ? 'viz-btn--ghost' : 'viz-btn--primary'));
    newBtn.attr('class', 'viz-btn ' + (done() ? 'viz-btn--primary' : 'viz-btn--ghost'));
  }

  function draw() {
    if (!L) return;
    drawData();
    drawSel();
    say();
  }

  /* ---- start ------------------------------------------------------ */
  const picker = CUSUM.pick(svg, {
    count: () => st.shown,
    at: px => Math.max(0, Math.min(st.shown - 1, Math.floor((px - L.M.l) / L.step))),
    current,
    onPick(i) { st.sel = i; drawSel(); say(); }
  });
  makeBatch();
  CUSUM.onWidth(chart.node(), w => {
    layout(w);
    CUSUM.fitBox(box, d3.range(N).map(readout));
    draw();
  });
})();
