#!/usr/bin/env python3
from pathlib import Path
import json, csv, sys, re, hashlib

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"data"
ENGINE=ROOT/"engine"

AXES=["身体","事业","钱","爱情/关系"]
REL_SECTIONS=["朋友/社群/同行","兄弟姐妹/同辈/团队","父母/亲人/长辈","爱人/伴侣","合作方/客户/上级","晚辈/学生/下属/粉丝/受众"]

def load_csv(name):
    with open(DATA/name,encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))

OWNERSHIP={r["claim_family"]:r for r in load_csv("conclusion_ownership_policy.csv")}
ACTIONS={r["action_id"]:r for r in load_csv("action_library.csv")}

def stable_id(prefix, payload):
    raw=json.dumps(payload,ensure_ascii=False,sort_keys=True)
    return prefix+"-"+hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]

def by_palace(natal):
    return {p["palace"]:p for p in natal["palaces"]}

def stars(p):
    return [x["star"] for x in p.get("major_star_rules",[])]

def states(p):
    return {x["star"]:x.get("state") for x in p.get("major_star_rules",[])}

def has_transform(p, star=None, typ=None, layer=None):
    for t in p.get("transformations",[]):
        if star and t.get("star")!=star: continue
        if typ and t.get("type")!=typ: continue
        if layer and t.get("layer")!=layer: continue
        return True
    return False

def aux_names(p):
    return [x["star"] for x in p.get("auxiliary",[])]

def is_high_state(s):
    return s in {"庙","旺","得地","利","得"}

def is_low_state(s):
    return s in {"陷","不得地","不"}

def support_count(p):
    n=0
    for a in p.get("auxiliary",[]):
        if a.get("operator") in {"support","buffering"}: n+=1
    return n

def friction_count(p):
    n=0
    for a in p.get("auxiliary",[]):
        if a.get("operator") in {"disruption","decoupling","amplification"}: n+=1
    return n

def conf(structure=True, corroborations=0, only_detail=False):
    if only_detail: return "low"
    if structure and corroborations>=2: return "high"
    if structure and corroborations>=1: return "medium"
    return "low"

def mk_claim(family, summary, tendency, manifestations, checks, disconfirm, evidence, confidence, action_ids=None, tags=None):
    owner=OWNERSHIP[family]["owner_section"]
    payload={"family":family,"summary":summary,"evidence":evidence}
    return {
        "claim_id":stable_id("CLM",payload),
        "family":family,
        "owner_section":owner,
        "summary":summary,
        "core_tendency":tendency,
        "possible_manifestations":manifestations,
        "reality_checks":checks,
        "disconfirming_conditions":disconfirm,
        "evidence_trace":evidence,
        "confidence":confidence,
        "action_ids":action_ids or [],
        "tags":tags or []
    }

def ev(palace, detail, layer="natal", source_type="M"):
    return {"layer":layer,"palace":palace,"detail":detail,"evidence_type":source_type}

