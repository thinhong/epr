/* ============================================================
   Figure 2: the regression, fitted to the windows
   The 35 baseline weeks sit in five clusters on the time axis
   (t = 1-7, 53-59, ..., 209-215). One quasi-Poisson line goes
   through all of them and is carried on to this week, t0 = 264.
   Drag a year up or down: the line, the dispersion and the three
   trend rules update as surveillance::algo.farrington computes
   them (first fit, before any week is downweighted).
   ============================================================ */

(function () {
  const MOUNT = '#viz-farr-fit';
  const el = document.querySelector(MOUNT);
  if (!el) return;
  if (typeof d3 === 'undefined' || typeof VIZ === 'undefined' || typeof FARR === 'undefined' ||
      typeof FDATA === 'undefined' || typeof FPLOT === 'undefined') {
    el.innerHTML = '<div class="viz-missing">Figure did not load. Check that d3, viz-kit.js, ' +
      'farrington-core.js, farrington-data.js and farrington-plot.js are listed, in that order, at the end of the chapter.</div>';
    return;
  }

  const B = 5, W = 3, LO = 3, HI = 44;
  const base = FDATA.windows(B, W);
  const T0 = base.t0, Y0 = base.y0;
  const clusters = d3.range(B).map(c => {
    const pts = base.pts.filter(p => p.cluster === c);
    return { c, year: pts[0].year, t1: pts[0].t, t2: pts[pts.length - 1].t,
             orig: pts.map(p => p.y), mean: d3.mean(pts, p => p.y) };
  });
  const state = { m: clusters.map(() => 1), hover: -1 };

  /* Moving a year scales its mean by m and its scatter by sqrt(m), so the
     weeks keep their pattern and stay Poisson-like. Counts stay whole. */
  function data() {
    const t = [], y = [], who = [];
    clusters.forEach((cl, c) => {
      const m = state.m[c], mu = cl.mean;
      cl.orig.forEach((v, k) => {
        t.push(cl.t1 + k);
        y.push(Math.max(0, Math.round(m * mu + (v - mu) * Math.sqrt(m))));
        who.push({ c, year: cl.year, week: FDATA.NOW_WEEK - W + k });
      });
    });
    return { t, y, who };
  }

  el.classList.add('farr-card');
  const card = VIZ.card(MOUNT, { title: 'One line through the five windows', status: ' ' });
  const box = card.body.append('div').attr('class', 'farr-model').attr('aria-live', 'polite');
  const chart = card.body.append('div').attr('class', 'farr-chart');
  const rules = card.body.append('div').attr('class', 'farr-rules');
  const foot = card.body.append('div').attr('class', 'farr-foot');
  foot.append('span').attr('class', 'farr-hint')
    .html('Drag a <b aria-hidden="true">\u2195</b> handle to move that year up or down.');
  foot.append('button').attr('class', 'viz-btn viz-btn--ghost farr-reset').attr('type', 'button')
    .text('Reset').on('click', () => { state.m = clusters.map(() => 1); update(); });

  let raf = 0;
  const plot = FPLOT.create(chart, {
    clusters, t0: T0, yMax: 64, draggable: true,
    desc: 'Baseline counts in five yearly windows, with the fitted line carried to this week.',
    onDrag(c, value, step) {
      const now = clusters[c].mean * state.m[c];
      const target = value == null ? now + step : value;
      state.m[c] = Math.max(LO, Math.min(HI, target)) / clusters[c].mean;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; update(); });
    },
    onHover(i) { if (i !== state.hover) { state.hover = i; update(); } }
  });

  const f2 = v => v.toFixed(2), f1 = FPLOT.f1;

  function update() {
    const d = data();
    const r = FARR.run(d.t, d.y, T0, { b: B, alpha: 0.05, reweight: false });
    const rej = (!r.keep && r.rules) ? r.withTrend.fit.beta : null;
    plot.draw({
      t: d.t, y: d.y, curve: r.curve, mu0: r.mu0, U: r.U, y0: Y0, hover: state.hover,
      ghost: rej ? { fn: tv => Math.exp(rej[0] + rej[1] * tv), cls: 'farr-ghost', label: 'trend rejected' } : null,
      handles: clusters.map((cl, c) => ({ c, mean: d3.mean(d.y.filter((_, i) => d.who[i].c === c)) }))
    });

    const a = r.beta[0], b = r.keep ? r.beta[1] : 0;
    const pct = Math.round((Math.exp(52 * b) - 1) * 100);
    let html;
    if (state.hover >= 0) {
      const i = state.hover, w = d.who[i];
      html = `<div>t = ${d.t[i]} <span class="farr-dim">(${w.year}, week ${w.week})</span></div>` +
             `<div>count y = ${d.y[i]}, line \u03bc = ${f1(r.curve(d.t[i]))}</div>` +
             `<div>(y \u2212 \u03bc)\u00b2/\u03bc = ${f2((d.y[i] - r.curve(d.t[i])) ** 2 / r.curve(d.t[i]))} <span class="farr-dim">(adds to \u03c6)</span></div>`;
    } else {
      const eq = r.keep ? `${f2(a)} + ${b.toFixed(5)} t` : `${f2(a)}`;
      const at = r.keep ? `${f2(a)} + ${b.toFixed(5)} \u00d7 ${T0}` : `${f2(a)}`;
      html = `<div>log \u03bc = ${eq}</div>` +
             `<div>\u03bc\u2080 = exp(${at}) = <b>${f1(r.mu0)}</b></div>` +
             `<div>\u03c6 = ${f2(r.phi)} <span class="farr-dim">\u00b7 ${r.keep ? `trend ${pct >= 0 ? '+' : ''}${pct}% a year` : 'trend dropped: a flat line'}</span></div>`;
    }
    box.html(html);
    FPLOT.rules(rules, r, B);
    card.setStatus(r.keep ? 'Trend kept' : 'Trend dropped', r.keep ? 'ok' : 'idle');
  }

  update();
})();
