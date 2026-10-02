# Evolution Simulator: Design Document

A browser game in which natural selection emerges from simple rules. Grass
grows, herbivores (rabbits) eat it, and later predators (foxes) eat the
rabbits. Every animal carries genes that its offspring inherit with small
random mutations. Every gene costs energy, so no animal is best at
everything. Nothing about adaptation is hard-coded: whichever gene values
leave the most descendants in the current environment become common.

## Constraints

- Static site that runs on GitHub Pages: plain HTML, CSS and vanilla
  JavaScript ES modules.
- No build step, no frameworks, no external dependencies.
- Rendering on HTML5 `<canvas>`. The charts are drawn by hand on a second canvas.
- Runs are reproducible: all randomness comes from one seeded RNG.
- Smooth with several hundred animals.

## Architecture

The code has two layers:

1. **Simulation core** (`world`, `animal`, `genes`, `grass`, `spatial`,
   `stats`, `rng`, `config`). Pure logic with no DOM access, so it runs both
   in the browser and in Node (`tools/headless.mjs`) for tuning and tests.
2. **Presentation** (`render`, `charts`, `ui`, `main`). Reads the world
   state and draws it, and turns user input into calls on the core.

```
           ┌─────────── main.js (loop, wiring) ───────────┐
           │                                               │
   ui.js (controls, inspector)   render.js (world canvas)  charts.js (chart canvas)
           │                         │                         │
           └────────────── reads / commands ───────────────────┘
                                     │
                               world.js  ── owns ──► rng, grass, animals[], spatial hash, stats
                                     │
                     animal.js (Animal base, Rabbit, later Fox)
                                     │
                         genes.js (inherit / mutate / clamp)
                                     │
                         config.js (every constant)
```

### Simulation loop (one tick)

1. `grass.update()`: every cell regrows by `growthRate × fertility × growthMultiplier`.
2. For every living animal, `animal.update()`:
   1. age += 1 and energy −= cost per tick
   2. die of starvation (energy ≤ 0) or old age (age ≥ maxAge)
   3. `think()`: species behaviour (graze, seek food, wander; later hunt or flee)
   4. reproduce if energy is high enough, the animal is mature and its cooldown has passed
3. Newborns join the population and dead animals are removed.
4. The spatial hash is rebuilt.
5. Stats are sampled every `sampleEvery` ticks.

### Energy model

```
cost per tick = base + k1·size³·speed² + k2·vision + k3·size³
max energy    = maxEnergyPerSize3 · size³
bite per tick = bitePerSize2 · size²          (grass units, × grass.energy)
```

- **Speed** finds food sooner but costs a lot to move, more so for a big body.
- **Size** stores more energy (it survives lean periods and gives children
  more) and eats faster, but costs more to run.
- **Vision** finds food from further away. The cost grows linearly with range.

`k3` is a small resting cost for body mass. Without it, a nearly motionless
giant would pay almost nothing for its size. All constants live in
`js/config.js`.

### Reproduction and inheritance

When energy ≥ `reproThreshold × maxEnergy`, age ≥ `maturityAge` and the
cooldown has expired, the animal hands `childEnergyFraction` of its energy to
a child, which receives `birthEfficiency` of that amount. The rest is lost as
the cost of reproducing. The child copies each gene; with probability
`mutation.rate` a gene is shifted by a normal sample with standard deviation
`mutation.size × (max − min)`, then clamped to the gene's bounds. The child's
generation is one more than its parent's.

### Behaviour: rabbits

- If a **hunting** fox is within `vision`, flee: run directly away from it,
  steering off walls so the rabbit runs along an edge instead of into a
  corner. Fleeing comes before eating. Resting or well-fed foxes are ignored,
  as real prey learn to do. Without this, far-sighted rabbits spent so much
  time running from harmless foxes that they starved.
- If the current grass cell holds at least `minToEat`, graze. The rabbit
  stops moving and eats one bite per tick.
