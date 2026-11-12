/* ============================================================
   Serfling in four steps — the procedure at a glance
   Four small panels drawn from the same simulated series the
   chapter works through later: clean the history, fit and
   extrapolate, set the threshold, require two weeks. Each card
   links to the full description of its step.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serfl-glance';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3   === 'undefined') missing.push('d3');
  if (typeof VIZ  === 'undefined') missing.push('viz-kit.js');
  if (typeof SERF === 'undefined') missing.push('serfling-core.js');
  if (missing.length || (typeof SERF !== 'undefined' && !SERF.demo)) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      (missing.length ? missing.join('</b>, <b>') : 'SERF.demo (update serfling-core.js)') +
      '</b>. Check that every script is listed at the bottom of the chapter, in order, ' +
      'and that the .js files are the current versions.</div>';
    return;
  }

  const D = SERF.demo, L = D.L, N = D.ntrain;
  const T = D.Y.map((_, i) => i + 1);
  const tTrain = T.slice(0, N), yTrain = D.Y.slice(0, N);
  const tMon = T.slice(N), yMon = D.Y.slice(N);

  const m = SERF.fit(tTrain, yTrain, { r: 1, L, trim: 0.15 });
  const P = SERF.predict(m, tMon, 1.645);
  const exceed = P.map((p, i) => yMon[i] > p.U);
  const alarm = SERF.twoWeek(exceed);
  const first = alarm.indexOf(true);

  const SHOW_FROM = N - 2 * L + 1;                 // the last two training seasons
  const W = 220, H = 118, M = { top: 8, right: 6, bottom: 8, left: 6 };
  const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
  const yS = d3.scaleLinear().domain([80, 270]).range([ih, 0]);

  const STEPS = [
    { n: 1, title: 'Clean the history', href: '#serfl-step-1',
      text: 'Drop or downweight past epidemic weeks, so the history describes years without them.' },
    { n: 2, title: 'Fit and extrapolate', href: '#serfl-step-2',
      text: 'Fit trend + Fourier waves by regression and project the baseline into the new season.' },
    { n: 3, title: 'Set the threshold', href: '#serfl-step-3',
      text: 'Baseline + 1.645 × the standard deviation of the forecast error.' },
    { n: 4, title: 'Require two weeks', href: '#serfl-step-4',
      text: 'Declare an epidemic only when two weeks in a row are above the threshold.' }
  ];

  /* ---- the four panels ---- */
  const draw = {};

  function train(g, x, faint) {
    tTrain.forEach((t, i) => {
      if (t < SHOW_FROM) return;
      const kept = m.keep[i];
      if (faint && !kept) return;
      g.append('circle').attr('cx', x(t)).attr('cy', yS(yTrain[i])).attr('r', kept ? 1.5 : 2)
        .attr('fill', kept ? VIZ.C.blue : '#fff').attr('fill-opacity', kept ? (faint ? 0.3 : 0.6) : 1)
        .attr('stroke', kept ? 'none' : VIZ.C.amber).attr('stroke-width', 1.1);
    });
  }

  draw[1] = g => {
    const x = d3.scaleLinear().domain([SHOW_FROM - 0.5, N + 0.5]).range([0, iw]);
    train(g, x, false);
    g.append('line').attr('x1', 0).attr('x2', iw).attr('y1', yS(m.cut)).attr('y2', yS(m.cut))
      .attr('stroke', VIZ.C.amber).attr('stroke-width', 1.2).attr('stroke-dasharray', '4 3');
  };

  draw[2] = g => {
    const x = d3.scaleLinear().domain([SHOW_FROM - 0.5, T.length + 0.5]).range([0, iw]);
    g.append('rect').attr('x', x(N + 0.5)).attr('y', -M.top).attr('width', iw - x(N + 0.5) + M.right)
      .attr('height', H).attr('fill', '#fff').attr('opacity', 0.75);
    train(g, x, true);
    const fitT = SERF.predict(m, d3.range(SHOW_FROM, N + 1), 1.645);
    g.append('path').datum(fitT).attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
      .attr('d', d3.line().x(d => x(d.t)).y(d => yS(d.yhat)));
    g.append('path').datum(P).attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 3').attr('d', d3.line().x(d => x(d.t)).y(d => yS(d.yhat)));
  };

  const xMon = d3.scaleLinear().domain([0.5, L + 0.5]).range([0, iw]);

  draw[3] = g => {
    g.append('path').datum(P).attr('fill', VIZ.C.red).attr('opacity', 0.08)
      .attr('d', d3.area().x((d, i) => xMon(i + 1)).y0(d => yS(d.yhat)).y1(d => yS(d.U)));
    g.append('path').datum(P).attr('fill', 'none').attr('stroke', VIZ.C.teal).attr('stroke-width', 2)
      .attr('d', d3.line().x((d, i) => xMon(i + 1)).y(d => yS(d.yhat)));
    g.append('path').datum(P).attr('fill', 'none').attr('stroke', VIZ.C.red).attr('stroke-width', 1.6)
      .attr('stroke-dasharray', '5 4').attr('d', d3.line().x((d, i) => xMon(i + 1)).y(d => yS(d.U)));
    const k = 6, a = P[k - 1];
    g.append('line').attr('x1', xMon(k)).attr('x2', xMon(k)).attr('y1', yS(a.yhat)).attr('y2', yS(a.U))
      .attr('stroke', VIZ.C.ink).attr('stroke-width', 1.2);
    g.append('text').attr('x', xMon(k) - 2).attr('y', yS(a.U) - 9)
      .attr('font-size', 11).attr('font-weight', 600)
      .attr('fill', VIZ.C.ink).text('+ 1.645 σ̂');
  };

  draw[4] = g => {
    const bw = (iw / L) * 0.7;
    yMon.forEach((v, i) => {
      g.append('rect').attr('x', xMon(i + 1) - bw / 2).attr('y', yS(v))
        .attr('width', bw).attr('height', ih - yS(v))
        .attr('fill', alarm[i] ? VIZ.C.redSoft : (exceed[i] ? VIZ.C.amber : VIZ.C.blue))
        .attr('fill-opacity', alarm[i] || exceed[i] ? 0.9 : 0.4);
    });
    g.append('path').datum(P).attr('fill', 'none').attr('stroke', VIZ.C.red).attr('stroke-width', 1.4)
      .attr('stroke-dasharray', '5 4').attr('d', d3.line().x((d, i) => xMon(i + 1)).y(d => yS(d.U)));
    if (first >= 0) {
      g.append('text').attr('x', xMon(first + 1) - 4).attr('y', yS(yMon[first]) - 6)
        .style('text-anchor', 'end').attr('font-size', 11).attr('font-weight', 700)
        .attr('fill', VIZ.C.red).text('alarm');
    }
  };

  /* ---- the cards ---- */
  const handle = VIZ.card(MOUNT, { title: 'Serfling in four steps' });
  const flow = handle.body.append('div').attr('class', 'viz-flow');

  STEPS.forEach(s => {
    const card = flow.append('a').attr('class', 'viz-flow-step').attr('href', s.href);
    const head = card.append('div').attr('class', 'viz-flow-head');
    head.append('span').attr('class', 'viz-flow-num').text(s.n);
    head.append('span').attr('class', 'viz-flow-title').text(s.title);
    const svg = card.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', `Step ${s.n}: ${s.title}`);
    svg.append('rect').attr('width', W).attr('height', H).attr('rx', 6).attr('fill', VIZ.C.surfaceAlt);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
    draw[s.n](g);
    card.append('p').attr('class', 'viz-flow-text').text(s.text);
  });
})();
