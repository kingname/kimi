# 推荐阅读

优先读官方资料和论文原文：

1. [Kimi Code GitHub](https://github.com/MoonshotAI/kimi-code)：公开代码、版本与项目边界。
2. [Kimi Code Changelog](https://moonshotai.github.io/kimi-code/en/release-notes/changelog.html)：从真实修复反推 Runtime、上下文与 provider 兼容问题。
3. [Sessions and context](https://moonshotai.github.io/kimi-code/en/guides/sessions.html)：session 持久化、每个 Agent 的事件流、恢复与 compaction。
4. [Built-in Tools](https://moonshotai.github.io/kimi-code/en/reference/tools.html)：工具契约、输出上限、后台任务与 approval。
5. [Agents and Sub-Agents](https://moonshotai.github.io/kimi-code/en/customization/agents.html)：能力配置、独立上下文、权限继承与任务编排。
6. [Hooks](https://moonshotai.github.io/kimi-code/en/customization/hooks)：生命周期扩展、阻断语义与 fail-open 边界。
7. [Kimi ACP](https://moonshotai.github.io/kimi-code/en/reference/kimi-acp.html)：IDE 接入、session 加载与协议能力。
8. [Kimi Agent SDK](https://github.com/MoonshotAI/kimi-agent-sdk)：复用 Kimi Code Runtime 的程序化 Agent 接口。
9. [Codex Documentation](https://developers.openai.com/codex/) 与 [openai/codex](https://github.com/openai/codex)：本地与云端入口、沙箱、扩展面和开放 Runtime。
10. [Claude Code Documentation](https://code.claude.com/docs/en/overview)：权限、Hooks、Subagent、Memory 与开发者工作流。
11. [TRAE Documentation](https://docs.trae.ai/ide/what-is-trae)：IDE、Agent、Subagent、上下文和 MCP。
12. [DeepSeek TUI 社区仓库](https://github.com/DeepSeek-TUI-app/DeepSeek-TUI)：第三方 DeepSeek-native Harness；阅读时应区分 README 声明与已验证实现。
13. [Model Context Protocol Specification](https://modelcontextprotocol.io/specification/2025-06-18)：生命周期、Tools、Resources、Prompts 与安全考虑。
14. [Building Effective Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents)：workflow、agent、orchestrator-worker、evaluator-optimizer 等模式。
15. [Demystifying evals for AI agents — Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)：Agent eval 方法。
16. [A Practical Guide to Building Agents — OpenAI](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)：工具、编排、guardrail 与人工介入。
17. [SWE-bench 论文](https://arxiv.org/abs/2310.06770)：真实 GitHub issue 评测的定义与局限。
18. [SWE-bench Pro](https://arxiv.org/abs/2509.16941)：长时软件工程任务与失败分析。
19. [ReAct](https://arxiv.org/abs/2210.03629)：Reasoning 与 Acting 交替的基础范式。
20. [Lost in the Middle](https://arxiv.org/abs/2307.03172)：长上下文中信息位置与利用问题。

阅读方法：每篇只回答四个问题——它解决什么、假设是什么、怎样评测、放进真实 Coding Agent 会在哪些边界失效。

---

# 结语

对我来说，Coding Agent 最值得长期投入的不是更多概念，而是反复完成下面这个闭环：

> 从真实失败中找到首次偏离，用最小实验区分模型与系统问题，把修复落到可恢复、可审计的工程机制，再用可靠评测证明它在新任务上也有效。

只有当这个闭环能落到具体架构、事故、数据和取舍上，Agent 才从一次漂亮的演示变成可信的软件系统。
