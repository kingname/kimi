import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const required = [
  "dist/index.html",
  "dist/_headers",
  "wrangler.jsonc"
];

for (const file of required) {
  await access(join(root, file));
}

const html = await readFile(join(root, "dist/index.html"), "utf8");
const assetFiles = await readdir(join(root, "dist", "assets"));
const stylesAsset = assetFiles.find((file) => /^styles-[a-f0-9]{12}\.css$/.test(file));
const appAsset = assetFiles.find((file) => /^app-[a-f0-9]{12}\.js$/.test(file));
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
if (!stylesAsset || !appAsset) {
  throw new Error(`Missing content-hashed assets: ${assetFiles.join(", ")}`);
}
if (!html.includes(`/assets/${stylesAsset}`) || !html.includes(`/assets/${appAsset}`)) {
  throw new Error("Landing page does not reference the generated content-hashed assets.");
}
if (chapterDirectories.length !== markdownFiles.length - 1) {
  throw new Error(
    `Expected preface on the landing page and one page per remaining Markdown file, found ${chapterDirectories.length} pages for ${markdownFiles.length} sources.`
  );
}
if (!html.includes("第二版做了什么改变") || !html.includes("这份笔记怎么读")) {
  throw new Error("Landing page is missing the preface content.");
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
