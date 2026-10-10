import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  knowledge,
  searchCompetencies,
  pathExercises,
  evidenceLabels,
  accessLabels,
} from "../lib/training-research";
import { trainingCategories } from "../lib/training";
import { useStore } from "../lib/store";
import { useSEO } from "../lib/seo";
import type { Plan } from "../lib/types";
import { labels } from "../lib/types";
import { Heading, Badge, Empty } from "../components/ui";
import { TrainingBuilder } from "../components/TrainingBuilder";
export default function TrainingResearch() {
  const s = useStore();
  const [params, setParams] = useSearchParams();
  const tab = params.get("view") || "skills";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [mode, setMode] = useState("all");
  const [draft, setDraft] = useState<Plan | null>(null);
  const [minutes, setMinutes] = useState(5);
  useSEO(
    "Ciência e prática de treinamento",
    "Competências, trilhas editáveis e referências com limites explícitos para praticar Fortnite com intenção.",
  );
  const list = searchCompetencies(query, category, mode);
  return (
    <>
      <Link to="/academy" className="text-link">
        Voltar à Academy
      </Link>
      <Heading
        eyebrow="BASE DE CONHECIMENTO"
        title="Entenda o que você está treinando."
        description="Pesquisa informa a prática; seus registros ajudam a avaliar o que acontece. Nossa metodologia é editorial e ainda não foi validada como intervenção em Fortnite."
      />
      <p className="muted small-text">
        Curadoria: 10/10/2026 · versão {knowledge.version}. Não é um feed
        automático. Nenhum vídeo foi analisado audiovisualmente e nenhum mapa
        foi testado dentro do jogo nesta pesquisa.
      </p>
      <nav className="tabs page-tabs" aria-label="Conteúdo de treinamento">
        {Object.entries({
          skills: "Habilidades e glossário",
          paths: "Trilhas de prática",
          method: "Metodologia",
          sources: "Fontes e limites",
        }).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => setParams({ view: id })}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "skills" && (
        <>
          <div className="filters panel">
            <label>
              Buscar competência
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ex.: rotação, peek, tracking"
              />
            </label>
            <label>
              Categoria de habilidade
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">Todas</option>
                {Object.entries(trainingCategories).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Modalidade da habilidade
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="all">Todas</option>
                <option value="build">Construção</option>
                <option value="zero">Construção Zero</option>
              </select>
            </label>
          </div>
          <p role="status">
            {list.length} competências · definições e exemplos editoriais
          </p>
          <div className="two-grid">
            {list.map((c) => (
              <article className="panel" key={c.id}>
                <span className="eyebrow">
                  {trainingCategories[c.category]} · {c.subcategory}
                </span>
                <h2>{c.title}</h2>
                <Badge>{labels[c.mode]}</Badge>
                <p>{c.definition}</p>
                <details>
                  <summary>Contexto e exemplo</summary>
                  <p>
                    <strong>Quando aparece:</strong> {c.context}
                  </p>
                  <p>
                    <strong>O que observar:</strong> {c.example}
                  </p>
                </details>
                <Link className="text-link" to={`/library?competency=${c.id}`}>
                  Encontrar exercícios relacionados
                </Link>
              </article>
            ))}
          </div>
          {!list.length && (
            <Empty title="Nenhuma competência encontrada">
              Ajuste a modalidade ou use outra palavra.
            </Empty>
          )}
        </>
      )}
      {tab === "method" && (
        <div className="two-grid">
          {knowledge.principles.map((p, i) => (
            <article className="panel" key={p.id}>
              <span className="eyebrow">
                ETAPA {i + 1} · RECOMENDAÇÃO EDITORIAL
              </span>
              <h2>{p.title}</h2>
              <p>{p.body}</p>
              <p className="small-text">
                Referências:{" "}
                {p.evidence_ids.map((id) => (
                  <Link key={id} to={`?view=sources#${id}`}>
                    {knowledge.references.find((r) => r.id === id)?.title}
                    {" · "}
                  </Link>
                ))}
              </p>
            </article>
          ))}
        </div>
      )}
      {tab === "paths" && (
        <>
          <div className="panel">
            <h2>Escolha uma pergunta, ajuste a rotina.</h2>
            <p>
              As trilhas são exemplos editáveis, não protocolos cientificamente
              superiores. Confira cada exercício e ajuste a duração antes de
              salvar. Abertura do editor não agenda nem inicia uma sessão.
            </p>
            <label>
              Minutos iniciais por etapa
              <input
                type="number"
                min={1}
                max={60}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
            <p className="small-text muted">
              Valor ilustrativo. Não representa uma dose ótima de treinamento.
            </p>
          </div>
          <div className="two-grid">
            {knowledge.paths.map((p) => {
              const resolved = pathExercises(p.id, s.catalog.exercises);
              const incompatible =
                s.data.profile?.mode === "zero" && p.mode === "build";
              return (
                <article className="panel" key={p.id}>
                  <Badge>{labels[p.mode]}</Badge>
                  <h2>{p.title}</h2>
                  <p>{p.objective}</p>
                  <p>{p.progression}</p>
                  {resolved ? (
                    <ol>
                      {resolved.exercises.map((e) => (
                        <li key={e.id}>
                          <Link to={`/library/${e.id}`}>{e.title}</Link>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p role="status">
                      Uma etapa está indisponível no catálogo. Esta trilha
                      precisa de revisão.
                    </p>
                  )}
                  {s.data.profile?.onboarded ? (
                    <button
                      className="button primary"
                      disabled={
                        !resolved ||
                        incompatible ||
                        !Number.isInteger(minutes) ||
                        minutes < 1 ||
                        minutes > 60
                      }
                      onClick={() => {
                        if (!resolved || !s.data.profile) return;
                        setDraft({
                          id: crypto.randomUUID(),
                          user_id: s.data.profile.id,
                          title: p.title,
                          objective: p.objective,
                          description:
                            "Trilha editorial ajustável · " + knowledge.version,
                          mode: p.mode as Plan["mode"],
                          level: p.level as Plan["level"],
                          steps: resolved.exercises.map((e) => ({
                            id: crypto.randomUUID(),
                            exercise_id: e.id,
                            minutes,
                            block: "Prática com objetivo",
                            notes:
                              e.research?.completion || "Registrar observação.",
                          })),
                        });
                      }}
                    >
                      Revisar no construtor
                    </button>
                  ) : (
                    <Link className="button" to="/app/planner">
                      Entrar para montar uma rotina
                    </Link>
                  )}
                  {incompatible && (
                    <p className="small-text">
                      Escolha uma trilha de Construção Zero para seu perfil
                      atual.
                    </p>
                  )}
                </article>
              );
            })}
          </div>
          <Link className="text-link" to="/app/planner">
            Ver minhas rotinas e agenda
          </Link>
        </>
      )}
      {tab === "sources" && (
        <>
          <div className="alert">
            Uma listagem oficial confirma a publicação do mapa. Ela não valida
            seus efeitos sobre aprendizagem. Conteúdos indisponíveis ficam fora
            da recuperação de conhecimento e das referências de exercícios.
          </div>
          <div className="two-grid">
            {knowledge.references.map((r) => (
              <article id={r.id} className="panel research-source" key={r.id}>
                <Badge>{evidenceLabels[r.kind]}</Badge>
                <h2>{r.title}</h2>
                <p>{r.claim}</p>
                <p>
                  <strong>Limites:</strong> {r.limitations}
                </p>
                <p className="small-text">
                  Acesso: {accessLabels[r.access]} · verificação {r.verified_at}{" "}
                  · publicação {r.published_at || "não identificada"}
                </p>
                <a
                  className="text-link"
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Consultar fonte original
                </a>
              </article>
            ))}
          </div>
        </>
      )}
      {!["skills", "method", "paths", "sources"].includes(tab) && (
        <Empty title="Seção não encontrada" to="/academy/research" />
      )}
      {draft && <TrainingBuilder plan={draft} onClose={() => setDraft(null)} />}
    </>
  );
}
