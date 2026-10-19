/* ============================================================
   Figure 1 — Two predictive distributions for next week's count
   The plug-in one fixes the parameters at their estimates. The
   Bayesian one averages over what the parameters might be. Raise
   the parameter uncertainty and watch the tail thicken and the
   threshold walk to the right.
   ============================================================ */

(function () {
  const MOUNT = '#viz-predictive';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3    === 'undefined') missing.push('d3');
  if (typeof VIZ   === 'undefined') missing.push('viz-kit.js');
  if (typeof BAYES === 'undefined') missing.push('bayes-core.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load \u2014 not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  const KMAX = 400, ALPHA = 0.05;
  const state = { mu: 15, nu: 6, sig: 30 };   // sig is a percentage
  const LIMITS = {
    mu:  { min: 5, max: 40, step: 5, label: 'expected count for the week' },
    nu:  { min: 2, max: 20, step: 2, label: 'size \u03bd \u2014 larger means less overdispersion' },
    sig: { min: 0, max: 50, step: 5, label: '% uncertainty in the expected count' }
  };

  const handle = VIZ.card(MOUNT, {
    title: "The predictive distribution for next week",
    status: 'Same threshold'
  });

  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const chart    = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'predictive distribution for y(T)',
    lines: [
      'plug-in    y ~ NB(mu, nu)                      parameters held fixed',
      'Bayesian   y ~ integral NB(mu, nu) p(mu|data) dmu',
      'threshold  smallest k with P(y <= k) >= 0.95'
    ],
    hint: 'raise the uncertainty and watch the two thresholds separate'
  });

  function stepper(key) {
    const lim = LIMITS[key];
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text(key === 'sig' ? '\u03c3' : (key === 'mu' ? '\u03bc' : '\u03bd'));
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `decrease ${key}`).text('\u2212');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `increase ${key}`).text('+');
    row.append('span').attr('class', 'd').text(lim.label);

    dec.on('click', () => { state[key] = Math.max(lim.min, state[key] - lim.step); render(); });
    inc.on('click', () => { state[key] = Math.min(lim.max, state[key] + lim.step); render(); });

    return () => {
      val.text(key === 'sig' ? state[key] + '%' : state[key]);
      dec.property('disabled', state[key] <= lim.min);
      inc.property('disabled', state[key] >= lim.max);
    };
  }

  const syncParams = ['mu', 'nu', 'sig'].map(stepper);

  function render() {
    syncParams.forEach(f => f());
    const sigma = state.sig / 100;

    const plug  = BAYES.predictive(state.mu, state.nu, 0, KMAX);
    const bayes = BAYES.predictive(state.mu, state.nu, sigma, KMAX);
    const Up = BAYES.quantile(plug,  1 - ALPHA);
    const Ub = BAYES.quantile(bayes, 1 - ALPHA);
    const realRate = BAYES.tail(bayes, Up);          // what the plug-in threshold actually delivers
    const Vp = BAYES.variance(plug), Vb = BAYES.variance(bayes);

    // Show enough of the tail that both thresholds sit comfortably inside.
    const kMax = Math.max(Ub + Math.ceil(state.mu * 0.6), Up + 8, 24);
    const ks = d3.range(0, kMax + 1);

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 210,
      margin: { top: 34, right: 62, bottom: 44, left: 40 },
      desc: 'Plug-in and Bayesian predictive distributions with their 95% thresholds.'
    });

    const x = d3.scaleLinear().domain([0, kMax]).range([0, p.w]);
    const y = d3.scaleLinear().domain([0, d3.max(plug) * 1.12]).range([p.h, 0]);

    // The gap the plug-in leaves out: between the two thresholds.
    if (Ub > Up) {
      p.g.append('rect')
        .attr('x', x(Up)).attr('y', 0)
        .attr('width', x(Ub) - x(Up)).attr('height', p.h)
        .attr('fill', VIZ.C.amber).attr('opacity', 0.16);
    }

    const line = d3.line().curve(d3.curveStepAfter).x(d => x(d[0])).y(d => y(d[1]));

    // Bayesian: the distribution the method actually uses.
    p.g.append('path')
      .datum(ks.map(k => [k, bayes[k]]))
      .attr('fill', 'none').attr('stroke', VIZ.C.blue).attr('stroke-width', 2)
      .attr('d', line);
    p.g.append('path')
      .datum(ks.map(k => [k, bayes[k]]).concat([[kMax, 0], [0, 0]]))
      .attr('fill', VIZ.C.blue).attr('opacity', 0.12)
      .attr('d', d3.area().curve(d3.curveStepAfter).x(d => x(d[0])).y0(p.h).y1(d => y(d[1])));

    // Plug-in: drawn thinner, as the comparison rather than the answer.
    p.g.append('path')
      .datum(ks.map(k => [k, plug[k]]))
      .attr('fill', 'none').attr('stroke', VIZ.C.muted).attr('stroke-width', 1.8)
      .attr('d', line);

    function marker(k, colour, label, side) {
      p.g.append('line')
        .attr('x1', x(k)).attr('x2', x(k)).attr('y1', -6).attr('y2', p.h)
        .attr('stroke', colour).attr('stroke-width', 1.5).attr('stroke-dasharray', '5 4');
      p.g.append('text')
        .attr('class', 'viz-annot')
        .attr('x', x(k) + (side === 'left' ? -7 : 7)).attr('y', -16)
        // .style, not .attr: the .viz-annot class sets text-anchor in CSS,
        // and a stylesheet rule beats an SVG presentation attribute.
        .style('text-anchor', side === 'left' ? 'end' : 'start')
        .attr('fill', colour).text(label);
    }
    // One label to the left of its own line, the other to the right, so
    // they never collide however close the two thresholds sit.
    marker(Up, VIZ.C.muted, `plug-in ${Up}`, 'left');
    if (Ub !== Up) marker(Ub, VIZ.C.red, `Bayesian ${Ub}`, 'right');

    VIZ.axisY(p, y, 3);
    VIZ.axisX(p, x, 8);
    p.g.append('text')
      .attr('x', p.w / 2).attr('y', p.h + 36).attr('text-anchor', 'middle')
      .attr('font-size', 11.5).attr('fill', VIZ.C.muted)
      .text('cases next week');

    const pct = d3.format('.1%'), f2 = d3.format('.2f');
    const widened = Ub > Up;
    handle.setStatus(widened ? `threshold +${Ub - Up}` : 'Same threshold', 'ok');

    readout.html(
      `plug-in threshold <b>${Up}</b> \u2014 claims a ${pct(ALPHA)} alarm rate, ` +
      `<span class="${realRate > ALPHA * 1.05 ? 'alarm' : 'ok'}">actually delivers ${pct(realRate)}</span><br>` +
      `Bayesian threshold <b>${Ub}</b> \u2014 delivers ${pct(ALPHA)}<br>` +
      `variance ${f2(Vp)} (sampling) + ${f2(Vb - Vp)} (parameter) = <b>${f2(Vb)}</b>`
    );
  }

  render();
})();
