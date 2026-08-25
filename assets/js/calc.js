/* =============================================================
   calc.js — THE EQUATION ENGINE (single source of truth)
   Pure functions. Units are explicit. Grounded in the roofline model.

   Conventions:
     - Parameter counts in BILLIONS (e.g. 8 = 8B).
     - Memory in decimal GB (1 GB = 1e9 bytes) to match the
       "1B params x 2 bytes = 2 GB" mental model.
     - Bandwidth in GB/s. Compute in TFLOPS (1e12 FLOP/s) dense.
   Tunable efficiency constants are read from window.DATA.CONST
   (calibrated by research) with safe fallbacks here.
   ============================================================= */
(function(){
  const K=()=> (window.DATA&&window.DATA.CONST) ? window.DATA.CONST : FALLBACK;
  const FALLBACK={
    mbuDecode:0.70,     // model bandwidth utilization during decode
    mfuPrefill:0.40,    // model FLOPs utilization during prefill
    overheadFrac:0.10,  // activation/fragmentation as fraction of weights
    minOverheadGB:2,    // CUDA/runtime context floor
    discreteUtil:1.00,  // physical VRAM; runtime/fragmentation is already charged in overheadGB
    appleUtil:0.75,     // usable unified memory fraction (Apple, OS reserve)
    tightHeadroomFrac:0.05, // warn when a one-device fit leaves less than 5%
    tightHeadroomGB:1,   // or less than 1 GB, whichever threshold is larger
    diskFactor:1.2      // download + scratch overhead
  };

  // ---- Memory ----
  function weightsGB(paramsB, bytesPerWeight){ return paramsB*bytesPerWeight; }

  // Bytes of KV per token FOR ONE LAYER.
  //   m.kvTensors  how many tensors are cached per token per layer.
  //                2 = a Key and a Value (normal GQA/MHA). 1 = a single shared latent
  //                (DeepSeek-style MLA caches one compressed vector, not a K and a V).
  //   sliding=true selects the windowed layers' geometry, which can differ from the
  //                global layers' (both Gemma 4 models do exactly this).
  function kvTensorsOf(m){ return m.kvTensors==null?2:m.kvTensors; }
  function kvBytesPerTokenPerLayer(m, sliding){
    const heads = sliding&&m.swaKvHeads!=null ? m.swaKvHeads : m.kvHeads;
    const dim   = sliding&&m.swaHeadDim!=null ? m.swaHeadDim : m.headDim;
    return kvTensorsOf(m)*heads*dim*(m.kvBytes||2);
  }

  // Naive per-token KV: every layer holding every token, each at its own geometry.
  // This is the UPPER BOUND — correct for pure global-attention models (Llama, Qwen2.5,
  // Mixtral), and the number the lesson text derives. Hybrid models must use kvBytesPerSeq.
  function kvBytesPerToken(m){
    const {full,swa}=kvLayerSplit(m);
    return kvBytesPerTokenPerLayer(m,false)*full + kvBytesPerTokenPerLayer(m,true)*swa;
  }
  function kvGBPerToken(m){ return kvBytesPerToken(m)/1e9; }

  // ---- Hybrid / sliding-window attention ----
  // Real KV is NOT linear in context when some layers use a sliding window: those layers
  // stop growing once the sequence passes the window. Splitting the stack:
  //   m.layers      total KV-BEARING layers (layers with no KV at all — Mamba/Gated
  //                 DeltaNet — are simply excluded from this count in DATA)
  //   m.fullLayers  how many of those use global attention (default: all of them)
  //   m.swaWindow   window size for the remaining (layers - fullLayers) layers
  // Global layers cost ctx tokens each; windowed layers cost min(ctx, window) each.
  function kvLayerSplit(m){
    const full = (m.fullLayers==null) ? m.layers : Math.max(0,Math.min(m.fullLayers,m.layers));
    return {full, swa: m.layers-full, window: m.swaWindow||Infinity};
  }
  function kvBytesPerSeq(ctxTokens, m){
    const {full,swa,window}=kvLayerSplit(m);
    return kvBytesPerTokenPerLayer(m,false)*full*ctxTokens
         + kvBytesPerTokenPerLayer(m,true)*swa*Math.min(ctxTokens,window);
  }
  function kvGBPerSeq(ctxTokens, m){ return kvBytesPerSeq(ctxTokens,m)/1e9; }
  // Effective average bytes/token at this context — equals kvBytesPerToken for pure global
  // models, and falls below it for hybrid models as context outgrows the window.
  function kvBytesPerTokenEff(ctxTokens, m){ return ctxTokens>0 ? kvBytesPerSeq(ctxTokens,m)/ctxTokens : 0; }
  function isHybridKV(m){ const s=kvLayerSplit(m); return s.swa>0 && isFinite(s.window); }

  function kvGB(users, ctxTokens, m){ return users*kvGBPerSeq(ctxTokens,m); }
  function overheadGB(wGB){ const k=K(); return Math.max(k.minOverheadGB, k.overheadFrac*wGB); }
  function requiredVRAM(wGB, kv, oh){ return wGB + kv + (oh!=null?oh:overheadGB(wGB+kv)); }

  // ---- Decode throughput (memory-bandwidth bound at low batch) ----
  // bytes read per generated token ~= active weight bytes (dense: all weights).
  function singleStreamTps(bwGBps, activeWeightGB, mbu){
    mbu=mbu||K().mbuDecode; return mbu*bwGBps/activeWeightGB;
  }
  // compute ceiling for AGGREGATE decode (high batch -> compute bound).
  // 2 FLOP per active param per token.
  function decodeComputeCapTps(peakTF, activeParamsB, mfu){
    mfu=mfu||K().mfuPrefill; return mfu*peakTF*1e12/(2*activeParamsB*1e9); // tokens/s
  }
  // max concurrent sequences the KV budget allows.
  function kvMaxBatch(kvBudgetGB, ctxTokens, m){
    const per=kvGBPerSeq(ctxTokens,m); return per>0?Math.max(1,Math.floor(kvBudgetGB/per)):1;
  }
  // Aggregate decode throughput: batched weight-read amortization until compute roof.
  // returns {batch, aggregateTps, perUserTps, bound}
  function aggregateDecode(opts){
    const {bwGBps,peakTF,activeWeightGB,activeParamsB,users,kvBudgetGB,ctxTokens,model,mbu,mfu}=opts;
    const ss=singleStreamTps(bwGBps,activeWeightGB,mbu);
    const cap=decodeComputeCapTps(peakTF,(opts.capParamsB||activeParamsB),mfu);
    const maxB=model?kvMaxBatch(kvBudgetGB,ctxTokens,model):users;
    const batch=Math.max(1,Math.min(users,maxB));
    const bwAgg=batch*ss;                  // linear region (weights read once per step)
    const aggregateTps=Math.min(bwAgg,cap);
    return {
      batch, maxBatch:maxB, singleStreamTps:ss, computeCap:cap,
      aggregateTps, perUserTps: aggregateTps/batch,
      bound: bwAgg<=cap ? "bandwidth" : "compute",
      kvLimited: users>maxB
    };
  }

  // ---- Prefill / TTFT (compute bound) ----
  function prefillTps(peakTF, activeParamsB, mfu){
    mfu=mfu||K().mfuPrefill; return mfu*peakTF*1e12/(2*activeParamsB*1e9);
  }
  function ttft(promptTokens, peakTF, activeParamsB, queueSec, mfu){
    const pt=prefillTps(peakTF,activeParamsB,mfu);
    return (queueSec||0) + promptTokens/pt;
  }

  // ---- Disk ----
  function diskGB(totalWeightGB, copies){ return totalWeightGB*(copies||1)*K().diskFactor; }

  // ---- Device capacity ----
  // Compare the fully-accounted requirement (weights + KV + runtime overhead) with
  // physical VRAM on discrete GPUs. gpu_memory_utilization is an engine-specific,
  // configurable allocator policy; applying it here as another reserve double-counts
  // the runtime/fragmentation overhead above and can turn a real one-GPU fit into 2×.
  function usableMem(capacityGB, kind){
    const k=K(), util=kind==="apple"?k.appleUtil:(k.discreteUtil==null?1:k.discreteUtil);
    return capacityGB*util;
  }
  function devicesNeeded(reqVRAM, usablePerDevice){ return Math.max(1,Math.ceil(reqVRAM/usablePerDevice)); }
  // Largest weights+KV that still fits once overhead is charged ON TOP of it.
  // overhead = max(minOverheadGB, overheadFrac*(w+kv)), so solve whichever branch binds:
  //   fraction branch: X*(1+frac) <= T ; floor branch: X + minOverhead <= T
  function payloadBudget(totalUsableGB){
    const k=K(), viaFrac=totalUsableGB/(1+k.overheadFrac);
    return viaFrac >= k.minOverheadGB/k.overheadFrac ? viaFrac : totalUsableGB-k.minOverheadGB;
  }

  // ---- Whole-scenario evaluation ----
  // scenario: {paramsTotalB, paramsActiveB, bytesPerWeight, users, ctxTokens, promptTokens,
  //            targetTps, targetTtft,
  //            model{layers, kvHeads, headDim, kvBytes,          // required
  //                  fullLayers, swaWindow, swaKvHeads, swaHeadDim, kvTensors}}  // optional
  // device: {memGB, bwGBps, fp16TF, kind}
  function evaluate(s, d){
    const wGB=weightsGB(s.paramsTotalB, s.bytesPerWeight);
    const activeWGB=weightsGB(s.paramsActiveB||s.paramsTotalB, s.bytesPerWeight);
    const kv=kvGB(s.users, s.ctxTokens, s.model);
    const oh=overheadGB(wGB+kv);
    const reqV=requiredVRAM(wGB,kv,oh);
    const usable=usableMem(d.memGB,d.kind);
    const nDev=devicesNeeded(reqV,usable);
    const totalUsable=usable*nDev;
    const headroomGB=totalUsable-reqV;
    const tightHeadroom=nDev===1 && headroomGB<Math.max(K().tightHeadroomGB,usable*K().tightHeadroomFrac);
    // KV budget must charge overhead at the batch we're solving FOR, not at the current
    // user count — otherwise maxBatch reports a batch that wouldn't actually fit.
    const kvBudget=Math.max(0,payloadBudget(totalUsable)-wGB);
    // sharded across nDev GPUs => bandwidth & compute scale with nDev, minus TP comms overhead
    const tpEff=nDev<=1?1:Math.max(0.5,Math.pow(0.9,nDev-1));
    const activeB=s.paramsActiveB||s.paramsTotalB;
    // MoE: at batch scale more experts activate, so the aggregate compute cap behaves like >active params
    const capB=(s.paramsTotalB>activeB)?Math.min(s.paramsTotalB,activeB*3):activeB;
    const agg=aggregateDecode({
      bwGBps:d.bwGBps*nDev*tpEff,peakTF:d.fp16TF*nDev*tpEff,activeWeightGB:activeWGB,
      activeParamsB:activeB,capParamsB:capB,users:s.users,
      kvBudgetGB:kvBudget,ctxTokens:s.ctxTokens,model:s.model
    });
    const tt=ttft(s.promptTokens||1000,d.fp16TF*nDev*tpEff,activeB,0);
    const memFit=reqV<=totalUsable;
    const speedOk=agg.perUserTps>=(s.targetTps||0);
    const ttftOk=s.targetTtft? tt<=s.targetTtft : true;
    let verdict="fit";
    if(!memFit) verdict="nofit";
    else if(!speedOk||!ttftOk||nDev>1||tightHeadroom) verdict="tight";
    return {
      weightsGB:wGB, activeWeightsGB:activeWGB, kvGB:kv, overheadGB:oh, requiredVRAM:reqV,
      usablePerDevice:usable, devicesNeeded:nDev, totalUsable, headroomGB, tightHeadroom,
      singleStreamTps:agg.singleStreamTps, aggregateTps:agg.aggregateTps, perUserTps:agg.perUserTps,
      batch:agg.batch, maxBatch:agg.maxBatch, bound:agg.bound, kvLimited:agg.kvLimited,
      ttft:tt, diskGB:diskGB(wGB,1),
      memFit, speedOk, ttftOk, verdict
    };
  }

  const API={
    weightsGB,kvBytesPerToken,kvGBPerToken,kvBytesPerTokenPerLayer,
    kvLayerSplit,kvBytesPerSeq,kvGBPerSeq,kvBytesPerTokenEff,isHybridKV,
    kvGB,overheadGB,requiredVRAM,
    singleStreamTps,decodeComputeCapTps,kvMaxBatch,aggregateDecode,
    prefillTps,ttft,diskGB,usableMem,devicesNeeded,payloadBudget,evaluate,FALLBACK
  };
  window.CALC=API;

  // Guarded regression anchors: warn about numeric drift without breaking the lesson.
  const selfChecks=[];
  function check(name,actual,expected,tolerance){
    const pass=typeof actual==="number" && isFinite(actual) && Math.abs(actual-expected)<=tolerance;
    selfChecks.push({name,pass,actual,expected,tolerance});
  }
  check("24 GB discrete GPU exposes 24 GB to the accounted fit model",usableMem(24,"amd"),24,1e-12);
  const qwen35Rx7900=evaluate({
    paramsTotalB:35,paramsActiveB:3,bytesPerWeight:0.60,
    users:1,ctxTokens:1024,promptTokens:1024,
    model:{layers:10,kvHeads:2,headDim:256,kvBytes:0.5}
  },{memGB:24,bwGBps:960,fp16TF:123,kind:"amd"});
  check("Qwen 35B Q4 + INT4 KV requires 23.105767168 GB",qwen35Rx7900.requiredVRAM,23.105767168,1e-9);
  check("Qwen 35B Q4 is a one-GPU RX 7900 XTX fit",qwen35Rx7900.devicesNeeded,1,0);
  API.selfChecks=selfChecks;
  const failed=selfChecks.filter(x=>!x.pass);
  if(failed.length && typeof console!=="undefined" && console.warn){
    console.warn("CALC self-check failures",failed);
  }
})();
