import {
  PALACES, STATE_MULTIPLIER, STAR_PROFILES, AUX_PROFILES, MALEFIC_PROFILES,
  PALACE_ROLE, ROLE_WEIGHT, TRINES, OPPOSITES, ENGINE_CONFIG
} from "./rules.js";

const DIMS = ["drive","process","output","store","support","friction"];

function blank(){
  return {drive:0,process:0,output:0,store:0,support:0,friction:0};
}
function add(a,b,m=1){
  for(const k of DIMS) a[k] += (b?.[k]||0)*m;
}
function clamp(v,min=0,max=5){ return Math.max(min,Math.min(max,v)); }
function sumStrength(s){
  return clamp(
    s.drive*0.18 + s.process*0.22 + s.output*0.18 +
    s.store*0.16 + s.support*0.14 + s.friction*0.12
  );
}

function applyTransform(score,tr){
  const t = tr?.type || "";
  if(t.includes("禄")){ score.output += 0.55; score.store += 0.35; }
  if(t.includes("权")){ score.drive += 0.50; score.process += 0.45; }
  if(t.includes("科")){ score.process += 0.35; score.store += 0.55; }
  if(t.includes("忌")){ score.friction += 0.85; score.output += 0.15; }
  if(tr?.dir === "out") score.output += 0.30;
  if(tr?.dir === "in") score.process += 0.20;
}

export function validateChart(chart){
  const errors = [];
  if(!chart || typeof chart !== "object") errors.push("chart 必须是对象");
  if(!chart?.houses) errors.push("缺少 houses");
  for(const p of PALACES){
    if(!chart?.houses?.[p]) errors.push(`缺少宫位：${p}`);
  }
  return {ok:errors.length===0, errors};
}

export function scoreHouse(name,h={}){
  const role = h.body ? "processor" : (PALACE_ROLE[name] || "input");
  const raw = blank();

  for(const st of (h.main||[])){
    add(raw, STAR_PROFILES[st.name]||{}, STATE_MULTIPLIER[st.state]||1);
  }
  for(const s of (h.aux||[])) add(raw, AUX_PROFILES[s]||{}, 1);
  for(const s of (h.malefic||[])) add(raw, MALEFIC_PROFILES[s]||{}, 1);
  for(const tr of (h.transforms||[])) applyTransform(raw,tr);

  if((h.main||[]).length===0){
    raw.support += 0.35;
    raw.process += 0.20;
  }
  if(h.body){
    raw.drive += ENGINE_CONFIG.bodyDriveBonus;
    raw.process += ENGINE_CONFIG.bodyProcessBonus;
  }

  const rw = ROLE_WEIGHT[role];
  const s = blank();
  for(const k of DIMS) s[k] = clamp(raw[k]*(rw[k]||1));

  return {
    name, role, ...s,
    structuralBonus:0,
    activationBonus:0,
    strength:sumStrength(s)
  };
}

function applyStructuralCoupling(scores){
  const byName = Object.fromEntries(scores.map(x=>[x.name,x]));

  for(const tri of TRINES){
    const avg = tri.reduce((acc,p)=>acc+(byName[p]?.strength||0),0)/tri.length;
    for(const p of tri){
      if(byName[p]) byName[p].structuralBonus += avg * ENGINE_CONFIG.trineBonus;
    }
  }
  for(const [a,b] of Object.entries(OPPOSITES)){
    if(byName[a] && byName[b]){
      byName[a].structuralBonus += byName[b].strength * ENGINE_CONFIG.oppositeBonus;
    }
  }
  for(const x of scores){
    x.strength = clamp(x.strength + x.structuralBonus);
  }
}

function applyTiming(chart,scores){
  const byName = Object.fromEntries(scores.map(x=>[x.name,x]));
  const t = chart.timing || {};
  const addAct = (p,b)=>{ if(p && byName[p]) byName[p].activationBonus += b; };
  addAct(t.decade?.palace, ENGINE_CONFIG.timingDecadeBonus);
  addAct(t.year?.palace, ENGINE_CONFIG.timingYearBonus);
  addAct(t.smallLimit?.palace, ENGINE_CONFIG.timingSmallLimitBonus);

  for(const x of scores){
    x.activatedStrength = clamp(x.strength + x.activationBonus);
  }
}

function top(arr,key,n=1,filter=()=>true){
  return arr.filter(filter).sort((a,b)=>b[key]-a[key]).slice(0,n);
}

export function level(v){
  if(v>=4) return "很强";
  if(v>=3) return "强";
  if(v>=2) return "中等";
  if(v>=1) return "偏弱";
  return "弱";
}

