import { CoachAccess } from "../components/CoachAccess";
import { topics, recentArticles, relatedArticles } from "../lib/competitive";
import { useSEO } from "../lib/seo";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Search,
  Share2,
} from "lucide-react";
import { useStore } from "../lib/store";
import { dateLabel, isStale } from "../lib/logic";
import { labels } from "../lib/types";
import { Badge, Empty, Heading, Source } from "../components/ui";
export default function Editorial({ academy = false }: { academy?: boolean }) {
  const s = useStore();
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState("all");
  const [topic, setTopic] = useState("all");
  const selected = s.catalog.articles.find((a) => a.slug === slug);
  const base = recentArticles(s.catalog.articles).filter((a) =>
    academy ? a.kind === "lesson" : a.kind !== "lesson",
  );

  useSEO(
    selected?.title || "Notícias e Academy",
    selected?.summary ||
      "Conteúdos educativos e notícias competitivas com fontes.",
    selected,
  );
  if (slug && !selected)
    return (
      <Empty
        title="Conteúdo não encontrado"
        to={academy ? "/academy" : "/news"}
      />
    );
  if (selected)
    return (
      <>
        <Link className="text-link" to={academy ? "/academy" : "/news"}>
          <ArrowLeft size={16} />
          {academy ? "Academy" : "Notícias e análises"}
        </Link>
        <article className="reading-page">
          <div className="reading-header">
            <div className="row">
              <Badge>
                {selected.kind === "news"
                  ? "Notícia"
                  : selected.kind === "lesson"
                    ? "Aula"
                    : "Análise editorial"}
              </Badge>
              <Badge>{topics[selected.topic || "competitive"]}</Badge>
              <Badge>
                {selected.evidence === "official"
                  ? "Fonte oficial"
                  : selected.evidence === "opinion"
                    ? "Opinião"
                    : "Análise editorial"}
              </Badge>
            </div>
            <h1>{selected.title}</h1>
            <p>{selected.summary}</p>
            <div className="row muted small-text">
              <span>{selected.author}</span>
              <span>{dateLabel(selected.published_at)}</span>
              <button
                className="text-link"
                onClick={() =>
                  s.run(async () => {
                    if (navigator.share)
                      await navigator.share({
                        title: selected.title,
                        url: location.href,
                      });
                    else await navigator.clipboard.writeText(location.href);
                  })
                }
              >
                <Share2 size={14} />
                Compartilhar
              </button>
            </div>
          </div>
          <div className="row">
            {selected.tags?.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          {selected.source_published_at && (
            <p className="small-text muted">
              Publicação original da fonte:{" "}
              {dateLabel(selected.source_published_at)}. A verificação editorial
              tem data independente.
            </p>
          )}
          <CoachAccess
            question={`Mostre conteúdos sobre ${selected.tags?.[0] || selected.category}.`}
            label="Estudar este assunto com o Coach"
          />
          <div className="reading-art">
            <BookOpen size={60} />
            <span>{labels[selected.category]}</span>
          </div>
          <div className="article-body">
            {selected.body.split("\n\n").map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <Source
            url={selected.source_url}
            date={selected.verified_at}
            stale={isStale(selected.verified_at, selected.valid_until)}
          />
          {selected.kind === "news" && (
            <p className="alert">
              Esta notícia registra informações da data indicada. Não é um feed
              atualizado automaticamente.
            </p>
          )}
          <div className="reading-next panel">
            <div>
              <span className="eyebrow">DO ESTUDO À PRÁTICA</span>
              <h3>Teste uma ideia no próximo treino.</h3>
            </div>
            <Link to="/library" className="button primary">
              Escolher exercício
              <ArrowRight size={16} />
            </Link>
          </div>
          <h2>Continue explorando</h2>
          <div className="two-grid">
            {relatedArticles(base, selected).map((a) => (
              <Link
                key={a.id}
                to={(academy ? "/academy/" : "/news/") + a.slug}
                className="panel"
              >
                <h3>{a.title}</h3>
                <p>{a.summary}</p>
              </Link>
            ))}
          </div>
        </article>
      </>
    );
  const list = base.filter(
    (a) =>
      (
        a.title +
        " " +
        a.summary +
        " " +
        a.body +
        " " +
        (a.tags || []).join(" ")
      )
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (category === "all" || a.category === category) &&
      (kind === "all" || a.kind === kind) &&
      (topic === "all" || a.topic === topic),
  );
  return (
    <>
      <Heading
        eyebrow={academy ? "CONHECIMENTO APLICADO" : "NOTÍCIAS E ANÁLISES"}
        title={
          academy
            ? "Entenda. Pratique. Revise."
            : "O contexto faz parte do seu jogo."
        }
        description={
          academy
            ? "Aulas originais, referências transparentes e conexões com o treinamento."
            : "Informação com fonte, data e contexto. Interpretações editoriais identificadas."
        }
      />
      {academy && (
        <Link className="button" to="/academy/research">
          Explorar habilidades, trilhas e evidências
        </Link>
      )}
      <div className="filters panel">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Buscar conteúdos"
            placeholder="Buscar assunto ou palavra-chave…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Todas as categorias</option>
          {Array.from(new Set(base.map((a) => a.category))).map((c) => (
            <option key={c} value={c}>
              {labels[c]}
            </option>
          ))}
        </select>
        {!academy && (
          <select
            aria-label="Tema editorial"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="all">Todos os temas</option>
            {Object.entries(topics).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        )}
        {!academy && (
          <select
            aria-label="Tipo de conteúdo"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">Notícias e análises</option>
            <option value="news">Notícias</option>
            <option value="analysis">Análises</option>
          </select>
        )}
      </div>
      <div className="editorial-grid">
        {list.map((a, i) => (
          <Link
            to={(academy ? "/academy/" : "/news/") + a.slug}
            key={a.id}
            className={"panel editorial-card " + (i === 0 ? "featured" : "")}
          >
            <div className={"reading-art art-" + (i % 3)}>
              <BookOpen size={i === 0 ? 60 : 40} />
              <span>{labels[a.category]}</span>
            </div>
            <div>
              <div className="row">
                <Badge>
                  {a.kind === "news"
                    ? "Notícia"
                    : a.kind === "lesson"
                      ? "Aula"
                      : "Análise editorial"}
                </Badge>
                <span className="small-text muted">
                  {dateLabel(a.published_at)}
                </span>
              </div>
              <Badge>{topics[a.topic || "competitive"]}</Badge>
              {isStale(a.verified_at, a.valid_until) && (
                <span className="small-text muted">
                  Arquivo · precisa de revisão
                </span>
              )}
              <h2>{a.title}</h2>
              <p>{a.summary}</p>
              <span className="text-link">
                Ler conteúdo
                <ArrowUpRight size={16} />
              </span>
            </div>
          </Link>
        ))}
      </div>
      {!list.length && (
        <Empty title="Nenhum conteúdo encontrado">
          Tente outro assunto ou ajuste a categoria.
        </Empty>
      )}
      {academy && (
        <section className="panel glossary">
          <span className="eyebrow">GLOSSÁRIO COMPETITIVO</span>
          <h2>O vocabulário do seu treino.</h2>
          <div className="two-grid">
            {[
              ["Tracking", "Acompanhar um alvo em movimento com a mira."],
              [
                "Flicking",
                "Mover rapidamente a mira até um alvo e ajustar antes do tiro.",
              ],
              [
                "Target switching",
                "Alternar a mira entre alvos, recuperando precisão.",
              ],
              [
                "Crosshair placement",
                "Posicionar a mira antecipando onde o alvo pode aparecer.",
              ],
              [
                "Piece control",
                "Controlar estruturas e espaços para limitar opções do adversário.",
              ],
              [
                "Right-hand peek",
                "Ângulo que usa a posição da câmera para reduzir exposição; não garante segurança.",
              ],
              [
                "Deadside",
                "Região relativamente menos ocupada da zona, dependente da distribuição real de jogadores.",
              ],
              [
                "Storm surge",
                "Mecânica de pressão sobre jogadores com dano insuficiente em lobbies elegíveis; confirme regras atuais.",
              ],
              [
                "Tarping",
                "Criar um caminho protegido de estruturas durante o deslocamento.",
              ],
              ["Off-spawn", "Disputas e decisões nos momentos após o pouso."],
              [
                "Resource management",
                "Planejar uso de materiais, munição, cura e mobilidade.",
              ],
              [
                "VOD review",
                "Revisão de gravações para observar decisões e identificar hipóteses de melhoria.",
              ],
            ].map(([term, def]) => (
              <div key={term}>
                <h3>{term}</h3>
                <p>{def}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