def generate_claims(natal, timed):
    P=by_palace(natal)
    claims=[]

    # BODY
    dis=P["疾厄宫"]; ming=P["命宫"]; career=P["官禄宫"]; fude=P["福德宫"]
    body_ev=[]
    body_ev += [ev("疾厄宫", f"{x['star']}({x.get('state')})") for x in dis["major_star_rules"]]
    body_ev += [ev("疾厄宫", f"{t['star']}生年/自化{t['type']}", t.get("layer","natal"), "S" if "self" in t.get("layer","") else "M") for t in dis.get("transformations",[])]
    if natal.get("profile",{}).get("body_palace")=="官禄宫":
        body_ev.append(ev("官禄宫","身宫落官禄：后天能量大量投入生产/角色","natal","T+M"))
    body_ev += [ev("福德宫", f"{a['star']}:{a['operator']}") for a in fude.get("auxiliary",[])]
    corr=max(0,len(body_ev)-1)
    claims.append(mk_claim(
        "BODY-RECOVERY",
        "行动/生产速度与恢复系统之间的配速，是身体轴的核心问题。",
        "身体判断优先看“负荷—恢复—再次投入”的循环，而不是把单颗疾厄星直接等同具体疾病。",
        [
            "高压项目、持续输出或连续赶进度后，恢复质量更容易决定下一轮发挥。",
            "如果身体状态下降，现实表现更可能先出现在注意力、耐力、动作质量或恢复速度，而不是命理直接指定某种疾病。"
        ],
        ["记录高强度工作后的恢复时长","比较睡眠充足与不足时的工作/运动表现","观察压力上升时是否同步出现身体负荷信号"],
        ["长期高强度工作后仍能稳定恢复，且身体状态与压力水平长期无明显关联"],
        body_ev, conf(True,corr), ["A-RECOVERY"], ["recovery","body"]
    ))

    # CAREER MODE
    c=career; m=ming
    ce=[]
    if c.get("combination"):
        ce.append(ev("官禄宫",f"{'+'.join(c['combination']['stars'])}:{c['combination']['effect']}","natal","T+M"))
    for x in c["major_star_rules"]:
        ce.append(ev("官禄宫",f"{x['star']}({x.get('state')})"))
    if natal.get("profile",{}).get("body_palace")=="官禄宫":
        ce.append(ev("官禄宫","身宫同落官禄","natal","T+M"))
    if m.get("combination"):
        ce.append(ev("命宫",f"{'+'.join(m['combination']['stars'])}:{m['combination']['effect']}","natal","T+M"))
    claims.append(mk_claim(
        "CAREER-MODE",
        "职业优势更偏向解决复杂问题、重构旧结构，而不是长期只维护固定流程。",
        "职业系统更适合有判断权、重构空间、项目性或复杂问题处理的工作形态。",
        [
            "可能表现为更适合项目型、产品型、咨询型、策略型、内容系统化或0→1任务。",
            "在高度固定、只重复既定流程的岗位中，能力未必差，但主观消耗可能更高。"
        ],
        ["过去最投入的工作是否往往包含‘发现问题—重新设计—推进落地’","是否在拥有自主决策空间时表现明显更好","长期纯维护型任务是否更容易失去动力"],
        ["长期最稳定、最满意的工作始终是低变化、低自主、重复维护型任务"],
        ce, conf(True,max(0,len(ce)-1)), ["A-FOCUS"], ["career","work_mode"]
    ))

    # CAREER ASSET / Tianzhai + output
    tz=P["田宅宫"]; out=P["子女宫"]
    ae=[]
    for x in tz["major_star_rules"]: ae.append(ev("田宅宫",f"{x['star']}({x.get('state')})"))
    for t in tz.get("transformations",[]): ae.append(ev("田宅宫",f"{t['star']}:{t['type']}",t.get("layer","natal"),"S" if "self" in t.get("layer","") else "M"))
    for a in tz.get("auxiliary",[]): ae.append(ev("田宅宫",f"{a['star']}:{a['operator']}"))
    if has_transform(out, typ="忌"):
        ae.append(ev("子女宫","输出端存在生年忌：输出价值伴随反馈/反复成本","natal","M"))
    claims.append(mk_claim(
        "CAREER-ASSET",
        "长期复利更依赖把项目经验、表达和知识转成可重复使用的资产。",
        "单次完成任务不是终点；把成果沉淀为方法、模板、知识库、作品库或产品组件，才能提高下一轮起点。",
        [
            "同一个问题第二次出现时，如果已有模板或方法，效率会显著高于从零开始。",
            "作品、研究、项目经验越能结构化保存，职业系统越稳定。"
        ],
        ["统计过去一年哪些成果被二次复用","观察是否经常做完即丢、下一次重新从零开始","计算可重复使用资产占成果的比例变化"],
        ["长期不做任何知识/流程沉淀仍能稳定获得同等复利，并且重复劳动成本不升高"],
        ae, conf(True,max(0,len(ae)-1)), ["A-ASSET"], ["asset","knowledge"]
    ))

    # MONEY
    money=P["财帛宫"]; me=[]
    if money.get("combination"):
        me.append(ev("财帛宫",f"{'+'.join(money['combination']['stars'])}:{money['combination']['effect']}","natal","T+M"))
    for x in money["major_star_rules"]: me.append(ev("财帛宫",f"{x['star']}({x.get('state')})"))
    for a in money.get("auxiliary",[]): me.append(ev("财帛宫",f"{a['star']}:{a['operator']}"))
    # time transformation to 财帛
    for t in timed.get("activation_trace",[]):
        for tr in t.get("transformations",[]):
            if tr.get("target_palace")=="财帛宫":
                me.append(ev("财帛宫",f"{t['layer']} {tr['star']}化{tr['type']}",t["layer"],"S"))
    claims.append(mk_claim(
        "MONEY-CAPTURE",
        "钱的核心不是‘有没有能力创造价值’，而是价值如何被定价、成交、回收并留下。",
        "财务系统更需要规则化价值捕获：边界、报价、付款、投入上限和现金流管理。",
        [
            "可能出现成果很多，但实际收入、回款速度或最终留存与投入不完全同步。",
            "机会越多时，选择成本和资源分散问题反而更值得关注。"
        ],
        ["比较项目产出价值与实际到账金额","记录从报价到回款的周期","检查是否存在大量低兑现机会占用时间"],
        ["长期所有成果都能稳定按预期定价、及时回款且现金留存与产出完全同步"],
        me, conf(True,max(0,len(me)-1)), ["A-CONTRACT","A-CASHFLOW"], ["money","value_capture"]
    ))

    # LOVE
    cp=P["夫妻宫"]; le=[]
    for x in cp["major_star_rules"]: le.append(ev("夫妻宫",f"{x['star']}({x.get('state')})"))
    for a in cp.get("auxiliary",[]): le.append(ev("夫妻宫",f"{a['star']}:{a['operator']}"))
    for t in timed.get("activation_trace",[]):
        if t.get("palace")=="夫妻宫":
            le.append(ev("夫妻宫",f"{t['layer']}直接激活",t["layer"],"M"))
    claims.append(mk_claim(
        "LOVE-PARTNER",
        "关系质量更依赖规则、协商与兑现，而不是只看情绪浓度。",
        "适合能协作、愿意明确分工并在变化中保持沟通的人；推进速度应由持续行为而非短期表达决定。",
        [
            "关系中可能较重视公平、边界、责任分配和实际支持。",
            "如果双方承诺很多但兑现率低，消耗感会明显上升。"
        ],
        ["观察对方连续数周/数月的兑现率","出现分歧时是否能协商具体方案","时间、金钱和责任投入是否长期对称"],
        ["长期最稳定的关系完全不需要协商、规则或责任分配，且承诺兑现对满意度影响很小"],
        le, conf(True,max(0,len(le)-1)), ["A-PARTNER"], ["love","partnership"]
    ))

    # FRIENDS
    social=P["交友宫"]; se=[]
    for x in social["major_star_rules"]: se.append(ev("交友宫",f"{x['star']}({x.get('state')})"))
    for a in social.get("auxiliary",[]): se.append(ev("交友宫",f"{a['star']}:{a['operator']}"))
    for t in timed.get("activation_trace",[]):
        if t.get("palace")=="交友宫": se.append(ev("交友宫",f"{t['layer']}激活",t["layer"],"M"))
    claims.append(mk_claim(
        "SOCIAL-NETWORK",
        "社群与同行更适合作为信息、渠道和引荐入口，而不应直接替代真实性判断。",
        "朋友/社群能带来新信息和机会，但资源是否真正可调用，需要二次核验。",
        ["可能得到消息、介绍、圈层入口或合作线索","也可能出现信息很多、兑现较少或沟通成本偏高"],
        ["统计社群线索最终转化成真实项目/资源的比例","区分信息型、合作型、情绪型和消耗型关系"],
        ["长期所有社群信息都能直接兑现，几乎不存在筛选和核验成本"],
        se, conf(bool(se),max(0,len(se)-1)), ["A-SOCIAL"], ["social","network"]
    ))

    # PEER TEAM
    peer=P["兄弟宫"]; pe=[]
    if peer.get("combination"): pe.append(ev("兄弟宫",f"{'+'.join(peer['combination']['stars'])}:{peer['combination']['effect']}","natal","T+M"))
    for x in peer["major_star_rules"]: pe.append(ev("兄弟宫",f"{x['star']}({x.get('state')})"))
    for t in peer.get("transformations",[]): pe.append(ev("兄弟宫",f"{t['star']}:{t['type']}",t.get("layer","natal"),"M"))
    claims.append(mk_claim(
        "PEER-TEAM",
        "同辈支持往往和责任、协调或善后绑定。",
        "团队关系的价值不只看是否有人帮忙，还要看分工是否清楚、支持是否会转化为额外责任。",
        ["可能既获得同辈支持，也需要承担协调、照料或推动责任","团队中容易成为帮助把事情推进的人"],
        ["每次接受帮助后是否同步增加责任","团队任务里是否经常承担协调或收尾"],
        ["长期团队关系始终只有单向资源流入，几乎没有责任或人情成本"],
        pe, conf(bool(pe),max(0,len(pe)-1)), ["A-TEAM"], ["peer","team"]
    ))

    # AUTHORITY
    par=P["父母宫"]; au=[]
    for x in par["major_star_rules"]: au.append(ev("父母宫",f"{x['star']}({x.get('state')})"))
    for t in par.get("transformations",[]): au.append(ev("父母宫",f"{t['star']}:{t['type']}",t.get("layer","natal"),"S" if "self" in t.get("layer","") else "M"))
    claims.append(mk_claim(
        "AUTHORITY-FAMILY",
        "长辈、上级和机构可能同时提供资源与评价/规则压力。",
        "与权威系统互动时，需要把能获得的实际资源和需要承担的规则成本分开计算。",
        ["可能得到名分、平台、资格或支持，也可能同步增加审查、责任或评价压力","对机构承诺要看权限和可兑现资源"],
        ["列出每个平台实际提供的资源与要求","观察评价压力是否真正对应现实后果"],
        ["长期所有权威/机构关系都只有资源收益，没有规则、评价或责任成本"],
        au, conf(bool(au),max(0,len(au)-1)), ["A-AUTHORITY"], ["authority","family"]
    ))

    # PARTNER/CLIENT/BOSS — use couple+career+money+authority
    pce=[]
    for pal in ["夫妻宫","官禄宫","财帛宫","父母宫"]:
        q=P[pal]
        if q.get("combination"): pce.append(ev(pal,f"{'+'.join(q['combination']['stars'])}"))
        for t in q.get("transformations",[]): pce.append(ev(pal,f"{t['star']}:{t['type']}",t.get("layer","natal"),"M"))
    claims.append(mk_claim(
        "PARTNER-COOP",
        "合作能不能做，核心取决于决策权、资源权、付款权和责任是否对称。",
        "能力互补本身不够；合作必须确认谁拍板、谁提供资源、谁付款、谁承担返工。",
        ["合作前期可能谈得顺，但真正稳定性要到交付、付款和变更阶段才看得出来","大平台/上级的价值取决于实际权限和资源，而非名头"],
        ["核验对方是否有最终决策权","看首个付款节点是否准时","出现变更时是否按约定承担成本"],
        ["长期合作完全无需明确权责、付款和变更规则仍能稳定运行"],
        pce, conf(True,max(0,len(pce)-1)), ["A-CONTRACT"], ["cooperation","client","boss"]
    ))

    # AUDIENCE / OUTPUT
    oe=[]
    for x in out["major_star_rules"]: oe.append(ev("子女宫",f"{x['star']}({x.get('state')})"))
    for t in out.get("transformations",[]): oe.append(ev("子女宫",f"{t['star']}:{t['type']}",t.get("layer","natal"),"M"))
    for a in out.get("auxiliary",[]): oe.append(ev("子女宫",f"{a['star']}:{a['operator']}"))
    for t in timed.get("activation_trace",[]):
        if t.get("palace")=="子女宫": oe.append(ev("子女宫",f"{t['layer']}激活",t["layer"],"M"))
        for tr in t.get("transformations",[]):
            if tr.get("target_palace")=="子女宫":
                oe.append(ev("子女宫",f"{t['layer']} {tr['star']}化{tr['type']}",t["layer"],"S"))
    claims.append(mk_claim(
        "AUDIENCE-OUTPUT",
        "表达、作品、教学和受众既可能成为资源入口，也容易形成持续反馈成本。",
        "最适合建立“输出系统”，而不是让每一条反馈都进入情绪和修改循环。",
        ["作品越有传播和资源价值，越可能同步增加评论、追问、修改、误解或争论","教学/内容适合把复杂问题讲清，但需要反馈分层"],
        ["记录高价值反馈与纯情绪反馈的比例","观察输出量增加时沟通成本是否同步增加","看哪些作品真正形成复用或变现"],
        ["长期高频输出几乎不带来额外沟通、反馈或修改成本"],
        oe, conf(True,max(0,len(oe)-1)), ["A-OUTPUT","A-ASSET"], ["output","audience"]
    ))

    return claims

