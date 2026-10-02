# Evolution Simulator

A browser game in which natural selection emerges from a few simple rules.
Rabbits graze on regrowing grass and foxes hunt the rabbits. Every animal has
three genes (**speed**, **size** and **vision**) that its offspring inherit
with small random mutations. Every gene costs energy, so there is no single
best animal. Watch the charts as rabbits and foxes evolve against each other:
faster foxes favour faster rabbits, and the other way round.

Plain HTML, CSS and vanilla JavaScript (ES modules) drawn on a canvas. No
build step, no frameworks, no dependencies.

See [`docs/plan.md`](docs/plan.md) for the architecture and the roadmap
(seasons and terrain, a god mode sandbox, save/load).

## Running locally

ES modules do not load from `file://` URLs, so serve the folder with any
static web server:

```sh
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

### Controls

| Control | Action |
|---|---|
| **Play / Pause** (Space) | Start or stop the simulation |
| **Step** (`.`) | Advance one tick |
| **Speed** slider | 1x–50x (simulation ticks per frame) |
| **Seed** + **Reset** (R or Enter) | Restart with the given seed. The same seed gives the same run. |
| **Random** | Pick a new seed and restart |
| **+ Foxes** | Drop in five new foxes (handy if they die out) |
| Click an animal | Inspect its genes, energy, age, generation, children, parent and (foxes) rabbits eaten. Esc clears. |

The seed is kept in the URL, so you can share a run, for example
`?seed=demo&speed=10`.

**Reading the map:** circles are rabbits and outlined triangles are foxes.
Hue = speed (blue is slow, red is fast, on each species' own scale), shape
size = size gene, paler = longer vision. The selected animal shows its vision
radius as a dashed circle, and a line to the grass or rabbit it is heading for.

**Reading the charts:** rabbit and fox counts, grass cover, and the mean of
each gene. Blue is rabbits and orange is foxes. In the gene panels both
species share one scale, so you can watch an arms race. The shaded band shows
±1 standard deviation. Hover over a chart to read the values at any moment.

## Tuning and headless runs

Every constant is in [`js/config.js`](js/config.js). The simulation core has
no DOM dependencies, so you can run it in Node (18+) to check stability:

```sh
node tools/headless.mjs 20000 seedA seedB seedC
```

This prints both populations, grass cover and mean genes over time, plus
deaths by cause, for each seed. Add `--summary` to get one line per seed
(population ranges, extinctions, final genes). `package.json` exists only to tell Node that the
`.js` files are ES modules. There is nothing to install.

## Publishing on GitHub Pages

1. Push the repository to GitHub. The site files (`index.html`, `css/`,
   `js/`) are already at the repository root.
2. On GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose your branch (for example `main`) and the **`/ (root)`** folder,
   then click **Save**.
5. After a minute the site is live at
   `https://<your-user>.github.io/<repo-name>/`.

The empty `.nojekyll` file tells Pages to serve the files as they are,
without running Jekyll.
