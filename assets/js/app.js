/* =============================================================
   app.js — interaction layer (nav, progress, reveal, gamification)
   Calculator + chart rendering live in calc-ui.js (loaded after data).
   ============================================================= */
(function(){
  "use strict";
  const $=(s,c)=>(c||document).querySelector(s);
  const $$=(s,c)=>Array.from((c||document).querySelectorAll(s));
  let revealObs=null;
  function observeReveals(){ if(revealObs) $$(".reveal:not(.in)").forEach(el=>revealObs.observe(el)); }

  /* ---------- Gamification state ---------- */
  const GS={xp:0,badges:new Set(),quizzes:new Set()};
  const XP_PER_QUIZ=20, XP_PER_SECTION=5;
  function load(){
    try{
      const r=JSON.parse(localStorage.getItem("aihw")||"{}");
      if(r.xp)GS.xp=r.xp; if(r.badges)r.badges.forEach(b=>GS.badges.add(b));
      if(r.quizzes)r.quizzes.forEach(q=>GS.quizzes.add(q));
    }catch(e){}
  }
  function save(){ try{localStorage.setItem("aihw",JSON.stringify({xp:GS.xp,badges:[...GS.badges],quizzes:[...GS.quizzes]}));}catch(e){} }
  function addXP(n){ GS.xp+=n; const v=$("#xpVal"); if(v){v.textContent=GS.xp;v.parentElement.animate?v.parentElement.animate([{transform:"scale(1.18)"},{transform:"scale(1)"}],{duration:280,easing:"ease-out"}):0;} save(); }
  function earn(id){
    if(GS.badges.has(id))return;
    GS.badges.add(id); save();
    const b=$(`[data-badge="${id}"]`); if(b){b.classList.add("earned");toast(b.querySelector(".bn")?.textContent||"Badge unlocked");}
  }
  function refreshBadges(){ GS.badges.forEach(id=>{const b=$(`[data-badge="${id}"]`); if(b)b.classList.add("earned");}); }
  function toast(txt){
    const t=document.createElement("div");
    t.textContent="🏅 "+txt;
    t.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:linear-gradient(120deg,#6d8bff,#b06cff);color:#0a0a15;font-weight:700;padding:12px 22px;border-radius:999px;z-index:200;box-shadow:0 12px 40px rgba(109,139,255,.4);opacity:0;transition:.35s cubic-bezier(.22,.61,.36,1);font-size:.9rem";
    document.body.appendChild(t);
    requestAnimationFrame(()=>{t.style.opacity="1";t.style.transform="translateX(-50%) translateY(0)";});
    setTimeout(()=>{t.style.opacity="0";t.style.transform="translateX(-50%) translateY(20px)";setTimeout(()=>t.remove(),400);},2600);
  }
  window.AIHW={addXP,earn,GS};

  /* ---------- TOC + progress + active section ---------- */
  function buildTOC(){
    const toc=$("#toc"); if(!toc)return;
    $$("section[data-toc]").forEach(sec=>{
      const a=document.createElement("a");
      a.href="#"+sec.id; a.dataset.id=sec.id;
      a.innerHTML=`<span>${sec.dataset.toc}</span>`;
      toc.appendChild(a);
    });
  }
  function onScroll(){
    const h=document.documentElement;
    const scrolled=h.scrollTop/((h.scrollHeight-h.clientHeight)||1);
    const fill=$("#progressFill"); if(fill)fill.style.width=(scrolled*100)+"%";
  }

  /* ---------- Reveal + section tracking via IntersectionObserver ---------- */
  function setupObservers(){
    revealObs=new IntersectionObserver((es)=>{
      es.forEach(e=>{ if(e.isIntersecting){e.target.classList.add("in"); revealObs.unobserve(e.target);} });
    },{threshold:.12,rootMargin:"0px 0px -8% 0px"});
    observeReveals();

    const SECTION_BADGE={'mental-model':'foundations','calculator':'architect','examples':'strategist'};
    const secO=new IntersectionObserver((es)=>{
      es.forEach(e=>{
        if(e.isIntersecting){
          const id=e.target.id;
          $$("#toc a").forEach(a=>a.classList.toggle("active",a.dataset.id===id));
          if(e.target.dataset.toc && !GS.quizzes.has("sec:"+id)){ /* section visit xp once */
            GS.quizzes.add("sec:"+id); addXP(XP_PER_SECTION);
          }
          if(SECTION_BADGE[id]) earn(SECTION_BADGE[id]);
        }
      });
    },{threshold:.5});
    $$("section[data-toc]").forEach(s=>secO.observe(s));
  }

  /* ---------- Count-up numbers ---------- */
  function setupCount(){
    const o=new IntersectionObserver((es)=>{
      es.forEach(e=>{
        if(!e.isIntersecting)return; o.unobserve(e.target);
        const el=e.target, to=parseFloat(el.dataset.to), dec=parseInt(el.dataset.dec||"0");
        const pre=el.dataset.prefix||"", suf=el.dataset.suffix||"", dur=900; let st=null;
        function step(ts){ st=st||ts; const p=Math.min((ts-st)/dur,1); const eased=1-Math.pow(1-p,3);
          el.textContent=pre+(to*eased).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g,",")+suf;
          if(p<1)requestAnimationFrame(step); }
        requestAnimationFrame(step);
      });
    },{threshold:.6});
    $$(".count[data-to]").forEach(el=>o.observe(el));
  }

  /* ---------- Quiz engine ---------- */
  function setupQuiz(){
    $$(".quiz").forEach(q=>{
      const id=q.dataset.quiz||Math.random().toString(36).slice(2);
      const opts=$$(".opt",q), explain=$(".explain",q);
      let answered=GS.quizzes.has("q:"+id);
      if(answered){ /* reveal prior state lightly */ }
      opts.forEach(opt=>{
        opt.addEventListener("click",()=>{
          if(opt.disabled)return;
          const correct=opt.dataset.correct==="1";
          opts.forEach(o=>{o.disabled=true; if(o.dataset.correct==="1")o.classList.add("correct");});
          if(!correct)opt.classList.add("wrong");
          if(explain)explain.classList.add("show");
          if(!GS.quizzes.has("q:"+id)){
            GS.quizzes.add("q:"+id); save();
            if(correct){addXP(XP_PER_QUIZ);} else {addXP(5);}
            const allQ=$$(".quiz").length, doneQ=[...GS.quizzes].filter(x=>x.startsWith("q:")).length;
            if(doneQ>=Math.min(3,allQ)) earn("quizzer");
            if(doneQ>=allQ && allQ>0) earn("scholar");
            if(correct && q.dataset.badge) earn(q.dataset.badge);
          }
        });
      });
    });
  }

  /* ---------- Smooth anchor + back-to-top ---------- */
  function setupNav(){
    $$('a[href^="#"]').forEach(a=>{
      a.addEventListener("click",e=>{
        const id=a.getAttribute("href").slice(1); const t=document.getElementById(id);
        if(t){e.preventDefault(); t.scrollIntoView({behavior:"smooth",block:"start"});}
      });
    });
  }

  /* ---------- Reset progress ---------- */
  function setupReset(){
    const r=$("#resetBtn"); if(!r)return;
    r.addEventListener("click",()=>{
      GS.xp=0;GS.badges.clear();GS.quizzes.clear();save();
      location.reload();
    });
  }

  /* ---------- Boot ---------- */
  function boot(){
    load();
    buildTOC(); setupObservers(); setupCount(); setupQuiz(); setupNav(); setupReset();
    refreshBadges();
    const v=$("#xpVal"); if(v)v.textContent=GS.xp;
    window.addEventListener("scroll",onScroll,{passive:true}); onScroll();
    // hand off to calculator/charts module if present
    if(window.CalcUI && typeof window.CalcUI.init=="function"){ try{window.CalcUI.init();}catch(e){console.error("CalcUI",e);} }
    observeReveals();
  }
  if(document.readyState!=="loading")boot(); else document.addEventListener("DOMContentLoaded",boot);
})();
