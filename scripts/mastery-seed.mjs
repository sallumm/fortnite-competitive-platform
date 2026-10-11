import { historicalSeed } from "./historical-seed.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const lessons = JSON.parse(
  readFileSync("src/data/mastery-lessons.json", "utf8"),
);
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const columns = Object.keys(lessons[0]);
const sql =
  "-- Original editorial curriculum; additive seed, existing rows are never overwritten.\n" +
  lessons
    .map(
      (a) =>
        "insert into public.articles(" +
        columns.join(",") +
        ") values(" +
        columns
          .map((k) => {
            const v = a[k];
            if (k === "tags")
              return "array[" + v.map(quote).join(",") + "]::text[]";
            return v === null
              ? "null"
              : typeof v === "boolean"
                ? String(v)
                : quote(typeof v === "object" ? JSON.stringify(v) : v) +
                  (k === "curriculum"
                    ? "::jsonb"
                    : k === "tags"
                      ? "::jsonb"
                      : "");
          })
          .join(",") +
        ") on conflict do nothing;",
    )
    .join("\n") +
  "\n";
const path = "supabase/migrations/202610100013_mastery_seed.sql";
historicalSeed(path, sql);
