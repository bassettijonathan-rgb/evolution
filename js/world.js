// The World owns the full simulation state and advances it one tick at a time.
// It has no DOM dependencies, so it runs unchanged in Node (tools/headless.mjs).

import { RNG } from './rng.js';
import { Grass } from './grass.js';
import { SpatialHash } from './spatial.js';
import { SPECIES } from './animal.js';
import { initialGenes } from './genes.js';
import { StatsHistory } from './stats.js';

export class World {
  constructor(config, seed) {
    this.config = structuredClone(config);
    this.seed = String(seed);
    this.rng = new RNG(this.seed);
    this.tick = 0;
    this.nextId = 1;
    this.animals = [];
    this.newborns = [];

    const { width, height } = this.config.world;
    this.grass = new Grass(this.config.grass, width, height, this.rng);
    this.spatial = new SpatialHash(width, height, 25);

    this.totals = { births: 0, deaths: { starvation: 0, 'old age': 0 }, maxGeneration: 0 };
    this.stats = new StatsHistory(this.config.stats, {
      rabbit: Object.keys(this.config.rabbit.genes),
    });

    this.populate('rabbit', this.config.rabbit.initialCount);
    this.spatial.rebuild(this.animals);
    this.stats.record(this);
  }

  populate(species, count) {
    const cfg = this.config[species];
    const { width, height } = this.config.world;
    for (let i = 0; i < count; i++) {
      const genes = initialGenes(cfg.genes, this.rng, cfg.initialSpread);
      const a = this.createAnimal(species, this.rng.range(0, width), this.rng.range(0, height), genes, 0, 0, null);
      a.energy = a.maxEnergy * cfg.startEnergyFraction;
      a.age = this.rng.int(cfg.maturityAge); // stagger founders so they don't breed in lockstep
      a.cooldown = cfg.maturityAge - a.age;
      this.animals.push(a);
    }
  }

  createAnimal(species, x, y, genes, energy, generation, parentId) {
    const Ctor = SPECIES[species];
    return new Ctor(this, species, x, y, genes, energy, generation, parentId);
  }

  // Called by animals when they reproduce. Children join at the end of the tick.
  spawn(species, x, y, genes, energy, generation, parentId) {
    if (this.animals.length + this.newborns.length >= this.config.maxAnimals) return null;
    const child = this.createAnimal(species, x, y, genes, energy, generation, parentId);
    this.newborns.push(child);
    this.totals.births++;
    if (generation > this.totals.maxGeneration) this.totals.maxGeneration = generation;
    return child;
  }

  recordDeath(animal, cause) {
    this.totals.deaths[cause] = (this.totals.deaths[cause] || 0) + 1;
  }

  step() {
    this.tick++;
    this.grass.update();

    for (const a of this.animals) {
      if (a.alive) a.update();
    }

    if (this.newborns.length) {
      for (const c of this.newborns) this.animals.push(c);
      this.newborns.length = 0;
    }
    this.animals = this.animals.filter((a) => a.alive);
    this.spatial.rebuild(this.animals);
    this.stats.record(this);
  }

  count(species) {
    let n = 0;
    for (const a of this.animals) if (a.species === species) n++;
    return n;
  }

  // Animal closest to (x, y) within `radius`, for click selection.
  animalAt(x, y, radius = 12) {
    return this.spatial.nearest(x, y, radius);
  }
}
