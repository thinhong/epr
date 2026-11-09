/* ============================================================
   serfling-core.js — the method, with nothing else attached.

   Ordinary least squares on a trend plus r Fourier harmonics,
   percentile trimming of the training weeks, the prediction
   interval that sets the threshold, the partial F test for the
   number of harmonics, and the two-week alarm rule. All three
   figures in this chapter call into it.

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
           twoWeek, pAnyExceed, pAnyPair, normUpper, rng };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = SERF;
