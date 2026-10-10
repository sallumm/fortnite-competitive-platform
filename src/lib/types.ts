import type { VodReview, GoalRevision, Readiness } from "./intelligence-types";
import type {
  Series,
  Exception,
  Journal,
  SkillReview,
  PlanningPreference,
  WeeklyReport,
} from "./performance-types";
export type Mode = "build" | "zero";
export type Level = "beginner" | "intermediate" | "advanced";
export type Category =
  | "aim"
  | "mechanics"
  | "piece"
  | "competitive"
  | "decisions"
  | "vod"
  | "wellbeing";
export interface Profile {
  id: string;
  display_name: string;
  mode: Mode;
  level: Level;
  objective: Category;
  minutes: number;
  input: "kbm" | "controller";
  timezone: string;
  onboarded: boolean;
  reminder_enabled: boolean;
}
export interface Exercise {
  research?: import("./training-research-validation").ExerciseResearch | null;
  video_url?: string | null;
  categories?: string[];
  tags?: string[];
  measurement?: {
    unit: string;
    min: number;
    max: number;
    direction: "higher" | "lower";
    procedure: string;
    version: string;
  };
  skills?: string[];
  competitive_goal?: string;
  map_type?: string;
  requirements?: string;
  id: string;
  title: string;
  creator: string;
  map_code: string | null;
  category: Category;
  mode: Mode | "both";
  level: Level;
  description: string;
  instructions: string;
  metric: string;
  source_url: string;
  verified_at: string;
  published: boolean;
}
export interface Step {
  id?: string;
  block?: string;
  notes?: string;
  repetitions?: number;
  resource_url?: string;
  custom?: Exercise;
  exercise_id: string;
  minutes: number;
  exercise?: Exercise;
}
export interface Plan {
  practice_format?: "solo" | "duo" | "trio" | "squad" | "unspecified" | null;
  meta_context_id?: string | null;
  meta_entry_ids?: string[];
  game_context?: import("./meta-training/context").GameContext | null;
  description?: string;
  objective?: string;
  mode?: Mode | "both";
  level?: Level;
  favorite?: boolean;
  archived?: boolean;
  id: string;
  user_id: string;
  title: string;
  steps: Step[];
}
export interface Schedule {
  id: string;
  user_id: string;
  plan_id: string | null;
  title?: string;
  kind?: "training" | "personal" | "rest";
  duration_minutes?: number;
  status?: "planned" | "cancelled" | "done";
  starts_at: string;
  tournament_id: string | null;
}
export interface Result {
  step_id?: string;
  status?: "completed" | "skipped";
  unit?: string;
  version?: string;
  conditions?: {
    scenario: string;
    device: string;
    sensitivity: string;
    test_seconds: number | null;
  };
  exercise_id: string;
  value: number | null;
  note: string;
  configuration?: string;
}
export interface Training {
  plan_snapshot?: Pick<
    Plan,
    | "title"
    | "description"
    | "objective"
    | "mode"
    | "level"
    | "game_context"
    | "practice_format"
  >;
  checkpoint?: import("./local-data").SessionDraft | null;
  checkpoint_version?: number;
  result_revision?: number;
  schedule_id?: string | null;
  series_id?: string | null;
  occurrence_date?: string | null;
  id: string;
  user_id: string;
  plan_id: string | null;
  title: string;
  steps: Step[];
  started_at: string;
  completed_at: string | null;
  duration_seconds: number;
  results: Result[];
  status: "active" | "completed" | "abandoned";
  xp: number;
}
export interface Goal {
  status?: "active" | "paused" | "completed" | "archived";
  criteria?: string;
  skill?: import("./performance-types").Skill | null;
  exercise_ids?: string[];
  due_date?: string | null;
  measurement?: {
    exercise_id: string;
    unit: string;
    version: string;
    baseline: number;
    desired: number;
    configuration: string;
    deadline?: string;
  } | null;
  id: string;
  user_id: string;
  title: string;
  target: number;
  completed: boolean;
}
export interface Xp {
  id: string;
  user_id: string;
  session_id: string;
  amount: number;
  created_at: string;
}
export interface TournamentPhase {
  key: string;
  title: string;
  kind: "registration" | "qualifier" | "session" | "final";
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  status: "scheduled" | "finished" | "postponed" | "cancelled";
  source_url: string;
  verified_at: string;
  valid_until: string;
}
export interface Tournament {
  confirmation?: "confirmed" | "unconfirmed";
  season_label?: string;
  phases?: TournamentPhase[];
  result_summary?: string | null;
  result_source_url?: string | null;
  result_verified_at?: string | null;
  id: string;
  slug: string;
  title: string;
  category: string;
  mode: Mode | "both";
  region: string;
  format: string;
  start_date: string;
  end_date: string;
  starts_at: string | null;
  ends_at: string | null;
  status: "scheduled" | "finished" | "postponed" | "cancelled";
  description: string;
  rules: string;
  prize: string;
  source_url: string;
  verified_at: string;
  valid_until: string;
  published: boolean;
}
export interface Article {
  academy_questions?: import("./academy").Question[];
  curriculum?: import("./curriculum").Curriculum | null;
  topic?: string;
  tags?: string[];
  evidence?: "official" | "analysis" | "opinion";
  source_published_at?: string | null;
  id: string;
  slug: string;
  title: string;
  kind: "news" | "analysis" | "lesson";
  category: Category | "fncs";
  summary: string;
  body: string;
  author: string;
  source_url: string;
  verified_at: string;
  published_at: string;
  valid_until: string | null;
  published: boolean;
}
export interface Bookmark {
  id: string;
  user_id: string;
  kind: "exercise" | "tournament";
  target_id: string;
}
export interface Catalog {
  exercises: Exercise[];
  tournaments: Tournament[];
  articles: Article[];
}
export interface PlayerData {
  evolution?: import("./skill-maxing/service").EvolutionState;
  profile: Profile | null;
  plans: Plan[];
  schedules: Schedule[];
  sessions: Training[];
  goals: Goal[];
  xp: Xp[];
  bookmarks: Bookmark[];
  series: Series[];
  exceptions: Exception[];
  journals: Journal[];
  skillReviews: SkillReview[];
  planningPreferences: PlanningPreference[];
  weeklyReports: WeeklyReport[];
  vodReviews: VodReview[];
  goalRevisions: GoalRevision[];
  readiness: Readiness[];
}
export const labels: Record<string, string> = {
  build: "Construção",
  zero: "Zero Build",
  both: "Todas",
  beginner: "Iniciante",
  intermediate: "Intermediário",
  advanced: "Avançado",
  aim: "Mira",
  mechanics: "Mecânicas",
  piece: "Piece Control",
  competitive: "Prática competitiva",
  decisions: "Noção de Jogo",
  vod: "VOD Review",
  wellbeing: "Bem-estar",
  fncs: "FNCS",
  kbm: "Teclado e mouse",
  controller: "Controle",
};
