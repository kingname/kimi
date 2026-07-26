# Evaluation：怎样证明 Agent 真的变好了

## Eval 的基本单位

一个 Agent eval case 至少包含：

```yaml
task:
  prompt: "修复并发刷新导致的重复请求"
environment:
  repo: example/repo
  commit: abc123
  image: sha256:...
  network: disabled
  tools_version: v7
acceptance:
  tests:
    - hidden/test_refresh_race.py
  invariants:
    - public_api_unchanged
  forbidden:
    - modify_tests
budgets:
  wall_time: 20m
  tokens: 200k
grader:
  deterministic: ...
  semantic_rubric: ...
```

必须固定仓库 commit、依赖、镜像、工具与模型配置；否则比较的是环境噪声。

## 指标分层

#### 任务结果指标

- resolve rate / pass rate；
- hidden test pass；
- 人工验收；
- 是否满足范围和禁止项；
- 回归率；
- 用户最终是否接受/撤销。

#### 过程指标

- 首个正确文件召回率；
- 工具选择/参数正确率；
- 无效调用比例；
- 重复错误率；
- 计划完成率；
- context overflow / compaction 次数；
- 需要用户干预次数；
- 恢复成功率。

#### 效率指标

- wall time；
- tokens / cost；
- model turns；
- tool calls；
- 沙箱 CPU/内存；
- **cost per successful task**。

#### 安全指标

- 越权调用；
- prompt injection 攻击成功率；
- secret exposure；
- 破坏性修改；
- approval bypass；
- 测试作弊。

#### 产品指标

- task completion；
- 用户接受 patch 的比例；
- 修改后保留率/撤销率；
- time-to-merge；
- 用户中途接管率；
- 周期性留存。

### 为什么只看最终 pass rate 不够？

> 最终结果样本效率低，而且会掩盖退化：一个版本成功率不变，但成本翻倍、危险动作增加或靠更多重试堆出来。过程指标帮助定位归因，安全与效率指标约束不可接受的“优化”。不过过程指标是诊断信号，最终仍要与真实任务成功相关，不能为降低工具数牺牲结果。

## 评测数据集构建

来源：

- 经过同意和脱敏的真实用户失败任务；
- 公共 issue/PR 构建的任务；
- 内部工程师设计的能力切片；
- 对历史任务做 mutation；
- 安全红队任务；
- 线上 canary。

分层：

```text
Smoke（分钟级）
→ Capability Slice（搜索/编辑/恢复等单能力）
→ Regression（历史失败）
→ Full Repository Tasks（长链路）
→ Online Shadow / Canary
```

切分时按 **repo、时间、任务族** 去重，避免同仓库相似 patch 泄漏到 train/dev/test。公开 benchmark 还要考虑模型训练污染。

### 如何从线上 trace 变成高质量 eval？

1. 脱敏并确认授权；
2. 固化任务开始时的 repo/environment；
3. 把用户真实意图转成明确 acceptance；
4. 保留失败 trace 作为诊断，不把它当标准答案；
5. 建立确定性测试和必要的人工 rubric；
6. 审核任务是否可解、是否存在多种正确解；
7. 标注失败分类和难度；
8. 去重并做时间切分；
9. 定期重审 grader，防止模型进步后测试成为瓶颈。

## Grader 设计

优先级：

1. **确定性环境检查：** build、test、lint、类型检查；
2. **结构化规则：** diff 范围、禁止文件、API 兼容；
3. **行为测试：** hidden cases、性能、安全；
4. **LLM-as-judge：** 语义质量、解释、可维护性；
5. **人工评审：** 高价值、难自动化样本。

LLM judge 不能直接当真值：

- 做 pairwise 往往比绝对打分稳定；
- 隐藏候选身份，随机左右顺序；
- 明确 rubric 并给证据；
- 用专家标注校准；
- 测 position bias、verbosity bias、自偏好；
- 多 judge 或多次采样估计不确定性；
- judge 只看到需要的信息，避免泄漏参考 patch。

### 测试全过了就算成功吗？

