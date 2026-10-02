// All tunable simulation constants live here.
//
// Time is measured in ticks. At 1x speed the browser runs one tick per
// animation frame (~60 ticks per second). Distances are in world units; the
// world canvas draws one world unit per pixel.
//
// The world copies this object on reset (see World), so later phases (god
// mode sliders) can edit a live copy without touching these defaults.

export const CONFIG = {
  world: {
    width: 800,
    height: 600,
  },

  grass: {
    cellSize: 10,          // world units per grass cell (800x600 -> 80x60 cells)
    max: 1,                // maximum grass per cell
    initial: 0.6,          // starting fraction of max in each cell (randomised +-)
    growthRate: 0.001,     // grass added per cell per tick (scaled by fertility)
    energy: 12,            // energy gained per unit of grass eaten
    minToEat: 0.25,        // a cell must hold at least this much to be worth eating / seeking
  },

  rabbit: {
    initialCount: 80,

    // Gene bounds. `initial` is the starting mean; founders get +-`initialSpread`
    // of the gene's range so there is variation for selection to act on.
    genes: {
      speed:  { min: 0.2, max: 4.0,  initial: 1.5, label: 'Speed',  unit: 'u/tick' },
      size:   { min: 0.5, max: 2.5,  initial: 1.0, label: 'Size',   unit: '' },
      vision: { min: 5,   max: 150,  initial: 40,  label: 'Vision', unit: 'u' },
    },
    initialSpread: 0.05,

    // Energy cost per tick:
    //   cost = base + k1 * size^3 * speed^2 + k2 * vision + k3 * size^3
    // k1 is the cost of moving a body, k2 of maintaining senses, k3 the resting
    // metabolism of a bigger body.
    cost: {
      base: 0.04,
      k1: 0.025,
      k2: 0.0012,
      k3: 0.03,
    },

    maxEnergyPerSize3: 100, // energy storage = this * size^3
    bitePerSize2: 0.08,     // grass eaten per tick while grazing = this * size^2
    startEnergyFraction: 0.6, // founders start with this fraction of max energy

    maxAge: 2400,           // mean lifespan in ticks
    maxAgeJitter: 0.2,      // each animal's lifespan varies by +-20%
    maturityAge: 150,       // cannot reproduce before this age
    reproThreshold: 0.75,   // reproduce when energy >= this fraction of max energy
    reproCooldown: 120,     // ticks between births
    childEnergyFraction: 0.5, // parent hands this fraction of its energy to the child
    birthEfficiency: 0.85,  // the child receives this fraction of what the parent gives

    wanderTurn: 0.35,       // std dev of random heading change per tick while wandering (radians)
    searchCooldown: 6,      // ticks to wait before searching again after finding nothing
  },

  mutation: {
    rate: 0.25,  // probability that each gene mutates at birth
    size: 0.04,  // mutation std dev as a fraction of the gene's (max - min) range
  },

  stats: {
    sampleEvery: 10,   // ticks between chart samples
    maxSamples: 1200,  // when exceeded, history is halved (pairs averaged)
  },

  // Hard safety cap so a badly tuned config cannot freeze the browser.
  maxAnimals: 3000,
};
