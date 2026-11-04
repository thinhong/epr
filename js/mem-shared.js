/* Shared season objects and helpers for the MEM figures. */
const MEM = (function () {
  'use strict';
  const C = MEMCORE;
  const weeks = MEMDATA.weeks;
  const seasons = MEMDATA.seasons.map((s, idx) => Object.assign(C.season(s.t), {
    j: idx + 1, name: s.name, t: s.t, raw: s.raw, imputed: s.imputed, est: s.est || [], year0: s.y0,
    short: 'Season ' + (idx + 1), tiny: 'S' + (idx + 1)
  }));
  // a round upper limit for an axis: 1, 2, 2.5, 5 or 10 times a power of ten
  const niceMax = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map(m => m * p).find(m => m >= v - 1e-9); };
  function periods(s, delta) {
    const tm = C.timing(s, delta);
    return { r: tm.r, k: tm.k, end: tm.end, pre: [1, tm.k - 1], epi: [tm.k, tm.end], post: [tm.end + 1, s.S] };
  }
  const f1 = d3.format(',.1f'), f2 = d3.format(',.2f'), f3 = d3.format('.3f');
  const reduce = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  const sym = (b, sub, sup) => `<span class="sym">${b}${sup ? `<sup>${sup}</sup>` : ''}${sub ? `<sub>${sub}</sub>` : ''}</span>`;
  function card(sel, title) {
    const root = d3.select(sel).classed('viz-card', true);
    const head = root.append('div').attr('class', 'viz-head');
    head.append('h3').attr('class', 'viz-title').text(title);
    const st = head.append('span').attr('class', 'viz-status');
    st.append('span').attr('class', 'dot'); const lab = st.append('span');
    return { root, status: (html, state) => { st.attr('data-state', state || 'ok'); lab.html(html); } };
  }
  function stepper(parent, key, desc, get, set, lim, stepSize, fmt) {
    const p = parent.append('div').attr('class', 'param');
    p.append('span').attr('class', 'k').html(key);
    const dec = p.append('button').attr('class', 'step').attr('type', 'button').attr('aria-label', 'decrease').text('−');
    const val = p.append('span').attr('class', 'v').attr('aria-live', 'polite');
    const inc = p.append('button').attr('class', 'step').attr('type', 'button').attr('aria-label', 'increase').text('+');
    if (desc) p.append('span').attr('class', 'd').text(desc);
    const clamp = v => Math.max(lim[0], Math.min(lim[1], Math.round(v / stepSize) * stepSize));
    dec.on('click', () => set(clamp(get() - stepSize)));
    inc.on('click', () => set(clamp(get() + stepSize)));
    return () => { const v = get(); val.text(fmt ? fmt(v) : v); dec.property('disabled', v <= lim[0] + 1e-9); inc.property('disabled', v >= lim[1] - 1e-9); };
  }
  /* The whole model from a list of seasons, as in the paper:
     step 1 timing, step 2 pre- and post-epidemic thresholds (mean + z SD of the n highest values),
     step 3 intensity thresholds (geometric mean and one-sided 50%, 90%, 95% limits of the n highest
     epidemic values; the paper states this in words, the log-scale form is the authors' R package). */
  // n = 30 / number of seasons, rounded as R's round() does (halves go to the even number)
  const nOf = N => { const r = 30 / N, f = Math.floor(r); return Math.max(1, r - f === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(r)); };
  function model(list, delta) {
    const N = list.length, n = nOf(N), z = C.Z.p95;
    const rows = list.map(s => {
      const p = periods(s, delta);
      const rank = (a, b) => b < a ? [] : C.topN(s.t, a, b, b - a + 1).map((o, q) => ({ i: o.i, v: o.v, rank: q + 1, j: s.j }));
      const pre = rank(1, p.k - 1), epi = rank(p.k, p.end), post = rank(p.end + 1, s.S);
      return { s, p, npre: pre.length, nepi: epi.length, npost: post.length, top: pre.slice(0, n), topEpi: epi.slice(0, n), topPost: post.slice(0, n),
               rankOf: new Map(pre.map(o => [o.i, o.rank])), rankEpi: new Map(epi.map(o => [o.i, o.rank])),
               peak: d3.max(epi, o => o.v) };
    });
    const vals = rows.flatMap(r => r.top.map(o => o.v)), pv = rows.flatMap(r => r.topPost.map(o => o.v)), ev = rows.flatMap(r => r.topEpi.map(o => o.v));
    const tbar = C.mean(vals), St = C.sd(vals), ptbar = C.mean(pv), pSt = C.sd(pv);
    const zero = ev.some(v => v <= 0), lg = ev.map(v => Math.log(zero ? v + 1 : v)), lm = C.mean(lg), ls = C.sd(lg);
    const back = x => (zero ? Math.exp(x) - 1 : Math.exp(x));
    const allPre = rows.flatMap(r => r.s.t.slice(0, r.p.k - 1));
    return { N, n, rows, vals, tbar, St, tstar: tbar + z * St, sum: d3.sum(vals), ss: d3.sum(vals, v => (v - tbar) * (v - tbar)),
             pv, ptbar, pSt, post: ptbar + z * pSt, base: C.mean(allPre), npre: allPre.length,
             sel: rows.flatMap(r => r.top), selEpi: rows.flatMap(r => r.topEpi),
             ev, lg, lm, ls, zero, gm: back(lm), i50: back(lm + C.Z.p50 * ls), i90: back(lm + C.Z.p90 * ls), i95: back(lm + C.Z.p95 * ls) };
  }
  /* Watching a season with a model: the alert week is the first week above the epidemic threshold
     (paper); the end is the first week after the alert and after the peak so far that falls below
     the post-epidemic threshold (as in the authors' R package, memsurveillance). */
  function watch(t, m, upto) {
    let alert = null, peak = 1, end = null;
    for (let i = 1; i <= upto; i++) if (t[i - 1] > m.tstar) { alert = i; break; }
    for (let i = 2; i <= upto; i++) if (t[i - 1] > t[peak - 1]) peak = i;
    if (alert) for (let i = Math.max(alert, peak) + 1; i <= upto; i++) if (t[i - 1] < m.post) { end = i; break; }
    return { alert, peak, end };
  }
  // the seasons two to a row inside one SVG
  function grid(W, o) {
    const cols = 2, gx = W < 420 ? 10 : 16, gy = o.gy || 10, cellW = (W - gx) / cols, cellH = o.lz + o.bh + o.az;
    const rows = Math.ceil(seasons.length / cols), cw = cellW / weeks.length;
    const ox = j => ((j - 1) % cols) * (cellW + gx), oy = j => Math.floor((j - 1) / cols) * (cellH + gy);
    return { cols, rows, gx, gy, cellW, cellH, cw, H: rows * cellH + (rows - 1) * gy, ox, oy,
      x: (j, i) => ox(j) + (i - 1) * cw, base: j => oy(j) + o.lz + o.bh,
      at: (mx, my) => { const c = Math.max(0, Math.min(cols - 1, Math.floor(mx / (cellW + gx / 2))));
        const r = Math.max(0, Math.min(rows - 1, Math.floor(my / (cellH + gy / 2)))), j = Math.min(seasons.length, r * cols + c + 1);
        return { j, i: Math.max(1, Math.min(weeks.length, Math.floor((mx - ox(j)) / cw) + 1)) }; } };
  }
  // place labels at the right of a chart so that none overlap (minimum gap in px)
  function dodge(items, gap, lo, hi) {
    const a = items.slice().sort((p, q) => p.y - q.y);
    for (let q = 1; q < a.length; q++) if (a[q].y - a[q - 1].y < gap) a[q].y = a[q - 1].y + gap;
    if (a.length && a[a.length - 1].y > hi) { a[a.length - 1].y = hi; for (let q = a.length - 2; q >= 0; q--) if (a[q + 1].y - a[q].y < gap) a[q].y = a[q + 1].y - gap; }
    if (a.length && a[0].y < lo) { a[0].y = lo; for (let q = 1; q < a.length; q++) if (a[q].y - a[q - 1].y < gap) a[q].y = a[q - 1].y + gap; }
    return items;
  }
  // the standard normal distribution: density and cumulative probability
  // (Abramowitz and Stegun 7.1.26, absolute error below 1.5e-7)
  const phi = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
  function Phi(z) { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z / 2);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; }
  // dots that touch are stacked: the row of each dot, given its x position and the dot size
  function stack(xs, d) {
    const order = xs.map((x, q) => [x, q]).sort((a, b) => a[0] - b[0]), last = [], row = new Array(xs.length);
    order.forEach(([x, q]) => { let r = 0; while (last[r] != null && x - last[r] < d) r++; last[r] = x; row[q] = r; });
    return row;
  }
  /* The pooled values as dots, the normal curve that MEM uses for them, and a second axis in
     z = (value - mean) / SD, the standard normal scale. With log = true the curve is normal in the
     log of the value; xlog spaces the x axis by the log too, so that the curve looks like a bell.
     Returns the scales, the dot positions and the lowest y used (for the height of the svg). */
  function normalView(c) {
    const g = c.svg, f = v => (c.log ? Math.log(v) : v), finv = u => (c.log ? Math.exp(u) : u);
    const x0 = c.L, x1 = c.W - c.R, y0 = c.top + c.h, yz = y0 + 32;
    const X = d3.scaleLinear().domain(c.xlog ? [Math.log(c.lo), Math.log(c.hi)] : [c.lo, c.hi]).range([x0, x1]);
    const toX = v => X(c.xlog ? Math.log(v) : v), fromX = px => (c.xlog ? Math.exp(X.invert(px)) : X.invert(px));
    const zOf = v => (f(v) - c.m) / c.s, vOfZ = z => finv(c.m + z * c.s);
    // the density per unit of the x axis, so that the shape drawn is the true shape on that axis
    const dens = v => (c.log && v <= 0 ? 0 : c.log && !c.xlog ? phi(zOf(v)) / (c.s * v) : phi(zOf(v)) / c.s);
    const pts = d3.range(x0, x1 + 0.01, 2).map(px => ({ px, d: dens(fromX(px)) }));
    // the curve fills 86% of the height, or follows c.yOf (density to y), e.g. counts on a histogram
    const dmax = d3.max(pts, q => q.d) || 1, Y = c.yOf || (d => y0 - d / dmax * c.h * 0.86), Yv = v => Y(dens(v));
    const xAt = z => (z === Infinity ? x1 : z === -Infinity ? x0 : Math.max(x0, Math.min(x1, toX(vOfZ(z)))));
    const area = (a, b) => { const inner = pts.filter(q => q.px > a && q.px < b);
      return `M${a},${y0}L${a},${Yv(fromX(a))}` + inner.map(q => `L${q.px},${Y(q.d)}`).join('') + `L${b},${Yv(fromX(b))}L${b},${y0}Z`; };
    // areas under the curve
    (c.regions || []).forEach(rg => { const a = xAt(rg.z0), b = xAt(rg.z1); if (b - a < 0.5) return;
      g.append('path').attr('class', 'dimmable region ' + (rg.cls || '')).attr('d', area(a, b)).attr('fill', rg.fill).attr('fill-opacity', rg.op == null ? 1 : rg.op); });
    // a normal curve also has area below 0, where no rate can be
    if (c.negHatch && c.lo < 0) { const b = toX(0), ng = g.append('g').attr('class', 'dimmable neg');
      ng.append('rect').attr('x', x0).attr('y', c.top - 4).attr('width', b - x0).attr('height', y0 - c.top + 4).attr('fill', `url(#${c.hatch})`).attr('opacity', .6);
      ng.append('line').attr('x1', b).attr('x2', b).attr('y1', c.top - 4).attr('y2', y0).attr('stroke', 'var(--inactive)').attr('stroke-dasharray', '2 3');
      const t = ng.append('text').attr('class', 'ax negtxt').attr('y', c.top + 10);
      (c.negText || []).forEach((line, k) => t.append('tspan').attr('x', x0 + 5).attr('dy', k ? 14 : 0).text(line));
      if (t.node().getBBox().width > b - x0 - 8) t.remove(); }
    if (c.beforeCurve) c.beforeCurve(g);                 // e.g. a histogram, under the curve
    g.append('path').attr('class', 'dimmable curve').attr('d', 'M' + pts.map(q => `${q.px},${Y(q.d)}`).join('L'))
      .attr('fill', 'none').attr('stroke', 'var(--ink2)').attr('stroke-width', 1.8).attr('stroke-linejoin', 'round');
    // labels of the areas: inside when the curve is high enough there, else just above it
    (c.regions || []).forEach(rg => { if (!rg.label) return; const px = xAt(rg.lz), yc = Yv(vOfZ(rg.lz));
      const inside = rg.inside && y0 - yc > 34;
      g.append('text').attr('class', `lab halo dimmable rlab ${rg.cls || ''} ${rg.lcls || ''}`).attr('x', px).attr('y', inside ? yc + 17 : Math.min(yc - 7, y0 - 24))
        .attr('text-anchor', rg.anchor || 'middle').text(rg.label); });
    // the value axis
    g.append('line').attr('class', 'base vax').attr('x1', x0).attr('x2', x1).attr('y1', y0 + .5).attr('y2', y0 + .5);
    (c.vTicks || (c.xlog ? X.ticks(6).map(Math.exp) : X.ticks(6))).filter(v => v >= c.lo && v <= c.hi && !(c.negHatch && v < 0)).forEach(v => { const px = toX(v);
      g.append('line').attr('class', 'vax').attr('x1', px).attr('x2', px).attr('y1', y0).attr('y2', y0 + 4).attr('stroke', 'var(--inactive)');
      g.append('text').attr('class', 'ax ax-mid vax').attr('x', px).attr('y', y0 + 16).text(c.fmtV ? c.fmtV(v) : v); });
    // the z axis: the same points, counted in standard deviations from the mean
    g.append('line').attr('class', 'zax').attr('x1', x0).attr('x2', x1).attr('y1', yz + .5).attr('y2', yz + .5).attr('stroke', 'var(--rule2)');
    const zl = (c.zTicks || [-3, -2, -1, 0, 1, 2, 3]).map(z => ({ z, sp: !Number.isInteger(z), px: toX(vOfZ(z)) }))
      .filter(t => t.px >= x0 - 0.5 && t.px <= x1 + 0.5).map(t => {
        g.append('line').attr('class', 'zax' + (t.sp ? ' zsp' : '')).attr('x1', t.px).attr('x2', t.px).attr('y1', yz - 4).attr('y2', yz + 4)
          .attr('stroke', t.sp ? c.zCol || 'var(--redInk)' : 'var(--inactive)').attr('stroke-width', t.sp ? 2 : 1);
        const el = g.append('text').attr('class', `ax ax-mid zax${t.sp ? ' zsp' : ''}`).attr('x', t.px).attr('y', yz + 16)
          .text(t.sp ? t.z.toFixed(3) : t.z < 0 ? '−' + -t.z : t.z);
        if (t.sp) el.attr('fill', c.zCol || 'var(--redInk)').style('font-weight', 600);
        return Object.assign(t, { el, w: el.node().getComputedTextLength() }); });
    // special values first; one that would touch another goes one row down; a whole number
    // that would touch a label already placed keeps its tick and loses its number
    let bottom = yz + 20; const used = [], hits = (a, b, row) => used.some(u => u.row === row && !(b < u.a - 4 || a > u.b + 4));
    zl.filter(t => t.sp).sort((p, q) => p.px - q.px).forEach(t => { const a = t.px - t.w / 2, b = t.px + t.w / 2, row = hits(a, b, 0) ? 1 : 0;
      if (row) { t.el.attr('y', yz + 29); bottom = yz + 33; } used.push({ a, b, row }); });
    zl.filter(t => !t.sp).sort((p, q) => Math.abs(p.z) - Math.abs(q.z) || p.z - q.z).forEach(t => { const a = t.px - t.w / 2, b = t.px + t.w / 2;
      if (hits(a, b, 0)) t.el.remove(); else used.push({ a, b, row: 0 }); });
    if (c.labels !== false) { const nx = c.nameX || 0;
      g.append('text').attr('class', 'ax vax').attr('x', nx).attr('y', y0 + 16).text(c.vName || 'rate');
      g.append('text').attr('class', 'ax zax').attr('x', nx).attr('y', yz + 16).style('font-style', 'italic').text('z'); }
    // the cut lines (thresholds); each label goes beside its line without crossing another line
    // or another label, one row higher when there is no room
    const cuts = (c.cuts || []).map(ct => Object.assign({ px: xAt(ct.z) }, ct)), lp = [];
    cuts.forEach((ct, q) => { const gg = g.append('g').attr('class', 'dimmable ' + (ct.cls || ''));
      const ln = gg.append('line').attr('x1', ct.px).attr('x2', ct.px).attr('y2', yz).attr('stroke', ct.col).attr('stroke-width', 2).attr('stroke-dasharray', ct.dash);
      const t = gg.append('text').attr('class', 'lab halo ' + (ct.lcls || '')).text(ct.label), w = t.node().getComputedTextLength();
      const sides = ct.anchor === 'end' ? ['end', 'start'] : ['start', 'end'];
      let pick = null;
      for (let row = 0; row < 3 && !pick; row++) for (const sd of sides) {
        const a = sd === 'start' ? ct.px + 5 : ct.px - 5 - w, b = a + w;
        if (a < 2 || b > c.W - 2) continue;
        if (row === 0 && cuts.some((o, k) => k !== q && o.px > a - 3 && o.px < b + 3)) continue;
        if (lp.some(u => u.row === row && !(b < u.a - 8 || a > u.b + 8))) continue;
        pick = { a, b, row, sd }; break; }
      pick = pick || { a: 0, b: 0, row: 0, sd: sides[0] }; lp.push(pick);
      const yl = c.top - 9 - pick.row * 14;
      t.attr('x', pick.sd === 'start' ? ct.px + 5 : ct.px - 5).attr('y', yl).attr('text-anchor', pick.sd);
      ln.attr('y1', yl + 3); });
    // the dots, stacked from the axis upwards, smaller if a stack would grow too tall
    let dd = c.dot || 9, rows = stack(c.values.map(o => toX(o.v)), dd);
    for (let k = 0; k < 4 && (d3.max(rows) + 1) * dd > c.h * 0.8; k++) { dd *= 0.82; rows = stack(c.values.map(o => toX(o.v)), dd); }
    const dots = c.values.map((o, q) => ({ o, x: toX(o.v), y: y0 - dd / 2 - rows[q] * dd, r: dd / 2 - 0.6 }));
    g.selectAll(null).data(dots).join('circle').attr('class', d => c.dotCls(d.o))
      .attr('cx', d => d.x).attr('cy', d => d.y).attr('r', d => d.r).attr('fill', c.dotFill).attr('stroke', '#fff').attr('stroke-width', .8);
    return { X, toX, fromX, zOf, vOfZ, dens, Y, Yv, y0, yz, xAt, area, dots, dd, x0, x1, bottom };
  }
  // a reading on an axis: text on a white tag, kept inside the plot
  /* SVG text with subscripts written as _{...}, e.g. 'z_{0.05} × S_{t}': each subscript is a lowered,
     slightly smaller tspan, and the text after it goes back to the baseline */
  function rich(t, s) {
    t.text('');
    const fs = parseFloat(getComputedStyle(t.node()).fontSize) || 12.5, dy = Math.round(fs * 0.28 * 10) / 10;
    let low = false;
    String(s).split(/(_\{[^}]*\})/).forEach(p => {
      if (!p) return;
      if (p.startsWith('_{')) { t.append('tspan').attr('dy', low ? 0 : dy).style('font-size', Math.max(10.5, fs * 0.8) + 'px').text(p.slice(2, -1)); low = true; }
      else { t.append('tspan').attr('dy', low ? -dy : 0).text(p); low = false; }
    });
    return t;
  }
  function pill(g, x, y, text, col, lo, hi) {
    const t = rich(g.append('text').attr('class', 'lab').attr('x', x).attr('y', y).attr('text-anchor', 'middle').attr('fill', col), text);
    const w = t.node().getComputedTextLength(), cx = Math.max(lo + w / 2 + 4, Math.min(hi - w / 2 - 4, x));
    t.attr('x', cx);
    g.insert('rect', () => t.node()).attr('x', cx - w / 2 - 4).attr('y', y - 12).attr('width', w + 8).attr('height', 16).attr('rx', 4)
      .attr('fill', 'var(--bg)').attr('stroke', col).attr('stroke-width', 1.2);
  }
  // a slider with step buttons: drag for big changes, tap the buttons for one step
  function slider(parent, key, desc, get, set, lim, stepSize, fmt) {
    const p = parent.append('div').attr('class', 'param slide');
    p.append('span').attr('class', 'k').html(key);
    const dec = p.append('button').attr('class', 'step').attr('type', 'button').attr('aria-label', 'decrease').text('−');
    const rng = p.append('input').attr('class', 'rng').attr('type', 'range').attr('min', lim[0]).attr('max', lim[1]).attr('step', stepSize)
      .attr('aria-label', desc || 'value');
    const inc = p.append('button').attr('class', 'step').attr('type', 'button').attr('aria-label', 'increase').text('+');
    const val = p.append('span').attr('class', 'v').attr('aria-live', 'polite');
    if (desc) p.append('span').attr('class', 'd').text(desc);
    const clamp = v => Math.max(lim[0], Math.min(lim[1], Math.round(v / stepSize) * stepSize));
    dec.on('click', () => set(clamp(get() - stepSize)));
    inc.on('click', () => set(clamp(get() + stepSize)));
    rng.on('input', function () { const v = clamp(+this.value); if (v !== get()) set(v); });
    return () => { const v = get(); val.text(fmt ? fmt(v) : v); rng.property('value', v);
      dec.property('disabled', v <= lim[0] + 1e-9); inc.property('disabled', v >= lim[1] - 1e-9); };
  }
  function watchWidth(node, fn) {
    let last = 0;
    const run = () => { const w = node.clientWidth; if (Math.abs(w - last) > 4) { last = w; fn(w); } };
    run();
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(run).observe(node);
  }
  // on a touch screen a readout stays after the finger lifts; a tap outside the figure clears it
  function outsideTap(node, fn) {
    document.addEventListener('pointerdown', ev => { if (ev.pointerType !== 'mouse' && !node.contains(ev.target)) fn(); }, { passive: true });
  }
  return { C, weeks, seasons, periods, f1, f2, f3, reduce, sym, card, stepper, watchWidth, outsideTap, niceMax, slider, model, nOf, watch, grid, dodge, phi, Phi, stack, normalView, pill, rich, S: weeks.length, N: seasons.length };
})();
