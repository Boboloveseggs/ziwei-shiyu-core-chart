import { analyzeChart } from "./engine.js";
import { renderSystem, renderScoreBars } from "./renderer.js";

let sample = null;
let lastResult = null;

async function getSample(){
  if(sample) return sample;
  const r = await fetch("./data/sample_chart.json");
  sample = await r.json();
  return sample;
}

function renderCards(res){
  const items = [
    ["核心发动机",res.engine,"drive"],
    ["中央处理器",res.processor,"process"],
    ["主要输入",res.inputs[0],"support"],
    ["主要输出",res.outputs[0],"output"],
    ["长期积累",res.storage,"store"],
    ["最大瓶颈",res.bottleneck,"friction"],
    ["恢复节点",res.recovery,"strength"]
  ];
  document.querySelector("#cards").innerHTML = items.filter(x=>x[1]).map(([title,x,k])=>`
    <div class="card-mini">
      <span>${title}</span>
      <b>${x.name}</b>
      <small>${k}: ${Number(x[k]||0).toFixed(2)}</small>
    </div>
  `).join("");
}

function run(){
  const status=document.querySelector("#status");
  try{
    const chart=JSON.parse(document.querySelector("#input").value);
    lastResult=analyzeChart(chart);
    status.textContent="计算完成 · 0 次 AI 调用";
    document.querySelector("#summary").textContent=lastResult.summary;
    renderCards(lastResult);
    renderSystem(document.querySelector("#diagram"),lastResult,{animate:true});
    renderScoreBars(document.querySelector("#bars"),lastResult);
    document.querySelector("#jsonout").textContent=JSON.stringify(lastResult,null,2);
  }catch(err){
    status.textContent="错误："+err.message;
  }
}

async function loadSample(){
  const x=await getSample();
  document.querySelector("#input").value=JSON.stringify(x,null,2);
  run();
}

function download(){
  if(!lastResult) return;
  const blob=new Blob([JSON.stringify(lastResult,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="zdsm_result.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

document.querySelector("#run").addEventListener("click",run);
document.querySelector("#sample").addEventListener("click",loadSample);
document.querySelector("#download").addEventListener("click",download);
loadSample();
