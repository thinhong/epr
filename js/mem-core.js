/* ============================================================
   mem-core.js : the Moving Epidemic Method as written in
   Vega et al. (2013), Influenza Other Respir Viruses 7(4):546-558.
   No drawing here. Every function maps to one formula in the
   paper's Methods section. Works in the browser and in Node.
   ============================================================ */
(function (root) {
  'use strict';

  // z values for one-sided upper limits (standard normal quantiles)
  const Z = { p50: 0, p90: 1.2815515655446004, p95: 1.6448536269514722 };

  /* Step 1a. MAP curve (paper, first display formula)
     t_j^r = max_k sum_{i=k}^{k+r-1} t_ij,  p_j^r = t_j^r / t_j^S          */
  function mapCurve(t) {
    const S = t.length;
    const total = t.reduce((a, b) => a + b, 0);
    const tr = [], k = [], p = [];
    for (let r = 1; r <= S; r++) {
      let best = -Infinity, bestK = 1;
      for (let kk = 1; kk <= S - r + 1; kk++) {
        let s = 0;
        for (let i = kk; i <= kk + r - 1; i++) s += t[i - 1];
        if (s > best) { best = s; bestK = kk; }   // first maximum wins
      }
      tr.push(best); k.push(bestK); p.push(100 * best / total);
    }
    return { S, total, tr, k, p };
  }

  /* Step 1b. Smoothing regression of p_j^r over r with an automatic window.
     Local linear regression with a normal kernel (Bowman & Azzalini 1997),
     window chosen by AICc (Hurvich, Simonoff & Tsai 1998): a port of
     sm::sm.weight and sm:::aicc.crit.reg, minimised like stats::optimize. */
  function llWeights(x, ev, h) {
    const n = x.length, W = [];
    for (let e = 0; e < ev.length; e++) {
      const w = new Array(n), d = new Array(n);
      let s0 = 0, s1 = 0, s2 = 0;
      for (let i = 0; i < n; i++) {
        d[i] = ev[e] - x[i];
        w[i] = Math.exp(-0.5 * (d[i] / h) * (d[i] / h));
        s0 += w[i]; s1 += w[i] * d[i]; s2 += w[i] * d[i] * d[i];
      }
      const den = s2 * s0 - s1 * s1, row = new Array(n);
      for (let i = 0; i < n; i++) row[i] = w[i] * (s2 - d[i] * s1) / den;
      W.push(row);
    }
    return W;
  }
  function aicc(x, y, h) {
    const n = x.length, W = llWeights(x, x, h);
    let tr = 0, rss = 0;
    for (let i = 0; i < n; i++) {
      tr += W[i][i];
      let fit = 0;
      for (let k = 0; k < n; k++) fit += W[i][k] * y[k];
      rss += (y[i] - fit) * (y[i] - fit);
    }
    const v = Math.log(rss / n) + 1 + 2 * (tr + 1) / (n - tr - 2);
    return Number.isFinite(v) ? v : 1e10;
  }
  function brentMin(f, ax, bx, tol) {          // R's Brent_fmin (optimize.c)
    const c = (3 - Math.sqrt(5)) * 0.5, eps = Math.sqrt(Number.EPSILON);
    let a = ax, b = bx, v = a + c * (b - a), w = v, x = v, d = 0, e = 0;
    let fx = f(x), fv = fx, fw = fx;
    const tol3 = tol / 3;
    for (;;) {
      const xm = (a + b) * 0.5, tol1 = eps * Math.abs(x) + tol3, t2 = tol1 * 2;
      if (Math.abs(x - xm) <= t2 - (b - a) * 0.5) break;
      let p = 0, q = 0, r = 0;
      if (Math.abs(e) > tol1) {
        r = (x - w) * (fx - fv); q = (x - v) * (fx - fw);
        p = (x - v) * q - (x - w) * r; q = (q - r) * 2;
        if (q > 0) p = -p; else q = -q;
        r = e; e = d;
      }
      let u;
      if (Math.abs(p) >= Math.abs(q * 0.5 * r) || p <= q * (a - x) || p >= q * (b - x)) {
        e = (x < xm) ? b - x : a - x; d = c * e;
      } else {
        d = p / q; u = x + d;
        if (u - a < t2 || b - u < t2) { d = tol1; if (x >= xm) d = -d; }
      }
      if (Math.abs(d) >= tol1) u = x + d; else if (d > 0) u = x + tol1; else u = x - tol1;
      const fu = f(u);
      if (fu <= fx) {
        if (u < x) b = x; else a = x;
        v = w; w = x; x = u; fv = fw; fw = fx; fx = fu;
      } else {
        if (u < x) a = u; else b = u;
        if (fu <= fw || w === x) { v = w; fv = fw; w = u; fw = fu; }
        else if (fu <= fv || v === x || v === w) { v = u; fv = fu; }
      }
    }
    return x;
  }
  function smoothAICc(y) {
    const n = y.length, x = Array.from({ length: n }, (_, i) => i + 1);
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(x.reduce((a, b) => a + (b - mx) * (b - mx), 0) / (n - 1));
    const start = sd / 2;
    const logh = brentMin(lh => aicc(x, y, Math.exp(lh)), Math.log(start / 8), Math.log(start * 4),
                          Math.pow(Number.EPSILON, 0.25));
    const h = Math.exp(logh), W = llWeights(x, x, h);
    const ys = W.map(row => row.reduce((s, wk, k) => s + wk * y[k], 0));
    return { h, ys };
  }

  /* Step 1c. Increment and optimum (paper)
     Delta_j^r = ps^{r+1} - ps^r ;  r_j* = min{ r : Delta_j^r < delta }      */
  function increments(ps) {
    const D = [];
    for (let r = 1; r < ps.length; r++) D.push(ps[r] - ps[r - 1]);   // D[r-1] = Delta^r
    return D;
  }
  function rStar(D, delta) {
    for (let r = 1; r <= D.length; r++) if (D[r - 1] < delta) return r;
    return D.length + 1;      // no increment below delta: the whole season
  }

  /* Step 1d. Timing: k* maximises the sum for r = r*; epidemic k*..k*+r*-1 */
  function season(t) {
    const m = mapCurve(t), sm = smoothAICc(m.p);
    return Object.assign(m, { h: sm.h, ps: sm.ys, D: increments(sm.ys) });
  }
  function timing(s, delta) {
    const r = rStar(s.D, delta), k = s.k[r - 1];
    return { r, k, end: k + r - 1 };
  }

  /* Step 2 and 3 helpers */
  function topN(t, from, to, n) {                 // 1-based inclusive week indices
    const items = [];
    for (let i = from; i <= to; i++) items.push({ i, v: t[i - 1] });
    items.sort((a, b) => b.v - a.v || a.i - b.i);
    return items.slice(0, n);
  }
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
  const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };

  root.MEMCORE = { Z, mapCurve, smoothAICc, increments, rStar, season, timing, topN, mean, sd };
  if (typeof module !== 'undefined') module.exports = root.MEMCORE;
})(typeof window !== 'undefined' ? window : globalThis);
