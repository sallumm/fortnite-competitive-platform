/** Removes product caches without touching authentication tokens or unrelated sites. */
export function clearLocalProductData(local: Storage, session: Storage) {
  for (const storage of [local, session]) {
    const keys = Array.from({ length: storage.length }, (_, index) =>
      storage.key(index),
    );
    for (const key of keys) {
      if (key?.startsWith("clutchfolio-") && key !== "clutchfolio-theme")
        storage.removeItem(key);
    }
  }
}

export interface SessionDraft {
  elapsed: number;
  since: number | null;
  done: boolean[];
  results: {
    exercise_id: string;
    value: number | null;
    note: string;
    configuration?: string;
  }[];
}
/** Local storage is untrusted and may contain an old or partially written draft. */
export function validSessionDraft(
  value: unknown,
  exerciseIds: string[],
): value is SessionDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as SessionDraft;
  return (
    Number.isFinite(draft.elapsed) &&
    draft.elapsed >= 0 &&
    (draft.since === null ||
      (Number.isFinite(draft.since) &&
        draft.since! > 0 &&
        draft.since! <= Date.now())) &&
    Array.isArray(draft.done) &&
    draft.done.length === exerciseIds.length &&
    draft.done.every((x) => typeof x === "boolean") &&
    Array.isArray(draft.results) &&
    draft.results.length === exerciseIds.length &&
    draft.results.every(
      (r, i) =>
        r &&
        r.exercise_id === exerciseIds[i] &&
        (r.value === null ||
          (Number.isFinite(r.value) && r.value >= 0 && r.value <= 1000000)) &&
        typeof r.note === "string" &&
        r.note.length <= 1000 &&
        (r.configuration === undefined ||
          (typeof r.configuration === "string" &&
            r.configuration.length <= 200)),
    )
  );
}
