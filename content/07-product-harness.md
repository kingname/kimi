# 产品判断与 Kimi Code 公开实现

## 怎样评价一个 Coding Agent

不要说“模型更聪明”“体验更丝滑”。选 5～10 个自己的真实任务，按统一维度记录：

| 维度 | 观察问题 |
|---|---|
| 需求理解 | 会不会识别歧义、提关键问题、保留约束？ |
| 初始探索 | 是否先读仓库规则和结构？多久找到关键文件？ |
| 上下文 | 大仓库是否遗漏、召回过多、使用旧版本？ |
| 计划 | 计划是否可执行、会随证据更新，还是表演性列表？ |
| 工具调用 | 参数是否正确、是否重复、错误能否恢复？ |
| 编辑 | diff 是否小而准，能否保护用户改动？ |
| 验证 | 是否主动测试、检查 diff、覆盖隐藏风险？ |
| 长任务 | 压缩后是否忘记目标，打断/恢复是否可靠？ |
| 权限安全 | 高风险动作是否透明，批准是否过度打扰？ |
| 交互 | 进度是否有信息量，用户能否 steer/undo？ |
| 成本延迟 | 成功任务的时间、token、人工干预是多少？ |
| 可扩展 | MCP、hooks、skills、IDE/CLI、企业策略如何接入？ |

评价时给任务、证据和失败 trace。例如：

> 在一个跨 8 个文件的 API 迁移任务中，A 首次召回命中了接口与 3 个调用方，但漏掉了异步 worker；B 虽然多两轮搜索，却通过符号引用找全。A 的初始延迟低，最终回归失败。这个差异更像检索策略而不是生成能力。

## 为什么模型公司仍然需要自己的 Harness

## 问题本身

> 现在市面上已经有 Claude Code 和 Codex，而且通过兼容接口或修改配置，也可以直接使用 Kimi 模型。开源领域还有各种 Coding Agent 和可高度自定义的 Pi Agent。那么，为什么 Kimi 还需要自己做一套 Harness？

## 我的结论

这个问题的前提成立：成熟 Harness 已经很多，自研不能靠“别人不够好”来证明。我的判断是：

> 如果目的只是让用户在成熟 Coding Agent 中调用 Kimi 模型，那么适配 Claude Code、Codex、Pi Agent 和其他开源 Harness，显然是成本最低、触达用户最快的方案。Kimi 不应该为了“拥有自己的东西”而重复造轮子。
>
> 但模型能被一个 Harness 调用，和模型能力被充分、稳定地发挥，是两件不同的事。兼容接口主要解决请求如何到达模型；真正决定 Coding Agent 成功率的，还有系统提示、工具定义、上下文选择与压缩、Agent Loop、错误恢复、权限、Subagent、验证策略和交互体验。
>
> **模型决定单步能力的上限，Harness 决定这种能力能否在真实仓库和长任务中稳定兑现。**

### 第一层：Harness 本身就是能力系统的一部分

同一个模型放在不同 Harness 中，表现可能明显不同，因为 Harness 决定：

- 模型每一步能观察到什么；
- 可以采取哪些动作；
- 工具 Schema 和结果以什么格式出现；
- 如何检索、装配和压缩上下文；
- 失败后重试、换策略还是交还用户；
- 模型声称完成后，系统是否真的检查 diff、构建和测试。

因此“Claude Code 可以连接 Kimi”证明的是协议兼容，不代表针对其他模型形成的 Prompt、工具和上下文策略就是 Kimi 的最优解。

