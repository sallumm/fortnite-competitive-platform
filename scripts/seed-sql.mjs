import { historicalSeed } from "./historical-seed.mjs";

import { createServer } from "vite";
const loader = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, entries: [] },
  server: { middlewareMode: true, preTransformRequests: false },
  appType: "custom",
});
let seed;
try {
  ({ seed } = await loader.ssrLoadModule("/src/lib/seed.ts"));
} finally {
  await loader.close();
}
const quote = (v) =>
  v === null
    ? "null"
    : typeof v === "boolean"
      ? String(v)
      : "'" + String(v).replaceAll("'", "''") + "'";
const output = [
  "-- Curadoria inicial: fontes consultadas em 2026-10-10. Não é um feed automático.",
];
for (const table of ["exercises", "articles", "tournaments"])
  for (const row of seed[table]) {
    const keys = Object.keys(row);
    output.push(
      `insert into public.${table} (${keys.join(",")}) values (${keys.map((k) => quote(row[k])).join(",")}) on conflict(id) do nothing;`,
    );
  }
historicalSeed(
  "supabase/migrations/202610100002_seed.sql",
  output.join("\n") + "\n",
);
