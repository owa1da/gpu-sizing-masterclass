/* =============================================================
   calc.js — THE EQUATION ENGINE. Pure functions only.
   This is the "spine" of the topic expressed as math: the same
   functions power the live calculators, the charts, AND the worked
   examples, so they can never contradict each other (DRY).
   Replace these demo functions with your topic's real equations.
   Document units explicitly — that's what makes it trustworthy.
   ============================================================= */
(function(){
  // DEMO: savings growth. Inputs: monthly deposit ($), years, annual rate (%).
  function futureValue(monthly, years, annualRatePct){
    const r = annualRatePct/100/12, n = years*12;
    return r === 0 ? monthly*n : monthly*((Math.pow(1+r,n)-1)/r);
  }
  function seriesByYear(monthly, years, annualRatePct){
    const pts=[];
    for(let y=0; y<=years; y++) pts.push([y, futureValue(monthly,y,annualRatePct)]);
    return pts;
  }

  window.CALC = { futureValue, seriesByYear };
})();
