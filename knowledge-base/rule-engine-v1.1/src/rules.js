export const VERSION = "1.1.0";

export const PALACES = ["命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","交友","官禄","田宅","福德","父母"];

export const STATE_MULTIPLIER = {
  "庙":1.25,"旺":1.18,"得":1.10,"利":1.08,"平":1.00,"不":0.90,"陷":0.78
};

export const STAR_PROFILES = {
 "紫微": {drive:1.0,process:2.6,output:0.8,store:0.8,support:1.2,friction:0.4},
 "天机": {drive:0.9,process:2.0,output:1.0,store:2.0,support:0.8,friction:0.7},
 "太阳": {drive:1.2,process:1.4,output:1.8,store:0.5,support:1.1,friction:0.7},
 "武曲": {drive:2.4,process:1.6,output:0.8,store:1.2,support:0.5,friction:0.6},
 "天同": {drive:0.5,process:0.7,output:0.8,store:0.8,support:2.0,friction:0.3},
 "廉贞": {drive:1.2,process:1.3,output:1.4,store:0.5,support:0.5,friction:1.3},
 "天府": {drive:0.7,process:1.2,output:0.6,store:2.3,support:1.5,friction:0.3},
 "太阴": {drive:0.5,process:0.8,output:0.7,store:1.8,support:1.2,friction:0.6},
 "贪狼": {drive:1.6,process:1.0,output:2.0,store:0.4,support:0.8,friction:1.2},
 "巨门": {drive:0.8,process:1.5,output:2.5,store:0.6,support:0.5,friction:1.4},
 "天相": {drive:0.7,process:1.6,output:0.8,store:0.8,support:2.1,friction:0.4},
 "天梁": {drive:0.6,process:1.2,output:0.7,store:1.0,support:1.8,friction:0.5},
 "七杀": {drive:2.5,process:1.5,output:1.0,store:0.3,support:0.2,friction:1.0},
 "破军": {drive:1.8,process:2.5,output:1.2,store:0.2,support:0.3,friction:1.2}
};

export const AUX_PROFILES = {
 "左辅":{support:0.8},"右弼":{support:0.8},
 "文昌":{output:0.5,store:0.4},"文曲":{output:0.4,store:0.7},
 "天魁":{support:0.5},"天钺":{support:0.5},
 "禄存":{store:0.6,output:0.4},"天马":{drive:0.4,friction:0.2},
 "三台":{store:0.25},"八座":{support:0.25},"台辅":{support:0.25},
 "天官":{support:0.2},"天贵":{support:0.2},"封诰":{support:0.2},
 "解神":{friction:-0.2},"红鸾":{output:0.2,support:0.2},"天喜":{support:0.2}
};

export const MALEFIC_PROFILES = {
 "擎羊":{drive:0.4,friction:0.9},"陀罗":{friction:1.0},
 "火星":{drive:0.4,friction:0.8},"铃星":{output:0.2,friction:0.8},
 "地空":{friction:0.7},"天空":{friction:0.7},"地劫":{friction:0.9},
 "截空":{friction:0.6},"劫煞":{friction:0.6},"天虚":{friction:0.5},
 "大耗":{friction:0.7},"天哭":{friction:0.4},"破碎":{friction:0.4},
 "孤辰":{friction:0.3},"天姚":{friction:0.2}
};

export const PALACE_ROLE = {
 "命宫":"engine",
 "官禄":"processor",
 "迁移":"input","交友":"input","父母":"input","兄弟":"input","夫妻":"input",
 "子女":"output","财帛":"output",
 "田宅":"storage",
 "福德":"regulation",
 "疾厄":"recovery"
};

export const ROLE_WEIGHT = {
 engine:{drive:1.65,process:1.15,output:0.8,store:0.6,support:0.7,friction:1.0},
 processor:{drive:1.15,process:1.75,output:1.0,store:0.8,support:0.9,friction:1.0},
 input:{drive:0.7,process:0.8,output:0.7,store:0.7,support:1.65,friction:1.0},
 output:{drive:0.8,process:0.9,output:1.75,store:0.9,support:0.6,friction:1.15},
 storage:{drive:0.5,process:1.1,output:0.7,store:1.85,support:0.9,friction:0.85},
 regulation:{drive:0.9,process:1.1,output:0.6,store:0.8,support:0.9,friction:1.35},
 recovery:{drive:0.6,process:0.8,output:0.5,store:1.0,support:1.0,friction:1.35}
};

export const TRINES = [
  ["命宫","财帛","官禄"],
  ["兄弟","田宅","疾厄"],
  ["夫妻","福德","迁移"],
  ["子女","父母","交友"]
];

export const OPPOSITES = {
  "命宫":"迁移","迁移":"命宫",
  "兄弟":"交友","交友":"兄弟",
  "夫妻":"官禄","官禄":"夫妻",
  "子女":"田宅","田宅":"子女",
  "财帛":"福德","福德":"财帛",
  "疾厄":"父母","父母":"疾厄"
};

export const ENGINE_CONFIG = {
  maxInputs: 3,
  maxOutputs: 2,
  maxMainNodes: 8,
  trineBonus: 0.16,
  oppositeBonus: 0.08,
  bodyDriveBonus: 0.8,
  bodyProcessBonus: 0.9,
  timingDecadeBonus: 0.45,
  timingYearBonus: 0.65,
  timingSmallLimitBonus: 0.35
};
