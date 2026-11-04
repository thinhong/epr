/* Figure 3: step 1, part 2. Smooth the MAP curve, take its increments, stop
   at the first increment below delta, then place the epidemic with k*.
   The curves follow one season; the rows show the result for every season. */
(function () {
  'use strict';
  const mount = document.querySelector('#viz-mem-opt');
  if (!mount) return;
  const { seasons, weeks, f1, f2, S, N, periods, sym, niceMax } = MEM;
  const YMAX = niceMax(d3.max(seasons, s => d3.max(s.t)));
  const state = { j: 1, delta: 2.8, focus: null, probe: null, row: null };
  const sea = () => seasons[state.j - 1];
  const per = s => periods(s || sea(), state.delta);
  const rCur = () => state.probe || per().r;
  const DMAX = Math.ceil(d3.max(seasons, s => d3.max(s.D)) / 5) * 5;

  const card = MEM.card(mount, 'Step 1b: where each epidemic starts and stops');

  const T = String.raw;
  const list = fn => seasons.map(s => `${s.tiny} ${fn(s)}`).join(', ');
  const ex = EXPL.create({
    terms: {
      D: { aria: 'Delta j r, the increment', desc: () => { const s = sea(), r = rCur();
        return r < S ? `${sym('&Delta;', 'j', String(r))} = ${f1(s.ps[r])} − ${f1(s.ps[r - 1])} = <b>${f2(s.D[r - 1])}</b> points: what week ${r + 1} would add to the smoothed curve of Season ${s.j}. Point at the curves to try other ${sym('r')}.` : 'There is no next week at r = S.'; } },
      pb: { aria: 'p breve, the smoothed MAP curve', desc: () => `${sym('p&#774;', 'j', 'r')} is the MAP curve smoothed by a kernel regression over ${sym('r')}. The paper selects the smoothing window automatically; here it is chosen by AICc (Season ${state.j}: h = ${f2(sea().h)} weeks). Dots: ${sym('p', 'j', 'r')}. Blue line: ${sym('p&#774;', 'j', 'r')}. Grey lines: the other seasons.` },
      rstar: { aria: 'r j star, the epidemic length', desc: () => { const p = per();
        return `${sym('r', 'j', '*')} is the first ${sym('r')} with ${sym('&Delta;', 'j', 'r')} &lt; ${sym('&delta;')}. Season ${state.j}: <b>${p.r} weeks</b>; every earlier week added at least ${state.delta.toFixed(1)} points. All seasons: ${list(s => per(s).r)}.`; } },
      delta: { aria: 'delta, the stopping value', desc: () => `${sym('&delta;')} = <b>${state.delta.toFixed(1)}%</b>. In the paper, it depends on the country, ranges from 2% to 4% and is chosen to maximise sensitivity and specificity (Vega et al., 2013). The authors' R package uses 2.8% by default.` },
      Dr: { aria: 'Delta j r in the rule', desc: () => `The rule reads the increments from ${sym('r')} = 1 upward and stops at the first one below the dashed ${sym('&delta;')} line. The small rings mark where each of the other seasons stops.` },
      kstar: { aria: 'k star, the epidemic start', desc: () => { const p = per();
        return `${sym('k')}<sup>*</sup> is where the best window of length ${sym('r', 'j', '*')} starts, the same max over ${sym('k')} as in step 1a. Season ${state.j}: ${sym('i')} = <b>${p.k}</b>, week ${weeks[p.k - 1]}. All seasons: ${list(s => 'week ' + weeks[per(s).k - 1])}.`; } },
      epi: { aria: 'the epidemic period', desc: () => { const s = seasons[(state.row || state.j) - 1], p = per(s);
        return `Season ${s.j}. Epidemic: weeks ${weeks[p.k - 1]} to ${weeks[p.end - 1]} (${sym('i')} = ${p.k} to ${p.end}, ${p.r} weeks). Before it, <span class="tl">pre-epidemic</span>: ${sym('i')} = 1 to ${p.k - 1}. After it, post-epidemic: ${sym('i')} = ${p.end + 1} to ${S}.`; } },
      rs2: { aria: 'r j star', desc: () => `${sym('r', 'j', '*')} = ${per().r} weeks for Season ${state.j}, from the rule above.` }
    },
    onFocus: k => { state.focus = k; drawFocus(); }
  });
  const lay = card.root.append('div').attr('class', 'f3lay');
  const colB = lay.append('div').attr('class', 'a-sb'), colC = lay.append('div').attr('class', 'a-sc'), ctlBox = lay.append('div').attr('class', 'a-ctl');
  const pBw = lay.append('div').attr('class', 'a-pb'), pCw = lay.append('div').attr('class', 'a-pc');
  const ctrl = ctlBox.append('div').attr('class', 'ctrl');
  const chips = ctrl.append('div').attr('class', 'chips').attr('role', 'group').attr('aria-label', 'Season shown in the curves');
  chips.append('span').attr('class', 'lab').html('season <i>j</i>');
  const sBtn = seasons.map(s => chips.append('button').attr('class', 'chip').attr('type', 'button').attr('id', 'f3-season-' + s.j)
    .html(`<span class="lg">${s.short}</span><span class="sm">${s.tiny}</span>`).on('click', () => { state.j = s.j; update(); }));
  const syncD = MEM.stepper(ctrl, 'δ', 'paper: 2% to 4%', () => state.delta,
    v => { state.delta = +v.toFixed(1); update(); }, [2, 4], 0.1, v => v.toFixed(1) + '%');
  ex.strip(colB, [{ tex: T`\class{t-D}{\Delta_j^{\,r}} = \class{t-pb}{\breve{p}_j^{\,r+1}} - \class{t-pb}{\breve{p}_j^{\,r}}` }],
    () => { const s = sea(), r = rCur(); return r < S ? `Season ${s.j}, ${sym('r')} = ${r}: ${f1(s.ps[r])} − ${f1(s.ps[r - 1])} = <b>${f2(s.D[r - 1])}</b> points. The <span class="am">orange step</span> on the curve is this increment.` : ''; });
  const pB = pBw.append('div').attr('class', 'panel');
  ex.strip(colC, [{ tex: T`\class{t-rstar}{r_j^{*}} = \min_{r = 1, \dots, S - 1} \left\{ r : \class{t-Dr}{\Delta_j^{\,r}} < \class{t-delta}{\delta} \right\}` }],
    () => { const s = sea(), p = per(); return `Season ${s.j}: the first increment below ${state.delta.toFixed(1)} is at ${sym('r')} = ${p.r} (${f2(s.D[p.r - 1])} points), so ${sym('r', 'j', '*')} = <b>${p.r} weeks</b>.`; });
  const pC = pCw.append('div').attr('class', 'panel');
  ex.strip(card.root, [
    { tex: T`\class{t-kstar}{k^{*}}:\ \sum_{i=k^{*}}^{k^{*}+r_j^{*}-1} t_{i,j} = \max_{k} \left\{ \sum_{i=k}^{k+r_j^{*}-1} t_{i,j} \right\}` },
    { tex: T`\class{t-epi}{\text{epidemic}}:\ \text{weeks } \class{t-kstar}{k^{*}} \text{ to } \class{t-kstar}{k^{*}} + \class{t-rs2}{r_j^{*}} - 1` }],
    () => `Every season now has three periods. Epidemic weeks: ${list(s => { const p = per(s); return weeks[p.k - 1] + ' to ' + weeks[p.end - 1]; })}.`);
  const pA = card.root.append('div').attr('class', 'panel');
  card.root.append('div').attr('class', 'hint').html('Point at a <b>blue symbol</b> (tap on a phone). Point at the curves to read other increments. Tap a row to follow that season, and change <b>&delta;</b>.');

  function update() {
    sBtn.forEach((b, q) => b.attr('aria-pressed', q + 1 === state.j)); syncD();
    const rs = seasons.map(s => per(s).r);
    card.status(`r* = ${d3.min(rs)} to ${d3.max(rs)} weeks`);
    drawRows(); drawCurves(); ex.refresh();
  }

  let G = null, A = null;
  function frame(node) {
    const W = Math.max(300, node.clientWidth), small = W < 520;
    const L = small ? 34 : 66, R = small ? 8 : 10;
    return { W, small, L, R, pw: W - L - R, xr: d3.scaleLinear().domain([0.5, S + 0.5]).range([L, W - R]) };
  }
  function drawCurves() {
    const s = sea(), p = per(), r = rCur(), F = frame(pB.node()), { W, small, R, xr } = F, L = F.L;
    const top = 14, h = small ? 104 : 112, H = top + h + 36;
    const xAxis = (svg, y0) => { [1, 10, 20, 30].forEach(v => svg.append('text').attr('class', 'ax ax-mid').attr('x', xr(v)).attr('y', y0 + 17).text(v));
      svg.append('text').attr('class', 'ax ax-mid').attr('x', (L + W - R) / 2).attr('y', y0 + 33).text('window length r (weeks)'); };
    /* smoothed MAP curve */
    pB.html('');
    const svgB = pB.append('svg').attr('class', 'svgB').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
      .attr('role', 'img').attr('aria-label', 'The MAP curve of the season and its smoothed version.');
    const yB = d3.scaleLinear().domain([0, 100]).range([top + h, top]);
    const line = d3.line().x((v, q) => xr(q + 1)).y(v => yB(v));
    [0, 50, 100].forEach(v => svgB.append('text').attr('class', 'ax ax-end').attr('x', L - 6).attr('y', yB(v)).attr('dominant-baseline', 'middle').text(v + '%'));
    svgB.append('line').attr('class', 'base').attr('x1', L).attr('x2', W - R).attr('y1', yB(0) + .5).attr('y2', yB(0) + .5);
    seasons.filter(o => o.j !== s.j).forEach(o => svgB.append('path').attr('class', 'dimmable other').attr('d', line(o.ps)).attr('fill', 'none').attr('stroke', 'var(--inactive)').attr('stroke-width', 1.1).attr('stroke-opacity', .8));
    s.p.forEach((v, q) => svgB.append('circle').attr('class', 'dimmable mapdot').attr('cx', xr(q + 1)).attr('cy', yB(v)).attr('r', 2.4).attr('fill', 'var(--inactive)'));
    svgB.append('path').attr('class', 'dimmable smooth').attr('d', line(s.ps)).attr('fill', 'none').attr('stroke', 'var(--cobalt)').attr('stroke-width', 2);
    if (r < S) svgB.append('path').attr('class', 'dimmable stepD').attr('d', `M${xr(r)},${yB(s.ps[r - 1])}H${xr(r + 1)}V${yB(s.ps[r])}`).attr('fill', 'none').attr('stroke', 'var(--amber)').attr('stroke-width', 2.4);
    svgB.append('circle').attr('class', 'dimmable cur').attr('cx', xr(r)).attr('cy', yB(s.ps[r - 1])).attr('r', 4.5).attr('fill', 'var(--cobalt)').attr('stroke', '#fff').attr('stroke-width', 1.5);
    svgB.append('text').attr('class', 'lab c halo dimmable smooth').attr('x', W - R).attr('y', yB(0) - 8).attr('text-anchor', 'end').text(s.short);
    xAxis(svgB, yB(0));
    svgB.append('g').attr('class', 'lyr-focus');
    /* increments and delta */
    pC.html('');
    const svgC = pC.append('svg').attr('class', 'svgC').attr('viewBox', `0 0 ${W} ${H}`).attr('width', W).attr('height', H)
      .attr('role', 'img').attr('aria-label', 'Increments of the smoothed MAP curves and the delta line.');
    const yC = d3.scaleLinear().domain([0, DMAX]).range([top + h, top]);
    yC.ticks(3).forEach(v => svgC.append('text').attr('class', 'ax ax-end').attr('x', L - 6).attr('y', yC(v)).attr('dominant-baseline', 'middle').text(v));
    svgC.append('line').attr('class', 'base').attr('x1', L).attr('x2', W - R).attr('y1', yC(0) + .5).attr('y2', yC(0) + .5);
    const lineC = d3.line().x((v, q) => xr(q + 1)).y(v => yC(v));
    seasons.filter(o => o.j !== s.j).forEach(o => { const po = per(o);
      svgC.append('path').attr('class', 'dimmable other').attr('d', lineC(o.D)).attr('fill', 'none').attr('stroke', 'var(--inactive)').attr('stroke-width', 1.1).attr('stroke-opacity', .8);
      svgC.append('circle').attr('class', 'dimmable other ostar').attr('cx', xr(po.r)).attr('cy', yC(o.D[po.r - 1])).attr('r', 3.4).attr('fill', '#fff').attr('stroke', 'var(--amber)').attr('stroke-width', 1.6); });
    s.D.forEach((v, q) => { const rr = q + 1, col = rr < p.r ? 'var(--cobalt)' : rr === p.r ? 'var(--amber)' : 'var(--inactive)';
      const g = svgC.append('g').attr('class', 'dimmable lolli' + (rr === r ? ' atr' : '') + (rr === p.r ? ' atrs' : '') + (rr < p.r ? ' before' : ''));
      g.append('line').attr('x1', xr(rr)).attr('x2', xr(rr)).attr('y1', yC(0)).attr('y2', yC(v)).attr('stroke', col).attr('stroke-width', 1.6);
      g.append('circle').attr('cx', xr(rr)).attr('cy', yC(v)).attr('r', rr === p.r ? 5 : 3).attr('fill', col).attr('stroke', rr === r && rr !== p.r ? 'var(--head)' : '#fff').attr('stroke-width', rr === r ? 1.6 : 1); });
    svgC.append('line').attr('class', 'dimmable dline').attr('x1', L).attr('x2', W - R).attr('y1', yC(state.delta)).attr('y2', yC(state.delta)).attr('stroke', 'var(--amber)').attr('stroke-width', 1.6).attr('stroke-dasharray', '6 4');
    svgC.append('text').attr('class', 'lab am dimmable dline halo').attr('x', W - R).attr('y', yC(state.delta) - 7).attr('text-anchor', 'end').text(`δ = ${state.delta.toFixed(1)}`);
    svgC.append('text').attr('class', 'lab am dimmable atrs halo').attr('x', xr(p.r) + 9).attr('y', yC(s.D[p.r - 1]) - 12).text(`r* = ${p.r}`);
    xAxis(svgC, yC(0));
    svgC.append('g').attr('class', 'lyr-focus');
    G = Object.assign(F, { s, p, r, yB, yC, L });
    drawFocus();
  }
  [pB, pC].forEach(pn => pn.on('pointerdown pointermove', ev => {
    if (!G) return;
    const node = pn.select('svg').node(), b = node.getBoundingClientRect(), mx = (ev.clientX - b.left) * (G.W / b.width);
    const rr = Math.max(1, Math.min(S - 1, Math.round(G.xr.invert(mx))));
    if (rr !== state.probe) { state.probe = rr; drawCurves(); ex.refresh(); }
  }).on('pointerleave', ev => { if (ev.pointerType === 'mouse' && state.probe) { state.probe = null; drawCurves(); ex.refresh(); } }));

  /* every season split into its three periods, two seasons to a row */
  function drawRows() {
    const W = Math.max(280, pA.node().clientWidth), small = W < 420, bh = small ? 26 : 30, band = 16;
    const g = MEM.grid(W, { lz: 18, bh: bh + 3 + band, az: 14 }), cw = g.cw, bw = Math.max(2, cw * 0.74), x = g.x;
    const base = j => g.oy(j) + 18 + bh, hy = v => v / YMAX * (bh - 1);
    pA.html('');
    const svgA = pA.append('svg').attr('class', 'svgA').attr('viewBox', `0 0 ${W} ${g.H}`).attr('width', W).attr('height', g.H)
      .attr('role', 'img').attr('aria-label', 'Every season split into pre-epidemic, epidemic and post-epidemic weeks.');
    seasons.forEach(s => {
      const p = per(s), j = s.j, b = base(j), on = j === state.j;
      svgA.append('rect').attr('class', 'cellbg').attr('x', g.ox(j) - 4).attr('y', g.oy(j) - 2).attr('width', g.cellW + 8).attr('height', g.cellH + 2).attr('rx', 8)
        .attr('fill', on ? 'var(--surf)' : 'transparent').attr('stroke', on ? 'var(--rule2)' : 'none');
      svgA.append('text').attr('class', 'rowlab' + (on ? ' on' : '')).attr('id', 'f3-row' + j).attr('x', g.ox(j)).attr('y', g.oy(j) + 11).style('text-anchor', 'start').text(small ? s.tiny : s.short);
      s.t.forEach((v, i0) => { const i = i0 + 1, cl = i < p.k ? 'pre' : i <= p.end ? 'epi' : 'post';
        svgA.append('rect').attr('class', `dimmable bar ${cl} s${j}`).attr('x', x(j, i) + (cw - bw) / 2).attr('width', bw)
          .attr('y', b - hy(v)).attr('height', Math.max(0.8, hy(v))).attr('rx', Math.min(1.5, bw / 3))
          .attr('fill', cl === 'epi' ? 'var(--cobalt)' : 'var(--teal)').attr('fill-opacity', cl === 'epi' ? 0.88 : cl === 'pre' ? 0.6 : 0.32); });
      const yb = b + 3;
      [[1, p.k - 1, ['pre-epidemic', 'pre', ''], 'pre'], [p.k, p.end, [`epidemic, ${p.r} weeks`, `${p.r} weeks`, `${p.r} wk`, `${p.r}`, ''], 'epi'], [p.end + 1, S, ['post-epidemic', 'post', ''], 'post']]
        .forEach(([a, z, texts, cl]) => { if (z < a) return;
          const xa = x(j, a) + 0.5, xb = x(j, z) + cw - 0.5, gg = svgA.append('g').attr('class', `dimmable band ${cl} s${j}`);
          gg.append('rect').attr('x', xa).attr('y', yb).attr('width', xb - xa).attr('height', band).attr('rx', 4)
            .attr('fill', cl === 'epi' ? 'var(--cobalt)' : cl === 'pre' ? 'var(--tealSoft)' : 'var(--tealFaint)');
          const tt = gg.append('text').attr('class', 'lab').attr('x', (xa + xb) / 2).attr('y', yb + band / 2 + 0.5).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
            .attr('fill', cl === 'epi' ? '#fff' : 'var(--tealInk)');
          for (const c of texts) { tt.text(c); if (tt.node().getComputedTextLength() <= xb - xa - 6) break; } });
      [[1, '40', 'start', 0], [14, '1', 'middle', cw / 2], [33, '20', 'end', cw]].forEach(([i, t, anc, dx]) =>
        svgA.append('text').attr('class', 'ax').attr('text-anchor', anc).attr('x', x(j, i) + dx).attr('y', yb + band + 13).text(t));
    });
    svgA.append('g').attr('class', 'lyr-focus');
    svgA.append('rect').attr('x', 0).attr('y', 0).attr('width', W).attr('height', g.H).attr('fill', 'transparent').style('cursor', 'pointer')
      .on('pointerdown pointermove', ev => { const [mx, my] = d3.pointer(ev, svgA.node()), j = g.at(mx, my).j; if (j !== state.row) { state.row = j; ex.fromChart('epi'); } })
      .on('pointerleave', ev => { if (ev.pointerType === 'mouse') { state.row = null; ex.fromChart(null); } })
      .on('click', ev => { const [mx, my] = d3.pointer(ev, svgA.node()), j = g.at(mx, my).j; state.row = j; if (j !== state.j) { state.j = j; update(); } ex.fromChart('epi'); });
    A = { W, g, cw, bw, x, base, rh: bh, bh: band, small };
  }

  function drawFocus() {
    if (!G || !A) return;
    const { s, p, r, W, L, R, xr, yB, yC } = G;
    const key = state.focus, svgs = card.root.selectAll('.panel svg');
    svgs.selectAll('.lyr-focus').html(''); svgs.selectAll('.dimmable').classed('keep', false);
    svgs.selectAll('.rowlab').classed('on', function () { return this.id === 'f3-row' + state.j; });
    const keep = q => card.root.selectAll(q).classed('keep', true);
    svgs.classed('focusing', ['D', 'pb', 'rstar', 'delta', 'Dr', 'kstar', 'epi', 'rs2'].includes(key));
    const fb = card.root.select('.svgB .lyr-focus'), fc = card.root.select('.svgC .lyr-focus'), fa = card.root.select('.svgA .lyr-focus');
    if (!key) return;
    if (key === 'D') { keep('.svgB .stepD, .svgB .cur, .svgB .smooth, .svgC .atr');
      if (r < S) fc.append('text').attr('class', 'lab c halo').attr('x', xr(r) + 9).attr('y', yC(s.D[r - 1]) - 10).text(`Δ = ${f2(s.D[r - 1])}`); }
    if (key === 'pb') keep('.svgB .smooth, .svgB .mapdot, .svgB .cur, .svgB .other');
    if (key === 'Dr') keep('.svgC .lolli, .svgC .dline, .svgC .ostar');
    if (key === 'delta') keep('.svgC .dline, .svgC .atrs, .svgC .ostar');
    if (key === 'rstar' || key === 'rs2') { keep('.svgC .atrs, .svgC .before, .svgC .dline, .svgA .epi');
      fb.append('line').attr('x1', xr(p.r)).attr('x2', xr(p.r)).attr('y1', yB(100)).attr('y2', yB(0)).attr('stroke', 'var(--amber)').attr('stroke-width', 2); }
    if (key === 'kstar' || key === 'epi') {
      if (key === 'epi' && state.row) keep(`.svgA .s${state.row}`); else keep('.svgA .epi, .svgA .band');
    }
    if (key === 'kstar') seasons.forEach(o => { const po = per(o), b = A.base(o.j), xx = A.x(o.j, po.k) + (A.cw - A.bw) / 2 - 1.5;
      fa.append('line').attr('x1', xx).attr('x2', xx).attr('y1', b - A.rh).attr('y2', b + 3 + A.bh).attr('stroke', 'var(--head)').attr('stroke-width', 2.2);
      const left = xx - A.g.ox(o.j) > 46;
      fa.append('text').attr('class', 'lab c halo').attr('x', xx + (left ? -5 : 5)).attr('y', b - A.rh / 2).attr('text-anchor', left ? 'end' : 'start').attr('dominant-baseline', 'middle').text(`k* = ${po.k}`); });
  }

  MEM.outsideTap(card.root.node(), () => {
    let ch = false;
    if (state.row) { state.row = null; ch = true; }
    if (state.probe) { state.probe = null; drawCurves(); ch = true; }
    if (ch) { ex.clearChart(); ex.refresh(); }
  });
  update();
  let lastW = 0;
  MEM.watchWidth(pA.node(), w => { if (w !== lastW) { lastW = w; drawRows(); drawCurves(); } });
})();