> 不一定。测试可能不完整、有缺陷，Agent 也可能修改测试或过拟合。还要看任务约束、diff 范围、隐藏测试、API 兼容和代码质量。反过来测试失败也不总等于方案错误，可能是 benchmark 环境或 grader 缺陷。因此 eval 本身也需要审计。

2026 年 OpenAI 对 SWE-bench Verified 的复核指出污染和测试缺陷会削弱 benchmark 的区分度，并建议使用更新、更可靠的评测。这一案例说明“排行榜数字”不能替代对任务、测试和失败样本的检查。参见 [Why SWE-bench Verified no longer measures frontier coding capabilities](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)。

## 实验设计

比较 baseline 与 candidate：

- 完全相同的任务集合与环境；
- 最好 paired run，降低任务难度方差；
- 非确定系统每个 case 多个 seed/run；
- 报告均值之外给置信区间；
- 同时看总体与关键 slice；
- 预先定义 primary metric 和 guardrail metric；
- 避免反复看测试集调参；
- 记录模型、prompt、tools、runtime、image 的完整版本。

对二元成功率的 paired 比较可用 McNemar test 或 bootstrap；对成本/时长等长尾指标可用 paired bootstrap，并报告中位数和高分位。

### 成功率从 40% 到 42%，能上线吗？

> 不能只看 2 个百分点。要看样本量和配对差异的置信区间、提升集中在哪些任务、是否牺牲成本/延迟/安全、是否存在严重回归。若离线证据正向但不充分，可在低风险流量 shadow 或小比例 canary，设停止条件，再逐步扩大。

## 消融与错误归因

Agent 是模型、prompt、context、tools、runtime、environment 的乘积。归因方法：

| 干预 | 能回答的问题 |
|---|---|
| 给 oracle 文件集合 | 检索是否是瓶颈 |
| 给 oracle 计划 | 规划是否是瓶颈 |
| 给 oracle 工具结果 | 工具执行/观察是否有问题 |
| 固定模型，只换 Runtime | 系统改动贡献 |
| 固定 Runtime，只换模型 | 模型能力贡献 |
| replay 同一轨迹到某一步 | 从哪一步开始偏离 |
| 禁用某工具/记忆/Subagent | 组件是否真有贡献 |
| 人类接管一步后继续 | 哪类干预最关键 |

不要强迫每个失败只有一个标签。推荐：

```text
root_cause: context.retrieval.missed_definition
contributors:
  - tool.search.result_truncated
  - model.did_not_follow_error_hint
detected_at: test.hidden_failure
recoverable: true
```

## Eval Flywheel

```mermaid
flowchart LR
    U[真实用户任务] --> T[Trace 与反馈]
    T --> C[失败聚类/根因分类]
    C --> D[可复现 Eval Case]
    D --> H[提出改动假设]
    H --> E[离线对照与消融]
    E --> G{质量门禁}
    G -->|通过| A[Canary / A-B]
    G -->|失败| H
    A --> M[线上指标与新长尾]
    M --> T
```

### 评测集会不会被“刷题”刷坏？

会。防止方法：

- 保留不可见 holdout；
- 按时间滚动加入新任务；
- 用任务 mutation 扩展等价变化；
- 不把参考 patch 暴露给 Agent；
- 关注跨 repo 泛化；
- 对异常提升审计 trace；
- 定期淘汰饱和、污染或 grader 有缺陷的任务；
- 线上真实指标作为最终约束。

---

# Observability 与 Trace Analysis

## 三类可观测数据

- **Logs：** 离散事件和错误，适合检索；
- **Metrics：** 聚合趋势、SLO 和告警；
- **Traces：** 一次任务的因果链，适合定位 Agent 行为。

Agent trace span 层级：

```text
session
└── turn
    ├── context.build
    │   ├── search
    │   └── compact
    ├── model.generate
    ├── tool.execute
    │   └── process / remote / mcp
    ├── subagent.run
    └── verifier
```

每个 span 建议记录：

