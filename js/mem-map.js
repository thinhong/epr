/* Figure 2: step 1, part 1. In every season, the best window of r weeks;
   the MAP curve is the share of the season inside that best window.
   The seasons sit two to a row, next to the MAP curves, so a change of r
   shows in every season and in the curves at the same time. */
(function () {
  'use strict';
  const mount = document.querySelector('#viz-mem-map');
  if (!mount) return;
  const { seasons, weeks, f1, S, N, sym, niceMax } = MEM;
  const f0 = d3.format(',.0f'), YMAX = niceMax(d3.max(seasons, s => d3.max(s.t)));
  const state = { j: 1, r: 8, focus: null, probe: null };       // probe: { i, j } under the pointer
  const sea = () => seasons[state.j - 1];
  const winSums = (s, r) => d3.range(1, S - r + 2).map(k => d3.sum(s.t.slice(k - 1, k - 1 + r)));
  const span = (s, r) => { const k = s.k[r - 1]; return { k, e: k + r - 1 }; };
  const fmtT = v => v >= 100 ? f0(v) : f1(v);

  const card = MEM.card(mount, 'Step 1a: the best window in every season');

  const T = String.raw;
  const list = fn => seasons.map(s => `${s.tiny} ${fn(s)}`).join(', ');
  const ex = EXPL.create({
    terms: {
      trj: { aria: 't j r, the best window total', desc: () => `${sym('t', 'j', 'r')} is the largest total that ${state.r} consecutive weeks reach in season ${sym('j')}. Season ${state.j}: <b>${f1(sea().tr[state.r - 1])}</b>. Each season has its own: ${list(s => fmtT(s.tr[state.r - 1]))}.` },
      max: { aria: 'max over k', desc: () => `Slide the window over all ${sym('S')} − ${sym('r')} + 1 = ${S - state.r + 1} start weeks and keep the largest total. The dark line in each season is the total for each start ${sym('k')}; the dot is the largest.` },
      k: { aria: 'k, the start of the window', desc: () => { const { k } = span(sea(), state.r);
        return `${sym('k')} is the week where the window starts. For ${sym('r')} = ${state.r}, Season ${state.j} starts at ${sym('k')} = <b>${k}</b> (week ${weeks[k - 1]}). Each season finds its own start: ${list(s => 'week ' + weeks[s.k[state.r - 1] - 1])}.`; } },
      r: { aria: 'r, the window length', desc: () => `${sym('r')} is the window length: <b>${state.r}</b> consecutive weeks, the same in every season. Drag the slider, or drag across the MAP curves.` },
      S: { aria: 'S, weeks per season', desc: () => `${sym('S')} = <b>${S}</b> weeks per season, week 40 to week 20.` },
      sum: { aria: 'the window total', desc: () => { const s = sea(), { k, e } = span(s, state.r);
        return `The total inside the window. In Season ${s.j}, weeks ${weeks[k - 1]} to ${weeks[e - 1]} (${sym('i')} = ${k} to ${e}) add up to <b>${f1(s.tr[state.r - 1])}</b>.`; } },
      tij: { aria: 't i j, the weekly rate', desc: () => { const p = state.probe;
        return p ? `${sym('t', `${p.i},${p.j}`)}: week ${weeks[p.i - 1]} of Season ${p.j} has <b>${f1(seasons[p.j - 1].t[p.i - 1])}</b> per 100,000.`
                 : `${sym('t', 'i,j')} is the rate in week ${sym('i')} of season ${sym('j')}: one bar per week. Point at a bar to read it.`; } },
      prj: { aria: 'p j r, the share in the best window', desc: () => { const s = sea();
        return `${sym('p', 'j', 'r')} = ${f1(s.tr[state.r - 1])} / ${f1(s.total)} = <b>${f1(s.p[state.r - 1])}%</b> for Season ${s.j}. The dots are ${sym('p', 'j', 'r')} for every ${sym('r')}: together they are the MAP curve of the season. Grey lines: the other seasons.`; } },
      tSj: { aria: 't j S, the season total', desc: () => `${sym('t', 'j', 'S')} is the total of all ${S} weeks of the season. Season ${state.j}: <b>${f1(sea().total)}</b>. It equals the window total when ${sym('r')} = ${sym('S')}.` }
    },
    onFocus: k => { state.focus = k; drawFocus(); }
  });
  ex.strip(card.root, [
    { tex: T`\class{t-trj}{t_j^{\,r}} = \mathop{\class{t-max}{\max}}\limits_{\class{t-k}{k} = 1, \dots, \class{t-S}{S} - \class{t-r}{r} + 1} \left\{ \class{t-sum}{\sum_{i=\class{t-k}{k}}^{\class{t-k}{k}+\class{t-r}{r}-1} \class{t-tij}{t_{i,j}}} \right\}` },
    { tex: T`\class{t-prj}{p_j^{\,r}} = \class{t-trj}{t_j^{\,r}} \,\big/\, \class{t-tSj}{t_j^{\,S}}\,,\qquad \class{t-tSj}{t_j^{\,S}} = \sum_{i=1}^{\class{t-S}{S}} \class{t-tij}{t_{i,j}}` }],
    () => `Each box is that season's best ${state.r}-week window, the largest of ${S - state.r + 1} possible windows. Share of the season inside it: ${list(s => f1(s.p[state.r - 1]) + '%')}.`);
  const ctrl = card.root.append('div').attr('class', 'ctrl');
  const chips = ctrl.append('div').attr('class', 'chips').attr('role', 'group').attr('aria-label', 'Season shown in the readouts');
  chips.append('span').attr('class', 'lab').html('season <i>j</i>');
  const sBtn = seasons.map(s => chips.append('button').attr('class', 'chip').attr('type', 'button').attr('id', 'f2-season-' + s.j)
    .html(`<span class="lg">${s.short}</span><span class="sm">${s.tiny}</span>`).on('click', () => { state.j = s.j; update(); }));
  const syncR = MEM.slider(ctrl, 'r', 'weeks in the window', () => state.r, v => { state.r = v; update(); }, [1, S], 1);
  const body = card.root.append('div').attr('class', 'duo');
  const panelA = body.append('div').append('div').attr('class', 'panel');
  const panelB = body.append('div').append('div').attr('class', 'panel');
  card.root.append('div').attr('class', 'hint').html('Point at a <b>blue symbol</b> or a bar (tap on a phone). Tap a season to follow it. Drag across the MAP curves to change <i>r</i>.');

  function update() {
    sBtn.forEach((b, q) => b.attr('aria-pressed', q + 1 === state.j)); syncR();
    card.status(`r = ${state.r} weeks`);
    draw(); ex.refresh();
  }

  let A = null, B = null;
  function draw() {
    const r = state.r;
    /* panel A: the seasons, two to a row, each with its best window */
    const W = Math.max(280, panelA.node().clientWidth), small = W < 420;
    const gx = small ? 10 : 16, cols = 2, rows = Math.ceil(N / cols), cellW = (W - gx) / cols;
    const lz = 20, bh = small ? 46 : 56, az = 16, gy = 10, cellH = lz + bh + az;
    const cwk = cellW / S, bw = Math.max(2, cwk * 0.74), HA = rows * cellH + (rows - 1) * gy;
    const ox = j => ((j - 1) % cols) * (cellW + gx), oy = j => Math.floor((j - 1) / cols) * (cellH + gy);
    const x = (j, i) => ox(j) + (i - 1) * cwk, base = j => oy(j) + lz + bh, hy = v => v / YMAX * (bh - 2);
    panelA.html('');
    const svgA = panelA.append('svg').attr('class', 'svgA').attr('viewBox', `0 0 ${W} ${HA}`).attr('width', W).attr('height', HA)
      .attr('role', 'img').attr('aria-label', `${N} seasons of weekly rates, each with its best window of ${r} weeks.`);
    seasons.forEach(s => {
      const j = s.j, b = base(j), { k, e } = span(s, r), on = j === state.j;
      svgA.append('rect').attr('class', 'cellbg').attr('x', ox(j) - 4).attr('y', oy(j) - 2).attr('width', cellW + 8).attr('height', cellH + 2).attr('rx', 8)
        .attr('fill', on ? 'var(--surf)' : 'transparent').attr('stroke', on ? 'var(--rule2)' : 'none');
      const sl = svgA.append('text').attr('class', 'rowlab' + (on ? ' on' : '')).attr('id', 'f2-row' + j).attr('x', ox(j)).attr('y', oy(j) + 11).style('text-anchor', 'start').text(small ? s.tiny : s.short);
      const slw = sl.node().getComputedTextLength();
      svgA.append('line').attr('class', 'base').attr('x1', ox(j)).attr('x2', ox(j) + cellW).attr('y1', b + .5).attr('y2', b + .5);
      const bx0 = x(j, k) + (cwk - bw) / 2 - 2, bx1 = x(j, e) + (cwk + bw) / 2 + 2;
      svgA.append('rect').attr('class', `dimmable win win${j}`).attr('x', bx0).attr('y', b - bh).attr('width', bx1 - bx0).attr('height', bh + 2)
        .attr('rx', 5).attr('fill', 'var(--cobaltFaint)').attr('stroke', 'var(--cobalt)').attr('stroke-width', on ? 1.8 : 1.2);
      s.t.forEach((v, i0) => { const i = i0 + 1, inW = i >= k && i <= e;
        svgA.append('rect').attr('class', `dimmable bar s${j}` + (inW ? ' inwin' : ''))
          .attr('x', x(j, i) + (cwk - bw) / 2).attr('width', bw).attr('y', b - hy(v)).attr('height', Math.max(0.8, hy(v))).attr('rx', Math.min(1.5, bw / 3))
          .attr('fill', inW ? 'var(--cobalt)' : 'var(--inactive)').attr('fill-opacity', inW ? 0.88 : 0.7); });
      const wl = svgA.append('text').attr('class', `lab c dimmable win winlab wl${j}`).attr('y', oy(j) + 11).attr('text-anchor', 'middle').text(fmtT(s.tr[r - 1]));
      const tw = wl.node().getComputedTextLength();
      wl.attr('x', Math.min(ox(j) + cellW - tw / 2, Math.max(ox(j) + slw + 8 + tw / 2, (bx0 + bx1) / 2)));
      [[1, '40', 'start', 0], [14, '1', 'middle', cwk / 2], [33, '20', 'end', cwk]].forEach(([i, t, anc, dx]) =>
        svgA.append('text').attr('class', 'ax').attr('text-anchor', anc).attr('x', x(j, i) + dx).attr('y', b + 14).text(t));
    });
    svgA.append('g').attr('class', 'lyr-focus');
    const cellAt = ev => { const [mx, my] = d3.pointer(ev, svgA.node());
      const c = Math.max(0, Math.min(cols - 1, Math.floor(mx / (cellW + gx / 2)))), rr = Math.max(0, Math.min(rows - 1, Math.floor(my / (cellH + gy / 2))));
      const j = Math.min(N, rr * cols + c + 1); return { j, i: Math.max(1, Math.min(S, Math.floor((mx - ox(j)) / cwk) + 1)) }; };
    svgA.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', HA).attr('fill', 'transparent').style('cursor', 'pointer')
      .on('pointerdown pointermove', ev => { const c = cellAt(ev); if (state.focus === 'tij' && state.probe && c.i === state.probe.i && c.j === state.probe.j) return; state.probe = c; ex.fromChart('tij'); })
      .on('pointerleave', ev => { if (ev.pointerType === 'mouse') { state.probe = null; ex.fromChart(null); } })
      .on('click', ev => { const c = cellAt(ev); state.probe = c; if (c.j !== state.j) { state.j = c.j; update(); } ex.fromChart('tij'); });
    A = { W, cellW, cwk, bw, x, base, bh, lz, oy, ox, hy, small };
    /* panel B: the MAP curves */
    const WB = Math.max(260, panelB.node().clientWidth), sB = WB < 420, Lb = 40, Rb = 8;
    const HB = sB && small ? 170 : Math.max(170, HA), hB = HB - 46;
    panelB.html('');
    const svgB = panelB.append('svg').attr('class', 'svgB').attr('viewBox', `0 0 ${WB} ${HB}`).attr('width', WB).attr('height', HB)
      .attr('role', 'img').attr('aria-label', 'MAP curves: the share of each season in its best window, for every window length r.');
    const xr = d3.scaleLinear().domain([0.5, S + 0.5]).range([Lb, WB - Rb]), yB = d3.scaleLinear().domain([0, 100]).range([hB + 6, 6]);
    [0, 50, 100].forEach(v => svgB.append('text').attr('class', 'ax ax-end').attr('x', Lb - 6).attr('y', yB(v)).attr('dominant-baseline', 'middle').text(v + '%'));
    svgB.append('line').attr('class', 'base').attr('x1', Lb).attr('x2', WB - Rb).attr('y1', yB(0) + .5).attr('y2', yB(0) + .5);
    svgB.append('line').attr('class', 'dimmable gl').attr('x1', xr(r)).attr('x2', xr(r)).attr('y1', yB(100)).attr('y2', yB(0)).attr('stroke', 'var(--cobalt)').attr('stroke-opacity', .35).attr('stroke-dasharray', '3 3');
    const line = d3.line().x((v, q) => xr(q + 1)).y(v => yB(v));
    seasons.filter(s => s.j !== state.j).forEach(s => {
      svgB.append('path').attr('class', 'dimmable other').attr('d', line(s.p)).attr('fill', 'none').attr('stroke', 'var(--inactive)').attr('stroke-width', 1.3);
      svgB.append('circle').attr('class', 'dimmable other').attr('cx', xr(r)).attr('cy', yB(s.p[r - 1])).attr('r', 3).attr('fill', 'var(--inactive)');
    });
    const s = sea();
    svgB.append('path').attr('class', 'dimmable mapline').attr('d', line(s.p)).attr('fill', 'none').attr('stroke', 'var(--cobalt)').attr('stroke-opacity', .5).attr('stroke-width', 1.4);
    s.p.forEach((v, q) => svgB.append('circle').attr('class', 'dimmable mapdot').attr('cx', xr(q + 1)).attr('cy', yB(v)).attr('r', 2.4).attr('fill', 'var(--cobalt)').attr('fill-opacity', .55));
    svgB.append('circle').attr('class', 'dimmable cur').attr('cx', xr(r)).attr('cy', yB(s.p[r - 1])).attr('r', 5.5).attr('fill', 'var(--cobalt)').attr('stroke', '#fff').attr('stroke-width', 1.5);
    const right = r > S * 0.55;
    svgB.append('text').attr('class', 'lab c dimmable cur halo').attr('x', xr(r) + (right ? -9 : 9)).attr('y', yB(s.p[r - 1]) + 17).attr('text-anchor', right ? 'end' : 'start')
      .text(`${s.tiny}: ${f1(s.p[r - 1])}%`);
    [1, 10, 20, 30].forEach(v => svgB.append('text').attr('class', 'ax ax-mid').attr('x', xr(v)).attr('y', yB(0) + 17).text(v));
    svgB.append('text').attr('class', 'ax ax-mid').attr('x', (Lb + WB - Rb) / 2).attr('y', yB(0) + 34).text('window length r (weeks)');
    svgB.append('g').attr('class', 'lyr-focus');
    B = { WB, Lb, xr, yB };
    drawFocus();
  }
  // drag (touch) or hover (mouse) across the MAP curves to change r
  panelB.on('pointerdown pointermove', ev => {
    if (!B) return;
    if (ev.type === 'pointermove' && ev.pointerType !== 'mouse' && !ev.buttons) return;
    const node = panelB.select('svg').node(); if (!node) return;
    const b = node.getBoundingClientRect(), mx = (ev.clientX - b.left) * (B.WB / b.width);
    if (mx < B.Lb - 6) return;
    const nr = Math.max(1, Math.min(S, Math.round(B.xr.invert(mx))));
    if (nr !== state.r) { state.r = nr; update(); }
  });

  function drawFocus() {
    if (!A || !B) return;
    const r = state.r, { cwk, bw, x, base, bh, oy, ox, hy, cellW } = A;
    const key = state.focus, svgs = card.root.selectAll('.panel svg');
    svgs.selectAll('.lyr-focus').html(''); svgs.selectAll('.dimmable').classed('keep', false);
    const fa = card.root.select('.svgA .lyr-focus');
    const keep = q => card.root.selectAll(q).classed('keep', true);
    svgs.classed('focusing', ['sum', 'trj', 'tij', 'prj', 'tSj', 'max'].includes(key));
    card.root.selectAll('.svgA .winlab').style('opacity', ['k', 'r', 'S', 'tSj'].includes(key) ? 0 : null);
    const bracket = (j, a, z, label) => { const y = oy(j) + 15;
      fa.append('path').attr('d', `M${a},${y + 4}V${y}H${z}V${y + 4}`).attr('fill', 'none').attr('stroke', 'var(--head)').attr('stroke-width', 1.5);
      fa.append('text').attr('class', 'lab c halo').attr('x', Math.min(ox(j) + cellW - 2, Math.max(ox(j) + 40, (a + z) / 2))).attr('y', y - 3).attr('text-anchor', 'middle').text(label); };
    if (state.probe && (key === 'tij' || !key)) {
      const { i, j } = state.probe, v = seasons[j - 1].t[i - 1], b = base(j);
      fa.append('rect').attr('x', x(j, i)).attr('y', b - hy(v) - 2).attr('width', cwk).attr('height', hy(v) + 3).attr('rx', 2).attr('fill', 'none').attr('stroke', 'var(--head)').attr('stroke-width', 1.5);
      const anc = i > S - 6 ? 'end' : i < 6 ? 'start' : 'middle';
      fa.append('text').attr('class', 'lab c halo').attr('x', x(j, i) + cwk / 2).attr('y', Math.max(oy(j) + 30, b - hy(v) - 6)).attr('text-anchor', anc).text(f1(v));
    }
    if (!key) return;
    if (key === 'tij') { if (state.probe) card.root.selectAll(`.svgA .bar.s${state.probe.j}`).filter((d, q) => q === state.probe.i - 1).classed('keep', true); else keep('.svgA .bar'); }
    if (key === 'sum' || key === 'trj') keep('.svgA .inwin, .svgA .win');
    if (key === 'trj' || key === 'prj') keep('.svgB .cur');
    if (key === 'prj') keep('.svgB .mapdot, .svgB .mapline');
    if (key === 'tSj') { keep(`.svgA .bar.s${state.j}`); bracket(state.j, x(state.j, 1), x(state.j, S + 1), `${A.small ? '' : 'total '}${fmtT(sea().total)}`); }
    if (key === 'S') bracket(state.j, x(state.j, 1), x(state.j, S + 1), `S = ${S} weeks`);
    if (key === 'r') seasons.forEach(s => { const { k, e } = span(s, r); bracket(s.j, x(s.j, k) + 1, x(s.j, e + 1) - 1, `r = ${r}`); });
    if (key === 'k') seasons.forEach(s => { const { k } = span(s, r), b = base(s.j), xx = x(s.j, k) + (cwk - bw) / 2 - 2;
      fa.append('line').attr('x1', xx).attr('x2', xx).attr('y1', b - bh - 4).attr('y2', b + 3).attr('stroke', 'var(--head)').attr('stroke-width', 2.2);
      const left = xx - ox(s.j) > 44;
      fa.append('text').attr('class', 'lab c halo').attr('x', xx + (left ? -5 : 5)).attr('y', b - bh + 10).attr('text-anchor', left ? 'end' : 'start').text(`k = ${k}`); });
    if (key === 'max' || key === 'k') {
      if (key === 'max') keep('.svgA .win');
      seasons.forEach(s => {
        const ws = winSums(s, r), m = d3.max(ws), b = base(s.j), { k } = span(s, r);
        const xs = q => x(s.j, q) + (r * cwk) / 2, yl = v => b - 3 - (v / m) * (bh - 8);
        fa.append('path').attr('d', d3.line().x((v, q) => xs(q + 1)).y(v => yl(v))(ws)).attr('fill', 'none').attr('stroke', 'var(--ink2)').attr('stroke-width', 1.5);
        fa.append('circle').attr('cx', xs(k)).attr('cy', yl(ws[k - 1])).attr('r', 4).attr('fill', 'var(--cobalt)').attr('stroke', '#fff').attr('stroke-width', 1.2);
      });
    }
  }

  MEM.outsideTap(card.root.node(), () => { if (state.probe) { state.probe = null; ex.clearChart(); drawFocus(); } });
  update();
  MEM.watchWidth(panelA.node(), () => draw());
})();
