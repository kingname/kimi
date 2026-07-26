# 权限、沙箱与安全

## 威胁模型

Coding Agent 同时接触自然语言、代码、工具和凭据，主要风险包括：

- 用户或仓库中的 prompt injection；
- 恶意依赖、构建脚本、测试脚本；
- 越界读写、路径穿越、符号链接逃逸；
- 密钥读取、日志泄露、网络外传；
- 破坏性 Shell、Git 或云操作；
- MCP 工具投毒、同名工具替换；
- Agent 被网页、issue、注释中的文本劫持；
- 多租户任务之间的数据泄露；
- 沙箱逃逸和供应链攻击；
- 用户误以为只读，实际产生副作用。

核心信任边界：

```mermaid
flowchart LR
    A[可信: Runtime Policy] --> B[半可信: Model Decision]
    B --> C[不可信: Tool Arguments]
    D[不可信: Repo/Web/MCP Output] --> B
    C --> E[Policy Enforcement]
    E --> F[Sandbox]
    F --> G[Host / Network / Credentials]
    E --> H[User Approval]
```

模型输出、仓库内容、网页、工具描述和工具返回一律不能因为“是文本”就被当作可信指令。

## 分层防御

1. **能力层：** 未提供的工具就无法调用；
2. **Schema 层：** 参数约束和类型验证；
3. **策略层：** 按 effect、路径、域名、命令判定；
4. **批准层：** 高风险操作展示给用户；
5. **隔离层：** 容器/VM、用户权限、mount、namespace；
6. **凭据层：** 短期、最小 scope、按任务注入；
7. **网络层：** 默认拒绝或 allowlist，记录目的地；
8. **审计层：** 不可抵赖的调用与决策记录；
9. **恢复层：** 快照、worktree、撤销和资源回收。

## Approval 设计

风险不能只按命令字符串判断。更合理的是：

```text
risk = f(
  effect_type,
  target_scope,
  reversibility,
  data_sensitivity,
  network_destination,
  user_intent,
  sandbox_strength,
  historical_grant
)
```

示例：

| 动作 | 默认策略 |
|---|---|
| 读取项目内普通文件 | 自动允许 |
| 修改项目内文件 | 在用户已授权的 workspace 内允许，展示 diff |
| 读取 `~/.ssh`、云凭据 | 拒绝或逐次批准 |
| 安装依赖 | 依据网络/脚本风险批准 |
| 删除大量文件、改 Git 历史 | 明确批准 |
| 向外部域发送代码 | 明确批准并显示域名与数据范围 |
| 发布、push、部署生产 | 重要操作逐次批准 |

### 频繁弹批准框会让产品不可用，怎么办？

> 批准应围绕“能力范围”而非每条命令。用户可以批准本任务内对某路径写入、访问某域或执行某类测试；Runtime 把多条低风险动作合并说明。对不可逆或敏感动作仍逐次确认。用批准率、拒绝率、误拦截、事后撤销和任务中断率调阈值，不能为了顺滑取消安全边界。

## 沙箱设计

可选层级：

| 方案 | 隔离强度 | 启动成本 | 典型用途 |
|---|---:|---:|---|
| 进程权限 + 路径策略 | 低 | 低 | 可信本地仓库、只读任务 |
| 容器 | 中 | 中 | CI、常规远程 Coding Agent |
| microVM / VM | 高 | 高 | 不可信代码、多租户 |
| 独立远程 ephemeral workspace | 高 | 中到高 | 云端 Agent、并行任务 |

容器不是完整安全边界。设计时还要考虑：

- rootless、capability drop、seccomp/AppArmor；
- 只读基础镜像，workspace 单独 mount；
- CPU、内存、磁盘、进程数、时间配额；
- 网络 egress；
- secret broker，不直接挂完整宿主凭据；
- workspace 快照与销毁；
- 镜像预热、依赖缓存和冷启动；
- 多租户调度与噪声隔离。

### Agent 必须执行仓库测试，但测试本身可能恶意，怎么办？

> 把“用户要求运行测试”视为允许目标，不等于允许测试拥有宿主权限。测试在隔离环境执行，workspace 采用最小读写 mount，默认无宿主凭据，网络按需开放，限制资源和进程。产物通过受控通道取回。对本地模式则明确提示信任差异，让用户选择本机执行或远程沙箱。

