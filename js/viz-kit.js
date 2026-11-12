/* ============================================================
   viz-kit.js — shared scaffolding for every figure in the book.
   Requires D3 v7 on the page before this file.

   The point of this file: no individual chapter should ever
   choose a colour, an axis style, or a button shape. It asks
   for a card, drops panels into it, and only writes the marks
   that are specific to its own idea.
   ============================================================ */

const VIZ = (function () {
  const root = document.documentElement;

  /* ---- tokens ------------------------------------------------
     Read straight from the CSS custom properties in styles.scss,
     so the palette has exactly one source of truth. */
  function token(name, fallback) {
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }

  const C = {
    get blue()   { return token('--viz-blue',        '#1b4dc7'); },
    get teal()   { return token('--viz-teal',        '#0e9aab'); },
    get red()    { return token('--viz-red',         '#e0574e'); },
    get redSoft(){ return token('--viz-red-fill',    'rgba(224,87,78,.58)'); },
    get amber()  { return token('--viz-amber',       '#e0960a'); },
    get grey()   { return token('--viz-grey',        '#cfe0f2'); },
    get ink()    { return token('--viz-ink-deep',    '#002147'); },
    get muted()  { return token('--viz-ink-muted',   '#647587'); },
    get rule()   { return token('--viz-rule',        '#e3edf9'); },
    get surfaceAlt(){ return token('--viz-surface-alt', '#f1f6fd'); }
  };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = ms => (reduceMotion ? 0 : ms);

  /* ---- card --------------------------------------------------
     card(mountSelector, {title, status}) -> handle
     The white rounded container with a heading row. */
  function card(mount, opts = {}) {
    const el = d3.select(mount).classed('viz-card', true).html('');

    let statusEl = null;
    if (opts.title || opts.status) {
      const head = el.append('div').attr('class', 'viz-head');
      if (opts.title) head.append('h3').attr('class', 'viz-title').text(opts.title);
      if (opts.status) {
        statusEl = head.append('span').attr('class', 'viz-status').attr('data-state', 'ok');
        statusEl.append('span').attr('class', 'dot');
        statusEl.append('span').attr('class', 'label').text(opts.status);
      }
    }

    const body = el.append('div').attr('class', 'viz-body');

    return {
      el, body,
      /* state is one of 'ok' | 'alarm' | 'idle' — it drives the dot colour */
      setStatus(text, state = 'ok') {
        if (!statusEl) return;
        statusEl.attr('data-state', state).select('.label').text(text);
      }
    };
  }

  /* ---- panel -------------------------------------------------
     panel(body, {label, height, margin}) -> {g, w, h, svg}
     One plotting area. Stack several inside a card and give them
     the same left margin so their x-axes line up. */
  function panel(body, opts = {}) {
    const m = Object.assign({ top: 10, right: 90, bottom: 26, left: 46 }, opts.margin || {});
    const h = opts.height || 180;

    const wrap = body.append('div').attr('class', 'viz-panel');
    if (opts.label) wrap.append('p').attr('class', 'viz-panel-label').text(opts.label);

    // An explicit width sets the viewBox coordinate system; the SVG then
    // scales itself to whatever the column is, so no resize handling.
    const width = opts.width || Math.max(320, wrap.node().clientWidth || 720);
    const svg = wrap.append('svg')
      .attr('viewBox', `0 0 ${width} ${h + m.top + m.bottom}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img');

    if (opts.desc) svg.append('title').text(opts.desc);

    return {
      svg,
      g: svg.append('g').attr('transform', `translate(${m.left},${m.top})`),
      w: width - m.left - m.right,
      h,
      m
    };
  }

  /* ---- axes --------------------------------------------------
     Sparse ticks, no gridlines, no frame. `bare` strips the
     domain line entirely, which is what the y-axes use. */
  function axisX(p, scale, ticks = 6) {
    return p.g.append('g')
      .attr('class', 'viz-axis')
      .attr('transform', `translate(0,${p.h})`)
      .call(d3.axisBottom(scale).ticks(ticks).tickSize(0).tickPadding(9));
  }

  function axisY(p, scale, ticks = 4) {
    return p.g.append('g')
      .attr('class', 'viz-axis viz-axis--bare')
      .call(d3.axisLeft(scale).ticks(ticks).tickSize(0).tickPadding(10));
  }

  /* ---- reference line ----------------------------------------
     A dashed horizontal rule with its name written at the free
     end. This replaces the legend everywhere in the book.
       side: 'right' (default) or 'left'
       colour: use C.teal for expected levels, C.red for alarms. */
  function refLine(p, cfg) {
    const y = cfg.y;
    const x1 = cfg.x1 ?? 0;
    const x2 = cfg.x2 ?? p.w;

    p.g.append('line')
      .attr('class', 'viz-refline')
      .attr('x1', x1).attr('x2', x2)
      .attr('y1', y).attr('y2', y)
      .attr('stroke', cfg.color || C.teal);

    if (cfg.label) {
      const right = (cfg.side || 'right') === 'right';
      p.g.append('text')
        .attr('class', 'viz-reflabel')
        .attr('x', right ? x2 + 10 : x1 - 10)
        .attr('y', cfg.labelDy ? y + cfg.labelDy : y)
        .attr('text-anchor', right ? 'start' : 'end')
        .attr('fill', cfg.color || C.teal)
        .text(cfg.label);
    }
  }

  /* ---- annotation on the plot itself -------------------------
     For things like the word "signal" sitting above the point
     where the statistic first crosses. */
  function annotate(p, cfg) {
    p.g.append('text')
      .attr('class', 'viz-annot')
      .attr('x', cfg.x).attr('y', cfg.y)
      .attr('fill', cfg.color || C.red)
      .text(cfg.text);
  }

  /* ---- formula box -------------------------------------------
     formula(body, {title, lines, hint})
     Restate the update rule being drawn, in monospace, inside
     the card. The hint tells the reader what they can do. */
  function formula(body, cfg) {
    const box = body.append('div').attr('class', 'viz-formula');
    if (cfg.title) box.append('div').attr('class', 'viz-formula-title').text(cfg.title);
    (cfg.lines || []).forEach(l => box.append('div').text(l));
    if (cfg.hint) box.append('div').attr('class', 'viz-formula-hint').text(cfg.hint);
    return box;
  }

  /* ---- controls ----------------------------------------------
     controls(el, [{label, kind, onClick}])
     kind: 'primary' for the one action that advances the story,
     'ghost' for everything else. Labels say what happens:
     "Fill next vial", "New batch" — never "Submit" or "Go". */
  function controls(el, buttons) {
    const bar = el.append('div').attr('class', 'viz-controls');
    const handles = {};
    buttons.forEach(b => {
      handles[b.id || b.label] = bar.append('button')
        .attr('class', `viz-btn viz-btn--${b.kind || 'ghost'}`)
        .attr('type', 'button')
        .text(b.label)
        .on('click', b.onClick);
    });
    return handles;
  }

  /* ---- slider ------------------------------------------------
     slider(el, {sym, label, desc, min, max, step, value, format, onChange})
     One parameter: − button, range input, + button, value, and a
     short description underneath. Drag for big moves, click the
     buttons for one step. Returns {set(v), get(), node}; set()
     moves the control without calling onChange. Put several in a
     div.viz-params.viz-params--sliders so they line up in columns. */
  function slider(el, cfg) {
    const min = cfg.min, max = cfg.max, step = cfg.step || 1;
    const dp = (String(step).split('.')[1] || '').length;
    const fmt = cfg.format || (v => v.toFixed(dp).replace('-', '−'));
    const snap = v => +Math.min(max, Math.max(min, min + Math.round((v - min) / step) * step)).toFixed(dp);

    const row = el.append('div').attr('class', 'viz-param viz-param--slider');
    row.append('span').attr('class', 'k').text(cfg.sym || '');
    const dec = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `decrease ${cfg.label || cfg.sym}`).text('−');
    const input = row.append('input').attr('class', 'viz-range').attr('type', 'range')
      .attr('min', min).attr('max', max).attr('step', step)
      .attr('aria-label', cfg.label || cfg.sym);
    const inc = row.append('button').attr('class', 'viz-step').attr('type', 'button')
      .attr('aria-label', `increase ${cfg.label || cfg.sym}`).text('+');
    const val = row.append('span').attr('class', 'v').attr('aria-live', 'polite');
    if (cfg.desc) row.append('span').attr('class', 'd').text(cfg.desc);

    let value = snap(cfg.value ?? min);
    function show() {
      input.property('value', value);
      val.text(fmt(value));
      dec.property('disabled', value <= min);
      inc.property('disabled', value >= max);
    }
    function change(v) {
      const nv = snap(v);
      if (nv === value) { show(); return; }
      value = nv;
      show();
      if (cfg.onChange) cfg.onChange(value);
    }
    input.on('input', function () { change(+this.value); });
    dec.on('click', () => change(value - step));
    inc.on('click', () => change(value + step));
    show();

    return { set(v) { value = snap(v); show(); }, get: () => value, node: row };
  }

  /* ---- hover readout -----------------------------------------
     Attaches a transparent capture rect that reports the nearest
     datum index as the pointer moves. Used for the "hover the
     curve to see the numbers" behaviour. */
  function hoverIndex(p, xScale, n, onMove, onLeave) {
    p.g.append('rect')
      .attr('width', p.w).attr('height', p.h)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('pointermove', function (event) {
        const mx = d3.pointer(event, this)[0];
        const i = Math.max(0, Math.min(n - 1, Math.round(xScale.invert(mx)) - 1));
        onMove(i, mx);
      })
      .on('pointerleave', () => onLeave && onLeave());
  }

  /* ---- redraw on resize --------------------------------------
     mount(selector, renderFn) calls renderFn(width) now and again
     whenever the container changes width. */
  function mount(selector, render) {
    const node = document.querySelector(selector);
    if (!node) return;
    let last = 0;
    const run = () => {
      const w = node.clientWidth;
      if (Math.abs(w - last) < 8) return;
      last = w;
      render(w);
    };
    run();
    new ResizeObserver(run).observe(node);
  }

  return { C, dur, card, panel, axisX, axisY, refLine, annotate, formula, controls, slider, hoverIndex, mount };
})();