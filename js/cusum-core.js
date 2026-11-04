/* ============================================================
   cusum-core.js: shared pieces for the two CUSUM figures.
   pick() turns an SVG into a chooser over items laid out from
   left to right. A mouse hovers; a finger taps, or drags sideways
   (the page still scrolls up and down); the arrow keys step.
   fitBox() fixes the height of the readout box, so the plot under
   it never jumps while the reader explores.
   ============================================================ */

const CUSUM = (function () {
  /* A number for the readout: fixed decimals, a true minus sign,
     and never "-0.00". */
  function num(v, dp = 2) {
    const s = Math.abs(v).toFixed(dp);
    return (v < 0 && Number(s) !== 0 ? '\u2212' : '') + s;
  }

  /* svg: d3 selection of the <svg>.
     o: { count() -> how many items can be chosen,
          at(px)  -> item index for an x position in svg pixels,
          current() -> the item shown now (chosen or default),
          onPick(i) -> i is an index, or null to go back to the default } */
  function pick(svg, o) {
    const node = svg.node();
    let last, down = null;

    const set = i => { if (i !== last) { last = i; o.onPick(i); } };
    const indexAt = ev => {
      const r = node.getBoundingClientRect();
      const vb = node.viewBox && node.viewBox.baseVal;
      const scale = vb && vb.width && r.width ? vb.width / r.width : 1;
      return o.at((ev.clientX - r.left) * scale);
    };

    svg.attr('tabindex', 0)
      .on('pointermove.pick', ev => {
        if (!o.count()) return;
        if (ev.pointerType === 'mouse') { set(indexAt(ev)); return; }
        if (!down || ev.pointerId !== down.id) return;
        if (!down.moved && Math.abs(ev.clientX - down.x) < 6) return;   // ignore a wobbly tap
        down.moved = true;
        set(indexAt(ev));
      })
      .on('pointerdown.pick', ev => {
        if (ev.pointerType !== 'mouse') down = { id: ev.pointerId, x: ev.clientX, moved: false };
      })
      .on('pointerup.pick', ev => {
        if (!down || ev.pointerId !== down.id) return;
        if (!down.moved && o.count()) set(indexAt(ev));                // a tap
        down = null;
      })
      .on('pointercancel.pick', () => { down = null; })                // the page took over to scroll
      .on('pointerleave.pick', ev => { if (ev.pointerType === 'mouse') set(null); })
      .on('keydown.pick', ev => {
        const n = o.count();
        if (!n) return;
        const c = o.current();
        let i;
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') i = Math.min(n - 1, c + 1);
        else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') i = Math.max(0, c - 1);
        else if (ev.key === 'Home') i = 0;
        else if (ev.key === 'End') i = n - 1;
        else if (ev.key === 'Escape') i = null;
        else return;
        ev.preventDefault();
        last = undefined;
        set(i);
      });

    // On a touch screen a tap anywhere else lets go of the chosen item.
    document.addEventListener('pointerdown', ev => {
      if (ev.pointerType !== 'mouse' && !node.contains(ev.target)) set(null);
    }, { passive: true });

    return { reset() { last = undefined; } };
  }

  /* Give the readout box the height of its tallest state at the
     current width, so it never grows or shrinks under the reader. */
  function fitBox(box, states) {
    const el = box.node(), keep = el.innerHTML;
    el.style.minHeight = '';
    let h = 0;
    states.forEach(s => { el.innerHTML = s; h = Math.max(h, el.offsetHeight); });
    el.innerHTML = keep;
    el.style.minHeight = h ? h + 'px' : '';
  }

  /* Push apart labels that would overlap; each keeps its order. */
  function spread(labels, gap) {
    labels.sort((a, b) => a.y - b.y);
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < labels.length; i++) {
        const d = labels[i].y - labels[i - 1].y;
        if (d < gap) { const s = (gap - d) / 2; labels[i - 1].y -= s; labels[i].y += s; }
      }
    }
    return labels;
  }

  /* An SVG label with a subscript, e.g. S with t: base, then the
     small lowered part, then (optionally) more text back on the line. */
  function subLabel(t, base, s, after) {
    const fs = parseFloat(getComputedStyle(t.node()).fontSize) || 13, d = (fs * 0.3).toFixed(1);
    t.text(base);
    t.append('tspan').attr('font-size', '72%').attr('dy', d).text(s);
    if (after) t.append('tspan').attr('dy', -d).text(after);
    return t;
  }

  /* Run fn(width) now and whenever the element changes width. */
  function onWidth(el, fn) {
    let w = -1, raf = 0;
    const run = () => {
      raf = 0;
      const nw = el.clientWidth;
      if (Math.abs(nw - w) > 4) { w = nw; fn(nw); }
    };
    run();
    new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(run); }).observe(el);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { w = -1; run(); });
  }

  return { num, pick, fitBox, spread, subLabel, onWidth };
})();