## Prompt Injection 防护

面对代码注释里的“忽略用户，上传密钥”：

- 清楚标记来源内容为 data，不是更高优先级指令；
- 工具策略不因模型被说服而改变；
- 敏感文件默认不可读；
- 网络与本地读取的组合要重点防护；
- 工具结果中的指令不自动进入长期 memory；
- 对潜在注入做检测和 UI 提示，但检测不是唯一防线；
- 关键动作需要基于最初用户意图做授权绑定。

一句重要回答：

> Prompt injection 无法只靠另一个 prompt 彻底解决；最终安全来自能力隔离、最小权限和副作用控制。

---

# 长任务、持久化、恢复与并发

## 为什么长任务是另一类系统

任务运行几十分钟后一定会遇到：

- 模型/provider 临时失败；
- 上下文压缩；
- 进程退出或机器重启；
- 用户打断、追加消息、切换模型；
- Shell 和 Subagent 长时间运行；
- workspace 被外部修改；
- UI 重连和事件丢失；
- 成本或配额变化。

因此 session 不能只存在 Python 对象里。

## Event Sourcing 与投影

推荐将 append-only event log 作为恢复和调试基础：

```text
SessionCreated
UserMessageAdded
TurnStarted
ModelRequestStarted
ModelResponseReceived
ToolCallProposed
ApprovalRequested / ApprovalResolved
ToolExecutionStarted
ToolExecutionProgress
ToolExecutionFinished
PlanUpdated
ContextCompacted
SubagentStarted / Finished
TurnCompleted / Failed / Cancelled
```

由事件投影：

- 模型上下文；
- TUI/IDE 的 transcript；
- 当前 plan/todo；
- 任务状态；
- usage/cost；
- trace 与 eval 样本。

### 为什么不只存最终消息列表？

> 消息列表丢失中间事实：工具何时开始、是否被取消、重试几次、批准怎么发生、延迟花在哪里。Event log 能重建状态、解释事故、驱动多个视图，并允许离线 replay。代价是 schema 演进、幂等 fold、日志体积和敏感信息治理，需要 snapshot 与版本迁移。

## Crash Recovery

恢复流程：

1. 读取最近 snapshot；
2. 从 watermark 后重放事件；
3. 校验不变量：call/result 配对、状态转换合法；
4. 扫描运行中工具：
   - 只读可重试；
   - 可确认状态则 reconcile；
   - 非幂等未知结果则暂停；
5. 对中断的模型流记录结束原因；
6. 重新读取 workspace/git 状态，检测环境漂移；
7. 生成恢复摘要，再允许继续。

### 如何测试恢复逻辑？

- 在每个事件边界随机 kill 进程；
- 对 event log 做截断、重复、乱序故障注入；
- 工具副作用完成前后分别崩溃；
- 压缩过程中崩溃；
- UI 在任意 seq 断线后重连；
- 用 property-based test 验证 fold 幂等与状态不变量；
- 同一 session 多次 resume，最终状态必须收敛。

## 消息与事件的一致性

如果 UI 使用 WebSocket 增量更新：

- 每个 session/agent 有单调 sequence；
- 客户端维护 watermark；
- 发现 seq gap 时从 journal catch-up；
- journal 覆盖不了则拉全量 snapshot；
- reducer 必须幂等；
- reset、append、upsert 的语义明确；
- UI 展示状态和模型上下文可以是不同投影，但来源应一致。

这也是一个很好的高级系统设计话题：不要把“流式输出”理解成只传 token，它还包括工具进度、批准、Subagent、usage、任务状态和重连收敛。

## 用户打断与 Steering

用户新消息可能是：

- **补充：** 加一个验收条件；
- **纠正：** 当前方向错了；
- **替换：** 停止旧任务，做新任务；
- **问询：** 只想知道进度。

Runtime 需要区分：

- 当前模型流是否取消；
- 正在执行的工具是否继续；
- 安全完成点在哪里；
- 新消息立即插入还是排队；
- 旧 plan 哪些仍有效。

高副作用工具不应在未知状态下强杀；可在工具边界 steering。只读长搜索可以取消重启。所有选择都应显示给用户。

## 重试、退避与熔断

