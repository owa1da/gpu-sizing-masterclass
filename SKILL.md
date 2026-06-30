---
name: interactive-masterclass
description: >-
  Build a premium, self-contained, interactive web masterclass that teaches any complex or
  technical topic — with live calculators/simulators the learner can drag and play with, custom
  SVG charts, fully worked examples, and tasteful gamification, all grounded in verified, cited
  facts. Use this skill whenever the user wants to learn, understand, teach, explain, or onboard
  someone to a topic and would benefit from an interactive guide instead of a wall of text — e.g.
  "help me really understand X", "make an interactive explainer / tutorial / course / lesson /
  playground for Y", "I want to wrap my head around Z", "build a learning tool or visualization to
  teach <concept>", or "make another one like this presentation". Reach for it even when the user
  never says "presentation" or "masterclass" but is clearly trying to deeply grasp or teach a
  concept that has moving parts, tradeoffs, or numbers worth playing with.
---

# Interactive Masterclass Builder

Turn a hard topic into a polished, interactive web course a smart non-expert can absorb in one sitting — and actually *use* afterward to make a real decision.

## The core bet: interactivity beats prose

People don't internalize a formula by reading it; they internalize it by **dragging a slider and watching the answer move**. So the center of gravity of every build is not text — it's live widgets the learner manipulates, a "playground" that combines them into the real decision, and worked examples that show the full reasoning end to end. Text exists to set up the interaction, not to replace it.

Two more commitments make it feel like a $100k course rather than a slick demo:

- **One source of truth.** Every number lives in one data file; all math lives in pure functions; the UI only renders. So the calculators, the charts, and the worked examples can never disagree, and fixing a number fixes it everywhere. This is what makes the thing trustworthy *and* maintainable.
- **Honesty about confidence.** Cite sources, calibrate formulas against reality, and say plainly what's exact vs. estimated. Candor is what earns a CTO's trust.

## What you produce

A single `index.html` plus a few small JS/CSS files that the learner **opens by double-clicking** — no server, no build, no internet, works offline on any machine. It contains:

- a short **mental-model** intro, then one **module per core idea**, each ending in a live widget;
- a **master playground** that combines every input into the real decision;
- 3+ **worked examples** rendered from data (so they never drift from the calculator);
- an **accuracy & caveats** section, a printable **cheat sheet**, and tasteful **gamification** (XP, a few badges, checkpoints, a final challenge).

The repo this skill lives in *is* a full worked example — the GPU-sizing masterclass (`index.html` + `assets/`). Study it; it's the gold standard for the bar to hit.

## The workflow

Work through these in order. Steps 1–2 are thinking; don't skip them — a build on a fuzzy spine or shaky facts is wasted effort.

1. **Find the spine.** Compress the topic to the few mental models + the *one decision/calculation* the learner needs to make. That decision becomes the master playground; the ideas become the modules. If you can't state the spine in a few sentences, keep narrowing. → `references/research-and-honesty.md`
2. **Verify the facts.** Gather the real numbers/rules from authoritative sources, cite them, and calibrate any formula against 2–4 real measured anchors. Verify the load-bearing numbers yourself; use subagents for breadth but don't let them block. → `references/research-and-honesty.md`
3. **Scaffold the architecture.** Copy the topic-agnostic files (`styles.css`, `charts.js`, `app.js`) from `templates/`, then create the three per-topic files: `data.js` (facts), `calc.js` (pure-function equations), `calc-ui.js` (wiring). Drop the HTML shell with a `<!--SECTIONS-->` insertion marker. → `references/architecture-and-build.md`
4. **Build the teaching spine.** Insert modules one at a time. Each: explain the idea in a sentence or two, show the formula, then a **live widget** that makes it tangible. Build concept-only modules first (no numbers), wire the numeric ones once facts are verified.
5. **Add the playground + examples.** Build the master calculator (the payoff), then render 3+ worked examples from `DATA.examples` by calling `CALC` — never hand-type results into prose.
6. **Make it interactive & gamified, tastefully.** Wire checkpoints, XP, a few meaningful badges, and one final challenge. Quiet and competence-focused — no confetti or mascots. → `references/design-and-interaction.md`
7. **Polish & verify.** Retune the design tokens for the brand; check it renders headless with **no JS errors and no NaN**, spot-check a couple of numbers by hand, and confirm one mobile width. → `references/architecture-and-build.md` (verification section)

## The architecture in one breath

`index.html` (markup only) loads, in this order: `data.js → calc.js → charts.js → calc-ui.js → app.js`.