- Otherwise, if it has a target cell that still has grass, walk to it.
- Otherwise, search for the nearest cell with grass within `vision`. The
  search goes outward ring by ring and stops early once nothing closer is
  possible. If nothing is found, wait `searchCooldown` ticks before searching
  again, to save CPU time.
- With no target, wander: a random walk with small heading changes, bouncing
  off the world edges.

### Behaviour: foxes (phase 2)

- After a meal (`digestTicks`), a missed catch (`missRest`) or a chase longer
  than `maxChase` (`tiredRest`), the fox stands still.
- A fox only hunts when its energy is below `huntBelow × maxEnergy`.
- Otherwise it chases the nearest rabbit within `vision` that no other fox is
  already chasing. On reaching it, the catch succeeds with probability
  `min(1, catchBase × foxSize / rabbitSize)`, so big rabbits can fight free.
- A catch yields `meatPerSize3 × rabbitSize³ + energyTransfer × rabbitEnergy`.
- **Territory:** a fox only breeds when at most `maxNeighbours` other foxes
  are within `territoryRadius`.

#### Why territory? (tuning notes)

Food alone did not give stable predator-prey dynamics in a world this small.
Strong foxes overshot, wiped out the rabbits and then starved. Weak foxes
could not make a living at all. The window between was too narrow for
evolution to stay inside, because evolution moves the parameters: rabbits
got smaller, which cut the energy in each meal. Ecology suggests the fix:
predators that limit their own density, as territorial carnivores do. With
strict territories, both species survived 30,000 ticks in 10 out of 10 test
seeds (`tools/headless.mjs`). Foxes hold at about 35–50 and rabbits cycle
between about 220 and 550.

### Performance

- Grass is stored in a `Float32Array` and drawn through a cols×rows
  `ImageData` that is scaled up with `drawImage`, using one blit per frame.
- `SpatialHash` is a uniform bucket grid that is rebuilt every tick. It makes
  neighbour queries O(k). There is one hash per species, so a rabbit looking
  for foxes never scans past hundreds of other rabbits. They serve hunting,
  fleeing, fox territories and click picking.
- Food search uses an early-exit ring search and a cooldown after a failed search.
- The loop runs N ticks per frame at speed N, within a 30 ms time budget per
  frame, so the page stays responsive.
- Stats history is bounded. Past `maxSamples`, neighbouring samples are
  averaged in pairs and the sampling interval doubles.

### Reproducibility

`rng.js` implements mulberry32, seeded from a string hash. The world creates
one RNG from the seed, and every random decision goes through it in a fixed
order, so the same seed gives the same run. The seed is also stored in the
URL (`?seed=...`) so a run can be shared. Note that the frame time budget can
drop ticks on slow machines, but it never changes their order, so the state
at tick T is always identical.

## File structure

```
index.html            page layout and controls
css/style.css         styles
js/config.js          every tunable constant
js/rng.js             seeded RNG (mulberry32) and string → seed hashing
js/genes.js           gene creation, mutation and clamping (works for any species)
js/grass.js           grass grid: growth, eating, nearest-food search, fertility
js/spatial.js         spatial hash for neighbour queries
js/animal.js          Animal base class, Rabbit, Fox, SPECIES registry
js/world.js           World: owns the state and steps the simulation
js/stats.js           time series history for the charts (bounded)
js/render.js          draws grass and animals on the world canvas
js/charts.js          hand-drawn time series charts with hover crosshair
js/ui.js              control wiring, keyboard shortcuts, status bar, inspector
js/main.js            entry point and animation loop
tools/headless.mjs    runs the simulation in Node to check stability
docs/plan.md          this document
package.json          only tells Node to treat .js files as ES modules (no dependencies)
.nojekyll             tells GitHub Pages to serve files as-is
```

### Extension points that already exist

- `SPECIES` registry in `animal.js` with a per-species config block. A new
  species is a subclass plus a config entry.
