import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const base = "573c7aa9f93814a5dcfc77dad59598b6732bc9a7";
const manifestPath = "scripts/migrations-001-030.sha256.json";
const hash = (b) => createHash("sha256").update(b).digest("hex");
if (process.argv.includes("--record-base")) {
  const files = execFileSync(
    "git",
    ["ls-tree", "--name-only", base + ":supabase/migrations"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n");
  assert.equal(files.length, 30);
  const entries = Object.fromEntries(
    files.map((f) => [
      f,
      hash(
        execFileSync("git", ["show", `${base}:supabase/migrations/${f}`], {
          maxBuffer: 10 * 1024 * 1024,
        }),
      ),
    ]),
  );
  writeFileSync(
    manifestPath,
    JSON.stringify({ base, entries }, null, 2) + "\n",
  );
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.base, base);
assert.equal(Object.keys(manifest.entries).length, 30);
for (const [f, digest] of Object.entries(manifest.entries))
  assert.equal(
    hash(readFileSync("supabase/migrations/" + f)),
    digest,
    `Historical migration changed: ${f}`,
  );
const files = readdirSync("supabase/migrations").filter((f) =>
  f.endsWith(".sql"),
);
assert.equal(files.length, 31);
assert.equal(files.filter((f) => f.slice(8, 12) === "0031").length, 1);
console.log(
  JSON.stringify(
    {
      base,
      historical: "30/30 byte-identical",
      migration031: files
        .filter((f) => f.slice(8, 12) === "0031")
        .map((f) => ({
          file: f,
          sha256: hash(readFileSync("supabase/migrations/" + f)),
        })),
    },
    null,
    2,
  ),
);
