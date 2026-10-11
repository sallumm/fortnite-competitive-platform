import type { Exercise } from "./types";

export function reviewPending(e: Exercise, now = Date.now()) {
  return (
    !e.research ||
    e.research.review_status !== "verified" ||
    !Number.isFinite(Date.parse(e.research.review_due_at)) ||
    Date.parse(e.research.review_due_at) <= now ||
    !Number.isFinite(Date.parse(e.verified_at)) ||
    Date.parse(e.verified_at) > now
  );
}
