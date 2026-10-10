import { analyze, ownedPerformanceData } from "./intelligence";
import { dateInZone, shiftDate } from "./calendar";
import type { PlayerData, Exercise } from "./types";
export function reportEvidence(
  data: PlayerData,
  exercises: Exercise[],
  from: string,
  to: string,
) {
  data = ownedPerformanceData(data);
  const analysis = analyze(data, exercises, from, to);
  const tz = data.profile?.timezone || "UTC";
  const daily = [] as { date: string; sessions: number }[];
  for (let day = from; day <= to; day = shiftDate(day, 1))
    daily.push({
      date: day,
      sessions: analysis.sessions.filter(
        (s) => dateInZone(s.completed_at!, tz) === day,
      ).length,
    });
  return {
    diagnostics: analysis.diagnostics,
    comparisons: analysis.comparisons,
    daily,
    vodCount: data.vodReviews.filter(
      (r) =>
        r.match_date >= from &&
        r.match_date <= to &&
        r.match_date <= dateInZone(new Date(), tz),
    ).length,
    pending: analysis.pending.map((o) => ({
      title: o.title,
      starts_at: o.starts_at,
    })),
  };
}
export type ReportEvidenceData = ReturnType<typeof reportEvidence>;