Kimi Code 的公开实现已经体现了一些 Harness 层优化：MCP 工具支持按需披露以控制顶层工具 Schema；Subagent 使用独立上下文，只把结果带回主 Agent；长会话还涉及压缩、恢复和 replay。参见 [Kimi Code Changelog](https://moonshotai.github.io/kimi-code/en/release-notes/changelog.html)、[Agents 与 Subagents](https://moonshotai.github.io/kimi-code/en/customization/agents.html) 和 [Sessions 与 Context](https://moonshotai.github.io/kimi-code/en/guides/sessions.html)。

### 第二层：模型与 Harness 可以联合优化

自有 Harness 可以针对 Kimi 模型的实际能力边界调整：

- 工具数量、描述方式和参数粒度；
- thinking 与 tool call 的交替方式；
- 长上下文预算和压缩策略；
- Prompt Cache 的稳定前缀；
- Subagent 的任务切分与模型路由；
- 错误信息怎样反馈才最容易让模型恢复；
- 不同任务阶段使用怎样的验证策略。

这些不是简单替换 `base_url` 或模型名称就能自动得到的。

### 第三层：形成模型—系统的数据飞轮

第三方 Harness 中任务失败时，模型提供方通常只能看到部分请求，未必能获得完整因果链：

- 为什么召回了错误文件；
- 模型为什么选择了错误工具；
- 哪一步开始偏离目标；
- 压缩丢失了什么；
- 用户何时接管、取消或撤销；
- 给模型 oracle 上下文或工具结果后能否成功。

自有 Harness 可以在用户授权和脱敏的前提下形成闭环：

```text
真实用户任务
→ Agent Trace
→ 首次失败点与根因分类
→ 可复现 Eval Case
→ 修改 Harness / Prompt / Model
→ 离线对照与线上灰度
→ 新的真实长尾
```

这个闭环还能帮助区分“模型能力不足”和“系统没有把能力发挥出来”。对模型公司来说，数据与联合迭代能力可能比 Harness 代码本身更有价值。

### 第四层：掌握端到端产品控制权

完全依赖第三方 Harness，意味着产品目标、交互方式和发布节奏不由 Kimi 决定。自有 Harness 才能自主回答：

- 本地执行与远程沙箱如何取舍；
- 权限和批准体验如何设计；
- TUI、IDE、视频输入和长任务交互怎样配合；
- 新模型能力发布后如何第一时间利用；
- 成本、缓存、模型路由和 provider 降级如何优化；
- 企业数据、安全、审计和可观测性怎样落地。

同时，自有 Runtime 可以通过 [Kimi Agent SDK](https://github.com/MoonshotAI/kimi-agent-sdk) 暴露给其他产品、自动化流程和开发者工具，而不只是服务一个 CLI。

### 第五层：自有 Harness 不等于封闭生态

更合理的策略是两条腿走路：

- 继续让 Kimi 模型兼容 Claude Code、Codex、Pi Agent 等成熟入口；
- 用它们作为重要分发渠道、能力基线和对照组；
- 复用 MCP、ACP、LSP、沙箱等开放协议与基础设施；
- 自己重点掌握 Runtime、上下文、评测、权限和交互等差异化层；
- Kimi Code 本身也保持模型、工具和 Agent 的可扩展性。

第三方适配解决的是“让 Kimi 模型无处不在”，自有 Harness 解决的是“定义 Kimi Agent 应该是什么”。两者互补，不是二选一。

### 第六层：最终必须用数据证明自研合理

自研 Harness 会带来显著的开发和长期维护成本，因此不能只讲“战略自主”。应固定同一个 Kimi 模型，在相同任务和环境中比较不同 Harness：

- 任务成功率和长任务成功率；
- 首次找到正确文件的时间；
- 工具误用、重复调用和错误恢复率；
- 用户接管、追问和撤销次数；
- 单成功任务 token、成本与延迟；
- Session 恢复和 context compaction 后的成功率；
- 越权、安全和测试作弊；
- Patch 接受率、留存和真实用户价值。

> 如果自有 Harness 不能在这些指标上形成可测量的优势，也不能产生独特的数据闭环，就不应该为了自研而自研。

## 压缩成一句完整的判断

> 我认为这个质疑是成立的。如果只是让用户能调用 Kimi 模型，适配 Claude Code、Codex、Pi Agent 和其他开源 Agent 是最快、最经济的方案，没有必要为了自研而自研。
>
> 但模型兼容不等于能力被充分发挥。接口适配主要解决请求连接，而 Coding Agent 的实际表现还取决于工具 Schema、上下文选择与压缩、Agent Loop、错误恢复、权限、Subagent 和验证机制。模型决定单步能力上限，Harness 决定能力能否在真实仓库和长任务中稳定兑现。
>
> 对 Kimi 来说，自有 Harness 还有两个关键价值。第一，可以针对 Kimi 的推理、长上下文和工具调用特性做模型—系统联合优化，不受制于第三方产品的 Prompt、工具和发布节奏。第二，可以通过完整 Agent trace 建立“真实失败—归因—评测—模型和系统改进”的数据飞轮。
>
> 但这不意味着封闭地重造一切。合理策略应该是继续兼容主流 Harness，复用 MCP、ACP 等开放协议，同时掌握自己的核心 Runtime、上下文、评测、权限和交互。最终还要用固定模型下的成功率、成本、恢复率和用户留存证明自研是否值得；如果没有可测量的优势，自研就不成立。

## 这个判断的边界

- 只说“自主可控”或“不能受制于人”，没有用户价值和工程指标；
- 贬低 Claude Code、Codex 或开源 Agent；
- 把 API 兼容等同于行为与效果完全一致；
- 把 Harness 的壁垒说成 Agent Loop 代码本身；
- 只谈战略，不承认自研成本和停止条件。

## Kimi Code 公开实现给我的启发

从公开资料看，Kimi Code 面向终端软件工程任务，可读写代码、执行 Shell、搜索文件和网页，并根据反馈选择下一步。公开项目还展示了：

- 面向长会话的终端交互；
- MCP 配置；
- IDE 集成协议；
- `coder`、`explore`、`plan` 等不同权限/职责的 Subagent；
- 生命周期 hooks；
- session、transcript、事件与恢复相关实现；
- 模型/provider 兼容、context compaction、工具调用历史修复；
- Agent SDK 与可扩展配置。

以官方 [Kimi Code 仓库](https://github.com/MoonshotAI/kimi-code)、[Getting Started](https://moonshotai.github.io/kimi-code/en/guides/getting-started.html) 和 [Agents / Subagents 文档](https://moonshotai.github.io/kimi-code/en/customization/agents.html) 为准。

这些公开信号让我形成了一个判断：

> 真实复杂度大量集中在“边界修复”而非漂亮的主循环，例如中断工具调用的闭合、不同 provider 的消息约束、context overflow 后的压缩、Subagent 取消和 session replay。这也印证了我的判断：成熟 Coding Agent 的壁垒在长尾可靠性、数据闭环与系统细节。


## 如何决定下一个产品功能

假设有人建议“增加 10 个 Subagent 并行”。我会按以下顺序判断：

1. 用户问题：哪些任务因探索慢或上下文污染而失败？
2. trace 证据：失败中可并行、可隔离的比例？
3. 最小方案：先只读双 Agent，还是需要通用 swarm？
4. 成功指标：任务成功、time-to-first-correct-file、成本；
5. Guardrail：并发上限、写冲突、安全、取消；
6. Eval：哪些任务 slice 预期提升？
7. 灰度：只对高复杂任务触发；
8. Kill criteria：成功不涨或成本/错误超过阈值则关闭。

### 用户说“Agent 太慢”，你会怎么做？

> 先区分感知延迟和实际完成时间。trace 拆 TTFT、模型、工具、沙箱冷启、队列、无效循环；同时看用户在哪个阶段取消。短期可流式展示有意义进度、并行无依赖读取、预热环境；长期修最大的真实瓶颈。不能用不断输出无信息文本掩盖停滞。

### 自动模式和高批准模式如何取舍？

> 默认值取决于环境信任和动作可逆性。本地受信仓库可对范围内读写更自动；远程多租户、敏感代码和部署操作更保守。允许用户按 session 选择模式，但权限提升必须显式，Subagent 不超过父权限。用事故、拒绝、批准疲劳和任务中断共同衡量。

## 识别系统里的“伪进展”

这是对工程判断的要求：

- 能发现 demo 中被隐藏的人工前提；
- 不被平均分掩盖严重长尾；
- 看得到 schema、错误语义和取消路径的不一致；
- 质疑 benchmark 的任务与 grader；
- 对无谓抽象、框架黑盒和概念堆砌敏感；
- 能提出更小、更可验证的实现；
- 批评问题的同时给出证据、优先级与替代方案。

真正有用的判断力，往往体现在能否发现一个“看似能用”的系统会在哪个边界下必然失败，并设计最小实验验证它。

---
