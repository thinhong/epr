/* Figure 4: step 2 of the paper. "To calculate the threshold, only a set of pre-epidemic values is
   considered. For each season, the highest n values from the pre-epidemic period are taken, where
   n = 30/number of seasons. With all these n x N values, a one-tailed point 95% confidence interval
   is calculated. The upper limit of the confidence interval is the epidemic threshold."
   The season panels sit right above the pool: bars side by side, and their histogram on its side
   on the same rate axis, with the normal curve; t* is one horizontal line across both. */
(function () {
  'use strict';
  const mount = document.querySelector('#viz-mem-threshold');
  if (!mount) return;
  const { C, seasons, weeks, f1, f2, N, sym, niceMax } = MEM;
  const f0 = d3.format(',.0f');
  const pct = v => (v < 1 || v > 99 ? f1(v) : f0(v));
  const NRAW = 30 / N, n = MEM.nOf(N);
  const nTxt = Number.isInteger(NRAW) ? `<b>${n}</b>` : `${NRAW}, rounded to <b>${n}</b>`;
  const Z = C.Z.p95, LAST = 6;
  const ORD = q => q === 1 ? 'highest' : q + (q === 2 ? 'nd' : q === 3 ? 'rd' : 'th') + ' highest';
  const state = { delta: 2.8, focus: null, probe: null, zp: null, stage: LAST, run: 0, playing: false, played: false, showT: false };

  function compute() {
    const m = MEM.model(seasons, state.delta);
    m.cap = niceMax(Math.max(d3.max(m.vals), m.tstar) * 1.15);
    m.up = m.vals.filter(v => v > m.tstar).length;                          // values above t*
    m.in1 = m.vals.filter(v => Math.abs(v - m.tbar) <= m.St).length;        // values within 1 SD
    m.below0 = 100 * MEM.Phi(-m.tbar / m.St);                               // area of the curve below 0
    m.bw = d3.tickStep(0, d3.max(m.vals), 10);                              // bin width of the histogram
    return m;
  }
  let M = compute();
  const zOf = v => (v - M.tbar) / M.St;

  const card = MEM.card(mount, 'Step 2: the epidemic threshold');
  card.root.style('position', 'relative');
  const L_ = String.raw;
  const ex = EXPL.create({
    terms: {
      allj: { aria: 'for every season', desc: () => `For every season ${sym('j')}, only the pre-epidemic values are considered: weeks ${sym('i')} = 1 to ${sym('k')}<sup>*</sup> − 1 from step 1. Each panel zooms in on them; the pale weeks on the right, the epidemic and post-epidemic periods, are not used.` },
      r1: { aria: 't 1 j, the highest pre-epidemic rate', desc: () => `${sym('t', '(1),j')}: the highest pre-epidemic rate of each season. ${M.rows.map(r => `${r.s.tiny}: ${r.top[0] ? f1(r.top[0].v) : 'none'}`).join(', ')}.` },
      r2: { aria: 't 2 j, the second highest', desc: () => `${sym('t', '(2),j')}: the second highest pre-epidemic rate of each season. ${M.rows.map(r => `${r.s.tiny}: ${r.top[1] ? f1(r.top[1].v) : 'none'}`).join(', ')}.` },
      rn: { aria: 't n j, the n-th highest', desc: () => `${sym('t', '(n),j')}: the ${ORD(n)} pre-epidemic rate of each season (${sym('n')} = ${n}). ${M.rows.map(r => `${r.s.tiny}: ${r.top[n - 1] ? f1(r.top[n - 1].v) : 'none'}`).join(', ')}.` },
      n: { aria: 'n, values per season', desc: () => `${sym('n')} = 30 / number of seasons = 30 / ${N} = ${nTxt}: the highest ${n} values of each pre-epidemic period, so ${n} × ${N} = ${M.vals.length} values in all. The paper does not say how to round; the authors' R package rounds with R's <code>round()</code>.` },
      N: { aria: 'N, number of seasons', desc: () => `${sym('N')} = <b>${N}</b> historical seasons, one panel each.` },
      tsel: { aria: 'the selected pre-epidemic rates', desc: () => { const o = state.probe;
        if (!(o && o.sel)) return `${sym('t', '(i),j')}, the ${sym('i')}th highest pre-epidemic rate of season ${sym('j')} (Vega et al., 2013): ${sym('n')} = ${n} from each of the ${sym('N')} = ${N} seasons, ${M.vals.length} values. Each one is a bar, and a block of the histogram.`;
        const q = P && P.blockOf.get(M.sel.find(e => e.j === o.j && e.i === o.i));
        return `${sym('t', `(${o.rank}),${o.j}`)}: the ${ORD(o.rank)} pre-epidemic rate of Season ${o.j}, <b>${f1(o.v)}</b> per 100,000 in week ${weeks[o.i - 1]}. In the histogram it is one block in the bin ${q ? `${q.b * M.bw} to ${(q.b + 1) * M.bw}` : ''}. On the z axis it is at z = (${f1(o.v)} − ${f2(M.tbar)}) / ${f2(M.St)} = <b>${f2(zOf(o.v))}</b>.`; } },
      tbar: { aria: 't bar, the mean', desc: () => `${sym('t&#772;')}, the arithmetic mean of the selected pre-epidemic values (Vega et al., 2013): ${f1(M.sum)} / ${M.vals.length} = <b>${f2(M.tbar)}</b> per 100,000. It is the centre of the normal curve, at z = 0: one horizontal line across the bars and the histogram.` },
      St: { aria: 'S t, the standard deviation', desc: () => `${sym('S', 't')}, the standard deviation of the sample (Vega et al., 2013): √(${f1(M.ss)} / ${M.vals.length - 1}) = <b>${f2(M.St)}</b>, how far the values typically are from ${sym('t&#772;')}. One ${sym('S', 't')} is the step from z = 0 to z = 1. A normal curve has 68% of its area within one ${sym('S', 't')} of the mean (shaded); here ${M.in1} of the ${M.vals.length} values are.` },
      z: { aria: 'z 0.05, the point with 5% of the standard normal curve above it', desc: () => `${sym('z', '0.05')} is the point of the standard normal curve with 5% of the area above it; its value is <b>1.645</b>. In any normal curve, 95% of the area lies below the mean + ${sym('z', '0.05')} SD and 5% lies above it (the red tail). The interval is one-tailed, so all of the 5% is in the upper tail; a two-tailed 95% interval would use ${sym('z', '0.025')} = 1.96. The paper calls ${sym('z', '0.05')} the 5% percentile of a standard normal distribution (Vega et al., 2013); here that means 5% of the area lies above it. So ${sym('t')}<sup>*</sup> lies ${sym('z', '0.05')} × ${sym('S', 't')} = 1.645 × ${f2(M.St)} = ${f2(Z * M.St)} above ${sym('t&#772;')}.` },
      zdef: { aria: 'z, standard deviations from the mean', desc: () => `${sym('z')} = (${sym('t')} − ${sym('t&#772;')}) / ${sym('S', 't')} is not in the paper; it shows how the normal curve with mean ${sym('t&#772;')} and SD ${sym('S', 't')} becomes the standard normal curve (mean 0, SD 1). The rate axis on the left and the z axis on the right read the same levels: ${f2(M.tbar)} is z = 0, ${f2(M.tbar + M.St)} is z = 1, and ${sym('t')}<sup>*</sup> = ${f1(M.tstar)} is at ${sym('z', '0.05')} = 1.645.` },
      zp: { aria: 'a level on the curve', desc: () => { const q = state.zp; if (!q) return ''; const z = zOf(q.v), b = 100 * MEM.Phi(z);
        if (q.v < 0) return `Here the curve is below 0 (z = ${f2(z)}), where no rate can be. Even so, the normal curve puts ${pct(M.below0)}% of its area below 0, because the values are skewed.`;
        const k = M.vals.filter(x => x <= q.v).length;
        return `At <b>${f1(q.v)}</b> per 100,000: z = (${f1(q.v)} − ${f2(M.tbar)}) / ${f2(M.St)} = <b>${f2(z)}</b>. The curve has <b>${pct(b)}%</b> of its area below this level and ${pct(100 - b)}% above it. Of the ${M.vals.length} values, ${k} (${f0(100 * k / M.vals.length)}%) are at or below it.`; } },
      tstar: { aria: 't star, the epidemic threshold', desc: () => `The upper limit of the confidence interval is the epidemic threshold (Vega et al., 2013): ${sym('t')}<sup>*</sup> = ${sym('t&#772;')} + ${sym('z', '0.05')} × ${sym('S', 't')} = ${f2(M.tbar)} + 1.645 × ${f2(M.St)} = <span class="rd">${f1(M.tstar)} per 100,000</span>. The paper calls it a one-tailed <i>point</i> 95% confidence interval; the authors' R package computes it as a confidence interval for a point, that is, for one weekly value, with the standard deviation of the values themselves. 95% of the normal curve's area lies below it. Check with the data: ${M.up} of ${M.vals.length} values (${f1(100 * M.up / M.vals.length)}%) are above it, where the curve expects 5%.` },
      base: { aria: 'the baseline', desc: () => `The baseline is the arithmetic mean of all pre-epidemic rates of all historical seasons, pooled together as a single sample (Vega et al., 2013): the mean of all <b>${M.npre}</b> pre-epidemic weeks, <span class="tl">${f1(M.base)}</span> per 100,000 (dotted line). It is not used for ${sym('t')}<sup>*</sup>.` },
      bar: { aria: 'a week', desc: () => { const o = state.probe; if (!o) return '';
        const row = M.rows[o.j - 1], head = `Season ${o.j}, week ${weeks[o.i - 1]}: <b>${f1(o.v)}</b> per 100,000.`;
        if (o.type === 'pre') return o.sel ? `${head} The ${ORD(o.rank)} of its ${row.npre} pre-epidemic weeks, so it is one of the ${sym('n')} = ${n} values taken: ${sym('t', `(${o.rank}),${o.j}`)}.`
                                           : `${head} A pre-epidemic week, ranked ${o.rank} of ${row.npre}: not among the ${n} highest, so it is not used.`;
        return `${head} ${o.type === 'epi' ? 'An epidemic' : 'A post-epidemic'} week: not used for this threshold.`; } }
    },
    onFocus: k => { state.focus = k; drawFocus(); }
  });

  ex.strip(card.root, [{ tex: L_`\class{t-allj}{\forall j} \rightarrow \left( \class{t-r1}{t_{(1),j}},\ \class{t-r2}{t_{(2),j}},\ \dots,\ \class{t-rn}{t_{(n),j}} \right)` },
                       { tex: L_`\class{t-n}{n} = 30 \,/\, \class{t-N}{N}` }],
    () => `For each season, the highest ${sym('n')} values from the pre-epidemic period are taken (Vega et al., 2013): ${sym('n')} = 30 / ${N} = ${nTxt}, so ${n} × ${N} = <b>${M.vals.length}</b> values (dark teal, with their rates per 100,000).`);
  const ctrl = card.root.append('div').attr('class', 'ctrl');
  const syncD = MEM.stepper(ctrl, 'δ', 'from step 1', () => state.delta, v => { state.delta = +v.toFixed(1); update(); }, [2, 4], 0.1, v => v.toFixed(1) + '%');
  // a toggle that keeps the threshold on every season, to compare it with all the weeks
  const tBtn = ctrl.append('button').attr('class', 'chip').attr('type', 'button').attr('id', 'f4-tline').attr('aria-pressed', false)
    .attr('title', 'Show or hide the epidemic threshold on every season').text('t* on the seasons')
    .on('click', () => { state.showT = !state.showT; tBtn.attr('aria-pressed', state.showT); drawT(); });
  const drawT = () => { if (A) A.levels(state.showT ? [{ v: M.tstar, col: 'var(--red)', lcol: 'var(--redInk)', dash: '5 4', label: `t* ${f1(M.tstar)}` }] : []); };
  const playRow = card.root.append('div').attr('class', 'play-row');
  const playBtn = playRow.append('button').attr('class', 'chip play').attr('type', 'button').attr('id', 'f4-play')
    .on('click', () => { if (state.playing) finish(false); else play(); });
  const narr = playRow.append('span').attr('class', 'narr').attr('aria-live', 'polite');
  const ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10.2 6z" fill="currentColor"/></svg>';
  const ICON_SKIP = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2h3v8H2zM7 2h3v8H7z" fill="currentColor"/></svg>';
  function syncPlay() { playBtn.html(state.playing ? `${ICON_SKIP}<span>Skip to the end</span>` : `${ICON_PLAY}<span>${state.played ? 'Show again' : 'Show how'}</span>`); }
  const say = st => narr.html({
    0: 'Step 1 split every season into a pre-epidemic, an epidemic and a post-epidemic period.',
    1: '<b>1 of 6.</b> Only the <span class="tl">pre-epidemic values</span> are considered: zoom in on the pre-epidemic weeks.',
    2: `<b>2 of 6.</b> For each season, take the highest ${n} values of the pre-epidemic period (n = 30 / ${N} seasons). The numbers are the weekly rates per 100,000.`,
    3: `<b>3 of 6.</b> Put all n × N = ${M.vals.length} values together, side by side.`,
    4: `<b>4 of 6.</b> Sort them into bins ${M.bw} wide: each value moves across at its own height and stacks up. This is their histogram, on its side, so it shares the rate axis with the bars.`,
    5: `<b>5 of 6.</b> Their arithmetic mean t̄ = ${f2(M.tbar)} and standard deviation S<sub>t</sub> = ${f2(M.St)} give a normal curve with the same area as the histogram. The z axis counts standard deviations from the mean.`,
    6: `<b>6 of 6.</b> The upper limit of the one-tailed 95% confidence interval, t̄ + z<sub>0.05</sub> S<sub>t</sub> = <span class="rd">${f1(M.tstar)}</span> per 100,000, with z<sub>0.05</sub> = 1.645, is the epidemic threshold: one horizontal line across the curve and the bars.`,
    done: 'Done. Point at a bar or a block to follow one week, or at the curve to read z.',
    idle: 'Watch the six steps from the seasons to the threshold.'
  }[st] || '');
  card.root.append('div').attr('class', 'legend').html(
    `<span><i class="sw" style="background:var(--tealInk)"></i>the ${n} highest pre-epidemic weeks, with their rates</span>` +
    `<span><i class="sw" style="background:var(--teal);opacity:.45"></i>other pre-epidemic weeks</span>` +
    `<span><i class="sw" style="background:var(--cobalt);opacity:.22"></i><i class="sw" style="background:var(--inactive);opacity:.5"></i>epidemic and post-epidemic weeks, not used</span>` +
    `<span class="mu" id="f4-cap"></span>`);
  // the season panels and the pool sit next to each other, so a week can be followed from one to the other
  const pR = card.root.append('div').attr('class', 'panel');
  const pP = card.root.append('div').attr('class', 'panel');
  const lgP = card.root.append('div').attr('class', 'legend');
  ex.strip(card.root, [
    { tex: L_`\class{t-tbar}{\bar{t}} = \sum_{i=1}^{\class{t-n}{n}} \sum_{j=1}^{\class{t-N}{N}} \class{t-tsel}{t_{(i),j}} \Big/ \left( \class{t-n}{n} \cdot \class{t-N}{N} \right)` },
    { tex: L_`\class{t-St}{S_t^2} = \sum_{i=1}^{n} \sum_{j=1}^{N} \left( \class{t-tsel}{t_{(i),j}} - \class{t-tbar}{\bar{t}} \right)^2 \Big/ \left( n \cdot N - 1 \right)` },
    { tex: L_`\class{t-tstar}{t^{*}} = \class{t-tbar}{\bar{t}} + \class{t-z}{z_{0.05}} \cdot \class{t-St}{S_t}` },
    { tex: L_`\class{t-zdef}{z} = \left( t - \class{t-tbar}{\bar{t}} \right) \Big/ \class{t-St}{S_t}`, muted: true },
    { tex: L_`\class{t-base}{\text{baseline}} = \text{mean pre-epidemic rate}`, muted: true }],
    () => `The upper limit of the one-tailed point 95% confidence interval of the n × N values is the epidemic threshold (Vega et al., 2013): ${sym('t')}<sup>*</sup> = ${sym('t&#772;')} + ${sym('z', '0.05')} × ${sym('S', 't')} = ${f2(M.tbar)} + 1.645 × ${f2(M.St)} = <span class="rd">${f1(M.tstar)}</span> per 100,000. On the histogram, it is the level with 95% of the area of the normal curve (mean ${sym('t&#772;')}, SD ${sym('S', 't')}) below it. Of the grey lines, ${sym('z')} is not in the paper (it helps to read the chart), and the baseline is in the paper but does not enter ${sym('t')}<sup>*</sup>.`);
  const note = card.root.append('div').attr('class', 'note');
  card.root.append('div').attr('class', 'hint').html('Point at a <b>blue symbol</b>, a bar, a block or a level on the curve (tap on a phone). Change <b>&delta;</b>: new epidemic periods give a new sample and a new threshold.');
  function syncNote() {
    const v = M.vals.slice().sort((p, q) => p - q), first = M.vals.filter(x => x < M.bw).length;
    lgP.html(`<span><i class="sw" style="background:var(--tealInk)"></i>each of the ${M.vals.length} values: one bar, and one block of the histogram</span>` +
      `<span><svg class="sw-curve side" viewBox="0 0 12 22" aria-hidden="true"><path d="M11 1C11 7 1.5 8 1.5 11S11 15 11 21" fill="none" stroke="var(--ink2)" stroke-width="1.6"/></svg>the normal curve with their mean, SD and total area, on its side</span>` +
      `<span><i class="sw hatch"></i>rates below 0</span>`);
    note.html(`The histogram is skewed: ${first} of the ${M.vals.length} values are below ${M.bw}, while a few reach ${f1(v[v.length - 1])}. So the normal curve, with the same mean, SD and area, is a rough model of them: ${pct(M.below0)}% of its area falls below 0, where no rate can be. The paper notes that countries may adjust these choices, for example with more or fewer pre-epidemic points, median and bootstrap confidence intervals, or arithmetic or geometric means (Vega et al., 2013).`);
  }

  function update() {
    if (state.playing) finish(false);
    syncD(); M = compute(); syncNote();
    card.status(`t* = ${f1(M.tstar)} per 100,000`);
    card.root.select('#f4-cap').text(`bars cut at ${M.cap} per 100,000`);
    drawRows(); drawPool(); applyStage(state.stage); drawFocus(); ex.refresh();
  }

  let A = null, P = null;
  function drawRows() {
    A = STAGE.cells(pR, { rows: M.rows, period: 'pre', n, ymax: M.cap, sel: 'var(--tealInk)', band: 'var(--tealFaint)',
      style: { pre: ['var(--teal)', .45, .45], epi: ['var(--cobalt)', .6, .18], post: ['var(--inactive)', .9, .4] },
      rankOf: r => r.rankOf, aria: `${N} seasons, zoomed in on the pre-epidemic weeks; in each, the ${n} highest are marked with their rates.`,
      ctx: r => ({ full: [{ a: r.p.k, b: r.p.end, texts: [`epidemic, peak ${f0(r.peak)}`, 'epidemic', 'epi'], col: 'var(--cobalt)' }],
                   zoom: [{ a: r.p.k, b: 33, texts: ['epidemic, not used', 'epidemic', 'epi'] }] }),
      onPoint: d => { if (!d || (state.focus === 'bar' && state.probe === d)) return; state.probe = d; state.zp = null; ex.fromChart('bar', 0); },
      onLeave: () => { state.probe = null; ex.fromChart(null); } });
  }
  function drawPool() {
    const lo = Math.min(0, M.tbar - 3 * M.St), nv = M.vals.length, m = M.tbar, s = M.St;
    P = STAGE.side(pP, { values: M.sel, rows: M.rows, n, f: v => v, base: 0, lo, hi: M.cap, ticks: d3.ticks(0, M.cap, 5), axisName: 'rate',
      bw: M.bw, b0: 0, cnt: v => nv * M.bw * MEM.phi((v - m) / s) / s, zOf: v => (v - m) / s, uOfZ: z => m + z * s,
      regions: [{ z0: -Infinity, z1: Z, fill: 'var(--tealSoft)', cls: 'tail' }, { z0: Z, z1: Infinity, fill: 'var(--red)', op: .3, cls: 'tail' }],
      rlabels: [{ z: 0.45, text: '95% of the area', short: '95%', lcls: 'tl', cls: 'tail' }, { z: 2.15, text: '5%', lcls: 'rd', cls: 'tail' }],
      cuts: [{ z: 0, cls: 'ln-tbar', col: 'var(--tealInk)', tag: f2(M.tbar), name: 'mean t̄', short: 't̄', lcls: 'tl' },
             { z: Z, cls: 'ln-tstar', col: 'var(--red)', dash: '6 4', tag: f1(M.tstar), name: 'threshold t*', short: 't*', lcls: 'rd' }],
      zTicks: [-3, -2, -1, 0, 1, Z, 2, 3], zName: () => 'z_{0.05}', zCol: 'var(--redInk)', neg: true, fill: 'var(--tealInk)', hatchId: 'f4-hatch',
      aria: `The ${nv} pooled values as bars side by side, and as a histogram on its side with the normal curve of the same mean, standard deviation and area. Both share the rate axis, so the threshold t* is one horizontal line, at z 0.05, which is 1.645 standard deviations above the mean, with 5% of the area above it.`,
      busy: () => state.playing,
      onPick: q => { if (state.focus === 'tsel' && state.probe && state.probe.j === q.j && state.probe.i === q.i) return;
        state.zp = null; state.probe = Object.assign({ type: 'pre', sel: true }, q); ex.fromChart('tsel'); },
      onCurve: u => { state.probe = null; state.zp = { v: u }; ex.fromChart('zp', 1); },
      onLeave: () => { state.probe = null; state.zp = null; ex.fromChart(null); } });
  }

  /* "Show how": 0 the full seasons, 1 zoom in on the pre-epidemic weeks, 2 the n highest with their
     values, 3 the values side by side, 4 the histogram on its side, 5 mean, SD and the normal curve
     with the z axis, 6 the threshold */
  function applyStage(st) {
    A.set(st >= 1, st >= 2); drawT();
    const pa = P.svg;
    pa.selectAll('.pbar').style('opacity', st < 3 ? 0 : null);
    pa.selectAll('.hblk, .cax, .hax').style('opacity', st >= 4 ? null : 0);
    pa.selectAll('.ln-tbar, .curve, .neg, .zax:not(.zsp)').style('opacity', st >= 5 ? null : 0);
    pa.selectAll('.ln-tstar, .tail, .zsp').style('opacity', st >= 6 ? null : 0);
    P.syncTicks();
  }
  const restVals = () => state.stage >= 2 && A && !A.dense;
  const wait = ms => new Promise(res => setTimeout(res, ms));
  async function play() {
    const id = ++state.run, alive = () => id === state.run;
    state.probe = null; state.zp = null; ex.reset();
    state.playing = true; state.played = true; syncPlay();
    state.stage = 0; applyStage(0); say(0);
    await wait(1300); if (!alive()) return;
    state.stage = 1; say(1); await A.zoomIn(); if (!alive()) return;
    await wait(500); if (!alive()) return;
    say(2);
    for (let q = 1; q <= n; q++) { A.showRank(q, true); A.labelVals(d => d.rank <= q && !A.dense); await wait(300); if (!alive()) return; }
    state.stage = 2; await wait(1100); if (!alive()) return;
    say(3); await STAGE.fly(card.root, A.svg, P.svg, M.sel); if (!alive()) return;
    state.stage = 3; applyStage(3);
    await wait(1000); if (!alive()) return;
    say(4); await STAGE.slide(P); if (!alive()) return;
    state.stage = 4; applyStage(4);
    await wait(1700); if (!alive()) return;
    state.stage = 5; applyStage(5); say(5);
    await wait(3800); if (!alive()) return;
    state.stage = 6; applyStage(6); say(6);
    await wait(2800); if (!alive()) return;
    finish(true);
  }
  function finish(done) {
    state.run++; state.playing = false; state.stage = LAST;
    card.root.selectAll('.flylayer').remove();
    pP.selectAll('.tokens rect').interrupt(); pP.selectAll('.tokens').remove();
    applyStage(LAST); say(done ? 'done' : 'idle'); syncPlay();
  }

  /* focus: what a symbol or the pointer is about */
  function drawFocus() {
    if (!A || !P) return;
    const key = state.focus, o = state.probe, svgs = card.root.selectAll('.panel svg');
    A.fa.html(''); P.fp.html('');
    svgs.selectAll('.dimmable').classed('keep', false);
    svgs.selectAll('.rowlab').classed('on', false);
    const keep = q => card.root.selectAll(q).classed('keep', true);
    svgs.classed('focusing', !!key && !['N', 'n', 'zp'].includes(key));
    A.svg.selectAll('.ctx').style('visibility', key === 'n' ? 'hidden' : null);
    P.svg.selectAll('.negtxt').style('visibility', key === 'zp' ? 'hidden' : null);
    P.svg.selectAll('.rlab').style('visibility', key === 'zp' || key === 'St' ? 'hidden' : null);
    P.svg.selectAll('.region').style('opacity', key === 'zp' ? .35 : null);
    if (!state.playing) A.labelVals(restVals);
    if (!key) return;
    const fp = P.fp, CO = 'var(--cobalt)', HEAD = 'var(--head)', { a, Y } = P;
    const keepWeek = d => { svgs.selectAll('.bar, .vlab').filter(e => e && e.j === d.j && e.i === d.i).classed('keep', true);
      P.svg.selectAll('.pbar').filter(e => e.j === d.j && e.i === d.i).classed('keep', true);
      P.svg.selectAll('.hblk').filter(e => e.o.j === d.j && e.o.i === d.i).classed('keep', true); };
    // one value: its week in the season, its bar, its block, and its level on both axes
    const showWeek = d => { keepWeek(d); A.ring(A.cell(d.j, d.i));
      const ob = M.sel.find(e => e.j === d.j && e.i === d.i), q = ob && P.blockOf.get(ob); if (!q) return;
      P.ringBar(ob); P.ringBlock(q); P.hl(ob.v, HEAD, '2 3', 1.2); P.tagR(ob.v, f1(ob.v), HEAD); P.tagZ(ob.v, f2(zOf(ob.v)), HEAD);
      A.labelVals(e => (e.j === d.j && e.i === d.i) || restVals()); };
    if ((key === 'bar' || key === 'tsel') && o) { if (o.sel) showWeek(o); else { keepWeek(o); A.ring(A.cell(o.j, o.i)); } }
    if (key === 'tsel' && !o) keep('.sel, .vlab, .pbar, .hblk');
    if (key === 'allj') keep('.svgA .bar.pre, .svgA .vlab');
    const rk = { r1: 1, r2: 2, rn: n }[key];
    if (rk) { keep('.rk' + rk); A.labelVals(d => d.rank === rk || restVals()); }
    if (key === 'n') M.rows.forEach(r => A.fa.append('text').attr('class', 'lab tl halo').attr('x', A.ox(r.s.j) + A.cellW).attr('y', A.oy(r.s.j) + 9).attr('text-anchor', 'end')
      .text(A.small ? `${r.top.length} of ${r.npre}` : `${r.top.length} of ${r.npre} pre-epidemic weeks`));
    if (key === 'N') svgs.selectAll('.rowlab').classed('on', true);
    if (key === 'tbar') { keep('.pbar, .hblk, .ln-tbar'); P.tagZ(M.tbar, '0', 'var(--tealInk)'); }
    if (key === 'St') { keep('.pbar, .hblk, .ln-tbar, .curve');
      const v0 = Math.max(P.lo, M.tbar - M.St), v1 = M.tbar + M.St;
      fp.insert('rect', ':first-child').attr('x', a.x0).attr('y', Y(v1)).attr('width', a.x1 - a.x0).attr('height', Y(Math.max(0, v0)) - Y(v1)).attr('fill', CO).attr('fill-opacity', .07);
      fp.insert('rect', ':first-child').attr('x', P.xH0).attr('y', Y(v1)).attr('width', P.xZ - P.xH0).attr('height', Y(v0) - Y(v1)).attr('fill', CO).attr('fill-opacity', .07);
      fp.append('path').attr('d', P.area(v0, v1)).attr('fill', CO).attr('fill-opacity', .2);
      [v0, v1].forEach(v => P.hl(v, CO, '4 3'));
      P.tagZ(v1, '1'); P.tagZ(v0, '−1');
      fp.append('text').attr('class', 'lab c halo').attr('x', P.xH0 + 2).attr('y', Y(M.tbar + 0.55 * M.St)).text(P.small ? '68%' : '68% of the area');
    }
    if (key === 'z') { keep('.curve, .tail, .ln-tbar, .ln-tstar');
      fp.append('line').attr('x1', P.xZ + .5).attr('x2', P.xZ + .5).attr('y1', Y(M.tbar)).attr('y2', Y(M.tstar)).attr('stroke', 'var(--redInk)').attr('stroke-width', 4).attr('stroke-linecap', 'round').attr('opacity', .55);
      // on a phone the histogram has no room beside the 95% label, so the step goes at the end of the bars
      fp.append('text').attr('class', 'lab rd halo').attr('x', P.small ? a.x1 - 2 : P.xH0 + 2).attr('text-anchor', P.small ? 'end' : 'start')
        .attr('y', (Y(M.tbar) + Y(M.tstar)) / 2 + 4).call(t => MEM.rich(t, P.small ? `z_{0.05} S_{t} = ${f2(Z * M.St)}` : `z_{0.05} × S_{t} = ${f2(Z * M.St)}`));
    }
    if (key === 'zdef') { keep('.curve, .ln-tbar, .ln-tstar');
      [[0, f2(M.tbar), '0'], [1, f2(M.tbar + M.St), '1'], [Z, f1(M.tstar), 'z_{0.05}']].forEach(([z, tv, tz]) => { const v = M.tbar + z * M.St;
        P.hl(v, CO, null, 1.6); P.tagR(v, tv); P.tagZ(v, tz); });
    }
    if (key === 'tstar') { keep('.ln-tstar, .tail, .curve, .pbar, .hblk, .svgA .bar, .svgA .vlab');
      P.blocks.filter(q => q.o.v > M.tstar).forEach(q => { P.ringBar(q.o, 'var(--redInk)'); P.ringBlock(q, 'var(--redInk)'); });
      A.hline(M.tstar, 'var(--red)', `t* = ${f1(M.tstar)}`); }
    if (key === 'base') { keep('.svgA .bar.pre'); P.hl(M.base, 'var(--teal)', '2 4', 2); P.tagR(M.base, f1(M.base), 'var(--tealInk)'); }
    if (key === 'zp' && state.zp) {
      const v = state.zp.v, z = zOf(v), y = Y(v), b = 100 * MEM.Phi(z), lx = P.labelAt(v);
      fp.append('path').attr('d', P.area(P.lo, v)).attr('fill', CO).attr('fill-opacity', .22);
      P.hl(v, CO, null, 1.4);
      fp.append('circle').attr('cx', P.cx(v)).attr('cy', y).attr('r', 3.5).attr('fill', CO);
      fp.append('text').attr('class', 'lab c halo').attr('x', lx).attr('y', y + 16).attr('text-anchor', 'end').text(`${pct(b)}% below`);
      fp.append('text').attr('class', 'lab c halo').attr('x', lx).attr('y', y - 6).attr('text-anchor', 'end').text(`${pct(100 - b)}% above`);
      P.tagR(v, v < 0 ? '< 0' : f1(v)); P.tagZ(v, f2(z));
    }
  }

  MEM.outsideTap(card.root.node(), () => { if ((state.probe || state.zp) && !state.playing) { state.probe = null; state.zp = null; ex.clearChart(); } });
  syncPlay(); say('idle');
  update();
  let lastW = 0;
  MEM.watchWidth(pR.node(), w => { if (w !== lastW) { lastW = w; if (state.playing) finish(false); drawRows(); drawPool(); applyStage(state.stage); drawFocus(); } });
})();
