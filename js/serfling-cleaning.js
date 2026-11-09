/* ============================================================
   Figure 2 — How much of the history to throw away
   Five seasons of training data, each with a winter epidemic, then
   the season being monitored. Raise the share of top weeks trimmed
   before fitting and watch the baseline, the residual spread and
   the threshold move. The data are simulated, so the true
   no-epidemic baseline is known and drawn, and the real false
   alarm rate of every threshold can be computed exactly.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serf-cleaning';
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

  /* Weekly counts, six seasons of 52 weeks; season week 1 is July.
     Simulated as the true baseline below, a winter epidemic in every
     season, and normal noise with standard deviation 10. */
  const Y = [114,108,89,108,119,113,111,120,122,128,127,108,119,107,139,112,122,139,121,143,164,178,190,198,219,217,197,168,179,138,136,141,112,125,129,157,115,122,133,121,113,140,121,114,124,104,102,120,105,84,105,95,94,111,116,104,109,112,102,101,129,114,120,124,100,125,123,111,135,137,126,151,145,129,144,152,163,197,209,239,257,253,210,206,155,157,153,139,136,116,128,130,126,118,107,105,105,103,126,101,116,102,125,97,106,117,123,104,119,121,111,119,123,117,114,132,112,141,137,157,160,170,157,176,188,185,187,177,146,157,172,145,130,146,159,139,124,141,131,123,129,132,125,141,127,120,115,109,134,113,100,121,121,112,111,117,114,109,115,125,109,118,127,139,113,127,130,138,121,133,131,130,137,111,134,140,157,158,177,198,226,239,237,245,197,201,171,157,144,128,140,130,126,142,145,133,126,129,98,98,119,119,108,119,114,113,105,112,131,108,107,121,118,119,111,121,128,112,116,124,127,141,138,144,125,147,135,142,148,133,142,162,128,162,161,172,194,215,236,233,182,162,169,144,148,123,139,132,121,124,124,145,120,115,120,116,105,102,132,122,114,113,119,116,121,116,123,119,120,133,131,132,132,124,132,141,135,158,138,131,138,158,170,168,185,221,237,241,229,205,200,170,149,150,140,141,129,115,131,132,149,135,114,113,136,124,127,125,110,118,117,110];
  const L = 52, NTRAIN = 260, NOISE = 10, PEAK = 28;
  const truth = t => 120 + 0.04 * t + 14 * Math.cos(2 * Math.PI * (t - 26) / L);

  const T = Y.map((_, i) => i + 1);
  const tTrain = T.slice(0, NTRAIN), yTrain = Y.slice(0, NTRAIN);
  const tMon = T.slice(NTRAIN), yMon = Y.slice(NTRAIN);

  const TRIMS = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40];
  const state = { ti: 3, r: 1 };              // open on the common 15% default

  const handle = VIZ.card(MOUNT, { title: 'Trimming the training data before fitting', status: '\u2026' });
  const tabs     = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const top      = handle.body.append('div');
  const bottom   = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'Serfling, steps 1 to 4',
    lines: [
      '1  drop training weeks above the (1 − trim) quantile',
      '2  fit  y = b0 + b1 t + Σ [ γ cos(2πit/52) + δ sin(2πit/52) ]  by OLS',
      '3  U = baseline + 1.645 · s · √(1 + x′(X′X)⁻¹x)',
      '4  alarm on the second week in a row above U'
    ],
    hint: 'raise the trim and watch s and the threshold fall'
  });

  [[1, 'r = 1 harmonic'], [2, 'r = 2 harmonics']].forEach(([r, label]) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', state.r === r)
      .text(label)
      .on('click', () => { state.r = r; render(); });
  });

  let syncTrim;
  (function () {
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text('trim');
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'trim less').text('−');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'trim more').text('+');
    row.append('span').attr('class', 'd').text('share of the highest training weeks dropped before fitting');
    dec.on('click', () => { state.ti = Math.max(0, state.ti - 1); render(); });
    inc.on('click', () => { state.ti = Math.min(TRIMS.length - 1, state.ti + 1); render(); });
    syncTrim = () => {
      val.text(Math.round(TRIMS[state.ti] * 100) + '%');
      dec.property('disabled', state.ti <= 0);
      inc.property('disabled', state.ti >= TRIMS.length - 1);
    };
  })();

  function render() {
    syncTrim();
    tabs.selectAll('button').attr('aria-pressed', function () {
      return d3.select(this).text().startsWith('r = ' + state.r);
    });

    const trim = TRIMS[state.ti];
    const m = SERF.fit(tTrain, yTrain, { r: state.r, L, trim });
    const fitTrain = SERF.predict(m, tTrain, 1.645);
    const P = SERF.predict(m, tMon, 1.645);
    const F = SERF.partialF(m.tk, m.yk, L);

    const exceed = P.map((p, i) => yMon[i] > p.U);
    const alarm = SERF.twoWeek(exceed);
    const first = alarm.indexOf(true);              // 0-based season week
    const realRate = d3.mean(P, (p, i) => SERF.normUpper((p.U - truth(tMon[i])) / NOISE));
    const bias = P[PEAK - 1].yhat - truth(tMon[PEAK - 1]);
    const yMax = d3.max(Y) * 1.06;

    /* ---- top panel: the five training seasons ---- */
    top.html('');
    const p1 = VIZ.panel(d3.select(top.node()), {
      width: 720, height: 150, label: 'Training: five seasons',
      margin: { top: 8, right: 104, bottom: 24, left: 38 },
      desc: 'Five training seasons with trimmed weeks marked and the fitted baseline.'
    });
    const x1 = d3.scaleLinear().domain([0.5, NTRAIN + 0.5]).range([0, p1.w]);
    const y1 = d3.scaleLinear().domain([60, yMax]).range([p1.h, 0]);

    p1.g.append('path')
      .datum(tTrain)
      .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 1.4)
      .attr('d', d3.line().x(t => x1(t)).y(t => y1(truth(t))));

    yTrain.forEach((v, i) => {
      const kept = m.keep[i];
      p1.g.append('circle')
        .attr('cx', x1(tTrain[i])).attr('cy', y1(v)).attr('r', kept ? 1.7 : 2.2)
        .attr('fill', kept ? VIZ.C.blue : '#fff')
        .attr('fill-opacity', kept ? 0.55 : 1)
        .attr('stroke', kept ? 'none' : VIZ.C.amber)
        .attr('stroke-width', 1.3);
    });

    p1.g.append('path')
      .datum(fitTrain)
      .attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
      .attr('d', d3.line().x(d => x1(d.t)).y(d => y1(d.yhat)));

    if (isFinite(m.cut)) {
      VIZ.refLine(p1, { y: y1(m.cut), color: VIZ.C.amber, label: `cut ${m.cut.toFixed(0)}` });
    }
    const lastFit = fitTrain[fitTrain.length - 1];
    p1.g.append('text').attr('class', 'viz-reflabel')
      .attr('x', p1.w + 10).attr('y', y1(lastFit.yhat) + (isFinite(m.cut) ? 14 : 0))
      .attr('fill', VIZ.C.teal).text('fitted');

    VIZ.axisY(p1, y1, 3);
    p1.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p1.h})`)
      .call(d3.axisBottom(x1).tickValues([26, 78, 130, 182, 234])
        .tickFormat((_, k) => `season −${5 - k}`).tickSize(0).tickPadding(8));

    /* ---- bottom panel: the season being monitored ---- */
    bottom.html('');
    const p2 = VIZ.panel(d3.select(bottom.node()), {
      width: 720, height: 170, label: 'This season: baseline extrapolated, threshold applied',
      margin: { top: 8, right: 104, bottom: 26, left: 38 },
      desc: 'The monitored season with the baseline, the threshold and confirmed alarms.'
    });
    const x2 = d3.scaleLinear().domain([0.5, L + 0.5]).range([0, p2.w]);
    const y2 = d3.scaleLinear().domain([60, yMax]).range([p2.h, 0]);
    const bw = (p2.w / L) * 0.72;

    yMon.forEach((v, i) => {
      p2.g.append('rect')
        .attr('x', x2(i + 1) - bw / 2).attr('y', y2(v))
        .attr('width', bw).attr('height', p2.h - y2(v))
        .attr('fill', alarm[i] ? VIZ.C.redSoft : (exceed[i] ? VIZ.C.amber : VIZ.C.blue))
        .attr('fill-opacity', alarm[i] || exceed[i] ? 0.9 : 0.5);
    });

    const ln = f => d3.line().x((d, i) => x2(i + 1)).y(f);
    p2.g.append('path').datum(tMon)
      .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 1.4)
      .attr('d', ln(t => y2(truth(t))));
    p2.g.append('path').datum(P)
      .attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
      .attr('d', ln(d => y2(d.yhat)));
    p2.g.append('path').datum(P)
      .attr('fill', 'none').attr('stroke', VIZ.C.red).attr('stroke-width', 1.6)
      .attr('stroke-dasharray', '5 4')
      .attr('d', ln(d => y2(d.U)));

    // Direct labels at the right edge, nudged apart.
    const lab = [
      { y: y2(P[L - 1].U), t: 'threshold', c: VIZ.C.red },
      { y: y2(P[L - 1].yhat), t: 'baseline', c: VIZ.C.teal },
      { y: y2(truth(tMon[L - 1])), t: 'true baseline', c: VIZ.C.muted }
    ].sort((a, b) => a.y - b.y);
    for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 14) lab[i].y = lab[i - 1].y + 14;
    lab.forEach(l => p2.g.append('text').attr('class', 'viz-reflabel')
      .attr('x', p2.w + 10).attr('y', l.y).attr('fill', l.c).text(l.t));

    if (first >= 0) {
      VIZ.annotate(p2, { x: x2(first + 1), y: y2(yMon[first]) - 9, text: 'alarm', color: VIZ.C.red });
    }

    VIZ.axisY(p2, y2, 3);
    p2.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p2.h})`)
      .call(d3.axisBottom(x2).tickValues([1, 13, 26, 39, 52])
        .tickFormat(w => (w === 1 ? 'wk 1' : w)).tickSize(0).tickPadding(8));

    /* ---- readout ---- */
    const dropped = m.keep.filter(k => !k).length;
    const lead = first >= 0 ? PEAK - (first + 1) : null;
    const pct = v => (v * 100).toFixed(v < 0.01 ? 2 : 1) + '%';
    const fCrit = 3.0;

    handle.setStatus(lead === null ? 'No alarm'
      : (lead > 0 ? `Alarm ${lead} wk before peak` : 'Alarm at the peak'), 'ok');

    readout.html(
      (trim === 0
        ? '<b>No trimming.</b> Every epidemic week is fitted as if it were baseline'
        : `trimmed <b>${Math.round(trim * 100)}%</b> — ${dropped} of ${NTRAIN} training weeks dropped (amber)`) +
      `; residual s = <b>${m.s.toFixed(2)}</b> (true noise ${NOISE})<br>` +
      `harmonic-2 test on the kept weeks: F = <b>${F.F.toFixed(2)}</b> on (2, ${F.df2}) — ` +
      (F.F > fCrit ? '<span class="alarm">the test asks for it</span>' : '<span class="ok">not needed</span>') +
      '<br>' +
      `this season, at the peak the baseline sits ${bias >= 0 ? bias.toFixed(1) + ' above' : (-bias).toFixed(1) + ' below'} the truth; ` +
      `an ordinary week crosses this threshold <b>${pct(realRate)}</b> of the time (nominal 5%)<br>` +
      (first >= 0
        ? `first confirmed alarm: week ${first + 1} — <b>${lead} week${lead === 1 ? '' : 's'}</b> before the epidemic peaks (week ${PEAK})`
        : '<span class="alarm">no confirmed alarm this season</span>')
    );
  }

  render();
})();