def dedupe_claims(claims):
    # same family -> preserve one, merge evidence/actions/manifestations/checks
    merged={}
    for c in claims:
        k=c["family"]
        if k not in merged:
            merged[k]=c
            continue
        m=merged[k]
        for fld in ["possible_manifestations","reality_checks","disconfirming_conditions","evidence_trace","action_ids","tags"]:
            seen={json.dumps(x,ensure_ascii=False,sort_keys=True) if isinstance(x,dict) else x for x in m[fld]}
            for x in c[fld]:
                key=json.dumps(x,ensure_ascii=False,sort_keys=True) if isinstance(x,dict) else x
                if key not in seen:
                    m[fld].append(x); seen.add(key)
        if c["confidence"]=="high": m["confidence"]="high"
        elif c["confidence"]=="medium" and m["confidence"]=="low": m["confidence"]="medium"
    return list(merged.values())

def canonical_actions(claims):
    used=[]
    seen=set()
    for c in claims:
        for aid in c.get("action_ids",[]):
            if aid in seen or aid not in ACTIONS: continue
            seen.add(aid)
            r=ACTIONS[aid]
            used.append({"action_id":aid,"owner_section":r["owner_section"],"text":r["text"]})
    return used

def annual_chain(natal,timed):
    layers=timed.get("time_layers",{})
    order=["decade","minor_limit","annual","monthly","daily","hourly"]
    labels={"decade":"大限","minor_limit":"小限","annual":"流年","monthly":"流月","daily":"流日","hourly":"流时"}
    items=[]
    for k in order:
        x=layers.get(k)
        if x and x.get("palace"):
            items.append({"layer":labels[k],"palace":x["palace"],"source":x.get("source","")})
    # Most repeated activated palace
    rep=timed.get("same_palace_resonance",{})
    repeated=[{"palace":p,"layers":ls} for p,ls in rep.items()]
    return {
        "layers":items,
        "repeated_nodes":repeated,
        "causal_summary":"按权限从大限到短周期逐层收窄；短周期只允许细化已经存在的结构，不单独创造重大事件。",
        "short_term_gating":timed.get("short_term_gating",[])
    }