- Gene definitions are data (`config.<species>.genes`). Genes, charts and
  the inspector all iterate over them.
- `StatsHistory` takes a `{ species: [genes] }` map.
- `Grass.fertility` (per cell) and `Grass.growthMultiplier` (global) are ready
  for terrain and seasons.
- The `World` deep-copies the config, so god mode sliders can edit
  `world.config` live.
- `RNG.getState()/setState()` makes save/load possible.

## Feature roadmap

### Phase 1: Grass and rabbits (done)
- Grass grid with regrowth.
- Rabbits with speed, size and vision genes, energy, ageing, starvation,
  reproduction with mutation.
- Rabbits seek food within vision and wander otherwise.
- Colour encodes genes (hue = speed, radius = size, lightness = vision).
- Live charts: population, grass cover, and mean ± standard deviation of each gene.
- Controls: play/pause, step, speed 1x–50x, reset, seed input, random seed.
- Click an animal to inspect its genes, energy, age, generation, children and parent.
- Headless stability script.

### Phase 2: Predators (done)
- `Fox` subclass with its own genes (speed, size, vision) and its own config block.
- Foxes use the spatial hash to find the nearest unclaimed rabbit within
  vision, chase it and try to catch it on contact. Energy gained scales with
  the rabbit's size.
- Rabbits use vision to detect hunting foxes and flee, which takes priority
  over eating.
- Size matters in fights: catch chance = `catchBase × foxSize / rabbitSize`.
- Foxes are territorial: they only breed with no other fox close by.
- Foxes are drawn as outlined triangles pointing where they are heading. A
  selected fox shows a line to its prey.
- Charts: rabbit and fox population panels. Each gene panel plots both
  species on one shared scale, so arms races are visible. One colour per
  species throughout.
- "+ Foxes" button drops in five new foxes, for example to re-introduce
  them after they die out.
- Inspector shows a fox's kill count. The status bar shows deaths by cause
  (eaten, starved, old age).
- Observed: a speed arms race. Over 30,000 ticks, rabbit speed rose from 1.5
  to about 2.5 and fox speed from 1.6 to about 2.5, the two tracking each
  other. Rabbits got smaller (≈ 0.6) and foxes slightly larger (≈ 1.3).

### Phase 3: Seasons and terrain
- A sine-wave season sets `grass.growthMultiplier`. Winter is lean, which
  favours large bodies that store more energy.
- Terrain map: water (impassable and not grazeable) and fertility zones,
  generated from the seed with value noise.
- Rivers or lakes split the world into regions. Separated populations can
  drift apart in their genes, and charts can show statistics per region.
- Animals pay extra cost or move slower on some terrain.

### Phase 4: God mode sandbox
- Slider panel bound to the main `world.config` constants (growth rate,
  mutation rate and size, cost factors), applied live.
- Tools: drop rabbits or foxes with chosen genes at the cursor, paint
  fertility or water.
- Disasters: drought (growth multiplier drops for N ticks), disease (each
  animal dies with a probability that depends on density, using the spatial
  hash), fire (clears grass in a radius).
- Invasive species: introduce a group with very different genes and watch
  whether it displaces the natives.

### Phase 5: Polish
- Save/load a run to JSON (config, RNG state, grass, animals, stats) through
  download/upload and `localStorage`.
- Gene histogram panel showing the current distribution, not only the mean.
- Family tree: keep a bounded parent/child index so a selected animal's
  ancestors and descendants can be browsed.
- Simple sound with the Web Audio API (births, deaths, ambience), muted by default.
- Mobile layout refinements and touch selection.

## Testing and tuning

- `node tools/headless.mjs [ticks] [seeds...]` runs the core without a
  browser and prints population, grass cover, mean genes and deaths by cause.
- Phase 1 target: the population should neither die out nor exceed about
  1,000 in the first several thousand ticks, and the genes should settle
  inside their bounds rather than pinning to a limit.
