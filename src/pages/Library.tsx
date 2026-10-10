import { CoachAccess } from "../components/CoachAccess";
import { useSEO } from "../lib/seo";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Heart, Search, Target } from "lucide-react";
import { useStore } from "../lib/store";
import { labels } from "../lib/types";
import { Badge, CopyCode, Empty, Heading, Source } from "../components/ui";
export default function Library() {
  const s = useStore();
  const { id } = useParams();
  const navigate = useNavigate();
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
  if (id && !selected)
    return <Empty title="Exercício não encontrado" to="/library" />;
  if (selected)
    return (
      <>
        <Link className="text-link" to="/library">
          <ArrowLeft size={16} />
          Biblioteca de exercícios
        </Link>
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
            <h2>O que registrar</h2>
            <p>{selected.metric}</p>
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
            <Link to="/app/planner" className="button primary full">
              Adicionar a uma rotina
            </Link>
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
      [e.title, e.description, e.creator, e.map_code || ""]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "all" || e.category === category) &&
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
      <div className="filters panel">
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
          {["aim", "mechanics", "piece", "competitive", "decisions", "vod"].map(
            (c) => (
              <option value={c} key={c}>
                {labels[c]}
              </option>
            ),
          )}
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
                    <CopyCode code={e.map_code} />
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