def build_sections(claims):
    sections={s:[] for s in AXES+REL_SECTIONS}
    # Love claim owner is 爱情/关系 but relation report also needs 爱人/伴侣 unique note.
    for c in claims:
        sections.setdefault(c["owner_section"],[]).append(c)
    # Add non-duplicating lover relation pointer, not full repeated explanation
    love=next((c for c in claims if c["family"]=="LOVE-PARTNER"),None)
    if love:
        sections["爱人/伴侣"].append({
            "claim_id":stable_id("REF",{"love":love["claim_id"]}),
            "family":"LOVE-REL-REF",
            "owner_section":"爱人/伴侣",
            "summary":"伴侣关系的独有观察重点是长期兑现与冲突协商。",
            "core_tendency":"这里不重复爱情主轴，只补充对象筛选标准。",
            "possible_manifestations":["适合观察对方是否持续投入时间、承担责任并能处理分歧。"],
            "reality_checks":["看承诺兑现、冲突后修复、责任分担是否稳定。"],
            "disconfirming_conditions":[],
            "evidence_trace":love["evidence_trace"][:2],
            "confidence":love["confidence"],
            "action_ids":[],
            "tags":["relation_reference"]
        })
    return sections

def distinctive_signatures(claims):
    # Prefer claims with high confidence and multiple structural evidence.
    preferred=["CAREER-MODE","CAREER-ASSET","MONEY-CAPTURE","AUDIENCE-OUTPUT","PEER-TEAM","LOVE-PARTNER"]
    out=[]
    for fam in preferred:
        c=next((x for x in claims if x["family"]==fam),None)
        if not c: continue
        if len(c["evidence_trace"])<2: continue
        out.append({
            "claim_id":c["claim_id"],
            "signature":c["summary"],
            "special_combination":"；".join(e["detail"] for e in c["evidence_trace"][:3]),
            "why_not_template":"结论由本盘具体宫位、主星组合、状态/四化或时间重复共同触发，不由单颗星直接生成。",
            "how_to_verify":c["reality_checks"][:2]
        })
        if len(out)>=3: break
    return out

