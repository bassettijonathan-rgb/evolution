// Uniform-grid spatial hash for fast "who is near (x, y)?" queries.
// The world is bounded, so buckets are a flat array rather than a Map.
// It is rebuilt every tick; in phase 2 predators and prey use it to find each
// other, and the UI uses it to pick the animal under the mouse.

export class SpatialHash {
  constructor(width, height, cellSize) {
    this.cellSize = cellSize;
    this.cols = Math.max(1, Math.ceil(width / cellSize));
    this.rows = Math.max(1, Math.ceil(height / cellSize));
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (const b of this.buckets) b.length = 0;
  }

  _cell(v, n) {
    const c = Math.floor(v / this.cellSize);
    return c < 0 ? 0 : c >= n ? n - 1 : c;
  }

  insert(obj) {
    const cx = this._cell(obj.x, this.cols);
    const cy = this._cell(obj.y, this.rows);
    this.buckets[cy * this.cols + cx].push(obj);
  }

  rebuild(objects) {
    this.clear();
    for (const o of objects) if (o.alive) this.insert(o);
  }

  // Calls fn(obj, distSq) for every object within radius r of (x, y).
  forEachInRadius(x, y, r, fn) {
    const r2 = r * r;
    const x0 = this._cell(x - r, this.cols), x1 = this._cell(x + r, this.cols);
    const y0 = this._cell(y - r, this.rows), y1 = this._cell(y + r, this.rows);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        for (const o of this.buckets[cy * this.cols + cx]) {
          const dx = o.x - x, dy = o.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) fn(o, d2);
        }
      }
    }
  }

  // Nearest object within radius r that passes the optional filter, or null.
  nearest(x, y, r, filter) {
    let best = null;
    let bestD2 = Infinity;
    this.forEachInRadius(x, y, r, (o, d2) => {
      if (d2 < bestD2 && (!filter || filter(o))) {
        best = o;
        bestD2 = d2;
      }
    });
    return best;
  }
}
