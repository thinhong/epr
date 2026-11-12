/* ============================================================
   Figure 3 — Why two weeks in a row
   A 26-week winter–spring, drawn as standardised residuals against
   the 1.645 line. Simulate one season or a thousand and keep a
   tally. With no epidemic the tally converges on Serfling's
   arithmetic; with correlated weeks it does not.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serf-twoweek';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3   === 'undefined') missing.push('d3');
  if (typeof VIZ  === 'undefined') missing.push('viz-kit.js');
  if (typeof SERF === 'undefined') missing.push('serfling-core.js');
  if (!missing.length && !VIZ.slider) missing.push('VIZ.slider (update viz-kit.js)');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  const W = 26, Z = 1.645, ONSET = 12;      // ONSET is a 1-based week
  /* A moderate epidemic, in standard deviations above baseline, week by
     week from onset. Chosen so that with independent weeks the two-week
     rule reproduces the miss probabilities Serfling (1963) reported for
     a moderate epidemic: 0.9 by the end of week 2, 0.1 by week 3. */
  const RAMP = [0.42, 2.93, 4.5, 5.5, 6, 6, 5.5, 5, 4.2, 3.3, 2.4, 1.6, 1, 0.5, 0.2];

  const gen = SERF.rng(1963);
  const state = { mode: 'quiet', rho: 0, last: null, tally: null };

  function emptyTally() {
    return { n: 0, any: 0, pair: 0, missBy2: 0, missBy3: 0, falseBefore: 0 };
  }

  function simulate() {
    const rho = state.rho, k = Math.sqrt(1 - rho * rho);
    const z = new Array(W);
    let prev = gen.normal();
    for (let t = 0; t < W; t++) {
      const e = t === 0 ? prev : rho * prev + k * gen.normal();
      prev = e;
      const shift = state.mode === 'epi' && t >= ONSET - 1 ? (RAMP[t - (ONSET - 1)] || 0) : 0;
      z[t] = e + shift;
    }
    const ex = z.map(v => v > Z);
    const conf = SERF.twoWeek(ex);
    return { z, ex, conf };
  }

  function record(s) {
    const T = state.tally;
    T.n++;
    if (state.mode === 'quiet') {
      if (s.ex.some(Boolean)) T.any++;
      if (s.conf.some(Boolean)) T.pair++;
    } else {
      const o = ONSET - 1;
      // the rule applied from the onset, as in Serfling's calculation
      const by2 = s.ex[o] && s.ex[o + 1];
      const by3 = by2 || (s.ex[o + 1] && s.ex[o + 2]);
      if (!by2) T.missBy2++;
      if (!by3) T.missBy3++;
      if (s.conf.slice(0, o).some(Boolean)) T.falseBefore++;
    }
  }

  function run(n) {
    for (let i = 0; i < n; i++) { const s = simulate(); record(s); state.last = s; }
    render();
  }

  function reset() { state.tally = emptyTally(); run(1); }

  const handle = VIZ.card(MOUNT, { title: 'A 26-week winter, one week at a time', status: '\u2026' });
  const tabs     = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params viz-params--sliders');
  const chart    = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'one week vs two in a row, 26 independent weeks, α = 0.05',
    lines: [
      'P(at least one week over)   = 1 − 0.95^26          = 0.736',
      'P(two in a row, somewhere)  = Markov chain, exact     = 0.058',
      'neighbouring weeks:  z(t) = ρ z(t−1) + √(1 − ρ²) e(t)'
    ],
    hint: 'simulate a thousand seasons, then raise ρ'
  });

  [['quiet', 'Quiet season'], ['epi', 'Moderate epidemic from week 12']].forEach(([mode, label]) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', state.mode === mode)
      .text(label)
      .on('click', () => { if (state.mode !== mode) { state.mode = mode; reset(); } });
  });

  VIZ.slider(paramBar, {
    sym: 'ρ', label: 'correlation between neighbouring weeks',
    desc: 'correlation between neighbouring weeks (changing it resets the tally)',
    min: 0, max: 0.8, step: 0.1, value: state.rho,
    onChange: v => { state.rho = v; reset(); }
  });

  function render() {
    tabs.selectAll('button').attr('aria-pressed', function () {
      return (d3.select(this).text() === 'Quiet season') === (state.mode === 'quiet');
    });

    const s = state.last;
    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 180,
      margin: { top: 18, right: 96, bottom: 28, left: 34 },
      desc: 'Standardised residuals for one simulated season against the 1.645 line.'
    });

    const yHi = Math.max(3.5, d3.max(s.z) + 0.6);
    const x = d3.scaleLinear().domain([0.5, W + 0.5]).range([0, p.w]);
    const y = d3.scaleLinear().domain([-3, yHi]).range([p.h, 0]);
    const bw = (p.w / W) * 0.66;

    if (state.mode === 'epi') {
      p.g.append('rect')
        .attr('x', x(ONSET - 0.5)).attr('y', -6)
        .attr('width', x(W + 0.5) - x(ONSET - 0.5)).attr('height', p.h + 6)
        .attr('fill', VIZ.C.surfaceAlt);
      p.g.append('text')
        .attr('x', x(ONSET - 0.5) + 6).attr('y', 6)
        .attr('font-size', 11).attr('fill', VIZ.C.muted)
        .text('epidemic under way');
    }

    p.g.append('line')
      .attr('x1', 0).attr('x2', p.w).attr('y1', y(0)).attr('y2', y(0))
      .attr('stroke', VIZ.C.rule);

    s.z.forEach((v, i) => {
      const top = Math.max(v, 0), bot = Math.min(v, 0);
      p.g.append('rect')
        .attr('x', x(i + 1) - bw / 2).attr('y', y(top))
        .attr('width', bw).attr('height', Math.max(1, y(bot) - y(top)))
        .attr('rx', 1.5)
        .attr('fill', s.conf[i] ? VIZ.C.red : (s.ex[i] ? VIZ.C.amber : VIZ.C.blue))
        .attr('fill-opacity', s.conf[i] || s.ex[i] ? 0.9 : 0.45);
    });

    VIZ.refLine(p, { y: y(Z), color: VIZ.C.red, label: 'z = 1.645' });
    VIZ.axisY(p, y, 4);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x).tickValues([1, 6, 11, 16, 21, 26]).tickSize(0).tickPadding(8));

    /* ---- readout ---- */
    const T = state.tally, pct = (a, n) => (n ? (100 * a / n).toFixed(1) : '0.0') + '%';
    const rho = state.rho;
    const nSingle = s.ex.filter(Boolean).length, nConf = s.conf.filter(Boolean).length;

    handle.setStatus(`${T.n.toLocaleString('en')} season${T.n === 1 ? '' : 's'}`, 'ok');

    const thisSeason = `this season: ${nSingle} week${nSingle === 1 ? '' : 's'} over the line — ` +
      (nConf
        ? `<span class="alarm">${nConf} confirmed by the week before (red)</span>, ${nSingle - nConf} alone (amber)`
        : 'none confirmed, all alone (amber)');

    if (state.mode === 'quiet') {
      readout.html(
        thisSeason + '<br>' +
        `seasons with at least one week over: <b>${pct(T.any, T.n)}</b> — independence predicts ` +
        `${(100 * SERF.pAnyExceed(0.05, W)).toFixed(1)}%<br>` +
        `seasons with two weeks in a row: <b>${pct(T.pair, T.n)}</b> — independence predicts ` +
        `${(100 * SERF.pAnyPair(0.05, W)).toFixed(1)}%` +
        (rho > 0 ? ` <span class="alarm">(ρ = ${rho.toFixed(1)}: neighbouring weeks cross together)</span>` : '')
      );
    } else {
      readout.html(
        thisSeason + '<br>' +
        `not yet confirmed by the end of week 2 of the rise: <b>${pct(T.missBy2, T.n)}</b> (Serfling: 90%)<br>` +
        `not yet confirmed by the end of week 3: <b>${pct(T.missBy3, T.n)}</b> (Serfling: 10%)` +
        ` &nbsp; false alarm before the rise: ${pct(T.falseBefore, T.n)}`
      );
    }
  }

  // Controls under the chart, as in the other step-by-step figures.
  VIZ.controls(handle.el, [
    { label: '▶ Simulate a season', kind: 'primary', onClick: () => run(1) },
    { label: 'Simulate 1,000', kind: 'ghost', onClick: () => run(1000) },
    { label: '↻ Reset tally', kind: 'ghost', onClick: reset }
  ]);

  state.tally = emptyTally();
  run(1);
})();
