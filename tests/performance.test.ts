import { describe, it, expect } from "vitest";
import { demoPlayer, seed, uid } from "../src/lib/seed";
import { normalizePlayer, type Series } from "../src/lib/performance-types";
import {
  calendarICS,
  conflicts,
  dateInZone,
  expandCalendar,
  zonedInstant,
} from "../src/lib/calendar";
import { personalPlan, resultGroups, summarize } from "../src/lib/performance";
import type { Training } from "../src/lib/types";
const rule = (patch: Partial<Series> = {}): Series => ({
  id: uid(2000),
  user_id: "demo",
  title: "Tracking",
  kind: "training",
  plan_id: uid(2001),
  timezone: "America/New_York",
  local_time: "18:00",
  start_date: "2026-03-01",
  end_date: null,
  weekdays: [1, 3],
  duration_minutes: 30,
  tournament_id: null,
  ...patch,
});
const session = (patch: Partial<Training> = {}): Training => ({
  id: uid(3001),
  user_id: "demo",
  plan_id: uid(2001),
  title: "Tracking",
  steps: [
    {
      exercise_id: seed.exercises[0].id,
      minutes: 30,
      exercise: seed.exercises[0],
    },
  ],
  started_at: "2026-03-09T22:00:00Z",
  completed_at: "2026-03-09T22:30:00Z",
  duration_seconds: 1800,
  results: [
    {
      exercise_id: seed.exercises[0].id,
      value: 10,
      note: "",
      configuration: "Cenário A / SMG / 60s",
    },
  ],
  status: "completed",
  xp: 100,
  ...patch,
});
function data() {
  const d = demoPlayer();
  d.profile!.timezone = "America/New_York";
  d.series = [rule()];
  d.plans = [
    {
      id: uid(2001),
      user_id: "demo",
      title: "Tracking",
      steps: [{ exercise_id: seed.exercises[0].id, minutes: 30 }],
    },
  ];
  return d;
}
describe("Recorrências, fusos e exceções", () => {
  it("expande somente dias da regra e mantém hora local ao atravessar DST", () => {
    const rows = expandCalendar(data(), "2026-03-02", "2026-03-11");
    expect(rows.map((o) => o.starts_at)).toEqual([
      "2026-03-02T23:00:00.000Z",
      "2026-03-04T23:00:00.000Z",
      "2026-03-09T22:00:00.000Z",
      "2026-03-11T22:00:00.000Z",
    ]);
    expect(data().series).toHaveLength(1);
  });
  it("rejeita hora inexistente e usa primeira hora repetida", () => {
    expect(() =>
      zonedInstant("2026-03-08", "02:30", "America/New_York"),
    ).toThrow(/não existe/);
    expect(zonedInstant("2026-11-01", "01:30", "America/New_York")).toBe(
      "2026-11-01T05:30:00.000Z",
    );
    expect(() => zonedInstant("2026-02-30", "18:00", "UTC")).toThrow();
  });
  it("omite apenas ocorrência de horário inexistente de uma série", () => {
    const d = data();
    d.series = [rule({ weekdays: [0], local_time: "02:30" })];
    expect(
      expandCalendar(d, "2026-03-01", "2026-03-15").map(
        (o) => o.occurrence_date,
      ),
    ).toEqual(["2026-03-01", "2026-03-15"]);
  });
  it("move ocorrência de fora do intervalo sem duplicar; cancelamento preserva identificação", () => {
    const d = data();
    d.exceptions = [
      {
        id: uid(2002),
        user_id: "demo",
        series_id: rule().id,
        occurrence_date: "2026-03-02",
        starts_at: "2026-03-20T22:00:00Z",
        duration_minutes: 45,
        title: "Reagendado",
        status: "planned",
      },
    ];
    expect(expandCalendar(d, "2026-03-20", "2026-03-20")).toMatchObject([
      {
        title: "Reagendado",
        occurrence_date: "2026-03-02",
        duration_minutes: 45,
      },
    ]);
    expect(expandCalendar(d, "2026-03-02", "2026-03-02")).toHaveLength(0);
    d.exceptions[0].status = "cancelled";
    expect(expandCalendar(d, "2026-03-20", "2026-03-20")[0].status).toBe(
      "cancelled",
    );
  });
  it("considera fuso de exibição diferente da série nas bordas do intervalo", () => {
    const d = data();
    d.profile!.timezone = "Pacific/Auckland";
    d.series = [
      rule({
        timezone: "America/Los_Angeles",
        local_time: "23:30",
        weekdays: [1],
      }),
    ];
    const rows = expandCalendar(d, "2026-03-10", "2026-03-10");
    expect(rows).toHaveLength(1);
    expect(rows[0].occurrence_date).toBe("2026-03-09");
    expect(dateInZone(rows[0].starts_at, "Pacific/Auckland")).toBe(
      "2026-03-10",
    );
  });
  it("detecta sobreposição, mas permite eventos adjacentes e cancelamentos", () => {
    const rows = expandCalendar(data(), "2026-03-02", "2026-03-02");
    const a = rows[0];
    expect(
      conflicts(a, [{ ...a, key: "b", starts_at: "2026-03-02T23:15:00Z" }]),
    ).toHaveLength(1);
    expect(
      conflicts(a, [{ ...a, key: "b", starts_at: "2026-03-02T23:30:00Z" }]),
    ).toHaveLength(0);
    expect(
      conflicts(a, [{ ...a, key: "b", status: "cancelled" }]),
    ).toHaveLength(0);
  });
  it("exporta intervalo ICS em UTC com escapes e linhas limitadas em bytes", () => {
    const rows = expandCalendar(data(), "2026-03-02", "2026-03-02");
    rows[0].title = "á".repeat(90) + ", teste;\n";
    const ics = calendarICS(rows, new Date("2026-01-01T00:00:00Z"));
    expect(ics).toContain("DTSTART:20260302T230000Z");
    expect(ics).toContain("\\, teste\\;\\n");
    expect(
      ics
        .split("\r\n")
        .every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
  });
  it("preserva sessões antigas e inicializa novos campos sem perder dados", () => {
    const legacy = { ...demoPlayer() } as Record<string, unknown>;
    delete legacy.series;
    delete legacy.journals;
    legacy.exceptions = null;
    const normalized = normalizePlayer(legacy);
    expect(normalized.profile).toEqual(legacy.profile);
    expect(normalized.series).toEqual([]);
    expect(normalized.journals).toEqual([]);
    expect(normalized.exceptions).toEqual([]);
  });
});
describe("Métricas transparentes e planejamento", () => {
  it("separa cenário e definição de métrica; não compara registros sem configuração", () => {
    const a = session(),
      b = session({
        id: uid(3002),
        results: [
          { ...session().results[0], configuration: "Cenário B", value: 20 },
        ],
      }),
      legacy = session({
        id: uid(3003),
        results: [
          { ...session().results[0], configuration: undefined, value: 30 },
        ],
      });
    const metric = session({
      id: uid(3004),
      steps: [
        {
          ...a.steps[0],
          exercise: { ...seed.exercises[0], metric: "Tempo em segundos" },
        },
      ],
    });
    expect(
      resultGroups([a, b, legacy, metric], seed.exercises[0].id),
    ).toHaveLength(3);
    expect(
      resultGroups([a, b, legacy, metric], seed.exercises[0].id).every(
        (g) => g.points.length === 1,
      ),
    ).toBe(true);
  });
  it("conclusão usa vínculo explícito e não associa duas ocorrências à mesma sessão", () => {
    const d = data();
    d.sessions = [
      session({ series_id: rule().id, occurrence_date: "2026-03-09" }),
    ];
    const result = summarize(
      d,
      "2026-03-09",
      "2026-03-11",
      new Date("2026-03-12T00:00:00Z"),
    );
    expect(result).toMatchObject({
      completed: 1,
      planned: 2,
      adhered: 1,
      estimated: 0,
      practiceDays: 1,
      minutes: 30,
    });
  });
  it("marca estimativas antigas separadamente e exclui cancelamentos", () => {
    const d = data();
    d.series = [];
    d.schedules = [
      {
        id: uid(4001),
        user_id: "demo",
        plan_id: uid(2001),
        starts_at: "2026-03-09T22:00:00Z",
        tournament_id: null,
      },
      {
        id: uid(4002),
        user_id: "demo",
        plan_id: uid(2001),
        starts_at: "2026-03-09T23:00:00Z",
        tournament_id: null,
        status: "cancelled",
      },
    ];
    d.sessions = [session()];
    expect(
      summarize(
        d,
        "2026-03-09",
        "2026-03-09",
        new Date("2026-03-10T00:00:00Z"),
      ),
    ).toMatchObject({ planned: 1, adhered: 0, estimated: 1 });
  });
  it("diário inclui apenas sessões concluídas no período, sem inferir melhora", () => {
    const d = data();
    d.sessions = [session()];
    d.journals = [
      {
        id: uid(5001),
        user_id: "demo",
        session_id: uid(3001),
        practiced: "",
        improved: "",
        difficult: "",
        next_focus: "",
        difficulties: ["box_fights"],
      },
    ];
    const r = summarize(
      d,
      "2026-03-09",
      "2026-03-15",
      new Date("2026-03-16T00:00:00Z"),
    );
    expect(r.difficulties).toEqual([{ key: "box_fights", count: 1 }]);
    expect(r.observations.some((x) => x.includes("melhor"))).toBe(false);
    expect(
      summarize(d, "2026-03-16", "2026-03-22", new Date("2026-03-23T00:00:00Z"))
        .difficulties,
    ).toHaveLength(0);
  });
  it("plano Zero Build respeita modalidade, duração e variedade ajustável", () => {
    const p = demoPlayer().profile!;
    p.mode = "zero";
    const proposal = personalPlan(seed.exercises, p, {
      id: "demo",
      user_id: "demo",
      weekdays: [1, 3],
      local_time: "18:00",
      minutes: 45,
      focuses: ["aim", "decisions"],
    });
    expect(proposal.steps.reduce((n, x) => n + x.minutes, 0)).toBe(45);
    expect(
      proposal.steps.every(
        (st) =>
          seed.exercises.find((e) => e.id === st.exercise_id)!.mode !== "build",
      ),
    ).toBe(true);
    expect(proposal.reasons).toHaveLength(proposal.steps.length);
  });
});
