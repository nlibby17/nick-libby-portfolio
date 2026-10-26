// Builds the Stock Comparison demo window into
// public/demo/stock-comparison/. Adapted from the app repo's
// own frontend/build.mjs: same esbuild settings, same entry.
// The THIRD_PARTY_NOTICES step is kept so the shipped bundle
// carries the same dependency notices as the real dashboard.
import { build } from "esbuild";
import { writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "public", "demo", "stock-comparison");
await mkdir(out, { recursive: true });

const lock = JSON.parse(await readFile(join(here, "package-lock.json"), "utf8"));
const notices = [];
for (const [path, pkg] of Object.entries(lock.packages)) {
  if (!path || pkg.dev || !path.startsWith("node_modules/")) continue;
  const directory = join(here, path);
  const files = (await readdir(directory))
    .filter((name) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(name))
    .sort();
  if (!files.length) throw new Error("Missing dependency license: " + path);
  notices.push(path.replace(/^node_modules\//, "") + " @ " + pkg.version);
  for (const name of files)
    notices.push(await readFile(join(directory, name), "utf8"));
}
await writeFile(join(out, "THIRD_PARTY_NOTICES.txt"), notices.join("\n\n---\n\n"));

await build({
  entryPoints: [join(here, "src", "app.jsx")],
  bundle: true,
  minify: true,
  sourcemap: false,
  legalComments: "external",
  target: ["chrome100", "safari15"],
  outfile: join(out, "app.js"),
  define: { "process.env.NODE_ENV": '"production"' },
});

await writeFile(
  join(out, "index.html"),
  `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Stock Research Assistant — Stock Comparison (demo)</title>
<link rel="stylesheet" href="app.css">
<style>
  /* Demo window adaptations (host page only; the app's own
     stylesheets are unmodified): with the side navigation
     removed, main no longer needs the 124px rail offset. */
  main { padding-left: 44px; }
  @media (max-width: 760px) {
    main { padding: 22px 16px 24px; }
  }
</style>
</head>
<body>
<div id="root"></div>
<script type="module" src="app.js"></script>
</body>
</html>
`,
);
console.log("demo window built into", out);
