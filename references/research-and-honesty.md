# Research, Accuracy & Honesty

A beautiful interactive that teaches wrong numbers is worse than useless. This is how to make the content *correct and trustworthy* — the part that separates a real masterclass from a slick demo.

## First, find the spine

Before any research or code, compress the topic to its **spine**: the few mental models plus the **one decision or calculation** the learner ultimately needs to make. Everything in the app should ladder up to that.

Ask:
- What should the learner be able to *do* afterward? (Size hardware. Choose an index. Price an option. Estimate a dose.) Name the concrete output.
- What are the 3–6 core ideas that decision rests on? Those become your modules.
- What's the equation (or decision rule) at the center? That becomes `calc.js` and the master playground.

If you can't name the spine in a few sentences, you're not ready to build. A tight spine is what keeps the result KISS instead of a sprawling wiki.

## Source the facts (don't invent them)

The learner is making real decisions, so the numbers must have a real basis:

- Prefer **authoritative primary sources**: official docs, manufacturer/spec pages, standards, peer-reviewed work, reputable benchmarks. Capture a URL for each load-bearing number and keep them in `DATA.cite`, surfaced as small `<sup>` citation links in the UI.
- **Verify the load-bearing numbers yourself.** The handful of values the whole course hinges on (the central constants, the headline specs) deserve your own check, not a secondhand claim.
- **Use subagents for breadth, not as a crutch.** Parallel research agents are great for fanning out across many lookups (specs, prices, benchmarks). But they can stall or over-run — don't let them block the build. If they're slow, do the targeted lookups yourself; you're often faster and more reliable for the few numbers that matter. (In the GPU build, the research agents over-ran and the load-bearing specs were ultimately verified directly — that's the right call when it happens.)

## Calibrate formulas to reality

Pure formulas overpromise. Anchor them:

- Where a clean equation exists (memory = params × bytes), trust it — it's arithmetic.
- Where real-world efficiency intrudes (throughput, latency, yields), apply **calibrated efficiency factors** drawn from literature/benchmarks (e.g. "achieved bandwidth ≈ 60% of peak"), and keep those factors as named constants in `DATA.CONST` so they're easy to audit and tune.
- Check the formula against **2–4 real measured anchors**. If the formula says 125 and reality says 77–130, you're in the right ballpark — say so. If it's off by 3×, fix the factor.
- When unsure, bias **slightly conservative**. A tool that under-promises and is occasionally beaten earns trust; one that overpromises and disappoints loses it.

## Build an honesty layer

Trust is a feature you design in, not a disclaimer you bury:

- Include an **"accuracy & caveats" module** that states confidence per component — what's essentially exact (arithmetic), what's a solid estimate, and what's a rough planning figure. Simple labeled bars (green/amber/red) communicate this instantly.
- Show the **real benchmark anchors** beside the formula's prediction so learners see the formula is grounded, and see where it drifts.
- End with the honest rule: these estimates get you the right *class/ballpark and budget*; **measure before you bet** (sign the PO, ship the SLA, take the medication — whatever "bet" means for the topic).

This candor is what makes it feel like a $100k course taught by someone who actually ships, not a brochure.

## Worked examples must come from the engine

Don't hand-type example results into prose — they rot and contradict the calculator. Define each scenario as data (`DATA.examples`) and **render the numbers by calling `CALC`** in `calc-ui.js`. Then a change to a constant updates the lessons, the calculator, and the examples together. Each example should walk the full arc the learner will repeat: situation → pick the smallest sufficient option → set targets → run the equations → compare choices → decide, with cost/tradeoffs shown.

## Content discipline: DRY, KISS, YAGNI

- **DRY**: one source of truth for every number; reuse the component classes and chart library; never state a computed value twice from two sources.
- **KISS**: a clear linear path from "I know nothing" to "I can make the decision." Resist tangents.
- **YAGNI**: don't add a module, widget, or chart unless it teaches something the learner needs for the spine. Every interaction should pull its weight.
- **No filler repetition**: restating an idea is fine when it reinforces deliberately (a recap, a cheat sheet); repeating because you didn't plan the flow is not. If two sections say the same thing by accident, cut one.
