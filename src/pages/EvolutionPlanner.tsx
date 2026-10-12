import { JourneyNav } from "../components/experience/JourneyNav";
import type { Plan } from "../lib/types";
import { loadCompetitivePreferences } from "../lib/meta-training/service";
import { loadMeta } from "../lib/meta-service";
import { ContextSelector } from "../components/meta-training/ContextSelector";
import { currentEntries, attachContext } from "../lib/meta-training/context";
import type { MetaCatalog } from "../lib/meta";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import { dateInZone, shiftDate, weekday, weekStart } from "../lib/calendar";
import {
  defaultEvolutionConfig,
  evolutionConfigSchema,
  type EvolutionConfig,
} from "../lib/skill-maxing/config";
import {
  generateEvolution,
  rules,
  type EvolutionProposal,
} from "../lib/skill-maxing/engine";
import {
  confirmEvolution,
  loadEvolutionConfig,
  saveEvolutionConfig,
} from "../lib/skill-maxing/service";
import { knowledge } from "../lib/training-research";
import { AvailabilityEditor } from "../components/skill-maxing/AvailabilityEditor";
import { SkillPreferences } from "../components/skill-maxing/SkillPreferences";
import { EvolutionPreview } from "../components/skill-maxing/EvolutionPreview";
import { WeeklyReview } from "../components/skill-maxing/WeeklyReview";
import { Heading, Modal } from "../components/ui";
import { useStudy } from "../lib/useStudy";
export default function EvolutionPlanner() {
  const s = useStore(),
    study = useStudy(),
    p = s.data.profile!,
    navigate = useNavigate();
  const [config, setConfig] = useState(() => defaultEvolutionConfig(p));
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState(() =>
    shiftDate(weekStart(dateInZone(new Date(), p.timezone)), 7),
  );
  const [weeks, setWeeks] = useState(1);
  const [manual, setManual] = useState(false);
  const [proposal, setProposal] = useState<EvolutionProposal | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaCatalog | null>(null);
  const [contextId, setContextId] = useState("");
  const [practiceFormat, setPracticeFormat] =
    useState<NonNullable<Plan["practice_format"]>>("unspecified");
  const token = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setLoading(true);
    setProposal(null);
    setConfig(defaultEvolutionConfig(p));
    Promise.all([
      loadEvolutionConfig(s.demo),
      loadCompetitivePreferences(s.demo, p.id),
    ])
      .then(async ([saved, pref]) => {
        const initial = saved || defaultEvolutionConfig(p);
        const catalog = pref ? await loadMeta(s.demo) : null;
        if (!active) return;
        if (pref && catalog) {
          const mode = catalog.modes.find((m) => m.id === pref.primary_mode)
            ?.construction
            ? "build"
            : "zero";
          const compatible = initial.skills.filter((s) =>
            knowledge.competencies.some(
              (k) => k.id === s.id && (k.mode === mode || k.mode === "both"),
            ),
          );
          setConfig({
            ...initial,
            mode,
            skills: compatible.length
              ? compatible
              : [{ id: mode === "zero" ? "zero-aim" : "shotgun", weight: 3 }],
          });
          setPracticeFormat(
            pref.format as NonNullable<Plan["practice_format"]>,
          );
          setMeta(catalog);
          setContextId(pref.meta_context_id || "");
        } else setConfig(initial);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível carregar as preferências. Confira modalidade, objetivos e contexto antes de preparar um novo plano.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [p.id, s.demo]);
  const change = (c: EvolutionConfig) => {
    setConfig(c);
    setProposal(null);
    setConfirmation(false);
    setError("");
    token.current = crypto.randomUUID();
  };
  const previewChange = (next: EvolutionProposal) => {
    setProposal(next);
    setConfirmation(false);
    token.current = crypto.randomUUID();
  };
  const tournaments = s.catalog.tournaments.filter(
    (t) =>
      t.published &&
      t.confirmation === "confirmed" &&
      t.status === "scheduled" &&
      Date.parse(t.valid_until) > Date.now() &&
      (t.mode === "both" || t.mode === config.mode) &&
      s.data.bookmarks.some(
        (b) =>
          b.user_id === p.id && b.kind === "tournament" && b.target_id === t.id,
      ),
  );
  function prepare() {
    try {
      const parsed = evolutionConfigSchema.safeParse(config);
      if (!parsed.success)
        throw new Error(parsed.error.issues.map((i) => i.message).join(" "));
      const c = parsed.data;
      if (!manual)
        setProposal(
          generateEvolution(
            c,
            s.data,
            s.catalog,
            from,
            weeks,
            new Date(),
            meta && contextId
              ? {
                  catalog: meta,
                  selection: {
                    context_id: contextId,
                    entry_ids: currentEntries(meta, contextId)
                      .slice(0, 12)
                      .map((e) => e.id),
                  },
                }
              : undefined,
            practiceFormat,
            study.error || study.loading
              ? undefined
              : { owner_id: p.id, records: study.data.records },
          ),
        );
      else {
        const sessions: Array<EvolutionProposal["sessions"][number]> = [];
        for (let i = 0; i < 7; i++) {
          const date = shiftDate(from, i),
            window = c.windows
              .filter((w) => w.weekday === weekday(date))
              .sort((a, b) => a.start.localeCompare(b.start))[0];
          if (window)
            sessions.push({
              id: crypto.randomUUID(),
              date,
              time: window.start,
              skill_ids: [],
              reasons: [
                "Sessão montada manualmente; você escolhe exercícios, blocos e parâmetros.",
              ],
              plan: {
                id: crypto.randomUUID(),
                user_id: p.id,
                title: `Meu treino · ${date}`,
                mode: c.mode,
                practice_format: practiceFormat,
                level: c.level,
                objective: c.objective,
                steps: [],
              },
            });
        }
        setProposal({
          from,
          weeks,
          config: c,
          practice_format: practiceFormat,
          rules_version: rules.version,
          sessions:
            meta && contextId
              ? sessions.map((s) => ({
                  ...s,
                  plan: attachContext(s.plan, meta, {
                    context_id: contextId,
                    entry_ids: currentEntries(meta, contextId)
                      .slice(0, 12)
                      .map((e) => e.id),
                  }),
                }))
              : sessions,
          meta:
            meta && contextId
              ? {
                  context_id: contextId,
                  entry_ids: currentEntries(meta, contextId)
                    .slice(0, 12)
                    .map((e) => e.id),
                }
              : undefined,
          warnings: [
            "Modo manual: edite cada rotina para incluir suas atividades. Confirme somente depois de revisar os horários.",
          ],
        });
      }
      setError("");
      token.current = crypto.randomUUID();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Confira as preferências e disponibilidade.",
      );
    }
  }
  function focus(key: string) {
    const mapping: Record<string, string[]> = {
      tracking: ["tracking"],
      accuracy: ["shotgun", "zero-aim"],
      piece: ["piece-ownership"],
      editing: ["editing"],
      movement: ["movement", "zero-movement"],
      rotations: ["rotation", "zero-rotation"],
      endgame: ["zone-wars", "zero-endgame"],
      decisions: ["information"],
      box_fights: ["box-fight"],
    };
    const id = mapping[key]?.find((id) =>
      knowledge.competencies.some(
        (k) => k.id === id && (k.mode === "both" || k.mode === config.mode),
      ),
    );
    if (!id) {
      setError(
        "Esse relato pede revisão de disponibilidade ou do objetivo, sem exercício específico confirmado para a modalidade.",
      );
      return;
    }
    if (config.skills.length >= 12 && !config.skills.some((s) => s.id === id)) {
      setError("Remova uma competência antes de incluir um novo foco.");
      return;
    }
    change({
      ...config,
      skills: [...config.skills.filter((s) => s.id !== id), { id, weight: 4 }],
    });
    setStep(0);
  }
  return (
    <div className="evolution-planner surface-skillmax">
      <Link className="text-link" to="/app/planner">
        Voltar ao planejador
      </Link>
      <label>
        Formato de prática
        <select
          value={practiceFormat}
          onChange={(e) => {
            setPracticeFormat(
              e.target.value as NonNullable<Plan["practice_format"]>,
            );
            setProposal(null);
            setConfirmation(false);
            token.current = crypto.randomUUID();
          }}
        >
          <option value="unspecified">Não especificado</option>
          <option value="solo">Solo</option>
          <option value="duo">Duplas</option>
          <option value="trio">Trios · grupo de prática</option>
          <option value="squad">Esquadrões · grupo de prática</option>
        </select>
      </label>
      <ContextSelector
        mode={config.mode}
        value={contextId}
        onChange={(id, catalog) => {
          setMeta(catalog);
          setContextId(id);
          setProposal(null);
          setConfirmation(false);
          token.current = crypto.randomUUID();
        }}
      />
      <Heading
        eyebrow="SKILL MAXING ENGINE"
        title="Criar meu plano de evolução"
        description="Combine habilidades, escolha uma disponibilidade possível e revise uma proposta explicável. Regras editoriais, sem seleção aleatória ou promessa de resultados."
      />
      {study.loading ? (
        <p role="status">
          Consultando aulas estudadas para relacionar teoria e prática…
        </p>
      ) : study.error ? (
        <p role="alert">
          {study.error} O plano pode ser gerado sem esse contexto.{" "}
          <button className="button small" onClick={() => void study.refresh()}>
            Consultar estudo novamente
          </button>
        </p>
      ) : (
        <p className="muted">
          Aulas estudadas na versão atual podem priorizar exercícios vinculados
          editorialmente. Isso não mede domínio e não impede escolher outras
          atividades.
        </p>
      )}
      <div className="row">
        <button
          className={`button ${!manual ? "primary" : ""}`}
          aria-pressed={!manual}
          onClick={() => {
            setManual(false);
            setProposal(null);
          }}
        >
          Modo assistido
        </button>
        <button
          className={`button ${manual ? "primary" : ""}`}
          aria-pressed={manual}
          onClick={() => {
            setManual(true);
            setProposal(null);
          }}
        >
          Modo manual
        </button>
        <Link className="button" to="/app/planner">
          Minhas rotinas e calendário
        </Link>
      </div>
      {s.demo && (
        <p className="alert">
          Demonstração identificada: preferências e planos são salvos apenas
          neste navegador. Não há dados de contas reais neste modo.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p role="status">Consultando preferências…</p>
      ) : (
        <>
      <JourneyNav />
          <nav className="plan-step-index" aria-label="Etapas do plano de evolução">
            {[
              "Perfil e habilidades",
              "Disponibilidade",
              "Preferências e prévia",
            ].map((name, i) => (
              <button
                className="button"
                key={name}
                aria-current={step === i ? "step" : undefined}
                onClick={() => setStep(i)}
              >
                {i + 1}. {name}
              </button>
            ))}
          </nav>
          {step === 0 && (
            <>
              <section className="panel">
                <h2>Meu contexto de treinamento</h2>
                <div className="form-grid">
                  <label>
                    Experiência de treinamento
                    <select
                      value={config.level}
                      onChange={(e) =>
                        change({
                          ...config,
                          level: e.target.value as EvolutionConfig["level"],
                        })
                      }
                    >
                      <option value="beginner">Iniciante</option>
                      <option value="intermediate">Intermediário</option>
                      <option value="advanced">Avançado</option>
                    </select>
                  </label>
                  <label>
                    Modalidade do plano
                    <select
                      value={config.mode}
                      onChange={(e) => {
                        const mode = e.target.value as EvolutionConfig["mode"];
                        change({
                          ...config,
                          mode,
                          skills: config.skills.filter((s) =>
                            knowledge.competencies.some(
                              (k) =>
                                k.id === s.id &&
                                (k.mode === "both" || k.mode === mode),
                            ),
                          ),
                          tournament_id: null,
                        });
                      }}
                    >
                      <option value="build">Construção</option>
                      <option value="zero">Construção Zero</option>
                    </select>
                  </label>
                  <label>
                    Dispositivo do plano
                    <select
                      value={config.input}
                      onChange={(e) =>
                        change({
                          ...config,
                          input: e.target.value as EvolutionConfig["input"],
                        })
                      }
                    >
                      <option value="kbm">Teclado e mouse</option>
                      <option value="controller">Controle</option>
                    </select>
                  </label>
                  <label>
                    Objetivo principal do plano
                    <input
                      maxLength={200}
                      value={config.objective}
                      onChange={(e) =>
                        change({ ...config, objective: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Dificuldades percebidas (opcional)
                    <textarea
                      maxLength={500}
                      value={config.difficulties}
                      onChange={(e) =>
                        change({ ...config, difficulties: e.target.value })
                      }
                    />
                  </label>
                </div>
                <p className="muted">
                  Relatos livres não são diagnósticos. Escolha abaixo
                  competências relacionadas se quiser priorizá-las; os diários
                  registrados também podem orientar propostas.
                </p>
              </section>
              <SkillPreferences config={config} onChange={change} />
            </>
          )}
          {step === 1 && (
            <>
              <section className="panel">
                <label>
                  Fuso do planejamento
                  <input
                    maxLength={100}
                    value={config.timezone}
                    onChange={(e) =>
                      change({ ...config, timezone: e.target.value })
                    }
                    placeholder="America/Sao_Paulo"
                  />
                </label>
                <p>
                  Datas e horários serão interpretados neste fuso IANA. Mudanças
                  de horário que eliminam um horário não serão agendadas.
                </p>
              </section>
              <AvailabilityEditor config={config} onChange={change} />
            </>
          )}
          {step === 2 && (
            <section className="panel">
              <h2>Como quero praticar?</h2>
              <div className="form-grid">
                <label>
                  Preferência de parceiros
                  <select
                    value={config.opposition}
                    onChange={(e) =>
                      change({
                        ...config,
                        opposition: e.target
                          .value as EvolutionConfig["opposition"],
                      })
                    }
                  >
                    <option value="mixed">Sem preferência / misto</option>
                    <option value="solo">Sozinho</option>
                    <option value="friends">Com amigos</option>
                    <option value="opponents">Contra adversários</option>
                  </select>
                </label>
                <label>
                  Perfil da sessão
                  <select
                    value={config.style}
                    onChange={(e) =>
                      change({
                        ...config,
                        style: e.target.value as EvolutionConfig["style"],
                      })
                    }
                  >
                    <option value="habitual">
                      Tempo que escolhi em cada dia
                    </option>
                    <option value="short">
                      Curto · até 20 minutos, editável na prévia
                    </option>
                    <option value="review">Revisão / análise</option>
                  </select>
                </label>
                <label>
                  Campeonato favorito como objetivo (opcional)
                  <select
                    value={config.tournament_id || ""}
                    onChange={(e) =>
                      change({
                        ...config,
                        tournament_id: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Sem campeonato</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} · {t.start_date}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Segunda-feira de início
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setProposal(null);
                      setConfirmation(false);
                    }}
                  />
                </label>
                <label>
                  Repetir organização por semanas
                  <select
                    value={weeks}
                    onChange={(e) => {
                      setWeeks(Number(e.target.value));
                      setProposal(null);
                      setConfirmation(false);
                    }}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n} semana(s)
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="row">
                <input
                  type="checkbox"
                  checked={config.competitive}
                  onChange={(e) =>
                    change({ ...config, competitive: e.target.checked })
                  }
                />
                Tenho interesse em partidas competitivas
              </label>
              <label className="row">
                <input
                  type="checkbox"
                  checked={config.baseline}
                  onChange={(e) =>
                    change({ ...config, baseline: e.target.checked })
                  }
                />
                Quero começar com um registro de avaliação inicial
              </label>
              <p>
                O limite do perfil curto é uma escolha de produto, não uma
                duração científica ideal. Uma avaliação inicial usa o protocolo
                do exercício e exige resultado manual. Não há matchmaking ou
                abertura automática de mapas no Fortnite.
              </p>
              {!tournaments.length && (
                <p>
                  Nenhum campeonato favorito com confirmação atual disponível
                  para este contexto. Não inventamos datas ou horários.
                </p>
              )}
              <div className="row">
                <button
                  className="button"
                  disabled={s.busy}
                  onClick={() =>
                    void s.run(
                      () => saveEvolutionConfig(s.demo, config),
                      "Preferências salvas; agenda não alterada.",
                    )
                  }
                >
                  Salvar apenas minhas preferências
                </button>
                <button className="button primary" onClick={prepare}>
                  {manual ? "Montar prévia manual" : "Gerar prévia explicada"}
                </button>
              </div>
            </section>
          )}
          <div className="row">
            {step > 0 && (
              <button className="button" onClick={() => setStep(step - 1)}>
                Voltar etapa
              </button>
            )}
            {step < 2 && (
              <button
                className="button primary"
                onClick={() => setStep(step + 1)}
              >
                Continuar etapa
              </button>
            )}
          </div>
          {proposal && (
            <EvolutionPreview
              proposal={proposal}
              onChange={previewChange}
              onConfirm={() => setConfirmation(true)}
            />
          )}
          <WeeklyReview onFocus={focus} />
          <section className="panel">
            <h2>Como verificar se está funcionando?</h2>
            <p>
              Registre conclusão, resultado e dificuldades. Compare somente o
              mesmo exercício, cenário, dispositivo, configuração, unidade e
              versão. Ao final da semana, revise os registros e escolha ajustes
              sem aumentar automaticamente a carga.
            </p>
            <Link to="/academy/research?view=method">
              Metodologia, fontes e limites de aplicação
            </Link>
            {" · "}
            <Link to="/app/training">Execução e histórico</Link>
          </section>
        </>
      )}
      {confirmation && proposal && (
        <Modal
          title="Confirmar meu plano de evolução"
          onClose={() => setConfirmation(false)}
        >
          <p>
            Adicionar {proposal.sessions.length} rotinas e suas séries semanais
            por {proposal.weeks} semana(s), no fuso {config.timezone}? As
            atividades existentes serão preservadas.
          </p>
          <ul>
            {proposal.sessions.map((session) => (
              <li key={session.id}>
                {session.date} · {session.time} ·{" "}
                {session.plan.steps.reduce((n, st) => n + st.minutes, 0)} min
              </li>
            ))}
          </ul>
          <p>
            A operação só será concluída se todas as sessões continuarem válidas
            e sem conflitos.
          </p>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() =>
              void s.run(async () => {
                await confirmEvolution(
                  s.demo,
                  token.current,
                  proposal,
                  s.catalog,
                );
                await s.refresh();
                navigate("/app/planner");
              }, "Plano confirmado e adicionado à agenda.")
            }
          >
            Confirmar e salvar plano na agenda
          </button>
          <button
            className="button"
            disabled={s.busy}
            onClick={() => setConfirmation(false)}
          >
            Cancelar confirmação
          </button>
        </Modal>
      )}
    </div>
  );
}
