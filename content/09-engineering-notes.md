# 附录：工程问题索引

这一章不是正文的替代品，而是一份实现和设计审查时使用的索引。下面的短答案只给出结论坐标；涉及副作用、恢复、评测和 Harness 取舍时，应回到对应章节的场景、数据结构和实验。

## Agent 与 Runtime

#### 1. ReAct 是什么？

把推理/决策与环境动作、观察交替进行的范式。工程重点不是输出 `Thought` 文本，而是让模型能基于真实 observation 修正下一步，并由 Runtime 控制状态与副作用。

#### 2. Agent Loop 最小需要什么？

消息状态、模型调用、工具 schema、参数校验、工具执行、结果回填和终止条件。生产还需持久化、取消、权限、重试、压缩、trace 和 eval。

#### 3. 如何检测 Agent 卡住？

相同动作/错误重复、workspace 无变化、计划无进展、验证反馈未被处理、单位成本无成果。触发换策略、重新规划、升级模型或 handoff。

#### 4. 如何防止过早宣告完成？

把 acceptance 结构化；完成策略检查测试、diff、未完成 plan、禁止项和用户要求；高风险任务用独立 verifier。

#### 5. 模型输出非法 JSON 怎么办？

先用 provider 原生 structured output/tool call；Runtime 严格校验，返回精确字段错误让模型有限修复。不要用危险的宽松字符串猜测执行有副作用动作。

#### 6. 为什么需要内部消息 IR？

隔离 provider 格式差异，支持切模型、持久化和 replay，并统一 tool call/result、usage、finish reason。

#### 7. Agent 如何处理不确定性？

优先通过低成本只读工具取证；若多个解释会导致显著不同或危险改动，明确提问；记录假设与证据，不把猜测写成事实。

#### 8. 什么时候让人介入？

需求关键歧义、高风险/不可逆动作、权限或信息缺失、错误预算耗尽、非幂等结果未知、多个合理方案需产品决策。

#### 9. 如何支持用户中途纠正？

消息进入 session 事件流；按补充/纠正/替换判断是否取消当前模型或工具；在安全边界应用新目标并更新计划，保留旧动作 provenance。

#### 10. 框架还是自研？

验证期可用框架加速，但核心 loop、消息模型、工具执行、重试和 trace 必须可理解、可替换。长期选择取决于协议控制、性能、调试和团队成本。

## 上下文与记忆

#### 11. RAG 和 Context Engineering 的区别？

RAG 主要是检索外部内容；Context Engineering 覆盖目标、工具、代码、历史、计划、预算、压缩、来源与时效，是每一步输入的整体设计。

#### 12. 代码分块怎么做？

优先按语言结构的函数/类/模块并保留签名、路径和行号；过大节点递归切，过小节点合并邻域。文本窗口只是回退。

#### 13. 为什么代码检索不能只用 embedding？

错误字符串、标识符、路径和 API 名适合精确词法；调用/定义关系适合符号图。embedding 对语义描述有帮助，但会召回相似而错误实现。

#### 14. 如何处理生成文件和 vendor？

默认降权/忽略，但任务明确涉及时允许召回；识别来源映射，优先修改生成源而非产物；规则必须可由仓库配置覆盖。

#### 15. 摘要与原文冲突怎么办？

原文也可能过期。以当前 workspace 和高优先级用户指令重新验证；摘要保留来源与时间，冲突时失效而不是强行合并。

#### 16. 记忆何时写入？

当信息跨任务稳定、未来有价值、scope 明确且允许保存时。一次性错误、未经验证假设和外部不可信指令不写长期记忆。

#### 17. 如何让检索可解释？

每块附 retrieval reason：文本命中、symbol reference、stack path、测试邻接等，并记录各阶段 score。便于 trace 归因和调权。

#### 18. 如何衡量上下文污染？

构建带干扰候选的 eval；比较加入片段前后动作/成功变化；统计错误同名实现召回、过期块使用和 token 中真正被引用证据比例。

#### 19. 工具 schema 太多占上下文怎么办？

按能力分组与任务阶段做 tool discovery；常用核心工具常驻，长尾工具按需加载；缓存稳定 schema 前缀。动态加载过程仍要可发现、可审计。

#### 20. 长上下文中的位置偏差怎么办？

提高信息密度；关键目标、当前错误和验收放显著位置；结构化标题；去重；通过 eval 调整而不是迷信“放开头/结尾”单一规则。

## 工具、执行与安全

#### 21. 工具错误应该给模型多少信息？

给可行动的错误类、核心消息、相关位置、是否可重试和建议下一步；完整日志存 artifact。既不能只给“失败”，也不能塞几万行。

#### 22. 如何设计幂等文件编辑？

