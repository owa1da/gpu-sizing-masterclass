# Architecture & Build

How to structure the app so it's robust, maintainable, and trustworthy. Read this before writing code.

## The deliverable

One **self-contained single-page web app** the learner opens by double-clicking — no server, no build step, no internet. This matters: your audience (a founder, a CTO, a curious learner) should be able to open it on a plane and on any machine. Robustness is a feature.

## file:// constraints (non-negotiable)

Because it runs from `file://`, avoid anything that needs a server:

- **No ES modules** (`import`/`export`, `<script type="module">`) — they hit CORS on `file://`. Use plain `<script>` tags that attach to `window` (e.g. `window.DATA`, `window.CALC`).
- **No `fetch()` of local files** — also blocked. Put all data inline in `data.js`.
- **No CDNs** — a CDN fails offline. Vendor everything. For charts, use the bundled hand-rolled SVG library (`charts.js`), not Chart.js/D3.
- **System fonts only** — no web-font network calls. The bundled `styles.css` uses an SF/Segoe/Roboto stack that looks great everywhere.
- **Guard `localStorage`** in `try/catch` (some browsers restrict it on `file://`). The bundled `app.js` already does.

These aren't limitations to resent — they're what make the result bulletproof and instantly shareable.

## File layout

```
index.html                 structure only: the shell + all section markup
assets/css/styles.css      design system (copy templates/styles.css, retune tokens)
assets/js/data.js          SINGLE SOURCE OF TRUTH — every number lives here
assets/js/calc.js          THE EQUATION ENGINE — pure functions, the topic's math
assets/js/charts.js        SVG chart library (copy templates/charts.js verbatim)
assets/js/calc-ui.js       wires widgets to CALC + Charts; renders examples
assets/js/app.js           chrome: nav, scroll progress, reveal, XP/badges/quiz (copy verbatim)
```

`charts.js`, `app.js`, and `styles.css` are **topic-agnostic** — copy them from `templates/` and reuse as-is (retune the CSS color tokens for a new brand if you like). You only ever write three files per topic: `data.js`, `calc.js`, `calc-ui.js`.

## The DRY engine pattern (the heart of it)

The reason the GPU masterclass can claim "the calculator, the charts, and the worked examples never disagree" is a strict separation:

1. **`data.js` — facts.** Constants, presets, device/option tables, example scenarios, citations. Nothing computes here. One place to edit a number.
2. **`calc.js` — math.** Pure functions only: inputs in, numbers out, no DOM. This *is* the topic, expressed as equations. Because everything calls these same functions, a calculator and a worked example can't drift apart.
3. **`calc-ui.js` — wiring.** Reads control values → calls `CALC` → writes readouts and calls `Charts`. Does no math itself. One small function per interactive lab, all invoked from `init()`.
4. **`charts.js` — rendering.** Dumb: give it data, it draws SVG.
5. **`app.js` — chrome.** Everything not topic-specific: TOC dots, scroll progress, reveal-on-scroll, count-ups, the quiz engine, XP and badges. Driven by classes/attributes in the HTML, so you rarely touch it.

**Load order in `index.html` (bottom of `<body>`):** `data.js → calc.js → charts.js → calc-ui.js → app.js`. `app.js` calls `CalcUI.init()` on `DOMContentLoaded`, which renders every widget's initial state.

### Minimal skeletons

`data.js`:
```js
window.DATA = {
  CONST: { /* calibrated factors for your topic */ },
  items: [ /* presets/devices/options the UI lists */ ],
  examples: [ /* scenario objects for worked walkthroughs */ ],
  cite: { key:{n:"Source name", u:"https://…"} }
};
```

`calc.js` (pure):
```js
(function(){
  function metric(a, b){ return a * b; }        // your real equation
  window.CALC = { metric };
})();
```

`calc-ui.js` (one function per lab, guarded so a missing element never throws):
```js
(function(){
  const $=id=>document.getElementById(id);
  function widget(){
    const x=$("x"); if(!x) return;
    function upd(){ $("out").textContent = window.CALC.metric(+x.value, 2); }
    x.addEventListener("input", upd); upd();
  }
  function init(){ if(!window.DATA||!window.CALC||!window.Charts) return; widget(); }
  window.CalcUI={init};
})();
```

See `templates/{data,calc,calc-ui}.js` for a complete runnable demo, and the repo's `assets/js/*` for a full real example.

## Build it incrementally

Hand-authoring one giant file is error-prone. Instead:

1. Drop the shell into `index.html` (topbar, progress rail, `#toc`, hero, footer, scripts) with an HTML comment marker like `<!--SECTIONS-->` between hero and footer.
2. Insert one module at a time by replacing the marker with `module HTML + <!--SECTIONS-->` again. You keep a stable insertion point and never re-read the whole file.
3. Build concept/static modules first (no numbers needed), then the data/calc/calc-ui once your facts are verified. You can scaffold CSS and `charts.js`/`app.js` (topic-agnostic) up front while research is still running — good use of parallel time.

## Verify before you call it done

Catch breakage with the headless browser already on most machines:

```bash
# syntax
for f in assets/js/*.js; do node --check "$f"; done

# render + grep the live DOM (JS runs; confirms widgets/charts/examples populated, no NaN)
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=6000 \
  --dump-dom "file://$PWD/index.html" > /tmp/dom.html 2>/tmp/err.txt
grep -iE "uncaught|is not a function|cannot read|typeerror" /tmp/err.txt   # expect none
grep -io "NaN\|\[object Object\]" /tmp/dom.html                            # expect none

# screenshot to eyeball styling (Read the PNG)
"$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1440,2000 --screenshot=/tmp/shot.png "file://$PWD/index.html"
```

Tips: to capture lower sections in a tall screenshot, temporarily inject `<style>.hero{display:none}.reveal{opacity:1!important;transform:none!important}</style>` into a throwaway copy (reveals are otherwise hidden until scrolled into view). Spot-check a couple of computed numbers against a hand calculation. Check one mobile width (e.g. 430px) — inline `grid-template-columns:repeat(N,1fr)` overrides the responsive collapse, so prefer `repeat(auto-fit,minmax(185px,1fr))`.
