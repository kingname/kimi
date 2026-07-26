import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: true,
  theme: "base",
  securityLevel: "strict",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  themeVariables: {
    background: "#0c100e",
    primaryColor: "#122319",
    primaryTextColor: "#e8f4ec",
    primaryBorderColor: "#42f58d",
    lineColor: "#62d993",
    secondaryColor: "#151a18",
    tertiaryColor: "#0f1512",
    clusterBkg: "#101713",
    clusterBorder: "#2c4636",
    edgeLabelBackground: "#0c100e",
    fontSize: "14px"
  }
});

const progressBar = document.querySelector("#reading-progress-bar");
const article = document.querySelector("#article");
const menuButton = document.querySelector("#menu-button");
const toc = document.querySelector("#toc");
const tocClose = document.querySelector("#toc-close");
const backdrop = document.querySelector("#toc-backdrop");

function updateProgress() {
  if (!article || !progressBar) return;
  const rect = article.getBoundingClientRect();
  const available = Math.max(1, article.offsetHeight - window.innerHeight);
  const progress = Math.min(1, Math.max(0, -rect.top / available));
  progressBar.style.transform = `scaleX(${progress})`;
}

function setMenu(open) {
  document.body.classList.toggle("toc-open", open);
  menuButton?.setAttribute("aria-expanded", String(open));
}

menuButton?.addEventListener("click", () => {
  setMenu(!document.body.classList.contains("toc-open"));
});
tocClose?.addEventListener("click", () => setMenu(false));
backdrop?.addEventListener("click", () => setMenu(false));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setMenu(false);
});

document.querySelectorAll(".toc-nav a").forEach((link) => {
  link.addEventListener("click", () => setMenu(false));
});

const linksById = new Map(
  [...document.querySelectorAll(".toc-nav a[href^='#']")].map((link) => [
    decodeURIComponent(link.hash.slice(1)),
    link
  ])
);

const observer = new IntersectionObserver(
  (entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (!visible.length) return;
    document.querySelectorAll(".toc-nav a.is-active").forEach((link) => {
      link.classList.remove("is-active");
    });
    linksById.get(visible[0].target.id)?.classList.add("is-active");
  },
  { rootMargin: "-12% 0px -76% 0px", threshold: [0, 1] }
);

document.querySelectorAll("#article h1[id], #article h2[id]").forEach((heading) => {
  observer.observe(heading);
});

document.querySelectorAll("pre:not(:has(.mermaid))").forEach((pre) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-code";
  button.textContent = "COPY";
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(pre.innerText);
    button.textContent = "COPIED";
    window.setTimeout(() => {
      button.textContent = "COPY";
    }, 1400);
  });
  pre.append(button);
});

window.addEventListener("scroll", updateProgress, { passive: true });
window.addEventListener("resize", updateProgress);
updateProgress();
