import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import GithubSlugger from "github-slugger";
import { Marked } from "marked";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentDir = join(root, "content");
const distDir = join(root, "dist");
const assetsDir = join(distDir, "assets");
const markdownDir = join(distDir, "markdown");

const chapterMeta = {
  "00-preface.md": {
    slug: "preface",
    title: "写作缘起与方法",
    description: "为什么从一份 Agent Harness JD 出发，以及这份实践指南采用什么问题框架。"
  },
  "01-agent-runtime.md": {
    slug: "agent-runtime",
    title: "Agent Runtime：把模型决策变成可靠执行",
    description: "状态机、事务边界、终止条件、Planning，以及必须由 Runtime 守住的不变量。"
  },
  "02-tools-context.md": {
    slug: "tools-context",
    title: "工具系统与仓库级上下文",
    description: "工具契约、副作用、文件与 Shell，以及如何在真实仓库里选择高价值上下文。"
  },
  "03-safety-long-tasks.md": {
    slug: "safety-long-tasks",
    title: "安全边界、长任务与恢复",
    description: "权限、沙箱、事件日志、crash recovery、用户打断和长任务资源治理。"
  },
  "04-subagents-gateway.md": {
    slug: "subagents-gateway",
    title: "Subagent 调度与 Model Gateway",
    description: "什么时候并行才有价值，以及如何隔离上下文、权限、成本和 provider 差异。"
  },
  "05-evaluation-observability.md": {
    slug: "evaluation-observability",
    title: "Evaluation、Observability 与 Trace",
    description: "从真实失败构造评测，设计 grader，并用 trace 找到第一次关键偏离。"
  },
  "06-system-design-failures.md": {
    slug: "system-design-failures",
    title: "系统设计与故障分析",
    description: "终端 Agent、monorepo、远程沙箱和评测平台的设计，以及典型事故推演。"
  },
  "07-product-harness.md": {
    slug: "product-harness",
    title: "产品判断与自研 Harness",
    description: "已有成熟 Coding Agent 时，模型公司为什么仍然值得维护自己的 Harness。"
  },
  "08-engineering-notes.md": {
    slug: "engineering-notes",
    title: "工程问题与实现检查",
    description: "用于实现和设计审查的高密度索引，以及一个最小 Coding Agent 练习。"
  },
  "09-reading-list.md": {
    slug: "reading-list",
    title: "推荐阅读与结语",
    description: "继续研究 Coding Agent 系统工程时值得回到的官方资料、论文和项目。"
  }
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").trim();
}

function countReadingMinutes(markdown) {
  const units = markdown.match(/[\u3400-\u9fff]|[a-zA-Z0-9_]+/g) ?? [];
  return Math.max(1, Math.round(units.length / 500));
}

function renderMarkdown(markdown) {
  const slugger = new GithubSlugger();
  const headings = [];
  const renderer = {
    heading({ tokens, depth }) {
      const body = this.parser.parseInline(tokens);
      const label = stripHtml(body);
      const id = slugger.slug(label);
      if (depth <= 2) headings.push({ id, label, depth });
      return `<h${depth} id="${id}">${body}<a class="heading-anchor" href="#${id}" aria-label="链接到本节">#</a></h${depth}>\n`;
    },
    code({ text, lang }) {
      if (lang === "mermaid") {
        return `<div class="mermaid-wrap"><div class="mermaid">${escapeHtml(text)}</div></div>\n`;
      }
      const languageClass = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      return `<pre><code${languageClass}>${escapeHtml(text)}</code></pre>\n`;
    },
    link({ href, title, tokens }) {
      const body = this.parser.parseInline(tokens);
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const external = /^https?:\/\//.test(href) ? ' target="_blank" rel="noreferrer"' : "";
      return `<a href="${escapeHtml(href)}"${titleAttr}${external}>${body}</a>`;
    }
  };
  const parser = new Marked({ gfm: true, renderer });
  return { html: parser.parse(markdown), headings };
}

function renderToc(headings) {
  return headings
    .map(
      ({ id, label, depth }) =>
        `<a href="#${id}" data-level="${depth}">${escapeHtml(label)}</a>`
    )
    .join("\n");
}

