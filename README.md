# Diagram Studio

一个支持 Mermaid 与 Pele 双渲染器的纯前端图表工作台，支持实时编辑预览、即时复制和多格式导出，无需后端服务。

## 功能特性

- **实时预览** — 基于 CodeMirror 编辑器，输入即渲染
- **双渲染器** — 可选 Mermaid / Pele，记住上次选择，按需加载
- **渲染用时** — 预览旁显示实际引擎及本次渲染耗时，不含引擎加载与排队时间
- **多格式导出** — 支持 SVG / PNG 的复制和下载
- **PNG 尺寸控制** — 自动、固定宽度、固定高度三种模式
- **图表主题** — Default / Neutral / Dark / Forest / Base 五种 Mermaid 原生主题
- **绘制风格** — 经典 (Classic) 和手绘 (Hand-drawn) 两种风格
- **明暗主题** — 编辑器和界面的 Light / Dark 切换
- **预览交互** — 鼠标滚轮缩放、拖拽平移、触屏双指缩放、双击重置
- **元素定位** — 预览区元素悬停高亮，双击跳转到对应源码行
- **语法纠错** — 渲染报错时高亮编辑器中的错误行，并提供常见错误自查提示
- **示例图表** — 内置 20+ 种 Mermaid 图表类型示例，一键加载
- **响应式布局** — 适配桌面和移动端
- **零依赖部署** — 纯静态文件，通过 CDN 加载 Mermaid 和 CodeMirror

## 支持的图表类型

Flowchart、Class、Sequence、ER、State、Mindmap、Architecture、Block、C4、Gantt、Git、Kanban、Packet、Pie、Quadrant、Radar、Requirement、Sankey、Timeline、Treemap、User Journey、XY Chart

## 快速开始

项目为纯静态页面，无需构建，但本地运行需要通过 HTTP 服务访问。不要双击 `index.html` 使用 `file://` 打开，否则浏览器会因 CORS 限制阻止 JavaScript 模块加载。

Windows 下打开 **命令提示符（cmd）**，运行：

```bat
cd /d F:\AI_project\mermaid-exporter
activate pychat
python -m http.server 8000 --bind 127.0.0.1
```

然后访问 [http://127.0.0.1:8000/](http://127.0.0.1:8000/)。保持终端窗口打开，按 `Ctrl+C` 停止服务。

如果使用 Node.js，也可以在项目目录运行以下命令，再访问同一地址：

```bash
npx serve . -l 8000
```

运行时需能访问 CDN，以加载 CodeMirror 和选中的图表渲染器。部署到静态托管服务后，直接访问托管地址即可。

## Pele 渲染器

在顶部选择 **Pele** 即可使用 Pele 1.6.0 渲染现有 Mermaid 源码。默认仍使用 Mermaid，编辑器、示例、方向切换、缩放平移、元素定位和 SVG / PNG 复制下载共用原有操作。

- 五套主题在 Pele 中使用对应配色，排版和外观与 Mermaid 不同。
- Pele 模式下手绘按钮置灰，并显示“Pele 不支持手绘”；切回 Mermaid 后恢复此前的风格选择。
- 源码中的 Mermaid 主题或手绘配置、Pele 不支持的图表类型，以及渲染错误会直接显示提示，不会自动切换引擎。需要时可手动选择 Mermaid。
- SVG 导出会固化 Pele 的颜色和字体，PNG 支持自动、固定宽度和固定高度。
- Pele 不支持任意 HTML 标签或 JavaScript 点击回调；自定义图标需要单独提供图标解析器。需要这些 Mermaid 效果时可切回 Mermaid。
- 两套渲染器通过 CDN 按需加载，仍然无需安装依赖或构建。Pele 的版本固定为 1.6.0。

参考：[Pele 文档](https://pele.run/api)、[兼容性说明](https://pele.run/compatibility)。

渲染器调度的回归测试无需安装依赖，使用 Node.js 20 或更新版本运行：

```bash
node --experimental-vm-modules tests/renderer.test.mjs
```

## 部署到 Cloudflare Pages

1. Fork 或推送本仓库到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Create → Pages → Connect to Git
3. 选择对应的 GitHub 仓库，构建配置如下：
   - **构建命令**：留空（纯静态，无需构建）
   - **构建输出目录**：`/`（根目录）
4. 点击 Save and Deploy，等待部署完成即可通过 `*.pages.dev` 域名访问

## 技术栈

- [Mermaid.js](https://mermaid.js.org/) v11 — 图表渲染
- [Pele](https://pele.run/) v1.6.0 — 可选图表渲染
- [CodeMirror](https://codemirror.net/) v6 — 代码编辑器
- 原生 HTML / CSS / JavaScript — 无框架依赖

## License

MIT