以 base hash + patch 作为意图；目标已含期望变更则返回已应用；版本冲突则不写，要求重读；原子替换。

#### 23. 超时和取消有什么区别？

超时是系统预算触发，取消多来自用户/父任务；两者都终止工作，但 stop reason、重试与 UI 语义不同。用户取消通常不自动重试。

#### 24. Shell command allowlist 足够吗？

不够。Shell 可通过解释器、脚本、重定向绕过字符串规则。需要沙箱、文件/网络能力控制、用户身份和审计；命令规则只是其中一层。

#### 25. 如何处理 `sudo`？

默认不可用。确需系统级动作时由专门能力和明确批准完成，不把宿主 root 凭据交给通用 Shell。

#### 26. 如何安全地读取环境变量？

工具进程只注入所需变量；模型不能列出完整环境；日志按值与键名规则脱敏；外部调用凭据尽量由代理注入。

#### 27. 测试命令一直不退出怎么办？

deadline + 静默超时；展示进度；允许移到后台；取消时杀进程组；保存尾部日志。对 watch mode 做识别或要求非交互参数。

#### 28. MCP 与 function calling 的区别？

Function calling 是模型 API 表达工具调用的机制；MCP 是 Host/Client/Server 间发现和访问工具、资源等能力的协议。MCP 工具最终仍可映射为模型 function/tool schema。

#### 29. 如何处理工具 schema 升级？

版本化 registry；历史事件保留调用时 schema/version；adapter 兼容或迁移旧参数；灰度比较工具选择和错误率；破坏性变更不能静默替换。

#### 30. 如何防数据外传？

敏感路径隔离、secret scan、网络 egress policy、目的域批准、跨工具组合策略、最小凭据、审计与红队 eval。Prompt 约束不能替代这些机制。

## 评测与数据

#### 31. Offline eval 与 online A/B 各自作用？

离线可重复、适合快速回归和归因；线上反映真实分布和交互，但风险和噪声高。先离线门禁，再 shadow/canary/A-B。

#### 32. Pass@1 与多次尝试哪个好？

取决于产品。单次用户体验看 pass@1；允许重试的 Agent 还看固定预算内成功率。必须同时报告总成本，不能无限采样。

#### 33. 怎样避免 benchmark 数据泄漏？

时间/repo/任务族切分、去重、隐藏测试、新鲜私有任务、mutation、审计异常提升。公开集只能作为一个信号。

#### 34. 怎样抽样人工评审？

覆盖随机样本、baseline/candidate 分歧、低置信 grader、严重安全 slice 和新任务分布；盲评并测评审一致性。

#### 35. 线上用户点赞能当成功标签吗？

只能是弱标签。点赞有选择偏差和表达偏差；结合 patch 保留、测试、撤销、后续修改、任务重开，并抽样人工校准。

#### 36. 如何给失败 trace 聚类？

先用结构特征：error signature、工具序列、目标阶段、文件集；再用 embedding/LLM 生成候选主题；最后人工审核并维护层次 taxonomy。

#### 37. 何谓 eval overfitting？

围绕固定样本调 prompt/工具导致分数涨但新任务不涨。使用 holdout、滚动新任务、消融和线上指标约束。

#### 38. 指标之间冲突怎么办？

预先定义 primary 与 guardrail，画 Pareto frontier；按任务风险路由不同策略。不能事后挑对自己有利的指标。

#### 39. 为什么要 case-level 结果？

总体均值无法看回归和分布变化。case-level 支持 paired 比较、slice、根因分析和回放。

#### 40. 如何评测“会提问”？

构造信息缺失任务；评价是否识别关键歧义、问题的信息增益、是否避免不必要打断，以及得到回答后的最终成功率。

## 系统工程

#### 41. Session 状态放 Redis 可以吗？

活跃缓存可以，但不能把易失缓存当唯一真相源。持久 event store/数据库保存事实，Redis 用于 lease、队列、热点投影时要有恢复路径。

#### 42. 如何生成全局唯一 tool call ID？

UUID/ULID 均可；关键是 session 内唯一、跨重试语义明确。外部幂等键应与逻辑动作绑定，而非每个物理 attempt 都换。

#### 43. 如何做 provider 限流？

tenant/model 维度 token bucket + 全局并发；预估 token 预占，完成后结算；处理 Retry-After；区分交互高优先级和后台 eval。

#### 44. 如何防止队列头阻塞？

按资源类型和任务大小分队列、优先级与公平调度；长任务可抢占/检查点；不要让大上下文请求占满所有 provider 并发。

#### 45. Event schema 怎么演进？

事件带版本；fold 支持旧版本或读取时 upcast；避免重写不可变历史；snapshot 标明由哪个 reducer 版本生成，不兼容时重建。