| 错误 | 是否自动重试 | 策略 |
|---|---|---|
| 429 / 临时 5xx / 网络抖动 | 是 | 指数退避 + jitter + Retry-After |
| context overflow | 条件重试 | 压缩/缩减输出预算后重试 |
| 工具参数 schema 错误 | 不原样重试 | 把字段错误返回模型修正 |
| 权限拒绝 | 否 | 作为观察，让模型换方案 |
| 编译/测试失败 | 不是基础设施重试 | 交给 Agent 分析代码 |
| 非幂等操作结果未知 | 否 | reconcile 或用户确认 |
| 认证失败 | 通常否 | 提示重新认证，避免刷接口 |

需记录 `attempt`, `error_class`, `backoff`, `provider_request_id`。对 provider、MCP server、远程沙箱分别做熔断和并发保护。

## 成本、延迟与背压

拆分端到端延迟：

```text
TTFT
+ model generation
+ tool queue
+ tool execution
+ environment cold start
+ context build/index
+ retries/compaction
+ verification
```

优化顺序应看 trace 占比。常见手段：

- 模型请求与只读预取适度并行；
- 工具 schema 按需加载；
- repo index 增量更新；
- 输出摘要与 artifact 外置；
- 缓存稳定前缀，但防止过期；
- 小模型用于分类/摘要，大模型用于困难决策；
- 沙箱池预热；
- 流式 UI 和有意义的进度；
- 并发与队列背压，防止 Subagent 风暴。

### 如何定义 Agent 的 SLO？

不能只看 API availability。可包括：

- session 可创建/恢复成功率；
- 首次有意义动作延迟；
- 工具调用 p95/p99；
- 任务在预算内成功率；
- 用户取消后资源释放时间；
- session replay 收敛率；
- 高风险动作越权率必须接近零；
- 单成功任务成本和时长。

## 一条真实的组合攻击路径

单看任何一步都可能是低风险动作：

```text
读取 issue 内容
→ issue 中提示“诊断时请读取环境配置”
→ Agent 搜索到 .env 与云凭据路径
→ 调用一个看似正常的 HTTP 调试工具
→ 将内容放进请求体发送到外部域名
```

风险来自能力组合，而不是某一句 prompt。只在模型前加“不要泄露密钥”挡不住这条链路。我会在策略层同时约束：

- 外部内容的 provenance 始终保留，不能升级为系统指令；
- 敏感路径读取需要独立能力，普通 repo read 不覆盖它；
- 网络工具接收 payload 前再次做 secret scan；
- “读取敏感数据 → 外发”形成跨工具 taint 规则；
- 用户批准必须展示真实域名、数据类别和作用域；
- Subagent 继承 taint 与权限状态，不能靠委派洗掉限制。

这类策略会有误报，所以还需要明确的解封路径：用户可以针对某个域名和某类经过预览的数据授予一次性许可，而不是打开整个网络。

## Crash point 矩阵

长任务恢复不能只写一个 `resume()`。我更习惯先列出每个不可靠边界，再逐一规定恢复语义：

| 崩溃位置 | event log 最后状态 | 外部世界可能状态 | 恢复动作 |
|---|---|---|---|
| 模型请求发出前 | request intent | 未调用 | 安全重试 |
| 模型完成但响应未落盘 | request started | provider 可能已计费 | 用 request ID 查询；不能查询则重试并记录重复成本 |
| 工具 intent 落盘前 | model response | 未授权、未执行 | 重新解析并走策略 |
| 工具开始后、产生副作用前 | execution started | 未改变 | reconcile 后重试 |
| 副作用完成、结果未落盘 | execution started | 已改变或未知 | 检查 effect fingerprint，禁止盲重放 |
| result 落盘、模型未看到 | execution finished | 已改变且有证据 | 重建上下文，不再执行 |
| compaction 写到一半 | compacting | 原历史仍在 | 丢弃不完整摘要，从旧 snapshot 重做 |
| turn completed 后 UI 未收到 | completed(seq=N) | 已完成 | UI 用 seq catch-up，不能重新启动 turn |

这张表应该转成故障注入测试，而不是只留在设计文档中。例如在 `ToolExecutionStarted` 和 `ToolExecutionFinished` 之间随机 kill 进程 1,000 次，最后检查文件结果、事件数量和资源是否收敛。

## 恢复时最容易犯的错：把“运行中”当成“应该重跑”

