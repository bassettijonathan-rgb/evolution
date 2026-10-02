// Seeded pseudo-random number generator (mulberry32).
// Every random decision in the simulation goes through one RNG instance so a
// run is fully reproducible from its seed.

// Hash any string into a 32-bit unsigned seed (cyrb53-style mixing).
export function hashSeed(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export class RNG {
  constructor(seed) {
    this.state = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0;
    this._spare = null; // cached second value from the Box-Muller transform
  }

  // Uniform float in [0, 1).
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  int(n) {
    return Math.floor(this.next() * n);
  }

  chance(p) {
    return this.next() < p;
  }

  // Standard normal sample (mean 0, std dev 1).
  gaussian() {
    if (this._spare !== null) {
      const s = this._spare;
      this._spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const mag = Math.sqrt(-2 * Math.log(u));
    this._spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  }

  // Serialisable state, for save/load in a later phase.
  getState() {
    return { state: this.state, spare: this._spare };
  }

  setState(s) {
    this.state = s.state >>> 0;
    this._spare = s.spare;
  }
}
