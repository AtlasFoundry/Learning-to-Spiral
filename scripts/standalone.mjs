import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// Bundle the built entry into one file for direct, offline opening. Fail if a
// future change adds split chunks or external assets that need a bundler update.
const directory = resolve(import.meta.dirname, "../dist");
let html = await readFile(resolve(directory, "index.html"), "utf8");
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(
  /<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/,
);
if (!script || !stylesheet)
  throw new Error("Expected one built script and stylesheet.");
const localAsset = (path) => {
  if (!/^\/assets\/[a-zA-Z0-9_.-]+$/.test(path))
    throw new Error(`Unsupported asset path: ${path}`);
  return resolve(directory, path.slice(1));
};
const [javascript, css] = await Promise.all([
  readFile(localAsset(script[1]), "utf8"),
  readFile(localAsset(stylesheet[1]), "utf8"),
]);
if (
  /\bimport\s*(?:\(|["'{*])|\bfrom\s*["']\.\//.test(javascript) ||
  /(?:url\(|@import\b)/i.test(css)
) {
  throw new Error(
    "Standalone output requires embedded dependencies and styles.",
  );
}
html = html.replace(
  script[0],
  () =>
    `<script type="module">${javascript.replace(/<\/script/gi, "<\\/script")}</script>`,
);
html = html.replace(
  stylesheet[0],
  () => `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`,
);
if (/<script\b[^>]*\bsrc=|<link\b[^>]*\b(?:href|rel)="/i.test(html))
  throw new Error("Unembedded dependency in standalone output.");
await writeFile(resolve(directory, "Learning-to-Spiral.html"), html);
console.log("Standalone app created: dist/Learning-to-Spiral.html");
