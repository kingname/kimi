# Coding Agent 工程实践手册

基于 Kimi 近期 Agent Harness 研发岗位的 JD，结合我自己的工程开发经验，整理成这份 Coding Agent 系统实践指南。

内容涵盖 Agent Runtime、工具系统、仓库级上下文、权限与沙箱、长任务恢复、Subagent、Evaluation、可观测性以及 Harness 的产品与工程价值。正文按主题拆分在 [`content/`](./content/) 中；构建后生成一个章节首页和 10 个独立章节页面。

项目地址：[github.com/kingname/kimi](https://github.com/kingname/kimi)

## 本地构建

```bash
npm ci
npm run build
```

构建产物位于 `dist/`：

- `dist/index.html`：章节首页；
- `dist/chapters/<slug>/index.html`：各主题的独立阅读页面；
- `dist/markdown/`：可直接访问的 Markdown 原文。

根目录的 `index.html` 是章节首页的静态快照。

本地使用 Cloudflare Pages 运行：

```bash
npm run dev
```

## 发布到 Cloudflare Pages

在 Cloudflare Dashboard 中连接本 GitHub 仓库，使用以下设置：

| 设置 | 值 |
|---|---|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | `22` |

后续每次推送到默认分支都会触发新的 Pages 构建。也可以在完成 `wrangler login` 后直接发布：

```bash
npm run deploy
```

项目不依赖服务端运行时、数据库或环境变量。Cloudflare Pages 配置在 [`wrangler.jsonc`](./wrangler.jsonc)；仓库内不包含 GPT Sites 配置。

## 内容结构

| 文件 | 主题 |
|---|---|
| `00-preface.md` | 写作缘起与阅读方法 |
| `01-agent-runtime.md` | JD 问题地图、Agent Runtime |
| `02-tools-context.md` | 工具系统、仓库级上下文 |
| `03-safety-long-tasks.md` | 安全、沙箱、长任务与恢复 |
| `04-subagents-gateway.md` | Subagent、调度、Model Gateway |
| `05-evaluation-observability.md` | Evaluation、Trace、可观测性 |
| `06-system-design-failures.md` | 系统设计与故障分析 |
| `07-product-harness.md` | 产品判断、Kimi Code 与 Harness |
| `08-engineering-notes.md` | 工程问题速查与设计审查 |
| `09-reading-list.md` | 阅读材料与结语 |

## 版权

Copyright © 2026 青南. All rights reserved.
