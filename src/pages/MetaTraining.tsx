import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { loadMeta } from "../lib/meta-service";
import {
  currentEntries,
  exerciseRelations,
  attachContext,
  contextAlerts,
  contextLabel,
  historicalContext,
} from "../lib/meta-training/context";
import {
  loadCompetitivePreferences,
  saveCompetitivePreferences,
  studyNotes,
  saveStudyNote,
  type CompetitivePreferences,
  type StudyNote,
} from "../lib/meta-training/service";
import type { MetaCatalog } from "../lib/meta";
import type { Plan } from "../lib/types";
import { labels } from "../lib/types";
import { knowledge } from "../lib/training-research";
import { Heading, Modal, Empty } from "../components/ui";
import { TrainingBuilder } from "../components/TrainingBuilder";
export default function MetaTraining() {
  const s = useStore(),
    p = s.data.profile!;
  const [meta, setMeta] = useState<MetaCatalog | null>(null),
    [error, setError] = useState(""),
    [prefs, setPrefs] = useState<CompetitivePreferences>({
      primary_mode: p.mode === "build" ? "br-build" : "br-zero",
      secondary_modes: [],
      format: "solo",
      meta_context_id: null,
      team_preference: "mixed",
    });
  const [skill, setSkill] = useState(""),
    [level, setLevel] = useState("all"),
    [draft, setDraft] = useState<Plan | null>(null),
    [notes, setNotes] = useState<StudyNote[]>([]),
    [selectedNote, setSelectedNote] = useState<StudyNote | null>(null),
    [query, setQuery] = useState(""),
    [editing, setEditing] = useState(false),
    [page, setPage] = useState(1);
  useEffect(() => {
    let active = true;
    Promise.all([
      loadMeta(s.demo),
      loadCompetitivePreferences(s.demo, p.id),
      studyNotes(s.demo, p.id),
    ])
      .then(([m, pref, n]) => {
        if (active) {
          setMeta(m);
          if (pref) setPrefs(pref);
          setNotes(n);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [s.demo, p.id]);
  useEffect(() => {
    setPage(1);
  }, [query, skill, level, prefs.primary_mode, prefs.meta_context_id]);
  if (!meta)
    return (
      <section className="panel" aria-live="polite">
        {error || "Carregando contexto editorial…"}
      </section>
    );
  const context = meta.contexts.find((c) => c.id === prefs.meta_context_id),
    mode = meta.modes.find((m) => m.id === prefs.primary_mode),
    actualMode = mode?.construction ? "build" : "zero";
  const entries = currentEntries(meta, context?.id || "");
  const exercises = s.catalog.exercises.filter(
    (e) =>
      e.published &&
      (e.mode === "both" || e.mode === actualMode) &&
      e.research?.review_status === "verified" &&
      Date.parse(e.research.review_due_at) > Date.now() &&
      Date.parse(e.verified_at) <= Date.now() &&
      !(p.input === "controller" && e.tags?.includes("kbm-only")) &&
      !(p.input === "kbm" && e.tags?.includes("controller-only")) &&
      (level === "all" || e.level === level) &&
      (!skill || e.research.competency_ids.includes(skill)) &&
      e.title
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
  );
  const contexts = meta.contexts.filter(
    (c) => c.mode_id === prefs.primary_mode,
  );
  function add(id: string) {
    const base = draft || {
      id: crypto.randomUUID(),
      user_id: p.id,
      title: "Prática contextual",
      objective: "Observar uma habilidade no contexto selecionado",
      mode: actualMode,
      level: p.level,
      practice_format: prefs.format as Plan["practice_format"],
      steps: [],
    };
    const next = {
      ...base,
      steps: [
        ...base.steps,
        { id: crypto.randomUUID(), exercise_id: id, minutes: 10 },
      ],
    };
    setDraft(
      context
        ? attachContext(next, meta!, {
            context_id: context.id,
            entry_ids: entries.slice(0, 12).map((e) => e.id),
          })
        : next,
    );
  }
  return (
    <div className="meta-training context-workbench">
      <Heading
        eyebrow="CONTEXTO → PRÁTICA → REVISÃO"
        title="Meta Training Center"
        description="Escolha o contexto, consulte relações editoriais e combine exercícios reais. Fundamentos gerais não confirmam o meta de uma temporada."
        action={
          <Link className="button" to="/app/teams">
            Minhas equipes
          </Link>
        }
      />
      {error && (
        <p role="alert" className="alert">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>Meu perfil competitivo</h2>
        <div className="form-grid">
          <label>
            Modalidade principal
            <select
              value={prefs.primary_mode}
              onChange={(e) => {
                setPrefs({
                  ...prefs,
                  primary_mode: e.target.value,
                  secondary_modes: prefs.secondary_modes.filter(
                    (id) => id !== e.target.value,
                  ),
                  meta_context_id: null,
                });
                setDraft(null);
              }}
            >
              {meta.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Formato de prática
            <select
              value={prefs.format}
              onChange={(e) => setPrefs({ ...prefs, format: e.target.value })}
            >
              {meta.formats
                .filter((f) => f.size === null || f.size <= 3)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Preferência de sessões
            <select
              value={prefs.team_preference}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  team_preference: e.target
                    .value as CompetitivePreferences["team_preference"],
                })
              }
            >
              <option value="individual">Individual</option>
              <option value="team">Em equipe</option>
              <option value="mixed">Mista</option>
            </select>
          </label>
          <label>
            Versão e contexto verificados
            <select
              value={prefs.meta_context_id || ""}
              onChange={(e) => {
                setPrefs({ ...prefs, meta_context_id: e.target.value || null });
                setDraft(null);
              }}
            >
              <option value="">Sem contexto confirmado</option>
              {contexts.map((c) => (
                <option key={c.id} value={c.id}>
                  {meta.versions.find((v) => v.id === c.version_id)?.patch} ·{" "}
                  {c.play_context} ·{" "}
                  {meta.formats.find((f) => f.id === c.format_id)?.title} ·{" "}
                  {c.region}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Modalidades secundárias</legend>
          {meta.modes
            .filter((m) => m.id !== prefs.primary_mode)
            .map((m) => (
              <label className="checkbox-label" key={m.id}>
                <input
                  type="checkbox"
                  checked={prefs.secondary_modes.includes(m.id)}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      secondary_modes: e.target.checked
                        ? [...prefs.secondary_modes, m.id]
                        : prefs.secondary_modes.filter((x) => x !== m.id),
                    })
                  }
                />
                {m.title}
              </label>
            ))}
        </fieldset>
        <p className="muted">
          Formato de prática não confirma formato ou elegibilidade de torneios.
          Nível, dispositivo e disponibilidade são ajustados no plano de
          evolução.
        </p>
        <button
          className="button primary"
          disabled={s.busy}
          onClick={() =>
            void s.run(
              () => saveCompetitivePreferences(s.demo, p.id, prefs),
              "Preferências salvas; sua agenda não foi alterada.",
            )
          }
        >
          Salvar perfil competitivo
        </button>{" "}
        <Link className="button" to="/app/evolution-plan">
          Planejar minha semana
        </Link>
      </section>
      {context && (
        <section className="panel">
          <h2>Contexto disponível</h2>
          {historicalContext(meta, context.id) && (
            <p className="alert">
              Contexto histórico: há uma versão posterior cadastrada. Estas
              fontes não confirmam a temporada atual.
            </p>
          )}
          <p>
            {meta.versions.find((v) => v.id === context.version_id)?.season} ·{" "}
            {context.id}
          </p>
          <p>
            {entries.length} registros atuais confirmados. Não há cobertura
            equivalente para todos os formatos.
          </p>
          <Link
            className="button"
            to={`/app/coach?meta_context=${context.id}&q=${encodeURIComponent("O que mudou neste contexto do jogo?")}`}
          >
            Consultar kyrven coach
          </Link>
          {entries.slice(0, 12).map((e) => (
            <details key={e.id}>
              <summary>
                {e.title} · revisão {e.revision}
              </summary>
              <p>{e.body}</p>
              <p className="muted">
                {e.limitations} · revisão até {e.review_due.slice(0, 10)}
              </p>
              <Link to={`/competitive/meta/${e.id}`}>Fontes e histórico</Link>
              {e.kind === "location" && (
                <button
                  className="button"
                  onClick={() =>
                    setSelectedNote(
                      notes.find((n) => n.entry_id === e.id) || {
                        id: crypto.randomUUID(),
                        user_id: p.id,
                        entry_id: e.id,
                        favorite: false,
                        note: "",
                        updated_at: new Date().toISOString(),
                      },
                    )
                  }
                >
                  Notas privadas e favorito
                </button>
              )}
            </details>
          ))}
        </section>
      )}
      <section className="panel">
        <h2>Exercícios e habilidades</h2>
        <p aria-live="polite">
          {draft?.steps.length || 0} etapa(s) selecionada(s) ·{" "}
          {draft?.steps.reduce((sum, step) => sum + step.minutes, 0) || 0}{" "}
          minutos planejados.
        </p>
        {draft && (
          <button className="button primary" onClick={() => setEditing(true)}>
            Editar seleção
          </button>
        )}
        <div className="form-grid">
          <label>
            Pesquisar exercício
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            Habilidade
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Todas as habilidades</option>
              {knowledge.competencies
                .filter((k) => k.mode === "both" || k.mode === actualMode)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.title}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Nível
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">Todos</option>
              {["beginner", "intermediate", "advanced"].map((l) => (
                <option key={l} value={l}>
                  {labels[l]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="two-grid">
          {exercises.slice((page - 1) * 8, page * 8).map((e) => {
            const relations = context
              ? exerciseRelations(meta, e, context.id)
              : [];
            return (
              <article className="panel" key={e.id}>
                <h3>{e.title}</h3>
                <p>{e.description}</p>
                <p>
                  {labels[e.level]} · {e.metric}
                </p>
                {relations.map((r) => (
                  <p
                    className="context-evidence evidence-note"
                    key={r.entry.id + ":" + r.reason}
                  >
                    {r.entry.title}: {r.reason}{" "}
                    <Link to={`/competitive/meta/${r.entry.id}`}>
                      Evidência e limitações
                    </Link>
                  </p>
                ))}
                {!relations.length && (
                  <p className="muted">
                    Fundamento geral; nenhuma relação atual verificada com o
                    contexto selecionado.
                  </p>
                )}
                <Link to={`/library/${e.id}`}>
                  Instruções e mapa verificado
                </Link>{" "}
                <button className="button" onClick={() => add(e.id)}>
                  Adicionar à rotina
                </button>
              </article>
            );
          })}
        </div>
        {exercises.length > 8 && (
          <div className="row" aria-label="Páginas dos exercícios">
            <button
              className="button"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Exercícios anteriores
            </button>
            <span aria-live="polite">
              Página {page} de {Math.ceil(exercises.length / 8)} ·{" "}
              {exercises.length} exercícios
            </span>
            <button
              className="button"
              disabled={page * 8 >= exercises.length}
              onClick={() => setPage(page + 1)}
            >
              Próximos exercícios
            </button>
          </div>
        )}
        {!exercises.length && (
          <Empty title="Sem exercícios compatíveis">
            Ajuste os filtros. O catálogo não inventa atividades para preencher
            lacunas.
          </Empty>
        )}
      </section>
      {draft && (
        <section className="panel">
          <h2>Minha seleção · {draft.steps.length} etapa(s)</h2>
          <p>{contextLabel(draft.game_context)}</p>
          <button className="button primary" onClick={() => setEditing(true)}>
            Editar e salvar rotina
          </button>
          {editing && (
            <TrainingBuilder
              plan={draft}
              onClose={() => {
                setDraft(null);
                setEditing(false);
              }}
            />
          )}
        </section>
      )}
      <section className="panel">
        <h2>Revisões opcionais das minhas rotinas</h2>
        {s.data.plans
          .filter((p) => p.game_context)
          .map((p) => (
            <article key={p.id}>
              <h3>{p.title}</h3>
              {contextAlerts(meta, p.game_context!).length ? (
                contextAlerts(meta, p.game_context!).map((a) => (
                  <p className="alert" key={a}>
                    {a}
                  </p>
                ))
              ) : (
                <p>
                  {p.game_context!.entries.length
                    ? "As referências registradas continuam dentro da validade editorial."
                    : "Este plano registra o contexto, mas não possui referências atuais do meta. Os exercícios são fundamentos gerais."}
                </p>
              )}
              <Link to="/app/planner">
                Revisar manualmente antes de alterar
              </Link>
            </article>
          ))}
      </section>
      {selectedNote && (
        <Modal
          title="Estudo do mapa · nota privada"
          onClose={() => setSelectedNote(null)}
        >
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={selectedNote.favorite}
              onChange={(e) =>
                setSelectedNote({ ...selectedNote, favorite: e.target.checked })
              }
            />
            Salvar local favorito
          </label>
          <label>
            Minha nota
            <textarea
              maxLength={4000}
              value={selectedNote.note}
              onChange={(e) =>
                setSelectedNote({ ...selectedNote, note: e.target.value })
              }
            />
          </label>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() =>
              void s.run(async () => {
                await saveStudyNote(s.demo, p.id, {
                  ...selectedNote,
                  updated_at: new Date().toISOString(),
                });
                setNotes(await studyNotes(s.demo, p.id));
                setSelectedNote(null);
              }, "Nota privada salva.")
            }
          >
            Salvar nota
          </button>
        </Modal>
      )}
    </div>
  );
}
