# 推荐阅读

优先读官方资料和论文原文：

1. [Kimi Code GitHub](https://github.com/MoonshotAI/kimi-code)：公开架构、变更记录与真实工程边界。
2. [Kimi Code Documentation](https://moonshotai.github.io/kimi-code/)：产品、Agent、工具和配置。
3. [Kimi Agent SDK](https://github.com/MoonshotAI/kimi-agent-sdk)：从 Kimi Code 构建程序化 Agent 的接口。
4. [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18)：生命周期、Tools、Resources、Prompts 与安全考虑。
5. [Building Effective Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents)：workflow、agent、orchestrator-worker、evaluator-optimizer 等模式。
6. [Demystifying evals for AI agents — Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)：Agent eval 方法。
7. [A Practical Guide to Building Agents — OpenAI](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)：工具、编排、guardrail 与人工介入。
8. [SWE-bench 论文](https://arxiv.org/abs/2310.06770)：真实 GitHub issue 评测的定义与局限。
9. [SWE-bench Pro](https://arxiv.org/abs/2509.16941)：长时软件工程任务与失败分析。
10. [ReAct](https://arxiv.org/abs/2210.03629)：Reasoning 与 Acting 交替的基础范式。
11. [Lost in the Middle](https://arxiv.org/abs/2307.03172)：长上下文中信息位置与利用问题。

阅读方法：每篇只回答四个问题——它解决什么、假设是什么、怎样评测、放进真实 Coding Agent 会在哪些边界失效。

---

# 结语

对我来说，Coding Agent 最值得长期投入的不是更多概念，而是反复完成下面这个闭环：

> 从真实失败中找到首次偏离，用最小实验区分模型与系统问题，把修复落到可恢复、可审计的工程机制，再用可靠评测证明它在新任务上也有效。

只有当这个闭环能落到具体架构、事故、数据和取舍上，Agent 才从一次漂亮的演示变成可信的软件系统。
