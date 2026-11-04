/* Formulas typeset by MathJax, with every marked symbol live.
   A figure can hold several formula strips, each placed right above the
   panel it explains, each with its own live line underneath. In TeX a symbol
   is marked as \class{t-KEY}{...}. After typesetting, transparent hit boxes
   are laid over the marked symbols, so mouse, touch and keyboard behave the
   same with MathJax's CHTML output (the book) or SVG output (this page). */
const EXPL = (function () {
  'use strict';
  function mathReady() {
    return new Promise(res => {
      const go = () => (window.MathJax && MathJax.startup && MathJax.startup.promise)
        ? MathJax.startup.promise.then(res) : setTimeout(go, 30);
      go();
    });
  }
  function keyOf(el) {
    const cl = (el.getAttribute && el.getAttribute('class')) || '';
    const m = cl.match(/(?:^|\s)t-([\w-]+)/);
    return m ? m[1] : null;
  }
  // the box of a marked symbol = the union of its visible glyphs, so that
  // spacing MathJax attaches to a group never becomes part of the target
  function glyphRect(e) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    e.querySelectorAll('use, path, rect, text, mjx-c').forEach(g => {
      if (g.closest('defs')) return;               // glyph shapes kept in a formula's own <defs> are not drawn there
      const r = g.getBoundingClientRect();
      if (r.width < 0.5 && r.height < 0.5) return;
      x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
    });
    return x0 < x1 ? { left: x0, top: y0, width: x1 - x0, height: y1 - y0 } : null;
  }
  function create(o) {            // o: { terms: {key: {aria, desc()}}, onFocus(key|null) }
    const strips = [];
    let focus = null, where = -1, locked = false, chartKey = null, chartWhere = -1;
    const api = {};
    function paint() {
      strips.forEach((st, s) => {
        st.lines.forEach(l => {
          l.selectAll('.mx-box').classed('on', function () { return this.dataset.key === focus; });
          l.selectAll('[class*="t-"]').each(function () { const k = keyOf(this); if (k) this.classList.toggle('mx-on', k === focus); });
        });
        const own = focus && s === where && o.terms[focus], html = own ? o.terms[focus].desc() : st.idle();
        st.read.classed('is-term', !!own);
        if (html === st.last) return;
        // while a reading is shown the line may grow but never shrinks, so the chart below
        // does not jump under the pointer; it is released when nothing is in focus
        const node = st.read.node(), h0 = node.offsetHeight;
        node.innerHTML = html; st.last = html;
        if (!focus) node.style.minHeight = '';
        else if (node.offsetHeight < h0) node.style.minHeight = h0 + 'px';
      });
    }
    function set(key, s) { focus = key; where = key ? s : -1; paint(); o.onFocus(focus); }
    function layoutStrip(st, s) {
      if (!st.ready) return;
      st.keys = new Set();
      st.lines.forEach(l => {
        l.selectAll('.mx-hit,.mx-box').remove();
        const host = l.node(), hr = host.getBoundingClientRect();
        const items = Array.from(host.querySelectorAll('[class*="t-"]')).map(e => {
          const k = keyOf(e); if (!k || !o.terms[k]) return null;
          const r = glyphRect(e); if (!r) return null;
          return { key: k, x: r.left - hr.left + host.scrollLeft, y: r.top - hr.top, w: r.width, h: r.height };
        }).filter(d => d && d.w > 0 && d.h > 0).filter((d, q, arr) => arr.findIndex(e => e.key === d.key &&
          Math.abs(e.x - d.x) < 1 && Math.abs(e.y - d.y) < 1 && Math.abs(e.w - d.w) < 1 && Math.abs(e.h - d.h) < 1) === q);
        items.forEach(d => {
          st.keys.add(d.key);
          l.insert('span', ':first-child').attr('class', 'mx-box').attr('data-key', d.key)
            .style('left', (d.x - 3) + 'px').style('top', (d.y - 2) + 'px')
            .style('width', (d.w + 6) + 'px').style('height', (d.h + 4) + 'px');
        });
        items.sort((a, b) => b.w * b.h - a.w * a.h).forEach(d => {
          const pad = Math.max(3, (24 - Math.min(d.w, d.h)) / 2);
          l.append('button').attr('class', 'mx-hit').attr('type', 'button').attr('data-key', d.key)
            .attr('aria-label', o.terms[d.key].aria)
            .style('left', (d.x - pad) + 'px').style('top', (d.y - pad / 2) + 'px')
            .style('width', (d.w + 2 * pad) + 'px').style('height', (d.h + pad) + 'px')
            .on('pointerenter', ev => { if (ev.pointerType === 'mouse' && !locked) set(d.key, s); })
            .on('pointerleave', ev => { if (ev.pointerType === 'mouse' && !locked) set(chartKey, chartWhere); })
            .on('focus', () => { if (!locked) set(d.key, s); })
            .on('blur', () => { if (!locked) set(chartKey, chartWhere); })
            .on('click', ev => {
              ev.stopPropagation();
              if (locked && focus === d.key && where === s) { locked = false; set(chartKey, chartWhere); }
              else { locked = true; set(d.key, s); }
            });
        });
      });
      paint();
    }
    api.strip = (parent, lines, idle) => {
      const box = parent.append('div').attr('class', 'mx');
      const st = { box, idle, ready: false, keys: new Set(),
        lines: lines.map(l => box.append('div').attr('class', 'mx-line' + (l.muted ? ' muted' : '')).html(`\\(\\displaystyle ${l.tex}\\)`)),
        read: parent.append('div').attr('class', 'mx-read').attr('aria-live', 'polite') };
      const s = strips.length; strips.push(st);
      box.on('click', () => { if (locked) { locked = false; set(chartKey, chartWhere); } });
      mathReady().then(() => MathJax.typesetPromise(st.lines.map(l => l.node()))).then(() => {
        st.ready = true; layoutStrip(st, s);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => layoutStrip(st, s));
      });
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => layoutStrip(st, s)).observe(box.node());
      st.lines.forEach(l => l.on('scroll', () => layoutStrip(st, s)));
      st.last = idle(); st.read.html(st.last);
      return st;
    };
    // chart -> formula: light up a symbol while the pointer is on a panel
    api.fromChart = (key, at) => {
      chartKey = key;
      chartWhere = key ? (at != null ? at : strips.findIndex(st => st.keys.has(key))) : -1;
      if (!locked) set(chartKey, chartWhere);
    };
    api.clearChart = () => { if (chartKey) api.fromChart(null); };
    api.reset = () => { locked = false; chartKey = null; chartWhere = -1; set(null, -1); };
    api.refresh = () => paint();
    api.focus = () => focus;
    return api;
  }
  return { create };
})();
