import { Link } from "react-router-dom";
import type { Article, Exercise } from "../lib/types";
import { curriculumSchema, levelNames, phaseNames } from "../lib/curriculum";
import { isStale } from "../lib/logic";
import { Badge } from "./ui";
export function LessonContext({
  article,
  articles,
  exercises,
}: {
  article: Article;
  articles: Article[];
  exercises: Exercise[];
}) {
  const parsed = curriculumSchema.safeParse(article.curriculum);
  if (!parsed.success) return null;
  const c = parsed.data;
  return (
    <section className="panel" aria-label="Percurso e avaliação da aula">
      <div className="row">
        <Badge>
          Nível {c.level} · {levelNames[c.level]}
        </Badge>
        <Badge>{phaseNames[c.phase]}</Badge>
        <Badge>Conteúdo editorial</Badge>
      </div>
      <p>{c.meta_scope}</p>
      {isStale(article.verified_at, article.valid_until) && (
        <p className="alert">
          Prazo de revisão encerrado. Não interprete regras ou parâmetros desta
          aula como confirmação atual.
        </p>
      )}
      <h2>Bases sugeridas</h2>
      <p>
        Você pode estudar fora da sequência se já conhece as bases. Não há
        bloqueio ou rank atribuído por leitura.
      </p>
      {c.prerequisites.length ? (
        <ul>
          {c.prerequisites.map((slug) => {
            const a = articles.find(
              (x) =>
                x.slug === slug &&
                x.published &&
                Date.parse(x.published_at) <= Date.now(),
            );
            return (
              <li key={slug}>
                {a ? (
                  <Link to={`/academy/${slug}`}>{a.title}</Link>
                ) : (
                  <span>
                    Base temporariamente indisponível. Consulte a curadoria.
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>Esta aula não exige estudo anterior.</p>
      )}
      <h2>Como avaliar o estudo</h2>
      <ul>
        {c.assessment.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <p>
        Estes critérios organizam uma revisão; não geram uma nota universal ou
        progresso automático.
      </p>
      <h2>Atividades do catálogo</h2>
      {c.exercise_ids.length ? (
        <ul>
          {c.exercise_ids.map((id) => {
            const e = exercises.find(
              (x) =>
                x.id === id &&
                x.published &&
                x.research?.review_status !== "retired",
            );
            return (
              <li key={id}>
                {e ? (
                  <Link to={`/library/${e.id}`}>{e.title}</Link>
                ) : (
                  "Atividade indisponível para revisão."
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p>
          A atividade de estudo descrita no texto não exige um mapa específico.
          Consulte também <Link to="/library">a biblioteca</Link>.
        </p>
      )}
      <h2>Fontes e alcance</h2>
      <ul>
        {c.sources.map((r, i) => (
          <li key={i}>
            <a href={r.url} target="_blank" rel="noopener noreferrer">
              {r.title}
            </a>
            <p className="small-text">
              {r.kind === "official"
                ? "Informação oficial"
                : r.kind === "scientific"
                  ? "Pesquisa científica"
                  : "Análise / experiência documentada"}{" "}
              ·{" "}
              {r.access === "listing"
                ? "Listagem do criador"
                : r.access === "abstract"
                  ? "Resumo científico"
                  : r.access === "metadata"
                    ? "Descrição pública"
                    : r.access === "text_sections"
                      ? "Seções do texto"
                      : "Texto da página"}
              . {r.supports}
            </p>
          </li>
        ))}
      </ul>
      <p className="small-text muted">
        Verificado em{" "}
        {new Date(article.verified_at).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })}{" "}
        · versão {c.version}. Nenhum mapa foi executado nem vídeo analisado
        audiovisualmente nesta curadoria.
      </p>
      <Link className="text-link" to="/academy/curriculum">
        Explorar o percurso completo disponível
      </Link>
    </section>
  );
}
