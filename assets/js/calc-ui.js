/* =============================================================
   calc-ui.js — wires interactive widgets to CALC + Charts.
   Loaded after data/calc/charts; invoked by app.js boot().
   ============================================================= */
(function(){
  const $=id=>document.getElementById(id);
  const D=()=>window.DATA, C=()=>window.CALC, CH=()=>window.Charts;
  const COL=["#6d8bff","#b06cff","#38e0d0","#ffc24b","#ff6b81"];
  const SAT_BATCH=50;           // teaching: effective batch where decode saturates
  const fmt=n=> (window.Charts?window.Charts.fmt(n):n);
  const commas=n=>Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
  function bpw(key){ const p=D().precisions.find(p=>p.key===key); return p?p.bpw:2; }
  function precLabel(key){ const p=D().precisions.find(p=>p.key===key); return p?p.label:key; }

  // generic segmented control
  function seg(el,cb){
    if(!el)return;
    el.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click",()=>{
        el.querySelectorAll("button").forEach(x=>x.classList.remove("active"));
        b.classList.add("active"); cb(b.dataset);
      });
    });
  }

  /* ---------- precision cheat-sheet table ---------- */
  function precTable(){
    const tb=$("prec-table"); if(!tb)return;
    tb.innerHTML=D().precisions.map(p=>{
      const tag = p.q==="ok"?"ok":"warn";
      return `<tr><td><b>${p.label}</b><span class="sub">${p.bits} bits</span></td>
        <td class="mono">${p.bpw.toFixed(2)} GB</td>
        <td><span class="tag ${tag}">${p.quality}</span></td></tr>`;
    }).join("");
  }

  /* ---------- Module 3: weights ---------- */
  function weights(){
    const sz=$("wt-size"); if(!sz)return;
    let state={size:8,prec:"fp16"};
    function upd(){
      const w=state.size*bpw(state.prec);
      const disk=C().diskGB(state.size*bpw(state.prec),1);
      $("wt-size-val").textContent=state.size+"B";
      $("wt-prec-val").textContent=precLabel(state.prec);
      const p=D().precisions.find(p=>p.key===state.prec);
      $("wt-prec-hint").textContent=`${p.quality} · ${p.bpw} bytes / weight`;
      $("wt-weights").innerHTML=`${fmt(w)} <span class="u">GB</span>`;
      $("wt-disk").innerHTML=`${fmt(disk)} <span class="u">GB</span>`;
      $("wt-eq").innerHTML=`<span class="hl">weights_GB</span> = ${state.size}B × ${p.bpw} bytes = <span class="res">${w.toFixed(1)} GB</span>\n<span class="hl">disk_GB</span>    = ${w.toFixed(1)} × 1.2 = <span class="res">${disk.toFixed(1)} GB</span>`;
      CH().vbars("wt-chart",{unit:"GB in memory",data:[
        {label:"FP16",value:state.size*2,color:COL[0]},
        {label:"INT8/FP8",value:state.size*1,color:COL[1]},
        {label:"Q4",value:state.size*0.6,color:COL[2]}
      ]});
    }
    sz.addEventListener("input",()=>{state.size=+sz.value;upd();});
    seg($("wt-prec"),d=>{state.prec=d.prec;upd();});
    upd();
  }

  /* ---------- Module 4: KV cache ---------- */
  function kv(){
    const sel=$("kv-model"); if(!sel)return;
    sel.innerHTML=D().models.map(m=>`<option value="${m.id}">${m.name}</option>`).join("");
    const usr=$("kv-users"), ctx=$("kv-ctx");
    const KVD={2:{label:"FP16",hint:"2 bytes per K/V value · reference, lossless"},1:{label:"FP8",hint:"1 byte per K/V value · near-lossless, ~½ the KV"},0.5:{label:"INT4",hint:"0.5 bytes per K/V value · aggressive, ~¼ the KV — may cost quality"}};
    let kvBytes=2;
    function baseModel(){ return D().models.find(m=>m.id===sel.value); }
    function syncSeg(){ const s=$("kv-dtype"); if(s)s.querySelectorAll("button").forEach(b=>b.classList.toggle("active",+b.dataset.kvb===kvBytes));
      if($("kv-dtype-val"))$("kv-dtype-val").textContent=KVD[kvBytes].label; if($("kv-dtype-hint"))$("kv-dtype-hint").textContent=KVD[kvBytes].hint; }
    function upd(){
      const m={...baseModel(), kvBytes}, users=+usr.value, c=+ctx.value;
      const perTokMB=D().kvPerTokenMB(m);
      const kvGB=C().kvGB(users,c,m);
      const w=C().weightsGB(m.paramsB,bpw(m.prec));
      const oh=C().overheadGB(w+kvGB);
      const vram=w+kvGB+oh;
      $("kv-model-val").textContent=m.name;
      $("kv-arch").textContent=`${m.layers} layers · ${m.kvHeads} KV heads · dim ${m.headDim} · ${m.moe?"MoE":"GQA"} · ${precLabel(m.prec)} weights${m.kvNote?" · "+m.kvNote:""}`;
      $("kv-users-val").textContent=users;
      $("kv-ctx-val").textContent=commas(c);
      $("kv-pertok").innerHTML=`${perTokMB.toFixed(3)} <span class="u">MB</span>`;
      $("kv-total").innerHTML=`${fmt(kvGB)} <span class="u">GB</span>`;
      $("kv-vram").innerHTML=`${fmt(vram)} <span class="u">GB</span>`;
      $("kv-w").innerHTML=`${fmt(w)} <span class="u">GB</span>`;
      CH().hstack("kv-membar",{unit:"GB",segments:[
        {label:"Weights",value:w,color:COL[0]},
        {label:"KV cache",value:kvGB,color:COL[1]},
        {label:"Overhead",value:oh,color:COL[3]}
      ]});
      // VRAM vs users line
      const pts=[1,10,25,50,100,150,200].map(u=>[u, w+oh+C().kvGB(u,c,m)]);
      CH().line("kv-chart",{yLabel:"VRAM (GB)",xLabel:"concurrent users",series:[{name:"VRAM",color:COL[2],points:pts}]});
    }
    sel.addEventListener("change",()=>{ kvBytes=baseModel().kvBytes||2; syncSeg(); upd(); });
    usr.addEventListener("input",upd); ctx.addEventListener("input",upd);
    seg($("kv-dtype"),d=>{ kvBytes=+d.kvb; syncSeg(); upd(); });
    kvBytes=baseModel().kvBytes||2; syncSeg(); upd();
  }

  /* ---------- Module 5: throughput ---------- */
  function throughput(){
    const bw=$("tp-bw"); if(!bw)return;
    let state={bw:3350,size:8,prec:"fp16",users:32};
    const presetBtns=[...$("tp-bw-presets").querySelectorAll("button")];
    const findDev=v=>{ const b=presetBtns.find(x=>+x.dataset.bw===v); return b&&b.dataset.mem?{mem:+b.dataset.mem,kind:b.dataset.kind,name:b.dataset.name}:null; };
    function renderFit(wGB){
      const el=$("tp-fit"); if(!el) return;
      const dev=findDev(state.bw);
      if(dev && wGB>C().usableMem(dev.mem,dev.kind)){
        const n=Math.ceil(wGB/C().usableMem(dev.mem,dev.kind));
        el.innerHTML=`<span style="color:var(--warn);font-weight:600">⚠ ${state.size}B ${precLabel(state.prec)} ≈ ${fmt(wGB)} GB won't fit one ${dev.name} (${dev.mem} GB)</span> — you'd need ~${n} GPUs. See the <a href="#calculator">Master Calculator</a>.`;
      } else { el.innerHTML=""; }
    }
    const RATIO=0.30; // representative tensor-GPU FLOP:byte ratio: peak TFLOPS ≈ 0.30 × bandwidth(GB/s)
    function aggAt(single,cap,u){ return Math.min(u*single,cap); }
    function upd(){
      const wGB=state.size*bpw(state.prec);
      const single=C().singleStreamTps(state.bw,wGB,D().CONST.mbuDecode);
      const cap=C().decodeComputeCapTps(state.bw*RATIO,state.size,D().CONST.mfuPrefill);
      const agg=aggAt(single,cap,state.users);
      const per=agg/state.users;
      $("tp-bw-val").textContent=commas(state.bw)+" GB/s";
      $("tp-size-val").textContent=state.size+"B";
      $("tp-prec-val").textContent=precLabel(state.prec);
      $("tp-users-val").textContent=state.users;
      $("tp-agg").innerHTML=`${fmt(agg)} <span class="u">tok/s</span>`;
      $("tp-peruser").innerHTML=`${fmt(per)} <span class="u">tok/s</span>`;
      const knee = single>0 ? cap/single : 0;            // B*: crossover batch (concurrent requests)
      const computeBound = state.users >= knee;
      $("tp-bound").textContent = computeBound ? "Compute-bound · saturated" : "Bandwidth-bound · scaling";
      $("tp-bound").style.color = computeBound ? "var(--warn)" : "var(--accent-3)";
      $("tp-bstar").innerHTML = (knee>=1?Math.round(knee):"<1") + ' <span class="u">users</span>';
      renderFit(wGB);
      const pts=[1,4,8,16,32,64,128,200,256].map(u=>[u, aggAt(single,cap,u)]);
      CH().line("tp-chart",{yLabel:"total tok/s",xLabel:"concurrent users",series:[{name:"Aggregate throughput",color:COL[0],points:pts}]});
    }
    bw.addEventListener("input",()=>{state.bw=+bw.value;syncBw();upd();});
    function syncBw(){ $("tp-bw-presets").querySelectorAll("button").forEach(b=>b.classList.toggle("active",+b.dataset.bw===state.bw)); }
    seg($("tp-bw-presets"),d=>{state.bw=+d.bw;bw.value=state.bw;upd();});
    $("tp-size").addEventListener("input",e=>{state.size=+e.target.value;upd();});
    seg($("tp-prec"),d=>{state.prec=d.prec;upd();});
    $("tp-users").addEventListener("input",e=>{state.users=+e.target.value;upd();});
    upd();
  }

  /* ---------- Module 6: TTFT ---------- */
  function ttft(){
    const tf=$("tt-tf"); if(!tf)return;
    let state={tf:990,size:8,prompt:1000};
    function upd(){
      const prefillTps=C().prefillTps(state.tf,state.size,D().CONST.mfuPrefill);
      const t=C().ttft(state.prompt,state.tf,state.size,0,D().CONST.mfuPrefill);
      $("tt-tf-val").textContent=commas(state.tf)+" TFLOPS";
      $("tt-size-val").textContent=state.size+"B";
      $("tt-prompt-val").textContent=commas(state.prompt);
      $("tt-ttft").innerHTML=`${t<1?(t*1000).toFixed(0):t.toFixed(2)} <span class="u">${t<1?"ms":"s"}</span>`;
      $("tt-prefill").innerHTML=`${commas(prefillTps)} <span class="u">tok/s</span>`;
      const pts=[256,1000,2000,4000,8000,16000,32000].map(p=>[p, C().ttft(p,state.tf,state.size,0,D().CONST.mfuPrefill)]);
      CH().line("tt-chart",{yLabel:"TTFT (s)",xLabel:"prompt length (tokens)",target:{value:state.prompt? C().ttft(state.prompt,state.tf,state.size,0,D().CONST.mfuPrefill):1,label:""},series:[{name:"TTFT",color:COL[4],points:pts}]});
    }
    tf.addEventListener("input",()=>{state.tf=+tf.value;upd();});
    seg($("tt-tf-presets"),d=>{state.tf=+d.tf;tf.value=state.tf;upd();});
    $("tt-size").addEventListener("input",e=>{state.size=+e.target.value;upd();});
    $("tt-prompt").addEventListener("input",e=>{state.prompt=+e.target.value;upd();});
    upd();
  }

  /* ---------- Module 7: MoE illustration ---------- */
  function moe(){
    const el=$("moe-chart"); if(!el)return;
    const bw=1000, mbu=D().CONST.mbuDecode;
    const tps=(activeB)=> mbu*bw/(activeB*2);
    CH().vbars("moe-chart",{unit:"tok/s on a 1 TB/s GPU",data:[
      {label:"Dense 37B",value:tps(37),color:COL[4],sub:"uses all 37B"},
      {label:"MoE 37B/10B",value:tps(10),color:COL[0],sub:"uses ~10B"},
      {label:"Dense 10B",value:tps(10),color:COL[2],sub:"reference"}
    ]});
  }

  /* ---------- shared helpers for devices + master calc ---------- */
  function shortName(d){ return d.name.replace(" Blackwell","").replace(" SXM","").replace(" (Blackwell)",""); }
  function kfmt(n){ return n>=1000 ? "$"+(n/1000).toFixed(n>=10000?0:1)+"k" : "$"+n; }
  // rough $/1M tokens: cloud rate if rented, else 3-yr amortized buy + power @ $0.15/kWh
  function perMTok(d,r){ if(!r.aggregateTps||r.aggregateTps<=0)return null; const units=r.devicesNeeded;
    const ownHr=d.priceUSD/(3*365*24)+(d.tdp/1000)*0.15; const hr=(d.cloudHr||ownHr)*units;
    return hr/(r.aggregateTps*3600)*1e6; }
  // best (fastest) native compute format per device — Blackwell FP4, Hopper FP8, Ampere/Apple FP16
  const FP4_DEVICES={rtx5080:1,rtx5090:1,rtxpro6000:1,b200:1};
  function computeFormats(d){ if(!d)return["FP16"]; if(d.kind==="apple")return["FP16"]; if(FP4_DEVICES[d.id])return["FP4","FP8","FP16"]; if(d.fp8TF)return["FP8","FP16"]; return["FP16"]; }
  function bestCompute(d){ return computeFormats(d)[0]; }

  /* ---------- Module 10: devices (cards, table, charts) ---------- */
  function devicesUI(){
    const cards=$("device-cards");
    if(cards){
      cards.innerHTML=D().devices.map(d=>{
        const tag=d.kind==="apple"?'<span class="tag apple">Apple</span>':'<span class="tag nv">NVIDIA</span>';
        const tbs=d.bwGBps>=1000?(d.bwGBps/1000).toFixed(2).replace(/0$/,'')+" TB/s":d.bwGBps+" GB/s";
        return `<div class="card hov reveal"><div class="flex between aic" style="margin-bottom:8px">${tag}<span class="price">${kfmt(d.priceUSD)}</span></div>
          <h3 style="margin-bottom:4px">${d.name}</h3>
          <p style="font-size:.88rem;margin-bottom:12px">${d.note}</p>
          <div class="spec-grid">
            <div class="sp"><div class="k">Memory</div><div class="v">${d.memGB} GB</div></div>
            <div class="sp"><div class="k">Bandwidth</div><div class="v">${tbs}</div></div>
            <div class="sp"><div class="k">FP16 compute</div><div class="v">${d.fp16TF} TFLOPS</div></div>
            <div class="sp"><div class="k">Power</div><div class="v">${d.tdp} W</div></div>
          </div>
          <p class="src mt8">${d.eco} · <a href="${d.src}" target="_blank" rel="noopener">specs ↗</a>${d.priceSrc?` · <a href="${d.priceSrc}" target="_blank" rel="noopener">price ↗</a>`:""}${d.approx?" · approx.":""}</p></div>`;
      }).join("");
    }
    const tb=$("device-table");
    if(tb){
      tb.innerHTML=D().devices.map(d=>`<tr><td><b>${d.name}</b><span class="sub">${d.memCfg}</span></td>
        <td>${d.memGB} GB</td><td>${commas(d.bwGBps)} GB/s</td><td>${d.fp16TF}</td><td class="mono">${kfmt(d.priceUSD)}</td>
        <td>${d.kind==="apple"?'<span class="tag apple">MLX / Metal</span>':'<span class="tag nv">CUDA</span>'}</td></tr>`).join("");
    }
    const ids=["macmini4","macmini4pro","mbpm5max","studioultra","rtx5090","rtxpro6000","h100","h200"];
    const ds=ids.map(i=>D().devices.find(d=>d.id===i)).filter(Boolean);
    const colf=d=>d.kind==="apple"?"#b06cff":"#6d8bff";
    if($("dev-mem-chart"))CH().vbars("dev-mem-chart",{unit:"GB",data:ds.map(d=>({label:shortName(d),value:d.memGB,color:colf(d)}))});
    if($("dev-bw-chart"))CH().vbars("dev-bw-chart",{unit:"GB/s",data:ds.map(d=>({label:shortName(d),value:d.bwGBps,color:colf(d)}))});
    const pe=$("dev-price-chart");
    if(pe){
      const all=D().devices.slice().sort((a,b)=>a.priceUSD-b.priceUSD);
      const max=Math.sqrt(all[all.length-1].priceUSD);
      pe.innerHTML=all.map(d=>`<div style="display:flex;align-items:center;gap:10px;margin:7px 0">
        <span style="width:150px;font-size:.82rem;color:var(--muted);flex:0 0 auto">${shortName(d)}</span>
        <span style="flex:1;height:13px;background:var(--surface-3);border-radius:7px;overflow:hidden"><span style="display:block;height:100%;width:${(Math.sqrt(d.priceUSD)/max*100).toFixed(1)}%;background:linear-gradient(90deg,${colf(d)},${colf(d)}aa)"></span></span>
        <b style="font-size:.82rem;width:60px;text-align:right">${kfmt(d.priceUSD)}</b></div>`).join("");
    }
  }

  /* ---------- Module 9: master calculator ---------- */
  function masterCalc(){
    const ms=$("mc-model"); if(!ms)return;
    ms.innerHTML=D().models.map(m=>`<option value="${m.id}">${m.name}</option>`).join("")+`<option value="__custom__">＋ Custom model…</option>`;
    const dv=$("mc-device");
    dv.innerHTML=D().devices.map(d=>`<option value="${d.id}">${d.name} · ${d.memGB}GB</option>`).join("")+`<option value="__custom__">＋ Custom device…</option>`;
    ms.value="qwen32b"; dv.value="h100";
    const st={prec:"q4",users:16,ctx:8192,prompt:2000};
    const num=(id,def)=>{ const el=$(id), v=el?parseFloat(el.value):NaN; return isFinite(v)&&v>0?v:def; };
    function customModel(){
      const tot=num("cm-total",0); if(!tot) return null; const act=num("cm-active",tot);
      return {id:"__custom__",name:"Custom model",paramsB:tot,activeB:Math.min(act,tot),
        layers:num("cm-layers",48),kvHeads:num("cm-kvheads",8),headDim:num("cm-headdim",128),
        kvBytes:num("cm-kvbytes",2),moe:act<tot,prec:st.prec};
    }
    function customDevice(){
      const mem=num("cd-mem",0), bw=num("cd-bw",0), fp16=num("cd-fp16",0); if(!mem||!bw||!fp16) return null;
      const fp8=num("cd-fp8",0), kind=($("cd-kind")&&$("cd-kind").value)||"nvidia";
      return {id:"__custom__",name:"Custom device",memGB:mem,memCfg:"custom specs",
        bwGBps:bw,fp16TF:fp16,fp8TF:fp8>0?fp8:undefined,
        kind:kind,eco:kind==="apple"?"Metal / MLX":"Custom · CUDA",priceUSD:0,tdp:0};
    }
    function curModel(){ return ms.value==="__custom__"?customModel():D().models.find(x=>x.id===ms.value); }
    function curDevice(){ return dv.value==="__custom__"?customDevice():D().devices.find(d=>d.id===dv.value); }
    function upd(){
      $("mc-cm-panel").style.display = ms.value==="__custom__"?"block":"none";
      $("mc-cd-panel").style.display = dv.value==="__custom__"?"block":"none";
      const m=curModel(), dev=curDevice();
      if(!m || !dev){
        ["mc-vram","mc-ndev","mc-peruser","mc-agg","mc-bstar","mc-ttft-out","mc-disk"].forEach(id=>{const el=$(id);if(el)el.innerHTML="—";});
        $("mc-prec-val").textContent=precLabel(st.prec);
        $("mc-users-val").textContent=st.users; $("mc-ctx-val").textContent=commas(st.ctx); $("mc-prompt-val").textContent=commas(st.prompt);
        $("mc-model-hint").textContent = m?`${m.paramsB}B${m.moe?` (MoE · ${m.activeB}B active)`:""} · ${m.layers}L / ${m.kvHeads} KV heads`:"↑ enter total params to define the model";
        $("mc-device-hint").textContent = dev?`${dev.memGB}GB · ${commas(dev.bwGBps)} GB/s · ${dev.eco}`:"↑ enter memory, bandwidth & FP16 TFLOPS";
        $("mc-moe-note").style.display="none"; $("mc-compute-note").innerHTML="";
        const vv=$("mc-verdict"); vv.className="verdict mt24 tight";
        vv.querySelector(".vic").textContent="…"; vv.querySelector(".vt").textContent="Enter your custom specs above";
        vv.querySelector(".vs").textContent=`Fill in the ${(!m&&!dev)?"model and device":(!m?"model":"device")} fields to size this.`;
        $("mc-membar").innerHTML=""; $("mc-fit").innerHTML="";
        return;
      }
      const s={paramsTotalB:m.paramsB,paramsActiveB:m.activeB,bytesPerWeight:bpw(st.prec),
        model:{layers:m.layers,kvHeads:m.kvHeads,headDim:m.headDim,kvBytes:m.kvBytes},
        users:st.users,ctxTokens:st.ctx,promptTokens:st.prompt};
      const r=C().evaluate(s,dev);
      const _activeB=s.paramsActiveB||s.paramsTotalB, _awGB=C().weightsGB(_activeB,s.bytesPerWeight);
      const bstar=Math.round(C().decodeComputeCapTps(dev.fp16TF,_activeB)/C().singleStreamTps(dev.bwGBps,_awGB));
      $("mc-model-hint").textContent=`${m.paramsB}B${m.moe?` (MoE · ${m.activeB}B active)`:""} · ${m.layers}L / ${m.kvHeads} KV heads`;
      $("mc-prec-val").textContent=precLabel(st.prec);
      $("mc-device-hint").textContent=`${dev.memGB}GB · ${commas(dev.bwGBps)} GB/s · ${dev.eco}`;
      const moeNote=$("mc-moe-note");
      if(m.moe){ moeNote.style.display="block"; moeNote.innerHTML=`⚠ <b>MoE</b> — memory sizes on <b>${m.paramsB}B total</b>, but speed &amp; TTFT use only <b>${m.activeB}B active</b> (≈${(m.paramsB/m.activeB).toFixed(1)}× lighter compute than its size).`; }
      else moeNote.style.display="none";
      const cf=bestCompute(dev);
      $("mc-compute-note").innerHTML=`⚙ <b>${shortName(dev)}</b>'s fastest compute format is <b>${cf}</b>. Your <b>${precLabel(st.prec)}</b> sets the model's weight <i>storage</i> — the GPU does the math in its own format, independent of that choice.`;
      $("mc-users-val").textContent=st.users; $("mc-ctx-val").textContent=commas(st.ctx);
      $("mc-prompt-val").textContent=commas(st.prompt);
      $("mc-vram").innerHTML=`${fmt(r.requiredVRAM)} <span class="u">GB</span>`;
      $("mc-ndev").innerHTML=`${r.devicesNeeded}× <span class="u">${shortName(dev)}</span>`;
      $("mc-peruser").innerHTML=`${fmt(r.perUserTps)} <span class="u">tok/s</span>`;
      $("mc-agg").innerHTML=`${fmt(r.aggregateTps)} <span class="u">tok/s</span>`;
      $("mc-bstar").innerHTML=`${bstar>=1?commas(bstar):"<1"} <span class="u">users</span>`;
      $("mc-ttft-out").innerHTML= r.ttft<1?`${(r.ttft*1000).toFixed(0)} <span class="u">ms</span>`:`${r.ttft.toFixed(2)} <span class="u">s</span>`;
      $("mc-disk").innerHTML=`${fmt(r.diskGB)} <span class="u">GB</span>`;
      const v=$("mc-verdict");
      v.className="verdict mt24 "+(r.verdict==="fit"?"fit":r.verdict==="tight"?"tight":"nofit");
      let icon,vt,vs;
      if(r.verdict==="nofit"){icon="✕";vt="Doesn't fit on this device";vs=`Needs ${fmt(r.requiredVRAM)} GB but one ${shortName(dev)} offers only ${fmt(r.usablePerDevice)} GB usable. Quantize harder, choose more memory, or shard across ${r.devicesNeeded} units.`;}
      else if(r.verdict==="tight"){icon="!";vt="Workable — multi-GPU";vs=`Fits, but needs ${r.devicesNeeded}× ${shortName(dev)} (tensor-parallel). Simpler if it fit on one unit — more memory or harder quantization gets you there.`;}
      else {icon="✓";vt="Great fit";vs=`Fits on a single ${shortName(dev)} with headroom (${fmt(r.requiredVRAM)} of ${fmt(r.usablePerDevice)} GB usable).`;}
      v.querySelector(".vic").textContent=icon; v.querySelector(".vt").textContent=vt; v.querySelector(".vs").textContent=vs;
      CH().hstack("mc-membar",{unit:"GB",capacity:+r.totalUsable.toFixed(0),capLabel:`usable (${r.devicesNeeded}× ${shortName(dev)})`,segments:[
        {label:"Weights",value:r.weightsGB,color:COL[0]},{label:"KV cache",value:r.kvGB,color:COL[1]},{label:"Overhead",value:r.overheadGB,color:COL[3]}]});
      const pool=dv.value==="__custom__"?D().devices.concat([dev]):D().devices;
      const rows=pool.map(d=>({d,rr:C().evaluate(s,d)}))
        .sort((a,b)=> (a.rr.memFit===b.rr.memFit? (a.rr.devicesNeeded-b.rr.devicesNeeded)||(a.d.priceUSD*a.rr.devicesNeeded-b.d.priceUSD*b.rr.devicesNeeded) : (a.rr.memFit?-1:1)));
      $("mc-fit").innerHTML=rows.map(({d,rr})=>{
        const fits=rr.memFit, buy=d.priceUSD*rr.devicesNeeded, priced=d.priceUSD>0;
        const cost=fits&&priced?kfmt(buy)+(d.cloudHr?`<span class="sub">~$${(d.cloudHr*rr.devicesNeeded).toFixed(1)}/hr cloud</span>`:""):"—";
        const fitTag=!fits?'<span class="tag bad">no</span>':rr.devicesNeeded>1?`<span class="tag warn">${rr.devicesNeeded}× yes</span>`:'<span class="tag ok">yes</span>';
        const sel=d.id===dv.value?' style="background:rgba(109,139,255,.08)"':'';
        return `<tr${sel}><td><b>${d.name}</b></td><td>${d.memGB}GB</td><td>${fitTag}</td><td>${fits?rr.devicesNeeded:"—"}</td><td>${fits?fmt(rr.perUserTps):"—"}</td><td class="mono">${cost}</td><td class="mono">${fits&&priced&&perMTok(d,rr)?("$"+perMTok(d,rr).toFixed(2)):"—"}</td></tr>`;
      }).join("");
    }
    ms.addEventListener("change",upd); dv.addEventListener("change",upd);
    seg($("mc-prec"),d=>{st.prec=d.prec;upd();});
    $("mc-users").addEventListener("input",e=>{st.users=+e.target.value;upd();});
    // Avg prompt can't exceed the context window — its slider range tracks Context/user.
    function syncPromptRange(){ const p=$("mc-prompt"); if(!p)return; p.max=st.ctx; if(st.prompt>st.ctx){ st.prompt=st.ctx; p.value=st.ctx; } }
    $("mc-ctx").addEventListener("input",e=>{ st.ctx=+e.target.value; syncPromptRange(); upd(); });
    $("mc-prompt").addEventListener("input",e=>{ st.prompt=+e.target.value; upd(); });
    ["cm-total","cm-active","cm-layers","cm-kvheads","cm-headdim","cm-kvbytes","cd-mem","cd-bw","cd-fp16","cd-fp8"].forEach(id=>{const el=$(id);if(el)el.addEventListener("input",upd);});
    const ck=$("cd-kind"); if(ck)ck.addEventListener("change",upd);
    syncPromptRange(); upd();
  }

  /* ---------- Module 12: worked examples (rendered from data) ---------- */
  function exIcon(k){
    const m={
      chat:'<path d="M21 11.5a8.38 8.38 0 01-8.5 8.5 8.5 8.5 0 01-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 013 11.5 8.5 8.5 0 0111.5 3 8.38 8.38 0 0121 11.5z"/>',
      saas:'<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01"/>',
      local:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M2 20h20"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${m[k]||m.chat}</svg>`;
  }
  function recReason(ex,rec,meets){
    const d=rec.d, r=rec.r, cost=e=>e.d.priceUSD*e.r.devicesNeeded;
    let base;
    if(d.kind==="apple") base=`Cheapest box that fits ${ex.users<=2?"this local, big-context job":"the memory need"} and clears the targets — unified memory wins on capacity per dollar.`;
    else if(r.devicesNeeded>1) base=`Lowest total cost that hits every target — ${r.devicesNeeded}× ${shortName(d)} (tensor-parallel) for the memory + speed at ${ex.users} concurrent users.`;
    else base=`A single GPU that clears your speed and TTFT targets with headroom — the simplest reliable setup.`;
    const simplest=(meets||[]).filter(e=>e.r.devicesNeeded<r.devicesNeeded).sort((a,b)=>cost(a)-cost(b))[0];
    if(simplest) base+=` Want fewer GPUs / less ops complexity? ${simplest.r.devicesNeeded}× ${shortName(simplest.d)} (${kfmt(cost(simplest))}) also hits the targets.`;
    return base;
  }
  function examples(){
    const root=$("examples-root"); if(!root)return;
    const charts=[];
    root.innerHTML=D().examples.map((ex,i)=>{
      const m=D().models.find(x=>x.id===ex.modelId);
      const s={paramsTotalB:m.paramsB,paramsActiveB:m.activeB,bytesPerWeight:bpw(ex.prec),
        model:{layers:m.layers,kvHeads:m.kvHeads,headDim:m.headDim,kvBytes:m.kvBytes},
        users:ex.users,ctxTokens:ex.ctx,promptTokens:ex.prompt,targetTps:ex.targetTps,targetTtft:ex.targetTtft};
      const wGB=C().weightsGB(m.paramsB,bpw(ex.prec)), kv=C().kvGB(ex.users,ex.ctx,s.model);
      const vram=C().requiredVRAM(wGB,kv), disk=C().diskGB(wGB);
      const evals=D().devices.map(d=>({d,r:C().evaluate(s,d)}));
      const fitting=evals.filter(e=>e.r.memFit);
      const meets=fitting.filter(e=>e.r.speedOk&&e.r.ttftOk&&e.r.devicesNeeded<=8);
      const cost=e=>e.d.priceUSD*e.r.devicesNeeded;
      const pool=(meets.length?meets:fitting).slice().sort((a,b)=> (cost(a)-cost(b))||(a.r.devicesNeeded-b.r.devicesNeeded));
      const rec=pool[0];
      let shown=(meets.length?meets:fitting).slice().sort((a,b)=>cost(a)-cost(b)).slice(0,5);
      if(rec && !shown.find(e=>e.d.id===rec.d.id)) shown=[rec].concat(shown).slice(0,5);
      const chartId=`ex-budget-${ex.id}`; charts.push({chartId,shown,rec});
      const recCost=rec?rec.d.priceUSD*rec.r.devicesNeeded:0;
      const rows=shown.map(({d,r})=>{
        const isRec=rec&&d.id===rec.d.id;
        const cost=kfmt(d.priceUSD*r.devicesNeeded)+(d.cloudHr?` <span class="sub">~$${(d.cloudHr*r.devicesNeeded).toFixed(1)}/hr</span>`:"");
        const tag=(r.speedOk&&r.ttftOk)?'<span class="tag ok">meets targets</span>':'<span class="tag warn">misses target</span>';
        return `<tr${isRec?' style="background:rgba(57,217,138,.08)"':''}><td><b>${d.name}</b>${isRec?' ⭐':''}</td><td>${r.devicesNeeded}×</td><td>${fmt(r.perUserTps)} tok/s</td><td>${r.ttft<1?(r.ttft*1000).toFixed(0)+'ms':r.ttft.toFixed(2)+'s'}</td><td>${tag}</td><td class="mono">${cost}</td><td class="mono">${perMTok(d,r)?("$"+perMTok(d,r).toFixed(2)):"—"}</td></tr>`;
      }).join("");
      return `<div class="card reveal" style="padding:0;overflow:hidden">
        <div class="ex-band" style="border-radius:0;border-left:0;border-right:0;border-top:0"><div class="ex-ic">${exIcon(ex.icon)}</div>
          <div style="flex:1;min-width:240px"><div class="card-num">EXAMPLE ${i+1}</div><h3 style="margin:2px 0 6px">${ex.title}</h3><p style="font-size:.92rem;margin:0">${ex.story}</p></div></div>
        <div style="padding:24px"><div class="steps">
          <div class="step done"><h4>Pick the smallest capable model</h4><div class="body"><p><b>${m.name}</b> at <b>${precLabel(ex.prec)}</b>. ${ex.modelWhy}</p></div></div>
          <div class="step done"><h4>Set the real-world targets</h4><div class="body"><div class="spec-grid">
            <div class="sp"><div class="k">Users</div><div class="v">${ex.users}</div></div>
            <div class="sp"><div class="k">Context</div><div class="v">${commas(ex.ctx)}</div></div>
            <div class="sp"><div class="k">Avg prompt</div><div class="v">${commas(ex.prompt)}</div></div>
            <div class="sp"><div class="k">Target tok/s</div><div class="v">${ex.targetTps}</div></div>
            <div class="sp"><div class="k">Target TTFT</div><div class="v">${ex.targetTtft}s</div></div></div></div></div>
          <div class="step done"><h4>Run the equations</h4><div class="body"><div class="eq">weights_GB = ${m.paramsB}B × ${bpw(ex.prec)} = <span class="res">${wGB.toFixed(1)} GB</span>
KV_GB = ${ex.users} × ${commas(ex.ctx)} × ${D().kvPerTokenMB(s.model).toFixed(3)} MB = <span class="res">${kv.toFixed(1)} GB</span>
total VRAM ≈ <span class="res">${vram.toFixed(0)} GB</span>   ·   disk_GB ≈ ${disk.toFixed(0)} GB</div></div></div>
          <div class="step done"><h4>Compare devices &amp; budget</h4><div class="body">
            <div class="table-wrap"><table><thead><tr><th>Option</th><th>Units</th><th>Per-user</th><th>TTFT</th><th>Verdict</th><th>Buy cost</th><th>~$/1M tok</th></tr></thead><tbody>${rows||'<tr><td colspan="6">No single listed device fits — shard across more GPUs.</td></tr>'}</tbody></table></div>
            <div class="chart mt16" id="${chartId}"></div></div></div>
        </div>
        ${rec?`<div class="rec win mt16"><div class="ribbon">Recommended</div><h4>${rec.d.name}${rec.r.devicesNeeded>1?` × ${rec.r.devicesNeeded}`:""}</h4>
          <p style="font-size:.92rem;margin:6px 0 12px">${recReason(ex,rec,meets)}</p>
          <div class="flex wrap-f" style="gap:18px;align-items:flex-end"><div class="price">${kfmt(recCost)}<span class="per"> buy${rec.d.cloudHr?` · ~$${(rec.d.cloudHr*rec.r.devicesNeeded).toFixed(1)}/hr cloud`:""}</span></div>
          <div class="muted" style="font-size:.86rem">${fmt(rec.r.perUserTps)} tok/s/user · ${fmt(rec.r.aggregateTps)} tok/s total · TTFT ${rec.r.ttft<1?(rec.r.ttft*1000).toFixed(0)+'ms':rec.r.ttft.toFixed(2)+'s'}</div></div></div>`:""}
        </div></div>`;
    }).join("");
    charts.forEach(({chartId,shown,rec})=>{ if(!shown.length)return;
      CH().vbars(chartId,{unit:"buy cost (USD)",data:shown.map(({d,r})=>({label:shortName(d),value:d.priceUSD*r.devicesNeeded,color: rec&&d.id===rec.d.id?"#39d98a":"#6d8bff"}))}); });
  }

  function init(){
    if(!window.DATA||!window.CALC||!window.Charts)return;
    precTable(); weights(); kv(); throughput(); ttft(); moe();
    devicesUI(); masterCalc();
    try{examples();}catch(e){console.error("examples",e);}
  }
  window.CalcUI={init};
})();
