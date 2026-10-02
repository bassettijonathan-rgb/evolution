// Genes are plain objects mapping gene name -> number, e.g.
//   { speed: 1.5, size: 1.0, vision: 40 }
// Each species declares its gene definitions (bounds, initial mean, label) in
// config.js, so new species and new genes need no changes here.

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Founder genes: the configured initial value, jittered by +-spread of the range.
export function initialGenes(defs, rng, spread) {
  const genes = {};
  for (const [name, d] of Object.entries(defs)) {
    const jitter = (rng.next() * 2 - 1) * spread * (d.max - d.min);
    genes[name] = clamp(d.initial + jitter, d.min, d.max);
  }
  return genes;
}

// Child genes: copy each parent gene; with probability `mutation.rate` add a
// normally distributed change with std dev `mutation.size * range`.
export function mutateGenes(parent, defs, rng, mutation) {
  const genes = {};
  for (const [name, d] of Object.entries(defs)) {
    let v = parent[name];
    if (rng.chance(mutation.rate)) {
      v += rng.gaussian() * mutation.size * (d.max - d.min);
    }
    genes[name] = clamp(v, d.min, d.max);
  }
  return genes;
}

// Position of a gene inside its range, 0..1 (used for colouring).
export function normalizedGene(value, def) {
  return (value - def.min) / (def.max - def.min);
}