def validation_objects(claims, analysis_window):
    arr=[]
    for c in claims:
        if c["confidence"]=="low": continue
        arr.append({
            "validation_id":stable_id("VAL",{"claim":c["claim_id"],"window":analysis_window}),
            "claim_id":c["claim_id"],
            "analysis_window":analysis_window,
            "observable_indicators":c["reality_checks"],
            "expected_direction":c["core_tendency"],
            "disconfirming_observations":c["disconfirming_conditions"],
            "result":"unknown"
        })
    return arr

def quality_gate(report):
    issues=[]
    claims=[c for arr in report["sections"].values() for c in arr if c.get("family")!="LOVE-REL-REF"]
    ids=[c["claim_id"] for c in claims]
    if len(ids)!=len(set(ids)): issues.append("duplicate_claim_id")
    # Family should only be fully owned once
    fams=[c["family"] for c in claims]
    if len(fams)!=len(set(fams)): issues.append("same_family_explained_more_than_once")
    if len(report.get("distinctive_signatures",[]))<3: issues.append("fewer_than_3_distinctive_signatures")
    action_ids=[a["action_id"] for a in report.get("actions",[])]
    if len(action_ids)!=len(set(action_ids)): issues.append("duplicate_actions")
    required={"身体","事业","钱","爱情/关系"}
    if not required.issubset(report["sections"].keys()): issues.append("missing_main_axis")
    for c in claims:
        if c["confidence"] in {"high","medium"} and not c.get("disconfirming_conditions"):
            issues.append(f"missing_disconfirm:{c['claim_id']}")
    # Short-term safety
    chain=report.get("annual_causal_chain",{})
    for x in chain.get("short_term_gating",[]):
        if x.get("status")=="weak_short_term_signal":
            pass
    return {"status":"pass" if not issues else "fail","issues":issues}

