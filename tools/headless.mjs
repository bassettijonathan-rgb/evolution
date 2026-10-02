// Run the simulation without a browser to check that the default constants are
// stable (the population neither dies out nor explodes).
//
//   node tools/headless.mjs [ticks] [seed ...]
//   node tools/headless.mjs 20000 alpha beta gamma
//
// Prints a table of population and mean genes every few hundred ticks.

import { CONFIG } from '../js/config.js';
import { World } from '../js/world.js';

const args = process.argv.slice(2);
const ticks = Number(args[0]) || 10000;
const seeds = args.length > 1 ? args.slice(1) : ['1', '2', '3'];
const every = Math.max(100, Math.round(ticks / 25));

const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-').padStart(7);

for (const seed of seeds) {
  const world = new World(CONFIG, seed);
  const t0 = performance.now();
  let min = Infinity, max = 0, extinctAt = null;

  console.log(`\n=== seed "${seed}" — ${ticks} ticks ===`);
  console.log('   tick    pop  grass%   speed    size  vision  maxGen');
  for (let t = 1; t <= ticks; t++) {
    world.step();
    const n = world.animals.length;
    if (t > 500) { min = Math.min(min, n); max = Math.max(max, n); }
    if (n === 0 && extinctAt === null) extinctAt = t;
    if (t % every === 0 || t === ticks) {
      const s = world.stats.latest().species.rabbit.genes;
      const mean = (g) => {
        let sum = 0;
        for (const a of world.animals) sum += a.genes[g];
        return n ? sum / n : NaN;
      };
      console.log(
        String(t).padStart(7) + String(n).padStart(7) +
        fmt(world.grass.coverage() * 100, 1) +
        fmt(mean('speed')) + fmt(mean('size')) + fmt(mean('vision'), 1) +
        String(world.totals.maxGeneration).padStart(8)
      );
      void s;
    }
    if (n === 0) break;
  }
  const ms = performance.now() - t0;
  const d = world.totals.deaths;
  console.log(
    `range after tick 500: ${min}..${max}  births ${world.totals.births}  ` +
    `deaths: starvation ${d.starvation}, old age ${d['old age']}  ` +
    (extinctAt ? `EXTINCT at tick ${extinctAt}  ` : '') +
    `(${(ms / world.tick).toFixed(3)} ms/tick)`
  );
}
