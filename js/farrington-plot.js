/* ============================================================
   farrington-plot.js: the shared drawing for figures 2 and 3.
   Baseline weeks sit in yearly clusters on the time axis
   (t = 1-7, 53-59, ...); the fitted line runs through them and is
   carried, dashed, to this week t0. At t0: this week's count, the
   expected count mu0 and the threshold U. Laid out in pixels from
   the card width, so text keeps its size on a phone.
   ============================================================ */

const FPLOT = (function () {
  const f1 = v => (Math.round(v * 10) / 10).toFixed(1);

  /* chart: d3 selection of an empty div.
     cfg: { clusters: [{year, t1, t2}], t0, yMax, nowLabel,
            draggable, onDrag(c, value), onDragEnd(), onHover(i) } */
  function create(chart, cfg) {
    let S = null;

    function layout() {
      const W = Math.max(300, chart.node().clientWidth || 720);
      const small = W < 520;
      const M = { top: 12, right: small ? 74 : 96, bottom: small ? 40 : 46, left: small ? 30 : 40 };
      const PH = small ? 230 : 280;
      const H = PH + M.top + M.bottom;
      chart.html('');
      const svg = chart.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
        .attr('role', 'img').attr('aria-label', cfg.desc || 'Baseline counts and the fitted line.');
      const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);
      const x = d3.scaleLinear().domain([cfg.clusters[0].t1 - 7, cfg.t0 + 7]).range([0, W - M.left - M.right]);
      const y = d3.scaleLinear().domain([0, cfg.yMax]).range([PH, 0]);

      const cols = g.append('g');
      cfg.clusters.forEach(cl => {
        const xa = x(cl.t1 - 0.5), xb = x(cl.t2 + 0.5), wd = Math.max(8, xb - xa), xc = (xa + xb) / 2;
        cols.append('rect').attr('class', 'farr-col').attr('x', xc - wd / 2).attr('width', wd)
          .attr('y', 0).attr('height', PH).attr('rx', 3);
        cols.append('text').attr('class', 'farr-tick').attr('x', xc).attr('y', PH + 17)
          .text(small ? cl.t1 : `${cl.t1}-${cl.t2}`);
        cols.append('text').attr('class', 'farr-tick-sub').attr('x', xc).attr('y', PH + 33).text(cl.year);
      });
      cols.append('line').attr('class', 'farr-now-col').attr('x1', x(cfg.t0)).attr('x2', x(cfg.t0)).attr('y1', 0).attr('y2', PH);
      cols.append('text').attr('class', 'farr-tick is-now').attr('x', x(cfg.t0)).attr('y', PH + 17).text(cfg.t0);
      cols.append('text').attr('class', 'farr-tick-sub is-now').attr('x', x(cfg.t0)).attr('y', PH + 33)
        .text(small ? 'now' : 'this week');
      g.append('line').attr('class', 'farr-xaxis').attr('x1', 0).attr('x2', x(cfg.t0 + 7)).attr('y1', PH + 0.5).attr('y2', PH + 0.5);
      g.append('g').attr('class', 'viz-axis viz-axis--bare')
        .call(d3.axisLeft(y).ticks(small ? 4 : 5).tickSize(0).tickPadding(8));

      S = { svg, g, x, y, W, PH, small,
            ref: g.append('g'), ghost: g.append('g'), curve: g.append('g'), now: g.append('g'),
            pts: g.append('g'), handles: g.append('g'), dragging: null, last: null };

      // hover (mouse) or tap (touch) a point to read it; a tap elsewhere clears it
      const nearest = ev => {
        if (S.dragging != null || !S.last) return;
        const [mx, my] = d3.pointer(ev, g.node());
        let best = -1, bd = 20 * 20;
        S.last.t.forEach((tv, i) => {
          const dx = S.x(tv) - mx, dy = S.y(Math.min(S.last.y[i], cfg.yMax)) - my, dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = i; }
        });
        cfg.onHover && cfg.onHover(best);
      };
      svg.on('pointermove', ev => { if (ev.pointerType === 'mouse') nearest(ev); })
        .on('pointerdown', ev => { if (ev.pointerType !== 'mouse') nearest(ev); })
        .on('pointerleave', ev => { if (ev.pointerType === 'mouse' && cfg.onHover) cfg.onHover(-1); });
      if (S.last) draw(S.last);
    }

    /* v: { t, y, curve(t), keep, ghost: {fn, cls, label}|null, mu0, U, y0,
            weight: [] (relative, 1 = untouched), hover, handles: [{c, mean}] } */
    function draw(v) {
      S.last = v;
      const { x, y, PH, small } = S;
      const top = cfg.yMax, cy = val => y(Math.min(val, top));
      const tFirst = cfg.clusters[0].t1, tLast = cfg.clusters[cfg.clusters.length - 1].t2;
      const line = d3.line().x(p => x(p[0])).y(p => cy(p[1]));
      const seg = (a, b, f) => d3.range(0, 41).map(k => { const tv = a + (b - a) * k / 40; return [tv, f(tv)]; });

      S.ghost.selectAll('path').data(v.ghost ? [v.ghost] : []).join('path')
        .attr('class', gh => gh.cls).attr('d', gh => line(seg(tFirst, cfg.t0, gh.fn)));
      const tMid = (cfg.clusters[0].t2 + cfg.clusters[1].t1) / 2;
      S.ghost.selectAll('text').data(v.ghost && v.ghost.label && !small ? [v.ghost] : []).join('text')
        .attr('class', gh => 'farr-ghost-label ' + (gh.labelCls || '')).attr('x', x(tMid))
        .attr('y', gh => cy(gh.fn(tMid)) - 10).text(gh => gh.label);

      // an optional note above one cluster ("old outbreak")
      const mk = v.mark ? [v.mark] : [];
      S.ref.selectAll('text').data(mk).join('text').attr('class', 'farr-mark')
        .attr('x', m => { const cl = cfg.clusters[m.c]; return x((cl.t1 + cl.t2) / 2); })
        .attr('y', m => cy(m.top) - 12).text(m => m.text);

      S.curve.selectAll('path').data([
        { cls: 'farr-fit', pts: seg(tFirst, tLast, v.curve) },
        { cls: 'farr-fit is-extrap', pts: seg(tLast, cfg.t0, v.curve) }
      ]).join('path').attr('class', p => p.cls).attr('d', p => line(p.pts));

      const rr = small ? 3.4 : 4.2;
      S.pts.selectAll('circle').data(v.t.map((tv, i) => ({ tv, val: v.y[i], i, w: v.weight ? v.weight[i] : 1 })), p => p.i)
        .join('circle')
        .attr('class', p => 'farr-pt' + (p.w < 0.999 ? ' is-down' : '') + (p.i === v.hover ? ' is-hover' : ''))
        .attr('cx', p => x(p.tv)).attr('cy', p => cy(p.val)).attr('r', rr)
        .style('fill-opacity', p => (p.w < 0.999 ? Math.max(0, p.w) * 0.85 : null));

      // this week: count, expected count and threshold, with labels kept apart
      const alarm = v.y0 > v.U;
      const xn = x(cfg.t0), bw = small ? 8 : 10;
      S.now.html('');
      S.now.append('rect').attr('class', 'farr-y0' + (alarm ? ' is-alarm' : ''))
        .attr('x', xn - bw / 2).attr('width', bw).attr('y', cy(v.y0)).attr('height', PH - cy(v.y0)).attr('rx', 2);
      if (v.refU != null) S.now.append('line').attr('class', 'farr-U is-ref')
        .attr('x1', xn - 15).attr('x2', xn + 15).attr('y1', cy(v.refU)).attr('y2', cy(v.refU));
      S.now.append('line').attr('class', 'farr-U').attr('x1', xn - 17).attr('x2', xn + 17)
        .attr('y1', cy(v.U)).attr('y2', cy(v.U));
      S.now.append('circle').attr('class', 'farr-mu0').attr('cx', xn).attr('cy', cy(v.mu0)).attr('r', small ? 4.6 : 5.6);
      const labs = [
        { y: cy(v.U), cls: 'is-U', txt: (v.U > top ? '\u2191 ' : '') + 'U = ' + f1(v.U) },
        { y: cy(v.mu0), cls: 'is-mu', txt: '\u03bc\u2080 = ' + f1(v.mu0) },
        { y: cy(v.y0), cls: alarm ? 'is-y0 is-alarm' : 'is-y0', txt: (small ? '' : 'this week ') + v.y0 + (alarm ? ' !' : '') }
      ];
      if (v.refU != null) labs.push({ y: cy(v.refU), cls: 'is-ref', txt: v.refLabel + (small ? '' : ' ' + f1(v.refU)) });
      labs.sort((a, b) => a.y - b.y);
      for (let i = 1; i < labs.length; i++) if (labs[i].y - labs[i - 1].y < 17) labs[i].y = labs[i - 1].y + 17;
      labs.forEach(l => S.now.append('text').attr('class', 'farr-now-lab ' + l.cls)
        .attr('x', xn + 22).attr('y', l.y).text(l.txt));

      if (!cfg.draggable) return;
      const hd = (v.handles || []).map(h => {
        const cl = cfg.clusters[h.c];
        return { c: h.c, cx: x((cl.t1 + cl.t2) / 2) + (small ? 15 : 19), cy: cy(h.mean) };
      });
      S.handles.selectAll('g.farr-handle').data(hd, h => h.c).join(enter => {
        const gh = enter.append('g').attr('class', 'farr-handle').attr('tabindex', 0)
          .attr('role', 'slider').attr('aria-label', h => `Move ${cfg.clusters[h.c].year} up or down`);
        gh.append('circle').attr('class', 'hit').attr('r', 22);
        gh.append('circle').attr('class', 'knob').attr('r', small ? 8 : 9);
        gh.append('path').attr('class', 'grip')
          .attr('d', 'M0,-5 L-3,-2 M0,-5 L3,-2 M0,-5 L0,5 M0,5 L-3,2 M0,5 L3,2');
        gh.on('pointerdown', function (ev, h) {
          ev.preventDefault();
          try { this.setPointerCapture(ev.pointerId); } catch (e) { /* synthetic event */ }
          S.dragging = h.c; d3.select(this).classed('is-active', true);
        }).on('pointermove', function (ev, h) {
          if (S.dragging !== h.c) return;
          cfg.onDrag(h.c, S.y.invert(d3.pointer(ev, S.g.node())[1]));
        }).on('pointerup pointercancel lostpointercapture', function () {
          if (S.dragging == null) return;
          S.dragging = null; d3.select(this).classed('is-active', false);
          cfg.onDragEnd && cfg.onDragEnd();
        }).on('keydown', function (ev, h) {
          const step = ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowDown' ? -1 : 0;
          if (!step) return;
          ev.preventDefault();
          cfg.onDrag(h.c, null, step);
        });
        return gh;
      }).attr('transform', h => `translate(${h.cx},${h.cy})`)
        .attr('aria-valuemin', 0).attr('aria-valuemax', cfg.yMax)
        .attr('aria-valuenow', h => Math.round(S.y.invert(h.cy)));
    }

    layout();
    let lastW = chart.node().clientWidth;
    new ResizeObserver(() => {
      const w = chart.node().clientWidth;
      if (Math.abs(w - lastW) > 4) { lastW = w; layout(); }
    }).observe(chart.node());
    return { draw, get small() { return S.small; } };
  }

  /* Chips for the three conditions under which the trend is kept. */
  function rules(sel, r, b) {
    const R = r.rules;
    const p = R.p < 0.001 ? '< 0.001' : '= ' + R.p.toFixed(3);
    const chips = [
      { ok: R.years, txt: `${b} years of data (need 3)` },
      { ok: R.significant, txt: R.significant ? `trend p ${p}, below 0.05` : `trend p ${p}, not below 0.05` },
      { ok: R.noExtrapolation, txt: `\u03bc\u2080${r.keep ? '' : ' with trend'} ${f1(R.mu0Trend)} ${R.noExtrapolation ? '\u2264' : '>'} largest count ${R.maxY}` }
    ];
    sel.selectAll('span').data(chips).join('span')
      .attr('class', c => 'farr-chip ' + (c.ok ? 'is-ok' : 'is-bad'))
      .html(c => `<i aria-hidden="true">${c.ok ? '\u2713' : '\u2717'}</i>${c.txt}`);
  }

  return { create, rules, f1 };
})();
