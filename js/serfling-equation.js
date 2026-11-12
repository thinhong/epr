/* ============================================================
   The Serfling equation, one parameter at a time
   E(Y_t) = β0 + β1 t + Σ [γi cos(2πit/52) + δi sin(2πit/52)]
   Six sliders, three years of weekly time. The faint line is
   where the reader started, so every change shows against it.
   The starting values are the true baseline of the simulated
   series used later in the chapter.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serfl-equation';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3   === 'undefined') missing.push('d3');
  if (typeof VIZ  === 'undefined') missing.push('viz-kit.js');
  if (typeof SERF === 'undefined') missing.push('serfling-core.js');
  if (missing.length || (typeof VIZ !== 'undefined' && !VIZ.slider)) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      (missing.length ? missing.join('</b>, <b>') : 'VIZ.slider (update viz-kit.js)') +
      '</b>. Check that every script is listed at the bottom of the chapter, in order, ' +
      'and that the .js files are the current versions.</div>';
    return;
  }

  const L = 52, YEARS = 3, TMAX = L * YEARS;
  const START = { b0: 120, b1: 0.04, g1: -14, d1: 0, g2: 0, d2: 0 };
  const state = Object.assign({}, START);
  let last = null;                                  // the parameter moved most recently

  const PARAMS = [
    { key: 'b0', sym: 'β₀', min: 80,    max: 160,  step: 1,    desc: 'intercept: the level at t = 0' },
    { key: 'b1', sym: 'β₁', min: -0.1,  max: 0.1,  step: 0.01, desc: 'trend: change per week' },
    { key: 'g1', sym: 'γ₁', min: -25,   max: 25,   step: 1,    desc: 'cosine weight, yearly wave' },
    { key: 'd1', sym: 'δ₁', min: -25,   max: 25,   step: 1,    desc: 'sine weight, yearly wave' },
    { key: 'g2', sym: 'γ₂', min: -12,   max: 12,   step: 1,    desc: 'cosine weight, 26-week wave' },
    { key: 'd2', sym: 'δ₂', min: -12,   max: 12,   step: 1,    desc: 'sine weight, 26-week wave' }
  ];

  const trendOf  = (s, t) => s.b0 + s.b1 * t;
  const seasonOf = (s, t) => {
    const a = 2 * Math.PI * t / L;
    return s.g1 * Math.cos(a) + s.d1 * Math.sin(a) + s.g2 * Math.cos(2 * a) + s.d2 * Math.sin(2 * a);
  };
  const ey = (s, t) => trendOf(s, t) + seasonOf(s, t);

  const handle   = VIZ.card(MOUNT, { title: 'The Serfling equation, one parameter at a time', status: '…' });
  const paramBar = handle.body.append('div').attr('class', 'viz-params viz-params--sliders');
  const chart    = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');
  const box      = VIZ.formula(handle.body, { title: 'the curve on the chart', lines: [] });
  const live     = box.append('div');
  box.append('div').attr('class', 'viz-formula-hint')
    .text('move one slider at a time; the faint line is where you started');

  const sliders = {};
  PARAMS.forEach(p => {
    sliders[p.key] = VIZ.slider(paramBar, {
      sym: p.sym, label: p.desc, desc: p.desc,
      min: p.min, max: p.max, step: p.step, value: state[p.key],
      onChange: v => { state[p.key] = v; last = p.key; render(); }
    });
  });

  /* Peaks of the seasonal part within one year, wrap-around grid. */
  function seasonalPeaks(s) {
    const dt = 0.05, n = Math.round(L / dt);
    const v = d3.range(n).map(k => seasonOf(s, k * dt));
    if (d3.max(v) - d3.min(v) < 1e-9) return [];
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = v[(k - 1 + n) % n], b = v[k], c = v[(k + 1) % n];
      if (b > a && b >= c) out.push(k * dt);
    }
    return out;
  }

  const num = (v, dp) => {
    const s = Math.abs(v).toFixed(dp);
    return v < 0 && +s !== 0 ? '−' + s : s;
  };
  const signed = (v, dp) => (v < 0 && +Math.abs(v).toFixed(dp) !== 0 ? ' − ' : ' + ') + Math.abs(v).toFixed(dp);

  function render() {
    const s = state;
    const same = PARAMS.every(p => s[p.key] === START[p.key]);

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 220,
      margin: { top: 14, right: 104, bottom: 34, left: 40 },
      desc: 'The expected value E(Y_t) and its trend over three years of weekly data.'
    });
    const x = d3.scaleLinear().domain([0, TMAX]).range([0, p.w]);
    // Fixed, so a change always shows as movement; extreme settings are clipped.
    const y = d3.scaleLinear().domain([40, 210]).range([p.h, 0]);
    const ts = d3.range(0, TMAX + 0.001, 0.5);
    const line = f => d3.line().x(t => x(t)).y(t => y(f(t)))(ts);

    const clipId = 'serfl-eq-clip';
    p.svg.append('defs').append('clipPath').attr('id', clipId)
      .append('rect').attr('x', -2).attr('y', -2).attr('width', p.w + 4).attr('height', p.h + 4);
    const plot = p.g.append('g').attr('clip-path', `url(#${clipId})`);

    // Year boundaries, faint.
    d3.range(1, YEARS).forEach(k => {
      p.g.append('line').attr('x1', x(k * L)).attr('x2', x(k * L)).attr('y1', 0).attr('y2', p.h)
        .attr('stroke', VIZ.C.rule).attr('stroke-width', 1);
    });

    if (!same) {
      plot.append('path').attr('d', line(t => ey(START, t)))
        .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 2.2);
    }
    plot.append('path').attr('d', line(t => trendOf(s, t)))
      .attr('fill', 'none').attr('stroke', VIZ.C.muted).attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '2 4');
    plot.append('path').attr('d', line(t => ey(s, t)))
      .attr('fill', 'none').attr('stroke', VIZ.C.blue).attr('stroke-width', 2.6);

    // β0 sits on the trend at t = 0.
    plot.append('circle').attr('cx', x(0)).attr('cy', y(s.b0)).attr('r', 4)
      .attr('fill', VIZ.C.muted).attr('stroke', '#fff').attr('stroke-width', 1.5);

    // Seasonal peaks, marked in every year.
    const pk = seasonalPeaks(s);
    d3.range(YEARS).forEach(k => pk.forEach(t0 => {
      const t = t0 + k * L;
      if (t > TMAX) return;
      plot.append('circle').attr('cx', x(t)).attr('cy', y(ey(s, t))).attr('r', 3.8)
        .attr('fill', VIZ.C.blue).attr('stroke', '#fff').attr('stroke-width', 1.4);
    }));

    // Direct labels at the right edge, nudged apart.
    const clampY = v => Math.max(4, Math.min(p.h - 4, v));
    const lab = [
      { y: clampY(y(ey(s, TMAX))), t: 'E(Yₜ)', c: VIZ.C.blue, b: 700 },
      { y: clampY(y(trendOf(s, TMAX))), t: 'trend', c: VIZ.C.muted, b: 600 }
    ];
    if (!same) lab.push({ y: clampY(y(ey(START, TMAX))), t: 'start', c: VIZ.C.muted, b: 500 });
    lab.sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 15) lab[i].y = lab[i - 1].y + 15;
    lab.forEach(l => p.g.append('text').attr('class', 'viz-reflabel')
      .attr('x', p.w + 10).attr('y', l.y).attr('fill', l.c).style('font-weight', l.b).text(l.t));

    VIZ.axisY(p, y, 5);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x).tickValues(d3.range(0, TMAX + 1, 26)).tickSize(0).tickPadding(8));
    p.g.append('text')
      .attr('x', p.w / 2).attr('y', p.h + 30).attr('font-size', 11).attr('fill', VIZ.C.muted)
      .style('text-anchor', 'middle').text('t, weeks (three years)');

    /* ---- live equation ---- */
    live.html('');
    live.append('div').text('E(Yₜ) = β₀ + β₁t + γ₁cos(2πt/52) + δ₁sin(2πt/52) + γ₂cos(4πt/52) + δ₂sin(4πt/52)');
    live.append('div').text(
      '      = ' + num(s.b0, 0) + signed(s.b1, 2) + 't' +
      signed(s.g1, 0) + '·cos(2πt/52)' + signed(s.d1, 0) + '·sin(2πt/52)' +
      signed(s.g2, 0) + '·cos(4πt/52)' + signed(s.d2, 0) + '·sin(4πt/52)');

    /* ---- readout ---- */
    const f1 = d3.format('.1f');
    const a1 = SERF.amplitudePhase(s.g1, s.d1, 1, L);
    const a2 = SERF.amplitudePhase(s.g2, s.d2, 2, L);
    const r = a2.A > 0 ? 2 : (a1.A > 0 ? 1 : 0);
    handle.setStatus(r === 0 ? 'No season' : `r = ${r}`, 'ok');

    const perYear = s.b1 * L;
    const what = {
      b0: 'β₀ lifts or lowers the whole curve; its shape does not change',
      b1: perYear === 0
        ? 'β₁ = 0: every year sits at the same level'
        : `β₁ tilts the curve: each year sits ${f1(Math.abs(perYear))} ${perYear > 0 ? 'higher' : 'lower'} than the one before`,
      g1: 'γ₁ and δ₁ together set how tall the yearly wave is (A₁) and in which week it peaks',
      d1: 'γ₁ and δ₁ together set how tall the yearly wave is (A₁) and in which week it peaks',
      g2: 'γ₂ and δ₂ add a 26-week wave: it can make the peak lopsided or split it in two',
      d2: 'γ₂ and δ₂ add a 26-week wave: it can make the peak lopsided or split it in two'
    };

    const year1 = d3.range(0, L, 0.25);
    const lo = d3.least(year1, t => ey(s, t)), hi = d3.greatest(year1, t => ey(s, t));
    const h1 = a1.A === 0 ? 'yearly wave off'
      : `yearly wave A₁ = <b>${f1(a1.A)}</b>, peak at week <b>${f1(a1.peaks[0])}</b>`;
    const h2 = a2.A === 0 ? '26-week wave off'
      : `26-week wave A₂ = <b>${f1(a2.A)}</b>, peaks at weeks ${f1(a2.peaks[0])} and ${f1(a2.peaks[1])}`;

    readout.html(
      (last ? `<b>${what[last]}</b>` : 'move any slider: the blue curve is E(Yₜ), the dotted line its trend') + '<br>' +
      `trend: <b>${num(s.b0, 0)}</b> at t = 0, ${perYear >= 0 ? '+' : '−'}${f1(Math.abs(perYear))} a year<br>` +
      `season: ${h1} · ${h2}<br>` +
      `year 1: E(Yₜ) runs from <b>${f1(ey(s, lo))}</b> (t = ${lo.toFixed(0)}) to <b>${f1(ey(s, hi))}</b> (t = ${hi.toFixed(0)})` +
      (pk.length > 1 ? ` — <b>${pk.length} peaks</b> a year` : '')
    );
  }

  VIZ.controls(handle.el, [
    { label: '↺ Back to the start', kind: 'ghost', onClick: () => {
      Object.assign(state, START); last = null;
      PARAMS.forEach(p => sliders[p.key].set(START[p.key]));
      render();
    } }
  ]);

  render();
})();