- session/turn/agent/call ID；
- model/provider/tool 版本；
- start/end/status；
- token、cost、bytes；
- timeout/retry/cancel；
- 输入输出 hash 与受控预览；
- workspace revision / image；
- permission decision；
- error taxonomy。

## 隐私与可调试性的平衡

不能为调试默认永久保存完整代码、prompt、密钥和 Shell 输出。

- 内容与元数据分离；
- 默认只存 hash、长度、类型和脱敏摘要；
- 详细 trace 需要用户同意或短期 debug 模式；
- secret scanner 在落盘前运行；
- tenant 隔离、访问审计、TTL；
- eval 数据二次脱敏；
- UI 支持导出前预览；
- 能按用户请求删除。

## 失败分类

可建立层次化 taxonomy：

```text
intent
  ├── misunderstood_requirement
  └── missing_clarification
context
  ├── retrieval_miss
  ├── stale_context
  ├── over_compression
  └── instruction_conflict
planning
  ├── wrong_decomposition
  └── goal_drift
tool
  ├── wrong_selection
  ├── invalid_arguments
  ├── execution_failure
  └── observation_truncation
editing
  ├── stale_write
  ├── patch_failure
  └── unrelated_change
verification
  ├── insufficient_tests
  ├── test_cheating
  └── false_completion
runtime
  ├── timeout
  ├── cancellation
  ├── recovery
  └── provider_protocol
safety
  ├── permission
  ├── injection
  └── exfiltration
```

### 如何分析“Agent 跑了 30 分钟最后失败”的 trace？

参考步骤：

1. 先判断 acceptance 是否清晰且任务可解；
2. 找第一次不可逆或关键偏离，而不是只看最后错误；
3. 画 goal/plan 随时间变化；
4. 检查关键文件何时首次出现、是否后来被压缩丢失；
5. 聚合同一工具、错误签名、workspace diff；
6. 查看验证反馈有没有正确进入下一轮；
7. 做 counterfactual replay：从偏离点给 oracle 提示继续；
8. 将根因转成可重复 eval，不只修这一个 prompt。

## Trace Replay

三种 replay：

- **Full live replay：** 模型与工具重跑，最真实但不稳定；
- **Tool replay：** 固定历史工具结果，只重跑模型，隔离模型变化；
- **Model replay：** 固定模型输出，重跑 Runtime/工具，验证协议与状态；
- **Deterministic fold：** 不执行任何外部动作，只验证事件重建。

工具 replay 必须注意：历史 observation 可能含时间、随机数或敏感信息；它适合调试，不等价于真实成功率。

## 高频可观测性问题

### 日志里应不应该记录模型完整 reasoning？

> 默认不依赖也不长期保存隐藏 reasoning。调试应记录可用的模型输出、工具调用、结果、决策元数据和外显摘要。完整内容受 provider 能力、隐私和安全策略约束。真正可操作的可观测性来自行为轨迹，不是窥探思维链。

### 如何监控 goal drift？

- 计划节点长期不更新；
- tool call 与当前 acceptance 语义距离增大；
- 修改文件超出预测范围；
- 原验收条件在摘要中消失；
- 重复探索已确认事实；
- verifier 反馈多次未被响应；
- 人工标注一批 drift trace 训练分类器。

检测器只用于提醒或触发重新规划；高误报时不能频繁打断正常探索。

## 一个完整的改动验证：新的上下文重排器值不值得上线

假设我们把检索器从“词法排序”改成“词法 + symbol graph + reranker”。在 500 个仓库任务上，成功率从 41.2% 提升到 44.0%。这个结果还不足以直接上线。

我会继续追下面几层：

### 先看 paired case，而不是两个总体均值

```text
baseline 成功，candidate 成功：181
baseline 失败，candidate 失败：265
baseline 失败，candidate 成功： 39
baseline 成功，candidate 失败： 15
```

真正提供信息的是 39 个新增成功和 15 个回归。需要确认：

- 新增成功是否集中在跨文件、符号引用任务，符合改动机制；
- 15 个回归是否因为 reranker 把精确错误字符串降权；
- 同一个 repo 是否贡献了大部分提升；
- 多次运行后配对差异是否稳定；
- 额外延迟、token 和索引成本是多少。

