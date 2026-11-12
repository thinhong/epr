/* ============================================================
   Four steps on one data set
   Five simulated seasons of training data and a sixth to monitor.
   Pick a way of cleaning the history, then step through Serfling's
   procedure: clean, fit and extrapolate, set the threshold, require
   two weeks. The data are simulated, so the true baseline (grey)
   and the real false alarm rate of every threshold are known.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serfl-walk';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3   === 'undefined') missing.push('d3');
  if (typeof VIZ  === 'undefined') missing.push('viz-kit.js');
  if (typeof SERF === 'undefined') missing.push('serfling-core.js');
  if (!missing.length && (!VIZ.slider || !SERF.fitRobust || !SERF.demo)) missing.push('the current viz-kit.js / serfling-core.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files are the current versions.</div>';
    return;
  }

  const D = SERF.demo, L = D.L, N = D.ntrain, NOISE = D.noise, PEAK = D.peak, Z = 1.645;
  const T = D.Y.map((_, i) => i + 1);
  const tTrain = T.slice(0, N), yTrain = D.Y.slice(0, N);
  const tMon = T.slice(N), yMon = D.Y.slice(N);
  const isEpi = t => D.excess(t) > 5;
  const nEpiTrain = tTrain.filter(isEpi).length;
  const TRUE = { b0: 120, b1: 0.04, g1: -14, d1: 0 };

  const METHODS = [
    { id: 'none', tab: 'No cleaning' },
    { id: 'cal',  tab: 'By calendar' },
    { id: 'pct',  tab: 'By percentile' },
    { id: 'iter', tab: 'Iteratively' },
    { id: 'rob',  tab: 'Robustly' }
  ];
  const STAGES = ['Clean', 'Fit', 'Threshold', 'Two weeks'];
  const state = { mi: 2, stage: 1, trim: 0.15, from: 14, to: 40 };

  /* ---- fitting, cached per setting ---- */
  const cache = new Map();
  function model() {
    const id = METHODS[state.mi].id;
    const key = id === 'pct' ? `pct${state.trim}` : id === 'cal' ? `cal${state.from}-${state.to}` : id;
    if (cache.has(key)) return cache.get(key);
    let m;
    if (id === 'none') m = SERF.fit(tTrain, yTrain, { r: 1, L, trim: 0 });
    else if (id === 'pct') m = SERF.fit(tTrain, yTrain, { r: 1, L, trim: state.trim });
    else if (id === 'cal') m = SERF.fitCalendar(tTrain, yTrain, { r: 1, L, from: state.from, to: state.to });
    else if (id === 'iter') m = SERF.fitIterative(tTrain, yTrain, { r: 1, L });
    else m = SERF.fitRobust(tTrain, yTrain, { r: 1, L });
    m.id = id;
    m.fitTrain = SERF.predict(m, tTrain, Z);
    m.P = SERF.predict(m, tMon, Z);
    m.exceed = m.P.map((p, i) => yMon[i] > p.U);
    m.alarm = SERF.twoWeek(m.exceed);
    m.onset = m.alarm.indexOf(true);
    m.realRate = d3.mean(m.P, (p, i) => SERF.normUpper((p.U - D.truth(tMon[i])) / NOISE));
    m.bias = m.P.map((p, i) => p.yhat - D.truth(tMon[i]));
    if (id !== 'rob') m.F = SERF.partialF(m.tk, m.yk, L);
    cache.set(key, m);
    return m;
  }

  /* ---- the card ---- */
  const handle   = VIZ.card(MOUNT, { title: 'Four steps on one data set', status: '…' });
  const tabs     = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params viz-params--sliders');
  const stages   = handle.body.append('div').attr('class', 'viz-stages');
  const top      = handle.body.append('div');
  const bottom   = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');
  const box      = VIZ.formula(handle.body, { title: 'Serfling, step by step', lines: [] });
  const boxLines = box.append('div');
  box.append('div').attr('class', 'viz-formula-hint')
    .text('step through once, then switch the cleaning method at any step to compare');

  METHODS.forEach((M, i) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', i === state.mi)
      .text(M.tab)
      .on('click', () => { state.mi = i; render(); });
  });

  /* Method-specific settings: one slider for the percentile, two for the calendar. */
  const pctSlider = VIZ.slider(paramBar, {
    sym: 'trim', label: 'share of training weeks dropped', desc: 'share of the highest training weeks dropped',
    min: 0.05, max: 0.40, step: 0.05, value: state.trim, format: v => Math.round(v * 100) + '%',
    onChange: v => { state.trim = v; render(); }
  });
  const fromSlider = VIZ.slider(paramBar, {
    sym: 'from', label: 'first season week dropped', desc: 'first season week dropped (week 1 is July)',
    min: 6, max: 26, step: 1, value: state.from,
    onChange: v => { state.from = v; render(); }
  });
  const toSlider = VIZ.slider(paramBar, {
    sym: 'to', label: 'last season week dropped', desc: 'last season week dropped',
    min: 27, max: 48, step: 1, value: state.to,
    onChange: v => { state.to = v; render(); }
  });
  const noParam = paramBar.append('div').attr('class', 'viz-param').style('grid-column', '1 / -1')
    .append('span').attr('class', 'd');

  STAGES.forEach((s, i) => {
    if (i) stages.append('span').attr('class', 'viz-stage-sep');
    const b = stages.append('button').attr('class', 'viz-stage').attr('type', 'button')
      .on('click', () => { state.stage = i + 1; render(); });
    b.append('span').attr('class', 'n').text(i + 1);
    b.append('span').text(s);
  });

  const f1 = d3.format('.1f'), f2 = d3.format('.2f'), f3 = d3.format('.3f'), f4 = d3.format('.4f');
  const sgn = (v, f) => (v < 0 ? '−' : '+') + f(Math.abs(v));
  const neg = (v, f) => (v < 0 ? '−' : '') + f(Math.abs(v));
  const pct = v => (v * 100).toFixed(v < 0.01 ? 2 : 1) + '%';
  const vs = v => (v >= 0 ? `${f1(v)} above` : `${f1(-v)} below`);

  function render() {
    const M = METHODS[state.mi], m = model(), st = state.stage;

    tabs.selectAll('button').attr('aria-pressed', (_, i) => i === state.mi);
    pctSlider.node.style('display', M.id === 'pct' ? null : 'none');
    fromSlider.node.style('display', M.id === 'cal' ? null : 'none');
    toSlider.node.style('display', M.id === 'cal' ? null : 'none');
    noParam.node().parentNode.style.display = (M.id === 'pct' || M.id === 'cal') ? 'none' : null;
    noParam.text({
      none: 'every training week is fitted, epidemics included',
      iter: 'no setting: the data decide when to stop (Wang et al. 2015)',
      rob: 'no setting: Huber weights with k = 1.345, as MASS::rlm()'
    }[M.id] || '');

    stages.selectAll('.viz-stage')
      .classed('is-done', (_, i) => i + 1 < st)
      .attr('aria-current', (_, i) => (i + 1 === st ? 'step' : null));
    if (backBtn) backBtn.property('disabled', st <= 1);
    if (nextBtn) nextBtn.property('disabled', st >= 4);

    drawTop(m, st);
    drawBottom(m, st);
    writeFormula(M.id, st);
    writeReadout(M.id, m, st);

    const lead = m.onset >= 0 ? PEAK - (m.onset + 1) : null;
    if (st < 4) handle.setStatus(`Step ${st} of 4`, 'idle');
    else handle.setStatus(lead === null ? 'No alarm'
      : (lead > 0 ? `Alarm ${lead} wk before peak` : 'Alarm at the peak'), 'alarm');
  }

  const yMax = d3.max(D.Y) * 1.06;

  /* ---- top: the five training seasons ---- */
  function drawTop(m, st) {
    top.html('');
    const p = VIZ.panel(d3.select(top.node()), {
      width: 720, height: 150, label: 'Training: five seasons',
      margin: { top: 8, right: 104, bottom: 24, left: 38 },
      desc: 'Five training seasons, the weeks removed or downweighted, and the fitted baseline.'
    });
    const x = d3.scaleLinear().domain([0.5, N + 0.5]).range([0, p.w]);
    const y = d3.scaleLinear().domain([60, yMax]).range([p.h, 0]);

    if (m.id === 'cal') {
      d3.range(5).forEach(k => {
        p.g.append('rect')
          .attr('x', x(k * L + m.from - 0.5)).attr('y', 0)
          .attr('width', x(k * L + m.to + 0.5) - x(k * L + m.from - 0.5)).attr('height', p.h)
          .attr('fill', VIZ.C.surfaceAlt);
      });
    }

    if (st >= 2) {
      p.g.append('path').datum(tTrain)
        .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 1.4)
        .attr('d', d3.line().x(t => x(t)).y(t => y(D.truth(t))));
    }

    yTrain.forEach((v, i) => {
      let r = 1.7, fill = VIZ.C.blue, op = 0.55, stroke = 'none';
      if (m.id === 'rob') {
        const w = m.weights[i];
        if (w < 0.999) { r = 2.3; op = 0.6 * w; stroke = VIZ.C.amber; }
      } else if (!m.keep[i]) {
        r = 2.2; fill = '#fff'; op = 1; stroke = VIZ.C.amber;
      }
      p.g.append('circle').attr('cx', x(tTrain[i])).attr('cy', y(v)).attr('r', r)
        .attr('fill', fill).attr('fill-opacity', op).attr('stroke', stroke).attr('stroke-width', 1.3);
    });

    if (st === 1 && m.id === 'pct') {
      VIZ.refLine(p, { y: y(m.cut), color: VIZ.C.amber, label: `cut ${m.cut.toFixed(0)}` });
    }
    if (st === 1 && m.id === 'iter') {
      const f0 = SERF.predict(m.first, tTrain, Z);
      p.g.append('path').datum(f0)
        .attr('fill', 'none').attr('stroke', VIZ.C.muted).attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '2 3')
        .attr('d', d3.line().x(d => x(d.t)).y(d => y(d.yhat)));
      p.g.append('text').attr('class', 'viz-reflabel').attr('x', p.w + 10)
        .attr('y', y(f0[N - 1].yhat)).attr('fill', VIZ.C.muted)
        .text('round-1 fit');
    }

    if (st >= 2) {
      p.g.append('path').datum(m.fitTrain)
        .attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
        .attr('d', d3.line().x(d => x(d.t)).y(d => y(d.yhat)));
      const lab = [
        { y: y(m.fitTrain[N - 1].yhat), t: 'fitted', c: VIZ.C.teal },
        { y: y(D.truth(N)), t: 'true baseline', c: VIZ.C.muted }
      ].sort((a, b) => a.y - b.y);
      if (lab[1].y - lab[0].y < 14) lab[1].y = lab[0].y + 14;
      lab.forEach(l => p.g.append('text').attr('class', 'viz-reflabel')
        .attr('x', p.w + 10).attr('y', l.y).attr('fill', l.c).text(l.t));
    }

    VIZ.axisY(p, y, 3);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x).tickValues([26, 78, 130, 182, 234])
        .tickFormat((_, k) => `season −${5 - k}`).tickSize(0).tickPadding(8));
  }

  /* ---- bottom: the season being monitored ---- */
  function drawBottom(m, st) {
    bottom.html('');
    const p = VIZ.panel(d3.select(bottom.node()), {
      width: 720, height: 170,
      label: st === 1 ? 'This season: not used yet' : 'This season: baseline extrapolated' +
        (st >= 3 ? ', threshold applied' : ''),
      margin: { top: 8, right: 104, bottom: 26, left: 38 },
      desc: 'The monitored season with the extrapolated baseline, the threshold and confirmed alarms.'
    });
    const x = d3.scaleLinear().domain([0.5, L + 0.5]).range([0, p.w]);
    const y = d3.scaleLinear().domain([60, yMax]).range([p.h, 0]);
    const bw = (p.w / L) * 0.72;
    const P = m.P;

    yMon.forEach((v, i) => {
      let fill = st === 1 ? VIZ.C.grey : VIZ.C.blue, op = st === 1 ? 0.9 : 0.4;
      if (st === 4) {
        fill = m.alarm[i] ? VIZ.C.redSoft : (m.exceed[i] ? VIZ.C.amber : VIZ.C.blue);
        op = m.alarm[i] || m.exceed[i] ? 0.9 : 0.45;
      }
      p.g.append('rect').attr('x', x(i + 1) - bw / 2).attr('y', y(v))
        .attr('width', bw).attr('height', p.h - y(v)).attr('fill', fill).attr('fill-opacity', op);
    });

    if (st >= 2) {
      const ln = f => d3.line().x((d, i) => x(i + 1)).y(f);
      if (st >= 3) {
        p.g.append('path').datum(P).attr('fill', VIZ.C.red).attr('opacity', 0.07)
          .attr('d', d3.area().x((d, i) => x(i + 1)).y0(d => y(d.yhat)).y1(d => y(d.U)));
      }
      p.g.append('path').datum(tMon)
        .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 1.4)
        .attr('d', ln(t => y(D.truth(t))));
      p.g.append('path').datum(P)
        .attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
        .attr('d', ln(d => y(d.yhat)));
      if (st >= 3) {
        p.g.append('path').datum(P)
          .attr('fill', 'none').attr('stroke', VIZ.C.red).attr('stroke-width', 1.6)
          .attr('stroke-dasharray', '5 4').attr('d', ln(d => y(d.U)));
      }
      const lab = [
        { y: y(P[L - 1].yhat), t: 'baseline', c: VIZ.C.teal },
        { y: y(D.truth(tMon[L - 1])), t: 'true baseline', c: VIZ.C.muted }
      ];
      if (st >= 3) lab.push({ y: y(P[L - 1].U), t: 'threshold', c: VIZ.C.red });
      lab.sort((a, b) => a.y - b.y);
      for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 14) lab[i].y = lab[i - 1].y + 14;
      lab.forEach(l => p.g.append('text').attr('class', 'viz-reflabel')
        .attr('x', p.w + 10).attr('y', l.y).attr('fill', l.c).text(l.t));
    }

    if (st === 4 && m.onset >= 0) {
      VIZ.annotate(p, { x: x(m.onset + 1), y: y(yMon[m.onset]) - 9, text: 'alarm', color: VIZ.C.red });
    }
    if (st >= 2) {
      p.g.append('text').attr('x', x(PEAK)).attr('y', p.h + 22).attr('font-size', 10.5)
        .attr('fill', VIZ.C.muted).style('text-anchor', 'middle').text('▲ epidemic peak');
    }

    VIZ.axisY(p, y, 3);
    p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(x).tickValues([1, 13, 39, 52])
        .tickFormat(w => (w === 1 ? 'wk 1' : w)).tickSize(0).tickPadding(8));
  }

  /* ---- formula box: the four steps, the current one in bold ---- */
  function writeFormula(id, st) {
    const step1 = {
      none: '1  clean      nothing removed',
      cal:  `1  clean      drop season weeks ${state.from}–${state.to} in every season`,
      pct:  `1  clean      drop weeks above the ${Math.round(100 - 100 * state.trim)}th percentile`,
      iter: '1  clean      drop above the fit, then above its 95% limit; stop when R² stops rising',
      rob:  '1  clean      keep every week; weight w = min(1, 1.345 / |e / MAD|)'
    }[id];
    const lines = [
      step1,
      `2  fit        Ŷ = β₀ + β₁t + γ₁cos(2πt/52) + δ₁sin(2πt/52)   by ${id === 'rob' ? 'IRLS' : 'OLS'}`,
      '3  threshold  U = Ŷ + 1.645 · s · √(1 + x′(X′X)⁻¹x)',
      '4  alarm      the second week in a row above U'
    ];
    boxLines.html('');
    lines.forEach((l, i) => boxLines.append('div').text(l)
      .style('font-weight', i + 1 === st ? 700 : null)
      .style('color', i + 1 === st ? VIZ.C.ink : null)
      .style('opacity', i + 1 > st ? 0.5 : null));
  }

  /* ---- readout: what this step did, with this cleaning method ---- */
  function writeReadout(id, m, st) {
    const used = m.keep.filter(Boolean).length;
    const dropped = tTrain.filter((_, i) => !m.keep[i]);
    const dropEpi = dropped.filter(isEpi).length;
    const tally = `${dropped.length} of ${N} training weeks dropped (amber rings): ${dropEpi} epidemic, ` +
      `${dropped.length - dropEpi} ordinary; ${nEpiTrain - dropEpi} of the ${nEpiTrain} epidemic weeks stay in`;

    let html = '';
    if (st === 1) {
      if (id === 'none') {
        html = `<b>No cleaning.</b> All ${N} weeks go into the fit, including all ${nEpiTrain} epidemic weeks.`;
      } else if (id === 'cal') {
        html = `<b>By calendar.</b> Season weeks ${state.from}–${state.to} (shaded) are dropped in every season, ` +
          `whatever they hold.<br>${tally}`;
      } else if (id === 'pct') {
        html = `<b>By percentile.</b> Weeks above the ${Math.round(100 - 100 * state.trim)}th percentile ` +
          `(y > ${m.cut.toFixed(1)}) are dropped, wherever they fall.<br>${tally}`;
      } else if (id === 'iter') {
        const rows = m.rounds.map(r => r.accepted
          ? `round ${r.round}: drop ${r.dropped} week${r.dropped === 1 ? '' : 's'} above ` +
            `${r.round === 1 ? 'the first fitted line (dotted)' : 'the upper 95% prediction limit'} → R² ${f3(r.prevR2)} → <b>${f3(r.R2)}</b>`
          : `round ${r.round}: would drop ${r.dropped} more, but R² falls to ${f4(r.R2)} (from ${f4(r.prevR2)}) → <b>stop</b>`);
        html = `<b>Iteratively.</b> ${rows.join('<br>')}<br>${tally}`;
      } else {
        const low = m.weights.filter(w => w < 0.999).length;
        html = `<b>Robustly.</b> All ${N} weeks are kept. After ${m.iterations} reweighting passes, ` +
          `${low} weeks have weight below 1 (amber rings; paler = lower weight), the lowest ${f2(d3.min(m.weights))}.<br>` +
          `Epidemic weeks still carry ${Math.round(100 * d3.sum(tTrain, (t, i) => isEpi(t) ? m.weights[i] : 0) / nEpiTrain)}% ` +
          `of their full weight on average.`;
      }
    } else if (st === 2) {
      const b = m.beta;
      html = `fitted on ${id === 'rob' ? `all ${N} weeks, weighted` : `${used} weeks`}: ` +
        `β₀ = <b>${f1(b[0])}</b> (true 120) · β₁ = <b>${f3(b[1])}</b> (0.04) · ` +
        `γ₁ = <b>${neg(b[2], f1)}</b> (−14) · δ₁ = <b>${neg(b[3], f1)}</b> (0)<br>` +
        `extrapolated into this season, the baseline sits ${vs(m.bias[PEAK - 1])} the true baseline at the epidemic peak ` +
        `and ${vs(m.bias[0])} it in week 1<br>` +
        (m.F ? `test for a second harmonic on the weeks used: F = <b>${f1(m.F.F)}</b> on (2, ${m.F.df2}) — ` +
          (m.F.F > 3.0 ? '<span class="alarm">it asks for one: leftover epidemics</span>' : '<span class="ok">r = 1 is enough</span>')
          : 'the partial F test assumes least squares; with robust weights, compare models another way');
    } else if (st === 3) {
      const gap = m.P[PEAK - 1].U - m.P[PEAK - 1].yhat;
      html = `residual standard deviation s = <b>${f2(m.s)}</b> (the true noise is ${NOISE}) → the threshold sits ` +
        `<b>${f1(gap)}</b> above the baseline at the peak (true 1.645 × 10 ≈ 16.5)<br>` +
        `an ordinary week crosses this threshold <b>${pct(m.realRate)}</b> of the time (nominal 5%): ` +
        (m.realRate < 0.015 ? '<span class="alarm">far too high, epidemics will be flagged late</span>'
          : m.realRate < 0.035 ? 'on the high side, fewer false alarms but later warnings'
          : m.realRate <= 0.07 ? '<span class="ok">about right</span>'
          : m.realRate <= 0.10 ? 'on the low side, more false alarms'
          : '<span class="alarm">too low, frequent false alarms</span>');
    } else {
      const nEx = m.exceed.filter(Boolean).length, nAl = m.alarm.filter(Boolean).length;
      const falseAl = m.alarm.filter((a, i) => a && !isEpi(tMon[i])).length;
      const lead = m.onset >= 0 ? PEAK - (m.onset + 1) : null;
      html = `${nEx} week${nEx === 1 ? '' : 's'} above the threshold; ${nAl} confirmed by the week before (red)` +
        (falseAl ? `, <span class="alarm">${falseAl} of them outside the epidemic</span>` : ', all inside the epidemic') + '<br>' +
        (m.onset >= 0
          ? `first confirmed alarm: week ${m.onset + 1} — <b>${lead} week${lead === 1 ? '' : 's'}</b> before the epidemic peaks (week ${PEAK})`
          : '<span class="alarm">no confirmed alarm this season</span>');
    }
    readout.html(html);
  }

  let backBtn, nextBtn;
  const btns = VIZ.controls(handle.el, [
    { id: 'next', label: 'Next step ▶', kind: 'primary',
      onClick: () => { state.stage = Math.min(4, state.stage + 1); render(); } },
    { id: 'back', label: '◀ Back', kind: 'ghost',
      onClick: () => { state.stage = Math.max(1, state.stage - 1); render(); } },
    { label: '↺ Start over', kind: 'ghost', onClick: () => { state.stage = 1; render(); } }
  ]);
  nextBtn = btns.next; backBtn = btns.back;

  render();
})();
