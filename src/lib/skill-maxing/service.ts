import { loadMeta } from "../meta-service";
import { attachContext } from "../meta-training/context";
import { supabase } from "../client";
import { normalizePlayer } from "../performance-types";
import type { Catalog, PlayerData } from "../types";
import { evolutionConfigSchema, type EvolutionConfig } from "./config";
import {
  proposalIssues,
  proposalSeries,
  type EvolutionProposal,
} from "./engine";
export interface EvolutionReceipt {
  id: string;
  payload: string;
  result: { plan_id: string; series_id: string }[];
}
export interface EvolutionState {
  config: EvolutionConfig;
  receipts: EvolutionReceipt[];
}
const KEY = "clutchfolio-demo-v1";
function demoData(): PlayerData {
  const d = JSON.parse(localStorage.getItem(KEY) || "null");
  if (d?.profile?.id !== "demo")
    throw new Error("A demonstração precisa estar ativa.");
  return normalizePlayer(d);
}
const failure = (message: string) =>
  message.includes("conflict")
    ? "Sua agenda mudou ou há um conflito. Revise a prévia; nenhuma alteração foi salva."
    : message.includes("availability") || message.includes("commitment")
      ? "A proposta ultrapassa a disponibilidade ou um compromisso. Ajuste os horários."
      : message.includes("verification")
        ? "Um exercício ou campeonato precisa de nova verificação editorial."
        : message.includes("limit")
          ? "Limite de confirmações atingido. Tente novamente mais tarde."
          : "Não foi possível salvar a proposta. Confira a sessão e tente novamente.";
export async function loadEvolutionConfig(
  demo: boolean,
): Promise<EvolutionConfig | null> {
  if (demo) {
    const c = demoData().evolution?.config;
    return c ? evolutionConfigSchema.parse(c) : null;
  }
  if (!supabase) throw new Error("Entre em sua conta.");
  const { data, error } = await supabase
    .from("evolution_settings")
    .select("config")
    .maybeSingle();
  if (error)
    throw new Error(
      "Não foi possível consultar suas preferências de evolução.",
    );
  return data ? evolutionConfigSchema.parse(data.config) : null;
}
export async function saveEvolutionConfig(
  demo: boolean,
  config: EvolutionConfig,
) {
  config = evolutionConfigSchema.parse(config);
  if (demo) {
    const d = demoData();
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...d,
        evolution: {
          ...d.evolution,
          config,
          receipts: d.evolution?.receipts || [],
        },
      }),
    );
    return;
  }
  if (!supabase) throw new Error("Entre em sua conta.");
  const { error } = await supabase.rpc("save_evolution_config", {
    p_config: config,
  });
  if (error) throw new Error("kyrven: " + failure(error.message));
}
export function approvalPayload(proposal: EvolutionProposal) {
  return {
    p_from: proposal.from,
    p_weeks: proposal.weeks,
    p_config: proposal.config,
    p_rules: proposal.rules_version,
    p_sessions: proposal.sessions.map((s) => ({
      date: s.date,
      time: s.time,
      plan: {
        title: s.plan.title,
        steps: s.plan.steps.map((st) => {
          const { exercise, ...clean } = st;
          void exercise;
          return clean;
        }),
        mode: s.plan.mode,
        level: s.plan.level,
        description: s.plan.description || "",
        objective: s.plan.objective || "",
      },
    })),
  };
}
export async function confirmEvolution(
  demo: boolean,
  token: string,
  proposal: EvolutionProposal,
  catalog: Catalog,
) {
  const contextual = !!proposal.meta || !!proposal.practice_format;
  const payload = {
    ...approvalPayload(proposal),
    ...(contextual
      ? {
          p_context: proposal.meta?.context_id || null,
          p_entries: proposal.meta?.entry_ids || [],
          p_practice_format: proposal.practice_format || "unspecified",
        }
      : {}),
  };
  if (demo) {
    const d = demoData(),
      receipt = d.evolution?.receipts.find((r) => r.id === token);
    if (receipt) {
      if (receipt.payload !== JSON.stringify(payload))
        throw new Error("A confirmação já foi utilizada por outra prévia.");
      return receipt.result;
    }
    const errors = proposalIssues(proposal, d, catalog);
    if (errors.length) throw new Error(errors.join(" "));
    if (proposal.meta) {
      const meta = await loadMeta(true);
      proposal = {
        ...proposal,
        sessions: proposal.sessions.map((s) => ({
          ...s,
          plan: attachContext(s.plan, meta, proposal.meta!),
        })),
      };
    }
    const series = proposalSeries(proposal);
    const result = series.map((r) => ({
      plan_id: r.plan_id!,
      series_id: r.id,
    }));
    // One write commits configuration, routines, schedule and receipt together in demo mode.
    const next: PlayerData = {
      ...d,
      plans: [...d.plans, ...proposal.sessions.map((s) => s.plan)],
      series: [...d.series, ...series],
      evolution: {
        config: proposal.config,
        receipts: [
          ...(d.evolution?.receipts || []),
          { id: token, payload: JSON.stringify(payload), result },
        ],
      },
    };
    localStorage.setItem(KEY, JSON.stringify(next));
    return result;
  }
  if (!supabase) throw new Error("Entre em sua conta.");
  const { data, error } = await supabase.rpc(
    contextual ? "confirm_meta_evolution_plan" : "confirm_evolution_plan",
    {
      p_token: token,
      ...payload,
    },
  );
  if (error) throw new Error("kyrven: " + failure(error.message));
  return data as { plan_id: string; series_id: string }[];
}
