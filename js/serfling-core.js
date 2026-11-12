/* ============================================================
   serfling-core.js — the method, with nothing else attached.

   Ordinary least squares on a trend plus r Fourier harmonics,
   percentile trimming of the training weeks, the prediction
   interval that sets the threshold, the partial F test for the
   number of harmonics, and the two-week alarm rule. All three
   figures in this chapter call into it.

   Also: the other ways of cleaning the history (by calendar,
   iteratively, robustly) and the simulated demo series, used by
   the step-by-step figures in the lecture version.

   Follows Serfling (1963) and the lm()/predict() recipe in R.
   ============================================================ */

const SERF = (function () {

  /* ---- the design matrix: intercept, trend, r harmonic pairs ---- */
  function designRow(t, r, L) {
    const row = [1, t];
    for (let i = 1; i <= r; i++) {
      const a = 2 * Math.PI * i * t / L;
      row.push(Math.cos(a), Math.sin(a));
    }
    return row;
  }

  /* ---- small dense linear algebra ---- */
  function invert(M) {
    const p = M.length;
    const A = M.map((row, i) => row.concat(Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))));
    for (let c = 0; c < p; c++) {
      let piv = c;
      for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      const d = A[c][c];
      for (let k = 0; k < 2 * p; k++) A[c][k] /= d;
      for (let r = 0; r < p; r++) {
        if (r === c) continue;
        const f = A[r][c];
        for (let k = 0; k < 2 * p; k++) A[r][k] -= f * A[c][k];
      }
    }
    return A.map(row => row.slice(p));
  }

  /* ---- ordinary least squares ----
     Returns everything predict() needs: coefficients, (X'X)^-1 and
     the residual standard deviation s on n - p degrees of freedom. */
  function ols(X, y) {
    const n = X.length, p = X[0].length;
    const XtX = Array.from({ length: p }, (_, j) =>
      Array.from({ length: p }, (_, k) => {
        let s = 0;
        for (let i = 0; i < n; i++) s += X[i][j] * X[i][k];
        return s;
      }));
    const Xty = Array.from({ length: p }, (_, j) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += X[i][j] * y[i];
      return s;
    });
    const XtXi = invert(XtX);
    const beta = XtXi.map(row => row.reduce((s, v, k) => s + v * Xty[k], 0));
    let rss = 0;
    for (let i = 0; i < n; i++) {
      const f = X[i].reduce((s, v, j) => s + v * beta[j], 0);
      rss += (y[i] - f) ** 2;
    }
    return { beta, XtXi, rss, n, p, s: Math.sqrt(rss / (n - p)) };
  }

  /* ---- quantile, R's default (type 7) ---- */
  function quantile7(arr, prob) {
    const a = arr.slice().sort((x, y) => x - y);
    const h = (a.length - 1) * prob;
    const lo = Math.floor(h), hi = Math.ceil(h);
    return a[lo] + (h - lo) * (a[hi] - a[lo]);
  }

  /* ---- Step 1 + 2: trim, then fit ----
     trim is the share of training weeks dropped from the top, so
     0.15 keeps weeks at or below the 85th percentile — exactly
     hoc[hoc$y <= quantile(hoc$y, 0.85), ] in R. */
  function fit(t, y, opts) {
    const o = Object.assign({ r: 1, L: 52, trim: 0 }, opts || {});
    const cut = o.trim > 0 ? quantile7(y, 1 - o.trim) : Infinity;
    const keep = y.map(v => v <= cut);
    const tk = t.filter((_, i) => keep[i]), yk = y.filter((_, i) => keep[i]);
    const model = ols(tk.map(v => designRow(v, o.r, o.L)), yk);
    return Object.assign(model, { keep, cut, r: o.r, L: o.L, tk, yk });
  }

  /* ---- Step 3: baseline and threshold for new weeks ----
     The prediction standard error has two parts. The 1 is the new
     week's own noise; x'(X'X)^-1 x is how uncertain the fitted line
     is at that point, and it grows as t moves past the training data.
     seFit keeps only the second part, which is what fluserf() uses. */
  function predict(model, t, z) {
    const zz = z === undefined ? 1.645 : z;
    return t.map(tv => {
      const x = designRow(tv, model.r, model.L);
      const yhat = x.reduce((s, v, j) => s + v * model.beta[j], 0);
      let q = 0;
      for (let j = 0; j < x.length; j++)
        for (let k = 0; k < x.length; k++) q += x[j] * model.XtXi[j][k] * x[k];
      const sePred = model.s * Math.sqrt(1 + q);
      const seFit = model.s * Math.sqrt(q);
      return { t: tv, yhat, sePred, seFit, U: yhat + zz * sePred, Ufit: yhat + zz * seFit };
    });
  }

  /* ---- Choosing r: partial F for adding harmonic 2 to harmonic 1 ----
     Bliss's analysis of variance in Serfling's paper, and anova(m1, m2)
     in R: the variance the second harmonic explains, per degree of
     freedom, against the residual variance of the bigger model. */
  function partialF(t, y, L) {
    const m1 = ols(t.map(v => designRow(v, 1, L)), y);
    const m2 = ols(t.map(v => designRow(v, 2, L)), y);
    const F = ((m1.rss - m2.rss) / 2) / (m2.rss / (m2.n - m2.p));
    return { F, df1: 2, df2: m2.n - m2.p };
  }

  /* ---- One harmonic as amplitude and peak ----
     gamma cos(x) + delta sin(x) = A cos(x - theta), so the wave peaks
     where x = theta. Harmonic i rises and falls i times a year, so it
     has i peaks, L/i weeks apart. */
  function amplitudePhase(gamma, delta, i, L) {
    const A = Math.sqrt(gamma * gamma + delta * delta);
    let theta = Math.atan2(delta, gamma);
    if (theta < 0) theta += 2 * Math.PI;
    const first = theta * L / (2 * Math.PI * i);
    const peaks = d3range(i).map(k => first + k * L / i);
    return { A, theta, peaks };
  }

  function d3range(n) { return Array.from({ length: n }, (_, k) => k); }

  /* ================================================================
     Other ways to clean the history. Each returns a model that
     predict() accepts, plus keep[] (which training weeks were used).
     ================================================================ */

  const dot = (a, b) => a.reduce((s, v, j) => s + v * b[j], 0);
  function median(arr) {
    const a = arr.slice().sort((x, y) => x - y), m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }

  /* ---- weighted least squares: ols() with a weight on each row ---- */
  function wls(X, y, w) {
    const n = X.length, p = X[0].length;
    const XtWX = Array.from({ length: p }, (_, j) =>
      Array.from({ length: p }, (_, k) => {
        let s = 0;
        for (let i = 0; i < n; i++) s += w[i] * X[i][j] * X[i][k];
        return s;
      }));
    const XtWy = Array.from({ length: p }, (_, j) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += w[i] * X[i][j] * y[i];
      return s;
    });
    const beta = invert(XtWX).map(row => row.reduce((s, v, k) => s + v * XtWy[k], 0));
    return { beta, n, p };
  }

  /* ---- fit on any chosen subset of the training weeks ----
     R2 is measured on the weeks used, as lm() reports it. */
  function fitKeep(t, y, keep, opts) {
    const o = Object.assign({ r: 1, L: 52 }, opts || {});
    const tk = t.filter((_, i) => keep[i]), yk = y.filter((_, i) => keep[i]);
    const model = ols(tk.map(v => designRow(v, o.r, o.L)), yk);
    const mean = yk.reduce((s, v) => s + v, 0) / yk.length;
    const tss = yk.reduce((s, v) => s + (v - mean) ** 2, 0);
    return Object.assign(model, { keep: keep.slice(), r: o.r, L: o.L, tk, yk, R2: 1 - model.rss / tss });
  }

  /* ---- by calendar: drop season weeks from..to of every season ----
     Season week 1 is t = 1, 1 + L, 1 + 2L, ... */
  function fitCalendar(t, y, opts) {
    const o = Object.assign({ r: 1, L: 52, from: 14, to: 40 }, opts || {});
    const keep = t.map(v => { const w = ((v - 1) % o.L) + 1; return w < o.from || w > o.to; });
    return Object.assign(fitKeep(t, y, keep, o), { from: o.from, to: o.to });
  }

  /* ---- iteratively (Wang et al. 2015) ----
     Round 1 drops every week above the first fitted line; later rounds
     drop weeks above the upper 95% prediction limit of the current fit.
     Stop as soon as R2 no longer increases and keep the best fit.
     round[i] is the round in which training week i was dropped (0 = kept). */
  function fitIterative(t, y, opts) {
    const o = Object.assign({ r: 1, L: 52, z: 1.96, maxRounds: 20 }, opts || {});
    let keep = t.map(() => true);
    let m = fitKeep(t, y, keep, o);
    const first = m;
    const round = t.map(() => 0);
    const rounds = [];
    for (let k = 1; k <= o.maxRounds; k++) {
      const P = predict(m, t, o.z);
      const drop = t.map((_, i) => keep[i] && y[i] > (k === 1 ? P[i].yhat : P[i].U));
      const nd = drop.filter(Boolean).length;
      if (!nd) break;
      const nm = fitKeep(t, y, keep.map((kk, i) => kk && !drop[i]), o);
      const better = nm.R2 > m.R2;
      rounds.push({ round: k, dropped: nd, kept: nm.n, R2: nm.R2, prevR2: m.R2, accepted: better });
      if (!better) break;
      drop.forEach((d, i) => { if (d) round[i] = k; });
      keep = nm.keep; m = nm;
    }
    return Object.assign(m, { first, rounds, round });
  }

  /* ---- robustly: Huber M-estimation by IRLS, as MASS::rlm() ----
     Start from least squares; each pass rescales the residuals by
     MAD = median|e| / 0.6745 and gives each week weight
     min(1, k / |e/MAD|), k = 1.345; stop when the residuals move by
     less than 1e-4 (relative). Every week is kept, but outlying weeks
     count for less. The threshold uses the robust scale s, as
     predict() does for an rlm fit. */
  function fitRobust(t, y, opts) {
    const o = Object.assign({ r: 1, L: 52, k: 1.345, maxit: 20, acc: 1e-4 }, opts || {});
    const X = t.map(v => designRow(v, o.r, o.L));
    const ls = ols(X, y);
    let beta = ls.beta;
    let resid = y.map((v, i) => v - dot(X[i], beta));
    let scale = 0, w = y.map(() => 1), it = 0;
    for (it = 1; it <= o.maxit; it++) {
      scale = median(resid.map(Math.abs)) / 0.6745;
      w = resid.map(e => Math.min(1, o.k / Math.abs(e / scale)));
      beta = wls(X, y, w).beta;
      const nr = y.map((v, i) => v - dot(X[i], beta));
      let num = 0, den = 0;
      for (let i = 0; i < nr.length; i++) { num += (resid[i] - nr[i]) ** 2; den += resid[i] ** 2; }
      resid = nr;
      if (Math.sqrt(num / Math.max(1e-20, den)) <= o.acc) break;
    }
    return {
      beta, XtXi: ls.XtXi, n: y.length, p: X[0].length, s: scale,
      weights: w, iterations: Math.min(it, o.maxit), ls,
      keep: t.map(() => true), r: o.r, L: o.L, tk: t.slice(), yk: y.slice()
    };
  }

  /* ---- the simulated series used by the step-by-step figures ----
     Six seasons of 52 weeks; season week 1 is July. True baseline
     120 + 0.04 t + 14 cos(2π(t − 26)/52), one winter epidemic per
     season, normal noise with standard deviation 10. The first five
     seasons train the model; the sixth is monitored. Its epidemic
     peaks in season week 28. excess(t) is the epidemic's own
     contribution, so the figures can tell epidemic weeks (excess
     above 5, half the noise) from ordinary ones. */
  const EPIS = [[25, 2.6, 75], [29, 2.4, 115], [22, 3.0, 60], [27, 2.7, 100], [31, 2.3, 85], [28, 2.8, 95]];
  const demo = {
    Y: [114,108,89,108,119,113,111,120,122,128,127,108,119,107,139,112,122,139,121,143,164,178,190,198,219,217,197,168,179,138,136,141,112,125,129,157,115,122,133,121,113,140,121,114,124,104,102,120,105,84,105,95,94,111,116,104,109,112,102,101,129,114,120,124,100,125,123,111,135,137,126,151,145,129,144,152,163,197,209,239,257,253,210,206,155,157,153,139,136,116,128,130,126,118,107,105,105,103,126,101,116,102,125,97,106,117,123,104,119,121,111,119,123,117,114,132,112,141,137,157,160,170,157,176,188,185,187,177,146,157,172,145,130,146,159,139,124,141,131,123,129,132,125,141,127,120,115,109,134,113,100,121,121,112,111,117,114,109,115,125,109,118,127,139,113,127,130,138,121,133,131,130,137,111,134,140,157,158,177,198,226,239,237,245,197,201,171,157,144,128,140,130,126,142,145,133,126,129,98,98,119,119,108,119,114,113,105,112,131,108,107,121,118,119,111,121,128,112,116,124,127,141,138,144,125,147,135,142,148,133,142,162,128,162,161,172,194,215,236,233,182,162,169,144,148,123,139,132,121,124,124,145,120,115,120,116,105,102,132,122,114,113,119,116,121,116,123,119,120,133,131,132,132,124,132,141,135,158,138,131,138,158,170,168,185,221,237,241,229,205,200,170,149,150,140,141,129,115,131,132,149,135,114,113,136,124,127,125,110,118,117,110],
    L: 52, ntrain: 260, noise: 10, peak: 28,
    truth: t => 120 + 0.04 * t + 14 * Math.cos(2 * Math.PI * (t - 26) / 52),
    excess: t => {
      const e = EPIS[Math.floor((t - 1) / 52)], w = ((t - 1) % 52) + 1;
      return e ? e[2] * Math.exp(-0.5 * ((w - e[0]) / e[1]) ** 2) : 0;
    }
  };

  /* ---- Step 4: confirm only on the second week in a row ---- */
  function twoWeek(exceed) {
    return exceed.map((e, i) => e && i > 0 && exceed[i - 1]);
  }

  /* ---- probabilities for the two-week rule, independent weeks ----
     a: no confirmed pair yet, last week below the line
     b: no confirmed pair yet, last week above it */
  function pAnyExceed(alpha, n) { return 1 - Math.pow(1 - alpha, n); }

  function pAnyPair(alpha, n) {
    let a = 1, b = 0;
    for (let k = 0; k < n; k++) [a, b] = [(1 - alpha) * (a + b), alpha * a];
    return 1 - (a + b);
  }

  /* ---- standard normal upper tail, A&S 7.1.26 ---- */
  function normUpper(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const yv = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? 0.5 * (1 - yv) : 1 - 0.5 * (1 - yv);
  }

  /* ---- a seeded generator, so a figure opens on the same season ---- */
  function rng(seed) {
    let s = seed >>> 0;
    const unif = () => {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    let spare = null;
    const normal = () => {
      if (spare !== null) { const v = spare; spare = null; return v; }
      let u, v, w;
      do { u = 2 * unif() - 1; v = 2 * unif() - 1; w = u * u + v * v; } while (w >= 1 || w === 0);
      const m = Math.sqrt(-2 * Math.log(w) / w);
      spare = v * m;
      return u * m;
    };
    return { unif, normal };
  }

  return { designRow, ols, quantile7, fit, predict, partialF, amplitudePhase,
           twoWeek, pAnyExceed, pAnyPair, normUpper, rng,
           wls, fitKeep, fitCalendar, fitIterative, fitRobust, demo };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SERF;
