/* ============================================================
   CUSUM figure 2: the epidemic threshold (#viz-cusum-threshold)
   surveillance::algo.cusum with its defaults: k = 1.04, h = 2.26,
   trans = "standard", reset = FALSE, monitoring weeks 14 to 40.
       m   = mean of weeks 1 to 13 = 104/13 = 8
       z_t = (x_t - m)/sqrt(m)
       S_t = max(0, S_(t-1) + (z_t - k)),          signal when S_t >= h
       U_t = ceiling(m + sqrt(m)(h + k - S_(t-1))) (the package's upperbound)
   so a week signals exactly when x_t >= U_t. The counts are
   simulated, and chosen so that every sum shown in the readout
   adds up at two decimals.
   ============================================================ */

(function () {
  const MOUNT = '#viz-cusum-threshold';
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

  /* ---- the method ----------------------------------------------- */
  const K = 1.04, H = 2.26, B = 13;                  // weeks 1 to B come before monitoring
  const X = [9, 6, 11, 7, 10, 12, 4, 8, 11, 5, 9, 4, 8,
             6, 12, 9, 9, 11, 7, 8, 10, 12, 8, 14, 16, 12, 13, 10, 8, 5, 10, 5, 6, 4, 5, 6, 7, 5, 7, 8];
  const N = X.length;
  const refSum = d3.sum(X.slice(0, B)), m = refSum / B, sm = Math.sqrt(m);
  const z = X.map(v => (v - m) / sm);
  const prev = [], S = [], U = [];
  let s = 0;
  for (let i = 0; i < N; i++) {
    if (i < B) { prev.push(null); S.push(null); U.push(null); continue; }
    prev.push(s);
    U.push(Math.max(0, Math.ceil(m + sm * (H + K - s))));
    s = Math.max(0, s + (z[i] - K));
    S.push(s);
  }
  const signal = i => i >= B && S[i] >= H;
  const alarms = d3.range(N).filter(signal);
  const FIRST = alarms.length ? alarms[0] : N - 1;
  const f2 = v => CUSUM.num(v, 2), M0 = CUSUM.num(m, 0);
  const nb = t => t.replace(/ /g, '\u00a0');            // keep a piece of a formula on one line

  /* ---- the card --------------------------------------------------- */
  el.classList.add('cusum-card');
  const card = VIZ.card(MOUNT, { title: 'A threshold that falls as evidence builds', status: ' ' });
  const box = card.body.append('div').attr('class', 'cusum-model').attr('aria-live', 'polite');
  const chart = card.body.append('div').attr('class', 'cusum-chart');
  const foot = card.body.append('div').attr('class', 'cusum-foot');
  foot.append('p').attr('class', 'cusum-hint').text('Hover over or tap a week to see its working.');
  const svg = chart.append('svg').attr('role', 'slider').attr('aria-label', 'Week')
    .attr('aria-valuemin', 1).attr('aria-valuemax', N);
  card.setStatus(alarms.length ? `Signal in weeks ${alarms[0] + 1} to ${alarms[alarms.length - 1] + 1}` : 'No signal',
                 alarms.length ? 'alarm' : 'ok');
  const st = { sel: null };
  let L = null, G = null;
  const current = () => (st.sel != null ? st.sel : FIRST);

  /* ---- layout, in pixels from the card width ---------------------- */
  function layout(width) {
    const W = Math.max(300, width || 640), small = W < 520;
    const M = { l: small ? 30 : 40, r: small ? 58 : 86 };
    const step = (W - M.l - M.r) / N;
    const A0 = 30, A1 = A0 + (small ? 132 : 156);       // weekly cases
    const B0 = A1 + 48, B1 = B0 + (small ? 76 : 92);    // CUSUM
    const Ht = B1 + 28;
    const x = i => M.l + (i + 0.5) * step;
    const yA = d3.scaleLinear().domain([0, 20]).range([A1, A0]);
    const yB = d3.scaleLinear().domain([0, Math.max(H * 1.6, d3.max(S) * 1.15)]).range([B1, B0]);
    L = { W, Ht, small, M, step, A0, A1, B0, B1, x, yA, yB };

    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', Ht).attr('viewBox', `0 0 ${W} ${Ht}`).classed('is-small', small);
    const root = svg.append('g');
    G = {};
    ['band', 'col', 'data', 'ref', 'sel', 'ticks'].forEach(k => { G[k] = root.append('g'); });

    // the reference weeks, shaded in both panels
    const xr = x(B - 1) + step / 2;
    [[A0 - 8, A1], [B0 - 8, B1]].forEach(([t, b]) => G.band.append('rect').attr('class', 'cusum-refband')
      .attr('x', M.l - 3).attr('width', xr - M.l + 3).attr('y', t).attr('height', b - t).attr('rx', 6));
    G.band.append('text').attr('class', 'cusum-note').attr('x', (M.l + xr) / 2).attr('y', A0 + 6)
      .text(small ? 'reference' : 'reference weeks');

    // row labels
    G.ticks.append('text').attr('class', 'cusum-label').attr('x', 0).attr('y', A0 - 16).text('Weekly cases');
    CUSUM.subLabel(G.ticks.append('text').attr('class', 'cusum-label').attr('x', 0).attr('y', B0 - 16), 'CUSUM S', 't');

    // axes and baselines
    [[A1, yA, small ? [0, 10, 20] : [0, 5, 10, 15, 20]], [B1, yB, [0, 2, 4]]].forEach(([b, y, ticks]) => {
      G.ref.append('line').attr('class', 'cusum-base').attr('x1', M.l).attr('x2', W - M.r).attr('y1', b + 0.5).attr('y2', b + 0.5);
      G.ref.append('g').attr('class', 'viz-axis viz-axis--bare').attr('transform', `translate(${M.l},0)`)
        .call(d3.axisLeft(y).tickValues(ticks).tickFormat(d3.format('d')).tickSize(0).tickPadding(8));
    });

    // weekly bars: teal for the reference weeks (the baseline whose mean is m), red where the week signals
    const bw = Math.max(2, step * 0.72);
    G.data.selectAll('rect.cusum-wk').data(d3.range(N)).join('rect')
      .attr('class', i => 'cusum-wk' + (i < B ? ' is-ref' : signal(i) ? ' is-alarm' : ''))
      .attr('x', i => x(i) - bw / 2).attr('width', bw).attr('rx', Math.min(2, bw / 3))
      .attr('y', i => yA(X[i])).attr('height', i => A1 - yA(X[i]));

    // expected count m and the case threshold U_t, a step for each week
    G.ref.append('line').attr('class', 'cusum-refline is-m').attr('x1', M.l).attr('x2', W - M.r).attr('y1', yA(m)).attr('y2', yA(m));
    const upts = [[x(B) - step / 2, yA(U[B])]].concat(d3.range(B, N).map(i => [x(i), yA(U[i])]),
      [[x(N - 1) + step / 2, yA(U[N - 1])]]);
    G.ref.append('path').attr('class', 'cusum-U').attr('d', d3.line().curve(d3.curveStep)(upts));

    // the CUSUM, its decision interval h, and the first signal
    const pts = d3.range(B, N).map(i => [x(i), yB(S[i])]);
    G.data.append('path').attr('class', 'cusum-S-area').attr('d', d3.area().y0(B1)(pts));
    G.data.append('path').attr('class', 'cusum-S').attr('d', d3.line()(pts));
    G.data.selectAll('circle').data(d3.range(B, N)).join('circle')
      .attr('class', i => 'cusum-pt' + (signal(i) ? ' is-alarm' : ''))
      .attr('cx', x).attr('cy', i => yB(S[i])).attr('r', small ? 1.9 : 2.5);
    G.ref.append('line').attr('class', 'cusum-refline is-h').attr('x1', M.l).attr('x2', W - M.r).attr('y1', yB(H)).attr('y2', yB(H));
    if (alarms.length) {
      // above and to the left of the point, clear of the line climbing away to the right
      G.ref.append('text').attr('class', 'cusum-annot is-left').attr('x', x(FIRST) - 7).attr('y', yB(S[FIRST]) - 9).text('signal');
    }

    // labels at the free end of each line
    const ends = CUSUM.spread([
      { y: yA(m), cls: 'is-m', txt: `m = ${M0}` },
      { y: yA(U[N - 1]), cls: 'is-U', txt: 'U', sub: 't', more: small ? '' : ' (cases)' }
    ], 16).concat([{ y: yB(H), cls: 'is-h', txt: `h = ${H}` }]);
    ends.forEach(d => {
      const t = G.ref.append('text').attr('class', 'cusum-ref ' + d.cls).attr('x', W - M.r + 8).attr('y', d.y);
      if (d.sub) CUSUM.subLabel(t, d.txt, d.sub, d.more); else t.text(d.txt);
    });

    // week numbers
    G.ticks.append('text').attr('class', 'cusum-tick is-unit').attr('x', M.l - 8).attr('y', B1 + 19).text('week');
    const wk = small ? [1, 10, 20, 30, 40] : [1, 5, 10, 15, 20, 25, 30, 35, 40];
    G.ticks.selectAll('text.cusum-wtick').data(wk).join('text').attr('class', 'cusum-tick cusum-wtick')
      .attr('x', w => x(w - 1)).attr('y', B1 + 19).text(w => w);
    G.ticks.append('text').attr('class', 'cusum-tick is-sel').attr('y', B1 + 19);
  }

  /* ---- the chosen week ------------------------------------------- */
  function drawSel() {
    const c = current(), { x, yA, yB, step, A0, A1, B1 } = L;
    const w = Math.max(step * 0.96, 7), bw = Math.max(2, step * 0.72), mon = c >= B;
    G.col.selectAll('rect').data([c]).join('rect').attr('class', 'cusum-col')
      .attr('x', x(c) - w / 2).attr('width', w).attr('y', A0 - 6).attr('height', B1 + 3 - (A0 - 6)).attr('rx', 4);
    G.sel.selectAll('rect').data([c]).join('rect').attr('class', 'cusum-wk-sel')
      .attr('x', x(c) - bw / 2 - 1).attr('width', bw + 2).attr('y', yA(X[c]) - 1).attr('height', A1 - yA(X[c]) + 1)
      .attr('rx', Math.min(2.5, bw / 3));
    G.sel.selectAll('circle.cusum-Udot').data(mon ? [c] : []).join('circle').attr('class', 'cusum-Udot')
      .attr('cx', x(c)).attr('cy', yA(U[c])).attr('r', 3.6);
    G.sel.selectAll('circle.cusum-halo').data(mon ? [c] : []).join('circle')
      .attr('class', 'cusum-halo' + (signal(c) ? ' is-alarm' : '')).attr('cx', x(c)).attr('cy', yB(S[c])).attr('r', 8);
    G.sel.selectAll('circle.cusum-pt').data(mon ? [c] : []).join('circle')
      .attr('class', 'cusum-pt' + (signal(c) ? ' is-alarm' : '')).attr('cx', x(c)).attr('cy', yB(S[c])).attr('r', 4.2);
    // the chosen week's number on the axis, hiding any tick it would sit on
    G.ticks.select('text.is-sel').attr('x', x(c)).text(c + 1);
    G.ticks.selectAll('text.cusum-wtick').classed('is-hidden', w2 => Math.abs(x(w2 - 1) - x(c)) < 20);
    svg.attr('aria-valuenow', c + 1).attr('aria-valuetext', mon
      ? `Week ${c + 1}: ${X[c]} cases, threshold ${U[c]}, CUSUM ${f2(S[c])}, ${signal(c) ? 'signal' : 'no signal'}`
      : `Week ${c + 1}: ${X[c]} cases, a reference week`);
    box.html(readout(c));
  }

  /* ---- the working for one week --------------------------------- */
  function readout(i) {
    const n = i + 1;
    const head = `<span class="cusum-head">Week ${n}</span><span class="cusum-dim"> \u00b7 </span>${X[i]} cases`;
    if (i < B) {
      return `<div class="r">${head}<span class="cusum-dim"> \u00b7 a reference week</span></div>` +
        `<div class="r">m = ${nb(`(${X[0]} + ${X[1]} + \u2026 + ${X[B - 1]})/${B}`)} = ${refSum}/${B} = <b>${M0}</b></div>` +
        `<div class="r cusum-dim">The CUSUM starts at week ${B + 1}, with S<sub>${B}</sub> = 0.</div>`;
    }
    const p = prev[i], sig = signal(i);
    // the bracket before rounding up, worked from the numbers on screen
    const inside = m + sm * (H + K - Number(p.toFixed(2)));
    const mid = Math.ceil(Number(inside.toFixed(2))) === U[i] ? ` =\u00a0\u2308${f2(inside)}\u2309` : '';
    return `<div class="r">${head}<span class="cusum-dim"> \u00b7 S<sub>${n - 1}</sub> = ${f2(p)}</span></div>` +
      `<div class="r">z<sub>${n}</sub> = ${nb(`(${X[i]} \u2212 ${M0})/\u221a${M0}`)} = ${f2(z[i])}</div>` +
      `<div class="r">S<sub>${n}</sub> = ${nb(`max(0, ${f2(p)} + (${f2(z[i])} \u2212 ${K}))`)} =\u00a0<b${sig ? ' class="is-alarm"' : ''}>${f2(S[i])}</b></div>` +
      `<div class="r">U<sub>${n}</sub> = ${nb(`\u2308${M0} + \u221a${M0} (${H} + ${K} \u2212 ${f2(p)})\u2309`)}${mid} =\u00a0<b class="is-U">${U[i]}</b></div>` +
      `<div class="r">` + (sig
        ? `<span class="is-alarm">${X[i]} \u2265 ${U[i]}, so S<sub>${n}</sub> \u2265 h: signal</span>`
        : `<span class="is-ok">${X[i]} &lt; ${U[i]}, so S<sub>${n}</sub> &lt; h: no signal</span>`) + '</div>';
  }

  /* ---- start ------------------------------------------------------ */
  CUSUM.pick(svg, {
    count: () => N,
    at: px => Math.max(0, Math.min(N - 1, Math.floor((px - L.M.l) / L.step))),
    current,
    onPick(i) { st.sel = i; drawSel(); }
  });
  CUSUM.onWidth(chart.node(), w => {
    layout(w);
    CUSUM.fitBox(box, d3.range(N).map(readout));
    drawSel();
  });
})();
