// Live time-series charts drawn on a canvas with no libraries.
// One small panel per measure (population, grass cover, then one per gene),
// all sharing the same time axis. Gene panels show the population mean as a
// line and +-1 standard deviation as a band. Hovering shows a crosshair and
// the values at that moment in every panel's header.

const COLORS = {
  surface: '#1a1a19',
  grid: 'rgba(255,255,255,0.08)',
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  textMuted: '#8d8c84',
  crosshair: 'rgba(255,255,255,0.4)',
};

// Series colours (dark-surface categorical steps), fixed per measure.
const SERIES = {
  population: '#3987e5',
  grass: '#199e70',
  speed: '#d95926',
  size: '#9085e9',
  vision: '#c98500',
};

export class Charts {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hoverX = null;
    this.history = null;
    this.geneDefs = null;

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.hoverX = e.clientX - r.left;
      this.draw();
    });
    canvas.addEventListener('mouseleave', () => {
      this.hoverX = null;
      this.draw();
    });
  }

  setData(history, geneDefs) {
    this.history = history;
    this.geneDefs = geneDefs;
  }

  // Match the backing store to the CSS size for crisp lines on HiDPI screens.
  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.canvas.getBoundingClientRect();
    this.width = r.width;
    this.height = r.height;
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  panels() {
    const list = [
      { key: 'population', title: 'Rabbits', get: (s) => s.species.rabbit.count, fmt: (v) => v.toFixed(0), zero: true },
      { key: 'grass', title: 'Grass cover', get: (s) => s.grass * 100, fmt: (v) => v.toFixed(0) + '%', zero: true },
    ];
    for (const [g, d] of Object.entries(this.geneDefs)) {
      list.push({
        key: g,
        title: `Avg ${d.label.toLowerCase()}`,
        get: (s) => s.species.rabbit.genes[g].mean,
        sd: (s) => s.species.rabbit.genes[g].sd,
        fmt: (v) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)),
      });
    }
    return list;
  }

  draw() {
    if (!this.history || !this.width) return;
    const ctx = this.ctx;
    const W = this.width, H = this.height;
    ctx.fillStyle = COLORS.surface;
    ctx.fillRect(0, 0, W, H);

    const samples = this.history.samples;
    const panels = this.panels();
    const padL = 40, padR = 10, gap = 8;
    const panelH = (H - gap * (panels.length + 1)) / panels.length;
    const plotW = W - padL - padR;
    const n = samples.length;
    const xAt = (i) => padL + (n <= 1 ? plotW : (i / (n - 1)) * plotW);

    // Index of the sample under the mouse, if any.
    let hi = null;
    if (this.hoverX !== null && n > 0 && this.hoverX >= padL) {
      hi = Math.round(((this.hoverX - padL) / plotW) * (n - 1));
      hi = Math.max(0, Math.min(n - 1, hi));
    }

    panels.forEach((p, k) => {
      const top = gap + k * (panelH + gap);
      const headerH = 16;
      const y0 = top + headerH, h = panelH - headerH;

      // Value range
      let lo = Infinity, hiV = -Infinity;
      for (const s of samples) {
        const v = p.get(s);
        if (!Number.isFinite(v)) continue;
        const sd = p.sd ? p.sd(s) || 0 : 0;
        lo = Math.min(lo, v - sd);
        hiV = Math.max(hiV, v + sd);
      }
      if (!Number.isFinite(lo)) { lo = 0; hiV = 1; }
      if (p.zero) lo = 0;
      if (hiV - lo < 1e-6) { hiV += 0.5; lo = p.zero ? 0 : lo - 0.5; }
      const pad = (hiV - lo) * 0.08;
      if (!p.zero) lo -= pad;
      hiV += pad;
      const yAt = (v) => y0 + h - ((v - lo) / (hiV - lo)) * h;

      // Grid and axis labels
      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y0 + 0.5); ctx.lineTo(W - padR, y0 + 0.5);
      ctx.moveTo(padL, y0 + h - 0.5); ctx.lineTo(W - padR, y0 + h - 0.5);
      ctx.stroke();
      ctx.fillStyle = COLORS.textMuted;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.fmt(hiV), padL - 4, y0 + 4);
      ctx.fillText(p.fmt(lo), padL - 4, y0 + h - 4);

      // Standard deviation band
      if (p.sd && n > 1) {
        ctx.fillStyle = SERIES[p.key] + '33';
        ctx.beginPath();
        let started = false;
        for (let i = 0; i < n; i++) {
          const v = p.get(samples[i]);
          if (!Number.isFinite(v)) continue;
          const y = yAt(v + (p.sd(samples[i]) || 0));
          started ? ctx.lineTo(xAt(i), y) : ctx.moveTo(xAt(i), y);
          started = true;
        }
        for (let i = n - 1; i >= 0; i--) {
          const v = p.get(samples[i]);
          if (!Number.isFinite(v)) continue;
          ctx.lineTo(xAt(i), yAt(v - (p.sd(samples[i]) || 0)));
        }
        ctx.closePath();
        ctx.fill();
      }

      // Mean / value line
      ctx.strokeStyle = SERIES[p.key];
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const v = p.get(samples[i]);
        if (!Number.isFinite(v)) { started = false; continue; }
        started ? ctx.lineTo(xAt(i), yAt(v)) : ctx.moveTo(xAt(i), yAt(v));
        started = true;
      }
      ctx.stroke();

      // Header: title on the left, value (current or hovered) on the right
      const idx = hi !== null ? hi : n - 1;
      const s = samples[idx];
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(p.title, padL, top + 11);
      if (s) {
        const v = p.get(s);
        let label = Number.isFinite(v) ? p.fmt(v) : '-';
        if (p.sd && Number.isFinite(v)) label += ` ± ${p.fmt(p.sd(s) || 0)}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = COLORS.textPrimary;
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillText(label, W - padR, top + 11);

        if (hi !== null) {
          ctx.fillStyle = SERIES[p.key];
          ctx.beginPath();
          ctx.arc(xAt(hi), yAt(v), 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = COLORS.surface;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    });

    // Crosshair and tick label
    if (hi !== null) {
      const x = Math.round(xAt(hi)) + 0.5;
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, gap);
      ctx.lineTo(x, H - gap);
      ctx.stroke();
      const label = `tick ${samples[hi].tick}`;
      ctx.font = '10px system-ui, sans-serif';
      const tw = ctx.measureText(label).width + 8;
      const lx = Math.min(Math.max(x - tw / 2, padL), W - padR - tw);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(lx, H - 18, tw, 15);
      ctx.fillStyle = COLORS.textPrimary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx + 4, H - 10.5);
    }
  }
}
