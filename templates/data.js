/* =============================================================
   data.js — THE SINGLE SOURCE OF TRUTH for your topic's numbers.
   Everything the app shows (calculators, charts, examples) reads
   from here, so values can never disagree across the page.
   Replace the demo content with your topic's verified data.
   ============================================================= */
window.DATA = {

  /* Tunable constants for your topic (efficiency factors, rates, …).
     Keep them here, not scattered in code, so one edit propagates. */
  CONST: {
    // demo: nothing needed; real topics put calibrated factors here
  },

  /* Example dataset the UI reads. Swap for your topic's presets/devices/etc. */
  demo: { defaultMonthly: 200, defaultYears: 10, defaultRate: 6 },

  /* Cite your sources so learners (and you) can trust the numbers. */
  cite: {
    // example: rule:{n:"Compound interest", u:"https://example.com"}
  }
};
