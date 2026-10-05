# ZDSM Knowledge Base Starter v1

这是一个**不依赖 AI**也能收集、管理、检索紫微斗数规则的资料库起步包。

## 设计目标

把资料从“文章/口诀/讲义”拆成机器可读的规则原子：

> 来源原文 → 规则卡 → 条件 → 作用 → 证据类型 → 置信级别 → 验证记录

## 推荐工作流

1. 收集原始来源（古籍、教材、流派资料）
2. 人工校对 OCR
3. 为每条规则建立 source 记录
4. 拆成 rule card
5. 标记 `T / S / M / E`
6. 录入 JSON / CSV / SQLite
7. 用命盘跑规则
8. 保存现实反馈到 validation_records
9. 定期降权、修订或删除无效规则

## 核心目录

- `schemas/`：JSON Schema
- `data/`：初始数据与 CSV 模板
- `sql/`：SQLite / PostgreSQL 兼容表结构
- `scripts/`：校验和建库脚本
- `docs/`：录入规范
- `examples/`：规则卡实例

## 最核心原则

不要保存“某星一定发生某事”的固定剧情。

优先保存：
- 核心功能
- 触发条件
- 交互类型
- 现实可能表现
- 反证条件
- 来源



## v1.1 P0 已填充

本版本已经新增：

- 14 主星 × 12 地支庙旺状态：168 条
- P0 辅星/煞星状态：文昌、文曲、禄存、擎羊、陀罗、火星、铃星
- 三套可切换四化表（项目资料 / 全集常见 / 全书版本对照）
- 13 颗高权重辅煞的现代功能映射
- 27 条主要双星/组合交互规则
- source_audit：把版本冲突与未核定数据显式列出

### 网站默认建议

如果输入来自文墨天机：
1. 优先使用文墨/上游排盘器直接给出的四化结果；
2. 如果需要自行计算，必须显式指定 `sihua_table_id`；
3. 不允许解释引擎自行选择四化版本。

庙旺表建议默认：
`QUANSHU_MAIN_14_V1`

任何状态为 `未定` 的辅煞：
- 不参与庙旺门控；
- 只使用其核心交互函数。


## v1.2 P1 已完成

- 星×宫规则：168 条
- 传统来源明确：166 条
- OCR 部分可恢复：0 条
- 仅 ZDSM 模型投射：2 条（保持 experimental）
- 传统可同宫主星组合：24 类
- 14 主星 pair matrix：91 组
- 新增不依赖 AI 的基础规则引擎
- 已使用 1997-05-18 文墨盘做回归测试

运行：

```bash
python engine/analyze_chart.py examples/example_chart_1997_05_18_full.json --plain
```


## v1.3 P2 已完成

新增：
- 时间层输入 Schema
- 大限/流年/小限位置读取
- 流月/流日/流时上游输入接口
- 时间权限与共振门控
- 长生十二神计算规则
- 博士十二神计算规则
- 生年太岁十二神低权重层
- 年支十四星功能层
- 红鸾/天喜/天姚/咸池等细化星曜
- 2026-10-10 09:00–11:00 回归测试
- `engine/time_engine.py`
- `engine/analyze_with_time.py`

关键规则：
**流月、流日、流时在算法口径未锁定时不由解释引擎自行计算。**


## v1.4 P3：报告编译层完成

新增：
- `engine/report_compiler.py`
- `engine/run_pipeline.py`
- Conclusion Ownership
- 自动去重
- 行动同义项合并
- High / Medium / Low 置信度
- Reality Checks
- Disconfirming Conditions
- Validation Objects
- 命盘辨识度检查
- Plain / Professional 双渲染
- 最终 Quality Gate
- 网站 API Contract

完整非 AI 流程：

```bash
python engine/run_pipeline.py   examples/example_chart_1997_05_18_full.json   examples/example_request_2026_10_10_09_11.json   professional
```

只有 Quality Gate 为 `pass` 的报告建议正式展示。


## v1.5 P4 Local：最终产品方向

本版本正式取消 AI API 依赖。

主流程：
- 本地规则库
- 确定性代码
- 报告编译器
- 十二宫系统图
- 人工联系方式

运行：

```bash
python engine/full_local_pipeline.py \
  examples/example_chart_1997_05_18_full.json \
  examples/example_request_2026_10_10_09_11.json \
  output
```

输出：
- `report.json`
- `report.md`
- `system_map.json`
- `system_map.html`

人工联系方式：`config/contact.json`

示例可视化：`examples/example_system_map_1997_05_18.html`

**主报告生成全程不调用 AI。用户看完后如有疑问，直接联系人工。**
