// Animals. The base class handles what every species shares: energy, ageing,
// death, movement and reproduction with mutation. Subclasses decide what to do
// each tick in think(): rabbits graze and flee, foxes hunt rabbits.

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
    this.radius = this.cfg.radiusBase + this.cfg.radiusPerSize * size;
  }

  update() {
    this.age++;
    this.energy -= this.costPerTick;
    if (this.energy <= 0) return this.die('starvation');
    if (this.age >= this.maxAge) return this.die('old age');

    this.think();

    if (this.cooldown > 0) this.cooldown--;
    if (this.cooldown <= 0 && this.energy >= this.cfg.reproThreshold * this.maxEnergy && this.canBreed()) {
      this.reproduce();
    }
  }

  // Extra breeding conditions; overridden by subclasses.
  canBreed() {
    return true;
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
    this.hunter = null;      // fox currently chasing this rabbit
    this.searchCooldown = 0;
  }

  // Run directly away from the threat, steering off walls.
  flee(threat) {
    const { width, height } = this.world.config.world;
    let dx = this.x - threat.x, dy = this.y - threat.y;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    if (this.x < WALL_MARGIN) dx += 1 - this.x / WALL_MARGIN;
    else if (this.x > width - WALL_MARGIN) dx -= 1 - (width - this.x) / WALL_MARGIN;
    if (this.y < WALL_MARGIN) dy += 1 - this.y / WALL_MARGIN;
    else if (this.y > height - WALL_MARGIN) dy -= 1 - (height - this.y) / WALL_MARGIN;
    this.heading = Math.atan2(dy, dx) + this.world.rng.gaussian() * 0.15;
    this.moveBy(Math.cos(this.heading) * this.genes.speed, Math.sin(this.heading) * this.genes.speed);
  }

  think() {
    // Fleeing beats eating: run from the nearest hunting fox in sight.
    // Resting or well-fed foxes are ignored, as real prey learn to do.
    const fox = this.world.spatial.fox.nearest(this.x, this.y, this.genes.vision, isHunting);
    if (fox) {
      this.state = 'flee';
      this.target = -1;
      this.flee(fox);
      return;
    }

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

// Push away from walls when within this distance, so fleeing rabbits run
// along an edge instead of into a corner.
const WALL_MARGIN = 30;
export class Fox extends Animal {
  constructor(...args) {
    super(...args);
    this.prey = null;      // rabbit being chased
    this.chaseTicks = 0;
    this.rest = 0;         // ticks left standing still (digesting or tired)
    this.kills = 0;
  }

  think() {
    const cfg = this.cfg;
    const w = this.world;

    if (this.rest > 0) {
      this.rest--;
      this.state = 'rest';
      return;
    }

    // A well-fed fox does not hunt.
    if (this.energy >= cfg.huntBelow * this.maxEnergy) {
      this.dropPrey();
      this.wander();
      return;
    }

    // Keep chasing the current prey while it is alive and in sight;
    // otherwise pick the nearest rabbit within vision.
    const p = this.prey;
    if (!p || !p.alive || dist2(this, p) > this.genes.vision * this.genes.vision) {
      if (p && p.hunter === this) p.hunter = null;
      // Ignore rabbits another fox is already chasing.
      this.prey = w.spatial.rabbit.nearest(this.x, this.y, this.genes.vision,
        (r) => r.alive && (!r.hunter || r.hunter === this || !r.hunter.alive));
      if (this.prey) this.prey.hunter = this;
      this.chaseTicks = 0;
    }
    if (!this.prey) {
      this.wander();
      return;
    }

    this.state = 'hunt';
    const prey = this.prey;
    this.moveToward(prey.x, prey.y);
    this.chaseTicks++;

    const reach = this.radius + prey.radius + cfg.reach;
    if (dist2(this, prey) <= reach * reach) {
      const p = Math.min(1, cfg.catchBase * this.genes.size / prey.genes.size);
      if (w.rng.chance(p)) {
        const gain = cfg.meatPerSize3 * prey.genes.size ** 3 + cfg.energyTransfer * Math.max(0, prey.energy);
        prey.die('eaten');
        this.energy = Math.min(this.maxEnergy, this.energy + gain);
        this.kills++;
        this.rest = cfg.digestTicks;
      } else {
        this.rest = cfg.missRest;
      }
      this.dropPrey();
    } else if (this.chaseTicks > cfg.maxChase) {
      this.dropPrey();
      this.rest = cfg.tiredRest;
    }
  }

  dropPrey() {
    if (this.prey && this.prey.hunter === this) this.prey.hunter = null;
    this.prey = null;
  }

  canBreed() {
    let neighbours = 0;
    this.world.spatial.fox.forEachInRadius(this.x, this.y, this.cfg.territoryRadius, (f) => {
      if (f !== this && f.alive) neighbours++;
    });
    return neighbours <= this.cfg.maxNeighbours;
  }

  die(cause) {
    this.dropPrey();
    super.die(cause);
  }
}

function isHunting(f) {
  return f.alive && f.state === 'hunt';
}

function isAlive(a) {
  return a.alive;
}

function dist2(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;
}

// Registry used by World.spawn(). A new species is a subclass plus a config block.
export const SPECIES = {
  rabbit: Rabbit,
  fox: Fox,
};
