import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const manifest = JSON.parse(readFileSync("dist/.vite/manifest.json", "utf8"));
const seen = new Set();
function visit(key) {
  if (seen.has(key)) return;
  seen.add(key);
  for (const item of manifest[key]?.imports || []) visit(item);
}
visit("index.html");
const files = [...seen]
  .map((key) => manifest[key].file)
  .filter((file) => file.endsWith(".js"));
let bytes = 0,
  gzipBytes = 0;
for (const file of files) {
  const data = readFileSync("dist/" + file);
  bytes += data.length;
  gzipBytes += gzipSync(data).length;
}
console.info(
  JSON.stringify(
    {
      scope:
        "entry + static imports; excludes lazy routes, CSS and transport overhead",
      files,
      bytes,
      gzipBytes,
    },
    null,
    2,
  ),
);
