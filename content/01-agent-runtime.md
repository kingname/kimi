# 从 JD 看 Coding Agent 的真实工程问题

## 问题地图

| JD 信号 | 背后的工程能力 | 可以如何验证 |
|---|---|---|
| Coding Agent 核心系统 | 能从零设计 Agent Runtime，不依赖框架黑盒 | 系统设计、伪代码、故障分析 |
| 执行循环、任务拆解、错误恢复 | 状态机、终止条件、重试语义、持久化恢复 | “设计一个能跑一小时的 Agent” |
| 文件、Shell、搜索、测试、Git | 开发者工具基本功与安全边界 | 工具 API 设计、并发/取消、沙箱 |
| 仓库级上下文工程 | 检索、选择、压缩、记忆、token 预算 | “百万行仓库如何找对上下文” |
| 真实用户 trace、评测集 | 数据驱动调试，不靠 demo 和体感 | 给失败轨迹定位根因、设计 eval |
| 模型协作与能力边界 | 能区分模型问题与 Runtime 问题 | A/B、消融、错误归因 |
| CLI / IDE / 远程执行 | 系统工程、交互体验、协议兼容 | 架构设计、端到端延迟 |
| 产品 sense | 从用户任务而非技术炫技定义成功 | 竞品分析、需求优先级 |

## 一句话系统画像

> 把概率性的模型决策，封装进确定性的软件约束与反馈闭环，使 Agent 在真实代码仓库中长期、可靠、安全地完成任务。

## 问题之间的关系

| 主题 | 在系统中的关注度 |
|---|---:|
| Agent Loop 与 Runtime | 核心状态与控制流 |
| 工具调用、Shell、编辑、Git、沙箱 | 副作用与安全边界 |
| 上下文工程与记忆 | 决策输入的质量 |
| 长任务、恢复、并发、Subagent | 生产可靠性 |
| Evaluation、Trace、Observability | 迭代与归因闭环 |
| 产品与竞品 | 真实用户价值 |

本文跳过 Python 语法、装饰器、GIL 等语言基础，但会保留 `asyncio` 取消传播、子进程管理、结构化并发、流式 I/O 等与 Agent Runtime 直接相关的工程问题。

---

# Agent Runtime：从聊天到闭环执行

## 什么是 Coding Agent

普通代码助手完成的是 `输入 → 生成`；Coding Agent 完成的是：

```text
目标 → 观察环境 → 决策 → 调用工具 → 环境发生变化
    → 再观察 → 修正计划 → 验证 → 结束或交还用户
```

它至少包含四个要素：

- **模型：** 做语义理解、推理和动作选择；
- **工具：** 读取与改变外部世界；
- **状态：** 保存目标、消息、计划、任务、权限和产物；
- **控制器：** 决定何时调用模型、执行工具、压缩、重试、暂停和结束。

### Agent 和 Workflow 有什么区别？

> Workflow 的路径主要由代码预定义，模型填充局部节点；Agent 的下一步路径主要由模型根据环境反馈动态决定。它们不是二选一。生产系统通常是“确定性外壳包住 Agent”：权限、预算、重试、状态转换由代码控制，任务内的搜索、编辑和验证策略由模型选择。能用确定性流程解决的部分不应无谓 Agent 化。

### 为什么 Coding Agent 比一般 Agent 难？

- 代码仓库大而稀疏，正确上下文只占极小部分；
- 工具具有真实副作用，错误命令可能破坏工作区或泄露数据；
- 任务成功往往延迟到测试、构建甚至用户验收后才知道；
- 软件任务是长尾分布，语言、构建系统、仓库规范差异大；
- 长链路中早期小错误会累积，模型容易偏离目标；
- “测试通过”也可能是删测试、过拟合可见测试或改变无关行为；
- 用户会中途追加要求、打断、修改文件，环境并非静态。

## 一个生产级 Agent Runtime

```mermaid
flowchart TB
    U[用户 / IDE / CLI] --> S[Session & Interaction API]
    S --> C[Agent Controller]
    C --> B[Context Builder]
    B --> M[Model Gateway]
    M --> D{模型输出}
    D -->|文本/结束| V[Verifier & Completion Policy]
    D -->|工具调用| P[Policy / Approval]
    P --> X[Tool Executor]
    X --> E[Workspace / Shell / Git / Web / MCP]
    E --> O[Observation Normalizer]
    O --> T[Event Log / Trace]
    T --> B
    C --> K[Task / Plan / Memory Store]
    V -->|未满足| C
    V -->|完成| S
    C --> Q[Subagent / Background Task Scheduler]
    Q --> T
```

核心原则：

