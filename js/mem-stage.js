/* Shared parts of the figures for steps 2 and 3.
   cells(): the seasons, two to a row (one on a phone). Each panel zooms in on the weeks the step
            uses (the pre-epidemic or the epidemic period); the n highest of them carry their values.
   side():  those n x N values as bars side by side and, on the same axis, their histogram on its
            side with the normal curve of the same area and a z axis. Thresholds are horizontal
            lines across both, so a threshold in the histogram is the same line across the bars.
   slide(): each bar drops to its own height (its bin) and slides across into the histogram. */
const STAGE = (function () {
  'use strict';
  const { weeks, S, N, f1, reduce } = MEM;
  const ease = d3.easeCubicInOut;
  const T = (sel, dur, delay) => (dur && !reduce ? sel.transition().delay(delay || 0).duration(dur).ease(ease) : sel);

  /* ---------- the seasons ----------
     o: { rows, period ('pre' or 'epi'), n, ymax, style: {pre, epi, post: [fill, opacity full, opacity zoomed]},
          sel (fill of the n highest), ctx(row) -> { full: [...], zoom: [...] } labels of the weeks not used,
          onPoint(d), onLeave() } */
  function cells(parent, o) {
    const W = Math.max(280, parent.node().clientWidth), rows = o.rows, n = o.n;
    const cols = W < 560 ? 1 : 2, gx = 16, gy = 10, lz = 18, rh = W < 560 ? 46 : 50, az = 14, gap = 6;
    const cellW = (W - (cols - 1) * gx) / cols, cellH = lz + rh + az, R = Math.ceil(N / cols), H = R * cellH + (R - 1) * gy;
    const ox = j => ((j - 1) % cols) * (cellW + gx), oy = j => Math.floor((j - 1) / cols) * (cellH + gy), base = j => oy(j) + lz + rh;
    const win = j => { const p = rows[j - 1].p; return o.period === 'pre' ? [1, p.k - 1] : [p.k, p.end]; };
    const zmax = d3.max(rows, r => { const [a, b] = win(r.s.j); return b - a + 1; });
    const cp = Math.min(24, (cellW - (o.period === 'pre' ? 80 : 110)) / zmax), cu = cellW / S;
    // zoomed: the window gets cp per week; the weeks before and after share what is left
    const sq = rows.map(r => { const [a, b] = win(r.s.j), nb = a - 1, na = S - b;
      const rest = cellW - (b - a + 1) * cp - (nb ? gap : 0) - (na ? gap : 0), w = nb + na ? rest / (nb + na) : 0;
      return { a, b, nb, na, w, s0: nb * w + (nb ? gap : 0) }; });
    const xu = (j, i) => ox(j) + (i - 1) * cu;
    const xz = (j, i) => { const q = sq[j - 1]; if (i < q.a) return ox(j) + (i - 1) * q.w;
      if (i <= q.b) return ox(j) + q.s0 + (i - q.a) * cp; return ox(j) + q.s0 + (q.b - q.a + 1) * cp + gap + (i - q.b - 1) * q.w; };
    const wz = (j, i) => { const q = sq[j - 1]; return i >= q.a && i <= q.b ? cp : q.w; };
    const hy = v => Math.max(0.8, Math.min(v, o.ymax) / o.ymax * rh);
    const pos = (d, zoom) => { const x = zoom ? xz(d.j, d.i) : xu(d.j, d.i), w = zoom ? wz(d.j, d.i) : cu, bw = Math.max(1.2, Math.min(14, w * 0.74));
      return { x: x + (w - bw) / 2, w: bw, cx: x + w / 2 }; };
    const small = cellW < 300, dense = cp < 13;
    parent.html('');
    const svg = parent.append('svg').attr('class', 'svgA').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H).attr('role', 'img').attr('aria-label', o.aria);
    const sty = d => o.style[d.type];
    rows.forEach(row => {
      const { s, p } = row, j = s.j, b = base(j), [wa, wb] = win(j), rank = o.rankOf(row);
      // the weeks the step uses, as a faint band that widens with the zoom
      svg.append('rect').datum({ j, a: wa, b: wb }).attr('class', 'zband').attr('y', oy(j) + lz - 4).attr('height', rh + 4).attr('rx', 3).attr('fill', o.band);
      const rl = svg.append('text').attr('class', 'rowlab').attr('x', ox(j)).attr('y', oy(j) + 9).style('text-anchor', 'start').text(small ? s.tiny : s.short), rlw = rl.node().getComputedTextLength();
      svg.append('line').attr('class', 'base').attr('x1', ox(j)).attr('x2', ox(j) + cellW).attr('y1', b + .5).attr('y2', b + .5);
      s.t.forEach((v, i0) => {
        const i = i0 + 1, type = i < p.k ? 'pre' : i <= p.end ? 'epi' : 'post', inP = type === o.period, rk = inP ? rank.get(i) : 0, sel = rk > 0 && rk <= n;
        const d = { j, i, v, type, rank: rk, sel, b, h: hy(v) };
        svg.append('rect').datum(d).attr('class', `dimmable bar ${type}${sel ? ' sel rk' + rk : ''} s${j}`).attr('y', b - d.h).attr('height', d.h).attr('rx', 1).attr('fill', sty(d)[0]);
        if (v > o.ymax) svg.append('rect').datum(d).attr('class', `dimmable brk ${type}`).attr('y', b - rh + 4).attr('height', 2).attr('fill', '#fff');
        if (sel) svg.append('text').datum(d).attr('class', `dimmable lab vlab rk${rk}`).text((o.fmt || f1)(v));
      });
      // labels of the weeks that are not used, in the full and in the zoomed layout
      const c = o.ctx(row);
      [['full', false], ['zoom', true]].forEach(([k, zoom]) => (c[k] || []).forEach(l => {
        const x0 = zoom ? xz(j, l.a) : xu(j, l.a), x1 = (zoom ? xz(j, l.b) + wz(j, l.b) : xu(j, l.b) + cu), el = svg.append('text').attr('class', `lab ctx ctx-${k}`)
          .attr('x', (x0 + x1) / 2).attr('y', oy(j) + 9).attr('text-anchor', 'middle').attr('fill', l.col || 'var(--muted)');
        // a label gives way to the season name
        for (const t of l.texts.concat([''])) { el.text(t); const w = el.node().getComputedTextLength(); if (w <= x1 - x0 - 2 && (x0 + x1) / 2 - w / 2 > ox(j) + rlw + 6) break; } }));
      // week numbers: three marks in the full season; the used weeks one by one (or every other) when zoomed
      [[1, '40', 'start', 0], [14, '1', 'middle', cu / 2], [33, '20', 'end', cu]].forEach(([i, t, anc, dx]) =>
        svg.append('text').attr('class', 'ax wku').attr('text-anchor', anc).attr('x', xu(j, i) + dx).attr('y', b + 13).text(t));
      const every = cp >= 18 ? 1 : 2;
      for (let i = wa; i <= wb; i++) if ((i - wa) % every === 0) svg.append('text').attr('class', 'ax ax-mid wkz').attr('x', xz(j, i) + cp / 2).attr('y', b + 13).text(weeks[i - 1]);
    });
    // a value stands on its bar, or sits inside a tall one
    svg.selectAll('.vlab').each(function (d) {
      const t = d3.select(this), len = this.getComputedTextLength(), cx = pos(d, true).cx, inside = d.h >= len + 7;
      t.attr('fill', inside ? '#fff' : o.sel).attr('text-anchor', inside ? 'end' : 'start')
        .attr('transform', `translate(${cx + 4.2},${inside ? d.b - d.h + 3 : d.b - d.h - 3}) rotate(-90)`);
    });
    const pl = svg.insert('g', '.bar').attr('class', 'persist').style('pointer-events', 'none');   // lines a toggle keeps on, behind the bars
    const fa = svg.append('g').attr('class', 'lyr-focus');
    const barAt = ev => { const [mx, my] = d3.pointer(ev, svg.node()), zoom = ctl.zoom;
      const c = Math.max(0, Math.min(cols - 1, Math.floor(mx / (cellW + gx / 2)))), r = Math.max(0, Math.min(R - 1, Math.floor(my / (cellH + gy / 2)))), j = Math.min(N, r * cols + c + 1);
      let best = 1, bd = Infinity;
      for (let i = 1; i <= S; i++) { const x = zoom ? xz(j, i) : xu(j, i), w = zoom ? wz(j, i) : cu, dd = mx < x ? x - mx : mx > x + w ? mx - x - w : 0; if (dd < bd) { bd = dd; best = i; } }
      return svg.selectAll('.bar').filter(d => d.j === j && d.i === best).datum(); };
    svg.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', H).attr('fill', 'transparent')
      .on('pointerdown pointermove', ev => o.onPoint(barAt(ev)))
      .on('pointerleave', ev => { if (ev.pointerType === 'mouse') o.onLeave(); });

    const ctl = { svg, fa, W, cellW, ox, oy, base, hy, dense, small, zoom: true, pos };
    // the layout at once: full or zoomed, with or without the n highest marked
    ctl.set = (zoom, selOn) => { ctl.zoom = zoom;
      svg.selectAll('.bar').interrupt().attr('x', d => pos(d, zoom).x).attr('width', d => pos(d, zoom).w)
        .attr('fill', d => (d.sel && selOn ? o.sel : sty(d)[0])).attr('fill-opacity', d => (d.sel && selOn ? 1 : sty(d)[zoom ? 2 : 1]));
      svg.selectAll('.brk').interrupt().attr('x', d => pos(d, zoom).x - .5).attr('width', d => pos(d, zoom).w + 1);
      svg.selectAll('.zband').interrupt().attr('x', d => (zoom ? xz(d.j, d.a) : xu(d.j, d.a)) - 2).attr('width', d => (zoom ? (d.b - d.a + 1) * cp : (d.b - d.a + 1) * cu) + 4).style('opacity', zoom ? .5 : 1);
      svg.selectAll('.wku, .ctx-full').interrupt().style('opacity', zoom ? 0 : null);
      svg.selectAll('.wkz, .ctx-zoom').interrupt().style('opacity', zoom ? null : 0);
      ctl.labelVals(() => selOn && !dense); };
    // from the full seasons to the zoom, in three beats so that nothing overlaps: the weeks not
    // used fade and their labels go; everything moves together; the new week numbers come in
    ctl.zoomIn = () => new Promise(res => {
      if (reduce) { ctl.set(true, false); res(); return; }
      ctl.zoom = true;
      T(svg.selectAll('.wku, .ctx-full'), 250).style('opacity', 0);
      T(svg.selectAll('.bar').filter(d => d.type !== o.period), 350).attr('fill-opacity', d => sty(d)[2]);
      T(svg.selectAll('.bar'), 850, 380).attr('x', d => pos(d, true).x).attr('width', d => pos(d, true).w);
      T(svg.selectAll('.brk'), 850, 380).attr('x', d => pos(d, true).x - .5).attr('width', d => pos(d, true).w + 1);
      T(svg.selectAll('.zband'), 850, 380).attr('x', d => xz(d.j, d.a) - 2).attr('width', d => (d.b - d.a + 1) * cp + 4);
      T(svg.selectAll('.wkz, .ctx-zoom'), 300, 1250).style('opacity', 1);
      T(svg.selectAll('.zband'), 400, 1250).style('opacity', .5);
      setTimeout(res, 1600); });
    ctl.showRank = (q, on) => svg.selectAll('.bar.rk' + q).attr('fill', d => (on ? o.sel : sty(d)[0])).attr('fill-opacity', d => (on ? 1 : sty(d)[ctl.zoom ? 2 : 1]));
    ctl.labelVals = pred => svg.selectAll('.vlab').style('opacity', d => (pred(d) ? null : 0));
    ctl.cell = (j, i) => svg.selectAll('.bar').filter(d => d.j === j && d.i === i).datum();
    ctl.ring = d => { const p = pos(d, ctl.zoom), b = base(d.j), h = hy(d.v);
      fa.append('rect').attr('x', p.x - 2).attr('y', b - h - 2).attr('width', p.w + 4).attr('height', h + 2).attr('rx', 3).attr('fill', 'none').attr('stroke', 'var(--head)').attr('stroke-width', 1.8); };
    // thresholds kept on every season (list of { v, col, dash, label }); labels stand apart if lines are close
    ctl.levels = list => { pl.html(''); rows.forEach(r => { const j = r.s.j, b = base(j), ls = list.filter(l => l.v <= o.ymax);
      ls.forEach(l => pl.append('line').attr('x1', ox(j)).attr('x2', ox(j) + cellW).attr('y1', b - hy(l.v)).attr('y2', b - hy(l.v))
        .attr('stroke', l.col).attr('stroke-width', 1.6).attr('stroke-dasharray', l.dash));
      const ly = MEM.dodge(ls.map(l => ({ y: b - hy(l.v) - 4 })), 12, oy(j) + lz, b);
      ls.forEach((l, q) => pl.append('text').attr('class', 'lab halo').attr('fill', l.lcol || l.col).attr('x', ox(j) + cellW).attr('y', ly[q].y).attr('text-anchor', 'end').text(l.label)); }); };
    ctl.hline = (v, col, label) => rows.forEach(r => { const j = r.s.j, yy = base(j) - hy(v); if (v > o.ymax) return;
      fa.append('line').attr('x1', ox(j)).attr('x2', ox(j) + cellW).attr('y1', yy).attr('y2', yy).attr('stroke', col).attr('stroke-width', 1.5).attr('stroke-dasharray', '5 4');
      if (label) fa.append('text').attr('class', 'lab halo').attr('fill', col).attr('x', ox(j) + cellW).attr('y', yy - 4).attr('text-anchor', 'end').text(label); });
    return ctl;
  }

  /* ---------- the bars side by side and the histogram on its side ----------
     Positions are in axis units u = f(rate): the rate itself, or its natural log.
     o: { values (pooled, in order: season, then rank), rows, n, f, base, lo, hi, ticks (rates), axisName,
          bw, b0 (bin width and start, axis units), cnt(u) expected count per bin, zOf(u), uOfZ(z),
          regions, rlabels, cuts, zTicks, zCol, neg (hatch below rate 0), fill, hatchId,
          lin: { hi } optional rate axis for the bars before a log step, onPick(o), onCurve(u), onLeave() } */
  function side(parent, o) {
    const W = Math.max(280, parent.node().clientWidth), wide = W >= 560, small = !wide;
    const top = 30, hp = wide ? 150 : 124, k = hp / (o.hi - o.base), y0 = top + hp, Y = u => y0 - (u - o.base) * k;
    const lo = Math.min(o.lo, o.base), yLo = Y(lo), nv = o.values.length;
    const split = Math.round(W * 0.5), a = { x0: 38, x1: split - (wide ? 16 : 8) };
    const xZ = W - (wide ? 44 : 42), xW = xZ - 8, xH0 = split + (wide ? 12 : 6);
    // the histogram: bins of the axis; values are taken in the order they stand side by side,
    // and each one stacks on the ones already in its bin
    const nb = Math.floor((o.f(d3.max(o.values, q => q.v)) - o.b0) / o.bw + 1e-9) + 1, cnt = new Array(nb).fill(0);
    const blocks = o.values.map(q => { const b = Math.max(0, Math.min(nb - 1, Math.floor((o.f(q.v) - o.b0) / o.bw + 1e-9))); return { o: q, b, c: ++cnt[b] }; });
    const blockOf = new Map(blocks.map(q => [q.o, q])), cmax = d3.max(cnt), yTop = cmax + 1, u = Math.min(22, (xW - xH0 - 4) / yTop);
    const Htot = yLo + 28;
    parent.html('');
    const svg = parent.append('svg').attr('class', 'svgP').attr('viewBox', `0 0 ${W} ${Htot}`).attr('width', W).attr('height', Htot).attr('role', 'img').attr('aria-label', o.aria);
    svg.append('defs').html(`<pattern id="${o.hatchId}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="5" fill="var(--inactive)"/></pattern>`);
    // the bars, grouped by season, highest first
    const gw = (a.x1 - a.x0) / N, pad = Math.min(8, gw * 0.08), step = (gw - 2 * pad) / o.n, bw = Math.max(1.6, Math.min(16, step * 0.74));
    const bx = q => a.x0 + (q.j - 1) * gw + pad + (q.rank - 1) * step + (step - bw) / 2;
    const tagsY = o.cuts.map(c => Y(o.uOfZ(c.z)));
    // a tick label close to a threshold's tag gives way to it while that threshold is shown (syncTicks)
    const axis = (cls, yOf, ticks, fmt, name, tags) => { const g = svg.append('g').attr('class', cls);
      ticks.forEach(v => { const y = yOf(v); if (y < top - 1 || y > y0 + 1) return;
        g.append('line').attr('x1', a.x0 - 4).attr('x2', a.x0).attr('y1', y).attr('y2', y).attr('stroke', 'var(--inactive)');
        const near = tags ? tagsY.map((t, q) => (Math.abs(t - y) <= 12 ? q : -1)).filter(q => q >= 0) : [];
        g.append('text').attr('class', 'ax ax-end tk').attr('data-c', near.join(' ')).attr('x', a.x0 - 7).attr('y', y).attr('dominant-baseline', 'middle').text(fmt(v)); });
      g.append('text').attr('class', 'ax').attr('x', 0).attr('y', top - 12).text(name);
      return g; };
    axis('pax', v => Y(o.f(v)), o.ticks, d3.format(',.0f'), o.axisName, true);
    if (o.lin) axis('pax-lin', v => y0 - v * hp / o.lin.hi, d3.ticks(0, o.lin.hi, 4), d3.format(',.0f'), 'rate', false).style('opacity', 0);
    svg.append('line').attr('class', 'base').attr('x1', a.x0).attr('x2', a.x1).attr('y1', y0 + .5).attr('y2', y0 + .5);
    o.rows.forEach(r => svg.append('text').attr('class', 'ax ax-mid grp').attr('x', a.x0 + (r.s.j - .5) * gw).attr('y', y0 + 16).text(gw >= 70 ? r.s.short : r.s.tiny));
    const barY = (q, lin) => (lin ? y0 - q.v * hp / o.lin.hi : Y(o.f(q.v)));
    svg.selectAll('.pbar').data(o.values).join('rect').attr('class', q => `dimmable pbar rk${q.rank} s${q.j}`)
      .attr('x', bx).attr('width', bw).attr('y', q => barY(q)).attr('height', q => Math.max(0.8, y0 - barY(q))).attr('rx', Math.min(1.5, bw / 3)).attr('fill', o.fill);
    // the curve on its side: at each level, the count per bin that the curve expects
    const cx = v => xW - o.cnt(v) * u;
    const vs = d3.range(lo, o.hi, 1.5 / k).concat([o.hi]);
    const area = (u0, u1) => { u0 = Math.max(lo, u0); u1 = Math.min(o.hi, u1); if (u1 <= u0) return ''; const pts = vs.filter(v => v > u0 && v < u1);
      return `M${xW},${Y(u0)}L${cx(u0)},${Y(u0)}` + pts.map(v => `L${cx(v)},${Y(v)}`).join('') + `L${cx(u1)},${Y(u1)}L${xW},${Y(u1)}Z`; };
    o.regions.forEach(r => svg.append('path').attr('class', `dimmable region ${r.cls || ''}`).attr('d', area(r.z0 === -Infinity ? lo : o.uOfZ(r.z0), r.z1 === Infinity ? o.hi : o.uOfZ(r.z1)))
      .attr('fill', r.fill).attr('fill-opacity', r.op == null ? 1 : r.op));
    // a normal curve of rates also has area below 0, where no rate can be
    if (o.neg && lo < o.f(0)) { const ng = svg.append('g').attr('class', 'dimmable neg'), y00 = Y(o.f(0));
      ng.append('rect').attr('x', xH0).attr('y', y00).attr('width', xW - xH0).attr('height', yLo - y00).attr('fill', `url(#${o.hatchId})`).attr('opacity', .6);
      ng.append('line').attr('x1', xH0).attr('x2', xW).attr('y1', y00 + .5).attr('y2', y00 + .5).attr('stroke', 'var(--inactive)').attr('stroke-dasharray', '2 3');
      const t = ng.append('text').attr('class', 'ax negtxt').attr('y', y00 + 15);
      ['rates below 0', 'cannot happen'].forEach((s, q) => t.append('tspan').attr('x', xH0 + 5).attr('dy', q ? 14 : 0).text(s));
      if (t.node().getBBox().width > xW - 3.6 * u - xH0 - 12 || yLo - y00 < 34) t.remove(); }
    svg.selectAll('.hblk').data(blocks).join('rect').attr('class', q => `dimmable hblk rk${q.o.rank} s${q.o.j}`)
      .attr('x', q => xW - q.c * u).attr('y', q => Y(o.b0 + (q.b + 1) * o.bw)).attr('width', u).attr('height', o.bw * k)
      .attr('fill', o.fill).attr('stroke', '#fff').attr('stroke-width', 1);
    svg.append('path').attr('class', 'dimmable curve').attr('d', 'M' + vs.map(v => `${cx(v)},${Y(v)}`).join('L'))
      .attr('fill', 'none').attr('stroke', 'var(--ink2)').attr('stroke-width', 1.8).attr('stroke-linejoin', 'round');
    svg.append('line').attr('class', 'base hax').attr('x1', xW + .5).attr('x2', xW + .5).attr('y1', top).attr('y2', yLo);
    // weeks per bin, read leftwards from the wall
    const cax = svg.append('g').attr('class', 'cax');
    cax.append('line').attr('class', 'base').attr('x1', xW - yTop * u).attr('x2', xW).attr('y1', yLo + .5).attr('y2', yLo + .5);
    d3.ticks(0, cmax, 4).forEach(c => { const x = xW - c * u;
      cax.append('line').attr('x1', x).attr('x2', x).attr('y1', yLo).attr('y2', yLo + 4).attr('stroke', 'var(--inactive)');
      cax.append('text').attr('class', 'ax ax-mid').attr('x', x).attr('y', yLo + 16).text(c); });
    if (wide) cax.append('text').attr('class', 'ax').attr('x', xH0).attr('y', yLo + 16).text('weeks');
    // the z axis: the same levels, counted in standard deviations from the mean
    const zg = svg.append('g');
    zg.append('line').attr('class', 'zax').attr('x1', xZ).attr('x2', xZ).attr('y1', top).attr('y2', yLo).attr('stroke', 'var(--rule2)');
    zg.append('text').attr('class', 'ax zax').attr('x', xZ).attr('y', top - 12).attr('text-anchor', 'middle').style('font-style', 'italic').text('z');
    // special values first, pushed apart when they are close (the ticks stay where they are); a whole
    // number whose label would touch one of them keeps its tick and loses its label
    const zt = o.zTicks.map(z => ({ z, sp: !Number.isInteger(z), y: Y(o.uOfZ(z)) })).filter(t => t.y <= yLo + .5 && t.y >= top - .5);
    zt.forEach(t => zg.append('line').attr('class', 'zax' + (t.sp ? ' zsp' : '')).attr('x1', xZ - 4).attr('x2', xZ + 4).attr('y1', t.y).attr('y2', t.y)
      .attr('stroke', t.sp ? o.zCol : 'var(--inactive)').attr('stroke-width', t.sp ? 2 : 1));
    const spl = MEM.dodge(zt.filter(t => t.sp).map(t => ({ t, y: t.y })), 13, top - 4, yLo + 4), used = spl.map(q => q.y);
    const zlab = (t, y) => zg.append('text').attr('class', `ax zax${t.sp ? ' zsp' : ''}`).attr('x', xZ + 7).attr('y', y).attr('dominant-baseline', 'middle')
      .attr('fill', t.sp ? o.zCol : null).style('font-weight', t.sp ? 600 : null)
      .call(e => (t.sp ? MEM.rich(e, o.zName ? o.zName(t.z) : t.z.toFixed(3)) : e.text(t.z < 0 ? '−' + -t.z : t.z)));
    spl.forEach(q => zlab(q.t, q.y));
    zt.filter(t => !t.sp).sort((p, q) => Math.abs(p.z) - Math.abs(q.z)).forEach(t => { if (used.some(y => Math.abs(y - t.y) < 13)) return; used.push(t.y); zlab(t, t.y); });
    // the thresholds: one horizontal line each, across the bars and the histogram; the value as a tag
    // on the rate axis and the name beside the histogram, moved apart when two lines are close
    const tagY = MEM.dodge(o.cuts.map(c => ({ y: Y(o.uOfZ(c.z)) })), 13, top - 6, y0 + 6);
    const nameY = MEM.dodge(o.cuts.map(c => ({ y: Y(o.uOfZ(c.z)) - 5 })), 13, top - 6, yLo);
    o.cuts.forEach((c, q) => { const y = Y(o.uOfZ(c.z)), g = svg.append('g').attr('class', `dimmable ${c.cls}`);
      g.append('line').attr('x1', a.x0 - 4).attr('x2', xZ).attr('y1', y).attr('y2', y).attr('stroke', c.col).attr('stroke-width', 1.8).attr('stroke-dasharray', c.dash);
      g.append('text').attr('class', 'lab ' + c.lcls).attr('x', a.x0 - 7).attr('y', tagY[q].y).attr('dominant-baseline', 'middle').attr('text-anchor', 'end').text(c.tag);
      g.append('text').attr('class', 'lab halo ' + c.lcls).attr('x', xH0 + 2).attr('y', nameY[q].y).text(small && c.short ? c.short : c.name); });
    // the share of the area in each part, beside the curve and clear of the blocks
    const binOf = v => Math.max(0, Math.min(nb - 1, Math.floor((v - o.b0) / o.bw)));
    o.rlabels.forEach(l => { const v = o.uOfZ(l.z); if (v > o.hi || v < lo) return;
      svg.append('text').attr('class', `lab halo dimmable rlab ${l.cls || ''} ${l.lcls}`).attr('x', Math.min(cx(v), xW - (v >= o.b0 ? cnt[binOf(v)] : 0) * u) - 8).attr('y', Y(v) + 4)
        .attr('text-anchor', 'end').text(small && l.short ? l.short : l.text); });
    const fp = svg.append('g').attr('class', 'lyr-focus');
    // the pointer: a bar, a block, or a level on the curve
    let raf = 0, last = null;
    const blockRect = q => ({ x: xW - q.c * u, y: Y(o.b0 + (q.b + 1) * o.bw), w: u, h: o.bw * k });
    const probe = () => { raf = 0; if (!last) return; const [where, mx, my] = last;
      if (where === 'a') { const q = d3.least(o.values, e => Math.abs(bx(e) + bw / 2 - mx)); if (q) o.onPick(q); return; }
      const q = blocks.find(e => { const r = blockRect(e); return mx >= r.x - 1 && mx <= r.x + r.w + 1 && my >= r.y && my <= r.y + r.h; });
      if (q) { o.onPick(q.o); return; }
      o.onCurve(Math.max(lo, Math.min(o.hi, o.base + (y0 - my) / k))); };
    const hit = (x, y, w, hh, where) => svg.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', hh).attr('fill', 'transparent')
      .style('cursor', where === 'h' ? 'crosshair' : null)
      .on('pointerdown pointermove', ev => { if (o.busy()) return; last = [where, ...d3.pointer(ev, svg.node())]; if (!raf) raf = requestAnimationFrame(probe); })
      .on('pointerleave', ev => { if (ev.pointerType === 'mouse') { cancelAnimationFrame(raf); raf = 0; o.onLeave(); } });
    hit(a.x0 - 6, top - 14, a.x1 - a.x0 + 12, y0 - top + 34, 'a');
    hit(xH0, top - 14, xZ + 6 - xH0, yLo - top + 14, 'h');

    const st = { svg, fp, W, wide, small, a, top, y0, yLo, lo, hi: o.hi, base: o.base, k, Y, f: o.f, bx, bw, barY, xH0, xW, xZ, u, blocks, blockOf, cnt, nb, cmax, cx, area, blockRect, Htot, o };
    // focus helpers
    st.ringBar = (q, col) => { const y = barY(q); fp.append('rect').attr('x', bx(q) - 2).attr('y', y - 2).attr('width', bw + 4).attr('height', y0 - y + 2).attr('rx', 3)
      .attr('fill', 'none').attr('stroke', col || 'var(--head)').attr('stroke-width', 1.8); };
    st.ringBlock = (q, col) => { const r = blockRect(q); fp.append('rect').attr('x', r.x - 1.5).attr('y', r.y - 1.5).attr('width', r.w + 3).attr('height', r.h + 3).attr('rx', 2)
      .attr('fill', 'none').attr('stroke', col || 'var(--head)').attr('stroke-width', 2); };
    st.tagR = (uu, t, col) => MEM.pill(fp, a.x0 - 19, Y(uu) + 4, t, col || 'var(--cobalt)', 0, a.x0 + 2);
    st.tagZ = (uu, t, col) => MEM.pill(fp, xZ + 18, Y(uu) + 4, t, col || 'var(--cobalt)', xZ - 6, W);
    // a level across both panels; below rate 0 only the histogram has room for it
    st.hl = (uu, col, dash, w) => fp.append('line').attr('x1', o.neg && uu < o.f(0) ? xH0 : a.x0 - 4).attr('x2', xZ).attr('y1', Y(uu)).attr('y2', Y(uu))
      .attr('stroke', col).attr('stroke-width', w || 1.4).attr('stroke-dasharray', dash);
    st.labelAt = uu => Math.min(cx(uu), xW - (uu >= o.b0 ? cnt[binOf(uu)] : 0) * u) - 8;
    st.syncTicks = () => { const vis = o.cuts.map(c => { const g = svg.select('.' + c.cls).node(); return !!g && g.style.opacity !== '0'; });
      svg.selectAll('.tk').style('visibility', function () { const c = this.getAttribute('data-c'); return c && c.split(' ').some(q => vis[+q]) ? 'hidden' : null; }); };
    st.syncTicks();
    return st;
  }

  // the bars move to their bins: first down to a block at their own height, then across into the
  // stack, one after another in the order they stand
  function slide(st) {
    return new Promise(res => {
      if (reduce) { res(); return; }
      const { svg, Y, bx, bw, barY, xW, u, blocks, y0, o } = st, layer = svg.append('g').attr('class', 'tokens');
      svg.selectAll('.pbar').style('opacity', 0.25);
      let left = blocks.length;
      const done = () => { if (--left > 0) return; layer.remove(); res(); };
      blocks.forEach((q, i) => { const y1 = Y(o.b0 + (q.b + 1) * o.bw), yb = Y(o.b0 + q.b * o.bw), yt = barY(q.o);
        layer.append('rect').attr('fill', o.fill).attr('stroke', '#fff').attr('stroke-width', 1)
          .attr('x', bx(q.o)).attr('width', bw).attr('y', yt).attr('height', Math.max(0.8, y0 - yt))
          .transition().duration(550).ease(d3.easeCubicOut).attr('y', y1).attr('height', yb - y1)
          .transition().delay(i * 45).duration(750).ease(ease).attr('x', xW - q.c * u).attr('width', u)
          .on('end', done).on('interrupt', done).on('cancel', done); });
      if (!blocks.length) { layer.remove(); res(); }
    });
  }
  // the bars of a rate axis move to a log axis: taking logs stretches low values and squeezes high ones
  function toLog(st, dur) {
    return new Promise(res => {
      const { svg, y0 } = st;
      T(svg.select('.pax-lin'), dur * 0.3).style('opacity', 0);
      T(svg.selectAll('.pbar'), dur, dur * 0.2).attr('y', q => st.barY(q)).attr('height', q => Math.max(0.8, y0 - st.barY(q)));
      T(svg.select('.pax'), dur * 0.4, dur * 0.8).style('opacity', 1);
      setTimeout(res, reduce ? 0 : dur * 1.25);
    });
  }
  // fly copies of the chosen weeks from the season panels to their bars
  function fly(root, cellsSvg, poolSvg, values) {
    return new Promise(res => {
      if (reduce) { res(); return; }
      const cr = root.node().getBoundingClientRect();
      const layer = root.append('svg').attr('class', 'flylayer').attr('width', cr.width).attr('height', cr.height).attr('aria-hidden', 'true');
      const items = values.map(q => ({ q,
        a: cellsSvg.selectAll('.bar.sel').filter(d => d.j === q.j && d.i === q.i).node().getBoundingClientRect(),
        b: poolSvg.selectAll('.pbar').filter(d => d === q).node().getBoundingClientRect() }));
      let left = items.length;
      const done = () => { if (--left > 0) return; layer.remove(); res(); };
      items.forEach(({ q, a, b }) => layer.append('rect').attr('rx', 1.5).attr('fill', poolSvg.select('.pbar').attr('fill'))
        .attr('x', a.left - cr.left).attr('y', a.top - cr.top).attr('width', a.width).attr('height', a.height)
        .transition().delay((q.j - 1) * 160 + (q.rank - 1) * 40).duration(900).ease(ease)
        .attr('x', b.left - cr.left).attr('y', b.top - cr.top).attr('width', b.width).attr('height', b.height)
        .on('end', done).on('interrupt', done));
      if (!items.length) { layer.remove(); res(); }
    });
  }
  return { cells, side, slide, toLog, fly };
})();
