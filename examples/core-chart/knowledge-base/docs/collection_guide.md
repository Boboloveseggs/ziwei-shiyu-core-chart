# 资料收集与录入规范

## 一、每次看到一条资料，先判断它属于什么

只允许归入以下类型之一：

1. 主星核心函数
2. 宫位功能
3. 星×宫规则
4. 双星/星煞交互
5. 庙旺状态
6. 四化/飞化规则
7. 三方四正/拓扑规则
8. 时间算法
9. 小星细化
10. 报告文本片段
11. 冲突裁决规则

如果一条资料同时包含多个结论，必须拆成多张规则卡。

## 二、来源必须和解释分开

原文：
- 保存在 source
- 尽量短
- 保留书名、章节、页码/位置

现代转译：
- 保存在 rule.effects
- 标 evidence_type = M

特定流派：
- 标 evidence_type = S
- 必须写 school

## 三、规则卡最低字段

- rule_id
- rule_type
- conditions
- effects
- evidence_type
- source_ids
- confidence
- status
- falsifiable
- observable_indicators
- disconfirming_observations

## 四、禁止录入的规则

- “某星=一定发财”
- “某年=一定结婚”
- “某煞=一定事故”
- 没有条件的绝对剧情
- 无来源的固定百分比
- 无法反证且只能事后圆回来的断语

## 五、推荐编号

- 主星：R-MAJOR-001
- 宫位：R-PALACE-001
- 星宫：R-SP-001
- 交互：R-INT-001
- 庙旺：R-STATE-001
- 四化：R-TRANS-001
- 拓扑：R-TOPO-001
- 时间：R-TIME-001
- 小星：R-MINOR-001
- 冲突：R-CONFLICT-001

## 六、每100条规则做一次清理

检查：
- 有没有同义重复
- 有没有不同来源但其实讲同一规则
- 有没有流派混用
- 有没有不能验证的规则
- 有没有只靠换星名就能套给所有人的模板


## 七、版本冲突的处理

同一规则出现多个版本时，不合并、不投票。

必须：
- 各建一个 `table_id` / `rule_id`
- 标 source_id
- 标 school / edition
- 由上游 conventions 选择

例如四化：
- `PROJECT_BOOK_V1`
- `QUANJI_COMMON_V1`
- `QUANSHU_COMPARE_V1`

解释引擎只接受已选定版本的结果。
