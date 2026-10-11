import { z } from "zod";
const short = z.string().trim().min(1).max(120);
export const applicationSchema = z.object({
  nickname: short,
  epic_nick: short,
  mode: z.enum(["build", "zero"]),
  format: short,
  experience: short,
  objectives: z.string().trim().min(1).max(2000),
  availability: z.string().trim().min(1).max(2000),
  region: short,
  motivation: z.string().trim().min(1).max(2000),
  age_band: z.enum(["adult", "adolescent"]),
  links: z
    .array(
      z
        .string()
        .url()
        .max(500)
        .refine((s) => s.startsWith("https://"), "Use HTTPS"),
    )
    .max(5),
  accepted: z.literal(true),
  policy_version: short,
  rules_version: z.string(),
});
export const statusLabels: Record<string, string> = {
  submitted: "Recebida",
  under_review: "Em análise",
  trial_invited: "Convite para avaliação",
  trial_in_progress: "Avaliação em andamento",
  trial_completed: "Avaliação concluída",
  development_offered: "Bolsa oferecida",
  development_active: "Development ativo",
  academy_selected: "Selecionado para Academy",
  not_selected: "Não selecionado",
  withdrawn: "Participação retirada",
};
export const roleLabels: Record<string, string> = {
  applicant: "Candidato",
  trialist: "Trialist",
  development_scholar: "Bolsista Development",
  academy_player: "Jogador Academy",
  roster_player: "Jogador do elenco",
  esports_staff: "Avaliador de esports",
  esports_admin: "Administrador de esports",
};
export const nextStatuses: Record<string, string[]> = {
  submitted: ["under_review", "not_selected"],
  under_review: ["trial_invited", "not_selected"],
  trial_invited: ["trial_in_progress", "not_selected"],
  trial_in_progress: ["trial_completed", "not_selected"],
  trial_completed: ["not_selected", "trial_invited"],
  development_offered: ["not_selected"],
  development_active: ["not_selected"],
  not_selected: ["under_review"],
};
export type Cycle = {
  id: string;
  version: number;
  title: string;
  mode: "build" | "zero" | "both";
  format: string;
  criteria: string;
  rules: string;
  privacy_notice: string;
  policy_version: string;
  retention_days: number;
  starts_at: string;
  ends_at: string;
  published: boolean;
  is_open: boolean;
  allow_minors: boolean;
};
export type Settings = {
  version: number;
  recruitment_enabled: boolean;
  official_discord: string;
  introduction: string;
  trial_intro?: string;
  support_text: string;
};
export type Application = {
  id: string;
  user_id: string;
  cycle_id: string;
  version: number;
  status: string;
  payload: Omit<
    z.infer<typeof applicationSchema>,
    "accepted" | "policy_version" | "rules_version"
  >;
  created_at: string;
  updated_at: string;
  consent_snapshot: {
    policy_version: string;
    cycle_version: number;
    rules: string;
    privacy_notice: string;
    retention_days: number;
    accepted_at: string;
  };
};
export type RoleGrant = {
  id: string;
  user_id?: string;
  application_id: string | null;
  role: string;
  ends_at: string;
  revoked_at?: string | null;
  reason?: string;
  granted_by?: string;
};
export type StatusEvent = {
  id: string;
  application_id: string;
  status: string;
  message: string;
  created_at: string;
};
export type Portal = {
  settings: Settings;
  operational: boolean;
  cycles: Cycle[];
};
export type Workspace = {
  admin: boolean;
  staff: boolean;
  applications: Application[];
  roles: RoleGrant[];
  events: StatusEvent[];
  trial_intro: string | null;
};
export type AdminData = {
  settings: Settings | null;
  gate: { reviewed: boolean; minors_reviewed: boolean } | null;
  cycles: Cycle[];
  applications: Application[];
  reviews: {
    id: string;
    application_id: string;
    actor_id: string;
    kind: string;
    note: string;
    created_at: string;
  }[];
  audit: {
    id: number;
    actor_id: string;
    action: string;
    target_id: string;
    created_at: string;
    detail: unknown;
  }[];
  roles: RoleGrant[];
  users: { id: string; display_name: string }[];
};
export const closedPortal: Portal = {
  operational: false,
  cycles: [],
  settings: {
    version: 1,
    recruitment_enabled: false,
    official_discord: "",
    introduction: "Organização em desenvolvimento. Sem elenco anunciado.",
    support_text: "O acompanhamento ocorrerá dentro da kyrven.",
  },
};
export function cycleOpen(p: Portal, c: Cycle, now = Date.now()) {
  return (
    p.operational &&
    c.published &&
    c.is_open &&
    Date.parse(c.starts_at) <= now &&
    Date.parse(c.ends_at) > now
  );
}
