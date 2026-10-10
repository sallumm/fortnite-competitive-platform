import type { Skill } from "./performance-types";
export const vodCategories = {
  off_spawn: "Off-Spawn",
  fight_selection: "Seleção de fights",
  positioning: "Posicionamento",
  rotations: "Rotações",
  resources: "Controle de materiais e recursos",
  endgame: "Endgame",
  mechanics: "Mecânicas",
  decisions: "Decisões",
} as const;
export interface VodMarker {
  id: string;
  seconds: number;
  category: keyof typeof vodCategories;
  kind: "mistake" | "good" | "question";
  note: string;
  skills: Skill[];
}
export interface VodReview {
  meta_context_id?: string | null;
  meta_entry_ids?: string[];
  game_context?: import("./meta-training/context").GameContext | null;
  id: string;
  user_id: string;
  title: string;
  match_date: string;
  tournament_id: string | null;
  video_url: string;
  video_authorized: boolean;
  duration_seconds: number | null;
  exercise_ids: string[];
  skills: Skill[];
  notes: string;
  markers: VodMarker[];
  created_at: string;
  updated_at: string;
}
export interface GoalRevision {
  id: string;
  user_id: string;
  goal_id: string;
  before_value: import("./types").Goal | null;
  after_value: import("./types").Goal;
  created_at: string;
}
export interface Readiness {
  id: string;
  user_id: string;
  energy: number | null;
  focus: number | null;
  available_minutes: number;
  style: "light" | "habitual";
  created_at: string;
}
