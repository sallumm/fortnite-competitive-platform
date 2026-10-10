import { it, expect } from "vitest";
import { seed, demoPlayer, uid } from "../src/lib/seed";
import { competitiveSeed } from "../src/lib/competitive-seed";
import {
  phaseSchema,
  tournamentSchema,
  articleSchema,
  exerciseSchema,
} from "../src/lib/validation";
import {
  phaseICS,
  currentEvent,
  usablePhase,
  recentArticles,
  relatedArticles,
  agendaConflicts,
  preparationExercises,
} from "../src/lib/competitive";
import { eventStatus } from "../src/lib/logic";
import { dateInZone } from "../src/lib/calendar";
import { demoAnswer, defaults } from "../src/lib/coach";
const event = competitiveSeed.tournaments[0],
  now = new Date("2026-10-10T13:00:00Z");
it("novos conteúdos validados têm fontes HTTPS e códigos sem duplicação", () => {
  for (const x of competitiveSeed.tournaments)
    expect(tournamentSchema.safeParse(x).success).toBe(true);
  for (const x of competitiveSeed.articles)
    expect(articleSchema.safeParse(x).success).toBe(true);
  for (const x of competitiveSeed.exercises)
    expect(exerciseSchema.safeParse(x).success).toBe(true);
  for (const e of competitiveSeed.exercises)
    expect(
      seed.exercises.filter((x) => x.map_code === e.map_code),
    ).toHaveLength(1);
});
it("exporta fase sem horário como dia inteiro, com fim exclusivo e UID estável", () => {
  const p = event.phases![6],
    ics = phaseICS(event, p);
  expect(ics).toContain("DTSTART;VALUE=DATE:20261010");
  expect(ics).toContain("DTEND;VALUE=DATE:20261011");
  expect(ics).toContain(event.id + "-" + p.key + "@clutchfolio");
  expect(ics).not.toContain("DTSTART:");
});
it("ICS usa UTC, escapa conteúdo e dobra linhas UTF-8 no limite RFC5545", () => {
  const p = {
    ...event.phases![6],
    starts_at: "2026-10-10T23:30:00-03:00",
    ends_at: "2026-10-11T01:00:00-03:00",
    title: "Edição, revisão; " + "ç".repeat(150),
  };
  const ics = phaseICS(event, p);
  expect(ics).toContain("DTSTART:20261011T023000Z");
  expect(ics).toContain("DTEND:20261011T040000Z");
  for (const line of ics.split("\r\n"))
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  expect(dateInZone(p.starts_at, "America/Sao_Paulo")).toBe("2026-10-10");
});
it("não exibe live para fonte expirada, cancelamento, concluído ou não confirmado", () => {
  const t = {
    ...event,
    starts_at: "2026-10-10T12:00:00Z",
    ends_at: "2026-10-10T16:00:00Z",
  };
  expect(eventStatus(t, now)).toBe("live");
  expect(eventStatus({ ...t, confirmation: "unconfirmed" }, now)).not.toBe(
    "live",
  );
  expect(
    eventStatus({ ...t, valid_until: "2026-10-09T00:00:00Z" }, now),
  ).not.toBe("live");
  expect(eventStatus({ ...t, status: "finished" }, now)).toBe("finished");
  expect(eventStatus({ ...t, status: "cancelled" }, now)).toBe("cancelled");
  expect(currentEvent({ ...t, confirmation: "unconfirmed" }, now)).toBe(false);
  expect(
    usablePhase(event, { ...event.phases![6], status: "cancelled" }, now),
  ).toBe(false);
});
it("fontes obrigatórias, fases duplicadas e intervalos sem fuso são rejeitados", () => {
  const phase = event.phases![0];
  expect(phaseSchema.safeParse({ ...phase, source_url: "" }).success).toBe(
    false,
  );
  expect(
    phaseSchema.safeParse({
      ...phase,
      starts_at: "2026-10-10T18:00:00",
      ends_at: "2026-10-10T20:00:00",
    }).success,
  ).toBe(false);
  expect(
    tournamentSchema.safeParse({ ...event, phases: [phase, phase] }).success,
  ).toBe(false);
  expect(
    tournamentSchema.safeParse({
      ...event,
      result_summary: "Resultado sem fonte.",
    }).success,
  ).toBe(false);
});
it("datas de publicação preservadas, rascunhos e agendamentos não entram no portal", () => {
  const old = competitiveSeed.articles[3],
    fresh = competitiveSeed.articles[0];
  const rows = recentArticles(
    [
      old,
      { ...fresh, id: uid(888), published_at: "2027-01-01T00:00:00Z" },
      fresh,
      { ...old, id: uid(889), published: false },
    ],
    now,
  );
  expect(rows.map((a) => a.id)).toEqual([fresh.id, old.id]);
  expect(rows[1].published_at).toBe("2026-09-28T12:00:00Z");
  expect(relatedArticles(rows, fresh)).not.toContain(fresh);
});
it("compatibilidade Zero Build não recomenda ilhas de construção", () => {
  expect(
    preparationExercises(seed.exercises, { ...event, mode: "zero" }).every(
      (e) => e.mode === "zero" || e.mode === "both",
    ),
  ).toBe(true);
});
it("conflitos incluem madrugada no fuso do perfil e atividades recorrentes", () => {
  const data = demoPlayer();
  data.schedules = [
    {
      id: uid(999),
      user_id: "demo",
      plan_id: null,
      title: "Compromisso",
      kind: "personal",
      starts_at: "2026-10-11T02:30:00Z",
      duration_minutes: 60,
      tournament_id: null,
    },
  ];
  expect(agendaConflicts(data, "2026-10-11T02:45:00Z", 30)).toHaveLength(1);
});
it("Coach consulta apenas evento público selecionado, sem consentimento privado", () => {
  const answer = demoAnswer(
    demoPlayer(),
    seed,
    "Como funciona este evento?",
    defaults,
    undefined,
    event.id,
  );
  expect(
    answer.references.some((r) => r.url.includes("/competitive/" + event.slug)),
  ).toBe(true);
  expect(answer.references.some((r) => r.url.endsWith("#preparar"))).toBe(true);
  expect(JSON.stringify(answer)).not.toContain("SwizzY");
});
it("sugestões respeitam dias, duração disponível e conflitos; ausência de disponibilidade não é inventada", async () => {
  const { preparationSlots } = await import("../src/lib/competitive");
  const data = demoPlayer();
  expect(preparationSlots(data, event, 30, now)).toEqual([]);
  data.planningPreferences = [
    {
      id: uid(777),
      user_id: "demo",
      weekdays: [0, 1],
      local_time: "18:00",
      minutes: 30,
      focuses: ["aim"],
    },
  ];
  const slots = preparationSlots(data, event, 30, now);
  expect(slots.length).toBeGreaterThan(0);
  expect(slots[0]).toBe("2026-10-11T21:00:00.000Z");
  expect(preparationSlots(data, event, 60, now)).toEqual([]);
  data.schedules = [
    {
      id: uid(779),
      user_id: "demo",
      plan_id: null,
      title: "Descanso",
      kind: "rest",
      starts_at: slots[0],
      duration_minutes: 30,
      tournament_id: null,
    },
  ];
  expect(preparationSlots(data, event, 30, now)).not.toContain(slots[0]);
});
it("andamento pode ser derivado de sessão confirmada, respeitando a validade do evento e da fase", () => {
  const phase = {
    ...event.phases![6],
    starts_at: "2026-10-10T12:00:00Z",
    ends_at: "2026-10-10T14:00:00Z",
  };
  expect(eventStatus({ ...event, phases: [phase] }, now)).toBe("live");
  expect(
    eventStatus(
      { ...event, phases: [{ ...phase, valid_until: "2026-10-09T00:00:00Z" }] },
      now,
    ),
  ).not.toBe("live");
});
it("Coach apresenta resultado cadastrado com fonte sem inventar pontos", () => {
  const answer = demoAnswer(
    demoPlayer(),
    seed,
    "Resultado do Global?",
    defaults,
    undefined,
    uid(204),
  );
  expect(JSON.stringify(answer)).toContain("SwizzY");
  expect(answer.references.some((r) => r.url.includes("vitality.gg"))).toBe(
    true,
  );
  expect(JSON.stringify(answer)).not.toContain("600 pontos");
});
