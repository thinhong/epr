/* ============================================================
   bayes-core.js — the distributions, with nothing else attached.

   Two predictive distributions for next week's count:

     plug-in    y ~ NB(mu_hat, nu)          parameters treated as known
     Bayesian   y ~ ∫ NB(mu, nu) p(mu|data) dmu

   The second is what boda() builds. Everything the chapter claims
   about fatter tails and higher thresholds is computed here, so the
   figures show the arithmetic rather than an illustration of it.
   ============================================================ */

const BAYES = (function () {

  /* ---- log-gamma (Lanczos), for a stable NB pmf at large counts ---- */
  const G = [676.5203681218851, -1259.1392167224028, 771.32342877765313,
             -176.61502916214059, 12.507343278686905, -0.13857109526572012,
             9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(z) {
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < G.length; i++) x += G[i] / (z + i + 1);
    const t = z + G.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  /* ---- negative binomial, mean/size parameterisation ----
     mean mu, size nu, variance mu + mu^2/nu. Large nu means little
     overdispersion; nu -> infinity gives Poisson. */
  function nbPmf(k, mu, nu) {
    if (mu <= 0) return k === 0 ? 1 : 0;
    const p = nu / (nu + mu);
    return Math.exp(
      lgamma(k + nu) - lgamma(nu) - lgamma(k + 1) +
      nu * Math.log(p) + k * Math.log(1 - p)
    );
  }

  /* The whole pmf over 0..kMax, as an array. */
  function nbDist(mu, nu, kMax) {
    return d3.range(0, kMax + 1).map(k => nbPmf(k, mu, nu));
  }

  /* ---- posterior predictive ----
     The posterior for the expected count is taken as lognormal:
     log mu ~ N(log mu_hat, sigma^2). sigma is the parameter
     uncertainty — roughly the coefficient of variation of mu.
     Mixing over it is a weighted sum of negative binomials. */
  function predictive(muHat, nu, sigma, kMax, nodes) {
    if (sigma <= 0) return nbDist(muHat, nu, kMax);
    const m = nodes || 81;
    const out = new Array(kMax + 1).fill(0);
    let wsum = 0;
    for (let i = 0; i < m; i++) {
      const z = -4 + 8 * i / (m - 1);
      const w = Math.exp(-0.5 * z * z);
      const mu = muHat * Math.exp(sigma * z - 0.5 * sigma * sigma); // keep E[mu] = muHat
      const d = nbDist(mu, nu, kMax);
      for (let k = 0; k <= kMax; k++) out[k] += w * d[k];
      wsum += w;
    }
    return out.map(v => v / wsum);
  }

  /* ---- the threshold ----
     Counts are whole numbers, so the threshold is the smallest k whose
     cumulative probability reaches 1 - alpha. */
  function quantile(dist, level) {
    let c = 0;
    for (let k = 0; k < dist.length; k++) {
      c += dist[k];
      if (c >= level) return k;
    }
    return dist.length - 1;
  }

  /* P(Y > k) under a distribution — the real alarm rate of a threshold. */
  function tail(dist, k) {
    let c = 0;
    for (let i = k + 1; i < dist.length; i++) c += dist[i];
    return c;
  }

  function mean(dist) { return dist.reduce((s, p, k) => s + k * p, 0); }

  function variance(dist) {
    const m = mean(dist);
    return dist.reduce((s, p, k) => s + p * (k - m) * (k - m), 0);
  }

  /* Closed form for how much wider the Bayesian predictive is.
     By the law of total variance, the extra variance over the plug-in
     is s^2 (1 + 1/nu), where s^2 is the posterior variance of mu. */
  function extraVariance(muHat, nu, sigma) {
    const s2 = muHat * muHat * (Math.exp(sigma * sigma) - 1);   // lognormal variance
    return s2 * (1 + 1 / nu);
  }

  return { lgamma, nbPmf, nbDist, predictive, quantile, tail, mean, variance, extraVariance };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = BAYES;
