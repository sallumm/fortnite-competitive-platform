import { it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

it("generates seed proposals without modifying any historical migration", () => {
  const manifest = JSON.parse(
    readFileSync("scripts/migrations-001-028.sha256.json", "utf8"),
  );
  const before = Object.keys(manifest).map((path) => readFileSync(path));
  for (const script of [
    "seed-sql",
    "training-seed",
    "research-seed",
    "mastery-seed",
    "meta-seed",
  ]) {
    const sql = execFileSync(process.execPath, [`scripts/${script}.mjs`], {
      encoding: "utf8",
    });
    expect(sql).toContain("insert into public.");
  }
  Object.keys(manifest).forEach((path, i) =>
    expect(readFileSync(path).equals(before[i])).toBe(true),
  );
});
