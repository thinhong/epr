/* ============================================================
   Figure 1: which weeks count as comparable
   One row per year, one bar per week, so the season is visible.
   The window (weeks 25 - w to 25 + w) cuts down through the b
   previous years; those weeks, and only those, become the
   baseline. The current year is never used.
   ============================================================ */

(function () {
  const MOUNT = '#viz-farr-reference';
  const el = document.querySelector(MOUNT);
  if (!el) return;
  const missing = [];
  if (typeof d3 === 'undefined') missing.push('d3');
  if (typeof VIZ === 'undefined') missing.push('viz-kit.js');
  if (typeof FDATA === 'undefined') missing.push('farrington-data.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load. Not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check the script list at the end of the chapter.</div>';
    return;
  }

  const { SERIES, NOW_YEAR, NOW_WEEK } = FDATA;
  const state = { b: 5, w: 3 };
  const LIM = { b: [1, 5], w: [0, 12] };

  el.classList.add('farr-card');
  const card = VIZ.card(MOUNT, { title: 'Comparable weeks for week 25 of 2026', status: ' ' });
  const params = card.body.append('div').attr('class', 'viz-params');
  const chart = card.body.append('div').attr('class', 'farr-chart');
  const readout = card.body.append('div').attr('class', 'viz-readout farr-readout');

  function stepper(key, label) {
    const row = params.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text(key);
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'decrease ' + key).text('\u2212');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'increase ' + key).text('+');
    row.append('span').attr('class', 'd').text(label);
    dec.on('click', () => { state[key] = Math.max(LIM[key][0], state[key] - 1); draw(); });
    inc.on('click', () => { state[key] = Math.min(LIM[key][1], state[key] + 1); draw(); });
    return () => {
      val.text(state[key]);
      dec.property('disabled', state[key] <= LIM[key][0]);
      inc.property('disabled', state[key] >= LIM[key][1]);
    };
  }
  const sync = [stepper('b', 'years back'), stepper('w', 'weeks either side')];

  const years = d3.range(NOW_YEAR, NOW_YEAR - 6, -1);          // 2026 at the top
  const vmax = d3.max(years, yr => d3.max(SERIES[yr]));

  function draw() {
    sync.forEach(f => f());
    const W = Math.max(300, chart.node().clientWidth || 720);
    const small = W < 520;
    const LW = small ? 40 : 50, RW = 6, TOP = 22, AX = 26;
    const rowH = small ? 34 : 44, gap = small ? 7 : 9;
    const cw = (W - LW - RW) / 52;
    const bw = Math.max(1.4, cw - (cw > 7 ? 2 : 1));
    const H = TOP + years.length * (rowH + gap) + AX;
    const lo = NOW_WEEK - state.w, hi = NOW_WEEK + state.w;
    const used = yr => yr < NOW_YEAR && yr >= NOW_YEAR - state.b;
    const x = wk => LW + (wk - 1) * cw;
    const rowTop = i => TOP + i * (rowH + gap);
    const h = v => (v / vmax) * (rowH - 3);

    chart.html('');
    const svg = chart.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
      .attr('role', 'img')
      .attr('aria-label', `Weekly counts 2021 to 2026, one row per year. The baseline is weeks ${lo} to ${hi} of the ${state.b} previous years.`);

    // the window, drawn behind the bars of the years it covers
    const iTop = years.indexOf(NOW_YEAR - 1), iBot = years.indexOf(NOW_YEAR - state.b);
    svg.append('rect').attr('class', 'farr-band')
      .attr('x', x(lo) - 3).attr('width', x(hi + 1) - x(lo) + 6)
      .attr('y', rowTop(iTop) - 4).attr('height', rowTop(iBot) + rowH - rowTop(iTop) + 8)
      .attr('rx', 7);

    years.forEach((yr, i) => {
      const y0 = rowTop(i), base = y0 + rowH;
      const isNow = yr === NOW_YEAR, inB = used(yr);
      svg.append('text').attr('class', 'farr-year' + (isNow ? ' is-now' : inB ? ' is-used' : ''))
        .attr('x', LW - 8).attr('y', base - rowH / 2).text(yr);
      svg.append('line').attr('class', 'farr-baseline')
        .attr('x1', LW).attr('x2', W - RW).attr('y1', base + 0.5).attr('y2', base + 0.5);
      SERIES[yr].forEach((v, k) => {
        const wk = k + 1;
        let cls = 'farr-bar';
        if (isNow) cls += wk === NOW_WEEK ? ' is-now' : ' is-current-year';
        else if (inB && wk >= lo && wk <= hi) cls += ' is-base';
        else if (!inB) cls += ' is-out';
        svg.append('rect').attr('class', cls)
          .attr('x', x(wk) + (cw - bw) / 2).attr('width', bw)
          .attr('y', base - h(v)).attr('height', Math.max(0.8, h(v)))
          .attr('rx', Math.min(1.5, bw / 3));
      });
      if (isNow) {
        const xn = x(NOW_WEEK) + cw / 2, v = SERIES[yr][NOW_WEEK - 1];
        svg.append('text').attr('class', 'farr-now-label')
          .attr('x', xn).attr('y', base - h(v) - 7).text('this week');
      }
    });

    // week axis
    const ax = svg.append('g').attr('class', 'farr-axis');
    [1, 13, NOW_WEEK, 39, 52].forEach(wk => {
      ax.append('text').attr('x', x(wk) + cw / 2).attr('y', H - 6)
        .attr('class', wk === NOW_WEEK ? 'is-now' : null).text(wk === 1 ? 'week 1' : wk);
    });

    const n = state.b * (2 * state.w + 1);
    card.setStatus(`${n} baseline weeks`, 'ok');
    let coach = 'Same time of year in every row, so the model needs no seasonal term.';
    if (state.b < 3) coach = 'Fewer than 3 years: the model will not be allowed a trend.';
    else if (state.w >= 7) coach = 'A window this wide reaches into the quieter weeks around the peak.';
    else if (state.w === 0) coach = 'One week per year: very few points to fit a model to.';
    readout.html(`n = b(2w + 1) = ${state.b} \u00d7 ${2 * state.w + 1} = <b>${n}</b> weeks<br>` +
                 `<span class="farr-coach">${coach}</span>`);
  }

  draw();
  let last = 0;
  new ResizeObserver(() => {
    const w = chart.node().clientWidth;
    if (Math.abs(w - last) > 4) { last = w; draw(); }
  }).observe(chart.node());
})();
