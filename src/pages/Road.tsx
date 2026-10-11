import { JourneyNav } from "../components/experience/JourneyNav";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { useRoad } from "../lib/road/useRoad";
import {
  createRoad,
  updateRoad,
  recordRoad,
  confirmRoad,
  deleteRoad,
} from "../lib/road/service";
import {
  journeyProgress,
  journeyReport,
  journeyRecords,
  stageProposal,
  roadConfigSchema,
  type RoadLesson,
} from "../lib/road/domain";
import {
  defaultEvolutionConfig,
  type EvolutionConfig,
} from "../lib/skill-maxing/config";
import { dateInZone, shiftDate, weekday } from "../lib/calendar";
import { AvailabilityEditor } from "../components/skill-maxing/AvailabilityEditor";
import { EvolutionPreview } from "../components/skill-maxing/EvolutionPreview";
import type { EvolutionProposal } from "../lib/skill-maxing/engine";
import { lessonState, assessmentResult } from "../lib/academy";
import { knowledge } from "../lib/training-research";
import { Heading, Modal, Badge } from "../components/ui";
import { CoachAccess } from "../components/CoachAccess";
import { useSEO } from "../lib/seo";

export default function Road() {
  const s = useStore(),
    road = useRoad(),
    navigate = useNavigate();
  const [selected, setSelected] = useState("");
  const j =
    road.data.journeys.find((j) => j.id === selected) ||
    road.data.journeys.find((j) => j.status !== "completed") ||
    road.data.journeys.at(-1);
  const [setup, setSetup] = useState(false),
    [editing, setEditing] = useState(false),
    [formStep, setFormStep] = useState(0);
  const [config, setConfig] = useState<EvolutionConfig>(() =>
    defaultEvolutionConfig(s.data.profile!),
  );
  const [experience, setExperience] = useState<"first" | "some" | "regular">(
      "first",
    ),
    [familiarity, setFamiliarity] = useState("");
  const [lesson, setLesson] = useState<RoadLesson | null>(null),
    [answers, setAnswers] = useState<number[]>([]),
    [note, setNote] = useState("");
  const [stage, setStage] = useState(1),
    [from, setFrom] = useState(() => {
      const d = dateInZone(new Date(), s.data.profile!.timezone);
      return shiftDate(d, (8 - weekday(d)) % 7 || 7);
    });
  const [proposal, setProposal] = useState<EvolutionProposal | null>(null),
    [token, setToken] = useState(""),
    [confirm, setConfirm] = useState<"plan" | "finish" | "delete" | null>(null);
  useSEO(
    "Road to Competitive",
    "Jornada flexível de estudo e prática com avaliações e registros próprios.",
  );
  useEffect(() => {
    setProposal(null);
    setLesson(null);
    if (j) setStage(journeyProgress(j, road.data.events).current);
  }, [j?.id]);
  async function act(fn: () => Promise<unknown>, message: string) {
    await s.run(async () => {
      await fn();
      await road.refresh();
    }, message);
  }
  function openSetup(edit = false) {
    setEditing(edit);
    setConfig(
      edit && j
        ? structuredClone(j.config)
        : j
          ? { ...structuredClone(j.config), baseline: false }
          : defaultEvolutionConfig(s.data.profile!),
    );
    setExperience(j?.experience || "first");
    setFamiliarity("");
    setFormStep(0);
    setSetup(true);
    setProposal(null);
  }
  const progress = j ? journeyProgress(j, road.data.events) : null,
    report = j ? journeyReport(j, road.data, s.data) : null;
  const records = j ? journeyRecords(j, road.data.events) : [];
  const practicePlans = j
    ? s.data.plans.filter((p) => p.learning_journey_id === j.id && !p.archived)
    : [];
  const assessment = lesson?.article.academy_questions || [];
  async function study(
    action: "completed" | "reviewed" | "assessment" | "skipped",
  ) {
    if (!j || !lesson) return;
    await act(
      async () => {
        await recordRoad(
          s.demo,
          j,
          action,
          lesson.article.id,
          action === "assessment" ? answers : [],
          note,
        );
        setNote("");
      },
      action === "assessment"
        ? "Avaliação conceitual registrada. Isto não mede habilidade prática."
        : "Registro de estudo salvo.",
    );
  }
  return (
    <div className="road-page">
      <Heading
        eyebrow="KYRVEN ACADEMY · APRENDER E PRATICAR"
        title="Road to Competitive"
        description="Quatro etapas para compreender o jogo, praticar com propósito e revisar seus registros. Trinta dias são uma referência de calendário, sem treinos obrigatórios todos os dias ou promessa de profissionalização."
      />
      <div className="row">
        <Link className="button" to="/academy">
          Todas as aulas
        </Link>
        <Link className="button" to="/app/training">
          Training Center
        </Link>
        <Link className="button" to="/app/planner">
          Minha agenda
        </Link>
        <Link className="button" to="/competitive">
          Preparação competitiva
        </Link>
      </div>
      {road.loading && <p role="status">Consultando sua jornada…</p>}
      {road.error && (
        <p role="alert">
          {road.error}{" "}
          <button onClick={() => void road.refresh()}>Tentar novamente</button>
        </p>
      )}
      {!j && !road.loading && !road.error && (
        <section className="panel">
          <h2>Seu primeiro contato</h2>
          <p>
            Escolha Construção ou Zero Build, informe seu objetivo e quando quer
            praticar. A familiaridade declarada será separada das respostas
            conceituais e dos resultados medidos. A avaliação inicial é
            opcional.
          </p>
          <button className="button primary" onClick={() => openSetup()}>
            Criar minha jornada
          </button>
          <p>
            As aulas continuam disponíveis sem uma jornada. Você pode pausar,
            repetir ou pular conteúdo sem perder registros.
          </p>
        </section>
      )}
      {j && progress && report && (
        <>
      <JourneyNav />
          <section className="panel">
            <div className="row">
              <h2>Meu ciclo de aprendizagem</h2>
              <Badge>
                {j.status === "paused"
                  ? "Pausada"
                  : j.status === "completed"
                    ? "Ciclo encerrado"
                    : "Em andamento"}
              </Badge>
            </div>
            <label>
              Consultar ciclo
              <select
                value={j.id}
                onChange={(e) => setSelected(e.target.value)}
              >
                {road.data.journeys.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.start_date} ·{" "}
                    {x.config.mode === "zero" ? "Zero Build" : "Construção"} ·{" "}
                    {x.status}
                  </option>
                ))}
              </select>
            </label>
            <p>
              Experiência informada:{" "}
              {j.experience === "first"
                ? "Primeiro contato"
                : j.experience === "some"
                  ? "Alguma experiência"
                  : "Jogo regularmente"}
              . Esta declaração não é uma nota de habilidade.
            </p>
            <p>
              {j.config.mode === "build" ? "Construção" : "Zero Build"} ·{" "}
              {j.config.input === "kbm" ? "Teclado e mouse" : "Controle"} ·{" "}
              {j.config.timezone} · início {j.start_date} · referência até{" "}
              {shiftDate(j.start_date, 29)}.
            </p>
            <p>Objetivo: {j.config.objective}</p>
            {j.familiarity && (
              <p>Familiaridade inicial declarada: {j.familiarity}</p>
            )}
            <p role="status">
              {progress.studied} de {progress.total} aulas estudadas ·{" "}
              {progress.skipped} puladas por você ·{" "}
              {progress.assessments.length} avaliações conceituais ·{" "}
              {report.completed} sessões concluídas.
            </p>
            <progress
              value={progress.studied}
              max={progress.total}
              aria-label="Aulas estudadas nesta jornada"
            />
            <p>
              Etapa sugerida: {progress.current}. Você pode abrir qualquer
              etapa. Conclusão de estudo e prática são evidências diferentes.
            </p>
            {j.status !== "completed" && (
              <div className="row">
                <button className="button" onClick={() => openSetup(true)}>
                  Ajustar objetivo e disponibilidade
                </button>
                <button
                  className="button"
                  disabled={s.busy}
                  onClick={() =>
                    void act(
                      () =>
                        recordRoad(
                          s.demo,
                          j,
                          j.status === "paused" ? "resume" : "pause",
                          null,
                          [],
                          "Estado da jornada alterado; agenda preservada.",
                        ),
                      j.status === "paused"
                        ? "Jornada retomada."
                        : "Jornada pausada. Revise compromissos existentes no calendário.",
                    )
                  }
                >
                  {j.status === "paused" ? "Retomar jornada" : "Pausar jornada"}
                </button>
                <button className="button" onClick={() => setConfirm("finish")}>
                  Encerrar ciclo e consultar relatório
                </button>
              </div>
            )}
            {j.status === "paused" && (
              <p className="alert">
                Pausar preserva estudo e resultados. Os compromissos já salvos
                continuam na agenda; reagende ou cancele somente os desejados no
                calendário.
              </p>
            )}
            {j.status === "completed" &&
              !road.data.journeys.some((x) => x.status !== "completed") && (
                <button className="button primary" onClick={() => openSetup()}>
                  Criar próximo ciclo com minhas preferências
                </button>
              )}
          </section>
          <section
            aria-label="Roadmap de aprendizagem"
            className="roadmap-grid"
          >
            {progress.stages.map((m) => (
              <section className="panel" key={m.stage}>
                <Badge>
                  Etapa {m.stage} · referência semana {m.stage}
                </Badge>
                <h2>{m.title}</h2>
                <p>{m.objective}</p>
                <p>
                  {m.studied} estudadas · {m.skipped} puladas ·{" "}
                  {m.lessons.length} aulas
                </p>
                <p>{m.review}</p>
                <ol>
                  {m.lessons.map((l) => (
                    <li key={l.article.id}>
                      <button
                        className="text-link"
                        onClick={() => {
                          setLesson(l);
                          setAnswers([]);
                          setNote("");
                        }}
                      >
                        {l.article.title}
                      </button>
                      <span>
                        {" "}
                        ·{" "}
                        {lessonState(records, l.article.id) === "reviewed"
                          ? "Revisada"
                          : lessonState(records, l.article.id) === "completed"
                            ? "Estudada"
                            : road.data.events.some(
                                  (e) =>
                                    e.journey_id === j.id &&
                                    e.lesson_id === l.article.id &&
                                    e.action === "skipped",
                                )
                              ? "Pulada por você"
                              : "Disponível"}
                      </span>
                    </li>
                  ))}
                </ol>
                <button
                  className="button"
                  disabled={j.status !== "active"}
                  onClick={() => {
                    setStage(m.stage);
                    setProposal(null);
                    document
                      .getElementById("road-planning")
                      ?.scrollIntoView({ block: "start" });
                  }}
                >
                  Planejar prática da etapa {m.stage}
                </button>
              </section>
            ))}
          </section>
          <section className="panel" id="road-planning">
            <h2>Da aula para a prática</h2>
            <p>
              O Skill Maxing combina exercícios verificados ligados às
              competências da etapa. Consulte as aulas antes da prática; tempo
              de leitura não é registrado como exercício concluído. Sessões
              curtas podem trabalhar apenas uma habilidade.
            </p>
            <div className="form-grid">
              <label>
                Etapa para planejar
                <select
                  value={stage}
                  onChange={(e) => {
                    setStage(Number(e.target.value));
                    setProposal(null);
                  }}
                >
                  {progress.stages.map((m) => (
                    <option key={m.stage} value={m.stage}>
                      {m.stage} · {m.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Segunda-feira da semana
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setProposal(null);
                  }}
                />
              </label>
            </div>
            <button
              className="button primary"
              disabled={s.busy || j.status !== "active"}
              onClick={() =>
                void s.run(async () => {
                  setProposal(
                    stageProposal(
                      j,
                      stage,
                      j.config,
                      s.data,
                      s.catalog,
                      from,
                      new Date(),
                      road.data.events,
                    ),
                  );
                  setToken(crypto.randomUUID());
                }, false)
              }
            >
              Gerar prévia desta semana
            </button>
            <p>
              Disponibilidade limitada não reduz progresso. Uma semana
              confirmada não obriga a avançar de etapa; repita ou reveja a
              sequência.
            </p>
            {proposal && (
              <EvolutionPreview
                proposal={proposal}
                onChange={(p) => {
                  setProposal(p);
                  setToken(crypto.randomUUID());
                }}
                onConfirm={() => setConfirm("plan")}
              />
            )}
          </section>
          <section className="panel">
            <h2>Minhas práticas da jornada</h2>
            {!practicePlans.length && (
              <p>
                Nenhuma prática agendada neste ciclo. Gere uma prévia e confirme
                antes de iniciar.
              </p>
            )}
            {practicePlans.map((p) => (
              <article key={p.id}>
                <h3>{p.title}</h3>
                <p>
                  {p.steps.reduce((n, st) => n + st.minutes, 0)} minutos
                  planejados · {p.objective}
                </p>
                <div className="row">
                  <button
                    className="button primary"
                    disabled={s.busy || j.status !== "active"}
                    onClick={() =>
                      void s.run(async () => {
                        const session = await s.start(p);
                        navigate(`/app/session/${session.id}`);
                      }, false)
                    }
                  >
                    Iniciar · {p.title}
                  </button>
                  <Link className="button" to="/app/training">
                    Editar ou personalizar rotina
                  </Link>
                </div>
              </article>
            ))}
          </section>
          <section className="panel" id="road-report">
            <h2>Relatório do meu ciclo</h2>
            <p>
              {report.completed} sessões concluídas · {report.interrupted}{" "}
              interrompidas · {progress.studied} aulas estudadas. Volume e
              conclusão não comprovam melhoria.
            </p>
            <h3>Avaliações de conceitos</h3>
            {!progress.assessments.length && (
              <p>Avaliação opcional ainda não registrada.</p>
            )}
            {progress.assessments.map((r) => {
              const v = assessmentResult(r.snapshot.questions, r.answers);
              return (
                <p key={r.id}>
                  {r.snapshot.title} · {v.correct}/{v.total} respostas · versão{" "}
                  {r.snapshot.version} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("pt-BR")}
                </p>
              );
            })}
            <h3>Resultados comparáveis</h3>
            {!report.comparisons.length && (
              <p>
                Dados insuficientes para comparar desempenho. Repita o mesmo
                exercício, procedimento e condições, registrando uma métrica
                válida.
              </p>
            )}
            {report.comparisons.map((g) => (
              <p key={g.key}>
                {s.catalog.exercises.find((e) => e.id === g.exercise_id)
                  ?.title || "Exercício arquivado"}{" "}
                · {g.configuration} · {g.points[0].value} →{" "}
                {g.points.at(-1)!.value} {g.unit} · {g.points.length} registros
                · {g.context}
              </p>
            ))}
            <h3>Habilidades acompanhadas</h3>
            <p>
              {report.skills
                .map(
                  (id) =>
                    knowledge.competencies.find((k) => k.id === id)?.title ||
                    id,
                )
                .join(" · ")}
            </p>
            <h3>Metas relacionadas concluídas</h3>
            {report.goals.length ? (
              report.goals.map((g) => <p key={g.id}>{g.title}</p>)
            ) : (
              <p>
                Nenhuma meta com critério relacionado aos exercícios foi
                registrada como concluída.{" "}
                <Link to="/app/skills">Definir ou revisar metas</Link>
              </p>
            )}
            <details>
              <summary>
                Dificuldades e observações registradas (
                {report.difficulties.length})
              </summary>
              {report.difficulties.map((d, i) => (
                <p key={i}>{d}</p>
              ))}
            </details>
            <details>
              <summary>
                Conteúdos sem prática vinculada suficiente ({report.gaps.length}
                )
              </summary>
              <ul>
                {report.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
              <p>
                Uma aula pode ensinar uma ideia sem produzir uma métrica.
                Ausência de prática vinculada não demonstra incapacidade.
              </p>
            </details>
            <h3>Próximos objetivos</h3>
            <p>
              {report.comparisons.length
                ? "Revise os resultados comparáveis, a dificuldade relatada e escolha um único ajuste para testar no próximo ciclo."
                : "Escolha uma habilidade prioritária, registre uma primeira tentativa e repita o procedimento antes de avaliar evolução."}{" "}
              Você pode repetir qualquer aula. A conclusão desta jornada não
              certifica prontidão para torneios.
            </p>
            {progress.stages
              .filter((m) => m.studied === m.lessons.length)
              .map((m) => (
                <Badge key={m.stage}>Marco de estudo: {m.title}</Badge>
              ))}
            <div className="row">
              <Link className="button" to="/app/reports">
                Gráficos e resultados detalhados
              </Link>
              <Link className="button" to="/app/evolution">
                Histórico de sessões
              </Link>
              <CoachAccess
                journeyId={j.id}
                question={`Como posso revisar meu objetivo: ${j.config.objective}?`}
                label="Revisar objetivo com kyrven coach"
              />
              <button
                className="button"
                onClick={() => {
                  const blob = new Blob(
                    [
                      JSON.stringify(
                        {
                          journey: j,
                          report,
                          events: road.data.events.filter(
                            (e) => e.journey_id === j.id,
                          ),
                        },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  );
                  const url = URL.createObjectURL(blob),
                    a = document.createElement("a");
                  a.href = url;
                  a.download = "kyrven-road-relatorio.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Exportar relatório do ciclo
              </button>
            </div>
          </section>
          <details className="panel">
            <summary>Histórico e referências da jornada</summary>
            <p>
              Versão {j.version}. Programa editorial, sem validação científica
              específica para Fortnite.
            </p>
            {j.snapshot.program.sources.map((r) => (
              <p key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>{" "}
                · {r.limitation}
              </p>
            ))}
            <ol>
              {road.data.events
                .filter((e) => e.journey_id === j.id)
                .slice(-100)
                .reverse()
                .map((e) => (
                  <li key={e.id}>
                    {new Date(e.created_at).toLocaleString("pt-BR", {
                      timeZone: j.config.timezone,
                    })}{" "}
                    · {e.action} ·{" "}
                    {j.snapshot.lessons.find(
                      (l) => l.article.id === e.lesson_id,
                    )?.article.title || "Ciclo"}{" "}
                    · {e.note}
                  </li>
                ))}
            </ol>
            <button
              className="button danger"
              onClick={() => setConfirm("delete")}
            >
              Excluir dados deste ciclo
            </button>
          </details>
        </>
      )}
      {setup && (
        <Modal
          title={editing ? "Ajustar minha jornada" : "Criar minha jornada"}
          onClose={() => setSetup(false)}
        >
          <p>
            Passo {formStep + 1} de 3 · somente informações necessárias ao
            planejamento.
          </p>
          {formStep === 0 && (
            <>
              <label>
                Modalidade da jornada
                <select
                  disabled={editing}
                  value={config.mode}
                  onChange={(e) => {
                    const mode = e.target.value as "build" | "zero";
                    setConfig({
                      ...config,
                      mode,
                      skills: [
                        {
                          id: mode === "zero" ? "zero-aim" : "crosshair",
                          weight: 3,
                        },
                      ],
                    });
                  }}
                >
                  <option value="build">Construção</option>
                  <option value="zero">Zero Build</option>
                </select>
              </label>
              <label>
                Experiência informada
                <select
                  disabled={editing}
                  value={experience}
                  onChange={(e) =>
                    setExperience(e.target.value as typeof experience)
                  }
                >
                  <option value="first">Nunca joguei / primeiro contato</option>
                  <option value="some">Conheço algumas mecânicas</option>
                  <option value="regular">
                    Jogo regularmente e quero revisar
                  </option>
                </select>
              </label>
              <label>
                Dispositivo
                <select
                  value={config.input}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      input: e.target.value as "kbm" | "controller",
                    })
                  }
                >
                  <option value="kbm">Teclado e mouse</option>
                  <option value="controller">Controle</option>
                </select>
              </label>
              <label>
                Preferência de prática
                <select
                  value={config.opposition}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      opposition: e.target
                        .value as EvolutionConfig["opposition"],
                    })
                  }
                >
                  <option value="solo">Sozinho</option>
                  <option value="friends">
                    Com amigos, quando eu organizar
                  </option>
                  <option value="opponents">Contra adversários</option>
                  <option value="mixed">Combinar opções</option>
                </select>
              </label>
              <label>
                Meu objetivo
                <input
                  maxLength={200}
                  value={config.objective}
                  onChange={(e) =>
                    setConfig({ ...config, objective: e.target.value })
                  }
                />
              </label>
              {!editing && (
                <label>
                  O que já conheço ou quero aprender? (opcional)
                  <textarea
                    maxLength={1000}
                    value={familiarity}
                    onChange={(e) => setFamiliarity(e.target.value)}
                  />
                </label>
              )}
              <label>
                Dificuldades percebidas (opcional)
                <textarea
                  maxLength={500}
                  value={config.difficulties}
                  onChange={(e) =>
                    setConfig({ ...config, difficulties: e.target.value })
                  }
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={config.baseline}
                  onChange={(e) =>
                    setConfig({ ...config, baseline: e.target.checked })
                  }
                />
                Quero uma primeira tentativa de avaliação prática, quando houver
                exercício compatível
              </label>
              <p>
                A avaliação de conceitos está disponível em cada aula, sem
                bloqueio por nota. Familiaridade declarada não é desempenho
                medido.
              </p>
            </>
          )}
          {formStep === 1 && (
            <>
              <label>
                Fuso horário
                <input
                  value={config.timezone}
                  onChange={(e) =>
                    setConfig({ ...config, timezone: e.target.value })
                  }
                />
              </label>
              <AvailabilityEditor config={config} onChange={setConfig} />
            </>
          )}
          {formStep === 2 && (
            <>
              <h3>Revisar meu ponto de partida</h3>
              <p>
                {config.mode === "build" ? "Construção" : "Zero Build"} ·{" "}
                {config.windows.length} intervalos autorizados ·{" "}
                {config.objective}
              </p>
              <p>
                Criar ou atualizar este ciclo não agenda atividades. Aulas e
                resultados permanecem separados. Horários serão propostos e
                confirmados posteriormente.
              </p>
              <button
                className="button primary"
                disabled={s.busy}
                onClick={() =>
                  void act(
                    async () => {
                      const check = roadConfigSchema.safeParse({
                        config,
                        experience,
                        familiarity,
                        start_date: dateInZone(new Date(), config.timezone),
                      });
                      if (!check.success)
                        throw new Error(
                          "kyrven: " +
                            check.error.issues.map((i) => i.message).join(" "),
                        );
                      const parsed = check.data;
                      if (editing && j)
                        await updateRoad(s.demo, j, parsed.config);
                      else {
                        const id = await createRoad(s.demo, parsed, s.catalog);
                        setSelected(id);
                      }
                      setSetup(false);
                      setProposal(null);
                    },
                    editing
                      ? "Preferências salvas; agenda existente preservada."
                      : "Jornada criada. Escolha uma aula para começar.",
                  )
                }
              >
                {editing
                  ? "Salvar preferências da jornada"
                  : "Confirmar criação da jornada"}
              </button>
            </>
          )}
          <div className="row">
            {formStep > 0 && (
              <button
                className="button"
                onClick={() => setFormStep(formStep - 1)}
              >
                Voltar
              </button>
            )}
            {formStep < 2 && (
              <button
                className="button"
                onClick={() => setFormStep(formStep + 1)}
              >
                Continuar
              </button>
            )}
          </div>
        </Modal>
      )}
      {lesson && j && (
        <Modal title={lesson.article.title} onClose={() => setLesson(null)}>
          <Badge>
            Etapa {lesson.stage} · versão {lesson.article.curriculum!.version}
          </Badge>
          <p>
            Conteúdo preservado do ciclo.{" "}
            <Link to={`/academy/${lesson.article.slug}`}>
              Consultar versão publicada e vídeos/fontes disponíveis
            </Link>
            .
          </p>
          <h3>Objetivo</h3>
          <ul>
            {lesson.article.curriculum!.objectives.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
          <h3>Conhecimento necessário</h3>
          {lesson.article.curriculum!.prerequisites.length ? (
            <ul>
              {lesson.article.curriculum!.prerequisites.map((p) => (
                <li key={p}>
                  <Link to={`/academy/${p}`}>
                    {j.snapshot.lessons.find((l) => l.article.slug === p)
                      ?.article.title || p}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhum conhecimento prévio obrigatório.</p>
          )}
          <h3>Explicação, exemplos e atividade guiada</h3>
          {lesson.article.body.split(/\n\n/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <h3>Critério de conclusão e avaliação</h3>
          <ul>
            {lesson.article.curriculum!.assessment.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p>
            Registre estudo apenas depois de realizar a leitura e explicar a
            ideia. Para comprovar prática, execute uma sessão e registre o
            resultado manualmente.
          </p>
          <h3>Exercícios relacionados</h3>
          {lesson.article.curriculum!.exercise_ids.map((id) => {
            const e = s.catalog.exercises.find(
              (e) =>
                e.id === id && (e.mode === "both" || e.mode === j.config.mode),
            );
            return e ? (
              <p key={id}>
                <Link to={`/library/${id}`}>
                  {e.title} · instruções, código verificado e fonte
                </Link>
              </p>
            ) : null;
          })}
          <button
            className="button"
            disabled={j.status !== "active"}
            onClick={() => {
              setStage(lesson.stage);
              setLesson(null);
              setProposal(null);
            }}
          >
            Planejar exercícios desta etapa
          </button>
          <h3>Conferir minha compreensão (opcional)</h3>
          {assessment.map((q, i) => (
            <fieldset key={q.id}>
              <legend>{q.prompt}</legend>
              {q.options.map((o, k) => (
                <label key={k}>
                  <input
                    type="radio"
                    name={`road-question-${q.id}`}
                    checked={answers[i] === k}
                    onChange={() =>
                      setAnswers((a) => {
                        const next = [...a];
                        next[i] = k;
                        return next;
                      })
                    }
                  />
                  {o}
                </label>
              ))}
            </fieldset>
          ))}
          {assessment.length > 0 && (
            <button
              className="button"
              disabled={
                s.busy ||
                j.status !== "active" ||
                answers.length !== assessment.length ||
                !assessment.every((_, i) => Number.isInteger(answers[i]))
              }
              onClick={() => void study("assessment")}
            >
              Registrar avaliação de conceitos
            </button>
          )}
          {progress?.assessments
            .filter((r) => r.lesson_id === lesson.article.id)
            .slice(-1)
            .map((r) => (
              <div role="status" key={r.id}>
                <p>
                  {assessmentResult(r.snapshot.questions, r.answers).correct}/
                  {r.snapshot.questions.length} respostas adequadas.
                </p>
                {r.snapshot.questions.map((q) => (
                  <p key={q.id}>{q.explanation}</p>
                ))}
              </div>
            ))}
          <label>
            Observação ou dificuldade (opcional)
            <textarea
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="row">
            <button
              className="button primary"
              disabled={s.busy || j.status !== "active"}
              onClick={() => void study("completed")}
            >
              Marcar estudo concluído
            </button>
            <button
              className="button"
              disabled={s.busy || j.status !== "active"}
              onClick={() => void study("reviewed")}
            >
              Registrar nova revisão
            </button>
            <button
              className="button"
              disabled={s.busy || j.status !== "active"}
              onClick={() => void study("skipped")}
            >
              Pular conteúdo que já conheço
            </button>
          </div>
          <h3>Próximo conteúdo sugerido</h3>
          {(() => {
            const next =
              j.snapshot.lessons[
                j.snapshot.lessons.findIndex(
                  (l) => l.article.id === lesson.article.id,
                ) + 1
              ];
            return next ? (
              <button
                className="text-link"
                onClick={() => {
                  setLesson(next);
                  setAnswers([]);
                  setNote("");
                }}
              >
                {next.article.title}
              </button>
            ) : (
              <p>
                Revise seus registros e escolha um próximo objetivo no
                relatório.
              </p>
            );
          })()}
          <details>
            <summary>Fontes e limites</summary>
            <p>{lesson.article.curriculum!.meta_scope}</p>
            {lesson.article.curriculum!.sources.map((r) => (
              <p key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>{" "}
                · {r.supports} · acesso: {r.access}
              </p>
            ))}
          </details>
        </Modal>
      )}
      {confirm && j && (
        <Modal
          title={
            confirm === "plan"
              ? "Confirmar minha semana"
              : confirm === "finish"
                ? "Encerrar ciclo de aprendizagem"
                : "Excluir ciclo de aprendizagem"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === "plan"
              ? "Salvar as rotinas e agendar somente as ocorrências revisadas desta semana? O servidor verificará novamente disponibilidade, modalidade e conflitos."
              : confirm === "finish"
                ? "Encerrar este ciclo e preservar estudo, avaliações e resultados? Isto não certifica domínio nem cancela compromissos existentes."
                : "Excluir este ciclo, seus vínculos e histórico da jornada? Treinos, calendário e registros gerais da Academy permanecem e podem ser gerenciados separadamente. Esta exclusão não pode ser desfeita."}
          </p>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() =>
              void act(
                async () => {
                  if (confirm === "plan" && proposal) {
                    await confirmRoad(
                      s.demo,
                      j,
                      stage,
                      proposal,
                      token,
                      s.catalog,
                    );
                    await s.refresh();
                    setProposal(null);
                  } else if (confirm === "finish")
                    await recordRoad(s.demo, j, "finish");
                  else if (confirm === "delete") {
                    await deleteRoad(s.demo, j);
                    setSelected("");
                  }
                  setConfirm(null);
                },
                confirm === "plan"
                  ? "Semana salva na agenda."
                  : confirm === "finish"
                    ? "Ciclo encerrado; relatório preservado."
                    : "Dados deste ciclo excluídos.",
              )
            }
          >
            {confirm === "plan"
              ? "Confirmar e agendar esta semana"
              : confirm === "finish"
                ? "Confirmar encerramento do ciclo"
                : "Confirmar exclusão do ciclo"}
          </button>
        </Modal>
      )}
    </div>
  );
}
