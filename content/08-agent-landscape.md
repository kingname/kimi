# Codex、Claude Code、Kimi Code、DeepSeek TUI 与 TRAE

## 先别急着排座次

把这五个名字放在一起，很容易做成一张“谁支持 MCP、谁支持 Subagent”的勾选表。这样的表看起来完整，实际没有多少选型价值：功能名称相同，不代表运行语义相同；产品入口不同，也不应该用同一套标准简单打分。

我更习惯先回答四个问题：

1. 它是模型、Harness，还是带 Harness 的完整 IDE？
2. 任务主要在本地、云端，还是两边都能运行？
3. 它优化的是哪种工作方式：终端、编辑器、后台委派，还是从需求到成品的完整流程？
4. 权限、上下文、恢复和扩展能力由谁掌握，出了问题能不能追到 Runtime？

还有一条事实需要先澄清：本文所说的 **DeepSeek TUI** 指社区仓库 [`DeepSeek-TUI-app/DeepSeek-TUI`](https://github.com/DeepSeek-TUI-app/DeepSeek-TUI)。我没有在 [DeepSeek 官方 GitHub 组织](https://github.com/deepseek-ai) 中找到对应的官方终端产品，因此不能把它写成“DeepSeek 官方版 Claude Code”。它是围绕 DeepSeek 模型构建的第三方 Harness，证据等级与另外四个官方产品不同。

## 五种产品，五个不同重心

| 产品 | 更准确的定位 | 主要入口 | 最鲜明的重心 |
|---|---|---|---|
| Codex | OpenAI 的软件工程 Agent 平台与 Runtime | CLI、IDE、桌面、云端、SDK | 本地与云端协同、沙箱、多 Agent 和可编程入口 |
| Claude Code | Anthropic 的可扩展 Coding Agent | Terminal、IDE、Desktop、Web | 成熟的开发者工作流、权限规则、Hooks、Plugins 与 Agent 体系 |
| Kimi Code | 围绕 Kimi 模型演进的开放 Coding Agent Harness | Terminal、ACP、Agent SDK | Kimi 模型适配、session/event stream、上下文与工具闭环 |
| DeepSeek TUI | 社区维护的 DeepSeek-native 终端 Harness | TUI、HTTP/SSE、部分 ACP | DeepSeek 路由、前缀缓存、成本可视化与终端体验 |
| TRAE | AI IDE 与云端工作空间产品 | IDE、Plugin、TRAE Work | 图形化集成、代码补全、预览、Agent 和端到端任务体验 |

这张表最重要的信息不是功能多少，而是产品中心不同。Codex 和 Claude Code 已经是跨入口的平台；Kimi Code 更像可以继续向外长出产品的 Runtime；DeepSeek TUI 是模型原生优化实验；TRAE 则把 Agent 放进完整 IDE 和工作空间。

## Codex：把 Coding Agent 做成跨本地与云端的平台

Codex 的优势不只在模型。公开产品已经覆盖 CLI、IDE、桌面应用和云端任务，本地客户端共用配置体系；Runtime 还提供 `AGENTS.md`、Skills、MCP、Hooks、Plugins、自定义 Agent、Subagent，以及面向程序集成的 app-server 和 SDK。当前本地版本使用操作系统级沙箱，将“什么时候询问”和“允许访问什么”拆成 approval policy 与 sandbox policy 两个维度。参考 [Codex 官方文档](https://developers.openai.com/codex/) 与 [开源仓库](https://github.com/openai/codex)。

我认为它最强的地方有三点：

- **任务入口完整。** 同一类工程任务可以在本地交互，也可以交给云端后台执行；
- **运行边界明确。** 沙箱、网络、workspace write 和 approval 是 Runtime 配置，不依赖模型自觉；
- **可编程性强。** CLI、非交互执行、MCP server、app-server 和 SDK 可以进入 CI 或更大的 Agent workflow。

它的代价也来自同一件事：平台表面多、配置层次多，本地和云端的可用工具及权限语义需要使用者真正理解。对于只想要一个极简终端 Agent 的团队，这套能力可能显得重；对于非 OpenAI 模型，虽然可以通过 provider 或兼容接口接入，但“请求能跑通”仍然不等于 Codex 的工具描述、上下文策略和评测已经为目标模型优化。

所以我不会把 Codex 简单概括为“功能最多”。更准确的说法是：它适合需要本地执行、云端委派、自动化和治理能力共同存在的团队。

## Claude Code：开发者可塑性最强的一类终端工作流

Claude Code 的官方定位同样已经不局限于 Terminal，也覆盖 IDE、Desktop 和 Web。但它最成熟、辨识度最高的部分，仍然是围绕开发者工作流形成的可扩展体系：

- `CLAUDE.md`、path-scoped rules 和 auto memory 管理持久上下文；
- Allow / Ask / Deny 规则、Plan、Auto 等模式控制工具权限；
- Hooks 在工具调用、通知、任务结束等生命周期点执行确定性动作；
- Skills、Plugins、MCP、自定义 Subagent、Agent Teams 和后台 Agent 组成扩展与协作体系；
- Explore、Plan 等内置 Subagent 使用独立上下文，并可限制工具。

这些能力均可在 [Claude Code Overview](https://code.claude.com/docs/en/overview)、[Permissions](https://code.claude.com/docs/en/permissions)、[Hooks](https://code.claude.com/docs/en/hooks-guide) 和 [Subagents](https://code.claude.com/docs/en/sub-agents) 中核对。

它的优势是工作流已经非常“可编程”：团队能把规范放进仓库，把权限写成规则，把固定动作放进 Hooks，把专项任务做成 Subagent 或 Plugin。对于终端重度用户，这种组合往往比 IDE 里一个巨大的“自动完成任务”按钮更可控。

相应的取舍是：

- 配置表面很多，`CLAUDE.md`、rules、memory、skills、hooks、plugins 各有边界，长期使用需要治理；
- 复杂权限规则很强，但错误的 broad allow 或 bypass 模式同样会放大风险；
- 其最佳行为显然围绕 Claude 模型和 Anthropic 协议共同演进，第三方 provider 接入不自动获得同等效果；
- 主体产品不是完整开源 Runtime，遇到深层行为问题时，可修改和可观测范围与开放 Harness 不同。

一句话概括：Claude Code 更像一套已经形成开发者文化的 Coding Agent 工作台，优势在“长期可塑”，而不是某个孤立功能。

## Kimi Code：把模型—工具—上下文联合优化握在自己手里

Kimi Code 当前公开出来的能力没有前两者那么庞杂，但 Runtime 主线很清楚：

- session 持久化和每个 Agent 的 `wire.jsonl` 事件流；
- `coder`、`explore`、`plan` 等不同能力配置的 Agent；
- 内置工具、MCP、Hooks、approval 和后台任务；
- context compaction、session resume / fork；
- 用 ACP 对接 IDE，用 Agent SDK 把同一 Runtime 暴露给应用。

参考 [Kimi Code 文档](https://moonshotai.github.io/kimi-code/)、[Sessions](https://moonshotai.github.io/kimi-code/en/guides/sessions.html)、[Agents](https://moonshotai.github.io/kimi-code/en/customization/agents.html) 和 [Kimi Agent SDK](https://github.com/MoonshotAI/kimi-agent-sdk)。

它当前最有价值的优势，不是宣称全面超过 Claude Code 或 Codex，而是具备做联合优化的条件：

```text
模型在哪类工具 schema 上最稳定
→ Harness 调整工具契约与结果粒度
→ trace 暴露重复调用、压缩丢失和恢复失败
→ eval 判断是模型问题还是 Runtime 问题
→ 模型训练与 Harness 同时迭代
```

对 Kimi 来说，自有 Harness 还能形成一套稳定的参考实现。即使用户最终在第三方 Agent 中调用 Kimi API，Kimi Code 仍然可以回答：“这个模型在我们定义的工具、上下文和恢复语义下，本来能够做到什么程度？”

短板也要正视：

- 生态、企业治理和跨入口产品成熟度仍需要时间积累；
- 公开 Changelog 反映出 provider 兼容、历史修复、compaction 等边界仍在快速演进；
- 有公开架构不等于已经证明效果，仍需拿同模型、同任务、同预算的 paired eval 与成熟 Harness 对比；
- 如果模型适配优势最终可以由很薄的 adapter 获得，自研范围就应该收缩。

因此 Kimi Code 最合理的目标不是复制所有竞品功能，而是把 Kimi 模型特有的成功率、上下文效率、长任务恢复和成本优势做成可测量差异。

## DeepSeek TUI：有意思的模型原生实验，但先处理证据与信任问题

这个社区项目的 README 描述了一套很有针对性的设计：围绕 DeepSeek 模型做自动 model / thinking 路由、前缀缓存命中与成本展示，同时提供 Plan / Agent / YOLO、session resume、side-git rollback、durable task queue、MCP、Subagent、LSP diagnostics、HTTP/SSE 和 ACP。

如果这些能力都经过实现和长期验证，它的优点会很鲜明：

- 把 DeepSeek 的缓存和推理模式直接放进产品反馈，而不是当作普通 OpenAI-compatible 模型；
- TUI、单一模型家族和本地工作区让心智模型比较简单；
- side-git snapshot、后台队列和 LSP 回灌都对真实工程任务有价值；
- 固定模型与推理级别后，适合做成本和缓存实验。

但这里必须保持证据纪律。该项目不是 DeepSeek 官方仓库；README 的能力声明不能替代代码审计、故障注入和真实任务评测。尤其是安装预编译 Agent 时，我会额外检查：

1. release binary 是否能从公开源码复现；
2. API key 如何保存，日志和 crash dump 是否可能泄漏；
3. YOLO、网络、Shell 和 MCP 是否存在真正的 policy boundary；
4. rollback 是否只覆盖文件，还是能处理进程与外部副作用；
5. durable queue 恢复时是否会重复执行命令；
6. ACP 文档已注明部分工具编辑与 checkpoint replay 尚未暴露，IDE 与 TUI 不能假定能力等价。

所以它更适合被看作 DeepSeek-native Harness 的研究样本或个人工具，而不是在缺少验证时直接与三家官方 Runtime 按企业成熟度等量齐观。

## TRAE：Agent 被放进 IDE 与完整工作空间

TRAE 的比较方法应该不同。它首先是 IDE / Work 产品，而不是一个以终端为中心的 Harness。官方文档中已经包含代码补全、代码库上下文、Agent、自定义 Agent、Subagent、Hooks、MCP、context compaction、浏览器与预览等能力；TRAE Work 还强调云端后台任务和多任务执行。参考 [TRAE IDE 文档](https://docs.trae.ai/ide/what-is-trae)、[Agent Overview](https://docs.trae.ai/ide/agent-overview)、[Subagents](https://docs.trae.ai/ide/subagents) 与 [TRAE Work](https://www.trae.ai/solo)。

它的优势主要体现在产品整合：

- 编辑器、文件树、diff、终端、预览和 Agent 在同一个界面；
- 对不熟悉终端 Harness 的用户，任务进度和修改结果更直观；
- IDE 已经掌握打开文件、选区、诊断和代码索引等高质量上下文信号；
- 从需求、实现到预览的链路更短，适合前端、应用开发和需要视觉反馈的任务；
- Subagent、Hooks 与 MCP 让它不再只是“补全 + Chat”。

它的相对弱项不是“能力差”，而是产品取舍不同：

- IDE 状态、云端 Workspace 和产品后端结合更深，headless automation 与状态迁移不如 CLI 天然；
- 当 Agent 表现变化时，较难区分来自模型、索引、IDE 上下文还是云端 Runtime；
- GUI 带来更低门槛，也可能隐藏权限、实际命令和恢复语义，工程团队仍需主动查看 trace 与 diff；
- 已经拥有成熟编辑器和终端工作流的用户，迁移成本可能高于安装一个 CLI。

TRAE 更适合“我想在一个产品里完成开发并看到结果”，而 Codex、Claude Code、Kimi Code 更适合“我想把 Agent 嵌入已有工程工作流”。两者并不是同一条产品路线。

## 一张更有用的优缺点对照

| 维度 | Codex | Claude Code | Kimi Code | DeepSeek TUI | TRAE |
|---|---|---|---|---|---|
| 本地终端 | 强 | 强 | 强 | 核心入口 | IDE 内终端，不是产品中心 |
| 云端委派 | 强 | 有 Web / 后台 Agent | 公开重心仍偏本地 Runtime | durable queue 偏本地 | TRAE Work 是重要入口 |
| Runtime 开放性 | CLI / app-server 开源 | 主体 Runtime 未开源、扩展面丰富 | 公开仓库与 SDK | 社区仓库，需验证完整性 | 未公开核心 Runtime |
| 权限与隔离 | OS sandbox + approval | 细粒度规则与模式 | approval + 模式 + Hooks | README 声明 approval / YOLO | IDE Agent 安全设置与 Hooks |
| Subagent | 内置、自定义、可观察线程 | 内置、自定义、Teams | 能力分型、独立 context/event | README 声明 Subagent / RLM | 独立上下文、自定义配置 |
| 持久化指导 | `AGENTS.md`、Skills、Memory | `CLAUDE.md`、rules、memory、skills | Agents、Skills、配置 | Skills、user memory | Rules、Agents、Skills |
| 扩展协议 | MCP、Plugins、Hooks、SDK | MCP、Plugins、Hooks、Skills | MCP、Hooks、ACP、SDK | MCP、HTTP/SSE、部分 ACP | MCP、Hooks、IDE 扩展 |
| 最值得选择的理由 | 本地—云端—自动化一体 | 工作流成熟且高度可塑 | Kimi 模型与 Harness 联合优化 | DeepSeek 成本/缓存实验 | 集成 IDE 和可视化成品链路 |
| 首要风险 | 平台复杂度和跨表面语义 | 配置治理与闭源 Runtime | 成熟度与差异化证据 | 非官方、供应链与可靠性 | 锁定产品工作流、headless 较弱 |

## 不看模型榜单，我会怎么选

选择入口应该从任务约束出发：

- **已有终端、CI 和多仓库自动化体系：** 优先比较 Codex、Claude Code、Kimi Code 的 Runtime 和可编程接口；
- **需要把大量任务后台委派到云端：** 重点考察 Codex 云端任务与 TRAE Work，而不是只看本地 TUI；
- **团队大量依赖规则、Hooks、Plugins 和专项 Agent：** Claude Code 的成熟扩展体系很有吸引力；
- **目标是把 Kimi 模型能力做到最好并参与 Harness 共建：** Kimi Code 最值得深入，因为模型和 Runtime 的联合优化空间最大；
- **研究 DeepSeek 缓存、thinking 路由和低成本执行：** DeepSeek TUI 可以作为实验对象，但必须先做代码、二进制和权限审计；
- **更看重 GUI、预览和从需求到成品的完整体验：** TRAE 的产品形态更合适。

我不会只用同一个 prompt 跑五遍，然后凭主观观感下结论。更可信的对比应固定 repo revision、任务集和资源预算，至少记录：

```yaml
task:
  success_rate:
  severe_regression:
context:
  first_correct_file_latency:
  compaction_recovery:
tools:
  invalid_call_rate:
  repeated_action_rate:
  stale_write_rate:
runtime:
  crash_recovery:
  cancel_convergence:
  permission_bypass:
economics:
  tokens_per_success:
  wall_time_per_success:
  human_interventions:
```

如果要比较 Harness，最好还应固定模型；如果要比较完整产品，就接受模型不同，但不能把结论伪装成“纯模型能力”。两种实验回答的是不同问题。

## 对 Kimi 最有价值的不是照抄功能

从这些产品中，我会分别借鉴：

- Codex 的本地—云端任务边界、沙箱和可编程 Runtime；
- Claude Code 的权限规则、Hooks / Plugin 生态与可复用工作流；
- DeepSeek TUI 对模型缓存、推理路由和成本反馈的产品化；
- TRAE 对 IDE 上下文、预览和低门槛交付体验的整合。

但 Kimi Code 不应该把路线图变成竞品功能并集。更合理的问题是：

> 哪些能力只有掌握 Kimi 模型、工具协议、context packing、trace 和 eval 的团队才能持续做好？

如果答案是长任务恢复、Kimi 原生工具调用、低成本上下文管理和跨 CLI / ACP / SDK 的一致 Runtime，那么资源就应该集中在这些地方。通用协议尽量兼容，差异化控制点自己掌握，所有“更好”最终用同模型 paired eval 证明。

---