- `data.js` = **facts** (constants, presets, examples, citations) — the single source of truth.
- `calc.js` = **math** (pure functions, no DOM) — the topic expressed as equations.
- `calc-ui.js` = **wiring** (reads controls → calls `CALC` → writes readouts → calls `Charts`).
- `charts.js` = dependency-free **SVG charts** (`vbars`, `grouped`, `hstack`, `line`).
- `app.js` = **chrome** (nav dots, scroll progress, reveal-on-scroll, count-ups, quiz/XP/badge engines), driven by HTML classes/attributes.

Hard rules because it runs from `file://`: **no ES modules, no `fetch`, no CDNs, no web fonts** — attach to `window`, inline all data, vendor everything, guard `localStorage`. These constraints are what make it bulletproof and shareable. Full detail and skeletons: `references/architecture-and-build.md`.

## Design & interaction in one breath

Premium = a dark restrained palette with **one** accent gradient, generous whitespace, soft depth, and motion used as choreography (reveal, count-up, progress) not decoration. Don't invent CSS — the bundled `styles.css` already provides cards, callouts (`.key/.analogy/.warnc/...`), equation blocks, the interactive `.lab`/`.ctrl`/`.seg`/`.readout`/`.verdict` kit, tables, the worked-example `.steps`/`.rec` kit, and gamification (`.quiz`/`.badge`). Every widget follows the same loop: **input → read → call `CALC` → render readout + chart.** Full catalog and the gamification attributes: `references/design-and-interaction.md`.

## Build checklist

- [ ] Spine named in a few sentences; the one decision is clear.
- [ ] Load-bearing facts verified and cited in `DATA.cite`.
- [ ] Calc is pure functions; every displayed number comes from `CALC`.
- [ ] Each core idea has a live widget; a master playground combines them.
- [ ] 3+ worked examples rendered from data (not hand-typed).
- [ ] Accuracy/caveats module + printable cheat sheet present.
- [ ] Gamification is tasteful (XP, few badges, checkpoints, one final challenge).
- [ ] `node --check` clean; headless render shows no errors / no NaN; mobile width checked.
- [ ] Opens by double-click with no internet.

## Adapting to any topic

The same skeleton fits anything with moving parts, tradeoffs, or numbers worth playing with:

**Example 1 — Personal finance (compounding).** Modules: what compounding is · rate · time · contributions. Widgets: each lever with a live balance + growth line. Playground: a retirement calculator (contribution, rate, years, target → will you hit it?). Examples: 3 savers (early-starter, late-but-aggressive, steady). Honesty: real returns vary; this is planning, not a guarantee.

**Example 2 — Database indexing.** Modules: what an index is · B-tree lookups · selectivity · the write-cost tradeoff. Widgets: rows-scanned vs. index on/off; write amplification vs. #indexes. Playground: "Should I index this query?" → estimated speedup + write cost + verdict. Examples: 3 query patterns. Calibrate against rough real timings.

**Example 3 — Capacity planning for an API.** Modules: latency vs. load · the queue · concurrency · headroom. Widgets: throughput vs. instances; p99 latency vs. utilization. Playground: "How many instances for N req/s at p99 < X?" with cost. Examples: 3 traffic profiles.

In every case: facts → spine → modules-with-widgets → playground → examples → honesty. Reskin via the design tokens.

## Anti-patterns to avoid

- **Walls of text with a token chart.** If the learner can't manipulate the model, you've written an article, not a masterclass.
- **Numbers hard-coded in three places.** They will drift and destroy trust. Route everything through `data.js`/`calc.js`.
- **Confident fabrication.** Don't invent specs or rates. Cite, calibrate, and label confidence; bias slightly conservative.
- **Childish "gamification."** Confetti, streak-nagging, mascots. Keep it quiet; the reward is competence.
- **Dependencies that break offline.** CDNs, web fonts, ES modules, `fetch` — all forbidden on `file://`.
- **Scope creep.** A module/widget that doesn't serve the spine is cut (YAGNI). A clear path beats a complete encyclopedia.

## Bundled resources

- `templates/` — copy-and-go starting point. `styles.css`, `charts.js`, `app.js` are topic-agnostic (reuse verbatim; retune CSS tokens to taste). `data.js`, `calc.js`, `calc-ui.js` and `starter-index.html` are a tiny **runnable** demo (a savings calculator) showing the exact pattern — open `templates/starter-index.html` to see it work, then replace the demo with your topic.
- `references/architecture-and-build.md` — file layout, `file://` rules, the engine pattern with skeletons, and the verification recipe.
- `references/design-and-interaction.md` — the design tokens, the full component catalog, the chart API, and the gamification attributes.
- `references/research-and-honesty.md` — finding the spine, sourcing/citing/calibrating facts, and building the honesty layer.
- The repo's own `index.html` + `assets/` — a complete, real, production-grade example to imitate.
