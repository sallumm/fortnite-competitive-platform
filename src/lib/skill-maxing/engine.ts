import {
  exerciseRelations,
  attachContext,
  historicalContext,
  type MetaSelection,
} from "../meta-training/context";
import type { MetaCatalog } from "../meta";
import { z } from "zod";
import settings from "../../data/skill-maxing-rules.json";
import { knowledge, purposeLabels } from "../training-research";
import { ownedPerformanceData, analyze } from "../intelligence";
import {
  dateInZone,
  expandCalendar,
  shiftDate,
  weekday,
  zonedInstant,
  conflicts,
} from "../calendar";
import {
  evolutionConfigSchema,
  timeSchema,
  timeMinutes,
  minutesTime,
  type EvolutionConfig,
} from "./config";
import { validatePlan } from "../training";
import type { Catalog, Plan, PlayerData } from "../types";
import type { Series } from "../performance-types";
const rulesSchema = z
  .object({
    version: z.string().max(60),
    max_steps: z.number().int().min(1).max(8),
    step_minimum: z.number().int().min(1).max(15),
    short_cap: z.number().int().min(1).max(60),
    slot_increment: z.number().int().min(1).max(30),
    recent_days: z.number().int().min(1).max(90),
    weights: z
      .object(
        Object.fromEntries(
          [
            "skill",
            "goal",
            "difficulty",
            "same_level",
            "baseline",
            "opposition",
            "purpose_variety",
            "recent_use",
          ].map((k) => [k, z.number().int().min(0).max(100)]),
        ),
      )
      .strict(),
  })
  .strict();
