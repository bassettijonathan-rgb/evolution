# Evolution Simulator

A browser game in which natural selection emerges from a few simple rules.
Rabbits graze on regrowing grass. Each rabbit has three genes (**speed**,
**size** and **vision**) that its offspring inherit with small random
mutations. Every gene costs energy, so there is no single best rabbit. Watch
the charts as the population drifts toward whatever works in its world.

Plain HTML, CSS and vanilla JavaScript (ES modules) drawn on a canvas. No
build step, no frameworks, no dependencies.

See [`docs/plan.md`](docs/plan.md) for the architecture and the roadmap
(foxes, seasons and terrain, a god mode sandbox, save/load).

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
| Click a rabbit | Inspect its genes, energy, age, generation, children and parent (Esc to clear) |

The seed is kept in the URL, so you can share a run, for example
`?seed=demo&speed=10`.

**Reading the map:** hue = speed (blue is slow, red is fast), circle size =
size gene, paler = longer vision. The selected rabbit shows its vision radius
as a dashed circle.

**Reading the charts:** population, grass cover, and the mean of each gene.
The shaded band shows ±1 standard deviation. Hover over a chart to read the
values at any moment.

## Tuning and headless runs

Every constant is in [`js/config.js`](js/config.js). The simulation core has
no DOM dependencies, so you can run it in Node (18+) to check stability:

```sh
node tools/headless.mjs 20000 seedA seedB seedC
```

This prints the population, grass cover and mean genes over time, plus deaths
by cause, for each seed. `package.json` exists only to tell Node that the
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
