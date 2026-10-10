import { z } from "zod";
import { supabase } from "../client";
import type { GameContext } from "./context";
export const preferencesSchema = z.object({
  primary_mode: z.string().regex(/^[a-z0-9-]{2,100}$/),
  secondary_modes: z
    .array(z.string().regex(/^[a-z0-9-]{2,100}$/))
    .max(8)
    .refine((a) => new Set(a).size === a.length),
  format: z.string().regex(/^[a-z0-9-]{2,100}$/),
  meta_context_id: z.string().nullable(),
  team_preference: z.enum(["individual", "team", "mixed"]),
});
export type CompetitivePreferences = z.infer<typeof preferencesSchema>;
export interface StudyNote {
  id: string;
  user_id: string;
  entry_id: string;
  favorite: boolean;
  note: string;
  updated_at: string;
}
export interface Team {
  id: string;
  owner_id: string;
  title: string;
  capacity: number;
}
export interface TeamMember {
  team_id: string;
  user_id: string;
  alias: string;
}
export interface TeamSession {
  id: string;
  team_id: string;
  author_id: string;
  title: string;
  objective: string;
  starts_at: string;
  duration_minutes: number;
  exercise_ids: string[];
  game_context: GameContext | null;
  status: "planned" | "cancelled";
}
export interface Participation {
  session_id: string;
  user_id: string;
  status: "accepted" | "declined" | "completed" | "interrupted";
  notes: string;
}
export interface TeamResource {
  id: string;
  team_id: string;
  author_id: string;
  kind: "goal" | "vod" | "note";
  title: string;
  body: string;
  video_url: string;
  game_context: GameContext | null;
}
export interface TeamData {
  teams: Team[];
  members: TeamMember[];
  sessions: TeamSession[];
  participation: Participation[];
  resources: TeamResource[];
  invites: {
    id: string;
    team_id: string;
    expires_at: string;
    revoked: boolean;
    used_by: string | null;
  }[];
}
export const emptyTeams = (): TeamData => ({
  teams: [],
  members: [],
  sessions: [],
  participation: [],
  resources: [],
  invites: [],
});
const demoKey = "clutchfolio-meta-training-demo:";
export async function loadCompetitivePreferences(
  demo: boolean,
  owner: string,
): Promise<CompetitivePreferences | null> {
  if (demo) {
    const row = JSON.parse(
      localStorage.getItem(demoKey + owner + ":preferences") || "null",
    );
    return row ? preferencesSchema.parse(row) : null;
  }
  if (!supabase) throw new Error("kyrven: Entre em sua conta.");
  const { data, error } = await supabase
    .from("competitive_preferences")
    .select("*")
    .eq("id", owner)
    .maybeSingle();
  if (error)
    throw new Error(
      "kyrven: Não foi possível consultar seu perfil competitivo.",
    );
  return data?.primary_mode && data?.format
    ? preferencesSchema.parse(data)
    : null;
}
export async function saveCompetitivePreferences(
  demo: boolean,
  owner: string,
  input: CompetitivePreferences,
) {
  const p = preferencesSchema.parse(input);
  if (demo) {
    localStorage.setItem(demoKey + owner + ":preferences", JSON.stringify(p));
    return;
  }
  if (!supabase) throw new Error("kyrven: Entre em sua conta.");
  const { error } = await supabase
    .from("competitive_preferences")
    .upsert({ id: owner, ...p });
  if (error)
    throw new Error(
      "kyrven: Não foi possível salvar suas preferências competitivas.",
    );
}
export async function studyNotes(
  demo: boolean,
  owner: string,
): Promise<StudyNote[]> {
  if (demo)
    return JSON.parse(localStorage.getItem(demoKey + owner + ":notes") || "[]");
  if (!supabase) throw new Error("kyrven: Entre em sua conta.");
  const { data, error } = await supabase
    .from("meta_study_notes")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error("kyrven: Não foi possível consultar suas notas.");
  return data || [];
}
export async function saveStudyNote(
  demo: boolean,
  owner: string,
  row: StudyNote,
) {
  z.object({
    id: z.uuid(),
    user_id: z.literal(owner),
    entry_id: z.string().regex(/^[a-z0-9-]{2,100}$/),
    favorite: z.boolean(),
    note: z.string().max(4000),
  }).parse(row);
  if (demo) {
    const rows = await studyNotes(true, owner);
    localStorage.setItem(
      demoKey + owner + ":notes",
      JSON.stringify([...rows.filter((n) => n.id !== row.id), row]),
    );
    return;
  }
  if (!supabase) throw new Error("kyrven: Entre em sua conta.");
  const { error } = await supabase.from("meta_study_notes").upsert(row);
  if (error) throw new Error("kyrven: Não foi possível salvar a nota privada.");
}
export async function teamRpc(name: string, args: Record<string, unknown>) {
  if (!supabase) throw new Error("kyrven: Equipes exigem contas autenticadas.");
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw new Error(
      /conflict/i.test(error.message)
        ? "kyrven: Há conflito de agenda. Nenhum detalhe privado de outro integrante é compartilhado."
        : /limit|capacity/i.test(error.message)
          ? "kyrven: Limite de integrantes ou operações atingido."
          : /expired|used|invitation/i.test(error.message)
            ? "kyrven: Convite expirado, utilizado ou revogado."
            : "kyrven: Não foi possível concluir. Confira o aceite, as permissões e os parâmetros.",
    );
  return data;
}
export async function loadTeams(): Promise<TeamData> {
  if (!supabase) throw new Error("kyrven: Equipes exigem contas autenticadas.");
  const result = await Promise.all(
    [
      "teams",
      "members",
      "sessions",
      "participation",
      "resources",
      "invites",
    ].map(async (key) => {
      const table =
        key === "members"
          ? "training_team_members"
          : key === "teams"
            ? "training_teams"
            : "training_team_" + key;
      const rows: unknown[] = [];
      for (let offset = 0; offset < 5000; offset += 500) {
        let request = supabase!
          .from(table)
          .select(
            key === "invites" ? "id,team_id,expires_at,revoked,used_by" : "*",
          )
          .order(
            key === "members"
              ? "team_id"
              : key === "participation"
                ? "session_id"
                : "id",
          );
        if (key === "members" || key === "participation")
          request = request.order("user_id");
        const { data, error } = await request.range(offset, offset + 499);
        if (error)
          throw new Error("kyrven: Não foi possível consultar suas equipes.");
        rows.push(...(data || []));
        if ((data?.length || 0) < 500) return [key, rows];
      }
      throw new Error(
        "Refine a consulta de equipes; os dados excedem o limite.",
      );
    }),
  );
  return Object.fromEntries(result) as unknown as TeamData;
}
