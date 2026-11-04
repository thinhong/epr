/* Figure 1: the weekly series as it was reported, then cut into seasons.
   Some weeks were never reported (hatched). Some weeks were reported but fall
   between seasons. The paper's season runs from week 40 to week 20, so the cut
   keeps those 33 weeks of each complete season; a week with no data inside a
   season is filled in (the paper's rule), and everything else is left out. */
(function () {
  'use strict';
  const mount = document.querySelector('#viz-mem-series');
  if (!mount) return;
  const { seasons, weeks, f1, S, N, sym, reduce, niceMax } = MEM;
  const series = MEMDATA.series.map(([y, w, v], u) => ({ u, y, w, v }));
  const U = series.length, at = new Map(series.map(d => [`${d.y}-${d.w}`, d.u]));
  const win = seasons.map(s => ({ j: s.j, a: at.get(`${s.year0}-40`), b: at.get(`${s.year0 + 1}-20`) }));
  const curA = at.get(`${seasons[N - 1].year0 + 1}-40`);            // the season now running (incomplete)
  series.forEach(d => { const o = win.find(q => d.u >= q.a && d.u <= q.b);
    d.j = o ? o.j : 0; d.i = o ? d.u - o.a + 1 : 0; d.cur = curA != null && d.u >= curA; });
  const bars = series.filter(d => d.v != null);
  const gaps = []; series.forEach(d => { if (d.v != null) return; const g = gaps[gaps.length - 1];
    if (g && g.u1 === d.u - 1) g.u1 = d.u; else gaps.push({ u0: d.u, u1: d.u }); });
  const imps = seasons.flatMap(s => s.imputed.map(i => ({ j: s.j, i, v: s.t[i - 1], u: win[s.j - 1].a + i - 1 })));
  const YMAX = niceMax(d3.max(bars, d => d.v));
  const yr = (j, i) => seasons[j - 1].year0 + (i >= 14 ? 1 : 0);
  const state = { mode: 'series', cell: { i: 16, j: 1 }, wk: null, focus: null };

  const card = MEM.card(mount, 'From the weekly series to seasons');
  card.status(`${MEMDATA.country}: N = ${N} seasons, S = ${S} weeks`);

  const ex = EXPL.create({
    terms: {
      tij: { aria: 't i j, the rate in week i of season j', desc: () => { const { i, j } = state.cell, s = seasons[j - 1], v = s.t[i - 1];
        if (s.raw[i - 1] == null) { const e = s.est[s.imputed.indexOf(i)];
          return `Week ${weeks[i - 1]} of ${yr(j, i)} is inside Season ${j} but has no data. The paper fills such a week with a smoothing regression over the whole season (Vega et al., 2013).` +
            (e < 0 ? ` Here the regression gives ${d3.format('.2f')(e)}; a rate cannot be negative, so the authors' R package sets it to 0: ${sym('t', `${i},${j}`)} = <b>${f1(v)}</b> (dashed bar).`
                   : ` Here ${sym('t', `${i},${j}`)} = <b>${f1(v)}</b> (dashed bar).`); }
        return `${sym('t', 'i,j')} is the rate in week ${sym('i')} of season ${sym('j')}. Here ${sym('t', `${i},${j}`)} = <b>${f1(v)}</b> per 100,000: week ${weeks[i - 1]} of ${yr(j, i)}, in Season ${j}.`; } },
      wk: { aria: 'a week outside the seasons', desc: () => { const d = series[state.wk]; if (!d) return '';
        const where = d.cur ? 'It belongs to the current season, which is not complete, so it is not used to build the model.'
                            : 'It falls between seasons, so the cut leaves it out.';
        return d.v == null ? `Week ${d.w} of ${d.y}: <b>no data</b>. ${where}` : `Week ${d.w} of ${d.y}: <b>${f1(d.v)}</b> per 100,000. ${where}`; } },
      i: { aria: 'i, the week of the season', desc: () => { const i = state.cell.i;
        return `${sym('i')} counts the weeks of a season: ${sym('i')} = 1 is week 40 and ${sym('i')} = ${S} is week 20. The outlined bars are week ${sym('i')} = ${i} (week ${weeks[i - 1]}) of every season.`; } },
      S: { aria: 'S, weeks per season', desc: () => `${sym('S')} = <b>${S}</b> weeks: a season runs from week 40 to week 20 of the next year, as in the paper. Weeks 21 to 39 fall between seasons.` },
      j: { aria: 'j, the season', desc: () => { const s = seasons[state.cell.j - 1];
        return `${sym('j')} numbers the seasons. Season ${sym('j')} = <b>${s.j}</b> runs from week 40 of ${s.year0} to week 20 of ${s.year0 + 1}.`; } },
      N: { aria: 'N, number of seasons', desc: () => `${sym('N')} = <b>${N}</b> complete seasons. The current season started in week 40 of ${seasons[N - 1].year0 + 1}; it is not complete, so it is not used.` }
    },
    onFocus: k => { state.focus = k; drawFocus(); }
  });
  ex.strip(card.root, [{ tex: String.raw`\class{t-tij}{t_{\class{t-i}{i},\,\class{t-j}{j}}}\,,\quad \class{t-i}{i} = 1, \dots, \class{t-S}{S}\,,\quad \class{t-j}{j} = 1, \dots, \class{t-N}{N}` }],
    () => state.mode === 'series'
      ? `${MEMDATA.country}, weekly ILI rate per 100,000, week ${series[0].w} of ${series[0].y} to week ${series[U - 1].w} of ${series[U - 1].y}. Hatching marks weeks with no data. Brackets mark the seasons, week 40 to week 20; grey bars fall between seasons. Press <b>Cut into seasons</b>.`
      : `Each season is now one row on the same scale. Weeks between seasons and the current season are left out. One week inside Season ${imps.length ? imps[0].j : ''} had no data, so it is filled in (dashed).`);
  const ctrl = card.root.append('div').attr('class', 'ctrl');
  const chips = ctrl.append('div').attr('class', 'chips').attr('role', 'group').attr('aria-label', 'View');
  const modes = [['series', 'Whole series'], ['seasons', 'Cut into seasons']];
  const mBtn = modes.map(([m, t]) => chips.append('button').attr('class', 'chip').attr('type', 'button').attr('id', 'f1-' + m).text(t)
    .on('click', () => { if (state.mode !== m) { state.mode = m; sync(); morph(); ex.refresh(); } }));
  function sync() { mBtn.forEach((b, q) => b.attr('aria-pressed', modes[q][0] === state.mode)); }
  sync();
  card.root.append('div').attr('class', 'legend').html(
    `<span><i class="sw" style="background:var(--cobalt)"></i>week in a season</span>` +
    `<span><i class="sw" style="background:var(--inactive)"></i>week between seasons</span>` +
    `<span><i class="sw hatch"></i>no data</span>` +
    `<span><i class="sw dash"></i>no data inside a season, filled in</span>`);
  const panel = card.root.append('div').attr('class', 'panel');
  card.root.append('div').attr('class', 'hint').html('Point at a <b>blue symbol</b> or at any week (tap on a phone).');

  let G = null, svg = null;
  function geom() {
    const W = Math.max(300, panel.node().clientWidth), small = W < 520;
    const L = small ? 34 : 66, R = small ? 8 : 10, pw = W - L - R;
    const slot = pw / U, bwS = Math.max(0.9, slot * 0.78);
    const tS = 30, hS = small ? 96 : 120, HS = tS + hS + 40;
    const rh = small ? 34 : 40, rg = small ? 10 : 12, tR = 34;
    const base = j => tR + j * rh + (j - 1) * rg, HR = base(N) + 28;
    const cw = pw / S, bwR = Math.max(3, cw * 0.72);
    const ser = d => { const h = d.v / YMAX * hS; return { x: L + d.u * slot + (slot - bwS) / 2, w: bwS, y: tS + hS - h, h: Math.max(0.8, h) }; };
    const row = (j, i, v) => { const h = v / YMAX * (rh - 2); return { x: L + (i - 1) * cw + (cw - bwR) / 2, w: bwR, y: base(j) - h, h: Math.max(0.8, h) }; };
    return { W, small, L, R, pw, slot, tS, hS, HS, rh, rg, tR, base, HR, cw, ser, row, uX: u => L + u * slot };
  }
  const posBar = d => state.mode === 'series' || !d.j ? G.ser(d) : G.row(d.j, d.i, d.v);
  const H_ = () => state.mode === 'series' ? G.HS : G.HR;

  function draw() {
    G = geom();
    const { W, small, L, R, pw, slot, tS, hS, base, cw, uX } = G, cut = state.mode === 'seasons';
    panel.html('');
    svg = panel.append('svg').attr('viewBox', `0 0 ${W} ${H_()}`).attr('width', W).attr('height', H_())
      .attr('role', 'img').attr('aria-label', `Weekly ILI rates in ${MEMDATA.country}, as one series with gaps, or cut into ${N} seasons of week 40 to week 20.`);
    svg.append('defs').html('<pattern id="f1-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="5" fill="var(--inactive)"/></pattern>');
    /* series layer */
    const gS = svg.append('g').attr('class', 'g-series').style('opacity', cut ? 0 : 1);
    gaps.forEach(g => gS.append('rect').attr('class', 'gap').attr('x', uX(g.u0)).attr('y', tS).attr('width', Math.max(1, uX(g.u1 + 1) - uX(g.u0))).attr('height', hS)
      .attr('fill', 'url(#f1-hatch)').attr('opacity', .75));
    const yS = v => tS + hS - v / YMAX * hS;
    [0, YMAX / 2, YMAX].forEach(v => gS.append('text').attr('class', 'ax ax-end').attr('x', L - 6).attr('y', yS(v)).attr('dominant-baseline', 'middle').text(v));
    gS.append('line').attr('class', 'base').attr('x1', L).attr('x2', W - R).attr('y1', tS + hS + .5).attr('y2', tS + hS + .5);
    win.forEach(o => {
      const a = uX(o.a), b = uX(o.b + 1), y = tS - 11;
      gS.append('path').attr('class', 'brk brk' + o.j).attr('d', `M${a + 1},${y + 5}V${y}H${b - 1}V${y + 5}`).attr('fill', 'none').attr('stroke', 'var(--cobalt)').attr('stroke-width', 1.4);
      gS.append('text').attr('class', 'lab c slab').attr('id', 'f1-slab' + o.j).attr('x', (a + b) / 2).attr('y', y - 5).attr('text-anchor', 'middle').text(small ? 'S' + o.j : 'Season ' + o.j);
      if (!small || o.j === 1) [[o.a, '40'], [o.a + 13, '1'], [o.b, '20']].forEach(([u, t]) => {
        if (small && t === '1') return;
        gS.append('text').attr('class', 'ax ax-mid').attr('x', uX(u) + slot / 2).attr('y', tS + hS + 14).text(t); });
    });
    if (curA != null) { const a = uX(curA), b = uX(U), y = tS - 11;
      gS.append('path').attr('d', `M${a + 1},${y + 5}V${y}H${b}`).attr('fill', 'none').attr('stroke', 'var(--inactive)').attr('stroke-width', 1.4).attr('stroke-dasharray', '3 2');
      gS.append('text').attr('class', 'lab mu').attr('x', b).attr('y', y - 5).attr('text-anchor', 'end').text(small ? 'now' : 'current'); }
    if (!small && N >= 3) { const a = uX(win[1].b + 1), b = uX(win[2].a);
      gS.append('text').attr('class', 'lab mu').attr('x', (a + b) / 2).attr('y', tS + hS * 0.55).attr('text-anchor', 'middle').text('between');
      gS.append('text').attr('class', 'lab mu').attr('x', (a + b) / 2).attr('y', tS + hS * 0.55 + 15).attr('text-anchor', 'middle').text('seasons'); }
    for (let y = series[0].y; y <= series[U - 1].y; y++) {
      const u0 = y === series[0].y ? 0 : at.get(`${y}-1`), u1 = y === series[U - 1].y ? U : at.get(`${y + 1}-1`);
      if (y > series[0].y) gS.append('line').attr('x1', uX(u0)).attr('x2', uX(u0)).attr('y1', tS + hS).attr('y2', tS + hS + 34).attr('stroke', 'var(--rule2)');
      gS.append('text').attr('class', 'lab mu').attr('x', (uX(u0) + uX(u1)) / 2).attr('y', tS + hS + 32).attr('text-anchor', 'middle').text(y);
    }
    if (!small) { gS.append('text').attr('class', 'ax').attr('x', 0).attr('y', tS + hS + 14).text('week'); gS.append('text').attr('class', 'ax').attr('x', 0).attr('y', tS + hS + 32).text('year'); }
    /* seasons layer */
    const gR = svg.append('g').attr('class', 'g-rows').style('opacity', cut ? 1 : 0);
    const xNY = L + 13 * cw;
    gR.append('line').attr('x1', xNY).attr('x2', xNY).attr('y1', G.tR - 6).attr('y2', base(N) + 2).attr('stroke', 'var(--inactive)').attr('stroke-dasharray', '2 3');
    gR.append('text').attr('class', 'ax ax-mid nylab').attr('x', xNY).attr('y', G.tR - 10).text('new year');
    seasons.forEach(s => {
      gR.append('line').attr('class', 'base').attr('x1', L).attr('x2', W - R).attr('y1', base(s.j) + .5).attr('y2', base(s.j) + .5);
      gR.append('text').attr('class', 'rowlab').attr('id', 'f1-row' + s.j).attr('x', L - 8).attr('y', base(s.j) - G.rh / 2).text(small ? s.tiny : s.short);
    });
    [1, 5, 9, 13, 17, 21, 25, 29, 33].forEach(i => gR.append('text').attr('class', 'ax ax-mid').attr('x', L + (i - 0.5) * cw).attr('y', base(N) + 17).text(weeks[i - 1]));
    if (!small) gR.append('text').attr('class', 'ax').attr('x', 0).attr('y', base(N) + 17).text('week');
    imps.forEach(m => { const r = G.row(m.j, m.i, m.v), h = Math.max(3, r.h);
      gR.append('rect').attr('class', `dimmable imp s${m.j} w${m.i}`).attr('x', r.x).attr('y', base(m.j) - h).attr('width', r.w).attr('height', h)
        .attr('fill', 'var(--cobaltFaint)').attr('stroke', 'var(--cobalt)').attr('stroke-width', 1.2).attr('stroke-dasharray', '2 1.5');
      gR.append('text').attr('class', `lab c dimmable imp implab halo s${m.j} w${m.i}`).attr('x', r.x + r.w / 2).attr('y', base(m.j) - h - 5).attr('text-anchor', 'middle').text('filled in'); });
    /* the bars: every reported week, in both views */
    svg.append('g').attr('class', 'g-bars').selectAll('rect').data(bars, d => d.u).join('rect')
      .attr('class', d => `dimmable bar u${d.u}` + (d.j ? ` s${d.j} w${d.i}` : ' out'))
      .attr('fill', d => d.j ? 'var(--cobalt)' : 'var(--inactive)').attr('fill-opacity', d => d.j ? .82 : .9)
      .style('opacity', d => cut && !d.j ? 0 : null)
      .each(function (d) { const r = posBar(d); d3.select(this).attr('x', r.x).attr('y', r.y).attr('width', r.w).attr('height', r.h); });
    svg.append('g').attr('class', 'lyr-focus');
    svg.append('rect').attr('class', 'hit').attr('x', L).attr('y', 0).attr('width', pw).attr('height', H_()).attr('fill', 'transparent')
      .on('pointerdown pointermove', ev => {
        const [mx, my] = d3.pointer(ev, svg.node());
        if (state.mode === 'series') {
          const d = series[Math.max(0, Math.min(U - 1, Math.floor((mx - L) / slot)))];
          if (d.j) { if (state.focus === 'tij' && state.cell.i === d.i && state.cell.j === d.j) return; state.cell = { i: d.i, j: d.j }; ex.fromChart('tij'); }
          else { if (state.focus === 'wk' && state.wk === d.u) return; state.wk = d.u; ex.fromChart('wk', 0); }
        } else {
          const i = Math.max(1, Math.min(S, Math.floor((mx - L) / cw) + 1)), j = Math.max(1, Math.min(N, Math.floor((my - G.tR) / (G.rh + G.rg)) + 1));
          if (state.focus === 'tij' && state.cell.i === i && state.cell.j === j) return;
          state.cell = { i, j }; ex.fromChart('tij');
        }
      }).on('pointerleave', ev => { if (ev.pointerType === 'mouse') ex.fromChart(null); });
    drawFocus();
  }

  function morph() {
    if (!G) return;
    const dur = reduce ? 0 : 750, cut = state.mode === 'seasons';
    svg.select('.lyr-focus').html('');
    svg.transition().duration(dur).ease(d3.easeCubicInOut).attr('height', H_()).attr('viewBox', `0 0 ${G.W} ${H_()}`);
    svg.select('.hit').attr('height', H_());
    svg.select('.g-series').transition().duration(dur * 0.5).delay(cut ? 0 : dur * 0.5).style('opacity', cut ? 0 : 1);
    svg.select('.g-rows').transition().duration(dur * 0.5).delay(cut ? dur * 0.5 : 0).style('opacity', cut ? 1 : 0);
    svg.selectAll('.g-bars rect.out').transition().duration(dur * 0.4).delay(cut ? 0 : dur * 0.6).style('opacity', cut ? 0 : 1);
    svg.selectAll('.g-bars rect:not(.out)').transition().duration(dur).delay(d => reduce ? 0 : (cut ? (d.j - 1) : (N - d.j)) * 80)
      .ease(d3.easeCubicInOut)
      .attr('x', d => posBar(d).x).attr('y', d => posBar(d).y).attr('width', d => posBar(d).w).attr('height', d => posBar(d).h)
      .end().then(drawFocus, () => {});
  }

  function drawFocus() {
    if (!G || !svg) return;
    const fl = svg.select('.lyr-focus').html(''), k = state.focus, { i, j } = state.cell, ser = state.mode === 'series';
    svg.classed('focusing', ['tij', 'i', 'j', 'wk'].includes(k));
    svg.selectAll('.dimmable').classed('keep', false);
    svg.selectAll('.rowlab').classed('on', false);
    svg.selectAll('.slab').style('opacity', null).style('font-weight', null);
    svg.select('.nylab').style('opacity', null);
    svg.selectAll('.implab').style('opacity', null);
    if (!k) return;
    const ring = r => fl.append('rect').attr('x', r.x - 1.5).attr('y', r.y - 1.5).attr('width', r.w + 3).attr('height', r.h + 3).attr('rx', 2)
      .attr('fill', 'none').attr('stroke', 'var(--head)').attr('stroke-width', 1.8);
    const cellRect = (jj, ii) => { const s = seasons[jj - 1], u = win[jj - 1].a + ii - 1;
      if (ser) { if (s.raw[ii - 1] == null) return { x: G.uX(u), w: Math.max(G.slot, 2), y: G.tS, h: G.hS }; return G.ser(series[u]); }
      const r = G.row(jj, ii, s.t[ii - 1]); return s.raw[ii - 1] == null ? Object.assign(r, { y: G.base(jj) - Math.max(3, r.h), h: Math.max(3, r.h) }) : r; };
    const label = (r, html) => { const right = r.x > G.W * 0.7, t = fl.append('text').attr('class', 'lab c halo')
      .attr('text-anchor', right ? 'end' : 'start').attr('x', r.x + (right ? -6 : r.w + 6)).attr('y', Math.max(14, Math.min(r.y + 4, (ser ? G.tS + G.hS : G.base(j)) - 4)));
      html(t); };
    if (k === 'tij') {
      svg.selectAll(`.s${j}.w${i}`).classed('keep', true); const r = cellRect(j, i); ring(r);
      svg.selectAll(`.implab.s${j}.w${i}`).style('opacity', 0);
      label(r, t => { t.append('tspan').text('t'); t.append('tspan').attr('baseline-shift', 'sub').attr('font-size', 11).text(`${i},${j}`); t.append('tspan').text(` = ${f1(seasons[j - 1].t[i - 1])}`); });
    }
    if (k === 'wk' && state.wk != null) { const d = series[state.wk];
      svg.selectAll('.u' + d.u).classed('keep', true);
      const r = d.v == null ? { x: G.uX(d.u), w: Math.max(G.slot, 2), y: G.tS, h: G.hS } : G.ser(d); ring(r);
      label(r, t => t.text(d.v == null ? `week ${d.w}: no data` : `week ${d.w}: ${f1(d.v)}`)); }
    if (k === 'i') { svg.selectAll('.w' + i).classed('keep', true); seasons.forEach(s => ring(cellRect(s.j, i)));
      if (!ser) { svg.select('.nylab').style('opacity', 0); fl.append('text').attr('class', 'lab c halo').attr('x', G.L + (i - 0.5) * G.cw).attr('y', 14).attr('text-anchor', 'middle').text(`i = ${i}`); } }
    if (k === 'j') { svg.selectAll('.s' + j).classed('keep', true); svg.select('#f1-row' + j).classed('on', true); svg.select('#f1-slab' + j).style('font-weight', 700); }
    if (k === 'S') {
      const a = ser ? G.uX(win[j - 1].a) : G.L, b = ser ? G.uX(win[j - 1].b + 1) : G.L + S * G.cw, y = ser ? G.tS - 11 : 18;
      if (ser) svg.select('#f1-slab' + j).style('opacity', 0); else svg.select('.nylab').style('opacity', 0);
      fl.append('path').attr('d', `M${a},${y + 5}V${y}H${b}V${y + 5}`).attr('fill', 'none').attr('stroke', 'var(--head)').attr('stroke-width', 1.8);
      fl.append('text').attr('class', 'lab c halo').attr('x', (a + b) / 2).attr('y', y - 5).attr('text-anchor', 'middle').text(`S = ${S} weeks`);
    }
    if (k === 'N') { svg.selectAll('.rowlab').classed('on', true); svg.selectAll('.slab').style('font-weight', 700); }
  }

  MEM.outsideTap(card.root.node(), () => ex.clearChart());
  MEM.watchWidth(panel.node(), draw);
})();
