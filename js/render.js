// Draws the world onto the main canvas.
// Grass is painted into a tiny offscreen canvas (one pixel per cell) and scaled
// up, which is far cheaper than filling thousands of rectangles.
// Animals: hue = speed (blue slow -> red fast), radius = size,
// lightness = vision (pale = far-sighted).

import { normalizedGene } from './genes.js';

const DIRT = [58, 46, 33];
const GRASS = [70, 150, 60];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.grassCanvas = null;
  }

  // Must be called after every world reset (the grid size may change).
  attach(world) {
    this.world = world;
    const { width, height } = world.config.world;
    this.canvas.width = width;
    this.canvas.height = height;
    const g = world.grass;
    this.grassCanvas = document.createElement('canvas');
    this.grassCanvas.width = g.cols;
    this.grassCanvas.height = g.rows;
    this.grassCtx = this.grassCanvas.getContext('2d');
    this.grassImage = this.grassCtx.createImageData(g.cols, g.rows);
  }

  draw(selected) {
    const ctx = this.ctx;
    const w = this.world;
    this.drawGrass();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.grassCanvas, 0, 0, this.canvas.width, this.canvas.height);

    const defs = w.config.rabbit.genes;
    for (const a of w.animals) {
      const hue = 240 - 240 * normalizedGene(a.genes.speed, defs.speed);
      const light = 42 + 30 * normalizedGene(a.genes.vision, defs.vision);
      ctx.fillStyle = `hsl(${hue.toFixed(0)}, 85%, ${light.toFixed(0)}%)`;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    if (selected && selected.alive) this.drawSelection(selected);
  }

  drawGrass() {
    const g = this.world.grass;
    const data = this.grassImage.data;
    const max = g.cfg.max;
    for (let i = 0; i < g.count; i++) {
      const t = g.amount[i] / max;
      const p = i * 4;
      data[p] = DIRT[0] + (GRASS[0] - DIRT[0]) * t;
      data[p + 1] = DIRT[1] + (GRASS[1] - DIRT[1]) * t;
      data[p + 2] = DIRT[2] + (GRASS[2] - DIRT[2]) * t;
      data[p + 3] = 255;
    }
    this.grassCtx.putImageData(this.grassImage, 0, 0);
  }

  drawSelection(a) {
    const ctx = this.ctx;
    ctx.save();
    // Vision radius
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.genes.vision, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Line to the food it is walking to
    if (a.target >= 0) {
      const g = this.world.grass;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(g.centerX(a.target), g.centerY(a.target));
      ctx.stroke();
    }
    // Ring around the animal
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}