def choose_ending(claims, actions):
    # deterministic selection by family priority, not numeric scores
    grabs=[]
    for fam in ["CAREER-ASSET","CAREER-MODE","MONEY-CAPTURE"]:
        c=next((x for x in claims if x["family"]==fam),None)
        if c: grabs.append(c["summary"])
    reds=[]
    for text in [
        "不要让高频重构变成反复从零开始。",
        "不要把尚未兑现的机会当成已经获得的收入或资源。",
        "不要让情绪型反馈持续占用生产与恢复时间。"
    ]: reds.append(text)
    inds=[]
    for fam in ["CAREER-ASSET","MONEY-CAPTURE","BODY-RECOVERY"]:
        c=next((x for x in claims if x["family"]==fam),None)
        if c and c["reality_checks"]: inds.append(c["reality_checks"][0])
    return {"top_3_grabs":grabs[:3],"top_3_red_lines":reds[:3],"top_3_reality_indicators":inds[:3]}

def compile_report(integrated, request=None):
    natal=integrated["natal"]
    timed=integrated["time"]
    req=request or {}
    claims=dedupe_claims(generate_claims(natal,timed))
    actions=canonical_actions(claims)
    sections=build_sections(claims)
    ownership=[{"claim_id":c["claim_id"],"owner_section":c["owner_section"],"summary":c["summary"]} for c in claims]
    window=req.get("target_datetime") or req.get("analysis_window") or "natal/unspecified"
    report={
        "meta":{
            "engine":"ZDSM",
            "version":"1.4-P3",
            "report_mode":req.get("report_mode","plain"),
            "prediction_mode":req.get("prediction_mode","trend"),
            "profile":natal.get("profile",{})
        },
        "annual_causal_chain":annual_chain(natal,timed),
        "conclusion_ownership":ownership,
        "sections":sections,
        "actions":actions,
        "distinctive_signatures":distinctive_signatures(claims),
        "validation_objects":validation_objects(claims,window),
        "ending":choose_ending(claims,actions),
    }
    report["quality_gate"]=quality_gate(report)
    return report

