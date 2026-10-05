# ZDSM Skill v1.0

这是一个“解释引擎 Skill”，不是排盘引擎。

推荐网站架构：

1. Birth Input
2. Chart Engine
3. Chart Normalizer
4. ZDSM Skill
5. Report Renderer
6. Validation Log

## 最小接入

网站只要能够生成：
- 十二宫
- 主/辅/小星
- 庙旺陷
- 生年四化
- 大限/小限/流年
- 可选：飞化/自化/流月流日流时

就可以调用本 Skill。

如果你已经使用文墨天机兼容结果：
建议写一个 parser，把文本转成 `chart_input.schema.json` 所需 JSON。

## 推荐 API

POST /api/ziwei/analyze

Body:
- chart
- conventions
- request

Return:
- normalized_chart
- system_map
- conclusions
- report
- validation_objects
- quality_gate
