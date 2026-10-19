/* ============================================================
   Figure 2 — Reporting delay
   A week's count is not finished when the week is. Judge it too
   early and it sits below a threshold built from complete weeks.
   The tabs switch between taking the partial count at face value
   and scaling it back up by the share expected to have arrived.
   ============================================================ */

(function () {
  const MOUNT = '#viz-delay';
  const el = document.querySelector(MOUNT);
  if (!el) return;

  const missing = [];
  if (typeof d3  === 'undefined') missing.push('d3');
  if (typeof VIZ === 'undefined') missing.push('viz-kit.js');
  if (missing.length) {
    el.innerHTML = '<div class="viz-missing">Figure did not load \u2014 not available: <b>' +
      missing.join('</b>, <b>') + '</b>. Check that every script is listed at the ' +
      'bottom of the chapter, in order, and that the .js files sit next to the .qmd.</div>';
    return;
  }

  /* Final counts once every case has been reported. */
  const FINAL = [7,13,8,5,6,15,15,14,12,17,13,11,9,14,15,9,11,10,12,16,20,9,21,10,
                 15,16,18,35,32,33,21,19,13,9,12,8,8,13,12,8];

  /* Share of a week's cases that has arrived by delay 0, 1, 2, ... weeks. */
  const PROF = [0.34, 0.28, 0.18, 0.11, 0.06, 0.03];
  const CUM = PROF.reduce((a, v) => (a.push((a[a.length - 1] || 0) + v), a), []);

  const N = FINAL.length, THRESH = 22;
  const state = { wait: 0, corrected: false };

  const share = d => CUM[Math.min(d, CUM.length - 1)];
  const known = (i, wait) => Math.round(FINAL[i] * share(wait));
  const judged = (i, wait, corrected) =>
    corrected ? Math.round(known(i, wait) / share(wait)) : known(i, wait);

  const handle = VIZ.card(MOUNT, { title: 'Judging a week before its cases have arrived', status: 'As reported' });

  const tabs    = handle.body.append('div').attr('class', 'viz-tabs');
  const paramBar = handle.body.append('div').attr('class', 'viz-params');
  const chart   = handle.body.append('div');
  const readout = handle.body.append('div').attr('class', 'viz-readout');

  VIZ.formula(handle.body, {
    title: 'reporting profile \u00b7 share arrived by each delay',
    lines: [
      'delay      0     1     2     3     4     5',
      'arrived   34%   62%   80%   91%   97%  100%',
      'threshold 22 cases, calibrated on complete weeks'
    ],
    hint: 'set the wait, then switch tabs to see what the correction recovers'
  });

  [['As reported', false], ['Delay-corrected', true]].forEach(([label, corrected]) => {
    tabs.append('button')
      .attr('class', 'viz-tab').attr('type', 'button')
      .attr('aria-pressed', state.corrected === corrected)
      .text(label)
      .on('click', () => { state.corrected = corrected; render(); });
  });

  // Declared out here: a named function expression binds its own name only
  // inside its body, so render() could not reach it otherwise.
  let syncWait;

  (function () {
    const row = paramBar.append('div').attr('class', 'viz-param');
    row.append('span').attr('class', 'k').text('d');
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'fewer weeks').text('\u2212');
    const val = row.append('span').attr('class', 'v');
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', 'more weeks').text('+');
    row.append('span').attr('class', 'd').text('weeks waited before judging a week');

    dec.on('click', () => { state.wait = Math.max(0, state.wait - 1); render(); });
    inc.on('click', () => { state.wait = Math.min(5, state.wait + 1); render(); });

    syncWait = () => {
      val.text(state.wait);
      dec.property('disabled', state.wait <= 0);
      inc.property('disabled', state.wait >= 5);
    };
  })();

  function render() {
    syncWait();
    tabs.selectAll('button').attr('aria-pressed', function () {
      return (d3.select(this).text() === 'Delay-corrected') === state.corrected;
    });
    const seen = d3.range(N).map(i => judged(i, state.wait, state.corrected));
    const trueEx = d3.range(N).filter(i => FINAL[i] > THRESH);
    const caught = trueEx.filter(i => seen[i] > THRESH);
    const missed = trueEx.filter(i => seen[i] <= THRESH);

    handle.setStatus(`${caught.length} of ${trueEx.length} caught`,
                     missed.length ? 'alarm' : 'ok');

    chart.html('');
    const p = VIZ.panel(d3.select(chart.node()), {
      width: 720, height: 210,
      margin: { top: 26, right: 84, bottom: 30, left: 38 },
      desc: 'Weekly counts as judged under the current waiting rule, against their final values.'
    });

    const x = d3.scaleLinear().domain([0.5, N + 0.5]).range([0, p.w]);
    const y = d3.scaleLinear().domain([0, d3.max(FINAL) * 1.12]).range([p.h, 0]);
    const bw = Math.max(4, (p.w / N) * 0.74);

    // Outline: what the week will eventually turn out to be.
    p.g.selectAll('rect.final').data(d3.range(N)).join('rect')
      .attr('class', 'final')
      .attr('x', i => x(i + 1) - bw / 2).attr('y', i => y(FINAL[i]))
      .attr('width', bw).attr('height', i => p.h - y(FINAL[i]))
      .attr('fill', 'none').attr('stroke', VIZ.C.grey).attr('stroke-width', 1);

    // Solid: what the week looks like when it is judged.
    p.g.selectAll('rect.seen').data(d3.range(N)).join('rect')
      .attr('class', 'seen')
      .attr('x', i => x(i + 1) - bw / 2).attr('y', i => y(seen[i]))
      .attr('width', bw).attr('height', i => p.h - y(seen[i]))
      .attr('fill', i => (seen[i] > THRESH ? VIZ.C.redSoft : VIZ.C.blue));

    // A hollow ring over each exceedance the rule fails to see.
    missed.forEach(i => {
      p.g.append('circle')
        .attr('cx', x(i + 1)).attr('cy', y(FINAL[i]) - 9).attr('r', 4.5)
        .attr('fill', 'none').attr('stroke', VIZ.C.red).attr('stroke-width', 2);
    });

    VIZ.refLine(p, { y: y(THRESH), color: VIZ.C.red, label: 'threshold 22' });
    VIZ.axisY(p, y, 3);
    VIZ.axisX(p, x, 8);

    const verdict = missed.length === 0
      ? `<span class="ok">all ${trueEx.length} caught</span>`
      : `<span class="alarm">${missed.length} of ${trueEx.length} missed</span> (weeks ${missed.map(i => i + 1).join(', ')})`;

    readout.html(
      `waiting <b>${state.wait}</b> week${state.wait === 1 ? '' : 's'} means judging on ` +
      `<b>${Math.round(share(state.wait) * 100)}%</b> of each week's eventual cases` +
      (state.corrected ? ', scaled back up by that share' : ', taken at face value') + '<br>' +
      `weeks that eventually exceed 22: ${trueEx.map(i => i + 1).join(', ')} \u2014 ${verdict}` +
      (caught.length && state.wait > 0
        ? `<br>every alarm arrives <b>${state.wait}</b> week${state.wait === 1 ? '' : 's'} after the week it describes`
        : '')
    );
  }

  render();
})();