def render_claim(c, professional=False):
    lines=[]
    lines.append(f"### {c['summary']}")
    lines.append(c["core_tendency"])
    if c["possible_manifestations"]:
        lines.append("可能表现：")
        for x in c["possible_manifestations"]: lines.append(f"- {x}")
    lines.append("判断标准：")
    for x in c["reality_checks"]: lines.append(f"- {x}")
    if professional:
        lines.append(f"置信度：{c['confidence']}")
        lines.append("依据：")
        for e in c["evidence_trace"]:
            lines.append(f"- [{e['layer']}/{e['evidence_type']}] {e['palace']}：{e['detail']}")
        if c["disconfirming_conditions"]:
            lines.append("反证条件：")
            for x in c["disconfirming_conditions"]: lines.append(f"- {x}")
    return "\n".join(lines)

def render_markdown(report, professional=False):
    lines=[]
    profile=report["meta"].get("profile",{})
    lines.append("# ZDSM 紫微动态系统报告")
    lines.append("")
    lines.append(f"- 公历：{profile.get('solar_datetime','')}")
    lines.append(f"- 农历：{profile.get('lunar_datetime','')}")
    lines.append(f"- 五行局：{profile.get('five_element_bureau','')}")
    lines.append(f"- 命主：{profile.get('ming_master','')}；身主：{profile.get('body_master','')}；身宫：{profile.get('body_palace','')}")
    lines.append("")
    lines.append("## 年度总因果链")
    chain=" → ".join(f"{x['layer']}:{x['palace']}" for x in report["annual_causal_chain"]["layers"])
    lines.append(chain or "未提供时间层。")
    if report["annual_causal_chain"]["repeated_nodes"]:
        lines.append("重复激活："+"；".join(f"{x['palace']}({','.join(x['layers'])})" for x in report["annual_causal_chain"]["repeated_nodes"]))
    lines.append(report["annual_causal_chain"]["causal_summary"])
    lines.append("")
    for sec in AXES:
        lines.append(f"## {sec}")
        arr=report["sections"].get(sec,[])
        if not arr: lines.append("当前没有足够高权重信息形成独立结论。")
        for c in arr:
            lines.append(render_claim(c,professional))
            lines.append("")
    lines.append("## 六类关系")
    for sec in REL_SECTIONS:
        lines.append(f"### {sec}")
        arr=report["sections"].get(sec,[])
        if not arr:
            lines.append("本模块没有新增的独有信息，不为凑篇幅重复三大主轴。")
        else:
            for c in arr:
                lines.append(c["summary"])
                for x in c.get("possible_manifestations",[])[:2]:
                    lines.append(f"- {x}")
                if c.get("reality_checks"):
                    lines.append(f"- 观察：{c['reality_checks'][0]}")
        lines.append("")
    lines.append("## 年度行动清单")
    for a in report["actions"]:
        lines.append(f"- [{a['owner_section']}] {a['text']}")
    lines.append("")
    lines.append("## 三条最该抓")
    for x in report["ending"]["top_3_grabs"]: lines.append(f"- {x}")
    lines.append("## 三条红线")
    for x in report["ending"]["top_3_red_lines"]: lines.append(f"- {x}")
    lines.append("## 三个现实验证指标")
    for x in report["ending"]["top_3_reality_indicators"]: lines.append(f"- {x}")
    if professional:
        lines.append("")
        lines.append("## 命盘辨识度检查")
        for s in report["distinctive_signatures"]:
            lines.append(f"- {s['signature']}")
            lines.append(f"  - 特殊组合：{s['special_combination']}")
            lines.append(f"  - 区分原因：{s['why_not_template']}")
            lines.append(f"  - 验证：{'；'.join(s['how_to_verify'])}")
        lines.append("")
        lines.append(f"## Quality Gate: {report['quality_gate']['status']}")
        if report["quality_gate"]["issues"]:
            for x in report["quality_gate"]["issues"]: lines.append(f"- {x}")
    return "\n".join(lines)

if __name__=="__main__":
    if len(sys.argv)<3:
        print("usage: python report_compiler.py integrated.json request.json [--professional]")
        raise SystemExit(2)
    integrated=json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    req=json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    report=compile_report(integrated,req)
    if "--markdown" in sys.argv or "--professional" in sys.argv:
        print(render_markdown(report,professional="--professional" in sys.argv))
    else:
        print(json.dumps(report,ensure_ascii=False,indent=2))
