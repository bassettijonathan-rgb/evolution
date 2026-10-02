// Live time-series charts drawn on a canvas with no libraries.
// Small panels stacked on a shared time axis: rabbit count, fox count, grass
// cover, then one panel per gene. Gene panels plot rabbits and foxes on the
// same scale, so an arms race (say, both speeds climbing) is visible directly.
// Lines are population means; the shaded bands are +-1 standard deviation.
// Hovering shows a crosshair and the values at that moment in each header.

const COLORS = {
  surface: '#1a1a19',
  grid: 'rgba(255,255,255,0.08)',
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  textMuted: '#8d8c84',
  crosshair: 'rgba(255,255,255,0.4)',
};

// Colour follows the entity: the same species keeps the same colour in every panel.
export const SPECIES_COLORS = {
  rabbit: '#3987e5',
  fox: '#d95926',
  grass: '#199e70',
};

const SPECIES_LABELS = { rabbit: 'Rabbits', fox: 'Foxes' };

const LEGEND_H = 22;

export class Charts {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hoverX = null;
    this.history = null;
    this.config = null;

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

  // `config` is the world's config; gene panels come from its species blocks.
  setData(history, config) {
    this.history = history;
    this.config = config;
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
    const species = Object.keys(this.history.speciesGenes);
    const count = (sp) => (s) => s.species[sp].count;
    const list = species.map((sp) => ({
      title: SPECIES_LABELS[sp] || sp,
      series: [{ color: SPECIES_COLORS[sp], get: count(sp) }],
      fmt: (v) => v.toFixed(0),
      zero: true,
    }));
    list.push({
      title: 'Grass cover',
      series: [{ color: SPECIES_COLORS.grass, get: (s) => s.grass * 100 }],
      fmt: (v) => v.toFixed(0) + '%',
      zero: true,
    });

    // One panel per gene name, with a series for each species that has it.
    const genes = [];
    for (const sp of species) for (const g of this.history.speciesGenes[sp]) if (!genes.includes(g)) genes.push(g);
    for (const g of genes) {
      const owners = species.filter((sp) => this.history.speciesGenes[sp].includes(g));
      const label = this.config[owners[0]].genes[g].label;
      list.push({
        title: `Avg ${label.toLowerCase()}`,
        series: owners.map((sp) => ({
          color: SPECIES_COLORS[sp],
          get: (s) => s.species[sp].genes[g].mean,
          sd: (s) => s.species[sp].genes[g].sd,
        })),
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
    const top0 = LEGEND_H;
    const panelH = (H - top0 - gap * panels.length) / panels.length;
    const plotW = W - padL - padR;
    const n = samples.length;
    const xAt = (i) => padL + (n <= 1 ? plotW : (i / (n - 1)) * plotW);

    this.drawLegend(padL);

    // Index of the sample under the mouse, if any.
    let hi = null;
    if (this.hoverX !== null && n > 0 && this.hoverX >= padL) {
      hi = Math.round(((this.hoverX - padL) / plotW) * (n - 1));
      hi = Math.max(0, Math.min(n - 1, hi));
    }

    panels.forEach((p, k) => {
      const top = top0 + k * (panelH + gap);
      const headerH = 16;
      const y0 = top + headerH, h = panelH - headerH;

      // Value range across all series in the panel
      let lo = Infinity, hiV = -Infinity;
      for (const ser of p.series) {
        for (const s of samples) {
          const v = ser.get(s);
          if (!Number.isFinite(v)) continue;
          const sd = ser.sd ? ser.sd(s) || 0 : 0;
          lo = Math.min(lo, v - sd);
          hiV = Math.max(hiV, v + sd);
        }
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

      for (const ser of p.series) this.drawSeries(ser, samples, xAt, yAt);

      // Header: title on the left, values (current or hovered) on the right
      const idx = hi !== null ? hi : n - 1;
      const s = samples[idx];
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textSecondary;
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(p.title, padL, top + 11);
      if (s) {
        let x = W - padR;
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.textAlign = 'right';
        for (let j = p.series.length - 1; j >= 0; j--) {
          const ser = p.series[j];
          const v = ser.get(s);
          let label = Number.isFinite(v) ? p.fmt(v) : '–';
          if (ser.sd && Number.isFinite(v)) label += ` ±${p.fmt(ser.sd(s) || 0)}`;
          ctx.fillStyle = COLORS.textPrimary;
          ctx.fillText(label, x, top + 11);
          x -= ctx.measureText(label).width + 4;
          if (p.series.length > 1) {
            ctx.fillStyle = ser.color;
            ctx.fillRect(x - 7, top + 4, 7, 7);
            x -= 15;
          }

          if (hi !== null && Number.isFinite(v)) {
            ctx.fillStyle = ser.color;
            ctx.beginPath();
            ctx.arc(xAt(hi), yAt(v), 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = COLORS.surface;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
    });

    // Crosshair and tick label
    if (hi !== null) {
      const x = Math.round(xAt(hi)) + 0.5;
      ctx.strokeStyle = COLORS.crosshair;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top0);
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

  drawLegend(x) {
    const ctx = this.ctx;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (const sp of Object.keys(this.history.speciesGenes)) {
      ctx.fillStyle = SPECIES_COLORS[sp];
      ctx.fillRect(x, 8, 10, 10);
      ctx.fillStyle = COLORS.textSecondary;
      const label = SPECIES_LABELS[sp] || sp;
      ctx.fillText(label, x + 14, 13.5);
      x += 14 + ctx.measureText(label).width + 16;
    }
  }

  drawSeries(ser, samples, xAt, yAt) {
    const ctx = this.ctx;
    const n = samples.length;

    // Standard deviation band, drawn per unbroken run of samples
    if (ser.sd && n > 1) {
      ctx.fillStyle = ser.color + '30';
      let i = 0;
      while (i < n) {
        while (i < n && !Number.isFinite(ser.get(samples[i]))) i++;
        const start = i;
        while (i < n && Number.isFinite(ser.get(samples[i]))) i++;
        if (i - start < 2) continue;
        ctx.beginPath();
        for (let j = start; j < i; j++) {
          const y = yAt(ser.get(samples[j]) + (ser.sd(samples[j]) || 0));
          j === start ? ctx.moveTo(xAt(j), y) : ctx.lineTo(xAt(j), y);
        }
        for (let j = i - 1; j >= start; j--) {
          ctx.lineTo(xAt(j), yAt(ser.get(samples[j]) - (ser.sd(samples[j]) || 0)));
        }
        ctx.closePath();
        ctx.fill();
      }
    }

    // Mean / value line
    ctx.strokeStyle = ser.color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < n; i++) {
      const v = ser.get(samples[i]);
      if (!Number.isFinite(v)) { started = false; continue; }
      started ? ctx.lineTo(xAt(i), yAt(v)) : ctx.moveTo(xAt(i), yAt(v));
      started = true;
    }
    ctx.stroke();
  }
}
