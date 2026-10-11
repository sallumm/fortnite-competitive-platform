import { readFileSync } from "node:fs";

// Historical migrations are immutable. Review generated SQL and create a new
// incremental migration explicitly; never rewrite an already applied seed.
export function historicalSeed(path, sql) {
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8").replace(/\r\n/g, "\n") !== sql)
      throw new Error(
        `Historical seed differs: ${path}. Create an incremental migration.`,
      );
  } else {
    process.stdout.write(sql);
  }
}
