// DOM wiring: control buttons, keyboard shortcuts, status bar and the animal
// inspector. The UI never touches simulation internals directly; it calls the
// handlers it is given and reads the world for display.

const $ = (id) => document.getElementById(id);

export class UI {
  // handlers: { togglePlay, step, setSpeed, reset(seed), addFoxes, pick(x, y) }
  constructor(handlers) {
    this.h = handlers;
    this.el = {
      play: $('btn-play'),
      step: $('btn-step'),
      speed: $('speed'),
      speedLabel: $('speed-label'),
      seed: $('seed'),
      randomSeed: $('btn-random-seed'),
      reset: $('btn-reset'),
      addFoxes: $('btn-add-foxes'),
      status: $('status'),
      inspector: $('inspector'),
      world: $('world'),
    };
    const e = this.el;

    e.play.addEventListener('click', () => this.h.togglePlay());
    e.step.addEventListener('click', () => this.h.step());
    e.speed.addEventListener('input', () => this.h.setSpeed(Number(e.speed.value)));
    e.reset.addEventListener('click', () => this.h.reset(this.seed()));
    e.addFoxes.addEventListener('click', () => this.h.addFoxes());
    e.randomSeed.addEventListener('click', () => {
      e.seed.value = randomSeed();
      this.h.reset(this.seed());
    });
    e.seed.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') this.h.reset(this.seed());
    });

    e.world.addEventListener('click', (ev) => {
      const r = e.world.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * e.world.width;
      const y = ((ev.clientY - r.top) / r.height) * e.world.height;
      this.h.pick(x, y);
    });

    window.addEventListener('keydown', (ev) => {
      if (ev.target instanceof HTMLInputElement && ev.target.type === 'text') return;
      if (ev.code === 'Space') { ev.preventDefault(); this.h.togglePlay(); }
      else if (ev.key === '.') this.h.step();
      else if (ev.key === 'r' || ev.key === 'R') this.h.reset(this.seed());
      else if (ev.key === 'Escape') this.h.pick(-1e9, -1e9);
    });
  }

  seed() {
    const s = this.el.seed.value.trim();
    if (s) return s;
    const r = randomSeed();
    this.el.seed.value = r;
    return r;
  }

  setSeed(s) {
    this.el.seed.value = s;
  }

  setPlaying(playing) {
    this.el.play.textContent = playing ? 'Pause' : 'Play';
  }

  setSpeed(v) {
    this.el.speed.value = v;
    this.el.speedLabel.textContent = `${v}x`;
  }

  updateStatus(world, actualTps) {
    const d = world.totals.deaths;
    this.el.status.innerHTML =
      `<span>Tick <b>${world.tick}</b></span>` +
      `<span>Rabbits <b>${world.count('rabbit')}</b></span>` +
      `<span>Foxes <b>${world.count('fox')}</b></span>` +
      `<span>Grass <b>${(world.grass.coverage() * 100).toFixed(0)}%</b></span>` +
      `<span>Generation <b>${world.totals.maxGeneration.rabbit}</b> / <b>${world.totals.maxGeneration.fox}</b></span>` +
      `<span>Eaten <b>${d.eaten}</b></span>` +
      `<span>Starved <b>${d.starvation}</b></span>` +
      `<span>Old age <b>${d['old age']}</b></span>` +
      `<span>${actualTps.toFixed(0)} ticks/s</span>`;
  }

  updateInspector(a, world) {
    const el = this.el.inspector;
    if (!a) {
      el.innerHTML = '<h2>Inspector</h2><p class="muted">Click a rabbit or fox on the map to see its genes.</p>';
      return;
    }
    const defs = world.config[a.species].genes;
    const pct = (v) => Math.max(0, Math.min(100, v * 100)).toFixed(0);
    const geneRows = Object.entries(defs).map(([g, d]) => {
      const v = a.genes[g];
      const frac = (v - d.min) / (d.max - d.min);
      return `<dt>${d.label}</dt><dd>${v.toFixed(2)}${d.unit ? ' ' + d.unit : ''}` +
        `<div class="bar" title="${d.min} – ${d.max}"><span style="width:${pct(frac)}%"></span></div></dd>`;
    }).join('');
    const status = a.alive
      ? a.state
      : `<span class="dead">died (${a.causeOfDeath})</span>`;

    el.innerHTML =
      `<h2>${a.species === 'fox' ? 'Fox' : 'Rabbit'} #${a.id}</h2>` +
      `<dl>` +
      geneRows +
      `<dt>Energy</dt><dd>${Math.max(0, a.energy).toFixed(1)} / ${a.maxEnergy.toFixed(1)}` +
      `<div class="bar"><span style="width:${pct(a.energy / a.maxEnergy)}%"></span></div></dd>` +
      `<dt>Cost per tick</dt><dd>${a.costPerTick.toFixed(3)}</dd>` +
      `<dt>Age</dt><dd>${a.age} / ${a.maxAge}</dd>` +
      `<dt>Generation</dt><dd>${a.generation}</dd>` +
      `<dt>Children</dt><dd>${a.children}</dd>` +
      (a.species === 'fox' ? `<dt>Rabbits eaten</dt><dd>${a.kills}</dd>` : '') +
      `<dt>Parent</dt><dd>${a.parentId ? '#' + a.parentId : 'founder'}</dd>` +
      `<dt>Status</dt><dd>${status}</dd>` +
      `</dl>`;
  }
}

export function randomSeed() {
  return Math.random().toString(36).slice(2, 8);
}
