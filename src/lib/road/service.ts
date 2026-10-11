import { supabase } from "../client";
import { assessmentResult } from "../academy";
import { demoStudy } from "../academy-service";
import { approvalPayload, confirmEvolution } from "../skill-maxing/service";
import type { EvolutionProposal } from "../skill-maxing/engine";
import {
  emptyRoad,
  roadConfigSchema,
  snapshotProgram,
  journeyRecords,
  type RoadConfig,
  type RoadData,
  type Journey,
  type RoadEvent,
} from "./domain";
import type { Catalog } from "../types";
const KEY = "clutchfolio-road-demo-v1",
  PLAYER = "clutchfolio-demo-v1",
  STUDY = "clutchfolio-academy-demo-v1";
function demoAccount() {
  const player = JSON.parse(localStorage.getItem(PLAYER) || "null");
  if (player?.profile?.id !== "demo")
    throw new Error("A demonstração precisa estar ativa.");
  return player;
}
function read(): RoadData {
  demoAccount();
  const d = JSON.parse(localStorage.getItem(KEY) || "null") || emptyRoad();
  if (
    !Array.isArray(d.journeys) ||
    !Array.isArray(d.events) ||
    !Array.isArray(d.batches) ||
    d.journeys.length > 1000 ||
    d.events.length > 10000 ||
    d.batches.length > 10000
  )
    throw new Error(
      "Os dados locais da jornada não puderam ser restaurados. Exporte seus dados antes de limpar a demonstração.",
    );
  for (const j of d.journeys) {
    roadConfigSchema.parse({
      config: j.config,
      experience: j.experience,
      familiarity: j.familiarity,
      start_date: j.start_date,
    });
    if (
      j.user_id !== "demo" ||
      !Array.isArray(j.snapshot?.lessons) ||
      j.snapshot.lessons.length > 100
    )
      throw new Error("Jornada local inválida.");
  }
  return d;
}
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase)
    throw new Error("Entre em sua conta para acompanhar a jornada.");
  const { data, error } = await supabase.rpc(name, args);
  if (error)
    throw new Error(
      "kyrven: " +
        (error.message.includes("limit")
          ? "Limite de registros atingido. Tente mais tarde."
          : error.message.includes("conflict")
            ? "Há um conflito de agenda. Revise a proposta; nada foi salvo."
            : error.message.includes("Availability")
              ? "Sua disponibilidade mudou. Refaça a prévia."
              : "Não foi possível salvar. Confira as informações, sua sessão e tente novamente."),
    );
  return data as T;
}
function localTransaction(updates: Record<string, string>) {
  const before = Object.fromEntries(
    Object.keys(updates).map((k) => [k, localStorage.getItem(k)]),
  );
  try {
    for (const [k, v] of Object.entries(updates)) localStorage.setItem(k, v);
  } catch (e) {
    for (const [k, v] of Object.entries(before))
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    throw e;
  }
}
export async function loadRoad(demo: boolean): Promise<RoadData> {
  if (demo) return read();
  if (!supabase) throw new Error("Entre em sua conta.");
  async function rows(table: string) {
    const all: unknown[] = [];
    for (let i = 0; i < 10000; i += 500) {
      const { data, error } = await supabase!
        .from(table)
        .select("*")
        .order("created_at")
        .order("id")
        .range(i, i + 499);
      if (error) throw new Error("Não foi possível consultar a jornada.");
      all.push(...(data || []));
      if (!data || data.length < 500) return all;
    }
    throw new Error("Limite de consulta atingido. Exporte seu histórico.");
  }
  const [journeys, events, batches] = await Promise.all([
    rows("learning_journeys"),
    rows("learning_journey_events"),
    rows("learning_journey_batches"),
  ]);
  return {
    journeys: journeys as Journey[],
    events: events as RoadEvent[],
    batches: batches as RoadData["batches"],
  };
}
export async function createRoad(
  demo: boolean,
  setup: RoadConfig,
  catalog: Catalog,
  token = crypto.randomUUID(),
) {
  setup = roadConfigSchema.parse(setup);
  if (!demo)
    return rpc<string>("create_learning_journey", {
      p_token: token,
      p_setup: setup,
    });
  const d = read();
  const existing = d.journeys.find((j) => j.id === token);
  if (existing) {
    if (
      JSON.stringify({
        config: existing.config,
        experience: existing.experience,
        familiarity: existing.familiarity,
        start_date: existing.start_date,
      }) !== JSON.stringify(setup)
    )
      throw new Error("Confirmação já utilizada.");
    return token;
  }
  if (
    d.journeys.filter((j) => Date.parse(j.created_at) > Date.now() - 86400000)
      .length >= 5
  )
    throw new Error("Limite de ciclos atingido.");
  if (d.journeys.some((j) => j.status !== "completed"))
    throw new Error("Conclua ou exclua o ciclo aberto antes de iniciar outro.");
  const snapshot = snapshotProgram(setup.config.mode, catalog);
  d.journeys.push({
    ...setup,
    id: token,
    user_id: "demo",
    program_id: snapshot.program.id,
    version: snapshot.program.version,
    status: "active",
    snapshot,
    created_at: new Date().toISOString(),
  });
  localTransaction({ [KEY]: JSON.stringify(d) });
  return token;
}
export async function updateRoad(
  demo: boolean,
  j: Journey,
  config: Journey["config"],
) {
  return updateValidated(demo, j, config);
}
async function updateValidated(
  demo: boolean,
  j: Journey,
  config: Journey["config"],
) {
  config = roadConfigSchema.parse({
    config,
    experience: j.experience,
    familiarity: j.familiarity,
    start_date: j.start_date,
  }).config;
  if (!demo)
    return rpc<void>("update_learning_journey", {
      p_journey: j.id,
      p_config: config,
      p_note:
        "Objetivo ou disponibilidade ajustados; agenda existente preservada.",
    });
  const d = read(),
    own = d.journeys.find((x) => x.id === j.id);
  if (!own || own.status === "completed" || own.config.mode !== config.mode)
    throw new Error("Jornada indisponível ou modalidade incompatível.");
  own.config = config;
  d.events.push({
    id: crypto.randomUUID(),
    user_id: "demo",
    journey_id: j.id,
    action: "preferences",
    lesson_id: null,
    answers: [],
    note: "Preferências ajustadas; agenda existente preservada.",
    created_at: new Date().toISOString(),
  });
  localTransaction({ [KEY]: JSON.stringify(d) });
}
export async function recordRoad(
  demo: boolean,
  j: Journey,
  action: Exclude<RoadEvent["action"], "preferences">,
  lesson: string | null = null,
  answers: number[] = [],
  note = "",
) {
  if (note.length > 1000)
    throw new Error("Use até 1.000 caracteres na observação.");
  if (!demo)
    return rpc<string>("record_learning_journey", {
      p_journey: j.id,
      p_action: action,
      p_lesson: lesson,
      p_answers: answers,
      p_note: note,
    });
  const d = read(),
    own = d.journeys.find((x) => x.id === j.id);
  if (!own || own.status === "completed")
    throw new Error("Jornada indisponível.");
  if (
    d.events.filter((e) => Date.parse(e.created_at) > Date.now() - 3600000)
      .length >= 120
  )
    throw new Error("Limite de registros atingido.");
  const statusAction = ["pause", "resume", "finish"].includes(action);
  if (statusAction) {
    if (
      lesson ||
      answers.length ||
      (action === "pause" && own.status !== "active") ||
      (action === "resume" && own.status !== "paused")
    )
      throw new Error("Transição inválida.");
    own.status =
      action === "pause"
        ? "paused"
        : action === "resume"
          ? "active"
          : "completed";
  } else {
    if (own.status !== "active")
      throw new Error("Retome a jornada antes de registrar.");
    const a = own.snapshot.lessons.find(
      (l) => l.article.id === lesson,
    )?.article;
    if (!a) throw new Error("Aula fora desta jornada.");
    if (action === "assessment")
      assessmentResult(a.academy_questions || [], answers);
    else if (answers.length) throw new Error("Respostas inesperadas.");
  }
  const event: RoadEvent = {
    id: crypto.randomUUID(),
    user_id: "demo",
    journey_id: j.id,
    action,
    lesson_id: lesson,
    answers,
    note,
    created_at: new Date().toISOString(),
  };
  d.events.push(event);
  const updates: Record<string, string> = { [KEY]: JSON.stringify(d) };
  if (!statusAction && action !== "skipped") {
    const study = demoStudy();
    const record = journeyRecords(own, [event])[0];
    study.records.push(record);
    updates[STUDY] = JSON.stringify(study);
  }
  localTransaction(updates);
  return event.id;
}
export async function confirmRoad(
  demo: boolean,
  j: Journey,
  stage: number,
  p: EvolutionProposal,
  token: string,
  catalog: Catalog,
) {
  if (p.weeks !== 1 || p.meta)
    throw new Error("A jornada agenda uma semana por prévia.");
  const payload = approvalPayload(p);
  if (!demo)
    return rpc<RoadData["batches"][number]["result"]>("confirm_learning_plan", {
      p_journey: j.id,
      p_stage: stage,
      p_token: token,
      p_from: p.from,
      p_config: p.config,
      p_sessions: payload.p_sessions,
      p_rules: p.rules_version,
      p_confirmation: "AGENDAR",
    });
  const d = read(),
    own = d.journeys.find((x) => x.id === j.id),
    batch = d.batches.find((b) => b.id === token);
  if (!own || (!batch && own.status !== "active"))
    throw new Error("Retome a jornada antes de agendar.");
  if (
    stage < 1 ||
    stage > 4 ||
    !Number.isInteger(stage) ||
    (batch && (batch.journey_id !== j.id || batch.stage !== stage))
  )
    throw new Error("Etapa ou confirmação inválida.");
  if (!batch)
    for (const k of [
      "mode",
      "level",
      "input",
      "timezone",
      "windows",
      "blocked",
    ] as const)
      if (JSON.stringify(p.config[k]) !== JSON.stringify(own.config[k]))
        throw new Error("Salve a disponibilidade e refaça a prévia.");
  const before = localStorage.getItem(PLAYER)!;
  try {
    const result = await confirmEvolution(true, token, p, catalog);
    if (!batch) {
      const player = demoAccount();
      player.plans = player.plans.map((plan: { id: string }) =>
        result.some((r) => r.plan_id === plan.id)
          ? { ...plan, learning_journey_id: j.id }
          : plan,
      );
      localStorage.setItem(PLAYER, JSON.stringify(player));
      d.batches.push({
        id: token,
        user_id: "demo",
        journey_id: j.id,
        stage,
        result,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(KEY, JSON.stringify(d));
    }
    return result;
  } catch (e) {
    localStorage.setItem(PLAYER, before);
    throw e;
  }
}
export async function deleteRoad(demo: boolean, j: Journey) {
  if (!demo)
    return rpc<void>("delete_learning_journey", {
      p_journey: j.id,
      p_confirmation: "EXCLUIR JORNADA",
    });
  const d = read();
  d.journeys = d.journeys.filter((x) => x.id !== j.id);
  d.events = d.events.filter((x) => x.journey_id !== j.id);
  d.batches = d.batches.filter((x) => x.journey_id !== j.id);
  localTransaction({ [KEY]: JSON.stringify(d) });
}
