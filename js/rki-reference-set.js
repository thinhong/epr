/* ============================================================
   Figure 1 — Building the reference set
   A year × week calendar. The reader sets b, w and w0 and sees
   exactly which weeks are pulled into the comparison, what they
   average to, and where the threshold lands.

   The worked example from the text is the default state:
   b = 3, w = 1, w0 = 2, week 25 of 2026.
   ============================================================ */

(function () {
  const MOUNT = '#viz-refset';
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

  const WEEKS = d3.range(18, 33);          // columns shown: weeks 18–32
  const T_YEAR = 2026, T_WEEK = 25;        // the week under assessment

  /* Notified cases. Weeks 25 onward of 2026 have not happened yet. */
  const Y = {
    2026: { 18: 12, 19: 13, 20: 15, 21: 16, 22: 17, 23: 19, 24: 22 },
    2025: { 18: 9, 19: 10, 20: 11, 21: 12, 22: 13, 23: 14, 24: 15, 25: 18, 26: 20, 27: 21, 28: 22, 29: 23, 30: 23, 31: 24, 32: 25 },
    2024: { 18: 7, 19: 8, 20: 9, 21: 10, 22: 11, 23: 11, 24: 12, 25: 14, 26: 16, 27: 17, 28: 18, 29: 19, 30: 19, 31: 20, 32: 21 },
    2023: { 18: 6, 19: 7, 20: 7, 21: 8, 22: 9, 23: 9, 24: 10, 25: 11, 26: 13, 27: 14, 28: 15, 29: 16, 30: 16, 31: 17, 32: 18 },
    2022: { 18: 5, 19: 5, 20: 6, 21: 7, 22: 7, 23: 8, 24: 9, 25: 10, 26: 11, 27: 12, 28: 13, 29: 13, 30: 14, 31: 15, 32: 15 },
    2021: { 18: 4, 19: 5, 20: 5, 21: 6, 22: 6, 23: 7, 24: 8, 25: 8, 26: 10, 27: 11, 28: 11, 29: 12, 30: 13, 31: 13, 32: 14 }
  };

  const state = { b: 3, w: 1, w0: 2, obs: 21 };

  const LIMITS = {
    b:  { min: 0, max: 5,  label: 'past years used' },
    w:  { min: 0, max: 6,  label: 'weeks either side of week 25' },
    w0: { min: 0, max: 6,  label: 'recent weeks of 2026' },
    obs: { min: 5, max: 40, label: 'cases actually notified in week 25' }
  };

  /* ---- the method itself ------------------------------------ */

  // Which cells the reference set is made of, in the order the
  // formula lists them.
  function refCells(s) {
    const cells = [];
    for (let i = 1; i <= s.b; i++)
      for (let j = -s.w; j <= s.w; j++) cells.push({ year: T_YEAR - i, week: T_WEEK + j });
    for (let k = s.w0; k >= 1; k--) cells.push({ year: T_YEAR, week: T_WEEK - k });
    return cells.filter(c => Y[c.year] && Y[c.year][c.week] !== undefined);
  }

  /* ---- chrome ------------------------------------------------ */

  const handle = VIZ.card(MOUNT, {
    title: 'Reference set for week 25 of 2026',
    status: 'No signal'
  });

  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const gridWrap = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'RKI \u00b7 reference set and threshold',
    lines: [
      'R = { y(t-52i+j) : i = 1..b, j = -w..w }  \u222a  { y(t-k) : k = 1..w0 }',
      'U = CI95[ floor(mean R) ]   when mean R <= 20',
      'U = mean R + 2 \u00b7 sd R     when mean R  > 20',
      'signal when observed > U'
    ],
    hint: 'set b, w and w0 to change which weeks are compared'
  });

  function stepper(key) {
    const lim = LIMITS[key];
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text(key === 'obs' ? 'N' : key);

    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `decrease ${key}`).text('\u2212');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `increase ${key}`).text('+');

    row.append('span').attr('class', 'd').text(lim.label);

    dec.on('click', () => { state[key] = Math.max(lim.min, state[key] - 1); render(); });
    inc.on('click', () => { state[key] = Math.min(lim.max, state[key] + 1); render(); });

    return () => {
      val.text(state[key]);
      dec.property('disabled', state[key] <= lim.min);
      inc.property('disabled', state[key] >= lim.max);
    };
  }

  const syncParams = ['b', 'w', 'w0', 'obs'].map(stepper);

  /* ---- drawing ----------------------------------------------- */

  const W = 720, LABEL_W = 66, HEAD_H = 22, ROW_H = 30, ROW_STEP = 38;
  const CW = Math.floor((W - LABEL_W - 8) / WEEKS.length);   // column width

  function render() {
    syncParams.forEach(f => f());

    const cells = refCells(state);
    const key = c => `${c.year}-${c.week}`;
    const chosen = new Set(cells.map(key));
    const vals = cells.map(c => Y[c.year][c.week]);
    const res = RKI.threshold(vals);
    const alarm = res ? state.obs > res.U : false;

    const years = d3.range(0, Math.max(state.b, 0) + 1).map(i => T_YEAR - i);
    const H = HEAD_H + years.length * ROW_STEP + 6;

    gridWrap.html('');
    const svg = gridWrap.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label',
        `Calendar grid. ${cells.length} weeks selected as reference values for week 25 of 2026.`);

    const cx = w => LABEL_W + WEEKS.indexOf(w) * CW;

    // Week numbers along the top; the week under test is named.
    svg.selectAll('text.wk').data(WEEKS).join('text')
      .attr('class', 'wk')
      .attr('x', w => cx(w) + CW / 2)
      .attr('y', 14)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11.5)
      .attr('font-weight', w => (w === T_WEEK ? 700 : 400))
      .attr('fill', w => (w === T_WEEK ? VIZ.C.ink : VIZ.C.muted))
      .text(w => w);

    years.forEach((year, ri) => {
      const y0 = HEAD_H + ri * ROW_STEP;
      const g = svg.append('g');

      g.append('text')
        .attr('x', LABEL_W - 12).attr('y', y0 + ROW_H / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('font-size', 12.5).attr('font-weight', 600)
        .attr('fill', ri === 0 ? VIZ.C.ink : VIZ.C.muted)
        .text(year);

      WEEKS.forEach(week => {
        const v = Y[year] ? Y[year][week] : undefined;
        const isTarget = (year === T_YEAR && week === T_WEEK);
        const isRef = chosen.has(`${year}-${week}`);
        const future = (v === undefined && !isTarget);

        let fill = '#ffffff', stroke = VIZ.C.rule, sw = 1, tcol = VIZ.C.muted, tw = 400;

        if (future) { fill = '#fafbfc'; stroke = '#eef1f5'; }
        // A selected cell is part of what "expected" means, so it takes
        // the expected-level colour.
        if (isRef) { fill = 'rgba(14,154,171,.15)'; stroke = VIZ.C.teal; tcol = VIZ.C.ink; tw = 600; }
        if (isTarget) {
          sw = 2;
          stroke = alarm ? VIZ.C.red : VIZ.C.blue;
          fill = alarm ? 'rgba(224,87,78,.14)' : 'rgba(27,77,199,.08)';
          tcol = alarm ? VIZ.C.red : VIZ.C.blue;
          tw = 700;
        }

        g.append('rect')
          .attr('x', cx(week) + 1.5).attr('y', y0)
          .attr('width', CW - 3).attr('height', ROW_H)
          .attr('rx', 5)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', sw);

        const shown = isTarget ? state.obs : v;
        if (shown !== undefined) {
          g.append('text')
            .attr('x', cx(week) + CW / 2).attr('y', y0 + ROW_H / 2 + 0.5)
            .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            .attr('font-size', 12.5).attr('font-weight', tw).attr('fill', tcol)
            .text(shown);
        }
      });
    });

    /* ---- readout ---------------------------------------------- */

    if (!res) {
      handle.setStatus('Empty reference set', 'idle');
      readout.html('<b>No reference weeks selected.</b> Raise b or w0 — ' +
                   'the method needs something to compare week 25 against.');
      return;
    }

    const f2 = d3.format('.2f');
    const branchLine = res.branch === 'poisson'
      ? `mean R = ${f2(res.mu)} \u2264 20 \u2192 Poisson table at floor(mean R) = ${res.idx} \u2192 <b>U = ${f2(res.U)}</b>`
      : `mean R = ${f2(res.mu)} > 20 \u2192 normal approximation, sd R = ${f2(res.sd)} \u2192 <b>U = ${f2(res.U)}</b>`;

    const verdict = alarm
      ? `<span class="alarm">${state.obs} &gt; ${f2(res.U)} \u2192 signal</span>`
      : `<span class="ok">${state.obs} \u2264 ${f2(res.U)} \u2192 no signal</span>`;

    handle.setStatus(alarm ? 'Signal' : 'No signal', alarm ? 'alarm' : 'ok');

    readout.html(
      `n = ${res.n} reference weeks &nbsp; { ${vals.join(', ')} }<br>` +
      branchLine + '<br>' +
      `week 25 of 2026 notified ${state.obs} cases &nbsp; ${verdict}`
    );
  }

  render();
})();