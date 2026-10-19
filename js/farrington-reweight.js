/* ============================================================
   Figure 2 — The cut-off that decides how much history to believe
   Thirty-five reference weeks, one of the five years carrying an
   outbreak through the window. Move the cut-off and watch the
   regression line, the dispersion and the threshold move with it.
   Everything here is computed by farrington-core.js.
   ============================================================ */

(function () {
  const MOUNT = '#viz-farr-reweight';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3   === 'undefined') missing.push('d3');
  if (typeof VIZ  === 'undefined') missing.push('viz-kit.js');
  if (typeof FARR === 'undefined') missing.push('farrington-core.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  /* Five years, seven weeks each. Year −3 carried an outbreak straight
     through the reference window: the case reweighting exists for. */
  const BLOCKS = [
    [4, 5, 3, 6, 4, 5, 3],
    [5, 4, 6, 5, 7, 5, 4],
    [6, 9, 17, 21, 14, 8, 6],
    [5, 6, 5, 7, 6, 5, 7],
    [6, 5, 7, 6, 8, 6, 7]
  ];
  const Y = BLOCKS.flat();
  const TIDX = [];
  BLOCKS.forEach((_, i) => { for (let j = -3; j <= 3; j++) TIDX.push(-52 * (5 - i) + j); });
  const X = TIDX.map(v => [1, v]);
  const X0 = [1, 0];
  // 13 sits between the 1996 threshold and the 2013 one, which is the
  // whole disagreement between the two versions in a single number.
  const OBS = 13;

  const CUTS = [0.5, 1, 1.5, 2, 2.58, 3.5, 99];
  const state = { ci: 1, method: 'delta' };   // start at the 1996 cut-off

  const handle = VIZ.card(MOUNT, { title: 'Thirty-five reference weeks, one of them an old outbreak', status: '' });

  const tabs     = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const chart    = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'Anscombe residual and weight',
    lines: [
      's = (y^(2/3) - mu^(2/3)) / ((2/3) sqrt(phi) mu^(1/6) sqrt(1-h))',
      'w = gamma / s^2  if s > cut        w = gamma  otherwise',
      '1996 cut = 1        2013 cut = 2.58'
    ],
    hint: 'move the cut-off and watch phi and the threshold move with it'
  });

  [['delta', 'Threshold: 1996 delta'], ['nb', 'Threshold: 2013 NB']].forEach(([m, label]) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', state.method === m)
      .text(label)
      .on('click', () => { state.method = m; render(); });
  });

  // Declared before the IIFE that assigns it: a `let` is in its temporal
  // dead zone until the declaration runs, so assigning from above throws.
  let syncCut;

  (function cutStepper() {
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text('cut');
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'lower cut-off').text('−');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'raise cut-off').text('+');
    row.append('span').attr('class', 'd').text('Anscombe residual above which a week is downweighted');

    dec.on('click', () => { state.ci = Math.max(0, state.ci - 1); render(); });
    inc.on('click', () => { state.ci = Math.min(CUTS.length - 1, state.ci + 1); render(); });

    syncCut = () => {
      const c = CUTS[state.ci];
      val.text(c === 99 ? 'off' : c);
      dec.property('disabled', state.ci <= 0);
      inc.property('disabled', state.ci >= CUTS.length - 1);
    };
  })();

  function render() {
    syncCut();
    tabs.selectAll('button').attr('aria-pressed', function () {
      return (d3.select(this).text().indexOf('NB') >= 0) === (state.method === 'nb');
    });

    const cut = CUTS[state.ci];
    const r = FARR.run(X, Y, X0, {
      cut, z: 1.645, level: 0.95,
      method: state.method, reweight: cut < 99
    });
    const plain = FARR.run(X, Y, X0, { reweight: false, z: 1.645, level: 0.95, method: state.method });

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 220,
      margin: { top: 20, right: 96, bottom: 30, left: 38 },
      desc: 'Reference counts with the weighted regression line and the resulting threshold.'
    });

    const x = d3.scaleLinear().domain([d3.min(TIDX) - 4, 14]).range([0, p.w]);
    const yMax = Math.max(d3.max(Y), r.U, plain.U) * 1.1;
    const y = d3.scaleLinear().domain([0, yMax]).range([p.h, 0]);

    // The assessed week sits apart from the five reference clusters.
    p.g.append('rect')
      .attr('x', x(-3.5)).attr('y', -6)
      .attr('width', x(14) - x(-3.5)).attr('height', p.h + 6)
      .attr('fill', VIZ.C.surfaceAlt);

    // Where the line would sit if no week were ever downweighted.
    const lineAt = (fit, tv) => Math.exp(fit.beta[0] + fit.beta[1] * tv);
    const tv = d3.range(d3.min(TIDX) - 4, 7, 2);
    p.g.append('path')
      .datum(tv.map(v => [v, lineAt(plain.fit, v)]))
      .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 1.6)
      .attr('d', d3.line().x(d => x(d[0])).y(d => y(d[1])));

    p.g.append('path')
      .datum(tv.map(v => [v, lineAt(r.fit, v)]))
      .attr('fill', 'none').attr('stroke', VIZ.C.blue).attr('stroke-width', 2.2)
      .attr('d', d3.line().x(d => x(d[0])).y(d => y(d[1])));

    // Each reference week: full circle at weight 1, hollowed out as its
    // weight falls, so the downweighting is visible as such.
    Y.forEach((yi, i) => {
      const w = r.w[i] / r.gamma;                       // 1 when untouched
      const isDown = r.down.indexOf(i) >= 0;
      p.g.append('circle')
        .attr('cx', x(TIDX[i])).attr('cy', y(yi))
        .attr('r', 4.2)
        .attr('fill', isDown ? '#fff' : VIZ.C.blue)
        .attr('fill-opacity', isDown ? 1 : 0.75)
        .attr('stroke', isDown ? VIZ.C.amber : VIZ.C.blue)
        .attr('stroke-width', isDown ? 2 : 0.8);
      if (isDown) {
        p.g.append('text')
          .attr('x', x(TIDX[i])).attr('y', y(yi) - 10)
          .attr('font-size', 9.5).attr('font-weight', 600)
          .style('text-anchor', 'middle').attr('fill', VIZ.C.amber)
          .text('×' + w.toFixed(2));
      }
    });

    // The week under assessment. Drawn as a bar, not a dot: it is the
    // thing being judged, not another reference point, and a bar does
    // not disappear underneath the threshold line.
    const alarm = OBS > r.U;
    const bw = x(8) - x(2);
    p.g.append('rect')
      .attr('x', x(2)).attr('y', y(OBS))
      .attr('width', bw).attr('height', p.h - y(OBS))
      .attr('rx', 2)
      .attr('fill', alarm ? VIZ.C.red : VIZ.C.blue)
      .attr('fill-opacity', alarm ? 0.85 : 0.5);
    // Inside the bar, not above it: the threshold line passes close by
    // and would otherwise run straight through the number.
    p.g.append('text')
      .attr('x', x(5)).attr('y', y(OBS) + 15)
      .attr('font-size', 10.5).attr('font-weight', 700)
      .style('text-anchor', 'middle')
      .attr('fill', '#fff')
      .text(OBS);

    VIZ.refLine(p, { y: y(r.U), color: VIZ.C.red, x1: x(-10),
                     label: `U = ${state.method === 'nb' ? r.U : r.U.toFixed(2)}` });
    VIZ.refLine(p, { y: y(r.mu0), color: VIZ.C.teal, x1: x(-10),
                     label: `μ₀ = ${r.mu0.toFixed(2)}` });

    VIZ.axisY(p, y, 4);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x)
        .tickValues([-260, -208, -156, -104, -52, 0])
        .tickFormat(v => (v === 0 ? 'now' : `−${-v / 52}y`))
        .tickSize(0).tickPadding(9));

    const nDown = r.down.length;
    const falsePct = cut === 99 ? 0 : FARR.normUpper(cut) * 100;
    handle.setStatus(cut === 99 ? 'No reweighting'
                                : `${nDown} week${nDown === 1 ? '' : 's'} downweighted`,
                     'ok');

    const uTxt = v => (state.method === 'nb' ? String(v) : v.toFixed(2));

    readout.html(
      (cut === 99
        ? `<b>No reweighting.</b> The old outbreak counts in full: it lifts both the ` +
          `baseline and the dispersion, and the threshold rises with them.`
        : `cut-off <b>${cut}</b> — ${nDown} of 35 weeks downweighted; on weeks with ` +
          `nothing wrong, this cut-off still catches <b>${falsePct.toFixed(1)}%</b> of them`) +
      '<br>' +
      `dispersion φ ${r.phiFirst.toFixed(3)} → <b>${r.phi.toFixed(3)}</b>` +
      (r.phi <= 1.0001 && cut < 99
        ? ' <span class="alarm">(on the floor — the fit now looks Poisson)</span>' : '') +
      ` &nbsp; μ₀ = ${r.mu0.toFixed(3)}` +
      ` &nbsp; U = <b>${uTxt(r.U)}</b>` +
      ` &nbsp; (no reweighting: ${uTxt(plain.U)})<br>` +
      `this week notified ${OBS} cases — ` +
      (alarm ? `<span class="alarm">${OBS} &gt; ${uTxt(r.U)} → alarm</span>`
             : `<span class="ok">${OBS} ≤ ${uTxt(r.U)} → no alarm</span>`) +
      ` &nbsp; X = ${((OBS - r.mu0) / (r.U - r.mu0)).toFixed(2)}`
    );
  }

  render();
})();
