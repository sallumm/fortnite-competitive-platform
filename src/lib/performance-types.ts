import type { Category, PlayerData } from "./types";
export const skills = {
  aim: "Aim",
  tracking: "Tracking",
  shotgun: "Shotgun accuracy",
  building: "Building",
  editing: "Editing",
  piece: "Piece control",
  movement: "Movement",
  decisions: "Game sense",
  rotations: "Rotations",
  endgame: "Endgame",
  vod: "VOD analysis",
} as const;
export type Skill = keyof typeof skills;
export const difficulties = {
  tracking: "Tracking",
  accuracy: "Precisão",
  editing: "Edição",
  piece: "Piece control",
  movement: "Movimentação",
  rotations: "Rotações",
  endgame: "Endgame",
  decisions: "Decisões",
  box_fights: "Box fights",
  focus: "Concentração",
  time: "Gestão do tempo",
} as const;
export type Difficulty = keyof typeof difficulties;
export type ActivityKind = "training" | "personal" | "rest";
export interface Series {
  id: string;
  user_id: string;
  title: string;
  kind: ActivityKind;
  plan_id: string | null;
  timezone: string;
  local_time: string;
  start_date: string;
  end_date: string | null;
  weekdays: number[];
  duration_minutes: number;
  tournament_id: string | null;
}
export interface Exception {
  id: string;
  user_id: string;
  series_id: string;
  occurrence_date: string;
  starts_at: string | null;
  duration_minutes: number | null;
  title: string | null;
  status: "planned" | "cancelled" | "done";
}
export interface Journal {
  id: string;
  user_id: string;
  session_id: string;
  practiced: string;
  improved: string;
  difficult: string;
  next_focus: string;
  difficulties: Difficulty[];
}
export interface SkillReview {
  id: string;
  user_id: string;
  skill: Skill;
  goal: string;
  note: string;
  assessment: "unassessed" | "needs_practice" | "developing" | "comfortable";
  created_at: string;
}
export interface PlanningPreference {
  id: string;
  user_id: string;
  weekdays: number[];
  local_time: string;
  minutes: number;
  focuses: Category[];
}
export interface WeeklyReport {
  id: string;
  user_id: string;
  week_start: string;
  timezone: string;
  generated_at: string;
  summary: ReportSummary;
}
export interface ReportSummary {
  from: string;
  to: string;
  completed: number;
  minutes: number;
  planned: number;
  adhered: number;
  estimated: number;
  practiceDays: number;
  previousCompleted: number;
  difficulties: { key: Difficulty; count: number }[];
  observations: string[];
  suggestions: string[];
  goals: { title: string; completed: boolean }[];
}
export interface Occurrence {
  key: string;
  schedule_id: string | null;
  series_id: string | null;
  occurrence_date: string;
  starts_at: string;
  duration_minutes: number;
  title: string;
  kind: ActivityKind;
  plan_id: string | null;
  tournament_id: string | null;
  status: "planned" | "cancelled" | "done";
  session_id: string | null;
}
export function normalizePlayer(data: Partial<PlayerData>): PlayerData {
  const result = {
    profile: null,
    plans: [],
    schedules: [],
    sessions: [],
    goals: [],
    xp: [],
    bookmarks: [],
    series: [],
    exceptions: [],
    journals: [],
    skillReviews: [],
    planningPreferences: [],
    weeklyReports: [],
    ...data,
  };
  for (const key of [
    "plans",
    "schedules",
    "sessions",
    "goals",
    "xp",
    "bookmarks",
    "series",
    "exceptions",
    "journals",
    "skillReviews",
    "planningPreferences",
    "weeklyReports",
  ] as const)
    if (!Array.isArray(result[key]))
      (result as unknown as Record<string, unknown>)[key] = [];
  return result;
}
