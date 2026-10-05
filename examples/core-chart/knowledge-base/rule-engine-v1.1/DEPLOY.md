# 部署说明

## A. 静态网页部署

这是纯前端项目，无服务器依赖。

可直接放到：

- GitHub Pages
- Cloudflare Pages
- Vercel
- Netlify
- 任意 nginx / Apache 静态目录
- 现有网站 public 目录

注意：因为 `index.html` 使用 ES Module + fetch 读取 JSON，
部分浏览器通过 `file://` 双击打开时会阻止 fetch。

### 本地预览

推荐在目录下运行：

```bash
python -m http.server 8080
```

然后访问：

```text
http://localhost:8080
```

## B. 接入现有 Vue / React / Next.js

只需要保留：

- `src/rules.js`
- `src/engine.js`

图表层可以继续使用 `renderer.js`，
也可以让你的前端工程改成 React Flow、D3、ECharts Graph 或 Cytoscape。

核心 API：

```js
import { analyzeChart } from "./src/engine.js";

const result = analyzeChart(chartJson);
```

返回：

```js
{
  scores,
  engine,
  processor,
  inputs,
  outputs,
  storage,
  bottleneck,
  recovery,
  visibleNodes,
  edges,
  hiddenEdges,
  growthLoop,
  recoveryLoop,
  summary
}
```

## C. 如果你的网站已有排盘模块

不要让 ZDSM 自己重新排盘。

最稳的架构：

```text
现有排盘模块
   ↓
统一命盘 JSON 适配器
   ↓
analyzeChart()
   ↓
renderer
```

也就是说：
“排盘”和“系统解释”必须分开。

## D. 生产环境建议

1. 把规则版本写入结果：
   `version: 1.1.0`
2. 保存原始 chart JSON，便于复算。
3. 保存 result JSON，便于前端缓存。
4. 规则升级不要偷偷覆盖旧报告。
5. 使用 URL 参数或数据库字段记录 ruleVersion。