function renderPagerLink(chapter, direction) {
  if (!chapter) {
    return `<a class="pager-link pager-home" href="/"><small>阅读完毕</small><span>返回全部章节</span></a>`;
  }
  const label = direction === "previous" ? "上一篇" : "下一篇";
  const arrow = direction === "previous" ? "← " : " →";
  const title = direction === "previous" ? `${arrow}${chapter.title}` : `${chapter.title}${arrow}`;
  return `<a class="pager-link pager-${direction}" href="/chapters/${chapter.slug}/"><small>${label}</small><span>${escapeHtml(title)}</span></a>`;
}

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
await mkdir(markdownDir, { recursive: true });

const files = (await readdir(contentDir))
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b));

const chapters = [];
for (const [index, file] of files.entries()) {
  const raw = await readFile(join(contentDir, file), "utf8");
  const meta = chapterMeta[file];
  if (!meta) throw new Error(`Missing chapter metadata for ${file}`);
  chapters.push({
    ...meta,
    file,
    number: String(index).padStart(2, "0"),
    markdown: raw,
    readingTime: countReadingMinutes(raw)
  });
  await cp(join(contentDir, file), join(markdownDir, file));
}

const now = new Date();
const updatedIso = now.toISOString().slice(0, 10);
const updatedDisplay = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(now);

const cards = chapters
  .map(
    (chapter) => `
      <a class="chapter-card" href="/chapters/${chapter.slug}/">
        <div class="chapter-card-top">
          <span>${chapter.number}</span>
          <small>${chapter.readingTime} MIN</small>
        </div>
        <h3>${escapeHtml(chapter.title)}</h3>
        <p>${escapeHtml(chapter.description)}</p>
        <div class="chapter-card-action">阅读本章 <span>→</span></div>
      </a>`
  )
  .join("\n");

const homeTemplate = await readFile(join(root, "src", "template.html"), "utf8");
const homeHtml = homeTemplate
  .replace("{{CHAPTER_CARDS}}", cards)
  .replaceAll("{{CHAPTER_COUNT}}", String(chapters.length))
  .replaceAll("{{UPDATED_ISO}}", updatedIso)
  .replace(/[ \t]+$/gm, "");

await writeFile(join(distDir, "index.html"), homeHtml);
await writeFile(join(root, "index.html"), homeHtml);

const chapterTemplate = await readFile(join(root, "src", "chapter-template.html"), "utf8");
for (const [index, chapter] of chapters.entries()) {
  const bodyMarkdown = chapter.markdown.replace(/^# .+\n+/, "");
  const { html: content, headings } = renderMarkdown(bodyMarkdown);
  const outputDir = join(distDir, "chapters", chapter.slug);
  await mkdir(outputDir, { recursive: true });
  const html = chapterTemplate
    .replace("{{CONTENT}}", content)
    .replace("{{TOC}}", renderToc(headings))
    .replace("{{PREVIOUS_LINK}}", renderPagerLink(chapters[index - 1], "previous"))
    .replace("{{NEXT_LINK}}", renderPagerLink(chapters[index + 1], "next"))
    .replaceAll("{{TITLE}}", escapeHtml(chapter.title))
    .replaceAll("{{DESCRIPTION}}", escapeHtml(chapter.description))
    .replaceAll("{{CHAPTER_NUMBER}}", chapter.number)
    .replaceAll("{{READING_TIME}}", String(chapter.readingTime))
    .replaceAll("{{SOURCE_FILE}}", escapeHtml(chapter.file))
    .replaceAll("{{UPDATED_ISO}}", updatedIso)
    .replaceAll("{{UPDATED_DISPLAY}}", updatedDisplay)
    .replace(/[ \t]+$/gm, "");
  await writeFile(join(outputDir, "index.html"), html);
}

await cp(join(root, "src", "styles.css"), join(assetsDir, "styles.css"));
await cp(join(root, "public", "_headers"), join(distDir, "_headers"));

await build({
  entryPoints: [join(root, "src", "app.js")],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["es2022"],
  outfile: join(assetsDir, "app.js")
});

console.log(`Built landing page and ${chapters.length} chapter pages into dist/.`);
