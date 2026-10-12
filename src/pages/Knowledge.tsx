import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Heading } from "../components/ui";
import { KnowledgeAnswer } from "../components/KnowledgeAnswer";
import {
  askKnowledge,
  settings,
  type KnowledgeAnswer as Answer,
  type KnowledgeSettings,
} from "../lib/knowledge/service";
import { useStore } from "../lib/store";
import { useSEO } from "../lib/seo";
export default function Knowledge() {
  const s = useStore();
  const [params] = useSearchParams();
  const [message, setMessage] = useState(params.get("q") || ""),
    [mode, setMode] = useState<"build" | "zero" | "both">("both"),
    [season, setSeason] = useState(""),
    [version, setVersion] = useState(""),
    [region, setRegion] = useState(""),
    [answer, setAnswer] = useState<Answer | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState<KnowledgeSettings | null>(null),
    [external, setExternal] = useState(false),
    [diagnostics, setDiagnostics] = useState(false);
  const owner = s.session?.user.id || (s.demo ? "demo" : "public"),
    generation = useRef(0);
  useSEO(
    "Fortnite Knowledge",
    "Conceitos de Fortnite, referências e conhecimento competitivo revisado.",
  );
  useEffect(() => {
    generation.current++;
    setAnswer(null);
    setBusy(false);
    setError("");
    setExternal(false);
    setDiagnostics(false);
    setStatus(null);
    let active = true;
    settings(s.demo)
      .then((v) => {
        if (active) setStatus(v);
      })
      .catch(() => {
        if (active)
          setError(
            "Não foi possível consultar a disponibilidade. Tente recarregar.",
          );
      });
    return () => {
      active = false;
      generation.current++;
    };
  }, [owner, s.demo]);
  async function ask() {
    if (busy) return;
    const request = generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await askKnowledge(
        {
          message,
          mode,
          season,
          version,
          region,
          external,
          consent: external ? "knowledge-v1" : undefined,
          diagnostics,
          preview: false,
        },
        s.demo,
      );
      if (request === generation.current) setAnswer(result);
    } catch (e) {
      if (request === generation.current)
        setError(e instanceof Error ? e.message : "Consulta indisponível.");
    } finally {
      if (request === generation.current) setBusy(false);
    }
  }
  return (
    <div className="knowledge-page knowledge-desk">
      <Heading
        title="Fortnite Knowledge"
        description="Entenda conceitos, encontre fontes e escolha o que estudar. Para analisar seus registros e organizar a agenda, use o kyrven coach."
      />
      <div className="row">
        <Link className="button ghost" to="/app/coach">
          Abrir kyrven coach
        </Link>
        <Link className="button ghost" to="/academy/research">
          Habilidades e glossário
        </Link>
      </div>
      {status && !status.enabled ? (
        <div className="card" role="status">
          O assistente está temporariamente desativado. Você pode continuar
          consultando a Academy e a biblioteca.
        </div>
      ) : (
        <>
          <section className="card knowledge-question">
            <p className="eyebrow">
              Conhecimento especializado · fontes selecionadas
            </p>
            <p>
              Respostas da base funcionam sem modelo externo. Não consultamos
              agenda, resultados ou conversas privadas.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <label htmlFor="knowledge-question">Pergunta</label>
              <textarea
                id="knowledge-question"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1500}
                required
                placeholder="O que é Storm Surge?"
                rows={3}
              />
              <div className="row">
                <label>
                  Modalidade
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
                    <option value="both">Não especificada</option>
                    <option value="build">Construção</option>
                    <option value="zero">Construção Zero</option>
                  </select>
                </label>
                <label>
                  Temporada (opcional)
                  <input
                    value={season}
                    maxLength={100}
                    onChange={(e) => setSeason(e.target.value)}
                    placeholder="Nome exato da temporada"
                  />
                </label>
                <label>
                  Versão (opcional)
                  <input
                    value={version}
                    maxLength={100}
                    onChange={(e) => setVersion(e.target.value)}
                  />
                </label>
                <label>
                  Região (opcional)
                  <input
                    value={region}
                    maxLength={100}
                    onChange={(e) => setRegion(e.target.value)}
                  />
                </label>
              </div>
              {status?.external_enabled && !s.demo && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={external}
                    onChange={(e) => setExternal(e.target.checked)}
                  />
                  Autorizar envio desta pergunta e de trechos públicos ao
                  provedor externo configurado. Exige também o consentimento
                  externo nas preferências do Coach.
                </label>
              )}
              <label className="check">
                <input
                  type="checkbox"
                  checked={diagnostics}
                  onChange={(e) => setDiagnostics(e.target.checked)}
                />
                Compartilhar palavras-chave de dúvidas sem resposta para revisão
                editorial. Não inclua dados pessoais.
              </label>
              {s.demo || s.session ? (
                <button className="button" disabled={busy || !status}>
                  {busy ? "Consultando fontes…" : "Consultar conhecimento"}
                </button>
              ) : (
                <Link className="button" to="/auth">
                  Entrar para consultar
                </Link>
              )}
            </form>
            <div className="row knowledge-suggestions">
              {[
                "O que é Storm Surge?",
                "O que é Piece Control?",
                "Qual a diferença entre Box Fight e Realistic?",
                "O que significa tarpar?",
                "Qual a função de um IGL?",
              ].map((q) => (
                <button
                  className="button ghost"
                  key={q}
                  onClick={() => setMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
          {busy && <p role="status">Selecionando conteúdo revisado…</p>}
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
          {answer && <KnowledgeAnswer answer={answer} />}
        </>
      )}
    </div>
  );
}
