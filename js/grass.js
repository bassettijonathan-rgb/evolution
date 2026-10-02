// Grass lives on a grid of cells. Each cell holds an amount in [0, max] that
// regrows every tick. A per-cell fertility multiplier is already in place so
// terrain (phase 3) can make some areas lusher than others, and a global
// growth multiplier lets seasons scale growth.

import { clamp } from './genes.js';

export class Grass {
  constructor(cfg, width, height, rng) {
    this.cfg = cfg;
    this.cellSize = cfg.cellSize;
    this.cols = Math.ceil(width / cfg.cellSize);
    this.rows = Math.ceil(height / cfg.cellSize);
    this.count = this.cols * this.rows;
    this.amount = new Float32Array(this.count);
    this.fertility = new Float32Array(this.count).fill(1);
    this.growthMultiplier = 1;

    for (let i = 0; i < this.count; i++) {
      this.amount[i] = clamp(cfg.initial + (rng.next() - 0.5) * 0.4, 0, 1) * cfg.max;
    }
  }

  update() {
    const max = this.cfg.max;
    const g = this.cfg.growthRate * this.growthMultiplier;
    const a = this.amount;
    const f = this.fertility;
    for (let i = 0; i < this.count; i++) {
      const v = a[i] + g * f[i];
      a[i] = v > max ? max : v;
    }
  }

  indexAt(x, y) {
    const cx = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const cy = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    return cy * this.cols + cx;
  }

  centerX(idx) {
    return ((idx % this.cols) + 0.5) * this.cellSize;
  }

  centerY(idx) {
    return (Math.floor(idx / this.cols) + 0.5) * this.cellSize;
  }

  // Remove up to `want` grass from a cell; returns the amount actually eaten.
  eat(idx, want) {
    const got = Math.min(this.amount[idx], want);
    this.amount[idx] -= got;
    return got;
  }

  // Nearest cell (by distance to its centre) within `radius` that holds at
  // least `minAmount`. Searches outward ring by ring and stops as soon as no
  // further ring can contain anything closer. Returns a cell index or -1.
  findNearest(x, y, radius, minAmount) {
    const cs = this.cellSize;
    const cx0 = clamp(Math.floor(x / cs), 0, this.cols - 1);
    const cy0 = clamp(Math.floor(y / cs), 0, this.rows - 1);
    const maxRing = Math.ceil(radius / cs);
    const r2 = radius * radius;
    let best = -1;
    let bestD2 = Infinity;

    for (let ring = 0; ring <= maxRing; ring++) {
      const y0 = cy0 - ring, y1 = cy0 + ring;
      const x0 = cx0 - ring, x1 = cx0 + ring;
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= this.rows) continue;
        const edgeRow = cy === y0 || cy === y1;
        const step = edgeRow ? 1 : x1 - x0 || 1;
        for (let cx = x0; cx <= x1; cx += step) {
          if (cx < 0 || cx >= this.cols) continue;
          const idx = cy * this.cols + cx;
          if (this.amount[idx] < minAmount) continue;
          const dx = (cx + 0.5) * cs - x;
          const dy = (cy + 0.5) * cs - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2 && d2 < bestD2) {
            bestD2 = d2;
            best = idx;
          }
        }
      }
      // Every cell centre in ring+1 is at least (ring + 0.5) cells away.
      if (best >= 0) {
        const limit = (ring + 0.5) * cs;
        if (bestD2 <= limit * limit) break;
      }
    }
    return best;
  }

  // Average fill of all cells, 0..1.
  coverage() {
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.amount[i];
    return sum / (this.count * this.cfg.max);
  }
}
