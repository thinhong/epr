/* ============================================================
   Figure 1 — What each version counts as comparable
   A five-year calendar. The 1996 version lights up seven weeks a
   year and throws the rest away; the 2013 version keeps almost
   everything by giving the year ten seasonal steps.
   ============================================================ */

(function () {
  const MOUNT = '#viz-farr-reference';
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

  const FREQ = 52, T_WEEK = 25, YEAR0 = 2026;
  const state = { version: 1996, b: 5, w: 3 };

  const LIMITS = {
    b: { min: 1, max: 5, label: 'years of history' },
    w: { min: 1, max: 6, label: 'weeks either side of week 25' }
  };

  /* Everything is measured as an offset in weeks from the week being
     assessed, which is offset 0. Working in offsets rather than in
     (year, week) pairs keeps the 26-week hold-out correct where it
     crosses the new year. */
  const offsetOf = (year, week) => -(YEAR0 - year) * FREQ + (week - T_WEEK);

  /* Which weeks the regression gets to see.
       1996: the +/- w window of each of the b past years, nothing else.
       2013: every week from the far edge of the oldest window up to 26
             weeks ago, each carrying the seasonal step it falls in. */
  function classify(year, week, s) {
    const off = offsetOf(year, week);
    if (off > 0) return 'future';
    if (off === 0) return 'target';

    const inWindow = Math.abs(((off % FREQ) + FREQ + 26) % FREQ - 26) <= s.w;
    const withinYears = off >= -(s.b * FREQ) - s.w;

    if (s.version === 1996) {
      return (inWindow && off <= -FREQ + s.w && withinYears) ? 'window' : 'unused';
    }

    if (off > -27) return 'held';            // the 26 weeks before now
    if (!withinYears) return 'unused';
    return inWindow ? 'window' : 'step' + seasonalStep(off, s.w);
  }

  /* The year cut into ten steps: the window itself is the reference
     level, and nine equal blocks fill the rest of the year. */
  function seasonalStep(off, w) {
    let d = ((off % FREQ) + FREQ + 26) % FREQ - 26;   // -26..+25 within the year
    const past = Math.abs(d) - w;
    const blockLen = Math.max(1, Math.round((FREQ - (2 * w + 1)) / 9));
    const k = Math.min(4, Math.max(0, Math.floor((past - 1) / blockLen)));
    return (d < 0 ? 1 : 6) + k;
  }

  const STEP_FILL = ['#cfe0f2', '#bcd4ee', '#a9c9ea', '#96bde6', '#83b2e2'];

  const handle = VIZ.card(MOUNT, { title: 'Reference weeks for week 25 of 2026', status: '' });

  const tabs     = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const grid     = handle.body.append('div');
  const readout  = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'reference set size',
    lines: [
      '1996   n = b(2w+1)                 the window only',
      '2013   n = 52b + w - 26            the window plus nine seasonal steps'
    ],
    hint: 'switch versions, then change b and w'
  });

  [[1996, 'Original 1996'], [2013, 'Improved 2013']].forEach(([v, label]) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', state.version === v)
      .text(label)
      .on('click', () => { state.version = v; render(); });
  });

  const syncers = ['b', 'w'].map(key => {
    const lim = LIMITS[key];
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text(key);
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `decrease ${key}`).text('−');
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
  });

  const W = 720, LABEL_W = 46, HEAD_H = 18, ROW_H = 17, ROW_GAP = 5;
  const CW = (W - LABEL_W - 4) / FREQ;

  function render() {
    syncers.forEach(f => f());
    tabs.selectAll('button').attr('aria-pressed', function () {
      return d3.select(this).text().indexOf(String(state.version)) >= 0;
    });

    const years = d3.range(0, state.b + 1).map(i => YEAR0 - i);
    const H = HEAD_H + years.length * (ROW_H + ROW_GAP) + 6;

    grid.html('');
    const svg = grid.append('svg')
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', `Calendar of ${state.b} years showing which weeks the ` +
                          `${state.version} version uses as reference data.`);

    svg.selectAll('text.wk').data([1, 13, 25, 39, 52]).join('text')
      .attr('class', 'wk')
      .attr('x', w => LABEL_W + (w - 0.5) * CW)
      .attr('y', 11)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10.5)
      .attr('font-weight', w => (w === T_WEEK ? 700 : 400))
      .attr('fill', w => (w === T_WEEK ? VIZ.C.ink : VIZ.C.muted))
      .text(w => (w === T_WEEK ? 'w25' : w));

    const counts = { window: 0, step: 0, held: 0, unused: 0 };

    years.forEach((year, ri) => {
      const y0 = HEAD_H + ri * (ROW_H + ROW_GAP);
      svg.append('text')
        .attr('x', LABEL_W - 8).attr('y', y0 + ROW_H / 2)
        .attr('text-anchor', 'end').attr('dominant-baseline', 'middle')
        .attr('font-size', 11).attr('font-weight', 600).attr('fill', VIZ.C.muted)
        .text(year);

      for (let week = 1; week <= FREQ; week++) {
        const cls = classify(year, week, state);
        let fill = '#ffffff', stroke = VIZ.C.rule;

        if (cls === 'target')      { fill = VIZ.C.red;   stroke = VIZ.C.red; }
        else if (cls === 'window') { fill = VIZ.C.blue;  stroke = VIZ.C.blue; counts.window++; }
        else if (cls.slice(0,4) === 'step') { fill = STEP_FILL[(+cls.slice(4) - 1) % 5]; stroke = fill; counts.step++; }
        else if (cls === 'held')   { fill = '#eef2f7'; stroke = '#e2e8f0'; counts.held++; }
        else if (cls === 'future') { fill = '#fcfdfe'; stroke = '#f4f7fa'; }
        else                       { fill = '#fbfcfe'; stroke = '#f0f3f7'; counts.unused++; }

        svg.append('rect')
          .attr('x', LABEL_W + (week - 1) * CW + 0.6).attr('y', y0)
          .attr('width', CW - 1.2).attr('height', ROW_H)
          .attr('rx', 2)
          .attr('fill', fill).attr('stroke', stroke).attr('stroke-width', 0.8);
      }
    });

    const used = counts.window + counts.step;
    const total = state.b * FREQ;   // the b years of history
    const pct = Math.round(used / total * 100);
    handle.setStatus(`${used} of ${total} weeks`, 'ok');

    const fmla = state.version === 1996
      ? `n = b(2w+1) = ${state.b}×${2 * state.w + 1} = <b>${used}</b>`
      : `n = 52b + w − 26 = ${52 * state.b} + ${state.w} − 26 = <b>${52 * state.b + state.w - 26}</b>`;

    readout.html(
      fmla + ` &nbsp; (<b>${pct}%</b> of the ${total} weeks in ${state.b} years)<br>` +
      (state.version === 1996
        ? `${counts.window} weeks in the ±${state.w}-week window; the other ` +
          `${counts.unused} are discarded, so a past outbreak outside the window never matters — ` +
          `and neither does any other evidence about trend or dispersion.`
        : `${counts.window} weeks in the window (the reference level) plus ${counts.step} weeks ` +
          `carried by nine seasonal steps; ${counts.held} recent weeks are held out so a new ` +
          `outbreak cannot raise its own threshold.`)
    );
  }

  render();
})();
