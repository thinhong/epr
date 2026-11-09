/* ============================================================
   Four methods on French influenza-like illness data
   Souty et al. (2018), Sentinelles network, against an
   expert-consensus gold standard. One tab per metric; each
   method's best detector.

   Rates are drawn as dots on a 0.4–1.0 axis rather than as
   bars: a bar implies a zero baseline, and cut at 0.4 it would
   make 0.976 against 0.985 look like a real gap.
   ============================================================ */

(function () {
  const MOUNT = '#viz-serf-compare';
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

  const METHODS = [
    { key: 'serf', name: 'Periodic regression (Serfling)', color: () => VIZ.C.blue },
    { key: 'rob',  name: 'Robust regression',              color: () => VIZ.C.teal },
    { key: 'mem',  name: 'Moving Epidemic Method (MEM)',   color: () => VIZ.C.amber },
    { key: 'hmm',  name: 'Hidden Markov model (HMM)',      color: () => VIZ.C.muted }
  ];

  const METRICS = [
    { id: 'start', tab: 'Detected start', v: { serf: 0.875, rob: 0.750, mem: 0.875, hmm: 0.500 },
      say: 'share of seasons whose start was detected. Serfling and MEM tie at 0.875; robust ' +
           'regression split the 2000/01 season into two epidemics.' },
    { id: 'sens', tab: 'Sensitivity', v: { serf: 0.874, rob: 0.791, mem: 0.919, hmm: 0.946 },
      say: 'share of epidemic weeks flagged as epidemic. MEM is more sensitive than Serfling.' },
    { id: 'spec', tab: 'Specificity', v: { serf: 0.985, rob: 0.985, mem: 0.976, hmm: 0.914 },
      say: 'share of non-epidemic weeks left unflagged. Serfling and robust regression share the highest value.' },
    { id: 'ppv', tab: 'PPV', v: { serf: 0.958, rob: 0.959, mem: 0.926, hmm: 0.791 },
      say: 'positive predictive value: share of flagged weeks that were truly epidemic. Serfling is above MEM.' },
    { id: 'npv', tab: 'NPV', v: { serf: 0.962, rob: 0.941, mem: 0.976, hmm: 0.983 },
      say: 'negative predictive value: share of unflagged weeks that were truly non-epidemic.' },
    { id: 'delay', tab: 'Timeliness', v: { serf: -0.2, rob: 0.1, mem: -0.3, hmm: -1.1 },
      say: 'mean difference from the gold-standard start, in weeks. Negative is earlier.' }
  ];

  const state = { mi: 0 };

  const handle = VIZ.card(MOUNT, { title: 'Four methods on French influenza-like illness data', status: '…' });
  const tabs    = handle.body.append('div').attr('class', 'viz-tabs');
  const chart   = handle.body.append('div');
  const readout = handle.body.append('div').attr('class', 'viz-readout');

  METRICS.forEach((m, i) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', i === state.mi)
      .text(m.tab)
      .on('click', () => { state.mi = i; render(); });
  });

  function render() {
    const m = METRICS[state.mi];
    tabs.selectAll('button').attr('aria-pressed', (_, i) => i === state.mi);
    handle.setStatus(m.tab, 'ok');

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 168,
      margin: { top: 10, right: 60, bottom: 44, left: 230 },
      desc: `${m.tab} for four detection methods.`
    });

    const isDelay = m.id === 'delay';
    const x = isDelay
      ? d3.scaleLinear().domain([-1.5, 0.5]).range([0, p.w])
      : d3.scaleLinear().domain([0.4, 1.0]).range([0, p.w]);
    const y = d3.scaleBand().domain(METHODS.map(d => d.key)).range([0, p.h]).padding(0.35);
    const mid = d => y(d.key) + y.bandwidth() / 2;

    // Faint row guides so each dot reads against its own method.
    METHODS.forEach(d => {
      p.g.append('line').attr('x1', 0).attr('x2', p.w).attr('y1', mid(d)).attr('y2', mid(d))
        .attr('stroke', VIZ.C.rule).attr('stroke-width', 1);
      p.g.append('text').attr('x', -14).attr('y', mid(d))
        .style('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('font-size', 12.5).attr('font-weight', d.key === 'serf' ? 700 : 500)
        .attr('fill', VIZ.C.ink).text(d.name);
    });

    if (isDelay) {
      // A signed quantity has a real zero, so bars are honest here.
      p.g.append('line').attr('x1', x(0)).attr('x2', x(0)).attr('y1', -4).attr('y2', p.h)
        .attr('stroke', VIZ.C.ink).attr('stroke-width', 1.2);
      METHODS.forEach(d => {
        const v = m.v[d.key];
        p.g.append('rect')
          .attr('x', Math.min(x(0), x(v))).attr('y', y(d.key))
          .attr('width', Math.abs(x(v) - x(0))).attr('height', y.bandwidth())
          .attr('rx', 3).attr('fill', d.color());
        p.g.append('text')
          .attr('x', v < 0 ? x(v) - 8 : x(v) + 8).attr('y', mid(d))
          .style('text-anchor', v < 0 ? 'end' : 'start').attr('dominant-baseline', 'middle')
          .attr('font-size', 12).attr('font-weight', 700).attr('fill', VIZ.C.ink)
          .text(`${v > 0 ? '+' : ''}${v.toFixed(1)} wk`);
      });
      p.g.append('text').attr('x', x(0) - 8).attr('y', p.h + 38)
        .style('text-anchor', 'end').attr('font-size', 11).attr('fill', VIZ.C.muted).text('← earlier');
      p.g.append('text').attr('x', x(0) + 8).attr('y', p.h + 38)
        .style('text-anchor', 'start').attr('font-size', 11).attr('fill', VIZ.C.muted).text('later →');
      p.g.append('g').attr('class', 'viz-axis viz-axis--bare').attr('transform', `translate(0,${p.h})`)
        .call(d3.axisBottom(x).tickValues([-1.5, -1, -0.5, 0, 0.5]).tickSize(0).tickPadding(8));
    } else {
      const best = d3.max(METHODS, d => m.v[d.key]);
      METHODS.forEach(d => {
        const v = m.v[d.key];
        p.g.append('circle').attr('cx', x(v)).attr('cy', mid(d)).attr('r', 7)
          .attr('fill', d.color()).attr('stroke', '#fff').attr('stroke-width', 1.5);
        p.g.append('text').attr('x', x(v) + 13).attr('y', mid(d))
          .attr('dominant-baseline', 'middle').attr('font-size', 12)
          .attr('font-weight', v === best ? 700 : 500).attr('fill', VIZ.C.ink)
          .text(v.toFixed(3));
      });
      p.g.append('g').attr('class', 'viz-axis').attr('transform', `translate(0,${p.h})`)
        .call(d3.axisBottom(x).tickValues([0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
          .tickFormat(d3.format('.1f')).tickSize(0).tickPadding(8));
    }

    readout.html(`<b>${m.tab}</b> — ${m.say}`);
  }

  render();
})();
