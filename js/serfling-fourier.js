/* ============================================================
   Figure 1 — A season built from waves
   Four coefficients, the γ and δ of two harmonics. Mixing cos and
   sin of the same harmonic slides its peak to any week; adding the
   second harmonic gives two peaks, or one that rises faster than
   it falls. The readout converts each pair to amplitude and peak.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serf-fourier';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3   === 'undefined') missing.push('d3');
  if (typeof VIZ  === 'undefined') missing.push('viz-kit.js');
  if (typeof SERF === 'undefined') missing.push('serfling-core.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  const L = 52, STEP = 0.5, LIM = 3;
  const state = { g1: -2, d1: 0, g2: 0, d2: 0 };
  const PARAMS = [
    ['g1', 'γ₁', 'cos weight, harmonic 1'],
    ['d1', 'δ₁', 'sin weight, harmonic 1'],
    ['g2', 'γ₂', 'cos weight, harmonic 2'],
    ['d2', 'δ₂', 'sin weight, harmonic 2']
  ];

  const h1 = t => state.g1 * Math.cos(2 * Math.PI * t / L) + state.d1 * Math.sin(2 * Math.PI * t / L);
  const h2 = t => state.g2 * Math.cos(4 * Math.PI * t / L) + state.d2 * Math.sin(4 * Math.PI * t / L);
  const sum = t => h1(t) + h2(t);

  const handle = VIZ.card(MOUNT, { title: 'A season built from two waves', status: '\u2026' });
  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const chart    = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'one harmonic, two ways of writing it',
    lines: [
      'γ cos(2πit/52) + δ sin(2πit/52)  =  A cos(2πit/52 − θ)',
      'A = √(γ² + δ²)     θ = atan2(δ, γ)     peak at t = θ · 52 / (2πi)'
    ],
    hint: 'raise δ₁ and watch the peak slide; then give harmonic 2 some weight'
  });

  const syncers = PARAMS.map(([key, sym, label]) => {
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text(sym);
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `decrease ${label}`).text('−');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `increase ${label}`).text('+');
    row.append('span').attr('class', 'd').text(label);
    dec.on('click', () => { state[key] = Math.max(-LIM, state[key] - STEP); render(); });
    inc.on('click', () => { state[key] = Math.min(LIM, state[key] + STEP); render(); });
    return () => {
      val.text(state[key].toFixed(1));
      dec.property('disabled', state[key] <= -LIM);
      inc.property('disabled', state[key] >= LIM);
    };
  });

  /* Local maxima of a periodic curve, on a fine grid with wrap-around. */
  function peaksOf(f) {
    const dt = 0.05, n = Math.round(L / dt);
    const v = d3.range(n).map(k => f(k * dt));
    const range = d3.max(v) - d3.min(v);
    if (range < 1e-9) return [];
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = v[(k - 1 + n) % n], b = v[k], c = v[(k + 1) % n];
      if (b > a && b >= c) out.push(k * dt);
    }
    return out;
  }

  function troughOf(f) {
    const dt = 0.05, n = Math.round(L / dt);
    let best = 0, bv = Infinity;
    for (let k = 0; k < n; k++) { const v = f(k * dt); if (v < bv) { bv = v; best = k * dt; } }
    return best;
  }

  function render() {
    syncers.forEach(s => s());

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 200,
      margin: { top: 22, right: 96, bottom: 30, left: 34 },
      desc: 'Two harmonic waves and their sum over one year.'
    });

    const ts = d3.range(0, L + 0.001, 0.25);
    const vmax = Math.max(3, d3.max(ts, t => Math.max(Math.abs(h1(t)), Math.abs(h2(t)), Math.abs(sum(t))))) * 1.12;
    const x = d3.scaleLinear().domain([0, L]).range([0, p.w]);
    const y = d3.scaleLinear().domain([-vmax, vmax]).range([p.h, 0]);
    const line = f => d3.line().x(t => x(t)).y(t => y(f(t)))(ts);

    p.g.append('line')
      .attr('x1', 0).attr('x2', p.w).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', VIZ.C.rule).attr('stroke-width', 1);

    const A2 = Math.hypot(state.g2, state.d2);
    const labels = [];

    // With harmonic 2 off the sum IS harmonic 1; drawing both would hide
    // one line under the other and label something the reader cannot see.
    if (A2 > 0) {
      p.g.append('path').attr('d', line(h1))
        .attr('fill', 'none').attr('stroke', VIZ.C.muted).attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4 3');
      labels.push({ y: y(h1(L)), text: 'harmonic 1', color: VIZ.C.muted });

      p.g.append('path').attr('d', line(h2))
        .attr('fill', 'none').attr('stroke', VIZ.C.amber).attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4 3');
      labels.push({ y: y(h2(L)), text: 'harmonic 2', color: VIZ.C.amber });
    }

    p.g.append('path').attr('d', line(sum))
      .attr('fill', 'none').attr('stroke', VIZ.C.blue).attr('stroke-width', 2.6);
    labels.push({ y: y(sum(L)), text: A2 > 0 ? 'sum' : 'harmonic 1', color: VIZ.C.blue, bold: true });

    // Direct labels at the right edge, nudged apart so they never overlap.
    labels.sort((a, b) => a.y - b.y);
    for (let i = 1; i < labels.length; i++)
      if (labels[i].y - labels[i - 1].y < 15) labels[i].y = labels[i - 1].y + 15;
    labels.forEach(l => {
      p.g.append('text')
        .attr('class', 'viz-reflabel')
        .attr('x', p.w + 10).attr('y', l.y)
        .attr('fill', l.color)
        .style('font-weight', l.bold ? 700 : 600)
        .text(l.text);
    });

    const pk = peaksOf(sum);
    pk.forEach(t => {
      p.g.append('circle')
        .attr('cx', x(t)).attr('cy', y(sum(t))).attr('r', 4.5)
        .attr('fill', VIZ.C.blue).attr('stroke', '#fff').attr('stroke-width', 1.5);
      p.g.append('text')
        .attr('class', 'viz-annot')
        .attr('x', x(t)).attr('y', y(sum(t)) - 11)
        .attr('fill', VIZ.C.ink)
        .text(`week ${t.toFixed(0)}`);
    });

    VIZ.axisY(p, y, 4);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x).tickValues([0, 13, 26, 39, 52]).tickSize(0).tickPadding(9));

    /* ---- readout ---- */
    const f2 = d3.format('.2f'), f1 = d3.format('.1f');
    // A negative base needs brackets: -2.0² reads as -(2²), not (-2)².
    const sq = v => (v < 0 ? `(${f1(v)})` : f1(v));
    const ap1 = SERF.amplitudePhase(state.g1, state.d1, 1, L);
    const ap2 = SERF.amplitudePhase(state.g2, state.d2, 2, L);

    const lineH1 = ap1.A === 0
      ? 'harmonic 1: off'
      : `harmonic 1: A₁ = √(${sq(state.g1)}² + ${sq(state.d1)}²) = <b>${f2(ap1.A)}</b>, ` +
        `θ₁ = ${f2(ap1.theta)} → peak at week <b>${f1(ap1.peaks[0])}</b>`;
    const lineH2 = A2 === 0
      ? 'harmonic 2: off'
      : `harmonic 2: A₂ = <b>${f2(ap2.A)}</b>, θ₂ = ${f2(ap2.theta)} → peaks at weeks ` +
        `<b>${f1(ap2.peaks[0])}</b> and <b>${f1(ap2.peaks[1])}</b>, 26 weeks apart`;

    let lineSum;
    if (pk.length === 0) {
      lineSum = 'the sum is flat — no seasonality at all';
    } else if (pk.length === 1) {
      const tr = troughOf(sum);
      const rise = ((pk[0] - tr) % L + L) % L;
      lineSum = `the sum: <b>one peak</b>, at week ${f1(pk[0])} — rises for ${rise.toFixed(0)} weeks, ` +
                `falls for ${(L - rise).toFixed(0)}` +
                (Math.abs(rise - 26) >= 2 ? ' — <b>asymmetric</b>' : '');
    } else {
      lineSum = `the sum: <b>${pk.length} peaks</b>, at weeks ${pk.map(v => f1(v)).join(' and ')}`;
    }

    handle.setStatus(pk.length === 0 ? 'Flat' : `${pk.length} peak${pk.length > 1 ? 's' : ''}`, 'ok');
    readout.html(lineH1 + '<br>' + lineH2 + '<br>' + lineSum);
  }

  render();
})();
