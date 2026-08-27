/* ============================================================
   Figure 2 — RKI 1, 2 and 3 on the same four years
   Hovering a week paints, in amber, the exact weeks that week is
   being judged against. Switching variant changes only which
   weeks those are — everything downstream is identical.
   ============================================================ */

(function () {
  const MOUNT = '#viz-series';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  // Say what is wrong in the page itself. A figure that fails quietly looks
  // like a caption with nothing above it, which tells the author nothing.
  const missing = [];
  if (typeof d3  === 'undefined') missing.push('d3');
  if (typeof VIZ === 'undefined') missing.push('viz-kit.js');
  if (typeof RKI === 'undefined') missing.push('rki-core.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load \u2014 not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  /* Simulated weekly notifications, four years of 52 weeks, with a
     sustained early-season rise in the fourth year. Simulated, not
     observed — the point is the behaviour of the threshold. */
  const Y = [14,13,6,12,14,12,13,12,15,11,17,16,17,8,7,12,9,13,12,14,16,12,14,13,23,17,10,26,18,18,15,21,23,15,23,19,17,23,18,16,13,17,21,19,10,18,16,14,14,17,16,12,6,16,13,8,17,10,15,10,13,11,10,13,17,11,10,12,8,17,8,19,16,19,12,11,18,12,13,16,15,13,18,19,22,12,23,17,19,17,15,14,20,11,12,14,14,17,10,18,16,17,11,14,16,10,9,13,10,10,10,15,11,17,8,12,15,11,16,16,17,12,9,13,16,15,17,19,21,20,20,20,15,19,19,23,12,22,18,29,30,24,18,18,20,13,14,15,10,15,18,20,18,16,23,13,18,19,14,11,12,10,16,13,10,16,7,15,18,17,18,27,23,36,30,30,18,25,16,18,20,15,19,12,21,15,21,21,21,24,24,14,16,21,20,23,18,9,19,18,16,13,14,12,7,11,15,14];

  const FREQ = 52, N = Y.length, YEAR0 = 2022;

  const VARIANTS = RKI.VARIANTS;

  const state = { variant: 'RKI 3', hover: null };

  const val = wk => Y[wk - 1];                       // 1-based week index
  const label = wk => `${YEAR0 + Math.floor((wk - 1) / FREQ)} w${((wk - 1) % FREQ) + 1}`;

  /* ---- the method itself ------------------------------------ */

  const cache = {};
  function series(name) {
    if (cache[name]) return cache[name];
    const v = VARIANTS[name];
    const out = d3.range(1, N + 1).map(wk => RKI.evaluate(Y, wk, v, FREQ));
    return (cache[name] = out);
  }

  /* ---- chrome ------------------------------------------------ */

  const handle = VIZ.card(MOUNT, { title: 'Four years of weekly notifications', status: 'RKI 3' });

  const tabs   = handle.body.append('div').attr('class', 'viz-tabs');
  const chart  = handle.body.append('div');
  const readout = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'RKI \u00b7 each week',
    lines: [
      'RKI 1  b = 0, w = 6, actY = TRUE    n =  6',
      'RKI 2  b = 1, w = 6, actY = TRUE    n = 19',
      'RKI 3  b = 2, w = 4, actY = FALSE   n = 18'
    ],
    hint: 'hover a bar to see the weeks it is compared against'
  });

  Object.keys(VARIANTS).forEach(name => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', name === state.variant)
      .text(name)
      .on('click', () => { state.variant = name; state.hover = null; render(); });
  });

  /* ---- drawing ----------------------------------------------- */

  const W = 720;

  function render() {
    tabs.selectAll('button').attr('aria-pressed', function () {
      return d3.select(this).text() === state.variant;
    });
    handle.setStatus(state.variant, 'ok');

    const v = VARIANTS[state.variant];
    const res = series(state.variant);
    const first = res.findIndex(r => r !== null) + 1;      // first monitorable week

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: W, height: 200,
      margin: { top: 26, right: 124, bottom: 28, left: 38 },
      desc: `Weekly notifications with the ${state.variant} threshold.`
    });

    const yMax = d3.max([d3.max(Y), d3.max(res, r => (r ? r.U : 0))]) * 1.08;
    const x = d3.scaleLinear().domain([0.5, N + 0.5]).range([0, p.w]);
    const y = d3.scaleLinear().domain([0, yMax]).range([p.h, 0]);
    const bw = Math.max(1.6, (p.w / N) * 0.85);

    // The burn-in: weeks with too little history behind them to judge.
    if (first > 1) {
      p.g.append('rect')
        .attr('x', 0).attr('y', -8)
        .attr('width', x(first - 0.5)).attr('height', p.h + 8)
        .attr('fill', VIZ.C.surfaceAlt);
      p.g.append('text')
        .attr('x', 6).attr('y', -14)
        .attr('font-size', 11.5).attr('fill', VIZ.C.muted)
        .text('history only \u2014 not yet monitorable');
    }

    const foot = new Set(state.hover ? (res[state.hover - 1]?.weeks || []) : []);

    p.g.selectAll('rect.bar').data(d3.range(1, N + 1)).join('rect')
      .attr('class', 'bar')
      .attr('x', wk => x(wk) - bw / 2)
      .attr('y', wk => y(val(wk)))
      .attr('width', bw)
      .attr('height', wk => p.h - y(val(wk)))
      .attr('fill', wk => {
        if (foot.has(wk)) return VIZ.C.amber;
        if (wk === state.hover) return VIZ.C.ink;
        if (wk < first) return VIZ.C.grey;
        return res[wk - 1] && res[wk - 1].alarm ? VIZ.C.redSoft : VIZ.C.blue;
      })
      .attr('opacity', wk => (state.hover && !foot.has(wk) && wk !== state.hover ? 0.35 : 1));

    // Threshold, drawn as the step function it is: U only moves when the
    // reference mean crosses an integer.
    const pts = res.map((r, i) => (r ? [i + 1, r.U] : null)).filter(Boolean);
    p.g.append('path')
      .datum(pts)
      .attr('fill', 'none')
      .attr('stroke', VIZ.C.red)
      .attr('stroke-width', 1.6)
      .attr('stroke-dasharray', '5 4')
      .attr('d', d3.line().curve(d3.curveStepAfter).x(d => x(d[0])).y(d => y(d[1])));

    p.g.append('text')
      .attr('class', 'viz-reflabel')
      .attr('x', x(pts[pts.length - 1][0]) + 10)
      .attr('y', y(pts[pts.length - 1][1]))
      .attr('fill', VIZ.C.red)
      .text('threshold U (cases)');

    // Name the first alarm, the way the text talks about it.
    const firstAlarm = res.findIndex(r => r && r.alarm) + 1;
    if (firstAlarm > 0 && !state.hover) {
      VIZ.annotate(p, { x: x(firstAlarm), y: y(val(firstAlarm)) - 12, text: 'signal' });
    }

    VIZ.axisY(p, y, 4);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x)
        .tickValues(d3.range(0, 4).map(i => i * FREQ + 1))
        .tickFormat(wk => YEAR0 + Math.floor((wk - 1) / FREQ))
        .tickSize(0).tickPadding(9));

    VIZ.hoverIndex(p, x, N,
      i => { state.hover = i + 1; render(); },
      () => { state.hover = null; render(); });

    say(res, first, v);
  }

  function say(res, first, v) {
    const f2 = d3.format('.2f');

    if (!state.hover) {
      const alarms = res.map((r, i) => (r && r.alarm ? i + 1 : null)).filter(Boolean);
      readout.html(
        `<b>${state.variant}</b> \u2014 ${v.note}.<br>` +
        `monitoring starts at ${label(first)}; ` +
        (alarms.length
          ? `${alarms.length} week${alarms.length > 1 ? 's' : ''} signal, first at <b>${label(alarms[0])}</b>`
          : 'no week signals') +
        '.'
      );
      return;
    }

    const wk = state.hover, r = res[wk - 1];
    if (!r) {
      readout.html(`<b>${label(wk)}</b> \u2014 ${val(wk)} cases. Too little history behind this week to build a reference set.`);
      return;
    }

    const branchLine = r.branch === 'poisson'
      ? `mean R = ${f2(r.mu)} \u2264 20 \u2192 Poisson table at ${r.idx} \u2192 <b>U = ${f2(r.U)}</b>`
      : `mean R = ${f2(r.mu)} > 20 \u2192 mean + 2\u00b7sd (${f2(r.sd)}) \u2192 <b>U = ${f2(r.U)}</b>`;

    readout.html(
      `<b>${label(wk)}</b> \u2014 ${r.obs} cases, compared against ${r.n} reference weeks (amber)<br>` +
      branchLine + '<br>' +
      (r.alarm
        ? `<span class="alarm">${r.obs} &gt; ${f2(r.U)} \u2192 signal</span>`
        : `<span class="ok">${r.obs} \u2264 ${f2(r.U)} \u2192 no signal</span>`)
    );
  }

  render();
})();