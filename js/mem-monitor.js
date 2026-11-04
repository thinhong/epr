/* Figure 6: watching a season with the thresholds. The paper defines the alert week as the first week
   with a rate above the pre-epidemic threshold. Intensity is read against the 50%, 90% and 95% limits
   of step 3, whose curve stands on its side at the right, on the same rate axis. The end is the first
   week after the alert and after the peak so far that falls below the post-epidemic threshold
   (authors' R package, memsurveillance). The figure opens on the current season. After its last week
   of data the weeks are illustrative, not data: each is the average of the past seasons in that week,
   drawn as an outlined bar. A past season is replayed with thresholds from the other seasons, as in
   the paper's cross-validation, and scored with the paper's definitions. */
(function () {
  'use strict';
  const mount = document.querySelector('#viz-mem-monitor');
  if (!mount) return;
  const { seasons, weeks, f1, S, N, sym, niceMax, reduce } = MEM;
  const f0 = d3.format(',.0f'), DELTA = 2.8, CITE = '(Vega et al., 2013)';
  // the season now running: week 40 of the year after the last complete season onwards
  const y0 = seasons[N - 1].year0 + 1, ser = new Map(MEMDATA.series.map(([y, w, v]) => [`${y}-${w}`, v]));
  const data = weeks.map(w => { const v = ser.get(`${w >= 40 ? y0 : y0 + 1}-${w}`); return v == null ? null : v; });
  const last = data.reduce((a, v, q) => (v != null ? q + 1 : a), 0);
  // illustrative weeks: the average of the past seasons in the same week, to one decimal like the data
  const avg = weeks.map((w, q) => Math.round(d3.mean(seasons, s => s.t[q]) * 10) / 10);
  const cur = { j: 0, name: `${y0}/${String(y0 + 1).slice(2)}`, year0: y0, last, t: data.map((v, q) => (q < last ? v : avg[q])) };
  const full = MEM.model(seasons, DELTA);
  const LEVELS = [['below the epidemic threshold', 'var(--teal)', .6], ['low', 'var(--cobalt)', .85],
                  ['medium', 'var(--amber)', .55], ['high', 'var(--amber)', .95], ['very high', 'var(--amberInk)', 1], ['after the epidemic', 'var(--teal)', .32]];
  const state = { target: 0, week: last, focus: null, probe: null, playing: false, run: 0 };
  let W_ = null;                                   // the season being watched, its model and the signals so far
  function setup() {
    const past = state.target > 0, s = past ? seasons[state.target - 1] : cur;
    const m = past ? MEM.model(seasons.filter(o => o !== s), DELTA) : full;
    W_ = { past, s, m, upto: S, last: past ? S : cur.last, t: s.t, mem: past ? MEM.periods(s, DELTA) : null };
    state.week = Math.max(1, Math.min(state.week, S));
  }
  const ill = i => !W_.past && i > W_.last;        // an illustrative week, not data
  const yr = i => W_.s.year0 + (i >= 14 ? 1 : 0);
  const wk = i => `week ${weeks[i - 1]} of ${yr(i)}`, Wk = i => `Week ${weeks[i - 1]} of ${yr(i)}`;
  const tag = i => (ill(i) ? ', an illustrative week' : '');
  function status(i) {                              // level of week i given the signals up to week i
    const w = MEM.watch(W_.t, W_.m, i), v = W_.t[i - 1];
    if (!w.alert || i < w.alert) return 0;
    if (w.end && i >= w.end) return 5;
    return v > W_.m.i95 ? 4 : v > W_.m.i90 ? 3 : v > W_.m.i50 ? 2 : 1;
  }

  const card = MEM.card(mount, 'Step 4: watching a new season');
  const T = String.raw;
  const sig = () => MEM.watch(W_.t, W_.m, state.week);
  const ex = EXPL.create({
    terms: {
      ti: { aria: 't i, the rate this week', desc: () => { const i = state.probe || state.week, v = W_.t[i - 1];
        return v == null ? `${Wk(i)}: no data.` : `${sym('t', 'i')} = <b>${f1(v)}</b> per 100,000 in ${wk(i)}${tag(i)}: <b>${LEVELS[status(i)][0]}</b>.`; } },
      tstar: { aria: 't star, the epidemic threshold', desc: () => `${sym('t')}<sup>*</sup> = <span class="rd">${f1(W_.m.tstar)}</span> per 100,000, the pre-epidemic (epidemic) threshold from step 2, calculated on ${W_.past ? `the remaining seasons, excluding Season ${state.target}` : `all ${N} past seasons`}. It is the rate above which the start of the seasonal epidemic is defined ${CITE}.` },
      alert: { aria: 'the alert week', desc: () => { const w = sig();
        return w.alert ? `The alert week is the first week with a rate above the pre-epidemic threshold ${CITE}: <b>${wk(w.alert)}</b>${tag(w.alert)} (${f1(W_.t[w.alert - 1])} > ${f1(W_.m.tstar)}). MEM does not use virological data; when timely virological data are available, virus circulation should be taken into account ${CITE}.`
                       : `No week so far is above ${sym('t')}<sup>*</sup> = ${f1(W_.m.tstar)}, so there is no alert yet.`; } },
      lev: { aria: 'the intensity level', desc: () => `During the epidemic, each week is compared with the three thresholds for levels of intensity from step 3: below ${sym('I', '50')} = ${f1(W_.m.i50)} is low, above it is medium, above ${sym('I', '90')} = ${f1(W_.m.i90)} is high, and above ${sym('I', '95')} = ${f1(W_.m.i95)} is very high (names from the authors' R package). The curve at the right is step 3's curve of past epidemic weeks, on its side, cut at these thresholds.` },
      i50: { aria: 'I 50', desc: () => `${sym('I', '50')} = <span class="am">${f1(W_.m.i50)}</span>: above it, the epidemic is of medium intensity.` },
      i90: { aria: 'I 90', desc: () => `${sym('I', '90')} = <span class="am">${f1(W_.m.i90)}</span>: above it, high intensity.` },
      i95: { aria: 'I 95', desc: () => `${sym('I', '95')} = <span class="am">${f1(W_.m.i95)}</span>: above it, very high intensity.` },
      peak: { aria: 'the peak so far', desc: () => { const w = sig(); return `The peak so far is ${wk(w.peak)}${tag(w.peak)}: <b>${f1(W_.t[w.peak - 1])}</b>. The end can only come after it.`; } },
      end: { aria: 'the end week', desc: () => { const w = sig();
        return w.end ? `Once there is an alert, the end is the first week after the peak with a rate below ${sym('t')}<sup>*</sup><sub>post</sub>: <b>${wk(w.end)}</b>${tag(w.end)} (${f1(W_.t[w.end - 1])} &lt; ${f1(W_.m.post)}). This rule is from the authors' R package; the paper says only that rates in the post-epidemic period are expected to be lower than the post-epidemic threshold ${CITE}.`
                     : `No end yet: no week after the ${w.alert ? 'peak' : 'alert'} is below ${sym('t')}<sup>*</sup><sub>post</sub> = ${f1(W_.m.post)}.`; } },
      tpost: { aria: 't star post, the post-epidemic threshold', desc: () => `${sym('t')}<sup>*</sup><sub>post</sub> = <span class="tl">${f1(W_.m.post)}</span>, the post-epidemic threshold, calculated with the same procedure as ${sym('t')}<sup>*</sup> ${CITE}, from the ${W_.m.n} highest post-epidemic weeks of each season.` }
    },
    onFocus: k => { state.focus = k; drawFocus(); }
  });
  ex.strip(card.root, [
    { tex: T`\class{t-alert}{\text{alert}} = \min \left\{ i : \class{t-ti}{t_i} > \class{t-tstar}{t^{*}} \right\}` },
    { tex: T`\class{t-lev}{\text{intensity}}:\ \class{t-ti}{t_i} > \class{t-i50}{I_{50}},\ \class{t-i90}{I_{90}}\ \text{or}\ \class{t-i95}{I_{95}}` },
    { tex: T`\class{t-end}{\text{end}} = \min \left\{ i > \class{t-peak}{\text{peak}} : \class{t-ti}{t_i} < \class{t-tpost}{t^{*}_{\text{post}}} \right\}` }],
    () => readout());
  const ctrl = card.root.append('div').attr('class', 'ctrl');
  const chips = ctrl.append('div').attr('class', 'chips').attr('role', 'group').attr('aria-label', 'Season to watch');
  const pick = j => { if (state.playing) stop(); state.target = j; state.week = j === 0 ? cur.last : S; setup(); update(); };
  const mk = (j, html) => chips.append('button').attr('class', 'chip').attr('type', 'button').attr('id', 'f6-t' + j).html(html).on('click', () => pick(j));
  chips.append('span').attr('class', 'lab').text('watch');
  const tBtn = [[0, mk(0, `<span class="lg">${cur.name}, now</span><span class="sm">now</span>`)]];
  chips.append('span').attr('class', 'lab').text('or replay');
  seasons.forEach(s => tBtn.push([s.j, mk(s.j, `<span class="lg">${s.short}</span><span class="sm">${s.tiny}</span>`)]));
  const prow = card.root.append('div').attr('class', 'ctrl');
  const playBtn = prow.append('button').attr('class', 'chip play').attr('type', 'button').attr('id', 'f6-play').on('click', () => state.playing ? stop() : play());
  const syncW = MEM.slider(prow, 'week', null, () => state.week, v => { if (state.playing) stop(); state.week = Math.max(1, Math.min(v, W_.upto)); update(); }, [1, S], 1, v => weeks[v - 1]);
  const ICON_PLAY = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8v8.4L10.2 6z" fill="currentColor"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5h7v7h-7z" fill="currentColor"/></svg>';
  const panel = card.root.append('div').attr('class', 'panel');
  const legend = card.root.append('div').attr('class', 'legend');
  legend.html(LEVELS.map(([t, c, o]) => `<span><i class="sw" style="background:${c};opacity:${o}"></i>${t}</span>`).join('') +
    '<span class="lg-ill"><i class="sw ill"></i>illustrative week, not data</span>' +
    '<span><svg class="sw-curve side" viewBox="0 0 12 22" aria-hidden="true"><path d="M11 1C11 7 1.5 8 1.5 11S11 15 11 21" fill="none" stroke="var(--ink2)" stroke-width="1.6"/></svg>past epidemic weeks (step 3), on their side</span>');
  const legIll = legend.select('.lg-ill');
  card.root.append('div').attr('class', 'hint').html('Press <b>Play</b> to go on week by week, or drag the week slider. Outlined bars are illustrative weeks, not data. A past season is replayed with thresholds built from the other seasons.');

  function readout() {
    if (!W_) return '';
    const i = state.week, v = W_.t[i - 1], w = sig(), m = W_.m;
    const who = W_.past ? `Season ${state.target} replayed as if new; thresholds from the other ${N - 1} seasons (${sym('n')} = ${m.n}).`
                        : `The current season, ${cur.name}; thresholds from all ${N} past seasons. The data end in ${wk(cur.last)}; later weeks are illustrative.`;
    const now = v == null ? `${Wk(i)}: no data.` : `${Wk(i)}${ill(i) ? ' (illustrative)' : ''}: <b>${f1(v)}</b> per 100,000, <b>${LEVELS[status(i)][0]}</b>.`;
    const st = w.alert ? ` Alert in ${wk(w.alert)}${w.end ? `; ended in ${wk(w.end)}` : ''}.` : ' No alert so far.';
    const go = !W_.past && i === cur.last && !state.playing ? ' Press <b>Play</b> to add the illustrative weeks one by one.' : '';
    let mem = '';
    if (W_.past && w.alert) { const k = W_.mem.k, d = w.alert - k, wks = q => `${q} week${q === 1 ? '' : 's'}`;
      const fa = W_.t.slice(0, Math.min(state.week, k - 1)).filter(x => x != null && x > m.tstar).length;
      mem = ` MEM's epidemic period for this season (step 1) starts in week ${weeks[k - 1]}. In the paper's terms: timeliness ${wks(Math.abs(d))} (${d === 0 ? 'the same week' : d < 0 ? 'the alert came first' : 'the alert came later'}), detection lag ${wks(Math.max(0, d))}, false alerts ${fa} (pre-epidemic weeks above ${sym('t')}<sup>*</sup>).`; }
    return `${who} ${now}${st}${go}${mem}`;
  }
  function syncPlay() { playBtn.html(state.playing ? `${ICON_STOP}<span>Stop</span>` : `${ICON_PLAY}<span>Play</span>`); }
  const wait = ms => new Promise(res => setTimeout(res, ms));
  // Play goes on from the week shown; at the end of the season it starts again from week 40
  async function play() {
    const id = ++state.run; state.playing = true; syncPlay(); ex.reset(); state.probe = null;
    const from = state.week >= W_.upto ? 1 : state.week + 1;
    for (let i = from; i <= W_.upto; i++) { if (id !== state.run) return; state.week = i; update(); await wait(reduce ? 700 : 450); }
    if (id === state.run) stop();
  }
  function stop() { state.run++; state.playing = false; syncPlay(); ex.refresh(); }
  function update() {
    tBtn.forEach(([j, b]) => b.attr('aria-pressed', j === state.target));
    legIll.attr('hidden', W_.past ? true : null);
    prow.select('.rng').attr('max', W_.upto); syncW();
    prow.selectAll('.step').filter((d, q) => q === 1).property('disabled', state.week >= W_.upto);
    const w = sig();
    card.status(`${W_.past ? 'Season ' + state.target : cur.name}: ${w.alert ? 'alert in week ' + weeks[w.alert - 1] + (ill(w.alert) ? ' (illustrative)' : '') : 'no alert yet'}`, w.alert && !w.end ? 'alarm' : 'ok');
    draw(); ex.refresh();
  }

  let G = null;
  function draw() {
    const Wd = Math.max(300, panel.node().clientWidth), small = Wd < 520, L = small ? 34 : 50, PR = small ? 104 : 176, pw = Wd - L - PR;
    const band = 14, below = W_.past || W_.last < S;
    const top = 26, h = small ? 170 : 210, H = top + h + 22 + (below ? band + 22 : 4);
    const m = W_.m, vmax = d3.max(W_.t.filter(v => v != null)) || 1, ymax = niceMax(Math.max(vmax, m.i95) * 1.05);
    const cw = pw / S, bw = Math.max(3, cw * 0.72), x = i => L + (i - 1) * cw, y = d3.scaleLinear().domain([0, ymax]).range([top + h, top]);
    const w = sig();
    panel.html('');
    const svg = panel.append('svg').attr('viewBox', `0 0 ${Wd} ${H}`).attr('width', Wd).attr('height', H)
      .attr('role', 'img').attr('aria-label', `Weekly rates of ${W_.past ? 'Season ' + state.target : 'the current season'} up to ${wk(state.week)}${!W_.past && state.week > cur.last ? `; the weeks after ${wk(cur.last)} are illustrative, not data` : ''}, with the epidemic, post-epidemic and intensity thresholds.`);
    y.ticks(4).forEach(v => { svg.append('line').attr('x1', L).attr('x2', L + pw).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', 'var(--rule)');
      svg.append('text').attr('class', 'ax ax-end').attr('x', L - 6).attr('y', y(v)).attr('dominant-baseline', 'middle').text(f0(v)); });
    // the epidemic as signalled so far
    if (w.alert) { const a = x(w.alert), b = w.end ? x(w.end) : x(state.week + 1);
      svg.append('rect').attr('class', 'dimmable epiband').attr('x', a).attr('y', top).attr('width', Math.max(1, b - a)).attr('height', h).attr('fill', 'var(--cobaltFaint)'); }
    // where the data end and the illustrative weeks begin
    if (!W_.past && W_.last < S) svg.append('line').attr('class', 'dimmable illine').attr('x1', x(W_.last + 1)).attr('x2', x(W_.last + 1))
      .attr('y1', top).attr('y2', y(0)).attr('stroke', 'var(--muted)').attr('stroke-width', 1).attr('stroke-dasharray', '2 3');
    svg.append('line').attr('class', 'base').attr('x1', L).attr('x2', L + pw).attr('y1', y(0) + .5).attr('y2', y(0) + .5);
    W_.t.forEach((v, i0) => { const i = i0 + 1; if (v == null || i > state.week) return;
      const lv = status(i), [, col, op] = LEVELS[lv], il = ill(i), hb = Math.max(0.8, y(0) - y(v));
      const r = svg.append('rect').attr('class', `dimmable bar lv${lv} w${i}` + (il ? ' ill' : '') + (i === state.week ? ' now' : '')).attr('fill', col);
      if (il) r.attr('x', x(i) + (cw - bw) / 2 + .5).attr('width', Math.max(1, bw - 1)).attr('y', y(v) + .5).attr('height', Math.max(0.8, hb - .5)).attr('rx', Math.min(2, bw / 3))
        .attr('fill-opacity', op * .3).attr('stroke', col).attr('stroke-width', 1).attr('stroke-opacity', Math.min(1, op + .3));
      else r.attr('x', x(i) + (cw - bw) / 2).attr('width', bw).attr('y', y(v)).attr('height', hb).attr('rx', Math.min(2, bw / 3)).attr('fill-opacity', op); });
    // step 3's curve of past epidemic weeks on its side, on the same rate axis, cut into the levels
    const xP0 = L + pw + 8, xW = Wd - 6, wmax = (xW - xP0) * 0.5;
    const dens = v => (v > 0 ? MEM.phi((Math.log(v) - m.lm) / m.ls) / (m.ls * v) : 0), vs = d3.range(ymax / 400, ymax, ymax / 400).concat([ymax]);
    const dmax = d3.max(vs, dens) || 1, cxv = v => xW - dens(v) / dmax * wmax;
    const area = (a, b) => { const pts = vs.filter(v => v > a && v < b); return `M${xW},${y(a)}L${cxv(a)},${y(a)}` + pts.map(v => `L${cxv(v)},${y(v)}`).join('') + `L${cxv(b)},${y(b)}L${xW},${y(b)}Z`; };
    const lv = svg.append('g').attr('class', 'dimmable levels');
    [[ymax / 400, m.tstar, 0], [m.tstar, m.i50, 1], [m.i50, m.i90, 2], [m.i90, m.i95, 3], [m.i95, ymax, 4]].forEach(([a, b, q]) => { if (b <= a) return;
      lv.append('path').attr('class', 'lvl' + q).attr('d', area(a, Math.min(b, ymax))).attr('fill', LEVELS[q][1]).attr('fill-opacity', LEVELS[q][2] * .5); });
    lv.append('path').attr('d', 'M' + vs.map(v => `${cxv(v)},${y(v)}`).join('L')).attr('fill', 'none').attr('stroke', 'var(--ink2)').attr('stroke-width', 1.6);
    lv.append('line').attr('class', 'base').attr('x1', xW + .5).attr('x2', xW + .5).attr('y1', top).attr('y2', y(0));
    if (!small) svg.append('text').attr('class', 'ax').attr('x', xW).attr('y', top - 12).attr('text-anchor', 'end').text('step 3, on its side');
    // thresholds, across the weeks and the curve
    const lines = [['tstar', m.tstar, 'var(--red)', '6 4', `t* = ${f1(m.tstar)}`, 'rd'], ['tpost', m.post, 'var(--teal)', '3 3', `post = ${f1(m.post)}`, 'tl'],
                   ['i50', m.i50, 'var(--amber)', '2 3', `I50 = ${f1(m.i50)}`, 'am'], ['i90', m.i90, 'var(--amber)', '6 4', `I90 = ${f1(m.i90)}`, 'am'],
                   ['i95', m.i95, 'var(--amberInk)', null, `I95 = ${f1(m.i95)}`, 'am']];
    const labs = MEM.dodge(lines.map(l => ({ y: y(l[1]) - 6 })), 14, top, top + h);
    lines.forEach(([id, v, col, dash, text, cls], q) => { const g = svg.append('g').attr('class', 'dimmable ln-' + id);
      g.append('line').attr('x1', L).attr('x2', xW).attr('y1', y(v)).attr('y2', y(v)).attr('stroke', col).attr('stroke-width', 1.8).attr('stroke-dasharray', dash);
      g.append('text').attr('class', 'lab halo ' + cls).attr('x', xP0 + 2).attr('y', labs[q].y).attr('dominant-baseline', 'middle').text(small ? text.split(' = ')[0] : text.replace(' = ', ' ')); });
    // signals
    const flag = (i, text, cls, row) => { const xx = x(i) + cw / 2, right = xx > L + pw * 0.8;
      svg.append('line').attr('class', 'dimmable sg-' + cls).attr('x1', xx).attr('x2', xx).attr('y1', top - 4).attr('y2', y(0)).attr('stroke', 'var(--head)').attr('stroke-width', 1.4).attr('stroke-dasharray', '3 2');
      svg.append('text').attr('class', 'lab c halo dimmable sg-' + cls).attr('x', xx + (right ? -4 : 4)).attr('y', top - 8 + row * 16).attr('text-anchor', right ? 'end' : 'start').text(text); };
    const lbl = (t, i) => small ? `${t} ${weeks[i - 1]}` : `${t}, week ${weeks[i - 1]}`;
    if (w.alert) flag(w.alert, lbl('alert', w.alert), 'alert', 0);
    if (w.end) flag(w.end, lbl('end', w.end), 'end', w.alert && x(w.end) - x(w.alert) < (small ? 70 : 120) ? 1 : 0);
    if (w.alert && W_.t[w.peak - 1] != null) { const xx = x(w.peak) + cw / 2, yy = y(W_.t[w.peak - 1]) - 6;
      svg.append('path').attr('class', 'dimmable sg-peak').attr('d', `M${xx - 5},${yy - 7}H${xx + 5}L${xx},${yy}Z`).attr('fill', 'var(--head)'); }
    // the week now
    const xn = x(state.week) + cw / 2;
    svg.append('line').attr('x1', xn).attr('x2', xn).attr('y1', top).attr('y2', y(0) + 4).attr('stroke', 'var(--cobalt)').attr('stroke-width', 1).attr('stroke-opacity', .5);
    // its value above its bar, above the peak marker when this week is the peak
    const vn = W_.t[state.week - 1];
    if (vn != null) { const up = w.alert && w.peak === state.week ? 19 : 7, edge = xn > L + pw - 12;
      svg.append('text').attr('class', 'dimmable lab c halo nowlab w' + state.week).attr('x', edge ? xn + cw / 2 : xn).attr('y', y(vn) - up)
        .attr('text-anchor', edge ? 'end' : 'middle').text(f1(vn)); }
    [1, 5, 9, 13, 17, 21, 25, 29, 33].forEach(i => svg.append('text').attr('class', 'ax ax-mid').attr('x', x(i) + cw / 2).attr('y', y(0) + 16).text(weeks[i - 1]));
    if (!small) svg.append('text').attr('class', 'ax').attr('x', 0).attr('y', y(0) + 16).text('week');
    const fit = (t, cands, room) => { for (const c of cands) { t.text(c); if (t.node().getComputedTextLength() <= room) break; } };
    // MEM's own epidemic period of a replayed season, for comparison (the paper's cross-validation)
    if (W_.past) { const yb = y(0) + 24, a = x(W_.mem.k), b = x(W_.mem.end + 1);
      svg.append('rect').attr('class', 'dimmable memband').attr('x', a).attr('y', yb).attr('width', b - a).attr('height', band).attr('rx', 4).attr('fill', 'var(--cobalt)').attr('fill-opacity', .2).attr('stroke', 'var(--cobalt)').attr('stroke-width', 1);
      fit(svg.append('text').attr('class', 'lab c dimmable memband').attr('x', (a + b) / 2).attr('y', yb + band / 2 + 0.5).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle'),
          ["MEM's epidemic period, step 1", 'MEM epidemic', 'MEM'], b - a - 6); }
    // the illustrative weeks of the current season, marked under the axis
    if (!W_.past && W_.last < S) { const yb = y(0) + 24, a = x(W_.last + 1), b = L + pw;
      svg.append('rect').attr('class', 'dimmable illband').attr('x', a).attr('y', yb).attr('width', b - a).attr('height', band).attr('rx', 4)
        .attr('fill', 'var(--surf)').attr('stroke', 'var(--muted)').attr('stroke-width', 1).attr('stroke-dasharray', '3 2');
      fit(svg.append('text').attr('class', 'lab ink dimmable illband').attr('x', (a + b) / 2).attr('y', yb + band / 2 + 0.5).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle'),
          ['illustrative weeks, not data', 'illustrative, not data', 'illustrative'], b - a - 6); }
    svg.append('g').attr('class', 'lyr-focus');
    svg.append('rect').attr('x', L).attr('y', 0).attr('width', pw).attr('height', H).attr('fill', 'transparent')
      .on('pointerdown pointermove', ev => { const i = Math.max(1, Math.min(S, Math.floor((d3.pointer(ev, svg.node())[0] - L) / cw) + 1));
        if (state.focus === 'ti' && state.probe === i) return; state.probe = i; ex.fromChart('ti'); })
      .on('pointerleave', ev => { if (ev.pointerType === 'mouse') { state.probe = null; ex.fromChart(null); } });
    G = { x, y, cw, L, pw, top, h, small };
    drawFocus();
  }

  function drawFocus() {
    if (!G) return;
    const key = state.focus, svg = panel.select('svg'), fl = svg.select('.lyr-focus').html('');
    svg.selectAll('.dimmable').classed('keep', false);
    svg.classed('focusing', !!key);
    if (!key) return;
    const keep = q => svg.selectAll(q).classed('keep', true);
    if (key === 'ti') { const i = state.probe || state.week; keep('.w' + i); const v = W_.t[i - 1];
      if (v != null && i <= state.week) { const xx = G.x(i), yy = G.y(v);
        fl.append('rect').attr('x', xx - 0.5).attr('y', yy - 2).attr('width', G.cw + 1).attr('height', G.y(0) - yy + 2).attr('rx', 2).attr('fill', 'none').attr('stroke', 'var(--head)').attr('stroke-width', 1.6);
        if (i !== state.week) fl.append('text').attr('class', 'lab c halo').attr('x', xx + G.cw / 2).attr('y', yy - 6).attr('text-anchor', i > S - 4 ? 'end' : 'middle').text(f1(v)); } }
    if (key === 'tstar' || key === 'alert') keep('.ln-tstar, .sg-alert, .bar');
    if (key === 'tpost' || key === 'end') keep('.ln-tpost, .sg-end, .sg-peak, .bar');
    if (key === 'peak') keep('.sg-peak, .bar');
    if (key === 'lev') keep('.ln-i50, .ln-i90, .ln-i95, .bar.lv2, .bar.lv3, .bar.lv4, .levels');
    if (key === 'i50') keep('.ln-i50, .bar.lv2'); if (key === 'i90') keep('.ln-i90, .bar.lv3'); if (key === 'i95') keep('.ln-i95, .bar.lv4');
  }

  MEM.outsideTap(card.root.node(), () => { if (state.probe) { state.probe = null; ex.clearChart(); } });
  setup(); syncPlay(); update();
  let lastW = 0;
  MEM.watchWidth(panel.node(), wd => { if (wd !== lastW) { lastW = wd; draw(); } });
})();
