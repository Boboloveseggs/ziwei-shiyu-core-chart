# Adapter layer

这里唯一负责一件事：把你网站已有的排盘对象转换成 ZDSM canonical schema。

规则：

- adapter 只做字段映射，不做命理解读。
- 不在 adapter 里计算权重。
- 不在 adapter 里决定主循环。
- 不在 adapter 里画图。
- 所有解释统一交给 `analyzeChart()`。

接入示例：

```js
import { adaptExistingChart } from "./src/adapters/generic.js";
import { analyzeChart } from "./src/engine.js";

const canonical = adaptExistingChart(existingChartObject);
const result = analyzeChart(canonical);
```
