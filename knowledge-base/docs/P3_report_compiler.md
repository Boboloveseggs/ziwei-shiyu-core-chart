# P3 最终报告编译器

P3 的目标不是继续增加命理条目，而是把 P0–P2 的结构化结果编译成稳定报告。

## 编译顺序

1. Natal Engine：得到十二宫、主星、状态、组合、四化/自化
2. Time Engine：得到大限→流年→小限→流月→流日→流时
3. Claim Generator：只生成结构化结论
4. Conclusion Ownership：每个核心结论指定唯一主章节
5. Dedup：合并同义结论、证据、行动
6. Confidence：High / Medium / Low
7. Validation：生成现实指标与反证条件
8. Distinctiveness Check：至少三条本盘高辨识度判断
9. Renderer：最后才渲染 plain / professional
10. Quality Gate：失败则不作为正式报告发布

## 结论归属

- 身体损耗、恢复、作息 → 身体
- 职业形态、机会、长期职业资产 → 事业
- 定价、合同、现金流、分成 → 钱
- 伴侣、推进、长期稳定 → 爱情/关系
- 六类关系只补充独有信息

## 去重

比如：
“提前谈价格”
“不要低报价”
“明确收费”
“确认付款节点”
“别口头约定”

统一编译成：

> 项目开始前用书面文件确认价格、工作范围、付款节点、修改次数、追加需求和分成规则。

最终行动只保留 `A-CONTRACT` 一次。

## 置信度

内部可以检查证据数量，但最终只展示：
- high
- medium
- low

不展示伪精确数字。

## 可反证

High / Medium Claim 必须输出：
- reality_checks
- disconfirming_conditions

没有反证条件的结论不能通过 Quality Gate。

## 两种渲染

### plain
不复制完整技术推导，直接给：
- 年度总因果链
- 身体
- 事业
- 钱
- 爱情
- 六类关系
- 行动清单
- 三抓手 / 三红线 / 三指标

### professional
在 plain 基础上增加：
- 置信度
- evidence_trace
- 反证条件
- 命盘辨识度检查
- Quality Gate

## 非 AI 模式

P3 完全使用确定性规则和模板运行。
AI 以后只能作为可选 Renderer，把已经确定的 claim 改写得更自然，不能新增事实或改变结论。
