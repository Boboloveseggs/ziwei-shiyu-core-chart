# P1：星×宫生成规则与主星组合库

## 已完成

### 1. 14 主星 × 12 宫
共 **168 条**规则。

每条分为两层：

- `source_excerpt`：项目来源中可恢复的传统表述；
- `modern_core_effect`：ZDSM 的确定性“主星核心函数 × 宫位功能”投射。

同时保存：
- source_status
- possible_manifestations
- risk_pattern
- do_not_infer
- confidence

因此网站可以在不使用 AI 的情况下生成基础解释，同时不会把现代模型冒充为古籍原话。

### 2. 主星同宫组合
项目来源明确列出六组地支中的 **24 类可同宫主星组合**：

- 寅申：5
- 卯酉：5
- 辰戌：3
- 巳亥：3
- 丑未：5
- 子午：3

另生成 14 主星两两 **91 组 pair matrix**。
只有 24 组标记 `can_colocate=true`。

这可以防止规则引擎错误生成“不可能同宫”的组合断语。

### 3. 非 AI 规则引擎
`engine/analyze_chart.py`

作用：
1. 读取标准化命盘 JSON；
2. 查找星×宫规则；
3. 查找主星同宫组合；
4. 应用庙旺状态描述；
5. 加入高优先级辅煞；
6. 加入上游已经计算好的四化/自化；
7. 输出结构化 JSON 或基础大白话文本。

它**不负责排盘、不负责重新算四化、不负责流月流日**。

## source_status

- `source_explicit`：项目资料有明确星入该宫文字
- `partial_ocr`：资料存在相关内容，但 OCR 标题或句子不完整
- `model_projection_only`：当前资料没有恢复出明确条目，只使用 ZDSM 函数投射

最后一种必须保持 experimental，不能标成传统规则。
