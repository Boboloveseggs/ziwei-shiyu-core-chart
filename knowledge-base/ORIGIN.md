# 数据来源记录

- 原始压缩包：`C:\真题\粉笔真贴\ZDSM_Knowledge_Base_v1_5_P4_Local.zip`
- SHA-256：`61D2AB35549F5E68C560054CFB9F2F43215EB8007D6FF00D957402CE4CC18307`
- 接入版本：`1.5-P4-local`
- 接入原则：四化结果、流月、流日和流时沿用上游排盘引擎；知识库用于规则核对、时间门控、来源说明与非确定性机制展示。
- 完整保留：P0–P4 状态、CSV／JSON／SQLite、Schema、Python 本地专家管线、测试、示例和文档。
- 浏览器实时读取：主星×宫位、同宫组合、辅煞与细化星、长生／博士／岁前层、四化语义、功能边及来源审计。
- 离线网页包：上述20张实时表已生成到 `../knowledge-data.js`，页面优先读取该内置包，因此直接打开时不需要 CSV 服务。
- 本地排盘引擎：`../vendor/iztro-2.6.1.min.js`，SHA-256 `01258D870A672430CC02A7C2D958FD8083853AB1FECC6F412A0A855C331CEE3B`；MIT 许可副本保存在同目录。
- 本地 Python 管线作为独立资源保留，静态页面不会自动执行 Python 或生成未经质量门检查的报告。

## P5 月运补充包

- 原始压缩包：`C:\真题\粉笔真贴\ZDSM_P5_Monthly_Runtime_Supplement_v1_0.zip`
- SHA-256：`60B5FC109112A33F28F2BEA6B8A79F900021EC9A0ADC1A69406D50BAF01CDC46`
- 浏览器接入：`../monthly-runtime.js` 读取内置 `monthlyConfig`，输入宫位与四化均来自 iztro 当前命盘结果。
- 保留文件：Python 引擎、渲染器、Schema、配置、示例、验收与交接文档均保存在本目录。

## P6 流日／流时补充包

- 原始压缩包：`C:\真题\粉笔真贴\ZDSM_P6_Daily_Hourly_Runtime_Supplement_v1_0.zip`
- SHA-256：`81F6522E0E220662879AA4629EC633CF24CDC61827016CF0AA400D936DD6844B`
- 浏览器接入：`../daily-hourly-runtime.js` 读取内置 `dailyHourlyConfig`；流日和流时宫位、四化均由 iztro 上游计算，缺失时直接报错，不猜测。
- 权限顺序：本命 → 大限 → 流年 → 小限 → 流月 → 流日 → 流时；下层只细化上层，不反向覆盖。
- 保留文件：Python 引擎、渲染器、Schema、配置、示例、验收与交接文档均保存在本目录。

## ZDSM Rule Engine V1.1 部署包

- 原始压缩包：`C:\真题\粉笔真贴\ZDSM_Rule_Engine_V1.1_Deploy_Package.zip`
- SHA-256：`324DF66E0711FFD057019426F81BCF8BA3C6BB37E0CF24230829498B42877003`
- 原包完整保存在：`rule-engine-v1.1/`。
- 浏览器接入：`../system-engine.js` 忠实移植 `src/rules.js` 与 `src/engine.js`，由现有 iztro 命盘直接生成 canonical houses，不重新排盘。
- 页面取舍：保留角色识别、结构权重、主增长循环、恢复循环与运限激活；不采用原包动画、JSON 粘贴演示或远程请求。
- 解释边界：六维数值是透明的启发式规则权重，不是统计概率、准确率或确定性事件预测。
