/* ============================================================
   Figure 3: discounting old outbreaks
   The same 35 baseline weeks, with or without an outbreak in the
   2023 window. Farrington refits after shrinking every week whose
   Anscombe residual is above a cut-off c: weight 1/s^2 instead of 1.
   Compare no downweighting, c = 1 (1996) and c = 2.58 (2013).
   Everything is computed by farrington-core.js.
   ============================================================ */

(function () {
  const MOUNT = '#viz-farr-reweight';
  const el = document.querySelector(MOUNT);
  if (!el) return;
  if (typeof d3 === 'undefined' || typeof VIZ === 'undefined' || typeof FARR === 'undefined' ||
      typeof FDATA === 'undefined' || typeof FPLOT === 'undefined') {
    el.innerHTML = '<div class="viz-missing">Figure did not load. Check that d3, viz-kit.js, ' +
      'farrington-core.js, farrington-data.js and farrington-plot.js are listed, in that order, at the end of the chapter.</div>';
    return;
  }

  const B = 5, W = 3, OUT = 2;                       // the outbreak sits in the 2023 window
  const BUMP = [2, 8, 18, 26, 16, 7, 2];             // extra cases, weeks 22 to 28
  const base = FDATA.windows(B, W);
  const T0 = base.t0, Y0 = base.y0;
  const t = base.pts.map(p => p.t);
  const clean = base.pts.map(p => p.y);
  const sick = base.pts.map((p, i) => p.cluster === OUT ? p.y + BUMP[i % 7] : p.y);
  const clusters = d3.range(B).map(c => {
    const pts = base.pts.filter(p => p.cluster === c);
    return { year: pts[0].year, t1: pts[0].t, t2: pts[pts.length - 1].t };
  });
  const CUTS = [{ key: 'off', label: 'Off' }, { key: 1, label: 'c = 1 (1996)' }, { key: 2.58, label: 'c = 2.58 (2013)' }];
  const SCEN = [{ key: 'clean', label: 'No outbreak' }, { key: 'sick', label: 'Outbreak in 2023' }];
  const state = { scen: 'sick', cut: 'off', hover: -1 };
  const refClean = FARR.run(t, clean, T0, { b: B, reweight: false });

  el.classList.add('farr-card');
  const card = VIZ.card(MOUNT, { title: 'Discounting an old outbreak', status: ' ' });
  function tabs(label, items, key) {
    const row = card.body.append('div').attr('class', 'farr-tabrow');
    row.append('span').attr('class', 'farr-tablabel').text(label);
    const wrap = row.append('div').attr('class', 'viz-tabs').attr('role', 'group').attr('aria-label', label);
    wrap.selectAll('button').data(items).join('button').attr('class', 'viz-tab').attr('type', 'button')
      .text(d => d.label).on('click', (ev, d) => { state[key] = d.key; update(); });
    return () => wrap.selectAll('button').attr('aria-pressed', d => String(state[key] === d.key));
  }
  const syncs = [tabs('Baseline', SCEN, 'scen'), tabs('Downweighting', CUTS, 'cut')];
  const box = card.body.append('div').attr('class', 'farr-model').attr('aria-live', 'polite');
  const chart = card.body.append('div').attr('class', 'farr-chart');

  const plot = FPLOT.create(chart, {
    clusters, t0: T0, yMax: 64, draggable: false,
    desc: 'Baseline counts with the fitted line, before and after downweighting.',
    onHover(i) { if (i !== state.hover) { state.hover = i; update(); } }
  });
  const f1 = FPLOT.f1, f2 = v => v.toFixed(2);

  function update() {
    syncs.forEach(f => f());
    const y = state.scen === 'sick' ? sick : clean;
    const on = state.cut !== 'off';
    const plain = FARR.run(t, y, T0, { b: B, reweight: false });
    const r = on ? FARR.run(t, y, T0, { b: B, reweight: true, cut: state.cut }) : plain;
    const rel = on ? r.w.map(v => v / r.gamma) : null;

    plot.draw({
      t, y, curve: r.curve, mu0: r.mu0, U: r.U, y0: Y0, hover: state.hover, weight: rel,
      ghost: on ? { fn: plain.curve, cls: 'farr-ghost is-plain' } : null,
      mark: state.scen === 'sick' ? { c: OUT, top: d3.max(y.filter((_, i) => base.pts[i].cluster === OUT)), text: 'old outbreak' } : null,
      refU: state.scen === 'sick' ? refClean.U : null, refLabel: 'no outbreak'
    });

    const nOut = r.down.filter(i => base.pts[i].cluster === OUT && BUMP[i % 7] > 0 && state.scen === 'sick').length;
    const nOrd = r.down.length - nOut;
    let html;
    if (state.hover >= 0 && on) {
      const i = state.hover, p = base.pts[i], s = r.s[i];
      html = `<div>t = ${p.t} <span class="farr-dim">(${p.year}, week ${p.week})</span>, count ${y[i]}</div>` +
             `<div>s = ${f2(s)} ${s > state.cut ? '&gt;' : '\u2264'} ${state.cut} \u2192 weight ${s > state.cut ? '1/s\u00b2 = ' + f2(1 / (s * s)) : '1'}</div>`;
    } else if (state.hover >= 0) {
      const i = state.hover, p = base.pts[i];
      html = `<div>t = ${p.t} <span class="farr-dim">(${p.year}, week ${p.week})</span>, count ${y[i]}</div>` +
             `<div>weight 1 <span class="farr-dim">(no downweighting)</span></div>`;
    } else if (!on) {
      html = `<div>Every week counts in full.</div>` +
             `<div>\u03c6 = ${f2(r.phi)} \u00b7 \u03bc\u2080 = ${f1(r.mu0)} \u00b7 U = <b>${f1(r.U)}</b></div>`;
    } else {
      const what = r.down.length === 0 ? 'No week is above the cut-off.'
        : `${r.down.length} week${r.down.length > 1 ? 's' : ''} downweighted` +
          (state.scen === 'sick' ? ` (${nOut} from the outbreak, ${nOrd} ordinary).` : ', all of them ordinary.');
      html = `<div>${what}</div>` +
             `<div>\u03c6 = ${f2(r.phi)}${r.phi <= 1.0001 ? ' <span class="farr-dim">(its floor)</span>' : ''} \u00b7 \u03bc\u2080 = ${f1(r.mu0)} \u00b7 U = <b>${f1(r.U)}</b></div>`;
    }
    box.html(html);
    card.setStatus(`U = ${f1(r.U)}`, 'ok');
  }

  update();
})();
