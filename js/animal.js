// Animals. The base class handles what every species shares: energy, ageing,
// death, movement and reproduction with mutation. Subclasses decide what to do
// each tick in think(). Phase 2 adds a Fox subclass next to Rabbit.

import { mutateGenes } from './genes.js';

export class Animal {
  // `species` is the key into the config (e.g. 'rabbit').
  constructor(world, species, x, y, genes, energy, generation, parentId) {
    this.world = world;
    this.species = species;
    this.cfg = world.config[species];
    this.id = world.nextId++;
    this.x = x;
    this.y = y;
    this.heading = world.rng.next() * Math.PI * 2;
    this.genes = genes;
    this.generation = generation;
    this.parentId = parentId;
    this.birthTick = world.tick;
    this.age = 0;
    this.maxAge = Math.round(this.cfg.maxAge * (1 + (world.rng.next() * 2 - 1) * this.cfg.maxAgeJitter));
    this.alive = true;
    this.causeOfDeath = null;
    this.children = 0;
    this.cooldown = this.cfg.maturityAge;
    this.state = 'wander';

    this.computeTraits();
    this.energy = Math.min(energy, this.maxEnergy);
  }

  // Derived values that depend only on genes, computed once at birth.
  computeTraits() {
    const { speed, size, vision } = this.genes;
    const c = this.cfg.cost;
    const s3 = size * size * size;
    this.maxEnergy = this.cfg.maxEnergyPerSize3 * s3;
    this.costPerTick = c.base + c.k1 * s3 * speed * speed + c.k2 * vision + c.k3 * s3;
    this.radius = 2 + 2.2 * size;
  }

  update() {
    this.age++;
    this.energy -= this.costPerTick;
    if (this.energy <= 0) return this.die('starvation');
    if (this.age >= this.maxAge) return this.die('old age');

    this.think();

    if (this.cooldown > 0) this.cooldown--;
    if (this.cooldown <= 0 && this.energy >= this.cfg.reproThreshold * this.maxEnergy) {
      this.reproduce();
    }
  }

  // Species behaviour; overridden by subclasses.
  think() {
    this.wander();
  }

  die(cause) {
    this.alive = false;
    this.causeOfDeath = cause;
    this.world.recordDeath(this, cause);
  }

  wander() {
    this.state = 'wander';
    this.heading += this.world.rng.gaussian() * this.cfg.wanderTurn;
    this.moveBy(Math.cos(this.heading) * this.genes.speed, Math.sin(this.heading) * this.genes.speed);
  }

  // Move toward (tx, ty) at full speed without overshooting.
  moveToward(tx, ty) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d <= this.genes.speed) {
      this.x = tx;
      this.y = ty;
      return;
    }
    this.heading = Math.atan2(dy, dx);
    this.moveBy((dx / d) * this.genes.speed, (dy / d) * this.genes.speed);
  }

  // Move with reflection off the world edges.
  moveBy(dx, dy) {
    const { width, height } = this.world.config.world;
    let x = this.x + dx, y = this.y + dy;
    if (x < 0) { x = -x; this.heading = Math.PI - this.heading; }
    else if (x > width) { x = 2 * width - x; this.heading = Math.PI - this.heading; }
    if (y < 0) { y = -y; this.heading = -this.heading; }
    else if (y > height) { y = 2 * height - y; this.heading = -this.heading; }
    this.x = x;
    this.y = y;
  }

  reproduce() {
    const w = this.world;
    const cfg = this.cfg;
    const given = this.energy * cfg.childEnergyFraction;
    this.energy -= given;
    this.cooldown = cfg.reproCooldown;
    this.children++;

    const genes = mutateGenes(this.genes, cfg.genes, w.rng, w.config.mutation);
    const angle = w.rng.next() * Math.PI * 2;
    const r = this.radius * 2;
    const { width, height } = w.config.world;
    const x = Math.min(width, Math.max(0, this.x + Math.cos(angle) * r));
    const y = Math.min(height, Math.max(0, this.y + Math.sin(angle) * r));
    w.spawn(this.species, x, y, genes, given * cfg.birthEfficiency, this.generation + 1, this.id);
  }
}

export class Rabbit extends Animal {
  constructor(...args) {
    super(...args);
    this.target = -1;        // grass cell index being walked to, or -1
    this.searchCooldown = 0;
  }

  think() {
    const grass = this.world.grass;
    const gcfg = this.world.config.grass;
    const here = grass.indexAt(this.x, this.y);

    // Graze if the current cell has enough grass.
    if (grass.amount[here] >= gcfg.minToEat) {
      this.state = 'eat';
      this.target = -1;
      const room = (this.maxEnergy - this.energy) / gcfg.energy;
      const bite = Math.min(this.cfg.bitePerSize2 * this.genes.size * this.genes.size, room);
      if (bite > 0) this.energy += grass.eat(here, bite) * gcfg.energy;
      return;
    }

    // Drop the target if someone else ate it.
    if (this.target >= 0 && grass.amount[this.target] < gcfg.minToEat) this.target = -1;

    // Look for food within vision.
    if (this.target < 0) {
      if (this.searchCooldown > 0) {
        this.searchCooldown--;
      } else {
        this.target = grass.findNearest(this.x, this.y, this.genes.vision, gcfg.minToEat);
        if (this.target < 0) this.searchCooldown = this.cfg.searchCooldown;
      }
    }

    if (this.target >= 0) {
      this.state = 'seek';
      this.moveToward(grass.centerX(this.target), grass.centerY(this.target));
    } else {
      this.wander();
    }
  }
}

// Registry used by World.spawn(); phase 2 adds `fox: Fox`.
export const SPECIES = {
  rabbit: Rabbit,
};
