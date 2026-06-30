/* =============================================================
   calc-ui.js — wires interactive widgets to CALC + Charts.
   The UI layer does NO math of its own: it reads inputs, calls
   CALC, and renders. Add one function per interactive lab, then
   call it from init(). app.js invokes CalcUI.init() on load.
   ============================================================= */
(function(){
  const $ = id => document.getElementById(id);
  const D = () => window.DATA, C = () => window.CALC, CH = () => window.Charts;

  /* DEMO widget: savings calculator (slider -> live readout -> chart) */
  function savings(){
    const m=$("d-monthly"), y=$("d-years"), r=$("d-rate");
    if(!m) return;                                   // guard: only run if present
    function upd(){
      const monthly=+m.value, years=+y.value, rate=+r.value;
      const fv = C().futureValue(monthly, years, rate);
      $("d-monthly-val").textContent = "$"+monthly;
      $("d-years-val").textContent   = years+" yr";
      $("d-rate-val").textContent    = rate+"%";
      $("d-out").innerHTML = `$${Math.round(fv).toLocaleString()} <span class="u">after ${years} yrs</span>`;
      CH().line("d-chart", {
        yLabel:"$ balance", xLabel:"years",
        series:[{ name:"Balance", color:"#6d8bff", points: C().seriesByYear(monthly,years,rate) }]
      });
    }
    [m,y,r].forEach(el => el.addEventListener("input", upd));
    upd();                                           // render initial state
  }

  function init(){
    if(!window.DATA || !window.CALC || !window.Charts) return;
    savings();
    // add your other widget initializers here: weights(); throughput(); masterCalc(); …
  }
  window.CalcUI = { init };
})();
