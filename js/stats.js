// Time series recorded for the charts. Every `sampleEvery` ticks we store the
// population and the mean and standard deviation of every gene, per species.
// When the history grows beyond `maxSamples`, neighbouring samples are
// averaged in pairs and the sampling interval doubles, so memory stays bounded
// while the whole run remains visible.

export class StatsHistory {
  constructor(cfg, speciesGenes) {
    this.maxSamples = cfg.maxSamples;
    this.interval = cfg.sampleEvery;
    this.speciesGenes = speciesGenes; // { rabbit: ['speed', 'size', 'vision'] }
    this.samples = [];
    this.pending = null; // accumulates ticks between samples after downsampling
  }

  record(world) {
    if (world.tick % this.interval !== 0) return;

    const sample = { tick: world.tick, grass: world.grass.coverage(), species: {} };
    for (const [sp, genes] of Object.entries(this.speciesGenes)) {
      const animals = world.animals.filter((a) => a.alive && a.species === sp);
      const n = animals.length;
      const entry = { count: n, genes: {} };
      for (const g of genes) {
        let sum = 0, sum2 = 0;
        for (const a of animals) {
          const v = a.genes[g];
          sum += v;
          sum2 += v * v;
        }
        const mean = n ? sum / n : NaN;
        const sd = n ? Math.sqrt(Math.max(0, sum2 / n - mean * mean)) : NaN;
        entry.genes[g] = { mean, sd };
      }
      sample.species[sp] = entry;
    }
    this.samples.push(sample);

    if (this.samples.length > this.maxSamples) this.downsample();
  }

  downsample() {
    const out = [];
    for (let i = 0; i + 1 < this.samples.length; i += 2) {
      out.push(mergeSamples(this.samples[i], this.samples[i + 1]));
    }
    if (this.samples.length % 2) out.push(this.samples[this.samples.length - 1]);
    this.samples = out;
    this.interval *= 2;
  }

  latest() {
    return this.samples[this.samples.length - 1] || null;
  }
}

function avg(a, b) {
  if (Number.isNaN(a)) return b;
  if (Number.isNaN(b)) return a;
  return (a + b) / 2;
}

function mergeSamples(a, b) {
  const m = { tick: b.tick, grass: (a.grass + b.grass) / 2, species: {} };
  for (const sp of Object.keys(a.species)) {
    const ea = a.species[sp], eb = b.species[sp];
    const genes = {};
    for (const g of Object.keys(ea.genes)) {
      genes[g] = { mean: avg(ea.genes[g].mean, eb.genes[g].mean), sd: avg(ea.genes[g].sd, eb.genes[g].sd) };
    }
    m.species[sp] = { count: (ea.count + eb.count) / 2, genes };
  }
  return m;
}