export function analyzeChart(chart){
  const valid = validateChart(chart);
  if(!valid.ok) throw new Error(valid.errors.join("；"));

  const scores = Object.entries(chart.houses).map(([name,h])=>scoreHouse(name,h));
  applyStructuralCoupling(scores);
  applyTiming(chart,scores);

  const byName = Object.fromEntries(scores.map(x=>[x.name,x]));
  const engine = byName["命宫"];

  const processorCandidates = scores.filter(s=>s.name==="官禄" || chart.houses[s.name]?.body);
  const processor = top(processorCandidates.length?processorCandidates:scores,"process",1)[0];

  const inputNames = ["迁移","交友","父母","兄弟","夫妻"];
  const inputs = scores
    .filter(s=>inputNames.includes(s.name))
    .map(s=>({...s,inputScore:s.support+s.process*0.25-s.friction*0.12}))
    .sort((a,b)=>b.inputScore-a.inputScore)
    .slice(0,ENGINE_CONFIG.maxInputs);

  const outputNames = ["子女","财帛"];
  const outputs = scores
    .filter(s=>outputNames.includes(s.name))
    .map(s=>({...s,outputScore:s.output-s.friction*0.10}))
    .sort((a,b)=>b.outputScore-a.outputScore)
    .slice(0,ENGINE_CONFIG.maxOutputs);

  const storage = byName["田宅"]?.store>=1
    ? byName["田宅"]
    : top(scores,"store",1)[0];

  const bottleneck = top(scores,"friction",1)[0];

  const recoveryCandidates = ["福德","疾厄"].map(x=>byName[x]).filter(Boolean)
    .map(s=>({...s,recoveryScore:s.strength+s.friction*0.25}))
    .sort((a,b)=>b.recoveryScore-a.recoveryScore);
  const recovery = recoveryCandidates[0];

  const mainOutput = outputs[0];
  const secondOutput = outputs[1];

  const visibleNodes = new Set([
    engine?.name, processor?.name,
    ...inputs.map(x=>x.name),
    ...outputs.map(x=>x.name),
    storage?.name, recovery?.name
  ].filter(Boolean));

  const edges = [];
  const hiddenEdges = [];

  function pushEdge(source,target,type,label,priority=1){
    const edge = {source,target,type,label,priority};
    if(visibleNodes.has(source) && visibleNodes.has(target)) edges.push(edge);
    else hiddenEdges.push(edge);
  }

  for(const i of inputs) pushEdge(i.name,processor.name,"input","资源输入",3);
  pushEdge(engine.name,processor.name,"engine","发动",5);

  if(mainOutput) pushEdge(processor.name,mainOutput.name,"output","主要输出",5);
  if(secondOutput) pushEdge(processor.name,secondOutput.name,"output","次级输出",3);

  if(mainOutput) pushEdge(mainOutput.name,storage.name,"growth","沉淀",5);
  if(secondOutput) pushEdge(secondOutput.name,storage.name,"growth","沉淀",3);
  pushEdge(storage.name,processor.name,"feedback","资产反哺",5);

  pushEdge(processor.name,"福德","load","精神负荷",4);
  pushEdge("福德","疾厄","recovery","恢复传导",4);
  pushEdge("疾厄",engine.name,"recovery","恢复反馈",4);

  // useful hidden relationship edges
  pushEdge("交友","夫妻","branch","人脉转合作",2);
  pushEdge("财帛","福德","branch","钱影响价值排序",2);
  pushEdge("子女","交友","branch","输出进入社群",2);
  pushEdge("田宅","子女","feedback","资产优化输出",2);

  const growthLoop = [engine.name,processor.name,mainOutput?.name,storage.name,processor.name].filter(Boolean);
  const recoveryLoop = [processor.name,"福德","疾厄",engine.name,processor.name];

  const summary =
    `该命盘以${processor.name}为主要处理核心，` +
    `能量主要由${[engine.name,...inputs.map(x=>x.name)].slice(0,4).join("、")}进入；` +
    `主要经${mainOutput?.name||"输出系统"}向外释放，并在${storage.name}形成长期积累。` +
    `${bottleneck.name}是摩擦最高节点，长期运行需关注${recovery.name}相关的调节与恢复。`;

  return {
    version:"1.1.0",
    meta:chart.meta||{},
    scores, engine, processor, inputs, outputs, storage, bottleneck, recovery,
    visibleNodes:[...visibleNodes],
    edges, hiddenEdges, growthLoop, recoveryLoop, summary
  };
}