export const rules = rulesSchema.parse(settings);
export interface ProposedSession {
  id: string;
  date: string;
  time: string;
  plan: Plan;
  reasons: string[];
  skill_ids: string[];
}
export interface EvolutionProposal {
  from: string;
  weeks: number;
  config: EvolutionConfig;
  rules_version: string;
  sessions: ProposedSession[];
  warnings: string[];
  meta?: MetaSelection;
  practice_format?: Plan["practice_format"];
}
const validDate = (d: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(d) &&
  Number.isFinite(Date.parse(d + "T12:00:00Z")) &&
  new Date(d + "T12:00:00Z").toISOString().slice(0, 10) === d;
const multiplayerSkills = new Set([
  "duel",
  "duo",
  "box-fight",
  "realistic",
  "zone-wars",
  "scrims",
  "ranked",
]);
const difficultySkills: Record<string, string[]> = {
  tracking: ["tracking", "reactive-tracking"],
  accuracy: ["shotgun", "microcorrection", "zero-aim"],
  piece: ["piece-ownership", "prediction", "space"],
  editing: ["editing", "reset"],
  movement: ["movement", "zero-movement"],
  rotations: ["rotation", "zero-rotation"],
  endgame: ["moving-zone", "zone-wars", "zero-endgame"],
  decisions: ["information", "fight-selection"],
  box_fights: ["box-fight", "realistic"],
};
export function proposalSeries(proposal: EvolutionProposal): Series[] {
  const end = shiftDate(proposal.from, proposal.weeks * 7 - 1);
  return proposal.sessions.map((s) => ({
    id: s.id,
    user_id: s.plan.user_id,
    title: s.plan.title,
    kind: "training",
    plan_id: s.plan.id,
    timezone: proposal.config.timezone,
    local_time: s.time,
    start_date: s.date,
    end_date: end,
    weekdays: [weekday(s.date)],
    duration_minutes: s.plan.steps.reduce((n, st) => n + st.minutes, 0),
    tournament_id: proposal.config.tournament_id,
  }));
}
export function proposalOccurrences(
  proposal: EvolutionProposal,
  data: PlayerData,
) {
  return expandCalendar(
    {
      ...data,
      profile: data.profile
        ? { ...data.profile, timezone: proposal.config.timezone }
        : null,
      schedules: [],
      series: proposalSeries(proposal),
      exceptions: [],
      sessions: [],
      plans: proposal.sessions.map((s) => s.plan),
    },
    proposal.from,
    shiftDate(proposal.from, proposal.weeks * 7 - 1),
  );
}
export function proposalIssues(
  proposal: EvolutionProposal,
  data: PlayerData,
  catalog: Catalog,
  now = new Date(),
) {
  const errors: string[] = [];
  const parsed = evolutionConfigSchema.safeParse(proposal.config);
  if (!parsed.success) return parsed.error.issues.map((i) => i.message);
  if (
    !validDate(proposal.from) ||
    !Number.isInteger(proposal.weeks) ||
    proposal.weeks < 1 ||
    proposal.weeks > 4 ||
    weekday(proposal.from) !== 1
  )
    return ["Escolha uma segunda-feira e de uma a quatro semanas."];
  if (!proposal.sessions.length || proposal.sessions.length > 7)
    return ["Inclua de uma a sete sessões na semana."];
  if (
    new Set(proposal.sessions.map((s) => s.id)).size !==
      proposal.sessions.length ||
    new Set(proposal.sessions.map((s) => s.plan.id)).size !==
      proposal.sessions.length
  )
    errors.push("Identificadores de sessões e rotinas precisam ser únicos.");
  if (proposal.from > shiftDate(dateInZone(now, proposal.config.timezone), 366))
    return ["Planeje no máximo 366 dias à frente."];
  if (
    proposal.sessions.some(
      (s) => !validDate(s.date) || !timeSchema.safeParse(s.time).success,
    )
  )
    return ["Confira a data e horário de cada sessão."];
  const owner = data.profile?.id;
  const rows = expandCalendar(
    ownedPerformanceData(data),
    shiftDate(proposal.from, -2),
    shiftDate(proposal.from, proposal.weeks * 7 + 1),
  );
  for (const s of proposal.sessions) {
    if (
      proposal.practice_format &&
      s.plan.practice_format !== proposal.practice_format
    )
      errors.push(
        "O formato da sessão deve corresponder à configuração da prévia.",
      );
    if (
      proposal.meta &&
      (s.plan.meta_context_id !== proposal.meta.context_id ||
        JSON.stringify([...(s.plan.meta_entry_ids || [])].sort()) !==
          JSON.stringify([...proposal.meta.entry_ids].sort()))
    )
      errors.push(
        "O contexto da sessão mudou. Refaça a prévia antes de confirmar.",
      );
    errors.push(...validatePlan(s.plan, catalog.exercises));
    for (const step of s.plan.steps.filter((st) => !st.custom)) {
      const e = catalog.exercises.find((e) => e.id === step.exercise_id);
      if (
        !e?.published ||
        e.research?.review_status !== "verified" ||
        Date.parse(e.research.review_due_at) <= now.getTime() ||
        Date.parse(e.verified_at) > now.getTime()
      )
        errors.push("Um exercício precisa de verificação editorial atual.");
      if (
        (proposal.config.input === "controller" &&
          e?.tags?.includes("kbm-only")) ||
        (proposal.config.input === "kbm" &&
          e?.tags?.includes("controller-only"))
      )
        errors.push("Exercício incompatível com o dispositivo escolhido.");
    }
    if (
      s.plan.user_id !== owner ||
      s.plan.mode !== proposal.config.mode ||
      s.plan.level !== proposal.config.level
    )
      errors.push("Proprietário, modalidade ou nível da rotina inválidos.");
    if (s.date < proposal.from || s.date > shiftDate(proposal.from, 6))
      errors.push("A sessão precisa pertencer à primeira semana da proposta.");
  }
  if (
    new Set(proposal.sessions.map((s) => weekday(s.date))).size !==
    proposal.sessions.length
  )
    errors.push(
      "Esta proposta admite uma sessão por dia, com vários blocos na rotina.",
    );
  const proposed = proposalOccurrences(proposal, data);
  if (proposed.length !== proposal.sessions.length * proposal.weeks)
    errors.push(
      "Não foi possível representar todas as ocorrências no fuso escolhido.",
    );
  for (const o of proposed) {
    if (Date.parse(o.starts_at) < now.getTime())
      errors.push("A proposta contém uma ocorrência no passado.");
    const end = new Date(Date.parse(o.starts_at) + o.duration_minutes * 60000);
    const date = dateInZone(o.starts_at, proposal.config.timezone);
    const w = proposal.config.windows.some(
      (w) =>
        w.weekday === weekday(date) &&
        o.starts_at >= zonedInstant(date, w.start, proposal.config.timezone) &&
        end.toISOString() <=
          zonedInstant(date, w.end, proposal.config.timezone) &&
        o.duration_minutes <= w.minutes,
    );
    if (!w)
      errors.push(
        "Uma sessão ultrapassa a disponibilidade ou duração escolhida.",
      );
    for (const b of proposal.config.blocked.filter(
      (b) => b.weekday === weekday(date),
    ))
      if (
        Date.parse(zonedInstant(date, b.start, proposal.config.timezone)) <
          end.getTime() &&
        Date.parse(zonedInstant(date, b.end, proposal.config.timezone)) >
          Date.parse(o.starts_at)
      )
        errors.push("Uma sessão coincide com um compromisso reservado.");
    if (conflicts(o, [...rows, ...proposed]).length)
      errors.push("Há conflito na agenda. Ajuste a prévia antes de confirmar.");
  }
  if (proposal.config.tournament_id) {
    const t = catalog.tournaments.find(
      (t) =>
        t.id === proposal.config.tournament_id &&
        t.published &&
        t.confirmation === "confirmed" &&
        t.status === "scheduled" &&
        Date.parse(t.valid_until) > now.getTime() &&
        (t.mode === "both" || t.mode === proposal.config.mode),
    );
    if (!t)
      errors.push(
        "O campeonato precisa de confirmação atual e modalidade compatível.",
      );
    else if (
      proposed.some(
        (o) =>
          dateInZone(o.starts_at, proposal.config.timezone) >= t.start_date,
      )
    )
      errors.push(
        "Preparação proposta deve terminar antes da data confirmada do campeonato.",
      );
  }
  return [...new Set(errors)];
}
export function generateEvolution(
  config: EvolutionConfig,
  data: PlayerData,
  catalog: Catalog,
  from: string,
  weeks = 1,
  now = new Date(),
  meta?: { catalog: MetaCatalog; selection: MetaSelection },
  practiceFormat: NonNullable<Plan["practice_format"]> = "unspecified",
): EvolutionProposal {
  config = evolutionConfigSchema.parse(config);
  data = ownedPerformanceData(data);
  if (!data.profile) throw new Error("Entre em sua conta para planejar.");
  if (
    !validDate(from) ||
    weekday(from) !== 1 ||
    !Number.isInteger(weeks) ||
    weeks < 1 ||
    weeks > 4
  )
    throw new Error("Escolha uma segunda-feira e de uma a quatro semanas.");
  const warnings: string[] = [];
  if (["trio", "squad"].includes(practiceFormat))
    warnings.push(
      "Grupo de prática selecionado. O catálogo não confirma uma metodologia específica ou um torneio vigente neste tamanho; exercícios de Duplas devem ser adaptados manualmente, sem presumir equivalência de formato.",
    );
  const eligible = catalog.exercises.filter(
    (e) =>
      e.published &&
      (practiceFormat !== "solo" ||
        e.research?.purpose === "review" ||
        !e.research?.competency_ids.includes("duo")) &&
      (e.mode === "both" || e.mode === config.mode) &&
      e.research?.review_status === "verified" &&
      Date.parse(e.research.review_due_at) > now.getTime() &&
      Date.parse(e.verified_at) <= now.getTime() &&
      (config.level !== "beginner" || e.level !== "advanced") &&
      (config.competitive || e.research.purpose !== "competitive") &&
      (config.opposition !== "solo" ||
        e.research.purpose === "review" ||
        !e.research.competency_ids.some((id) => multiplayerSkills.has(id))) &&
      !(config.input === "controller" && e.tags?.includes("kbm-only")) &&
      !(config.input === "kbm" && e.tags?.includes("controller-only")),
  );
  const count = new Map<string, number>(),
    coverage = new Map<string, number>(),
    weekUses = new Map<string, number>();
  const recent = data.sessions.filter(
    (s) =>
      s.status === "completed" &&
      s.completed_at &&
      Date.parse(s.completed_at) <= now.getTime() &&
      Date.parse(s.completed_at) >= now.getTime() - rules.recent_days * 864e5,
  );
  for (const s of recent)
    for (const id of new Set(
      s.results.filter((r) => r.status !== "skipped").map((r) => r.exercise_id),
    ))
      count.set(id, (count.get(id) || 0) + 1);
  const difficult = new Set(
    data.journals
      .filter((j) => recent.some((s) => s.id === j.session_id))
      .flatMap((j) => j.difficulties.flatMap((d) => difficultySkills[d] || [])),
  );
  const goalIds = new Set(
    data.goals
      .filter((g) => !g.completed && (!g.status || g.status === "active"))
      .flatMap((g) => (g.measurement ? [g.measurement.exercise_id] : [])),
  );
  const proposal: EvolutionProposal = {
    from,
    weeks,
    config,
    rules_version: rules.version,
    sessions: [],
    warnings,
    meta: meta?.selection,
    practice_format: practiceFormat,
  };
  const unavailable = config.skills.filter(
    (s) => !eligible.some((e) => e.research?.competency_ids.includes(s.id)),
  );
  for (const s of unavailable)
    warnings.push(
      `Sem exercício verificado compatível para ${knowledge.competencies.find((k) => k.id === s.id)?.title || s.id}. A competência não será inventada.`,
    );
  for (let day = 0; day < 7; day++) {
    const date = shiftDate(from, day);
    const windows = config.windows
      .filter((w) => w.weekday === weekday(date))
      .sort((a, b) => a.start.localeCompare(b.start));
    if (!windows.length) continue;
    const priority = [...config.skills]
      .filter((s) => !unavailable.includes(s))
      .sort(
        (a, b) =>
          (coverage.get(a.id) || 0) / a.weight -
            (coverage.get(b.id) || 0) / b.weight ||
          b.weight - a.weight ||
          a.id.localeCompare(b.id),
      );
    const chosen: typeof eligible = [];
    const reasons: string[] = [];
    const purpose = new Set<string>();
    const windowBudget = Math.max(...windows.map((w) => w.minutes));
    const budget =
      config.style === "short"
        ? Math.min(rules.short_cap, windowBudget)
        : windowBudget;
    const maxSteps = Math.min(
      rules.max_steps,
      Math.max(1, Math.floor(budget / rules.step_minimum)),
    );
    for (const focus of priority) {
      if (chosen.length >= maxSteps) break;
      const candidates = eligible.filter(
        (e) =>
          !chosen.some((c) => c.id === e.id) &&
          e.research!.competency_ids.includes(focus.id) &&
          (config.style !== "review" || e.research!.purpose === "review"),
      );
      const scored = candidates
        .map((e) => {
          const w = rules.weights;
          const multi = e.research!.competency_ids.reduce(
            (n, id) =>
              n + (config.skills.find((s) => s.id === id)?.weight || 0),
            0,
          );
          const score =
            multi * w.skill +
            (["duo", "trio", "squad"].includes(practiceFormat) &&
            e.research!.competency_ids.includes("duo")
              ? w.opposition
              : 0) +
            (meta
              ? exerciseRelations(
                  meta.catalog,
                  e,
                  meta.selection.context_id,
                  now,
                ).filter((r) => meta.selection.entry_ids.includes(r.entry.id))
                  .length * w.goal
              : 0) +
            (goalIds.has(e.id) ? w.goal : 0) +
            (e.research!.competency_ids.some((id) => difficult.has(id))
              ? w.difficulty
              : 0) +
            (e.level === config.level ? w.same_level : 0) +
            (config.baseline && e.measurement ? w.baseline : 0) +
            (config.opposition !== "solo" &&
            ["contextual", "competitive"].includes(e.research!.purpose)
              ? w.opposition
              : 0) +
            (!purpose.has(e.research!.purpose) ? w.purpose_variety : 0) -
            (count.get(e.id) || 0) * w.recent_use -
            (weekUses.get(e.id) || 0) * w.skill;
          return { e, score };
        })
        .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id));
      const best = scored[0]?.e;
      if (!best) continue;
      chosen.push(best);
      purpose.add(best.research!.purpose);
      reasons.push(
        `${best.title}: relacionado a ${knowledge.competencies.find((k) => k.id === focus.id)?.title || focus.id} (importância ${focus.weight}/5); ${purposeLabels[best.research!.purpose]}. ${goalIds.has(best.id) ? "Relacionado a uma meta ativa. " : ""}${best.research!.competency_ids.some((id) => difficult.has(id)) ? "Há dificuldade autodeclarada relacionada no diário. " : ""}${count.get(best.id) || 0} sessões recentes registradas; frequência não mede domínio. ${best.level !== config.level ? "Nível editorial do exercício diferente do perfil: revise instruções e bases antes de executar. " : ""}${best.measurement ? `Métrica: ${best.metric}; mantenha cenário, dispositivo, sensibilidade, unidade e versão constantes.` : "Registre decisões e dificuldades observáveis."}`,
      );
    }
    if (!chosen.length) {
      warnings.push(
        `Sem proposta compatível para ${date}; ajuste competências ou tipo de sessão.`,
      );
      continue;
    }
    let placed = false;
    for (const window of windows) {
      const minutes =
        config.style === "short"
          ? Math.min(window.minutes, rules.short_cap)
          : window.minutes;
      for (
        let start = timeMinutes(window.start);
        start + minutes <= timeMinutes(window.end);
        start += rules.slot_increment
      ) {
        const base = Math.floor(minutes / chosen.length);
        if (base < 1) continue;
        const plan: Plan = {
          id: crypto.randomUUID(),
          user_id: data.profile.id,
          title: `Evolução · ${date}`,
          mode: config.mode,
          level: config.level,
          objective: config.objective,
          practice_format: practiceFormat,
          description: `Proposta editorial ${rules.version}. Tempo escolhido pelo usuário; sem promessa de evolução.`,
          steps: chosen.map((e, i) => ({
            id: crypto.randomUUID(),
            exercise_id: e.id,
            minutes:
              base +
              (i === chosen.length - 1 ? minutes - base * chosen.length : 0),
            block: purposeLabels[e.research!.purpose],
            notes: `Objetivo: ${e.research!.completion.slice(0, 600)} Dispositivo: ${config.input}. Registre conclusão manual e condições comparáveis.`,
          })),
        };
        if (meta)
          Object.assign(
            plan,
            attachContext(plan, meta.catalog, meta.selection, now),
          );
        const session = {
          id: crypto.randomUUID(),
          date,
          time: minutesTime(start),
          plan,
          reasons,
          skill_ids: [
            ...new Set(
              chosen.flatMap((e) =>
                e.research!.competency_ids.filter((id) =>
                  config.skills.some((s) => s.id === id),
                ),
              ),
            ),
          ],
        };
        const candidate = {
          ...proposal,
          sessions: [...proposal.sessions, session],
        };
        try {
          if (proposalIssues(candidate, data, catalog, now).length) continue;
        } catch {
          continue;
        }
        proposal.sessions.push(session);
        for (const e of chosen)
          weekUses.set(e.id, (weekUses.get(e.id) || 0) + 1);
        for (const id of session.skill_ids)
          coverage.set(id, (coverage.get(id) || 0) + 1);
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed)
      warnings.push(
        `Nenhum horário livre para ${date} em todas as semanas propostas. O dia ficou sem treino.`,
      );
  }
  if (config.opposition !== "mixed")
    warnings.push(
      `Preferência de prática: ${config.opposition === "solo" ? "sozinho" : config.opposition === "friends" ? "com amigos" : "contra adversários"}. A participação de outras pessoas depende de organização externa; não há matchmaking integrado.`,
    );
  if (config.baseline)
    warnings.push(
      "Avaliação inicial: registre uma tentativa com o protocolo do exercício e mantenha as condições nas próximas avaliações. O motor não cria uma nota universal de habilidade.",
    );
  if (config.difficulties.trim())
    warnings.push(
      "Sua dificuldade em texto livre será mantida para revisão humana; o motor não diagnostica causas a partir desse texto.",
    );
  for (const s of config.skills)
    if (!coverage.has(s.id) && !unavailable.some((x) => x.id === s.id))
      warnings.push(
        `A duração/disponibilidade não cobriu ${knowledge.competencies.find((k) => k.id === s.id)?.title || s.id}. Ajuste a prévia ou priorize em outra semana.`,
      );
  for (const session of proposal.sessions) {
    session.plan.practice_format = practiceFormat;
    session.reasons.push(
      `Formato de prática: ${practiceFormat}. É uma preferência de treinamento, não confirmação do formato ou meta de um torneio. Exercícios individuais permanecem úteis em preparação de equipe; escolha atividades conjuntas nas competências disponíveis.`,
    );
  }
  if (meta) {
    if (!meta.selection.entry_ids.length)
      proposal.warnings.push(
        "Sem informação atual verificada do meta neste contexto. As atividades propostas são fundamentos gerais.",
      );
    if (historicalContext(meta.catalog, meta.selection.context_id, now))
      proposal.warnings.push(
        "Contexto histórico selecionado: suas fontes não confirmam a versão mais recente do jogo.",
      );
    const mode = meta.catalog.modes.find(
      (m) =>
        m.id ===
        meta.catalog.contexts.find((c) => c.id === meta.selection.context_id)
          ?.mode_id,
    );
    if (!mode || mode.construction !== (config.mode === "build"))
      throw new Error("Modalidade incompatível com o contexto.");
    for (const session of proposal.sessions) {
      session.plan = attachContext(
        session.plan,
        meta.catalog,
        meta.selection,
        now,
      );
      for (const step of session.plan.steps) {
        const e = catalog.exercises.find((e) => e.id === step.exercise_id);
        const relations = e
          ? exerciseRelations(
              meta.catalog,
              e,
              meta.selection.context_id,
              now,
            ).filter((r) => meta.selection.entry_ids.includes(r.entry.id))
          : [];
        if (!relations.length)
          session.reasons.push(
            `${e?.title || "Atividade"}: fundamento geral; nenhuma relação atual verificada com o meta selecionado.`,
          );
        for (const r of relations)
          session.reasons.push(
            `${e!.title}: ${r.entry.title} (revisão ${r.entry.revision}); ${r.reason} Fonte: ${meta.catalog.sources
              .filter((s) => r.entry.source_ids.includes(s.id))
              .map((s) => s.url)
              .join(
                " ",
              )}. ${r.inherited ? "Vínculo herdado da edição anterior: reavaliar aplicação." : "Relação editorial, sem prova de melhoria."} ${r.entry.limitations}`,
          );
      }
    }
  }
  return proposal;
}
export function weeklyEvolutionReview(
  data: PlayerData,
  catalog: Catalog,
  from: string,
  to: string,
  now = new Date(),
) {
  const analysis = analyze(
    ownedPerformanceData(data),
    catalog.exercises,
    from,
    to,
    now,
  );
  return {
    completed: analysis.sessions.length,
    comparisons: analysis.comparisons,
    difficulties: analysis.diagnostics.filter((d) =>
      d.key.startsWith("difficulty:"),
    ),
    suggestions: analysis.diagnostics.filter(
      (d) =>
        d.kind === "recommendation" ||
        d.key.startsWith("difficulty:") ||
        d.key.startsWith("goal:") ||
        d.key === "missing" ||
        d.key === "pending",
    ),
    note: "Resultados são autodeclarados. Ajustes não aumentam automaticamente o volume; revise a disponibilidade e confirme uma nova proposta.",
  };
}
