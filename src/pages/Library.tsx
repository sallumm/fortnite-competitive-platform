import { KnowledgeAccess } from "../components/KnowledgeAccess";
import { relatedLessons } from "../lib/development";
import { CoachAccess } from "../components/CoachAccess";
import { useSEO } from "../lib/seo";
import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Heart, Search, Target } from "lucide-react";
import { useStore } from "../lib/store";
import {
  knowledge,
  purposeLabels,
  reviewPending,
} from "../lib/training-research";
import { trainingCategories } from "../lib/training";
import { labels } from "../lib/types";
import { Badge, CopyCode, Empty, Heading, Source } from "../components/ui";
export default function Library() {
  const s = useStore();
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const competency = params.get("competency") || "all";
  const [purpose, setPurpose] = useState("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [mode, setMode] = useState("all");
  const [favorite, setFavorite] = useState(false);
  const selected = s.catalog.exercises.find((e) => e.id === id);
  const bookmarked = (id: string) =>
    s.data.bookmarks.find((b) => b.kind === "exercise" && b.target_id === id);
  const toggle = (id: string) =>
    s.run(async () => {
      if (!s.data.profile) {
        navigate("/auth");
        return;
      }
      const b = bookmarked(id);
      if (b) await s.remove("bookmarks", b.id);
      else
        await s.save("bookmarks", {
          id: crypto.randomUUID(),
          user_id: s.data.profile.id,
          kind: "exercise",
          target_id: id,
        });
    });

  useSEO(
    selected?.title || "Biblioteca de exercícios",
    selected?.description ||
      "Exercícios com códigos verificados e objetivos claros.",
  );
  if (s.loading) return <p role="status">Carregando a biblioteca…</p>;
  if (s.error && !selected)
    return <Empty title="A biblioteca não pôde ser carregada" to="/library" />;
  if (id && !selected)
    return <Empty title="Exercício não encontrado" to="/library" />;
  if (selected)
    return (
      <>
        <Link className="text-link" to="/library">
          <ArrowLeft size={16} />
          Biblioteca de exercícios
        </Link>
        <KnowledgeAccess />
        <Heading
          eyebrow={labels[selected.category]}
          title={selected.title}
          description={selected.description}
          action={
            <button
              className="button"
              disabled={s.busy}
              onClick={() => toggle(selected.id)}
            >
              <Heart
                size={16}
                fill={bookmarked(selected.id) ? "currentColor" : "none"}
              />
              {bookmarked(selected.id) ? "Favoritado" : "Salvar exercício"}
            </button>
          }
        />
        <CoachAccess
          question={`Como este exercício me ajuda: ${selected.title}?`}
          exerciseId={selected.id}
          label="Como este exercício me ajuda?"
        />
        <div className="detail-grid">
          <article className="panel article-body">
            <div className="row">
              <Badge>{labels[selected.mode]}</Badge>
              <Badge>{labels[selected.level]}</Badge>
            </div>
            {selected.skills?.length ? (
              <div className="row">
                {selected.skills.map((x) => (
                  <Badge key={x}>{x}</Badge>
                ))}
              </div>
            ) : null}
            {selected.competitive_goal && (
              <>
                <h2>Objetivo competitivo</h2>
                <p>{selected.competitive_goal}</p>
                <p>
                  {selected.map_type} · {selected.requirements}
                </p>
              </>
            )}
            <h2>Como praticar</h2>
            <p>{selected.instructions}</p>
            {selected.video_url && (
              <p>
                <a
                  href={selected.video_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Vídeo relacionado (conteúdo não revalidado nesta pesquisa)
                </a>
              </p>
            )}
            {selected.research && (
              <section aria-label="Contexto de aprendizagem">
                <h2>Como avaliar esta prática</h2>
                <Badge>{purposeLabels[selected.research.purpose]}</Badge>
                <p>
                  <strong>Conclusão:</strong> {selected.research.completion}
                </p>
                <p>
                  <strong>Aplicação:</strong> {selected.research.transfer}
                </p>
                <p>
                  <strong>Limites:</strong> {selected.research.limitations}
                </p>
                <p className="small-text">
                  {reviewPending(selected)
                    ? "Revisão editorial pendente"
                    : "Metadados revisados"}{" "}
                  · revisar até{" "}
                  {new Date(selected.research.review_due_at).toLocaleDateString(
                    "pt-BR",
                  )}
                </p>
                <div className="row">
                  {selected.research.competency_ids.map((id) => (
                    <Link
                      key={id}
                      className="text-link"
                      to={`/library?competency=${id}`}
                    >
                      {knowledge.competencies.find((c) => c.id === id)?.title}
                    </Link>
                  ))}
                </div>
                <p>
                  Fontes:{" "}
                  {selected.research.evidence_ids.map((id) => (
                    <Link key={id} to={`/academy/research?view=sources#${id}`}>
                      {knowledge.references.find((r) => r.id === id)?.title}
                      {" · "}
                    </Link>
                  ))}
                </p>
              </section>
            )}
            <h2>O que registrar</h2>
            <p>{selected.metric}</p>
            {selected.measurement && (
              <section>
                <h3>Benchmark individual</h3>
                <p>{selected.measurement.procedure}</p>
                <p>
                  Unidade: {selected.measurement.unit} · limites:{" "}
                  {selected.measurement.min} a {selected.measurement.max} ·
                  protocolo {selected.measurement.version}.{" "}
                  {selected.measurement.direction === "higher"
                    ? "Um valor maior indica mais ocorrências da métrica."
                    : "Um valor menor indica menos tempo ou erros."}{" "}
                  O significado depende da configuração e não corresponde a um
                  rank de habilidade.
                </p>
              </section>
            )}
            <div className="alert">
              Compare apenas tentativas com a mesma arma, cenário e
              configuração. Resultados de treino não equivalem a resultados de
              partidas.
            </div>
            <Source url={selected.source_url} date={selected.verified_at} />
            <p className="small-text muted">
              O código e a descrição da ilha foram conferidos na fonte; não
              realizamos testes dentro do Fortnite. O procedimento de treino é
              uma proposta editorial, sem eficácia específica comprovada.
            </p>
          </article>
          <aside className="panel detail-aside">
            <div className="map-art" aria-hidden="true">
              <Target size={64} />
              <span>{labels[selected.category]}</span>
            </div>
            <span className="eyebrow">
              {selected.map_code ? "ILHA DO CRIATIVO" : "EXERCÍCIO SEM ILHA"}
            </span>
            <h3>{selected.creator}</h3>
            {selected.map_code && <CopyCode code={selected.map_code} />}
            <a
              href={selected.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="button full"
            >
              Consultar fonte
              <ArrowUpRight size={16} />
            </a>
            <Link
              to={`/app/planner?exercise=${selected.id}`}
              className="button primary full"
            >
              Adicionar a uma rotina
            </Link>
            {relatedLessons(selected, s.catalog.articles).length > 0 && (
              <section aria-label="Aulas relacionadas ao exercício">
                <h3>Entender antes de praticar</h3>
                <p>Vínculos editoriais entre a aula e este exercício.</p>
                {relatedLessons(selected, s.catalog.articles).map((a) => (
                  <p key={a.id}>
                    <Link to={`/academy/${a.slug}`}>{a.title}</Link>
                  </p>
                ))}
              </section>
            )}
            <Link to="/academy" className="text-link">
              Estudar a habilidade
              <ArrowUpRight size={16} />
            </Link>
          </aside>
        </div>
      </>
    );
  const list = s.catalog.exercises.filter(
    (e) =>
      [
        e.title,
        e.description,
        e.creator,
        e.map_code || "",
        ...(e.skills || []),
        ...(e.tags || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "all" ||
        (e.categories?.length ? e.categories : [e.category]).includes(
          category,
        )) &&
      (competency === "all" ||
        e.research?.competency_ids.includes(competency)) &&
      (purpose === "all" || e.research?.purpose === purpose) &&
      (level === "all" || e.level === level) &&
      (mode === "all" || e.mode === mode || e.mode === "both") &&
      (!favorite || bookmarked(e.id)),
  );
  return (
    <>
      <CoachAccess
        question="O que devo treinar hoje?"
        label="Encontrar exercícios com o Coach"
      />
      <Heading
        eyebrow="BIBLIOTECA DE TREINAMENTO"
        title="Encontre seu próximo exercício."
        description="Códigos verificados, objetivos claros e instruções para praticar com intenção."
      />
      <Link className="button" to="/academy/research">
        Explorar habilidades e metodologia
      </Link>
      <div className="filters panel">
        <select
          aria-label="Competência específica"
          value={competency}
          onChange={(e) =>
            setParams(
              e.target.value === "all" ? {} : { competency: e.target.value },
            )
          }
        >
          <option value="all">Todas as competências</option>
          {knowledge.competencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <select
          aria-label="Finalidade da prática"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        >
          <option value="all">Todas as finalidades</option>
          {Object.entries(purposeLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar exercícios"
            placeholder="Buscar exercício, criador ou código…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Todas as habilidades</option>
          {Object.entries(trainingCategories).map(([c, label]) => (
            <option value={c} key={c}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Dificuldade"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          <option value="all">Todos os níveis</option>
          {["beginner", "intermediate", "advanced"].map((c) => (
            <option value={c} key={c}>
              {labels[c]}
            </option>
          ))}
        </select>
        <select
          aria-label="Modalidade"
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        >
          <option value="all">Todas as modalidades</option>
          <option value="build">Construção</option>
          <option value="zero">Zero Build</option>
        </select>
        <button
          className="button small"
          aria-pressed={favorite}
          onClick={() => setFavorite(!favorite)}
        >
          <Heart size={15} />
          Favoritos
        </button>
      </div>
      <div className="row between result-count">
        <span>{list.length} exercícios</span>
        <span className="muted">Sem promessas de evolução garantida</span>
      </div>
      {list.length ? (
        <div className="three-grid library-grid">
          {list.map((e, i) => (
            <article className="panel exercise-card" key={e.id}>
              <Link
                to={"/library/" + e.id}
                className={"map-art map-" + (i % 4)}
                aria-label={`Ver ${e.title}`}
              >
                <Target size={45} />
                <span>{labels[e.category]}</span>
                <small>{e.creator}</small>
              </Link>
              <div className="exercise-card-content">
                <div className="row between">
                  <Badge>{labels[e.level]}</Badge>
                  <button
                    className="icon-button"
                    aria-label={`Favoritar ${e.title}`}
                    disabled={s.busy}
                    onClick={() => toggle(e.id)}
                  >
                    <Heart
                      size={16}
                      fill={bookmarked(e.id) ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <Link to={"/library/" + e.id}>
                  <h3>{e.title}</h3>
                </Link>
                <p>{e.description}</p>
                <div className="row between">
                  {e.map_code ? (
                    <CopyCode
                      code={e.map_code}
                      label={
                        e.measurement
                          ? `Copiar código de ${e.title}`
                          : undefined
                      }
                    />
                  ) : (
                    <Badge>Sem mapa</Badge>
                  )}
                  <span className="muted small-text">{labels[e.mode]}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Nenhum exercício corresponde à busca">
          Ajuste os filtros ou explore outra habilidade.
        </Empty>
      )}
    </>
  );
}
