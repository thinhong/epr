/* ============================================================
   Serfling (1963), redrawn from the published figures.
   (a) The fitted baseline for 108 US cities and an illustrative
       threshold 1.64 x 27.9 deaths above it. Hover to read the
       numbers for any four-week period.
   (b) The analysis of variance that decided r = 1.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serf-1963';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3  === 'undefined') missing.push('d3');
  if (typeof VIZ === 'undefined') missing.push('viz-kit.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load — not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  /* Serfling's equation. t is in four-week periods; t = 0 is the midpoint
     of the period ending 24 September 1955, i.e. about 10 September. */
  const SD = 27.9, Z = 1.64, TMAX = 26;
  const trend = t => 300.5 + 2.1 * t;
  const base  = t => trend(t) + 97.6 * Math.cos(2 * Math.PI * t / 13 - 2.67);
  const thr   = t => base(t) + Z * SD;
  const PEAK  = 2.67 * 13 / (2 * Math.PI);                 // 5.524 periods
  const ORIGIN = new Date(1955, 8, 10);
  const dateAt = t => new Date(ORIGIN.getTime() + t * 28 * 86400000);
  const fmtDate = d3.timeFormat('%-d %b %Y');

  const handle = VIZ.card(MOUNT, { title: 'Serfling (1963): pneumonia and influenza deaths, 108 US cities', status: 'r = 1' });
  const top     = handle.body.append('div');
  const readout = handle.body.append('div').attr('class', 'viz-readout');
  const bottom  = handle.body.append('div');

  VIZ.formula(handle.body, {
    title: 'the fitted baseline, deaths per week',
    lines: [
      'Y(t) = 300.5 + 2.1 t + 97.6 cos(2πt/13 − 2.67)',
      'threshold ≈ Y(t) + 1.64 × 27.9',
      'F = 8,136 / 13,157 = 0.62 < 1  →  keep r = 1'
    ],
    hint: 'hover the curve to read any four-week period'
  });

  /* ---- (a) baseline and threshold ---- */
  const p = VIZ.panel(top, {
    width: 720, height: 210, label: '(a) Baseline and epidemic threshold',
    margin: { top: 14, right: 118, bottom: 44, left: 44 },
    desc: 'Serfling baseline, long-run trend and illustrative threshold over 26 four-week periods.'
  });
  const ts = d3.range(0, TMAX + 0.001, 0.05);
  const x = d3.scaleLinear().domain([0, TMAX]).range([0, p.w]);
  const y = d3.scaleLinear().domain([180, 520]).range([p.h, 0]);

  p.g.append('path')
    .datum(ts)
    .attr('fill', VIZ.C.blue).attr('opacity', 0.09)
    .attr('d', d3.area().x(t => x(t)).y0(t => y(base(t))).y1(t => y(thr(t))));

  const line = f => d3.line().x(t => x(t)).y(t => y(f(t)))(ts);
  p.g.append('path').attr('d', line(trend))
    .attr('fill', 'none').attr('stroke', VIZ.C.muted).attr('stroke-width', 1.4)
    .attr('stroke-dasharray', '2 4');
  p.g.append('path').attr('d', line(thr))
    .attr('fill', 'none').attr('stroke', VIZ.C.red).attr('stroke-width', 1.6)
    .attr('stroke-dasharray', '6 4');
  p.g.append('path').attr('d', line(base))
    .attr('fill', 'none').attr('stroke', VIZ.C.blue).attr('stroke-width', 2.6);

  // Direct labels at the right edge, nudged apart.
  const lab = [
    { y: y(thr(TMAX)),   t: 'threshold',  c: VIZ.C.red },
    { y: y(trend(TMAX)), t: 'trend',      c: VIZ.C.muted },
    { y: y(base(TMAX)),  t: 'baseline Ŷ', c: VIZ.C.blue }
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < lab.length; i++) if (lab[i].y - lab[i - 1].y < 15) lab[i].y = lab[i - 1].y + 15;
  lab.forEach(l => p.g.append('text').attr('class', 'viz-reflabel')
    .attr('x', p.w + 10).attr('y', l.y).attr('fill', l.c).text(l.t));

  [PEAK, PEAK + 13].forEach((t, k) => {
    p.g.append('circle').attr('cx', x(t)).attr('cy', y(base(t))).attr('r', 4.5)
      .attr('fill', VIZ.C.blue).attr('stroke', '#fff').attr('stroke-width', 1.5);
    if (k === 0) {
      p.g.append('text').attr('class', 'viz-annot')
        .attr('x', x(t)).attr('y', y(thr(t)) - 10).attr('fill', VIZ.C.ink)
        .text('peak t ≈ 5.5 (Feb 1956)');
    }
  });

  VIZ.axisY(p, y, 4);
  p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
    .call(d3.axisBottom(x).tickValues(d3.range(0, TMAX + 1, 2)).tickSize(0).tickPadding(8));
  p.g.append('text')
    .attr('x', p.w / 2).attr('y', p.h + 38).attr('font-size', 11).attr('fill', VIZ.C.muted)
    .style('text-anchor', 'middle')
    .text('t, four-week periods (t = 0 is the midpoint of the period ending 24 Sep 1955)');

  // Hover: a guide line and the numbers behind it.
  const guide = p.g.append('line').attr('y1', 0).attr('y2', p.h)
    .attr('stroke', VIZ.C.ink).attr('stroke-width', 1).attr('opacity', 0);
  const dot = p.g.append('circle').attr('r', 4).attr('fill', VIZ.C.blue).attr('opacity', 0);

  function say(t) {
    if (t === null) {
      readout.html(
        `the seasonal wave adds up to <b>97.6</b> deaths a week to the trend, peaking at ` +
        `t = 2.67 × 13 / 2π = <b>${PEAK.toFixed(2)}</b> periods — around ` +
        `<b>${fmtDate(dateAt(PEAK))}</b><br>` +
        `the threshold sits 1.64 × 27.9 = <b>${(Z * SD).toFixed(1)}</b> deaths above the baseline`
      );
      return;
    }
    readout.html(
      `t = <b>${t.toFixed(1)}</b> — around <b>${fmtDate(dateAt(t))}</b><br>` +
      `trend ${trend(t).toFixed(1)}, seasonal wave ${(base(t) - trend(t) >= 0 ? '+' : '')}` +
      `${(base(t) - trend(t)).toFixed(1)} → baseline <b>${base(t).toFixed(1)}</b>, ` +
      `threshold <b>${thr(t).toFixed(1)}</b> deaths per week`
    );
  }

  p.g.append('rect').attr('width', p.w).attr('height', p.h).attr('fill', 'transparent')
    .style('cursor', 'crosshair')
    .on('pointermove', function (event) {
      const t = Math.max(0, Math.min(TMAX, x.invert(d3.pointer(event, this)[0])));
      guide.attr('x1', x(t)).attr('x2', x(t)).attr('opacity', 0.25);
      dot.attr('cx', x(t)).attr('cy', y(base(t))).attr('opacity', 1);
      say(t);
    })
    .on('pointerleave', () => { guide.attr('opacity', 0); dot.attr('opacity', 0); say(null); });

  say(null);

  /* ---- (b) analysis of variance ---- */
  const q = VIZ.panel(bottom, {
    width: 720, height: 92, label: '(b) Analysis of variance: is a second harmonic needed?',
    margin: { top: 8, right: 70, bottom: 26, left: 250 },
    desc: 'Mean squares for the second harmonic and for the residual.'
  });
  const rows = [
    { lab: 'added by harmonic 2', sub: 'SS 16,272 on 2 df', ms: 8136, c: VIZ.C.amber },
    { lab: 'residual, r = 2 model', sub: 'SS 434,189 on 33 df', ms: 13157, c: VIZ.C.muted }
  ];
  const xb = d3.scaleLinear().domain([0, 16000]).range([0, q.w]);
  const yb = d3.scaleBand().domain(rows.map(r => r.lab)).range([0, q.h]).padding(0.28);

  rows.forEach(r => {
    q.g.append('rect').attr('x', 0).attr('y', yb(r.lab))
      .attr('width', xb(r.ms)).attr('height', yb.bandwidth()).attr('rx', 3).attr('fill', r.c);
    q.g.append('text').attr('x', xb(r.ms) + 8).attr('y', yb(r.lab) + yb.bandwidth() / 2)
      .attr('dominant-baseline', 'middle').attr('font-size', 12).attr('font-weight', 700)
      .attr('fill', VIZ.C.ink).text(d3.format(',')(r.ms));
    q.g.append('text').attr('x', -12).attr('y', yb(r.lab) + yb.bandwidth() / 2 - 7)
      .style('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', 12).attr('font-weight', 600).attr('fill', VIZ.C.ink).text(r.lab);
    q.g.append('text').attr('x', -12).attr('y', yb(r.lab) + yb.bandwidth() / 2 + 8)
      .style('text-anchor', 'end').attr('dominant-baseline', 'middle')
      .attr('font-size', 11).attr('fill', VIZ.C.muted).text(r.sub);
  });
  q.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${q.h})`)
    .call(d3.axisBottom(xb).ticks(4).tickFormat(d3.format(',')).tickSize(0).tickPadding(8));
})();
