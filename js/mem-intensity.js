/* Figure 5: step 3 of the paper. "Thresholds for different levels of intensity are calculated using
   the n highest values of each epidemic period to build a sample of n x N rates. With the sample,
   the geometric mean and 50%, 90% and 95% one-sided confidence intervals are calculated. These upper
   limits are the threshold for the different levels of intensity of the epidemic."
   The paper states this in words; the log-scale formulas are how the authors' R package computes it
   (a geometric mean and a point interval, as in step 2 but on the logs). The figure follows step 2:
   season panels, bars side by side, then the histogram on its side with the normal curve of the logs. */
(function () {
  'use strict';
  const mount = document.querySelector('#viz-mem-intensity');
  if (!mount) return;
  const { C, seasons, weeks, f1, f2, N, sym, niceMax } = MEM;
  const f0 = d3.format(',.0f'), f3 = d3.format('.3f'), fg = d3.format('~g');
  const pct = v => (v < 1 || v > 99 ? f1(v) : f0(v)), num = v => String(+v.toFixed(1));
  const NRAW = 30 / N, n = MEM.nOf(N);
  const nTxt = Number.isInteger(NRAW) ? `<b>${n}</b>` : `${NRAW}, rounded to <b>${n}</b>`;
  const ORD = q => q === 1 ? 'highest' : q + (q === 2 ? 'nd' : q === 3 ? 'rd' : 'th') + ' highest';
  const Z90 = C.Z.p90, Z95 = C.Z.p95, LAST = 7;
  const YMAX = niceMax(d3.max(seasons, s => d3.max(s.t)));
  const state = { delta: 2.8, focus: null, probe: null, zp: null, log: true, stage: LAST, run: 0, playing: false, played: false, showI: false };
  let M = MEM.model(seasons, state.delta);
  const zOfV = v => (Math.log(v) - M.lm) / M.ls;                            // z of a rate
  const above = t => M.ev.filter(v => v > t).length;
  const level = v => v <= M.tstar ? `It is below the epidemic threshold ${sym('t')}<sup>*</sup> = ${f1(M.tstar)} from step 2.`
    : `In an epidemic, a week at this rate would be at <b>${v <= M.i50 ? 'low' : v <= M.i90 ? 'medium' : v <= M.i95 ? 'high' : 'very high'}</b> intensity (level names from the authors' R package).`;

  const card = MEM.card(mount, 'Step 3: the intensity thresholds');
  card.root.style('position', 'relative');
  const T = String.raw;
  const ex = EXPL.create({
    terms: {
      allj: { aria: 'for every season', desc: () => `For every season ${sym('j')}, take its epidemic period from step 1: weeks ${sym('i')} = ${sym('k')}<sup>*</sup> to ${sym('k')}<sup>*</sup> + ${sym('r', 'j', '*')} − 1. Each panel zooms in on it; the pale pre- and post-epidemic weeks on either side are not used here.` },
      e1: { aria: 'e 1 j, the highest epidemic rate', desc: () => `${sym('e', '(1),j')}: the highest rate of each epidemic period. ${M.rows.map(r => `${r.s.tiny}: ${r.topEpi[0] ? f1(r.topEpi[0].v) : 'none'}`).join(', ')}.` },
      en: { aria: 'e n j, the n-th highest epidemic rate', desc: () => `${sym('e', '(n),j')}: the ${ORD(n)} rate of each epidemic period (${sym('n')} = ${n}). ${M.rows.map(r => `${r.s.tiny}: ${r.topEpi[n - 1] ? f1(r.topEpi[n - 1].v) : `only ${r.nepi} weeks`}`).join(', ')}.` },
      n: { aria: 'n, values per season', desc: () => `${sym('n')} = 30 / number of seasons = 30 / ${N} = ${nTxt}, the same ${sym('n')} as in step 2. An epidemic shorter than ${n} weeks gives all its weeks. Here: ${M.rows.map(r => `${r.s.tiny} ${r.topEpi.length} of ${r.nepi}`).join(', ')}.` },
      N: { aria: 'N, number of seasons', desc: () => `${sym('N')} = <b>${N}</b> historical seasons.` },
      esel: { aria: 'the selected epidemic rates', desc: () => { const o = state.probe;
        if (!(o && o.sel)) return `${sym('e', '(i),j')}: every selected epidemic rate, ${M.ev.length} in the sample. Each one is a bar, and a block of the histogram.`;
        return `${sym('e', `(${o.rank}),${o.j}`)}: the ${ORD(o.rank)} rate of the Season ${o.j} epidemic, <b>${f1(o.v)}</b> per 100,000 in week ${weeks[o.i - 1]}. Its natural log is ln ${f1(o.v)} = ${f3(Math.log(o.v))}, so z = (${f3(Math.log(o.v))} − ${f3(M.lm)}) / ${f3(M.ls)} = <b>${f2(zOfV(o.v))}</b>.`; } },
      lg: { aria: 'ln g bar, the mean of the logs', desc: () => `${sym('ln g&#772;')} = mean of the ${M.ev.length} natural logs = <b>${f3(M.lm)}</b>. So the geometric mean is ${sym('g&#772;')} = e<sup>${f3(M.lm)}</sup> = <b>${f1(M.gm)}</b> per 100,000. It is the centre of the curve, z = 0, so it is also ${sym('I', '50')}, the 50% limit.` },
      s: { aria: 's, the standard deviation of the logs', desc: () => `${sym('s')} = <b>${f3(M.ls)}</b>, the standard deviation of the logs (sum of squares over ${sym('n')}·${sym('N')} − 1 = ${M.ev.length - 1}). One ${sym('s')} is the step from z = 0 to z = 1; 68% of the area lies within one step of the centre (shaded). On the rate scale one step multiplies the rate by e<sup>${f3(M.ls)}</sup> = ${f2(Math.exp(M.ls))}: from ${f1(M.gm)} up to ${f1(M.gm * Math.exp(M.ls))}, or down to ${f1(M.gm / Math.exp(M.ls))}.` },
      za: { aria: 'z alpha, the point with alpha of the standard normal curve above it', desc: () => `${sym('z', '&alpha;')} is the point of the standard normal curve with &alpha; of the area above it, as ${sym('z', '0.05')} in step 2: ${sym('z', '0.50')} = <b>0</b> for ${sym('I', '50')}, ${sym('z', '0.10')} = <b>1.282</b> for ${sym('I', '90')} and ${sym('z', '0.05')} = <b>1.645</b> for ${sym('I', '95')}. So 50%, 90% and 95% of the area lie below them, and the three lines split the area into 50%, 40%, 5% and 5%.` },
      zdef: { aria: 'z, standard deviations of the logs from their mean', desc: () => `${sym('z')} = (ln ${sym('e')} − ${sym('ln g&#772;')}) / ${sym('s')} is not in the paper; it shows how the normal curve of the logs becomes the standard normal curve. The rate axis on the left and the z axis on the right read the same levels: ${f1(M.gm)} is z = 0, ${f1(M.gm * Math.exp(M.ls))} is z = 1, ${sym('I', '90')} = ${f1(M.i90)} is at ${sym('z', '0.10')} = 1.282 and ${sym('I', '95')} = ${f1(M.i95)} is at ${sym('z', '0.05')} = 1.645.${state.log ? '' : ' On the rate scale the steps of z are not equal, because the curve is normal in the log of the rate.'}` },
      zp: { aria: 'a level on the curve', desc: () => { const q = state.zp; if (!q) return ''; const z = zOfV(q.v), b = 100 * MEM.Phi(z), k = M.ev.filter(x => x <= q.v).length;
        return `At <b>${f1(q.v)}</b> per 100,000: ln ${f1(q.v)} = ${f3(Math.log(q.v))}, so z = (${f3(Math.log(q.v))} − ${f3(M.lm)}) / ${f3(M.ls)} = <b>${f2(z)}</b>. The curve has <b>${pct(b)}%</b> of its area below this level; of the ${M.ev.length} values, ${k} are at or below it. ${level(q.v)}`; } },
      I: { aria: 'I alpha, the intensity thresholds', desc: () => `${sym('I', '50')} = <b>${f1(M.i50)}</b>, ${sym('I', '90')} = <b>${f1(M.i90)}</b>, ${sym('I', '95')} = <b>${f1(M.i95)}</b> per 100,000: the upper limits of the 50%, 90% and 95% one-sided confidence intervals, the thresholds for the different levels of intensity (Vega et al., 2013). The authors' R package calls them the medium, high and very high thresholds. Check with the data: ${above(M.i50)}, ${above(M.i90)} and ${above(M.i95)} of the ${M.ev.length} values are above them, where the curve expects ${num(0.5 * M.ev.length)}, ${num(0.1 * M.ev.length)} and ${num(0.05 * M.ev.length)}.` },
      bar: { aria: 'a week', desc: () => { const o = state.probe; if (!o) return '';
        const row = M.rows[o.j - 1], head = `Season ${o.j}, week ${weeks[o.i - 1]}: <b>${f1(o.v)}</b> per 100,000.`;
        if (o.type === 'epi') return o.sel ? `${head} The ${ORD(o.rank)} of its ${row.nepi} epidemic weeks, so it is one of the ${sym('n')} = ${n} values taken: ${sym('e', `(${o.rank}),${o.j}`)}.`
                                           : `${head} An epidemic week, ranked ${o.rank} of ${row.nepi}: not among the ${n} highest, so it is not used.`;
        return `${head} A ${o.type === 'pre' ? 'pre' : 'post'}-epidemic week: not used for the intensity thresholds.`; } }
    },
    onFocus: k => { state.focus = k; drawFocus(); }
  });
  ex.strip(card.root, [{ tex: T`\class{t-allj}{\forall j} \rightarrow \left( \class{t-e1}{e_{(1),j}},\ \dots,\ \class{t-en}{e_{(n),j}} \right)` },
                       { tex: T`\class{t-n}{n} = 30 \,/\, \class{t-N}{N}` }],
    () => `Thresholds for different levels of intensity are calculated using the n highest values of each epidemic period (Vega et al., 2013): the same ${sym('n')} = ${n} as in step 2, a sample of ${n} × ${N} = <b>${M.ev.length}</b> rates (dark blue, with their rates per 100,000).`);
  const ctrl = card.root.append('div').attr('class', 'ctrl');
  const syncD = MEM.stepper(ctrl, 'δ', 'from step 1', () => state.delta, v => { state.delta = +v.toFixed(1); update(); }, [2, 4], 0.1, v => v.toFixed(1) + '%');
  // a toggle that keeps the three intensity thresholds on every season
  const iBtn = ctrl.append('button').attr('class', 'chip').attr('type', 'button').attr('id', 'f5-ilines').attr('aria-pressed', false)
    .attr('title', 'Show or hide the intensity thresholds on every season').text('I50, I90, I95 on the seasons')
    .on('click', () => { state.showI = !state.showI; iBtn.attr('aria-pressed', state.showI); drawI(); });
  const drawI = () => { if (A) A.levels(state.showI ? [
    { v: M.i50, col: 'var(--amber)', lcol: 'var(--amberInk)', dash: '2 3', label: `I50 ${f0(M.i50)}` },
    { v: M.i90, col: 'var(--amber)', lcol: 'var(--amberInk)', dash: '6 4', label: `I90 ${f0(M.i90)}` },
    { v: M.i95, col: 'var(--amberInk)', label: `I95 ${f0(M.i95)}` }] : []); };
  const sc = ctrl.append('div').attr('class', 'chips').attr('role', 'group').attr('aria-label', 'Axis of the sample');
  sc.append('span').attr('class', 'lab').text('axis');
  const SCALES = [['log scale', true], ['rate scale', false]];
  const scBtn = SCALES.map(([t, v]) => sc.append('button').attr('class', 'chip').attr('type', 'button').text(t)
    .on('click', () => { if (state.log === v) return; if (state.playing) finish(false); state.log = v; syncScale(); drawPool(); applyStage(state.stage); drawFocus(); ex.refresh(); }));
  function syncScale() { scBtn.forEach((b, q) => b.attr('aria-pressed', SCALES[q][1] === state.log)); }
  syncScale();
  const playRow = card.root.append('div').attr('class', 'play-row');
  const playBtn = playRow.append('button').attr('class', 'chip play').attr('type', 'button').attr('id', 'f5-play')
    .on('click', () => { if (state.playing) finish(false); else play(); });
  const narr = playRow.append('span').attr('class', 'narr').attr('aria-live', 'polite');
  const ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10.2 6z" fill="currentColor"/></svg>';
  const ICON_SKIP = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2h3v8H2zM7 2h3v8H7z" fill="currentColor"/></svg>';
  function syncPlay() { playBtn.html(state.playing ? `${ICON_SKIP}<span>Skip to the end</span>` : `${ICON_PLAY}<span>${state.played ? 'Show again' : 'Show how'}</span>`); }
  const say = st => narr.html({
    0: 'Step 1 split every season into a pre-epidemic, an epidemic and a post-epidemic period.',
    1: '<b>1 of 7.</b> The intensity thresholds use the <span class="c">epidemic periods</span>: zoom in on the epidemic weeks.',
    2: `<b>2 of 7.</b> For each season, take the highest ${n} values of the epidemic period (the same n as in step 2). The numbers are the weekly rates per 100,000.`,
    3: `<b>3 of 7.</b> Put the n × N = ${M.ev.length} rates together, side by side.`,
    4: '<b>4 of 7.</b> A geometric mean is the mean of the logs: take the natural log of each rate. On a log axis, low rates spread out and high rates come closer.',
    5: `<b>5 of 7.</b> Sort the logs into bins ${fg(P ? P.o.bw : 0.2)} wide: each value moves across at its own height and stacks up. The histogram on its side shares the axis with the bars.`,
    6: `<b>6 of 7.</b> The mean of the logs, ln ḡ = ${f3(M.lm)} (so the geometric mean ḡ = ${f1(M.gm)}), and their SD, s = ${f3(M.ls)}, give a normal curve of the logs with the same area as the histogram.`,
    7: `<b>7 of 7.</b> The upper limits of the 50%, 90% and 95% one-sided confidence intervals, at z<sub>0.50</sub> = 0, z<sub>0.10</sub> = 1.282 and z<sub>0.05</sub> = 1.645, are the intensity thresholds: <span class="am">I50 = ${f1(M.i50)}</span>, <span class="am">I90 = ${f1(M.i90)}</span>, <span class="am">I95 = ${f1(M.i95)}</span> per 100,000.`,
    done: 'Done. Point at a bar or a block to follow one week, or at the curve to read z and the level.',
    idle: 'Watch the seven steps from the seasons to the intensity thresholds.'
  }[st] || '');
  card.root.append('div').attr('class', 'legend').html(
    `<span><i class="sw" style="background:var(--cobalt2)"></i>the ${n} highest epidemic weeks, with their rates</span>` +
    `<span><i class="sw" style="background:var(--cobalt);opacity:.3"></i>other epidemic weeks</span>` +
    `<span><i class="sw" style="background:var(--teal);opacity:.3"></i><i class="sw" style="background:var(--inactive);opacity:.5"></i>pre- and post-epidemic weeks, not used</span>`);
  const pR = card.root.append('div').attr('class', 'panel');
  const pP = card.root.append('div').attr('class', 'panel');
  const lgP = card.root.append('div').attr('class', 'legend');
  ex.strip(card.root, [
    { tex: T`\class{t-lg}{\ln \bar{g}} = \sum_{i,j} \ln \class{t-esel}{e_{(i),j}} \Big/ \left( \class{t-n}{n} \class{t-N}{N} \right)` },
    { tex: T`\class{t-s}{s^2} = \sum_{i,j} \left( \ln \class{t-esel}{e_{(i),j}} - \class{t-lg}{\ln \bar{g}} \right)^2 \Big/ \left( n N - 1 \right)` },
    { tex: T`\class{t-I}{I_{50},\ I_{90},\ I_{95}} = \exp\left( \class{t-lg}{\ln \bar{g}} + \class{t-za}{z_{\alpha}} \cdot \class{t-s}{s} \right)` },
    { tex: T`\class{t-za}{z_{\alpha}}:\ \alpha = 0.50,\ 0.10,\ 0.05` },
    { tex: T`\class{t-zdef}{z} = \left( \ln e - \class{t-lg}{\ln \bar{g}} \right) \Big/ \class{t-s}{s}`, muted: true },
    { tex: T`\text{sums over } i = 1, \dots, n \text{ and } j = 1, \dots, N`, muted: true }],
    () => `With the sample, the geometric mean and 50%, 90% and 95% one-sided confidence intervals are calculated, and these upper limits are the thresholds for the levels of intensity (Vega et al., 2013): ${sym('I', '50')} = <span class="am">${f1(M.i50)}</span>, ${sym('I', '90')} = <span class="am">${f1(M.i90)}</span>, ${sym('I', '95')} = <span class="am">${f1(M.i95)}</span> per 100,000. The paper states this step in words; the formulas are how the authors' R package computes it, as a point interval on the logs. The ${sym('z')} line is not in the paper; it helps to read the chart.`);
  const note = card.root.append('div').attr('class', 'note');
  card.root.append('div').attr('class', 'hint').html('Point at a <b>blue symbol</b>, a bar, a block or a level on the curve (tap on a phone). Switch the axis between <b>log</b> and <b>rate</b> scale: the values and the curve are the same, only the spacing changes.');

  function update() {
    if (state.playing) finish(false);
    syncD(); M = MEM.model(seasons, state.delta);
    card.status(`I50 ${f0(M.i50)}, I90 ${f0(M.i90)}, I95 ${f0(M.i95)}`);
    lgP.html(`<span><i class="sw" style="background:var(--cobalt2)"></i>each of the ${M.ev.length} values: one bar, and one block of the histogram</span>` +
      `<span><svg class="sw-curve side" viewBox="0 0 12 22" aria-hidden="true"><path d="M11 1C11 7 1.5 8 1.5 11S11 15 11 21" fill="none" stroke="var(--ink2)" stroke-width="1.6"/></svg>the normal curve of their logs, with the same area, on its side</span>`);
    note.html(`On the log scale the histogram is close to the bell of the normal curve; on the rate scale the same values and the same curve are skewed, with a long upper tail. The paper says countries may change the 50%, 90% and 95% levels (Vega et al., 2013); the authors' R package uses 40%, 90% and 97.5% by default.`);
    drawRows(); drawPool(); applyStage(state.stage); drawFocus(); ex.refresh();
  }

  let A = null, P = null;
  function drawRows() {
    A = STAGE.cells(pR, { rows: M.rows, period: 'epi', n, ymax: YMAX, sel: 'var(--cobalt2)', band: 'var(--cobaltFaint)', fmt: f0,
      style: { pre: ['var(--teal)', .45, .3], epi: ['var(--cobalt)', .6, .3], post: ['var(--inactive)', .9, .4] },
      rankOf: r => r.rankEpi, aria: `${N} seasons, zoomed in on the epidemic weeks; in each, the ${n} highest are marked with their rates.`,
      ctx: r => ({ full: [{ a: r.p.k, b: r.p.end, texts: [`epidemic, peak ${f0(r.peak)}`, 'epidemic', 'epi'], col: 'var(--cobalt)' }],
                   zoom: [{ a: 1, b: r.p.k - 1, texts: ['pre-epidemic', 'pre'] }, { a: r.p.end + 1, b: 33, texts: ['post-epidemic', 'post'] }] }),
      onPoint: d => { if (!d || (state.focus === 'bar' && state.probe === d)) return; state.probe = d; state.zp = null; ex.fromChart('bar', 0); },
      onLeave: () => { state.probe = null; ex.fromChart(null); } });
  }
  function drawPool() {
    const nv = M.ev.length, m = M.lm, s = M.ls, log = state.log;
    const lg = M.ev.map(Math.log), lbw = d3.tickStep(d3.min(lg), d3.max(lg), 10), rbw = d3.tickStep(0, d3.max(M.ev), 10);
    const common = { values: M.selEpi, rows: M.rows, n, zTicks: [-3, -2, -1, 0, 1, Z90, Z95, 2, 3], zName: z => (z === Z95 ? 'z_{0.05}' : 'z_{0.10}'), zCol: 'var(--amberInk)', neg: false, fill: 'var(--cobalt2)', hatchId: 'f5-hatch',
      regions: [{ z0: -Infinity, z1: 0, fill: 'var(--cobalt)', op: .1 }, { z0: 0, z1: Z90, fill: 'var(--amber)', op: .22 },
                { z0: Z90, z1: Z95, fill: 'var(--amber)', op: .45 }, { z0: Z95, z1: Infinity, fill: 'var(--amberInk)', op: .45 }],
      rlabels: [{ z: -0.9, text: '50%', lcls: 'c' }, { z: 0.64, text: '40%', lcls: 'am' }, { z: (Z90 + Z95) / 2, text: '5%', lcls: 'am' }, { z: 2.15, text: '5%', lcls: 'am' }],
      cuts: [{ z: 0, cls: 'ln-i50', col: 'var(--amber)', dash: '2 3', tag: f0(M.i50), name: 'I50, medium', short: 'I50', lcls: 'am' },
             { z: Z90, cls: 'ln-i90', col: 'var(--amber)', dash: '6 4', tag: f0(M.i90), name: 'I90, high', short: 'I90', lcls: 'am' },
             { z: Z95, cls: 'ln-i95', col: 'var(--amberInk)', tag: f0(M.i95), name: 'I95, very high', short: 'I95', lcls: 'am' }],
      aria: `The ${nv} pooled epidemic values as bars side by side, and as a histogram on its side with the normal curve of their logs, on a ${log ? 'log' : 'rate'} axis. The intensity thresholds I50, I90 and I95 are horizontal lines at z 0.50, z 0.10 and z 0.05, which are 0, 1.282 and 1.645 standard deviations of the logs above their mean.`,
      busy: () => state.playing,
      onPick: q => { if (state.focus === 'esel' && state.probe && state.probe.j === q.j && state.probe.i === q.i) return;
        state.zp = null; state.probe = Object.assign({ type: 'epi', sel: true }, q); ex.fromChart('esel'); },
      onCurve: u => { const v = log ? Math.exp(u) : u; if (v <= 0) return; state.probe = null; state.zp = { v }; ex.fromChart('zp', 1); },
      onLeave: () => { state.probe = null; state.zp = null; ex.fromChart(null); } };
    if (log) { const lo = m - 3 * s, hi = m + 3 * s;
      P = STAGE.side(pP, Object.assign(common, { f: Math.log, base: lo, lo, hi, ticks: [5, 10, 20, 50, 100, 200, 500, 1000].filter(v => Math.log(v) >= lo && Math.log(v) <= hi),
        axisName: 'rate, log scale', bw: lbw, b0: Math.floor(d3.min(lg) / lbw) * lbw, lin: { hi: YMAX },
        cnt: u => nv * lbw * MEM.phi((u - m) / s) / s, zOf: u => (u - m) / s, uOfZ: z => m + z * s })); }
    else { const hi = niceMax(Math.max(d3.max(M.ev) * 1.05, Math.exp(m + 2.6 * s)));
      P = STAGE.side(pP, Object.assign(common, { f: v => v, base: 0, lo: 0, hi, ticks: d3.ticks(0, hi, 4), axisName: 'rate', bw: rbw, b0: 0,
        cnt: v => (v > 0 ? nv * rbw * MEM.phi((Math.log(v) - m) / s) / (s * v) : 0), zOf: v => (Math.log(v) - m) / s, uOfZ: z => Math.exp(m + z * s) })); }
    P.uOf = v => (log ? Math.log(v) : v);
  }

  /* "Show how": 0 the full seasons, 1 zoom in on the epidemic weeks, 2 the n highest with their values,
     3 side by side on a rate axis, 4 the log axis, 5 the histogram of the logs on its side,
     6 the normal curve of the logs with the z axis, 7 the three intensity thresholds */
  function applyStage(st) {
    A.set(st >= 1, st >= 2); drawI();
    const pa = P.svg, lin = state.log && st === 3;
    pa.selectAll('.pbar').style('opacity', st < 3 ? 0 : null).attr('y', q => P.barY(q, lin)).attr('height', q => Math.max(0.8, P.y0 - P.barY(q, lin)));
    pa.select('.pax-lin').style('opacity', lin ? null : 0);
    pa.select('.pax').style('opacity', lin ? 0 : null);
    pa.selectAll('.hblk, .cax, .hax').style('opacity', st >= 5 ? null : 0);
    pa.selectAll('.curve, .zax:not(.zsp)').style('opacity', st >= 6 ? null : 0);
    pa.selectAll('.region, .rlab, .ln-i50, .ln-i90, .ln-i95, .zsp').style('opacity', st >= 7 ? null : 0);
    P.syncTicks();
  }
  const restVals = () => state.stage >= 2 && A && !A.dense;
  const wait = ms => new Promise(res => setTimeout(res, ms));
  async function play() {
    const id = ++state.run, alive = () => id === state.run;
    state.probe = null; state.zp = null; ex.reset();
    if (!state.log) { state.log = true; syncScale(); drawPool(); }
    state.playing = true; state.played = true; syncPlay();
    state.stage = 0; applyStage(0); say(0);
    await wait(1300); if (!alive()) return;
    state.stage = 1; say(1); await A.zoomIn(); if (!alive()) return;
    await wait(500); if (!alive()) return;
    say(2);
    for (let q = 1; q <= n; q++) { A.showRank(q, true); A.labelVals(d => d.rank <= q && !A.dense); await wait(300); if (!alive()) return; }
    state.stage = 2; await wait(1100); if (!alive()) return;
    state.stage = 3; applyStage(3); P.svg.selectAll('.pbar').style('opacity', 0);
    say(3); await STAGE.fly(card.root, A.svg, P.svg, M.selEpi); if (!alive()) return;
    applyStage(3);
    await wait(1200); if (!alive()) return;
    say(4); state.stage = 4; await STAGE.toLog(P, 1300); if (!alive()) return;
    applyStage(4);
    await wait(900); if (!alive()) return;
    say(5); await STAGE.slide(P); if (!alive()) return;
    state.stage = 5; applyStage(5);
    await wait(1700); if (!alive()) return;
    state.stage = 6; applyStage(6); say(6);
    await wait(3800); if (!alive()) return;
    state.stage = 7; applyStage(7); say(7);
    await wait(3000); if (!alive()) return;
    finish(true);
  }
  function finish(done) {
    state.run++; state.playing = false; state.stage = LAST;
    card.root.selectAll('.flylayer').remove();
    pP.selectAll('.tokens rect').interrupt(); pP.selectAll('.tokens').remove(); pP.selectAll('.pbar, .pax, .pax-lin').interrupt();
    applyStage(LAST); say(done ? 'done' : 'idle'); syncPlay();
  }

  function drawFocus() {
    if (!A || !P) return;
    const key = state.focus, o = state.probe, svgs = card.root.selectAll('.panel svg');
    A.fa.html(''); P.fp.html('');
    svgs.selectAll('.dimmable').classed('keep', false);
    svgs.selectAll('.rowlab').classed('on', false);
    const keep = q => card.root.selectAll(q).classed('keep', true);
    svgs.classed('focusing', !!key && !['N', 'n', 'zp'].includes(key));
    A.svg.selectAll('.ctx').style('visibility', key === 'n' ? 'hidden' : null);
    P.svg.selectAll('.rlab').style('visibility', key === 'zp' || key === 's' ? 'hidden' : null);
    P.svg.selectAll('.region').style('opacity', key === 'zp' ? .35 : state.stage >= 7 ? null : 0);
    if (!state.playing) A.labelVals(restVals);
    if (!key) return;
    const fp = P.fp, CO = 'var(--cobalt)', HEAD = 'var(--head)', { a, Y } = P, U = P.uOf, uz = z => P.o.uOfZ(z);
    const keepWeek = d => { svgs.selectAll('.bar, .vlab').filter(e => e && e.j === d.j && e.i === d.i).classed('keep', true);
      P.svg.selectAll('.pbar').filter(e => e.j === d.j && e.i === d.i).classed('keep', true);
      P.svg.selectAll('.hblk').filter(e => e.o.j === d.j && e.o.i === d.i).classed('keep', true); };
    const showWeek = d => { keepWeek(d); A.ring(A.cell(d.j, d.i));
      const ob = M.selEpi.find(e => e.j === d.j && e.i === d.i), q = ob && P.blockOf.get(ob); if (!q) return;
      P.ringBar(ob); P.ringBlock(q); P.hl(U(ob.v), HEAD, '2 3', 1.2); P.tagR(U(ob.v), f0(ob.v), HEAD); P.tagZ(U(ob.v), f2(zOfV(ob.v)), HEAD);
      A.labelVals(e => (e.j === d.j && e.i === d.i) || restVals()); };
    if ((key === 'bar' || key === 'esel') && o) { if (o.sel) showWeek(o); else { keepWeek(o); A.ring(A.cell(o.j, o.i)); } }
    if (key === 'esel' && !o) keep('.sel, .vlab, .pbar, .hblk');
    if (key === 'allj') keep('.svgA .bar.epi, .svgA .vlab');
    const rk = { e1: 1, en: n }[key];
    if (rk) { keep('.rk' + rk); A.labelVals(d => d.rank === rk || restVals()); }
    if (key === 'n') M.rows.forEach(r => A.fa.append('text').attr('class', 'lab c halo').attr('x', A.ox(r.s.j) + A.cellW).attr('y', A.oy(r.s.j) + 9).attr('text-anchor', 'end')
      .text(A.small ? `${r.topEpi.length} of ${r.nepi}` : `${r.topEpi.length} of ${r.nepi} epidemic weeks`));
    if (key === 'N') svgs.selectAll('.rowlab').classed('on', true);
    if (key === 'lg') { keep('.pbar, .hblk, .ln-i50'); P.tagZ(uz(0), '0', 'var(--amberInk)'); }
    if (key === 's') { keep('.pbar, .hblk, .ln-i50, .curve');
      const v0 = uz(-1), v1 = uz(1);
      fp.insert('rect', ':first-child').attr('x', a.x0).attr('y', Y(v1)).attr('width', P.xZ - a.x0).attr('height', Y(v0) - Y(v1)).attr('fill', CO).attr('fill-opacity', .07);
      fp.append('path').attr('d', P.area(v0, v1)).attr('fill', CO).attr('fill-opacity', .2);
      [v0, v1].forEach(v => P.hl(v, CO, '4 3'));
      P.tagZ(v1, '1'); P.tagZ(v0, '−1'); P.tagR(v1, f0(M.gm * Math.exp(M.ls))); P.tagR(v0, f0(M.gm / Math.exp(M.ls)));
      fp.append('text').attr('class', 'lab c halo').attr('x', P.xH0 + 2).attr('y', (Y(uz(0)) + Y(v1)) / 2 + 4).text(P.small ? '68%' : '68% of the area');
    }
    if (key === 'za') keep('.region, .rlab, .curve, .ln-i50, .ln-i90, .ln-i95');
    if (key === 'zdef') { keep('.curve, .ln-i50, .ln-i90, .ln-i95');
      [[0, '0'], [1, '1'], [Z90, 'z_{0.10}'], [Z95, 'z_{0.05}']].forEach(([z, tz]) => { const v = uz(z); P.hl(v, CO, null, 1.6); P.tagZ(v, tz); });
    }
    if (key === 'I') { keep('.ln-i50, .ln-i90, .ln-i95, .pbar, .hblk, .region, .rlab, .curve, .svgA .bar.epi, .svgA .vlab');
      P.blocks.filter(q => q.o.v > M.i90).forEach(q => { P.ringBar(q.o, 'var(--amberInk)'); P.ringBlock(q, 'var(--amberInk)'); });
      [[M.i50, 'I50'], [M.i90, 'I90'], [M.i95, 'I95']].forEach(([v, l]) => A.hline(v, 'var(--amberInk)', A.small ? null : l)); }
    if (key === 'zp' && state.zp) {
      const v = state.zp.v, uu = U(v), z = zOfV(v), y = Y(uu), b = 100 * MEM.Phi(z), lx = P.labelAt(uu);
      fp.append('path').attr('d', P.area(P.lo, uu)).attr('fill', CO).attr('fill-opacity', .22);
      P.hl(uu, CO, null, 1.4);
      fp.append('circle').attr('cx', P.cx(uu)).attr('cy', y).attr('r', 3.5).attr('fill', CO);
      fp.append('text').attr('class', 'lab c halo').attr('x', lx).attr('y', y + 16).attr('text-anchor', 'end').text(`${pct(b)}% below`);
      fp.append('text').attr('class', 'lab c halo').attr('x', lx).attr('y', y - 6).attr('text-anchor', 'end').text(`${pct(100 - b)}% above`);
      P.tagR(uu, f0(v)); P.tagZ(uu, f2(z));
    }
  }

  MEM.outsideTap(card.root.node(), () => { if ((state.probe || state.zp) && !state.playing) { state.probe = null; state.zp = null; ex.clearChart(); } });
  syncPlay(); say('idle');
  update();
  let lastW = 0;
  MEM.watchWidth(pR.node(), w => { if (w !== lastW) { lastW = w; if (state.playing) finish(false); drawRows(); drawPool(); applyStage(state.stage); drawFocus(); } });
})();
