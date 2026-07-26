import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import GithubSlugger from "github-slugger";
import { marked } from "marked";

const root = fileURLToPath(new URL("../", import.meta.url));
const contentDir = join(root, "content");
const distDir = join(root, "dist");
const assetsDir = join(distDir, "assets");
const markdownDir = join(distDir, "markdown");
const slugger = new GithubSlugger();
const headings = [];

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, "").replaceAll("&amp;", "&").trim();
}

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
    const safeHref = escapeHtml(href);
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
    const external = /^https?:\/\//.test(href) ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${safeHref}"${titleAttr}${external}>${body}</a>`;
  }
};

marked.use({
  gfm: true,
  renderer
});

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
await mkdir(markdownDir, { recursive: true });

const files = (await readdir(contentDir))
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => a.localeCompare(b));

let wordLikeCount = 0;
const sections = [];

for (const [index, file] of files.entries()) {
  const raw = await readFile(join(contentDir, file), "utf8");
  wordLikeCount += (raw.match(/[\u3400-\u9fff]|[a-zA-Z0-9_]+/g) ?? []).length;
  const markdown = index === 0 ? raw.replace(/^# .+\n+/, "") : raw;
  const html = await marked.parse(markdown);
  sections.push(
    `<section class="doc-section" data-source="${escapeHtml(file)}">` +
      `<a class="source-link" href="/markdown/${encodeURIComponent(file)}">${escapeHtml(file)}</a>` +
      html +
      `</section>`
  );
  await cp(join(contentDir, file), join(markdownDir, file));
}

const toc = headings
  .map(
    ({ id, label, depth }) =>
      `<a href="#${id}" data-level="${depth}">${escapeHtml(label)}</a>`
  )
  .join("\n");

const template = await readFile(join(root, "src", "template.html"), "utf8");
const now = new Date();
const updatedIso = now.toISOString().slice(0, 10);
const updatedDisplay = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(now);
const readingTime = Math.max(1, Math.round(wordLikeCount / 500));

const html = template
  .replace("{{TOC}}", toc)
  .replace("{{CONTENT}}", sections.join("\n"))
  .replaceAll("{{UPDATED_ISO}}", updatedIso)
  .replaceAll("{{UPDATED_DISPLAY}}", updatedDisplay)
  .replaceAll("{{READING_TIME}}", String(readingTime));

await writeFile(join(distDir, "index.html"), html);
await writeFile(join(root, "index.html"), html);
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

console.log(`Built ${files.length} Markdown files into dist/ (${readingTime} min read).`);