- **模型不是状态机。** 模型可以建议动作，Runtime 必须验证动作是否允许。
- **事件日志是真相源。** UI 展示、恢复、评测和调试应尽量由同一事件流投影。
- **可取消是一级能力。** 模型流、工具、子进程、Subagent 都要有明确取消语义。
- **结果必须闭环。** 每个 tool call 都应有对应 result，包括失败、拒绝和中断。
- **终止不是一句“完成了”。** 应由完成策略结合测试、diff、任务约束和预算判断。

## Agent Loop 状态机

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> BuildingContext
    BuildingContext --> CallingModel
    CallingModel --> ExecutingTools: tool_calls
    CallingModel --> Verifying: final_answer
    CallingModel --> Retrying: transient_error
    ExecutingTools --> CallingModel: observations
    ExecutingTools --> AwaitingApproval: risky_action
    AwaitingApproval --> ExecutingTools: approved
    AwaitingApproval --> CallingModel: rejected_result
    Verifying --> CallingModel: incomplete
    Verifying --> Completed: acceptance_met
    Retrying --> CallingModel: retry_budget_ok
    Retrying --> Failed: exhausted
    Ready --> Cancelled: user_cancel
    CallingModel --> Cancelled: user_cancel
    ExecutingTools --> Cancelled: user_cancel
    CallingModel --> Compacting: context_pressure
    Compacting --> CallingModel: compacted_context
```

下面这段伪代码刻意把状态与边界显式化：

```python
async def run_turn(session, user_input):
    await session.append_event(UserMessage(user_input))
    budget = Budget(max_steps=80, max_cost=5.0, deadline=now() + 30 * MINUTE)

    while not budget.exhausted():
        snapshot = await session.snapshot()
        context = await context_builder.build(snapshot, budget.remaining())

        try:
            response = await model.generate(
                context=context,
                tools=tool_registry.schemas(snapshot.permission_mode),
                cancel_scope=session.cancel_scope,
            )
        except ContextOverflow:
            await compact(session)
            continue
        except TransientProviderError as error:
            await retry_with_backoff(error, budget)
            continue

        await session.append_event(ModelResponse(response))

        if response.tool_calls:
            validated = policy.validate(response.tool_calls, snapshot)
            results = await execute_with_limits(validated, session.cancel_scope)
            # 成功、失败、拒绝、中断都写入结果，保持调用/结果配对
            await session.append_events(results)
            budget.charge(results)
            continue

        verdict = await completion_policy.verify(response, snapshot)
        if verdict.accepted:
            await session.append_event(TurnCompleted(verdict))
            return response.final_text

        await session.append_event(VerifierFeedback(verdict.feedback))

    return await hand_back_to_user(reason=budget.exhaustion_reason)
```

### 循环何时结束？

不能只依赖模型说“done”。终止条件分四类：

- **任务成功：** 验收条件满足，必要测试通过，diff 符合范围；
- **需要用户：** 需求歧义、高风险操作、凭据或外部信息缺失；
- **资源耗尽：** step、token、成本、时间、重试预算到达上限；
- **不可恢复失败：** 环境损坏、权限拒绝、确定性错误无法绕过。

回答时强调“宁可显式 handoff，也不能无限循环”。循环检测可使用：

- 连续相同工具与近似参数；
- workspace hash / git diff 长时间不变；
- 同一错误签名重复；
- 计划节点没有进展；
- 观察文本相似度过高；
- 单位成果成本持续恶化。

### 如何避免模型不停重试同一个错误？

> 我会把错误结构化为 `kind / retryable / blame / signature / suggested_action`。网络超时可指数退避并加 jitter；schema 错误应反馈具体字段让模型修正；权限拒绝应作为确定结果回到上下文；编译失败要保留关键诊断；相同错误签名超过阈值后禁止原动作，要求换策略或交还用户。重试预算按错误域分别计算，避免一个工具吃光整轮预算。

## Planning 与执行

计划的价值不是让回答看起来有条理，而是：

- 外化长任务状态，降低目标遗忘；
- 提供进度与可解释性；
- 形成可检查的中间契约；
- 便于失败恢复和多人/多 Agent 协作。

计划不应成为僵硬脚本。推荐结构：

```yaml
goal: 修复并验证鉴权缓存竞态
acceptance:
  - 最小复现测试在修复前失败、修复后通过
  - 不改变公开 API
constraints:
  - 不升级无关依赖
steps:
  - id: reproduce
    status: completed
    evidence: tests/test_auth_cache.py::test_concurrent_refresh
  - id: locate
    status: in_progress
  - id: patch
    status: pending
  - id: verify
    status: pending
open_questions:
  - token refresh 是否允许重复但结果幂等？
```

### 每个任务都要先生成完整计划吗？

> 不需要。计划成本应与任务不确定性匹配。单文件明确修改可直接执行；跨模块、有高副作用或超过若干步的任务先做轻量计划；架构变更先只读探索并让用户审阅。计划应滚动更新，环境证据推翻假设时允许重规划。

---
