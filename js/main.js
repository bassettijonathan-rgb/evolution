// Entry point: creates the world, renderer, charts and UI, and runs the loop.
// At speed N the loop runs N simulation ticks per animation frame, within a
// time budget so the page stays responsive on slower machines.

import { CONFIG } from './config.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { Charts } from './charts.js';
import { UI, randomSeed } from './ui.js';

const FRAME_BUDGET_MS = 30;

const params = new URLSearchParams(location.search);

const app = {
  world: null,
  playing: true,
  speed: Number(params.get('speed')) || 1,
  selected: null,
  tickCounter: { ticks: 0, since: performance.now(), tps: 0 },
};

const renderer = new Renderer(document.getElementById('world'));
const charts = new Charts(document.getElementById('charts'));

const ui = new UI({
  togglePlay() {
    app.playing = !app.playing;
    ui.setPlaying(app.playing);
  },
  step() {
    app.playing = false;
    ui.setPlaying(false);
    advance(1);
    redraw();
  },
  setSpeed(v) {
    app.speed = v;
    ui.setSpeed(v);
  },
  reset(seed) {
    reset(seed);
  },
  addFoxes() {
    app.world.addAnimals('fox', app.world.config.fox.addCount);
    redraw();
  },
  pick(x, y) {
    app.selected = app.world.animalAt(x, y, 14);
    ui.updateInspector(app.selected, app.world);
    redraw();
  },
});

function reset(seed) {
  app.world = new World(CONFIG, seed);
  app.selected = null;
  renderer.attach(app.world);
  charts.setData(app.world.stats, app.world.config);
  ui.setSeed(seed);
  ui.updateInspector(null, app.world);
  const url = new URL(location.href);
  url.searchParams.set('seed', seed);
  try {
    history.replaceState(null, '', url);
  } catch {
    // Some sandboxed frames refuse URL changes; the seed box still shows the seed.
  }
  redraw();
}

function advance(n) {
  const start = performance.now();
  for (let i = 0; i < n; i++) {
    app.world.step();
    app.tickCounter.ticks++;
    if (performance.now() - start > FRAME_BUDGET_MS) break;
  }
}

function redraw() {
  renderer.draw(app.selected);
  charts.draw();
  if (app.selected) ui.updateInspector(app.selected, app.world);
  ui.updateStatus(app.world, app.tickCounter.tps);
}

function frame(now) {
  if (app.playing) advance(app.speed);
  const tc = app.tickCounter;
  if (now - tc.since >= 500) {
    tc.tps = (tc.ticks * 1000) / (now - tc.since);
    tc.ticks = 0;
    tc.since = now;
  }
  redraw();
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  charts.resize();
  charts.draw();
});

ui.setSpeed(app.speed);
ui.setPlaying(app.playing);
charts.resize();
reset(params.get('seed') || randomSeed());
requestAnimationFrame(frame);

// Handy for poking at the simulation from the browser console.
window.sim = app;
