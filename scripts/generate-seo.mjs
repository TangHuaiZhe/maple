import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = path.join(repoRoot, "dist");
const catalogPath = path.join(repoRoot, "public", "data", "catalog.json");
const siteUrl = (process.env.VITE_SITE_URL || "https://maple-684e2.web.app").replace(/\/$/, "");
let activeSiteUrl = siteUrl;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summarize(value, maxLength = 170) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function absoluteUrl(value) {
  if (!value) return "";
  return new URL(value, `${activeSiteUrl}/`).toString();
}

function pageHead({ title, description, pathname, image = "", type = "website" }) {
  const canonical = absoluteUrl(pathname);
  const imageTag = image ? `\n    <meta property="og:image" content="${escapeHtml(absoluteUrl(image))}" />` : "";
  return `    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="${type}" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />${imageTag}
    <meta name="twitter:card" content="summary_large_image" />`;
}

function replaceSeoTags(html, metadata) {
  const head = pageHead(metadata);
  return html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(metadata.title)}</title>`)
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(metadata.description)}" />`)
    .replace("<!-- seo:generated -->", head);
}

function fallbackMarkup(record) {
  const name = record.display_name || record.canonical_name || record.id;
  const scientificName = record.scientific_name || record.canonical_name || "";
  const description = summarize(record.preferred_description, 420);
  const image = record.cover_path ? `<img src="${escapeHtml(record.cover_path)}" alt="${escapeHtml(`${name} 日本枫树品种`)}" />` : "";
  return `<main class="seo-fallback">
      <article>
        <h1>${escapeHtml(name)}${record.chinese_name ? `（${escapeHtml(record.chinese_name)}）` : ""}</h1>
        ${scientificName ? `<p><em>${escapeHtml(scientificName)}</em></p>` : ""}
        ${record.top_category || record.web_group ? `<p>${escapeHtml([record.top_category, record.web_group].filter(Boolean).join(" · "))}</p>` : ""}
        ${image}
        ${description ? `<p>${escapeHtml(description)}</p>` : ""}
        <p><a href="/catalog">浏览全部日本枫树品种</a></p>
      </article>
    </main>`;
}

function staticPageMarkup({ title, description, heading, body }) {
  return `<main class="seo-fallback"><article><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(body || description)}</p></article></main>`;
}

async function writePage(html, relativeDirectory, metadata, markup) {
  const output = replaceSeoTags(html, metadata).replace('<div id="root"></div>', `<div id="root">${markup}</div>`);
  const target = path.join(distRoot, relativeDirectory, "index.html");
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output, "utf8");
}

function xmlEscape(value) {
  return escapeHtml(value);
}

export async function generateSeoFiles({ root = repoRoot, output = distRoot, baseUrl = siteUrl } = {}) {
  const indexPath = path.join(output, "index.html");
  const catalogFile = path.join(root, "public", "data", "catalog.json");
  const [indexHtml, catalogRaw] = await Promise.all([fs.readFile(indexPath, "utf8"), fs.readFile(catalogFile, "utf8")]);
  const catalog = JSON.parse(catalogRaw);
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const originalSiteUrl = activeSiteUrl;
  activeSiteUrl = normalizedBaseUrl;

  const homeMetadata = {
    title: "日本枫树品种百科｜580+ 品种、养护与图片",
    description: "收录 580+ 日本枫树与槭树品种，提供中英文名称、叶色、株形、养护信息、图片与来源。",
    pathname: "/",
  };
  await fs.writeFile(indexPath, replaceSeoTags(indexHtml, homeMetadata), "utf8");

  const routePages = [
    {
      directory: "catalog",
      metadata: { title: "日本枫树品种目录｜按名称、叶色与株形浏览", description: "浏览日本枫树与槭树品种目录，支持中英文及拼音搜索。", pathname: "/catalog" },
      heading: "日本枫树品种目录",
    },
    {
      directory: "rhs-awards",
      metadata: { title: "RHS 获奖日本枫树品种｜皇家园艺学会推荐", description: "浏览英国皇家园艺学会推荐的日本枫树品种及其图片和养护信息。", pathname: "/rhs-awards" },
      heading: "RHS 获奖日本枫树品种",
    },
  ];
  await Promise.all(routePages.map(({ directory, metadata, heading }) => writePage(
    indexHtml,
    directory,
    metadata,
    staticPageMarkup({ ...metadata, heading }),
  )));

  await Promise.all(catalog.map((record) => {
    const name = record.display_name || record.canonical_name || record.id;
    const chineseName = record.chinese_name ? `（${record.chinese_name}）` : "";
    const title = `${name}${chineseName}｜日本枫树品种百科`;
    const description = summarize(record.preferred_description)
      || `${name}${chineseName}的叶色、株形、图片与养护信息。`;
    return writePage(indexHtml, path.join("cultivar", record.id), {
      title,
      description,
      pathname: `/cultivar/${record.id}`,
      image: record.cover_path || "",
      type: "article",
    }, fallbackMarkup(record));
  }));

  const urls = ["/", "/catalog", "/rhs-awards", ...catalog.map((record) => `/cultivar/${record.id}`)];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${xmlEscape(new URL(url, `${normalizedBaseUrl}/`).toString())}</loc></url>`).join("\n")}\n</urlset>\n`;
  await fs.writeFile(path.join(output, "sitemap.xml"), sitemap, "utf8");
  await fs.writeFile(path.join(output, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${normalizedBaseUrl}/sitemap.xml\n`, "utf8");

  activeSiteUrl = originalSiteUrl;
  return { cultivarCount: catalog.length, sitemapCount: urls.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  generateSeoFiles()
    .then(({ cultivarCount, sitemapCount }) => {
      console.log(`Generated SEO files for ${cultivarCount} cultivars (${sitemapCount} sitemap URLs).`);
    })
    .catch((error) => {
      console.error(error.message || error);
      process.exitCode = 1;
    });
}