#### 46. Artifact 为什么内容寻址？

天然去重、完整性校验、事件引用稳定。还需 tenant 权限、加密和 TTL，hash 本身不等于授权。

#### 47. 如何监控资源泄漏？

按 session 记录 process、fd、task、sandbox、临时目录和连接；结束后收敛到零；做 soak test 和随机取消；对 orphan 设置 reaper。

#### 48. 本地 Agent 如何升级不中断旧 session？

持久格式向后兼容；升级前 snapshot；工具/schema/provider adapter 版本记录；必要时旧 session 用兼容运行时恢复或明确迁移。

#### 49. 如何做 feature flag？

按用户/session/task slice 固定分配，记录进 trace；避免同一任务中途漂移；支持紧急 kill switch；eval 与线上 flag 配置可对应。

#### 50. 最重要的 Runtime 不变量是什么？

状态可恢复、工具 call/result 闭合、副作用不被未知重放、权限不能由模型提升、取消最终释放资源、完成有证据。

---

# 动手实现一个最小 Coding Agent

这里跳过语言基础，直接看几个能暴露系统边界的小型实现。

## 适合单独实现的组件

- 实现异步 tool dispatcher，支持超时、取消和并发限制；
- 实现 append-only event log 与幂等 reducer；
- 实现 `read_file` / `apply_patch` 的版本检查；
- 实现流式子进程输出与最大 buffer；
- 从 trace 检测重复循环；
- 实现简化的 hybrid retriever；
- 为 tool schema 写验证和错误分类；
- 实现 session replay；
- 设计 eval runner 与 grader；
- 修一个 tool call/result 顺序 bug。

## 最低限度的测试

以异步 tool dispatcher 为例，最低限度应覆盖：

- 正常成功与结构化失败；
- schema invalid 不执行工具；
- 超时后资源释放；
- 用户取消传播；
- 并发上限；
- 一个任务失败不误杀无关任务；
- 同一资源写冲突串行；
- 超大输出截断且完整 artifact 可查；
- result 事件恰好一次；
- 进程在落盘边界崩溃后的恢复。

## 一个最小项目练习

如果想建立第一手认识，可以实现一个 300～800 行的 mini coding agent，功能限制为：

```text
read_file
search_text
apply_patch(base_hash)
run_command(timeout)
git_diff
```

要求：

- 不使用大型 Agent 框架；
- tool schema 严格；
- session 写 JSONL event log；
- 支持 Ctrl-C 取消；
- 输出截断与 artifact；
- context 到阈值时生成结构化摘要；
- 10 个固定仓库任务组成 eval；
- 输出 task success、调用数、token、时长和失败类别。

这个练习的目标不是做产品，而是让你对每个边界有第一手经验。亲手处理一次“为什么中断的 tool call 必须补 result”，比记住十个框架名更有价值。

---

# 设计审查清单

### Agent 核心

- [ ] 能从零画 Agent Loop 和状态机
- [ ] 能解释终止、循环检测、重试、取消、handoff
- [ ] 能讲 Agent / Workflow 的边界
- [ ] 能解释 Model Gateway 与内部消息 IR

### 工具与执行

- [ ] 能设计清晰 tool schema 和错误模型
- [ ] 能讲 tool call/result 闭合与幂等
- [ ] 能处理 Shell 流、进程树、超时和输出上限
- [ ] 能比较文件编辑策略并保护用户修改
- [ ] 能解释 Git 基线、diff、worktree 和测试作弊
- [ ] 能解释 MCP 能做和不能做什么

### 上下文

- [ ] 能设计 repo map、hybrid retrieval、重排和 token packing
- [ ] 能解释为什么大窗口不替代上下文工程
- [ ] 能设计压缩摘要并评测恢复质量
- [ ] 能区分 working/episodic/semantic/procedural memory

### 安全与长任务

- [ ] 能画信任边界和分层防御
- [ ] 能设计 approval scope 与远程沙箱
- [ ] 能解释 prompt injection 为何不能只靠 prompt
- [ ] 能设计 event log、snapshot、replay、seq catch-up
- [ ] 能处理非幂等未知结果和用户 steering

### Subagent

- [ ] 能判断什么时候不用 Multi-agent
- [ ] 能设计子任务契约、权限继承和预算
- [ ] 能处理写冲突、fan-out、取消和成本聚合

### Eval 与 Trace

- [ ] 能写完整 eval case 和 grader
- [ ] 能区分结果、过程、效率、安全、产品指标
- [ ] 能做 paired comparison、slice、消融和 canary
- [ ] 能审计 benchmark 污染和 grader 缺陷
- [ ] 能从 trace 找首次偏离并转成 regression
- [ ] 能在可调试性与隐私之间做设计

---