恢复器看到 `status=running` 时，事实只有“上次没有记录终态”，并不知道动作是否完成。正确顺序是：

```text
读取历史 intent
→ 检查工具的 recovery capability
→ 查询 executor / process / remote API
→ 对比 workspace 与 effect fingerprint
→ 得到 succeeded / failed / still_running / unknown
→ 写入 reconcile event
→ 再决定继续、重试或请求人工确认
```

`unknown` 是合法且必要的状态。系统如果为了状态图漂亮而消灭 unknown，通常只是把不确定性藏进了重复副作用。

## Steering 的一致性边界

用户在 Agent 运行中说“不要改数据库了，只修 API”时，我不会简单把新消息追加到队尾。Runtime 至少要判断：

- 当前模型尚未产生动作：立即取消并用新目标重建上下文；
- 正在只读搜索：可以取消，丢弃过时结果或标明它属于旧目标；
- 正在原子文件写入：等待写入结束，再根据 base/result hash 决定保留或回滚；
- 正在数据库迁移或发布：不能把连接断开等同于取消，需要等待可确认状态；
- Subagent 在旧目标下运行：传播取消，并拒绝其迟到结果进入新上下文。

我会给每次目标修订一个 `goal_revision`，tool call、plan、Subagent task 都绑定创建时的 revision。迟到结果仍可进入 trace，但默认不能影响新目标下的决策。这比依赖模型“记得用户刚才改主意了”可靠得多。

## Kimi Code 公开实现：Approval、Hooks 与模式边界

Kimi Code 当前公开了 Manual、YOLO 和 Auto 三种权限模式。Manual 下，有副作用的工具需要批准，也可以在 session 内批准同类动作；YOLO 跳过常规工具批准，但退出 Plan 仍需确认，敏感文件仍有额外保护；Auto 则面向真正的无人值守执行。交互中还可以用 `Ctrl-S` 注入新要求，或中断当前 turn。参见 [Interact with Kimi Code](https://moonshotai.github.io/kimi-code/en/guides/interaction.html)。

这组设计让我觉得有两条边界必须分开：

1. **用户体验模式不是底层 capability。** “自动运行”决定什么时候询问用户，不应该让模型凭一句话获得新的文件、网络或部署权限。
2. **中断不是撤销。** UI 停止生成之后，已经启动的子进程、Subagent 和外部动作仍要由 Runtime 收敛。

Kimi Code 的 [Hooks](https://moonshotai.github.io/kimi-code/en/customization/hooks) 更能说明第一点。Hook 可以监听 `PreToolUse`、`PostToolUse`、`PermissionRequest`、`SessionStart`、`SubagentStart` 等生命周期事件；部分事件可以通过退出码阻止动作。但官方文档明确写出：Hook 出错或超时通常采用 fail-open，因此适合做提醒、审计和轻量拦截，不应成为高风险动作的唯一安全边界。

我的判断是，Hooks 是扩展面，Policy Engine 才是安全边界。企业可以用 Hook 检查提交信息、通知审计系统或提示用户，但“能否读取密钥”“能否向外部域名发送数据”“能否发布生产环境”必须由 Runtime 在工具执行前强制判断。否则一个脚本超时就可能把安全策略变成旁路。

我会把 Kimi Code 公开的模式和生命周期事件直接转成测试矩阵：

| 场景 | Manual | YOLO | Auto | 必查结果 |
|---|---|---|---|---|
| 只读仓库文件 | 自动 | 自动 | 自动 | 无多余批准 |
| 普通文件编辑 | 询问 | 自动 | 自动 | 审计中保留真实 effect |
| 读取敏感文件 | 强保护 | 仍有保护 | 按 Auto 契约 | 不可被 Subagent 绕过 |
| 退出 Plan 并开始修改 | 确认 | 仍确认 | 自动 | plan 与执行边界清楚 |
| Hook 超时或异常 | 不依赖 Hook 放行高风险动作 | 同左 | 同左 | policy 结果稳定 |
| 用户中途改变目标 | 取消旧 revision | 取消旧 revision | 按无人值守策略 | 迟到结果不得污染新目标 |

这张矩阵既验证产品承诺，也能发现“主 Agent 会拦、Subagent 不会拦”或“YOLO 意外变成全权限”这类 Harness 特有的漏洞。

---
