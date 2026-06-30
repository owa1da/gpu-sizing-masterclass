/* =============================================================
   data.js — verified data (single source of truth for numbers)
   CONST efficiency factors are calibrated from research + roofline.
   Memory/KV math is exact. Device specs verified separately.
   ============================================================= */
window.DATA = {

  /* ---- Tunable efficiency constants (research-calibrated) ---- */
  CONST:{
    mbuDecode:0.60,    // Model Bandwidth Utilization in decode (realistic 0.5–0.85; small/quant models trend lower)
    mfuPrefill:0.40,   // Model FLOPs Utilization in prefill (realistic 0.3–0.5)
    overheadFrac:0.10, // activations/fragmentation as fraction of weights
    minOverheadGB:2,   // CUDA/runtime context floor
    nvUtil:0.90,       // usable VRAM fraction (vLLM gpu_memory_utilization default)
    appleUtil:0.75,    // usable unified memory (macOS reserves the rest)
    diskFactor:1.2     // download + scratch overhead
  },

  /* ---- Precision / quantization (bytes per weight) ---- */
  precisions:[
    {key:"fp16", label:"FP16 / BF16", bpw:2.0,  bits:16,  quality:"Reference quality", q:"ok"},
    {key:"fp8",  label:"FP8",         bpw:1.0,  bits:8,   quality:"Near-lossless on modern GPUs", q:"ok"},
    {key:"int8", label:"INT8",        bpw:1.0,  bits:8,   quality:"Near-lossless (good kernels)", q:"ok"},
    {key:"q6",   label:"Q6_K",        bpw:0.82, bits:6.6, quality:"Practically lossless", q:"ok"},
    {key:"q5",   label:"Q5_K_M",      bpw:0.69, bits:5.5, quality:"Tiny quality drop", q:"warn"},
    {key:"q4",   label:"Q4_K_M",      bpw:0.60, bits:4.8, quality:"Small drop, very popular", q:"warn"},
    {key:"awq4", label:"AWQ / GPTQ 4-bit", bpw:0.56, bits:4.5, quality:"Small drop, GPU-fast", q:"warn"}
  ],
  precDefault:"fp16",

  /* ---- Real model presets (exact KV architecture) ----
     kv per token bytes = 2 * layers * kvHeads * headDim * 2 (FP16 KV) */
  models:[
    {id:"llama8b",  name:"Llama 3.1 8B",   paramsB:8.0,  activeB:8.0,  layers:32, kvHeads:8, headDim:128, kvBytes:2, prec:"fp16", moe:false},
    {id:"qwen7b",   name:"Qwen2.5 7B",     paramsB:7.6,  activeB:7.6,  layers:28, kvHeads:4, headDim:128, kvBytes:2, prec:"fp16", moe:false},
    {id:"qwen14b",  name:"Qwen2.5 14B",    paramsB:14.7, activeB:14.7, layers:48, kvHeads:8, headDim:128, kvBytes:2, prec:"fp16", moe:false},
    {id:"qwen32b",  name:"Qwen2.5 32B",    paramsB:32.5, activeB:32.5, layers:64, kvHeads:8, headDim:128, kvBytes:2, prec:"q4",   moe:false},
    {id:"llama70b", name:"Llama 3.1 70B",  paramsB:70.6, activeB:70.6, layers:80, kvHeads:8, headDim:128, kvBytes:2, prec:"q4",   moe:false},
    {id:"qwen72b",  name:"Qwen2.5 72B",    paramsB:72.7, activeB:72.7, layers:80, kvHeads:8, headDim:128, kvBytes:2, prec:"q4",   moe:false},
    {id:"llama405b",name:"Llama 3.1 405B", paramsB:405,  activeB:405,  layers:126,kvHeads:8, headDim:128, kvBytes:2, prec:"q4",   moe:false},
    {id:"mixtral",  name:"Mixtral 8×7B (MoE)", paramsB:46.7, activeB:12.9, layers:32, kvHeads:8, headDim:128, kvBytes:2, prec:"q4", moe:true},
    {id:"deepseek", name:"DeepSeek-V3 (MoE)",   paramsB:671,  activeB:37,   layers:61, kvHeads:1, headDim:576, kvBytes:1, prec:"fp8", moe:true, kvNote:"MLA compresses KV ~25× — modeled here as a 576-dim shared latent."}
  ],

  /* ---- Devices (verified specs, 2026) ----
     kind:"nvidia"|"apple"; memGB = config used for serving; fp16TF = DENSE FP16/BF16 TFLOPS.
     Apple TFLOPS are approximate (framework-dependent); memory/bandwidth/price are verified. */
  devices:[
    {id:"macmini4",  name:"Mac Mini M4",            vendor:"Apple", kind:"apple", memGB:24,  memCfg:"16/24 GB", bwGBps:120,  fp16TF:7,   priceUSD:999,   tdp:65,  eco:"Metal / MLX", note:"Current buyable max is 24 GB after 2026 memory cuts; good for small local models.", src:"https://www.apple.com/mac-mini/specs/", priceSrc:"https://www.apple.com/shop/buy-mac/mac-mini"},
    {id:"macmini4pro",name:"Mac Mini M4 Pro",       vendor:"Apple", kind:"apple", memGB:48,  memCfg:"24/48 GB", bwGBps:273,  fp16TF:14,  priceUSD:1999,  tdp:90,  eco:"Metal / MLX", note:"Current buyable max is 48 GB; solid local box for 14–32B quantized models.", src:"https://www.apple.com/mac-mini/specs/", priceSrc:"https://www.apple.com/shop/buy-mac/mac-mini"},
    {id:"mbpm5max",  name:"MacBook Pro M5 Max",      vendor:"Apple", kind:"apple", memGB:128, memCfg:"up to 128 GB",bwGBps:614,  fp16TF:50,  priceUSD:5399,  tdp:120, eco:"Metal / MLX", note:"Huge memory in a laptop — runs 70B Q4 locally.", src:"https://www.apple.com/newsroom/2026/03/apple-introduces-macbook-pro-with-all-new-m5-pro-and-m5-max/", priceSrc:"https://www.apple.com/shop/buy-mac/macbook-pro/16-inch"},
    {id:"studioultra",name:"Mac Studio M3 Ultra",   vendor:"Apple", kind:"apple", memGB:96,  memCfg:"96 GB",bwGBps:819, fp16TF:56,  priceUSD:5299,  tdp:270, eco:"Metal / MLX", note:"Current M3 Ultra Studio config after 2026 high-memory SKU cuts.", src:"https://www.apple.com/mac-studio/specs/", priceSrc:"https://www.apple.com/shop/buy-mac/mac-studio"},
    {id:"rtx5080",   name:"RTX 5080",               vendor:"NVIDIA",kind:"nvidia",memGB:16,  memCfg:"16 GB GDDR7", bwGBps:960,  fp16TF:225, fp8TF:450, priceUSD:1250,  tdp:360, eco:"CUDA", note:"Entry CUDA card; street prices sit above launch MSRP.", src:"https://www.techpowerup.com/gpu-specs/geforce-rtx-5080.c4217", priceSrc:"https://bestvaluegpu.com/history/new-and-used-rtx-5080-price-history-and-specs/"},
    {id:"rtx5090",   name:"RTX 5090",               vendor:"NVIDIA",kind:"nvidia",memGB:32,  memCfg:"32 GB GDDR7", bwGBps:1792, fp16TF:419, fp8TF:838, priceUSD:4200,  tdp:575, eco:"CUDA", note:"Best consumer card; 32B Q4 comfortably, but 2026 street price is far above MSRP.", src:"https://www.techpowerup.com/gpu-specs/geforce-rtx-5090.c4216", priceSrc:"https://bestvaluegpu.com/history/new-and-used-rtx-5090-price-history-and-specs/"},
    {id:"rtxpro6000",name:"RTX PRO 6000 Blackwell", vendor:"NVIDIA",kind:"nvidia",memGB:96,  memCfg:"96 GB GDDR7", bwGBps:1792, fp16TF:503, fp8TF:1000, priceUSD:13250, tdp:600, eco:"CUDA", note:"96 GB workstation card — current NVIDIA list price jumped in 2026.", src:"https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000/", priceSrc:"https://www.tomshardware.com/pc-components/gpus/nvidia-raises-rtx-pro-6000-blackwell-gpu-pricing-to-usd13-250-55-percent-increase-over-msrp-in-a-years-time"},
    {id:"a100",      name:"A100 80GB",              vendor:"NVIDIA",kind:"nvidia",memGB:80,  memCfg:"80 GB HBM2e", bwGBps:2039, fp16TF:312, priceUSD:10000, tdp:400, eco:"CUDA", cloudHr:1.5, note:"Workhorse datacenter GPU; current used/refurb market is cheaper than H100.", src:"https://www.nvidia.com/en-us/data-center/a100/", priceSrc:"https://gpupoet.com/gpu/shop/nvidia-a100-pcie"},
    {id:"h100",      name:"H100 SXM",               vendor:"NVIDIA",kind:"nvidia",memGB:80,  memCfg:"80 GB HBM3", bwGBps:3350, fp16TF:989, fp8TF:1979, priceUSD:28000, tdp:700, eco:"CUDA", cloudHr:3.3, note:"The serving standard; huge bandwidth.", src:"https://www.nvidia.com/en-us/data-center/h100/", priceSrc:"https://compute.exchange/blogs/h100-gpu-price-2026"},
    {id:"h200",      name:"H200 SXM",               vendor:"NVIDIA",kind:"nvidia",memGB:141, memCfg:"141 GB HBM3e",bwGBps:4800, fp16TF:989, fp8TF:1979, priceUSD:31000, tdp:700, eco:"CUDA", cloudHr:4.0, note:"H100 compute + 141 GB for big models/context.", src:"https://www.nvidia.com/en-us/data-center/h200/", priceSrc:"https://www.tritondatacom.com/products/nvidia-h200-sxm"},
    {id:"b200",      name:"B200 (Blackwell)",       vendor:"NVIDIA",kind:"nvidia",memGB:192, memCfg:"192 GB HBM3e",bwGBps:8000, fp16TF:2250, fp8TF:4500, priceUSD:40000, tdp:1000, eco:"CUDA", cloudHr:6, note:"Top-tier Blackwell planning figure; not usually sold as a standalone card.", src:"https://www.nvidia.com/en-us/data-center/dgx-b200/", priceSrc:"https://siliconanalysts.com/analysis/nvidia-b200-blackwell-cost-breakdown", approx:true}
  ],

  /* ---- Worked-example scenarios (device-agnostic targets) ---- */
  examples:[
    {
      id:"ex1", icon:"chat",
      title:"Internal coding assistant for a startup",
      story:"A 25-person engineering team wants a private coding copilot. Peak ~8 developers hammering it at once. Quality must be solid for code, latency snappy, data stays in-house.",
      users:8, ctx:8192, prompt:1500, targetTps:30, targetTtft:1.5,
      modelId:"qwen32b", prec:"q4",
      modelWhy:"Coding needs reasoning, but 32B-class at Q4 rivals last year's 70B on code while halving memory. Start here; only go bigger if eval scores demand it."
    },
    {
      id:"ex2", icon:"saas",
      title:"Customer-facing SaaS support bot (RAG)",
      story:"A B2B SaaS adds an AI support agent. ~60 concurrent chats at peak, long retrieved context, strict first-token latency so the UI feels instant. Reliability and quality sell the product.",
      users:60, ctx:16384, prompt:4000, targetTps:20, targetTtft:1.2,
      modelId:"llama70b", prec:"q4",
      modelWhy:"Customer-facing + RAG raises the quality bar. A 70B at Q4 is the safe pick; we'll test whether a strong 32B passes eval to cut cost."
    },
    {
      id:"ex3", icon:"local",
      title:"Solo founder / on-device privacy build",
      story:"A founder prototypes a private legal-doc assistant on their own machine. 1–2 users, very long documents, no cloud, modest budget — happy to accept a slower first token in exchange for privacy and big-context capacity.",
      users:2, ctx:32768, prompt:3000, targetTps:8, targetTtft:25,
      modelId:"llama70b", prec:"q4",
      modelWhy:"One user + huge context favors capacity over raw throughput — the sweet spot for a big-memory Mac running a 70B at Q4 locally."
    }
  ],

  /* ---- Citations ---- */
  cite:{
    nvinfer:{n:"NVIDIA — LLM Inference Optimization",u:"https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/"},
    hfkv:{n:"Hugging Face — KV cache",u:"https://huggingface.co/docs/transformers/en/kv_cache"},
    hfquant:{n:"Hugging Face — Quantization",u:"https://huggingface.co/docs/transformers/en/main_classes/quantization"},
    gguf:{n:"Hugging Face — GGUF",u:"https://huggingface.co/docs/hub/en/gguf"},
    vllmmetrics:{n:"vLLM — Metrics (TTFT/TPOT)",u:"https://docs.vllm.ai/en/latest/design/metrics.html"},
    vllmopt:{n:"vLLM — Optimization (chunked prefill)",u:"https://docs.vllm.ai/en/latest/configuration/optimization.html"},
    mlx:{n:"Apple MLX — Unified memory",u:"https://ml-explore.github.io/mlx/build/html/usage/unified_memory.html"},
    llamacfg:{n:"Llama 3.1 8B config.json",u:"https://huggingface.co/meta-llama/Llama-3.1-8B/blob/main/config.json"},
    lostmiddle:{n:"Lost in the Middle (Liu et al.)",u:"https://arxiv.org/abs/2307.03172"},
    moe:{n:"Hugging Face — Mixture of Experts",u:"https://huggingface.co/blog/moe"},
    h100:{n:"NVIDIA H100",u:"https://www.nvidia.com/en-us/data-center/h100/"},
    h200:{n:"NVIDIA H200",u:"https://www.nvidia.com/en-us/data-center/h200/"}
  }
};

/* derived helper: KV bytes/token for a model preset */
window.DATA.kvPerTokenMB = function(m){ return (2*m.layers*m.kvHeads*m.headDim*(m.kvBytes||2))/1e6; };
