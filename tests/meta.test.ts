import { expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import raw from "../src/data/meta-knowledge.json";
import {
  compareMeta,
  latestMeta,
  metaEntrySchema,
  metaSourceSchema,
  metaStatus,
  metaWriteIssues,
  relatedMetaLinks,
  retrieveMeta,
  type MetaCatalog,
} from "../src/lib/meta";
const c = raw as MetaCatalog,
  now = new Date("2026-10-10T23:00:00Z");
it("validates verified corpus and additive migration reproducibility", () => {
  for (const s of c.sources)
    expect(metaSourceSchema.safeParse(s).success, s.id).toBe(true);
  for (const e of c.entries) {
    expect(metaEntrySchema.safeParse(e).success, e.id).toBe(true);
    expect(
      metaWriteIssues(
        e,
        { ...c, entries: c.entries.filter((x) => x.id !== e.id) },
        now,
      ),
    ).toEqual([]);
  }
  expect(new Set(c.entries.map((e) => e.id)).size).toBe(c.entries.length);
  execFileSync("node", ["scripts/meta-seed.mjs", "--check"]);
});
it("expires review deadlines, distinguishes versions and future verification", () => {
  const e = c.entries[0];
  expect(metaStatus(e, "a", "b", now)).toBe("stale");
  expect(metaStatus(e, "a", "a", new Date("2026-11-01"))).toBe("stale");
  expect(
    metaStatus({ ...e, verified_at: "2026-10-11T00:00:00Z" }, "a", "a", now),
  ).toBe("unconfirmed");
  expect(metaStatus({ ...e, state: "archived" }, "a", "b", now)).toBe(
    "archived",
  );
});
it("never falls back from event to casual or infers absence from missing records", () => {
  expect(retrieveMeta(c, "Bonerattler", "victory-br", now)).toEqual([]);
  expect(retrieveMeta(c, "Bonerattler", "br-4230", now)).toHaveLength(1);
  expect(retrieveMeta(c, "", "unknown", now)).toEqual([]);
  const difference = compareMeta(c, "br-4200", "br-4230", now).find(
    (x) => x.key === "tetris-rift",
  );
  expect(difference?.before?.availability).toBe("available");
  expect(difference?.after?.availability).toBe("vaulted");
  expect(
    compareMeta(c, "br-4200", "br-4230", now).find(
      (x) => x.key === "sonic-sneakers",
    )?.after,
  ).toBeUndefined();
});
it("rejects metadata evidence, invalid actions and stale revision chains", () => {
  const e = c.entries[0];
  expect(
    metaWriteIssues(
      { ...e, source_ids: ["video-mechanics"] },
      { ...c, entries: [] },
      now,
    ).join(),
  ).toContain("insuficiente");
  expect(
    metaEntrySchema.safeParse({ ...e, review_due: e.verified_at }).success,
  ).toBe(false);
  expect(
    metaEntrySchema.safeParse({ ...e, private_user_id: "someone" }).success,
  ).toBe(false);
  expect(metaWriteIssues(e, c, now).join()).toContain("Histórico mudou");
});
it("preserves revisions and excludes future records from current retrieval", () => {
  const e = c.entries[0],
    newer = { ...e, id: "revision-two", revision: 2, previous_id: e.id };
  expect(latestMeta([e, newer], now)).toEqual([newer]);
  expect(
    latestMeta([e, { ...newer, valid_from: "2026-10-12T00:00:00Z" }], now),
  ).toEqual([e]);
  const refs = retrieveMeta(c, "", "br-4230", now, 100);
  expect(refs).toHaveLength(4);
  expect(refs.every((x) => x.trust === "reference-data-only")).toBe(true);
});

it("inherits training relations without altering historical snapshots", () => {
  const e = c.entries[0];
  const newer = { ...e, id: "revision-three", revision: 2, previous_id: e.id };
  const updated = { ...c, entries: [...c.entries, newer] };
  expect(relatedMetaLinks(updated, newer)).toEqual(
    c.links.filter((l) => l.entry_id === e.id),
  );
  expect(c.entries.find((x) => x.id === e.id)?.revision).toBe(1);
});
