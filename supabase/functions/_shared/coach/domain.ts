/** Portable domain shared by Edge and demo. It has no credentials or database access. */
export type Intent =
  "report" | "agenda" | "exercise" | "competition" | "knowledge";
export type Preferences = {
  context_enabled: boolean;
  external_enabled: boolean;
  history_enabled: boolean;
  proactive_enabled: boolean;
  consent_version: string | null;
};
export const defaults: Preferences = {
  context_enabled: false,
  external_enabled: false,
  history_enabled: false,
  proactive_enabled: false,
  consent_version: null,
};
export type Reference = {
  id: string;
  title: string;
  url: string;
  verified_at?: string;
};
export type Section = { title: string; items: string[] };
export type Answer = {
  mode: "rules" | "generative";
  sections: Section[];
  references: Reference[];
  scope: string[];
  notice?: string;
  guidance?: string;
  guidance_reference_ids?: string[];
  conversation_id?: string;
  planning?: boolean;
};
export type Context = {
  profile?: {
    mode: string;
    level: string;
    objective: string;
    timezone: string;
    minutes: number;
  };
  sessions?: {
    id: string;
    completed_at: string;
    duration_seconds: number;
    steps: {
      id?: string;
      exercise_id: string;
      exercise?: {
        category: string;
        metric: string;
        title: string;
        published?: boolean;
      };
    }[];
    results: {
      exercise_id: string;
      value: number | null;
      step_id?: string;
      status?: string;
      unit?: string;
      version?: string;
      conditions?: {
        scenario: string;
        device: string;
        sensitivity: string;
        test_seconds: number | null;
      } | null;
      configuration?: string;
      note?: string;
    }[];
  }[];
  total?: number;
  goals?: { title: string; completed: boolean }[];
  journals?: {
    session_id: string;
    difficulties: string[];
    next_focus: string;
    difficult: string;
  }[];
  agenda?: {
    id: string;
    title: string;
    starts_at: string;
    duration_minutes: number;
    status: string;
    series_id?: string;
    occurrence_date?: string;
  }[];
  exercises?: {
    id: string;
    title: string;
    category: string;
    mode: string;
    level: string;
    description: string;
    instructions: string;
    metric: string;
    map_code: string | null;
    source_url: string;
    verified_at: string;
  }[];
  articles?: {
    id: string;
    slug: string;
    title: string;
    summary: string;
    source_url: string;
    verified_at: string;
  }[];
  tournaments?: {
    result_summary?: string | null;
    result_source_url?: string | null;
    result_verified_at?: string | null;
    format?: string;
    rules?: string;
    mode?: string;
    region?: string;
    confirmation?: string;
    phases?: {
      title: string;
      date: string;
      starts_at: string | null;
      status: string;
      valid_until: string;
    }[];
    id: string;
    slug: string;
    title: string;
    starts_at: string | null;
    start_date: string;
    status: string;
    valid_until: string;
    verified_at: string;
    source_url: string;
  }[];
};
export type Query = {
  message: string;
  intent: Intent;
  days: number;
  category: string;
  exercise_id?: string;
};
export function classify(message: string, exercise_id?: string): Query {
  const t = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const days = /90 dias/.test(t) ? 90 : /30 dias|mes/.test(t) ? 30 : 7;
  const category = /shotgun|tracking|mira|aim/.test(t)
    ? "aim"
    : /piece|box fight/.test(t)
      ? "piece"
      : /edit|build|mecanica/.test(t)
        ? "mechanics"
        : /vod/.test(t)
          ? "vod"
          : /rotat|rotac|endgame|deadside|surge|tarp|refresh/.test(t)
            ? "decisions"
            : /competitiv|realistic|ranked/.test(t)
              ? "competitive"
              : "auto";
  const tournament =
    /campeonato|fncs|cash cup|regulamento|formato|resultado recente/.test(t);
  const calendarChange =
    /organize|organizar|reagend|adicionar|mudou.*horario/.test(t);
  const intent: Intent = exercise_id
    ? "exercise"
    : tournament && !calendarChange
      ? "competition"
      : /evolu|resultad|ultima semana|ultimos|oscil|relatorio|melhorando/.test(
            t,
          )
        ? "report"
        : /agenda|amanha|organize|organizar|domingo|terca|quinta|sabado|compromisso|reagend|adicionar|horario/.test(
              t,
            )
          ? "agenda"
          : /trein|exercicio|melhorar|por onde|praticar/.test(t)
            ? "exercise"
            : "knowledge";
  return { message: message.trim(), intent, days, category, exercise_id };
}
export function safeURL(value: string) {
  if (/[\\\u0000-\u001f]/.test(value)) return "";
  if (value.startsWith("/")) return value.startsWith("//") ? "" : value;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password ? value : "";
  } catch {
    return "";
  }
}
export function rulesAnswer(
  q: Query,
  c: Context,
  knowledge: Reference[],
  definitions: string[],
): Answer {
  const sections: Section[] = [],
    references: Reference[] = [],
    scope: string[] = [];
  const add = (title: string, items: string[]) =>
    sections.push({ title, items });
  const ref = (
    id: string,
    title: string,
    url: string,
    verified_at?: string,
  ) => {
    if (safeURL(url)) references.push({ id, title, url, verified_at });
  };
  if (
    /senha|credencial|diagn[oó]stico|rem[eé]dio|sem dormir|dados.*outro|outra conta/i.test(
      q.message,
    )
  )
    return {
      mode: "rules",
      sections: [
        {
          title: "Limites do Coach",
          items: [
            "Posso ajudar com seus registros autorizados e treinamento moderado. Não consulto contas alheias, solicito credenciais ou ofereço diagnóstico médico.",
          ],
        },
      ],
      references: [],
      scope: [],
    };
  if (q.intent === "report") {
    scope.push(
      "Sessões concluídas do período",
      "Resultados com cenário e métrica",
      "Dificuldades do diário",
      "Metas atuais",
    );
    const sessions = c.sessions || [];
    add("Observado nos registros", [
      `${c.total ?? sessions.length} sessões concluídas no período de ${q.days} dias.`,
      `${Math.round(sessions.reduce((n, s) => n + s.duration_seconds, 0) / 60)} minutos ativos nos ${sessions.length} registros analisados.${(c.total ?? sessions.length) > sessions.length ? " A análise detalhada está limitada aos 200 registros mais recentes." : ""}`,
    ]);
    const cats = new Map<string, number>();
    for (const s of sessions)
      for (const category of new Set(
        s.steps
          .filter(
            (st) =>
              !s.results.some(
                (r) =>
                  (r.step_id
                    ? r.step_id === st.id
                    : r.exercise_id === st.exercise_id) &&
                  r.status === "skipped",
              ),
          )
          .map((st) => st.exercise?.category)
          .filter(Boolean),
      ))
        cats.set(category!, 1 + (cats.get(category!) || 0));
    if (cats.size)
      add(
        "Categorias praticadas",
        [...cats].map(
          ([key, n]) =>
            `${({ aim: "Mira", mechanics: "Mecânicas", piece: "Piece Control", competitive: "Prática competitiva", decisions: "Noção de Jogo", vod: "VOD Review", wellbeing: "Bem-estar" } as Record<string, string>)[key] || key}: ${n} sessões.`,
        ),
      );
    const groups = new Map<
      string,
      {
        metric: string;
        configuration: string;
        points: { value: number; date: string }[];
      }
    >();
    for (const s of sessions)
      for (const r of s.results) {
        const step = s.steps.find((st) =>
          r.step_id ? st.id === r.step_id : st.exercise_id === r.exercise_id,
        );
        if (
          r.status === "skipped" ||
          step?.exercise?.published === false ||
          r.value === null ||
          !Number.isFinite(r.value) ||
          !r.configuration?.trim() ||
          !step?.exercise?.metric
        )
          continue;
        const metric = step.exercise.metric,
          configuration = r.configuration.trim(),
          key = JSON.stringify([
            r.exercise_id,
            metric,
            configuration,
            r.unit || "legacy",
            r.version || "legacy",
            r.conditions
              ? [
                  r.conditions.scenario,
                  r.conditions.device,
                  r.conditions.sensitivity,
                  r.conditions.test_seconds,
                ]
              : null,
          ]);
        const g = groups.get(key) || { metric, configuration, points: [] };
        g.points.push({ value: r.value, date: s.completed_at });
        groups.set(key, g);
      }
    const changes = [...groups.values()]
      .filter((g) => g.points.length >= 2)
      .slice(0, 8)
      .map((g) => {
        g.points.sort((a, b) => a.date.localeCompare(b.date));
        return `${g.metric} (${g.configuration}): ${g.points[0].value} → ${g.points.at(-1)!.value}. Variação entre medições autodeclaradas comparáveis; a direção desejável depende da métrica.`;
      });
    add(
      "Resultados comparáveis",
      changes.length
        ? changes
        : [
            "Não há medições suficientes com a mesma métrica e configuração. Mais tempo de jogo não comprova melhora de habilidade.",
          ],
    );
    const difficulties = [
      ...new Set((c.journals || []).flatMap((j) => j.difficulties)),
    ];
    if (difficulties.length) add("Dificuldades relatadas", difficulties);
    const notes = (c.journals || [])
      .filter((j) => j.difficult.trim())
      .slice(0, 3)
      .map((j) => j.difficult);
    if (notes.length)
      add("Percepções registradas no diário · autodeclaradas", notes);
    const nextFocus = (c.journals || [])
      .filter((j) => j.next_focus.trim())
      .slice(0, 3)
      .map((j) => j.next_focus);
    if (nextFocus.length) add("Próximos focos que você registrou", nextFocus);
    if (c.goals?.length)
      add(
        "Metas atuais",
        c.goals.map(
          (g) =>
            `${g.title}: ${g.completed ? "concluída (autodeclarada)" : "em andamento"}. A data de conclusão não está registrada.`,
        ),
      );
    add("Próximo passo", [
      "Repita um teste com arma, cenário e sensibilidade constantes. Revise uma dificuldade do diário e registre o próximo foco. Oscilações podem ter várias causas; estes registros não identificam a causa.",
    ]);
    ref("reports", "Gráficos e registros", "/app/reports?period=" + q.days);
    ref("week", "Resumo semanal", "/app/week");
    for (const s of sessions.slice(0, 3))
      ref("session:" + s.id, "Diário da sessão", "/app/journal/" + s.id);
  } else if (q.intent === "agenda") {
    scope.push("Agenda do intervalo", "Fuso horário", "Rotinas e exceções");
    add(
      "Sua agenda",
      (c.agenda || [])
        .slice(0, 20)
        .map(
          (a) =>
            `${a.title} · ${new Intl.DateTimeFormat("pt-BR", { timeZone: c.profile?.timezone || "UTC", dateStyle: "short", timeStyle: "short" }).format(new Date(a.starts_at))} · ${a.duration_minutes} min · ${a.status}`,
        ),
    );
    if (!c.agenda?.length)
      add("Sem compromissos encontrados", [
        "Nenhuma atividade no intervalo consultado.",
      ]);
    add("Planejamento com confirmação", [
      "Revise datas, horário, duração e atividade no formulário. A prévia consulta conflitos. Somente o botão de confirmação persiste a proposta.",
    ]);
    ref("calendar", "Abrir calendário", "/app/planner");
  } else if (q.intent === "competition") {
    scope.push("Campeonatos favoritos", "Catálogo e validade editorial");
    add(
      "Campeonatos salvos",
      (c.tournaments || [])
        .slice(0, 10)
        .map(
          (t) =>
            `${t.title} · ${t.start_date} · ${t.status}. Revisado em ${t.verified_at.slice(0, 10)}; validade editorial até ${t.valid_until.slice(0, 10)}.`,
        ),
    );
    if (!c.tournaments?.length)
      add("Sem favoritos encontrados", [
        "Salve um campeonato na área competitiva para acompanhar sua preparação.",
      ]);
    for (const t of c.tournaments || []) {
      if (t.result_summary && t.result_source_url && t.result_verified_at) {
        add("Resultado registrado · fonte identificada", [
          t.result_summary,
          "Verificado em " +
            t.result_verified_at.slice(0, 10) +
            "; não representa uma classificação completa.",
        ]);
        ref(
          "result:" + t.id,
          "Fonte do resultado",
          t.result_source_url,
          t.result_verified_at,
        );
      }
      const stale =
        Date.parse(t.valid_until) < Date.now() ||
        t.confirmation === "unconfirmed";
      if (stale)
        add("Registro exige revisão", [
          `${t.title}: dados históricos ou não confirmados. Confira a fonte oficial antes de planejar.`,
        ]);
      else {
        if (t.format && t.rules)
          add(t.title, [
            `Formato editorial verificado: ${t.format} · ${t.mode} · ${t.region}.`,
            t.rules,
          ]);
        if (t.phases?.length)
          add(
            "Fases cadastradas",
            t.phases
              .filter((p) => Date.parse(p.valid_until) >= Date.now())
              .slice(0, 10)
              .map(
                (p) =>
                  `${p.title}: ${p.date} · ${p.status} · ${p.starts_at || "horário não confirmado"}`,
              ),
          );
      }
      ref(
        "prepare:" + t.id,
        "Preparar e adicionar à agenda com confirmação",
        "/competitive/" + t.slug + "#preparar",
      );
    }
    add("Verificação atual necessária", [
      "Formatos, regulamentos, horários e resultados podem mudar. Não uso memória do modelo para confirmá-los. Abra a fonte oficial; a integração de consulta ao vivo é usada somente quando configurada e retorna conteúdo verificável.",
    ]);
    for (const t of c.tournaments || [])
      ref(
        "tournament:" + t.id,
        t.title,
        "/competitive/" + t.slug,
        t.verified_at,
      );
    ref(
      "official",
      "Regras oficiais da Epic",
      "https://www.fortnite.com/competitive/rules-guidelines/rules-library",
    );
  } else {
    if (c.profile) scope.push("Modalidade, objetivo e nível informado");
    scope.push("Catálogo publicado", "Conhecimento editorial com fontes");
    if (definitions.length) add("Entenda a habilidade", definitions);
    const category =
      q.category === "auto" ? c.profile?.objective || "aim" : q.category;
    const eligible = (c.exercises || [])
      .filter(
        (e) =>
          (q.exercise_id ? e.id === q.exercise_id : e.category === category) &&
          (!c.profile || e.mode === "both" || e.mode === c.profile.mode) &&
          (!q.exercise_id || e.id === q.exercise_id),
      )
      .sort(
        (a, b) =>
          Number(b.level === c.profile?.level) -
          Number(a.level === c.profile?.level),
      )
      .slice(0, 3);
    if (eligible.length) {
      add(
        "Exercícios do Clutchfolio",
        eligible.map(
          (e) =>
            `${e.title}: ${e.description} ${e.map_code ? "Mapa cadastrado: " + e.map_code + "." : "Sem código de mapa cadastrado."} Registre: ${e.metric}`,
        ),
      );
      for (const e of eligible) {
        ref("exercise:" + e.id, e.title, "/library/" + e.id, e.verified_at);
        ref("map:" + e.id, "Fonte do exercício", e.source_url, e.verified_at);
      }
    } else if (q.intent === "exercise")
      add("Catálogo disponível", [
        "Não encontrei um exercício publicado compatível com este filtro. Consulte a biblioteca e ajuste o foco; não vou inventar mapas.",
      ]);
    for (const a of (c.articles || []).slice(0, 2)) {
      add(a.title, [a.summary]);
      ref("article:" + a.id, a.title, "/academy/" + a.slug, a.verified_at);
    }
    add("Próximo passo", [
      "Escolha uma habilidade por sessão, mantenha condições comparáveis e anote o que foi difícil. Faça pausas e ajuste a duração à sua disponibilidade. A sugestão é editorial, sem promessa de desempenho.",
    ]);
    ref("library", "Biblioteca de exercícios", "/library");
    ref("calendar", "Planejar atividade", "/app/planner");
  }
  for (const k of knowledge)
    if (!references.some((r) => r.id === k.id)) references.push(k);
  return {
    mode: "rules",
    sections,
    references,
    scope,
    planning: q.intent === "agenda" || q.intent === "exercise",
  };
}
