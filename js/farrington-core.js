/* ============================================================
   farrington-core.js — the algorithm, with nothing else attached.

   A working implementation of the Farrington method: a weighted
   quasi-Poisson fit on the reference weeks, Anscombe residuals,
   one round of reweighting, and both threshold rules. Both figures
   in this chapter call into it, so what the reader sees is the
   method running rather than a drawing of it.

   Follows surveillance::algo.farrington and farringtonFlexible
   (Farrington 1996; Noufaily 2013).
   ============================================================ */

const FARR = (function () {

  /* ---- log-gamma (Lanczos), for the negative binomial tail ---- */
  const LG = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
              -176.61502916214059, 12.507343278686905, -0.13857109526572012,
              9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < LG.length; i++) x += LG[i] / (z + i + 1);
    const t = z + LG.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  /* Upper tail of the standard normal — how often an ordinary week
     would clear a given Anscombe cut-off by chance alone. Abramowitz
     & Stegun 7.1.26, good to about 1e-7. */
  function normUpper(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const yv = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? 0.5 * (1 - yv) : 1 - 0.5 * (1 - yv);
  }

  /* ---- weighted least squares on a small design matrix ----
     Gaussian elimination with partial pivoting. The designs here are
     at most a handful of columns, so nothing fancier is needed. */
  function solveWLS(X, z, w) {
    const n = X.length, p = X[0].length;
    const A = Array.from({ length: p }, () => new Float64Array(p + 1));
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += w[i] * X[i][j] * X[i][k];
        A[j][k] = s;
      }
      let s = 0;
      for (let i = 0; i < n; i++) s += w[i] * X[i][j] * z[i];
      A[j][p] = s;
    }
    for (let c = 0; c < p; c++) {
      let piv = c;
      for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      if (Math.abs(A[piv][c]) < 1e-12) continue;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < p; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k <= p; k++) A[r][k] -= f * A[c][k];
      }
    }
    return Array.from({ length: p }, (_, j) =>
      Math.abs(A[j][j]) < 1e-12 ? 0 : A[j][p] / A[j][j]);
  }

  /* Inverse of X'WX — needed for the leverages and for Var(mu0). */
  function invXtWX(X, w) {
    const n = X.length, p = X[0].length;
    const M = Array.from({ length: p }, () => new Float64Array(2 * p));
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += w[i] * X[i][j] * X[i][k];
        M[j][k] = s;
      }
      M[j][p + j] = 1;
    }
    for (let c = 0; c < p; c++) {
      let piv = c;
      for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-12) continue;
      [M[c], M[piv]] = [M[piv], M[c]];
      const d = M[c][c];
      for (let k = 0; k < 2 * p; k++) M[c][k] /= d;
      for (let r = 0; r < p; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let k = 0; k < 2 * p; k++) M[r][k] -= f * M[c][k];
      }
    }
    return Array.from({ length: p }, (_, j) => Array.from({ length: p }, (_, k) => M[j][p + k]));
  }

  /* ---- quasi-Poisson GLM, log link, by IRLS ----
     Prior weights are the Farrington weights; the dispersion is
     estimated afterwards and never feeds back into the fit. */
  function glmQuasiPoisson(X, y, prior, maxIter) {
    const n = y.length, p = X[0].length;
    const pw = prior || new Array(n).fill(1);
    let beta = new Array(p).fill(0);
    beta[0] = Math.log(Math.max(0.5, y.reduce((s, v) => s + v, 0) / n));

    for (let it = 0; it < (maxIter || 40); it++) {
      const eta = X.map(r => r.reduce((s, v, j) => s + v * beta[j], 0));
      const mu = eta.map(e => Math.exp(Math.min(e, 30)));
      // log link: working response z = eta + (y - mu)/mu, IRLS weight = mu
      const z = eta.map((e, i) => e + (y[i] - mu[i]) / Math.max(mu[i], 1e-8));
      const w = mu.map((m, i) => Math.max(m, 1e-8) * pw[i]);
      const nb = solveWLS(X, z, w);
      const delta = Math.max(...nb.map((v, j) => Math.abs(v - beta[j])));
      beta = nb;
      if (delta < 1e-10) break;
    }

    const eta = X.map(r => r.reduce((s, v, j) => s + v * beta[j], 0));
    const mu = eta.map(e => Math.exp(Math.min(e, 30)));
    const w = mu.map((m, i) => m * pw[i]);
    const XtWXinv = invXtWX(X, w);

    // Leverage h_ii of the weighted fit.
    const lev = X.map((r, i) => {
      let s = 0;
      for (let j = 0; j < p; j++)
        for (let k = 0; k < p; k++) s += r[j] * XtWXinv[j][k] * r[k];
      return w[i] * s;
    });

    // Pearson dispersion, floored at 1. Below 1 means "less variable
    // than Poisson", which on a few dozen points is nearly always
    // estimation noise, so Poisson variance is taken as the minimum.
    let chi = 0;
    for (let i = 0; i < n; i++) chi += pw[i] * (y[i] - mu[i]) ** 2 / mu[i];
    const phiRaw = chi / (n - p);

    return { beta, mu, lev, XtWXinv, phi: Math.max(1, phiRaw), phiRaw, n, p };
  }

  /* ---- Anscombe residuals ----
     y^(2/3) is the scale on which a Poisson count is close to
     symmetric; dividing by its approximate standard deviation turns
     the gap into something that reads as a z-score. The sqrt(1-h)
     corrects for the fit having been pulled toward point i. */
  function anscombe(y, mu, phi, lev) {
    return y.map((yi, i) => {
      const num = Math.pow(yi, 2 / 3) - Math.pow(mu[i], 2 / 3);
      const den = (2 / 3) * Math.sqrt(phi) * Math.pow(mu[i], 1 / 6) *
                  Math.sqrt(Math.max(1e-8, 1 - lev[i]));
      return num / den;
    });
  }

  /* ---- Farrington weights ----
     One-sided: only weeks ABOVE expectation are downweighted, which
     makes this a filter for past outbreaks rather than general robust
     regression. gamma rescales so the weights average 1, keeping the
     n - p denominator of phi meaningful. */
  function weights(s, cut) {
    const raw = s.map(si => (si > cut ? 1 / (si * si) : 1));
    const g = s.length / raw.reduce((a, v) => a + v, 0);
    return { w: raw.map(v => v * g), gamma: g };
  }

  /* ---- threshold, 1996: normal approximation on the 2/3 scale ---- */
  function thresholdDelta(mu0, varMu0, phi, z) {
    const tau = phi + varMu0 / mu0;
    const se = Math.sqrt((4 / 9) * Math.pow(mu0, 1 / 3) * tau);
    return Math.pow(Math.pow(mu0, 2 / 3) + z * se, 1.5);
  }

  /* ---- threshold, 2013: a negative binomial quantile ----
     Mean mu0, variance phi*mu0. Always a whole number, no back
     transformation, which matters most on sparse series. Its weakness
     is that mu0 and phi are plugged straight in. */
  function nbPmf(k, size, prob) {
    return Math.exp(lgamma(k + size) - lgamma(size) - lgamma(k + 1) +
                    size * Math.log(prob) + k * Math.log(1 - prob));
  }

  function thresholdNb(mu0, phi, level) {
    if (phi <= 1.0000001) {                       // Poisson quantile
      let c = 0, p = Math.exp(-mu0);
      for (let k = 0; k < 100000; k++) {
        c += p;
        if (c >= level) return k;
        p *= mu0 / (k + 1);
      }
      return 0;
    }
    const size = mu0 / (phi - 1), prob = 1 / phi;
    let c = 0;
    for (let k = 0; k < 100000; k++) {
      c += nbPmf(k, size, prob);
      if (c >= level) return k;
    }
    return 0;
  }

  /* P(Y >= k). Summed upward from k: 1 - cumsum loses every significant
     digit once the cumulative sum is within 1e-16 of 1, and these tails
     routinely run to 1e-26. */
  function nbTail(k, mu0, phi) {
    if (phi <= 1.0000001) return NaN;
    const size = mu0 / (phi - 1), prob = 1 / phi;
    let s = 0;
    for (let j = k; j < k + 20000; j++) {
      const p = nbPmf(j, size, prob);
      s += p;
      if (j > k && p < s * 1e-18) break;
    }
    return s;
  }

  /* ---- the whole method for one week ----
     X        design matrix for the reference weeks
     y        their counts
     x0       the design row for the week being assessed
     cut      Anscombe cut-off: 1 in 1996, 2.58 in 2013
     method   'delta' (1996) or 'nb' (2013)
     Returns every intermediate the figures need to show their work. */
  function run(X, y, x0, opts) {
    const o = Object.assign({ cut: 1, z: 1.645, level: 0.95, method: 'delta',
                              reweight: true }, opts || {});

    const fit1 = glmQuasiPoisson(X, y);
    const s = anscombe(y, fit1.mu, fit1.phi, fit1.lev);

    let fit = fit1, w = new Array(y.length).fill(1), gamma = 1, down = [];
    if (o.reweight) {
      const ww = weights(s, o.cut);
      w = ww.w; gamma = ww.gamma;
      down = s.map((si, i) => (si > o.cut ? i : -1)).filter(i => i >= 0);
      fit = glmQuasiPoisson(X, y, w);
    }

    const eta0 = x0.reduce((acc, v, j) => acc + v * fit.beta[j], 0);
    const mu0 = Math.exp(eta0);

    // Var(mu0) by the delta method: mu0^2 * x0' (X'WX)^-1 x0.
    let q = 0;
    for (let j = 0; j < x0.length; j++)
      for (let k = 0; k < x0.length; k++) q += x0[j] * fit.XtWXinv[j][k] * x0[k];
    const varMu0 = mu0 * mu0 * q;

    const U = o.method === 'nb'
      ? thresholdNb(mu0, fit.phi, o.level)
      : thresholdDelta(mu0, varMu0, fit.phi, o.z);

    return {
      fit1, fit, s, w, gamma, down,
      beta: fit.beta, phi: fit.phi, phiFirst: fit1.phi,
      mu0, varMu0, U,
      score: y0 => (y0 - mu0) / (U - mu0)
    };
  }

  return { lgamma, normUpper, glmQuasiPoisson, anscombe, weights,
           thresholdDelta, thresholdNb, nbPmf, nbTail, run };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FARR;
