# Integration Contract

## 推荐调用流程

```text
birth input
  ↓
chart engine
  ↓
chart normalizer
  ↓
ZDSM skill
  ↓
report renderer
  ↓
validation log
```

## 伪代码

```ts
function analyzeZiwei(input: ZDSMInput): ZDSMOutput {
  assertConventions(input.conventions);

  const chart = normalizeChart(input);
  const core = buildCoreFunctions(chart);
  const states = applyTempleStates(core);
  const interactions = resolveInteractions(states);
  const topology = buildTraditionalTopology(interactions);

  const natalFlow = applyNatalTransformations(topology);

  const schoolFlow = input.conventions.self_transform_semantics
    ? applySchoolSpecificFlow(natalFlow, input)
    : natalFlow;

  const subsystem = selectSubsystem(schoolFlow, input.request);

  const timed = applyTimeLayersInOrder(
    subsystem,
    ["natal","decade","annual","minor_limit","monthly","daily","hourly"]
  );

  const gated = applyRealityContextGate(timed, input.request?.context);

  const conclusions = generateClaims(gated);
  const owned = assignConclusionOwnership(conclusions);
  const deduped = deduplicate(owned);
  const validated = attachRealityChecksAndDisconfirmers(deduped);

  const quality = runQualityGate(validated, input);

  if (quality.status === "fail") {
    return { ...partialOutput, quality_gate: quality };
  }

  return renderOutput(validated, input.request?.report_mode ?? "plain");
}
```

## 网站端不要做的事

- 不要把排盘算法写进 LLM prompt 后让模型自己算。
- 不要让模型猜流月/流日/流时算法。
- 不要让前端把所有星曜拼成一段文字再让模型自由发挥。
- 不要把“小星数量”做成简单加减分。
- 不要用固定事件模板自动套人。

## 网站端应该做的事

- Chart Engine 只负责“算对”；
- ZDSM Skill 只负责“解释”；
- 每个结论保留 evidence_trace；
- 保存用户现实反馈，给规则做后验验证；
- 允许用户切换“专业版/大白话版”；
- 允许用户查看“这条结论是怎么来的”。
