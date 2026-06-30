/* =============================================================
   charts.js — tiny dependency-free SVG chart library
   Global: window.Charts
   All charts are responsive (viewBox) and themed via CSS vars.
   ============================================================= */
(function(){
  const NS="http://www.w3.org/2000/svg";
  const PAL=["#6d8bff","#b06cff","#38e0d0","#ffc24b","#ff6b81","#7CF5A0","#5ec8ff","#f59e9e"];

  function svg(w,h){
    const s=document.createElementNS(NS,"svg");
    s.setAttribute("viewBox",`0 0 ${w} ${h}`);
    s.setAttribute("preserveAspectRatio","xMidYMid meet");
    s.setAttribute("role","img");
    return s;
  }
  function el(name,attrs,text){
    const e=document.createElementNS(NS,name);
    for(const k in attrs) e.setAttribute(k,attrs[k]);
    if(text!=null) e.textContent=text;
    return e;
  }
  function fmt(n){
    if(n==null||isNaN(n))return"–";
    if(Math.abs(n)>=1000) return (n/1000).toFixed(n>=10000?0:1)+"k";
    if(Math.abs(n)>=100) return Math.round(n).toString();
    if(Math.abs(n)>=10) return n.toFixed(0);
    return (Math.round(n*10)/10).toString();
  }
  function niceMax(v){
    if(v<=0)return 1;
    const p=Math.pow(10,Math.floor(Math.log10(v)));
    const f=v/p;
    const n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;
    return n*p;
  }
  function clear(c){ if(typeof c==="string")c=document.getElementById(c); c.innerHTML=""; return c; }

  /* ---------- Vertical bars (single or grouped) ---------- */
  // cfg: {data:[{label,value,color?,sub?}], unit, target:{value,label}, max, height}
  function vbars(container,cfg){
    const c=clear(container);
    const W=620,H=cfg.height||300, pad={t:24,r:16,b:46,l:46};
    const s=svg(W,H);
    const data=cfg.data||[];
    const max=cfg.max||niceMax(Math.max(...data.map(d=>d.value), cfg.target?cfg.target.value:0)*1.12);
    const plotW=W-pad.l-pad.r, plotH=H-pad.t-pad.b;
    const x0=pad.l, y0=pad.t;
    // gridlines
    const ticks=5;
    for(let i=0;i<=ticks;i++){
      const yv=max/ticks*i, y=y0+plotH-(yv/max)*plotH;
      s.appendChild(el("line",{x1:x0,y1:y,x2:x0+plotW,y2:y,class:i?"grid-l":"axis"}));
      s.appendChild(el("text",{x:x0-8,y:y+4,"text-anchor":"end",class:"lbl"},fmt(yv)));
    }
    const n=data.length, gap=plotW/n, bw=Math.min(74,gap*0.56);
    data.forEach((d,i)=>{
      const cx=x0+gap*i+gap/2;
      const h=(d.value/max)*plotH, y=y0+plotH-h;
      const col=d.color||PAL[i%PAL.length];
      const g=el("g",{});
      const r=el("rect",{x:cx-bw/2,y:y,width:bw,height:Math.max(0,h),rx:6,fill:col,class:"bar"});
      r.style.filter="drop-shadow(0 4px 12px "+col+"40)";
      g.appendChild(r);
      g.appendChild(el("text",{x:cx,y:y-8,"text-anchor":"middle",class:"val-lbl"},fmt(d.value)+(cfg.unit?"":"")));
      // label (wrap up to 2 lines on space)
      const words=(d.label||"").split(" ");
      if(words.length>2 && d.label.length>10){
        const mid=Math.ceil(words.length/2);
        s.appendChild(el("text",{x:cx,y:y0+plotH+18,"text-anchor":"middle",class:"lbl"},words.slice(0,mid).join(" ")));
        s.appendChild(el("text",{x:cx,y:y0+plotH+31,"text-anchor":"middle",class:"lbl"},words.slice(mid).join(" ")));
      }else{
        s.appendChild(el("text",{x:cx,y:y0+plotH+20,"text-anchor":"middle",class:"lbl"},d.label));
      }
      if(d.sub) s.appendChild(el("text",{x:cx,y:y0+plotH+33,"text-anchor":"middle",class:"lbl"},d.sub));
      s.appendChild(g);
    });
    if(cfg.target){
      const ty=y0+plotH-(cfg.target.value/max)*plotH;
      s.appendChild(el("line",{x1:x0,y1:ty,x2:x0+plotW,y2:ty,stroke:"#ff6b81","stroke-width":1.5,"stroke-dasharray":"5 4"}));
      s.appendChild(el("text",{x:x0+plotW,y:ty-6,"text-anchor":"end",fill:"#ff6b81","font-size":"10","font-weight":"700"},cfg.target.label));
    }
    if(cfg.unit) s.appendChild(el("text",{x:14,y:14,fill:"#727892","font-size":"10"},cfg.unit));
    c.appendChild(s);
  }

  /* ---------- Grouped bars (compare devices/options) ---------- */
  // cfg:{groups:[{label}], series:[{name,color,values:[]}], unit, height, legend:true}
  function grouped(container,cfg){
    const c=clear(container);
    const W=640,H=cfg.height||320,pad={t:24,r:14,b:54,l:48};
    const s=svg(W,H);
    const groups=cfg.groups, series=cfg.series;
    const allv=series.flatMap(se=>se.values);
    const max=cfg.max||niceMax(Math.max(...allv)*1.12);
    const plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b,x0=pad.l,y0=pad.t;
    const ticks=5;
    for(let i=0;i<=ticks;i++){
      const yv=max/ticks*i,y=y0+plotH-(yv/max)*plotH;
      s.appendChild(el("line",{x1:x0,y1:y,x2:x0+plotW,y2:y,class:i?"grid-l":"axis"}));
      s.appendChild(el("text",{x:x0-8,y:y+4,"text-anchor":"end",class:"lbl"},fmt(yv)));
    }
    const gN=groups.length,gGap=plotW/gN,sN=series.length;
    const bw=Math.min(34,(gGap*0.62)/sN);
    groups.forEach((g,gi)=>{
      const gx=x0+gGap*gi+gGap/2;
      const tot=bw*sN+(sN-1)*4;
      series.forEach((se,si)=>{
        const v=se.values[gi];const h=(v/max)*plotH,y=y0+plotH-h;
        const bx=gx-tot/2+si*(bw+4);
        const r=el("rect",{x:bx,y:y,width:bw,height:Math.max(0,h),rx:4,fill:se.color||PAL[si],class:"bar"});
        s.appendChild(r);
        if(sN<=3) s.appendChild(el("text",{x:bx+bw/2,y:y-5,"text-anchor":"middle",class:"lbl","font-weight":"700"},fmt(v)));
      });
      const words=(g.label||"").split(" ");
      if(words.length>1&&g.label.length>9){
        s.appendChild(el("text",{x:gx,y:y0+plotH+18,"text-anchor":"middle",class:"lbl"},words.slice(0,Math.ceil(words.length/2)).join(" ")));
        s.appendChild(el("text",{x:gx,y:y0+plotH+30,"text-anchor":"middle",class:"lbl"},words.slice(Math.ceil(words.length/2)).join(" ")));
      } else s.appendChild(el("text",{x:gx,y:y0+plotH+20,"text-anchor":"middle",class:"lbl"},g.label));
    });
    if(cfg.unit) s.appendChild(el("text",{x:14,y:14,fill:"#727892","font-size":"10"},cfg.unit));
    c.appendChild(s);
    if(cfg.legend!==false) c.appendChild(legend(series));
  }

  /* ---------- Horizontal stacked bar with capacity marker ---------- */
  // cfg:{segments:[{label,value,color}], capacity, unit, capLabel}
  function hstack(container,cfg){
    const c=clear(container);
    const segs=cfg.segments.filter(x=>x.value>0);
    const total=segs.reduce((a,b)=>a+b.value,0);
    const scaleMax=Math.max(total,cfg.capacity||0)*1.06;
    // bar
    const bar=document.createElement("div");bar.className="membar";
    segs.forEach(sg=>{
      const d=document.createElement("div");d.className="seg-b";
      d.style.width=(sg.value/scaleMax*100)+"%";d.style.background=sg.color;
      d.title=`${sg.label}: ${sg.value.toFixed(1)} ${cfg.unit||""}`;
      bar.appendChild(d);
    });
    // empty remainder up to capacity (if capacity>total show headroom)
    c.appendChild(bar);
    // capacity marker line
    if(cfg.capacity){
      const cl=document.createElement("div");cl.className="cap-line";
      const m=document.createElement("div");m.className="mark";
      m.style.left=(cfg.capacity/scaleMax*100)+"%";
      const sp=document.createElement("span");
      sp.textContent=(cfg.capLabel||"Capacity")+" "+cfg.capacity+" "+(cfg.unit||"");
      sp.style.color = total>cfg.capacity ? "#ff6b81" : "#39d98a";
      m.appendChild(sp);cl.appendChild(m);c.appendChild(cl);
    }
    // legend
    const lg=document.createElement("div");lg.className="legend";
    segs.forEach(sg=>{
      const li=document.createElement("div");li.className="li";
      li.innerHTML=`<span class="sw" style="background:${sg.color}"></span>${sg.label} · <b style="color:var(--text)">${sg.value.toFixed(1)} ${cfg.unit||""}</b>`;
      lg.appendChild(li);
    });
    c.appendChild(lg);
  }

  /* ---------- Multi-series line chart ---------- */
  // cfg:{series:[{name,color,points:[[x,y]...]}], xLabel,yLabel, xUnit,yUnit, height, target}
  function line(container,cfg){
    const c=clear(container);
    const W=640,H=cfg.height||300,pad={t:20,r:18,b:46,l:52};
    const s=svg(W,H);
    const series=cfg.series;
    const xs=series.flatMap(se=>se.points.map(p=>p[0]));
    const ys=series.flatMap(se=>se.points.map(p=>p[1]));
    const xmin=Math.min(...xs),xmax=Math.max(...xs);
    const ymax=cfg.ymax||niceMax(Math.max(...ys,cfg.target?cfg.target.value:0)*1.1),ymin=0;
    const plotW=W-pad.l-pad.r,plotH=H-pad.t-pad.b,x0=pad.l,y0=pad.t;
    const X=x=>x0+( (x-xmin)/((xmax-xmin)||1) )*plotW;
    const Y=y=>y0+plotH-((y-ymin)/((ymax-ymin)||1))*plotH;
    const ticks=5;
    for(let i=0;i<=ticks;i++){
      const yv=ymax/ticks*i,y=Y(yv);
      s.appendChild(el("line",{x1:x0,y1:y,x2:x0+plotW,y2:y,class:i?"grid-l":"axis"}));
      s.appendChild(el("text",{x:x0-8,y:y+4,"text-anchor":"end",class:"lbl"},fmt(yv)));
    }
    // x ticks
    const xticks=cfg.xticks|| (function(){const arr=[];for(let i=0;i<=5;i++)arr.push(xmin+(xmax-xmin)/5*i);return arr;})();
    xticks.forEach(xv=>{
      s.appendChild(el("text",{x:X(xv),y:y0+plotH+20,"text-anchor":"middle",class:"lbl"},fmt(xv)));
    });
    if(cfg.target){
      const ty=Y(cfg.target.value);
      s.appendChild(el("line",{x1:x0,y1:ty,x2:x0+plotW,y2:ty,stroke:"#ff6b81","stroke-width":1.4,"stroke-dasharray":"5 4"}));
      s.appendChild(el("text",{x:x0+plotW,y:ty-6,"text-anchor":"end",fill:"#ff6b81","font-size":"10","font-weight":"700"},cfg.target.label));
    }
    series.forEach((se,si)=>{
      const col=se.color||PAL[si];
      let d="";
      se.points.forEach((p,i)=>{ d+=(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)+" "; });
      // area
      if(cfg.area!==false && series.length===1){
        const area=d+`L ${X(se.points[se.points.length-1][0])} ${Y(0)} L ${X(se.points[0][0])} ${Y(0)} Z`;
        const ag=el("path",{d:area,fill:col,opacity:.12});
        s.appendChild(ag);
      }
      s.appendChild(el("path",{d:d,fill:"none",stroke:col,"stroke-width":2.5,"stroke-linejoin":"round","stroke-linecap":"round"}));
      se.points.forEach(p=>{ s.appendChild(el("circle",{cx:X(p[0]),cy:Y(p[1]),r:3,fill:col})); });
    });
    if(cfg.xLabel) s.appendChild(el("text",{x:x0+plotW/2,y:H-6,"text-anchor":"middle",class:"lbl"},cfg.xLabel));
    if(cfg.yLabel) s.appendChild(el("text",{x:14,y:14,fill:"#727892","font-size":"10"},cfg.yLabel));
    c.appendChild(s);
    if(series.length>1) c.appendChild(legend(series));
  }

  function legend(series){
    const lg=document.createElement("div");lg.className="legend";
    series.forEach((se,i)=>{
      const li=document.createElement("div");li.className="li";
      li.innerHTML=`<span class="sw" style="background:${se.color||PAL[i]}"></span>${se.name}`;
      lg.appendChild(li);
    });
    return lg;
  }

  window.Charts={vbars,grouped,hstack,line,fmt,PAL};
})();
