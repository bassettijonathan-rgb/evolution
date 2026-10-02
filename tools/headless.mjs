// Run the simulation without a browser to check that the default constants are
// stable: neither species dies out or explodes.
//
//   node tools/headless.mjs [ticks] [seed ...]
//   node tools/headless.mjs 20000 alpha beta gamma
//   node tools/headless.mjs 20000 --summary 1 2 3 4 5 6 7 8   (one line per seed)
//
// Prints population and mean genes for both species every few hundred ticks.

import { CONFIG } from '../js/config.js';
import { World } from '../js/world.js';

const args = process.argv.slice(2);
const summary = args.includes('--summary');
const rest = args.filter((a) => a !== '--summary');
const ticks = Number(rest[0]) || 10000;
const seeds = rest.length > 1 ? rest.slice(1) : ['1', '2', '3'];
const every = Math.max(100, Math.round(ticks / 25));

const fmt = (v, d = 2, w = 6) => (Number.isFinite(v) ? v.toFixed(d) : '-').padStart(w);

function means(world, species) {
  const list = world.animals.filter((a) => a.species === species);
  const out = { n: list.length };
  for (const g of ['speed', 'size', 'vision']) {
    out[g] = list.length ? list.reduce((s, a) => s + a.genes[g], 0) / list.length : NaN;
  }
  return out;
}

for (const seed of seeds) {
  const world = new World(CONFIG, seed);
  const t0 = performance.now();
  const range = { rabbit: [Infinity, 0], fox: [Infinity, 0] };
  const extinct = { rabbit: null, fox: null };

  if (!summary) {
    console.log(`\n=== seed "${seed}" — ${ticks} ticks ===`);
    console.log('   tick | rabbits  speed  size vision | foxes  speed  size vision | grass%');
  }
  for (let t = 1; t <= ticks; t++) {
    world.step();
    for (const sp of ['rabbit', 'fox']) {
      const n = world.count(sp);
      if (t > 500) { range[sp][0] = Math.min(range[sp][0], n); range[sp][1] = Math.max(range[sp][1], n); }
      if (n === 0 && extinct[sp] === null) extinct[sp] = t;
    }
    if (!summary && (t % every === 0 || t === ticks)) {
      const r = means(world, 'rabbit'), f = means(world, 'fox');
      console.log(
        String(t).padStart(7) + ' |' +
        String(r.n).padStart(8) + fmt(r.speed) + fmt(r.size) + fmt(r.vision, 1, 7) + ' |' +
        String(f.n).padStart(6) + fmt(f.speed) + fmt(f.size) + fmt(f.vision, 1, 7) + ' |' +
        fmt(world.grass.coverage() * 100, 1, 7)
      );
    }
    if (world.animals.length === 0) break;
  }
  const ms = performance.now() - t0;
  const d = world.totals.deaths;
  const r = means(world, 'rabbit'), f = means(world, 'fox');
  const ext = (sp) => (extinct[sp] ? `EXTINCT@${extinct[sp]}` : 'ok');
  console.log(
    `${summary ? `seed ${String(seed).padEnd(4)} ` : ''}` +
    `rabbits ${range.rabbit[0]}..${range.rabbit[1]} (${ext('rabbit')})  ` +
    `foxes ${range.fox[0]}..${range.fox[1]} (${ext('fox')})  ` +
    `end R ${r.n} spd ${fmt(r.speed, 2, 0)} size ${fmt(r.size, 2, 0)} vis ${fmt(r.vision, 0, 0)} | ` +
    `F ${f.n} spd ${fmt(f.speed, 2, 0)} size ${fmt(f.size, 2, 0)} vis ${fmt(f.vision, 0, 0)}  ` +
    `deaths: starved ${d.starvation}, old ${d['old age']}, eaten ${d.eaten}  ` +
    `(${(ms / world.tick).toFixed(2)} ms/tick)`
  );
}
