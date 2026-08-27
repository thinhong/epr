/* ============================================================
   rki-core.js — the method, with nothing else attached.

   A line-for-line transcription of surveillance::algo.rkiLatestTimepoint
   (Höhle 2007). Both figures in this chapter call into it, so what the
   reader sees is the algorithm and not a retelling of it.
   ============================================================ */

const RKI = (function () {

  /* Upper limit of the two-sided 95% Poisson confidence interval for an
     observed count x = 0..20 — surveillance::CIdata, tabulated by Sachs
     (1991, p.446). Each entry is ½·χ²(0.975, 2(x+1)). */
  const CI95 = [
    3.689, 5.572, 7.225, 8.767, 10.242, 11.668, 13.059, 14.423, 15.763,
    17.085, 18.390, 19.682, 20.962, 22.230, 23.490, 24.740, 25.983,
    27.219, 28.448, 29.671, 30.888
  ];

  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;

  const sd = a => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1));
  };

  /* The two branches. Above a reference mean of 20 the counts are large
     enough for a normal approximation; below it the package falls back to
     the exact Poisson limit, looked up at the *floored* mean — which is
     why the threshold moves in steps. */
  function threshold(vals) {
    if (!vals.length) return null;
    const mu = mean(vals);
    if (mu > 20) {
      const s = sd(vals);
      return { n: vals.length, mu, sd: s, branch: 'normal', U: mu + 2 * s };
    }
    const idx = Math.min(Math.floor(mu), CI95.length - 1);
    return { n: vals.length, mu, idx, branch: 'poisson', U: CI95[idx] };
  }

  /* Which weeks feed week `wk`. Returns null when there is not enough
     history behind it — the package raises an error at this point. */
  function refWeeks(wk, ctl, freq) {
    const { b, w, actY } = ctl;
    freq = freq || 52;
    if (wk - b * freq - w < 1) return null;
    const out = [];
    if (actY) for (let k = w; k >= 1; k--) out.push(wk - k);
    for (let i = 1; i <= b; i++)
      for (let j = -w; j <= w; j++) out.push(wk - i * freq + j);
    return out.filter(x => x >= 1);
  }

  /* One timepoint, end to end. Alarm is strict: observed > upperbound. */
  function evaluate(series, wk, ctl, freq) {
    const weeks = refWeeks(wk, ctl, freq);
    if (!weeks || !weeks.length) return null;
    const res = threshold(weeks.map(x => series[x - 1]));
    res.weeks = weeks;
    res.obs = series[wk - 1];
    res.alarm = res.obs > res.U;
    return res;
  }

  /* The three named systems, as surveillance defines them. */
  const VARIANTS = {
    'RKI 1': { b: 0, w: 6, actY: true,  note: 'the six weeks just gone, nothing else' },
    'RKI 2': { b: 1, w: 6, actY: true,  note: 'the six weeks just gone, plus thirteen weeks around this week last year' },
    'RKI 3': { b: 2, w: 4, actY: false, note: 'nine weeks around this week in each of the two previous years' }
  };

  return { CI95, mean, sd, threshold, refWeeks, evaluate, VARIANTS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = RKI;
