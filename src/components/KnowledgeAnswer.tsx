import { Link } from "react-router-dom";
import type { KnowledgeAnswer as Answer } from "../lib/knowledge/service";
export function KnowledgeAnswer({ answer }: { answer: Answer }) {
  return (
    <article
      className="card knowledge-answer"
      aria-label="Resposta do Fortnite Knowledge"
    >
      <p className="eyebrow">
        {answer.mode === "generative"
          ? "Modelo generativo · " + answer.provider
          : "Base de conhecimento"}
      </p>
      <h2>{answer.summary}</h2>
      <p className="muted">{answer.notice}</p>
      {answer.sections.map((s, i) => (
        <section key={i}>
          <h3>{s.title}</h3>
          <p style={{ whiteSpace: "pre-line" }}>{s.text}</p>
        </section>
      ))}
      {answer.references.length > 0 && (
        <details open>
          <summary>Fontes e revisões</summary>
          <ul>
            {answer.references.map((r, i) => (
              <li key={i}>
                <a href={r.url} target="_blank" rel="noopener noreferrer">
                  {r.title}
                </a>
                <p className="muted">
                  {r.evidence} · revisão {r.revision} · verificado em{" "}
                  {new Date(r.verified_at).toLocaleDateString("pt-BR")}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="row">
        {answer.related.map((r) => (
          <Link className="button ghost" key={r.path} to={r.path}>
            {r.title}
          </Link>
        ))}
      </div>
      {answer.missing && (
        <Link className="button ghost" to="/competitive">
          Consultar fontes competitivas
        </Link>
      )}
    </article>
  );
}
