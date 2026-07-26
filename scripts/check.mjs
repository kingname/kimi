import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "dist/index.html",
  "dist/assets/styles.css",
  "dist/assets/app.js",
  "dist/_headers",
  "wrangler.jsonc"
];

for (const file of required) {
  await access(join(root, file));
}

const html = await readFile(join(root, "dist/index.html"), "utf8");
const forbidden = ["面试宝典", "90 秒自我介绍", ".openai/hosting.json", "chatgpt.site"];
const missing = [
  "https://github.com/kingname/kimi",
  "模型公司为什么仍然需要自己的 Harness",
  "Coding Agent 工程实践手册"
].filter((text) => !html.includes(text));
const leaked = forbidden.filter((text) => html.includes(text));
const markdownFiles = (await readdir(join(root, "content"))).filter((file) =>
  file.endsWith(".md")
);
const chapterDirectories = await readdir(join(root, "dist", "chapters"));

if (markdownFiles.length < 8) {
  throw new Error(`Expected split Markdown content, found only ${markdownFiles.length} files.`);
}
if (chapterDirectories.length !== markdownFiles.length) {
  throw new Error(
    `Expected one page per Markdown file, found ${chapterDirectories.length} pages for ${markdownFiles.length} sources.`
  );
}

for (const chapter of chapterDirectories) {
  const chapterHtml = await readFile(
    join(root, "dist", "chapters", chapter, "index.html"),
    "utf8"
  );
  const chapterRequirements = [
    'class="chapter-pager"',
    'id="toc"',
    "Copyright © 2026 青南",
    "https://github.com/kingname/kimi"
  ];
  const chapterMissing = chapterRequirements.filter((text) => !chapterHtml.includes(text));
  if (chapterMissing.length) {
    throw new Error(`Chapter ${chapter} is missing: ${chapterMissing.join(", ")}`);
  }
}
if (missing.length) {
  throw new Error(`Missing expected content: ${missing.join(", ")}`);
}
if (leaked.length) {
  throw new Error(`Found removed positioning: ${leaked.join(", ")}`);
}

console.log(
  `Checks passed: landing page, ${chapterDirectories.length} chapter pages, GitHub link, no Sites residue.`
);
