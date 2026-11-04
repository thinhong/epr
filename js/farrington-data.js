/* ============================================================
   farrington-data.js: one simulated surveillance series, shared by
   every figure in the chapter so the story stays the same data.

   Weekly counts for 2021 to week 25 of 2026: a seasonal wave that
   peaks around week 25, reporting that grows about 10% a year, and
   negative binomial noise (variance about 1.4 times the mean).
   Simulated, not observed (seed 422).
   ============================================================ */

const FDATA = (function () {
  const NOW_YEAR = 2026, NOW_WEEK = 25;
  const SERIES = {
    2021: [4, 2, 1, 2, 2, 4, 3, 5, 8, 5, 7, 7, 6, 9, 12, 9, 5, 12, 18, 14, 29, 10, 28, 10, 13, 19, 17, 12, 16, 6, 10, 13, 11, 19, 5, 6, 7, 6, 8, 2, 4, 4, 1, 3, 3, 4, 1, 5, 0, 1, 3, 2],
    2022: [4, 7, 2, 4, 2, 1, 2, 4, 8, 4, 5, 6, 11, 9, 11, 15, 9, 12, 21, 18, 24, 16, 24, 15, 18, 20, 28, 24, 14, 14, 8, 14, 20, 10, 11, 7, 9, 6, 8, 6, 8, 6, 4, 0, 3, 4, 3, 0, 3, 4, 3, 4],
    2023: [3, 2, 3, 4, 3, 6, 8, 4, 6, 6, 9, 9, 9, 10, 6, 9, 12, 19, 20, 15, 28, 24, 25, 21, 28, 17, 14, 20, 18, 22, 9, 12, 7, 11, 12, 9, 9, 7, 9, 4, 3, 7, 9, 2, 5, 2, 2, 2, 1, 5, 1, 2],
    2024: [1, 2, 10, 8, 7, 1, 1, 2, 6, 11, 8, 14, 10, 7, 22, 8, 23, 13, 20, 18, 15, 23, 19, 26, 23, 23, 21, 29, 16, 14, 29, 22, 7, 16, 14, 16, 10, 6, 12, 9, 3, 4, 1, 8, 7, 8, 2, 4, 5, 2, 2, 10],
    2025: [0, 3, 2, 2, 1, 3, 4, 5, 3, 8, 4, 12, 9, 14, 11, 17, 13, 31, 16, 27, 22, 22, 25, 17, 28, 29, 37, 22, 23, 26, 21, 18, 15, 13, 13, 7, 11, 14, 14, 6, 8, 6, 4, 4, 8, 4, 6, 1, 3, 5, 0, 3],
    2026: [2, 3, 2, 6, 4, 4, 9, 8, 3, 4, 11, 11, 13, 11, 8, 28, 13, 25, 27, 14, 24, 33, 30, 26, 31]
  };

  /* The baseline of Farrington et al. (1996): weeks NOW_WEEK - w to
     NOW_WEEK + w of each of the b previous years. Weeks are numbered as
     in the paper, from 1 at the first baseline week, so with b = 5 and
     w = 3 they are 1-7, 53-59, ..., 209-215 and this week is t0 = 264. */
  function windows(b, w, series) {
    const S = series || SERIES;
    const pts = [];
    for (let i = b; i >= 1; i--) {
      const year = NOW_YEAR - i;
      for (let j = -w; j <= w; j++) {
        const week = NOW_WEEK + j;
        pts.push({ year, week, y: S[year][week - 1], t: 52 * (b - i) + (j + w) + 1, cluster: b - i });
      }
    }
    return { pts, t0: 52 * b + w + 1, y0: S[NOW_YEAR][NOW_WEEK - 1] };
  }

  return { NOW_YEAR, NOW_WEEK, SERIES, windows };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = FDATA;
