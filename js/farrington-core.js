/* ============================================================
   farrington-core.js: the algorithm, with nothing else attached.

   A port of surveillance::algo.farrington for one week
   (Farrington et al. 1996): a quasi-Poisson fit to the baseline
   weeks, one round of Anscombe reweighting, the three trend
   rules, and the threshold on the 2/3-power scale. The negative
   binomial threshold of Noufaily et al. (2013) is here too.
   Every figure in the chapter calls into this file, so the numbers
   on screen are the method running, not a drawing of it.
   Checked against the R source of surveillance 1.26.1.
   ============================================================ */

const FARR = (function () {

  /* ---- special functions ---------------------------------- */

  // log-gamma (Lanczos), for the t and negative binomial tails
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

  // Regularised incomplete beta I_x(a, b), continued fraction
  // (Numerical Recipes 6.4). Used for the t test on the trend.
  function betacf(a, b, x) {
    const EPS = 1e-15, FPMIN = 1e-300;
    let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
      c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < EPS) break;
    }
    return h;
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) +
                        a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a
                                     : 1 - bt * betacf(b, a, 1 - x) / b;
  }

  // Two-sided p-value of a t statistic, as summary.glm reports it.
  function pTwoSided(t, df) {
    return ibeta(df / 2, 0.5, df / (df + t * t));
  }

  // Standard normal quantile (Acklam), relative error about 1e-9.
  function qnorm(p) {
    const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687,
               138.357751867269, -30.66479806614716, 2.506628277459239];
    const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866,
               66.80131188771972, -13.28068155288572];
    const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838,
               -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996,
               3.754408661907416];
    const lo = 0.02425, hi = 1 - lo;
    let q, r;
    if (p < lo) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
             ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p > hi) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
              ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }

  // Upper tail of the standard normal (Abramowitz & Stegun 7.1.26):
  // how often an ordinary week clears an Anscombe cut-off by chance.
  function normUpper(x) {
    const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
    const yv = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t
              - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
    return x >= 0 ? 0.5 * (1 - yv) : 1 - 0.5 * (1 - yv);
  }

  /* ---- small linear algebra -------------------------------- */

  // (X'WX)^-1 by Gauss-Jordan; the designs here have 1 or 2 columns.
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
      [M[c], M[piv]] = [M[piv], M[c]];
      const dd = M[c][c];
      for (let k = 0; k < 2 * p; k++) M[c][k] /= dd;
      for (let r = 0; r < p; r++) {
        if (r === c) continue;
        const f = M[r][c];
        for (let k = 0; k < 2 * p; k++) M[r][k] -= f * M[c][k];
      }
    }
    return Array.from({ length: p }, (_, j) => Array.from({ length: p }, (_, k) => M[j][p + k]));
  }

  const dot = (a, b) => a.reduce((s, v, j) => s + v * b[j], 0);
  const quad = (x, A) => {          // x' A x
    let s = 0;
    for (let j = 0; j < x.length; j++)
      for (let k = 0; k < x.length; k++) s += x[j] * A[j][k] * x[k];
    return s;
  };

  /* ---- quasi-Poisson GLM, log link, by IRLS ----------------
     prior: the Farrington weights (all 1 on the first pass).
     Returns phiRaw (Pearson, can be below 1) and phi = max(1, phiRaw). */
  function glm(X, y, prior) {
    const n = y.length, p = X[0].length;
    const pw = prior || new Array(n).fill(1);
    let eta = y.map(v => Math.log(v + 0.1));          // R: mustart = y + 0.1
    let beta = new Array(p).fill(0);
    for (let it = 0; it < 100; it++) {
      const mu = eta.map(Math.exp);
      const z = eta.map((e, i) => e + (y[i] - mu[i]) / mu[i]);
      const w = mu.map((m, i) => pw[i] * m);
      const A = invXtWX(X, w);
      const xtwz = Array.from({ length: p }, (_, j) =>
        X.reduce((s, r, i) => s + w[i] * r[j] * z[i], 0));
      const nb = A.map(row => dot(row, xtwz));
      const delta = Math.max(...nb.map((v, j) => Math.abs(v - beta[j])));
      beta = nb;
      eta = X.map(r => dot(r, beta));
      if (it > 0 && delta < 1e-12) break;
    }
    const mu = eta.map(Math.exp);
    const w = mu.map((m, i) => pw[i] * m);
    const cov = invXtWX(X, w);                       // unscaled (X'WX)^-1
    const lev = X.map((r, i) => w[i] * quad(r, cov));
    let chi = 0;
    for (let i = 0; i < n; i++) chi += pw[i] * (y[i] - mu[i]) ** 2 / mu[i];
    const phiRaw = chi / (n - p);
    return { beta, mu, cov, lev, chi, phiRaw, phi: Math.max(1, phiRaw), n, p, prior: pw };
  }

  /* ---- Anscombe residuals ------------------------------------
     s = (y^(2/3) - mu^(2/3)) / ((2/3) mu^(1/6) sqrt(phi (1 - h))).
     Same as surveillance::anscombe.residuals. */
  function anscombe(y, mu, phi, lev) {
    return y.map((yi, i) =>
      (Math.pow(yi, 2 / 3) - Math.pow(mu[i], 2 / 3)) /
      ((2 / 3) * Math.pow(mu[i], 1 / 6) * Math.sqrt(phi * Math.max(1e-12, 1 - lev[i]))));
  }

  /* ---- Farrington weights -------------------------------------
     One-sided: only weeks well ABOVE the fit are shrunk. gamma keeps
     the weights summing to n. Same as algo.farrington.assign.weights. */
  function weights(s, cut) {
    const raw = s.map(si => (si > cut ? 1 / (si * si) : 1));
    const gamma = s.length / raw.reduce((a, v) => a + v, 0);
    return { w: raw.map(v => v * gamma), gamma, raw };
  }

  /* ---- one fit, as algo.farrington.fitGLM.fast does it ----------
     fit -> phi -> Anscombe residuals -> weights -> refit -> phi. */
  function fitOnce(X, y, o) {
    const first = glm(X, y);
    if (!o.reweight) return { first, fit: first, s: null, w: first.prior, gamma: 1, down: [] };
    const s = anscombe(y, first.mu, first.phi, first.lev);
    const ww = weights(s, o.cut);
    const fit = glm(X, y, ww.w);
    const down = s.map((si, i) => (si > o.cut ? i : -1)).filter(i => i >= 0);
    return { first, fit, s, w: ww.w, gamma: ww.gamma, raw: ww.raw, down };
  }

  /* ---- threshold, 1996: normal approximation on the 2/3 scale ---- */
  function thresholdDelta(mu0, varMu0, phi, z) {
    const tau = phi + varMu0 / mu0;
    const se = Math.sqrt((4 / 9) * Math.pow(mu0, 1 / 3) * tau);
    return Math.pow(Math.pow(mu0, 2 / 3) + z * se, 1.5);
  }

  /* ---- threshold, 2013: a negative binomial quantile ---- */
  function nbPmf(k, size, prob) {
    return Math.exp(lgamma(k + size) - lgamma(size) - lgamma(k + 1) +
                    size * Math.log(prob) + k * Math.log(1 - prob));
  }
  function thresholdNb(mu0, phi, level) {
    let c = 0;
    if (phi <= 1) {                                   // R: qpois
      let p = Math.exp(-mu0);
      for (let k = 0; k < 100000; k++) { c += p; if (c >= level - 1e-12) return k; p *= mu0 / (k + 1); }
      return NaN;
    }
    const size = mu0 / (phi - 1), prob = 1 / phi;     // R: qnbinom
    for (let k = 0; k < 100000; k++) { c += nbPmf(k, size, prob); if (c >= level - 1e-12) return k; }
    return NaN;
  }

  /* ---- the whole method for one week ---------------------------
     t      baseline week numbers (1-7, 53-59, ... in the paper)
     y      their counts
     t0     the week being assessed (264 when b = 5, w = 3)
     opts   b (years back), cut (1 in 1996), alpha (two-sided, as in
            algo.farrington), trend, reweight, method 'delta' | 'nb'
     Returns every intermediate a figure may want to show. */
  function run(t, y, t0, opts) {
    const o = Object.assign({ b: 5, cut: 1, alpha: 0.05, sided: 2, trend: true,
                              reweight: true, method: 'delta' }, opts || {});
    const Xt = t.map(v => [1, v]), X1 = t.map(() => [1]);
    const maxY = Math.max(...y);
    let res = null, rules = null, withTrend = null;

    if (o.trend) {
      withTrend = fitOnce(Xt, y, o);
      const f = withTrend.fit;
      const se = Math.sqrt(f.phiRaw * f.cov[1][1]);     // summary.glm: unfloored phi
      const tval = f.beta[1] / se;
      const pval = pTwoSided(tval, f.n - f.p);
      const mu0T = Math.exp(f.beta[0] + f.beta[1] * t0);
      rules = { years: o.b >= 3, significant: pval < 0.05, noExtrapolation: mu0T <= maxY,
                p: pval, tval, se, mu0Trend: mu0T, maxY };
      rules.keep = rules.years && rules.significant && rules.noExtrapolation;
      if (rules.keep) res = withTrend;
    }
    const keep = !!(rules && rules.keep);
    if (!keep) res = fitOnce(X1, y, o);

    const f = res.fit;
    const x0 = keep ? [1, t0] : [1];
    const mu0 = Math.exp(dot(x0, f.beta));
    const q = quad(x0, f.cov);
    const varMu0 = mu0 * mu0 * f.phi * q;              // predict.glm(dispersion = phi)
    const z = qnorm(1 - o.alpha / o.sided);
    const U = o.method === 'nb' ? thresholdNb(mu0, f.phi, 1 - o.alpha)
                                : thresholdDelta(mu0, varMu0, f.phi, z);
    const curve = tv => Math.exp(keep ? f.beta[0] + f.beta[1] * tv : f.beta[0]);
    return {
      keep, rules, withTrend, res, fit: f, beta: f.beta, phi: f.phi, phiRaw: f.phiRaw,
      phiFirst: res.first.phi, s: res.s, w: res.w, gamma: res.gamma, down: res.down,
      mu0, varMu0, z, U, curve, maxY,
      score: y0 => (y0 - mu0) / (U - mu0)
    };
  }

  return { lgamma, ibeta, pTwoSided, qnorm, normUpper, glm, anscombe, weights,
           fitOnce, thresholdDelta, thresholdNb, nbPmf, run };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FARR;
