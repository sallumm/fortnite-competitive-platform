import { esportsRPC } from "./service";
export const benefitLabels: Record<string, string> = {
  development_workspace: "Espaço privado de desenvolvimento",
  materials: "Materiais de aprendizagem indicados",
  plan_tools: "Ferramentas de planejamento existentes",
  periodic_review: "Revisões periódicas do programa",
  human_feedback: "Feedback humano na disponibilidade informada",
};
export type Scholarship = {
  id: string;
  application_id: string;
  user_id: string;
  version: number;
  status: "offered" | "accepted" | "declined" | "revoked" | "ended";
  title: string;
  terms: string;
  benefits: string[];
  human_availability: string;
  starts_at: string;
  ends_at: string;
  accepted_at: string | null;
  created_at: string;
};
export type Goal = {
  id: string;
  scholarship_id: string;
  version: number;
  title: string;
  description: string;
  kind: "study" | "exercise" | "vod" | "review" | "activity";
  due_at: string | null;
  route: string;
  state: "planned" | "in_progress" | "completed";
  learner_note: string;
};
export type DevelopmentReview = {
  id: string;
  scholarship_id: string;
  shared_feedback: string;
  internal_note?: string;
  next_step: string;
  created_at: string;
  reviewer_id?: string;
};
export type DevelopmentData = {
  admin: boolean;
  scholarships: Scholarship[];
  goals: Goal[];
  reviews: DevelopmentReview[];
  benefits: {
    capability: string;
    scholarship_id: string;
    ends_at: string;
    source: "scholarship";
  }[];
  erasure_requests: { user_id: string; requested_at: string }[];
};
export const loadDevelopment = () =>
  esportsRPC<DevelopmentData>("esports_development");
export const loadDevelopmentAdmin = () =>
  esportsRPC<DevelopmentData>("esports_development", { p_admin: true });
export const developmentAction = (
  action: string,
  id: string | null,
  expected: number,
  payload: unknown,
) =>
  esportsRPC<Record<string, unknown>>("esports_development_action", {
    p_action: action,
    p_id: id,
    p_expected: expected,
    p_payload: payload,
  });
export function downloadEsports(data: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