若提升主要来自预期 slice，且回归有一致根因，才说明实验支持原假设；若所有 slice 都随机涨一点，更可能是环境或采样噪声。

### 再做三个 oracle 实验

1. **Oracle retrieval：** 直接给出正确文件，估计检索改进的成功率上界；
2. **Oracle rerank：** 保留原候选，只把正确片段放到预算内，隔离排序问题；
3. **Oracle context budget：** 给候选版本更大窗口，判断回归是否来自新增片段挤走关键信息。

如果 oracle retrieval 成功率仍很低，就不应继续在召回算法上堆复杂度；瓶颈可能已经转移到编辑或验证。

### 上线门禁

```yaml
primary:
  task_success_delta: "> 0 with 95% paired CI"
guardrails:
  severe_regression_cases: 0
  secret_exposure_delta: "<= 0"
  p95_time_to_first_action: "< +15%"
  cost_per_success: "< +10%"
rollout:
  shadow: 100%
  canary: 5%
  rollback:
    - user_cancel_rate > baseline + 2%
    - severe_slice_regression >= 1
```

阈值不是通用答案，但必须在看线上结果之前确定。否则每个指标都可以被事后解释。

## Trace 分析要找到“第一次有机会做对却没有做对”

最终报错经常只是最后一张多米诺骨牌。以“测试失败，因为接口参数没更新”为例：

```text
T+00:00 用户要求迁移 API
T+00:12 搜索旧方法名，只返回前 20 个结果且标记 truncated
T+00:28 Agent 读取 3 个调用方，没有继续分页
T+04:10 修改接口和已看到的调用方
T+06:20 运行局部测试通过
T+08:40 全量测试发现异步 worker 仍使用旧参数
T+10:00 Agent 修复 worker，但又漏掉生成代码
T+14:00 预算耗尽
```

“全量测试太晚”不是最早根因。第一次关键偏离发生在 `T+00:28`：工具已经明确结果被截断，Agent 却把它当成完整集合。进一步归因还要区分：

- 工具有没有把 truncation 放在足够显著的位置；
- Prompt 是否要求处理分页；
- 模型在相同结构化结果下是否仍忽略；
- Runtime 是否能在“全仓迁移”任务中自动检查搜索覆盖率。

对应修复可能横跨工具结果 schema、模型行为和 verifier。一个 trace 允许有多个 contributor，但应指定一个可验证的 root cause。

## 我会怎样把这条 trace 变成回归样本

```yaml
task: 将 fetch_user(id) 迁移为 fetch_user(UserKey)
repo_revision: fixed-fixture-v3
setup:
  occurrences: 37
  search_page_size: 20
acceptance:
  - all_call_sites_migrated
  - generated_source_not_edited_directly
  - full_test_suite_passes
instrumentation_assertions:
  - pagination_or_alternative_search_used
  - no_truncated_result_treated_as_complete
slices:
  - cross_module
  - truncated_observation
  - generated_code
```

任务结果仍是 primary metric；`instrumentation_assertions` 只用于解释失败。如果某个新策略不走分页却通过符号索引找全了调用方，它不应因为过程与旧方案不同而被判失败。

## 可观测性系统本身也需要预算

完整保存每次 prompt、代码、Shell 输出和模型响应，会迅速变成高成本、高风险的数据湖。我会把 trace 分三档：

| 档位 | 默认内容 | 用途 |
|---|---|---|
| 基础 | ID、版本、状态、时长、token、hash、错误类 | 全量指标与 SLO |
| 诊断 | 脱敏摘要、关键参数、截断预览、artifact 引用 | 经授权的失败分析 |
| 深度 | 完整输入输出与环境快照 | 短期 debug、严格权限、自动过期 |

采样不能只随机。严重安全事件、baseline/candidate 分歧、新版本首次错误和长任务异常应优先保留；普通成功任务可以低比例采样。这样可观测性服务的是归因，而不是为了“什么都记下来”。

---
