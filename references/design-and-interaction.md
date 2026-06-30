# Design & Interaction

How to make it feel like a premium, $100k-grade course — and how the interactive pieces work. The bundled `templates/styles.css` gives you all of this; this doc explains what's there and how to use it well.

## Visual language: premium, not childish

"Gamified" must not mean toy-like. The look that reads as expensive and serious:

- **Dark, restrained palette** with a single accent gradient (periwinkle → violet → teal). One gradient, used sparingly on headlines, primary buttons, and the active state — not everywhere.
- **Generous whitespace** and a strong type scale (big, tight-tracked display headings; calm body text).
- **Soft depth**: subtle borders (`rgba(255,255,255,.08)`), layered shadows, gentle gradients on cards — never harsh.
- **Motion as choreography, not decoration**: content reveals on scroll, numbers count up, the progress rail fills. Nothing spins or bounces for its own sake.

The bundled tokens (in `:root` of `styles.css`) are the knobs: `--accent`, `--accent-2`, `--accent-3`, `--grad`, surfaces `--bg/--surface*`, text `--text/--muted/--faint`, semantic `--ok/--warn/--bad`, radii, shadows. Re-skin a build by changing these few variables.

## Component classes you already have

Use these instead of inventing new CSS (keeps everything consistent — DRY):

- **Layout**: `.wrap` (max-width container), `.section` (vertical rhythm, gets a `data-toc` for the dot nav), `.section-head`, `.grid.g2/.g3/.g4`, `.stack`.
- **Cards & stats**: `.card` (+`.hov` for hover lift, `.feature`), `.stat` (big number + label).
- **Callouts** (the teaching voice): `.callout` with a modifier — `.key` (core insight), `.analogy`, `.good`, `.warnc` (warning), `.bad`. Each takes an inline SVG icon in `.cic`.
- **Equations/code**: `.eq` (monospace block; spans `.hl/.var/.res/.cmt` colorize parts).
- **Interactive lab**: `.lab` wrapper, `.lab-title` (with pulsing `.dot`), `.controls` grid, `.ctrl` (a labeled control), `.seg` (segmented button group), `.readout` grid of `.ro` (`.ro.accent` to highlight), `.verdict` (`.fit/.tight/.nofit` states).
- **Tables**: `.table-wrap` > `table`, with `.tag` pills (`.ok/.warn/.bad/.nv/.apple`).
- **Worked examples**: `.ex-band` (header), `.steps`/`.step` (numbered timeline), `.spec-grid`, `.rec`/`.rec.win` (recommendation card with `.ribbon`), `.price`.
- **Gamification**: `.quiz`/`.opt`/`.explain`, `.badges`/`.badge` (`.earned`), `.pill`.
- **Motion**: add `.reveal` (+`.d1/.d2/.d3/.d4` for stagger) to anything that should fade up on scroll; `.count` with `data-to` (and optional `data-suffix/data-prefix/data-dec`) for count-up numbers.

## The interaction loop (every widget follows it)

The single most important pattern. A learner *manipulates the real model* and watches it respond — that's how an equation becomes intuition. Each widget:

1. has controls (`<input type="range">`, a `.seg` of buttons, a `<select>`) with matching value labels;
2. on `input`, reads the values, **calls `CALC`** (never does math inline), and
3. writes the readouts (`.ro .v`) and re-renders its chart.

Keep widgets honest: show the formula nearby (`.eq`) and, where useful, substitute the live numbers into it so the learner sees the calculation, not just the answer.

### The "master playground"

After teaching each piece with its own small widget, give one **combining tool** that takes all the inputs at once and outputs the real decision (a verdict + the key numbers + a comparison table). This is the payoff — it's where the learner does the actual thing the course is about. In the GPU build it's the hardware calculator; in a "how databases scale" course it might be a "will this query plan hold at 10× traffic?" tool.

## Charts (bundled `charts.js`, `window.Charts`)

Hand-rolled SVG — zero dependencies, themed by CSS vars. Pick by intent:

- `Charts.vbars(elId, {data:[{label,value,color,sub}], unit, target:{value,label}})` — compare discrete options (memory by precision, cost by option).
- `Charts.grouped(elId, {groups, series, unit})` — compare multiple metrics across options.
- `Charts.hstack(elId, {segments:[{label,value,color}], capacity, capLabel, unit})` — a stacked bar with a capacity marker (great for "what fills the budget").
- `Charts.line(elId, {series:[{name,color,points:[[x,y]]}], xLabel, yLabel, target})` — show a relationship over a range (growth over time, latency vs length). Single-series gets a soft area fill.

Call a chart inside the widget's update function so it reacts live. Use the accent palette (`Charts.PAL`) and reserve red for "the limit/target."

## Gamification that respects the learner

Driven by markup + the bundled `app.js`; you mostly just add attributes:

- **XP**: awarded automatically for visiting a `data-toc` section and for answering quizzes. The pill in the topbar (`#xpVal`) updates and persists.
- **Badges**: put `.badge[data-badge="id"]` cards in a `.badges` grid. Unlock them by (a) tagging a section `data-earn-badge="id"` (earned on visit) or (b) a quiz `data-badge="id"` (earned on a correct answer). `app.js` adds `.earned` and shows a toast.
- **Quizzes/checkpoints**: a `.quiz[data-quiz="id"]` with `.opt` buttons; mark the right one `data-correct="1"` and put the teaching in `.explain`. The engine reveals the answer and explanation on click. Always explain *why* — the checkpoint is a teaching moment, not a gate.
- **Final challenge**: one richer scenario quiz at the end that makes them apply the whole method; tie it to a capstone badge.

Keep it tasteful: a quiet XP counter, a few meaningful badges, one final challenge. No confetti, no streaks-nagging, no cartoon mascots. The reward is competence.

## Responsiveness & print

The grids collapse on mobile via media queries — but inline `style="grid-template-columns:repeat(3,1fr)"` overrides them, so use `repeat(auto-fit,minmax(185px,1fr))` for control/readout grids that must reflow. The cheat-sheet/recap section should print cleanly (the stylesheet hides chrome under `@media print`); offer a "Print / save" button (`onclick="window.print()"`).
