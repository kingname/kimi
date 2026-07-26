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
  "https://github.com/kingname",
  "为什么模型公司仍然需要自己的 Harness",
  "Coding Agent 工程实践手册"
].filter((text) => !html.includes(text));
const leaked = forbidden.filter((text) => html.includes(text));
const markdownFiles = (await readdir(join(root, "content"))).filter((file) =>
  file.endsWith(".md")
);

if (markdownFiles.length < 8) {
  throw new Error(`Expected split Markdown content, found only ${markdownFiles.length} files.`);
}
if (missing.length) {
  throw new Error(`Missing expected content: ${missing.join(", ")}`);
}
if (leaked.length) {
  throw new Error(`Found removed positioning: ${leaked.join(", ")}`);
}

console.log(`Checks passed: ${markdownFiles.length} Markdown sources, static HTML, GitHub link, no Sites residue.`);
