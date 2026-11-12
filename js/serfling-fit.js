/* ============================================================
   Fit the seasonal wave by hand
   A year of weekly data around their mean (the target) and the
   reader's own curve, γ1 cos + δ1 sin + γ2 cos + δ2 sin. Move the
   four coefficients until the curve runs through the dots; R²
   scores the fit. Least squares then shows the best possible
   answer — which is exactly what the regression computes.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serfl-fit';
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

  const L = 52, NOISE = 1.5;
  const WEEKS = d3.range(1, L + 1);

  /* Three hidden seasonal shapes. Each target is the shape plus a little
     noise, then centred on its own mean so that no intercept is needed. */
  const TARGETS = [
    { id: 'one',  tab: 'One peak a year',          c: { g1: -12, d1: -8, g2: 0, d2: 0 },  seed: 11 },
    { id: 'skew', tab: 'Rises fast, falls slowly', c: { g1: -12, d1: 0,  g2: 3, d2: -4 }, seed: 23 },
    { id: 'two',  tab: 'Two peaks a year',         c: { g1: -4,  d1: -3, g2: 9, d2: 2 },  seed: 37 }
  ];

  const wave = (c, t) => {
    const a = 2 * Math.PI * t / L;
    return c.g1 * Math.cos(a) + c.d1 * Math.sin(a) + c.g2 * Math.cos(2 * a) + c.d2 * Math.sin(2 * a);
  };

  TARGETS.forEach(T => {
    const g = SERF.rng(T.seed);
    const raw = WEEKS.map(t => wave(T.c, t) + NOISE * g.normal());
    const mean = d3.mean(raw);
    T.y = raw.map(v => v - mean);
    T.tss = d3.sum(T.y, v => v * v);
    /* Least squares. Over one whole cycle of equally spaced weeks the
       cosines and sines are orthogonal, so each coefficient is simply
       2/L times the sum of y against its own wave. */
    const proj = (fn) => 2 / L * d3.sum(WEEKS, (t, i) => T.y[i] * fn(2 * Math.PI * t / L));
    T.ls = { g1: proj(Math.cos), d1: proj(Math.sin),
             g2: proj(a => Math.cos(2 * a)), d2: proj(a => Math.sin(2 * a)) };
    T.ls1 = { g1: T.ls.g1, d1: T.ls.d1, g2: 0, d2: 0 };
  });

  const r2 = (T, c) => 1 - d3.sum(WEEKS, (t, i) => (T.y[i] - wave(c, t)) ** 2) / T.tss;

  const PARAMS = [
    { key: 'g1', sym: 'γ₁', lim: 20, desc: 'cosine weight, yearly wave' },
    { key: 'd1', sym: 'δ₁', lim: 20, desc: 'sine weight, yearly wave' },
    { key: 'g2', sym: 'γ₂', lim: 10, desc: 'cosine weight, 26-week wave' },
    { key: 'd2', sym: 'δ₂', lim: 10, desc: 'sine weight, 26-week wave' }
  ];
  const ZERO = { g1: 0, d1: 0, g2: 0, d2: 0 };
  const state = { ti: 0, c: Object.assign({}, ZERO), showLS: false };

  const handle   = VIZ.card(MOUNT, { title: 'Fit the seasonal wave by hand', status: '…' });
  const tabs     = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params viz-params--sliders');
  const chart    = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'your curve, and how it is scored',
    lines: [
      'ŝ(t) = γ₁cos(2πt/52) + δ₁sin(2πt/52) + γ₂cos(4πt/52) + δ₂sin(4πt/52)',
      'R² = 1 − Σ (y − ŝ)² / Σ (y − ȳ)²',
      'least squares picks the γ and δ that make Σ (y − ŝ)² as small as possible'
    ],
    hint: 'start with γ₁ and δ₁; bring in γ₂ and δ₂ only if the shape needs them'
  });

  TARGETS.forEach((T, i) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', i === state.ti)
      .text(T.tab)
      .on('click', () => { state.ti = i; state.showLS = false; render(); });
  });

  const sliders = {};
  PARAMS.forEach(p => {
    sliders[p.key] = VIZ.slider(paramBar, {
      sym: p.sym, label: p.desc, desc: p.desc,
      min: -p.lim, max: p.lim, step: 0.5, value: 0,
      onChange: v => { state.c[p.key] = v; render(); }
    });
  });

  function peaksOf(c) {
    const dt = 0.05, n = Math.round(L / dt);
    const v = d3.range(n).map(k => wave(c, k * dt));
    if (d3.max(v) - d3.min(v) < 1e-9) return [];
    const out = [];
    for (let k = 0; k < n; k++) {
      const a = v[(k - 1 + n) % n], b = v[k], cc = v[(k + 1) % n];
      if (b > a && b >= cc) out.push(k * dt);
    }
    return out;
  }

  let lsButton;

  function render() {
    const T = TARGETS[state.ti], c = state.c;
    tabs.selectAll('button').attr('aria-pressed', (_, i) => i === state.ti);
    if (lsButton) lsButton.text(state.showLS ? 'Hide the least-squares fit' : 'Show the least-squares fit');

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 220,
      margin: { top: 12, right: 112, bottom: 34, left: 36 },
      desc: 'Weekly target values around their mean, and the curve set by the four coefficients.'
    });
    const x = d3.scaleLinear().domain([0.5, L + 0.5]).range([0, p.w]);
    const y = d3.scaleLinear().domain([-26, 26]).range([p.h, 0]);
    const ts = d3.range(0.5, L + 0.501, 0.25);
    const line = f => d3.line().x(t => x(t)).y(t => y(f(t)))(ts);

    const clipId = 'serfl-fit-clip';
    p.svg.append('defs').append('clipPath').attr('id', clipId)
      .append('rect').attr('x', -2).attr('y', -2).attr('width', p.w + 4).attr('height', p.h + 4);
    const plot = p.g.append('g').attr('clip-path', `url(#${clipId})`);

    plot.append('line').attr('x1', 0).attr('x2', p.w).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', VIZ.C.rule);

    // The deviation of each week from the reader's curve.
    WEEKS.forEach((t, i) => {
      plot.append('line')
        .attr('x1', x(t)).attr('x2', x(t)).attr('y1', y(T.y[i])).attr('y2', y(wave(c, t)))
        .attr('stroke', VIZ.C.amber).attr('stroke-width', 1.4).attr('opacity', 0.55);
    });

    if (state.showLS) {
      plot.append('path').attr('d', line(t => wave(T.ls, t)))
        .attr('fill', 'none').attr('stroke', VIZ.C.ink).attr('stroke-width', 1.8)
        .attr('stroke-dasharray', '6 4');
    }

    plot.append('path').attr('d', line(t => wave(c, t)))
      .attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2.6);

    WEEKS.forEach((t, i) => {
      plot.append('circle').attr('cx', x(t)).attr('cy', y(T.y[i])).attr('r', 3.4)
        .attr('fill', VIZ.C.blue).attr('stroke', '#fff').attr('stroke-width', 1);
    });

    const clampY = v => Math.max(4, Math.min(p.h - 4, v));
    const lab = [
      { y: clampY(y(wave(c, L + 0.5))), t: 'your curve', c: VIZ.C.teal, b: 700 },
      { y: clampY(y(T.y[L - 1])), t: 'target data', c: VIZ.C.blue, b: 600 }
    ];
    if (state.showLS) lab.push({ y: clampY(y(wave(T.ls, L + 0.5))), t: 'least squares', c: VIZ.C.ink, b: 600 });
    lab.sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 15) lab[i].y = lab[i - 1].y + 15;
    if (lab[lab.length - 1].y > p.h + 6) {
      const shift = lab[lab.length - 1].y - (p.h + 6);
      lab.forEach(l => { l.y -= shift; });
    }
    lab.forEach(l => p.g.append('text').attr('class', 'viz-reflabel')
      .attr('x', p.w + 10).attr('y', l.y).attr('fill', l.c).style('font-weight', l.b).text(l.t));

    VIZ.axisY(p, y, 5);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x).tickValues([1, 13, 26, 39, 52]).tickSize(0).tickPadding(8));
    p.g.append('text')
      .attr('x', p.w / 2).attr('y', p.h + 30).attr('font-size', 11).attr('fill', VIZ.C.muted)
      .style('text-anchor', 'middle').text('week of the year');

    /* ---- score and readout ---- */
    const f1 = d3.format('.1f'), f2 = d3.format('.2f');
    const sgn = v => (v < 0 ? '−' : '') + f1(Math.abs(v));
    const mine = r2(T, c), best = r2(T, T.ls), best1 = r2(T, T.ls1);
    const close = mine >= best - 0.01;
    handle.setStatus(`R² = ${mine < 0 ? '−' : ''}${f2(Math.abs(mine))}`, close ? 'ok' : 'idle');

    const a1 = SERF.amplitudePhase(c.g1, c.d1, 1, L);
    const a2 = SERF.amplitudePhase(c.g2, c.d2, 2, L);
    const h1 = a1.A === 0 ? 'yearly wave off'
      : `yearly wave A₁ = <b>${f1(a1.A)}</b>, peak at week <b>${f1(a1.peaks[0])}</b>`;
    const h2 = a2.A === 0 ? '26-week wave off'
      : `26-week wave A₂ = <b>${f1(a2.A)}</b>, peaks at weeks ${f1(a2.peaks[0])} and ${f1(a2.peaks[1])}`;

    const pt = peaksOf(T.c), pm = peaksOf(c);
    const list = a => a.map(v => f1(v)).join(' and ');
    const wk = a => (a.length > 1 ? 'weeks ' : 'week ') + list(a);
    const shape = `target: ${pt.length} peak${pt.length > 1 ? 's' : ''} a year, at ${wk(pt)}` +
      ` · yours: ${pm.length === 0 ? 'flat' : `${pm.length} peak${pm.length > 1 ? 's' : ''}, at ${wk(pm)}`}`;

    let score;
    if (mine < 0) score = `R² = <b>${f2(mine)}</b> — <span class="alarm">worse than a flat line</span>`;
    else score = `R² = <b>${f2(mine)}</b>: your curve explains ${Math.round(100 * mine)}% of the variation` +
      (close ? ' — <span class="ok">as good as least squares</span>' : '');

    const lsLine = state.showLS
      ? `least squares: γ₁ = ${sgn(T.ls.g1)}, δ₁ = ${sgn(T.ls.d1)}, γ₂ = ${sgn(T.ls.g2)}, δ₂ = ${sgn(T.ls.d2)} ` +
        `→ R² = <b>${f2(best)}</b>; with the yearly wave alone, ${f2(best1)}` +
        (best - best1 < 0.02 ? ' — the 26-week wave adds almost nothing here' : ' — this shape needs the 26-week wave')
      : `least squares reaches R² = <b>${f2(best)}</b> on these data — can you?`;

    readout.html(`${h1} · ${h2}<br>${shape}<br>${score}<br>${lsLine}`);
  }

  const btns = VIZ.controls(handle.el, [
    { id: 'ls', label: 'Show the least-squares fit', kind: 'primary',
      onClick: () => { state.showLS = !state.showLS; render(); } },
    { label: '↺ Start from a flat line', kind: 'ghost', onClick: () => {
      state.c = Object.assign({}, ZERO); state.showLS = false;
      PARAMS.forEach(p => sliders[p.key].set(0));
      render();
    } }
  ]);
  lsButton = btns.ls;

  render();
})();
