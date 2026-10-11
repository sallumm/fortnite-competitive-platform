import { Turnstile } from "../components/Turnstile";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Heading, Badge, Modal, Empty } from "../components/ui";
import { SectionReveal } from "../components/experience/primitives";
import { useStore } from "../lib/store";
import { useSEO } from "../lib/seo";
import { useEsports } from "../lib/esports/useEsports";
import { cycleOpen, statusLabels, type Cycle } from "../lib/esports/domain";
import { submitApplication, withdrawApplication } from "../lib/esports/service";
export default function Recruitment() {
  const s = useStore();
  const { portal, workspace, loading, error, refresh } = useEsports();
  const [selected, setSelected] = useState<Cycle | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  useSEO(
    "be kyrven.",
    "Entenda a seleção, avaliações e bolsas temporárias da kyrven esports.",
  );
  return (
    <>
      <SectionReveal className="esports-hero recruitment-hero">
        <span className="eyebrow">kyrven esports / SELEÇÃO DE TALENTOS</span>
        <h1>be kyrven.</h1>
        <p>
          Seu momento de desenvolvimento pode ser um ponto de partida. Conheça
          os critérios, a avaliação e o que cada etapa representa.
        </p>
        <Badge>
          {portal.operational
            ? "Consulte os ciclos disponíveis"
            : "Recrutamento público fechado"}
        </Badge>
      </SectionReveal>
      <div className="three-grid">
        {[
          [
            "01",
            "Candidatura",
            "Conta autenticada, informações necessárias e critérios do ciclo.",
          ],
          [
            "02",
            "Avaliação",
            "Análise humana, convite para Trialist e avaliações teóricas ou práticas.",
          ],
          [
            "03",
            "Desenvolvimento",
            "A direção pode oferecer uma bolsa temporária. Elenco exige uma decisão posterior.",
          ],
        ].map(([n, t, d]) => (
          <article className="path-card" key={n}>
            <span className="path-number">{n}</span>
            <h2>{t}</h2>
            <p>{d}</p>
          </article>
        ))}
      </div>
      <Heading
        level={2}
        title="Ciclos de recrutamento"
        description="Jogadores intermediários podem participar quando compatíveis com os critérios publicados. Nenhum requisito de earnings é presumido."
      />
      {loading && <p role="status">Consultando seleção…</p>}
      {error && (
        <p role="alert" className="alert">
          {error}
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      )}
      {!portal.cycles.length ? (
        <Empty title="Nenhuma seleção anunciada">
          A abertura será informada pelos canais oficiais, após as revisões
          necessárias.
        </Empty>
      ) : (
        portal.cycles.map((c) => (
          <section className="panel" key={c.id}>
            <div className="row between wrap">
              <h2>{c.title}</h2>
              <Badge>
                {cycleOpen(portal, c)
                  ? "Inscrições abertas"
                  : "Inscrições fechadas"}
              </Badge>
            </div>
            <p>{c.criteria}</p>
            <p>
              {c.mode === "both"
                ? "Construção e Zero Build"
                : c.mode === "build"
                  ? "Construção"
                  : "Zero Build"}{" "}
              · {c.format}
            </p>
            <p>
              De {new Date(c.starts_at).toLocaleString("pt-BR")} até{" "}
              {new Date(c.ends_at).toLocaleString("pt-BR")}
            </p>
            <details>
              <summary>Regras e privacidade</summary>
              <p className="preserve-lines">{c.rules}</p>
              <p className="preserve-lines">{c.privacy_notice}</p>
              <p>
                Versão {c.policy_version} · Retenção proposta:{" "}
                {c.retention_days} dias. Informações de recrutamento são
                privadas.
              </p>
            </details>
            {!s.session || s.demo ? (
              <Link
                className="button"
                to="/auth"
                state={{ from: "/be-kyrven" }}
              >
                Entrar na conta para acompanhar
              </Link>
            ) : (
              <button
                className="button primary"
                disabled={
                  !cycleOpen(portal, c) ||
                  workspace?.applications.some((a) => a.cycle_id === c.id)
                }
                onClick={() => setSelected(c)}
              >
                Iniciar candidatura
              </button>
            )}
          </section>
        ))
      )}
      {workspace && (
        <section className="panel">
          <h2>Minhas candidaturas</h2>
          {!workspace.applications.length ? (
            <p>Nenhuma candidatura enviada.</p>
          ) : (
            workspace.applications.map((a) => (
              <article className="application-card" key={a.id}>
                <div className="row between wrap">
                  <h3>{a.payload.nickname}</h3>
                  <Badge>{statusLabels[a.status]}</Badge>
                </div>
                <p>
                  Recebida em {new Date(a.created_at).toLocaleString("pt-BR")} ·{" "}
                  {portal.cycles.find((c) => c.id === a.cycle_id)?.title ||
                    "Ciclo anterior"}
                </p>
                <ol className="status-timeline">
                  {workspace.events
                    .filter((e) => e.application_id === a.id)
                    .map((e) => (
                      <li key={e.id}>
                        <strong>{statusLabels[e.status]}</strong>
                        <p>{e.message}</p>
                        <small>
                          {new Date(e.created_at).toLocaleString("pt-BR")}
                        </small>
                      </li>
                    ))}
                </ol>
                {a.status !== "withdrawn" && (
                  <button className="button" onClick={() => setConfirm(a.id)}>
                    Retirar participação
                  </button>
                )}
              </article>
            ))
          )}
          <Link className="button" to="/app/esports">
            Meu espaço esports
          </Link>
        </section>
      )}
      <section className="panel">
        <h2>Antes de participar</h2>
        <details>
          <summary>O que significa Trialist?</summary>
          <p>
            Acesso temporário a avaliações privadas. Não representa ingresso no
            elenco nem contratação.
          </p>
        </details>
        <details>
          <summary>Como funciona uma bolsa?</summary>
          <p>
            Benefícios temporários configurados pela direção, sem cobrança ou
            assinatura paga. A oferta depende de análise humana e aceite. Não
            garante evolução, promoção ou vaga.
          </p>
        </details>
        <details>
          <summary>Adolescentes podem participar?</summary>
          <p>
            Somente quando o ciclo e a proteção necessária estiverem
            habilitados. Autorizações exigíveis serão verificadas por canal
            oficial; uma declaração no formulário não substitui essa
            verificação. Não envie documentos ou senhas aqui.
          </p>
        </details>
        <details>
          <summary>Como acompanho minha candidatura?</summary>
          <p>
            Entre na mesma conta kyrven. Status e mensagens compartilháveis
            aparecem nesta página; anotações internas de avaliadores são
            protegidas.
          </p>
        </details>
        <p>{portal.settings.support_text}</p>
        {portal.settings.official_discord && (
          <a
            href={portal.settings.official_discord}
            className="text-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Canal oficial da organização
          </a>
        )}
      </section>
      {selected && (
        <ApplicationForm
          cycle={selected}
          close={() => setSelected(null)}
          saved={async () => {
            setSelected(null);
            await refresh();
          }}
        />
      )}
      {confirm && (
        <Modal title="Retirar participação?" onClose={() => setConfirm(null)}>
          <p>
            O histórico será preservado conforme as regras de retenção. Acessos
            ligados a esta candidatura serão revogados.
          </p>
          <button className="button" onClick={() => setConfirm(null)}>
            Voltar
          </button>
          <button
            disabled={s.busy}
            className="button danger"
            onClick={() =>
              s.run(async () => {
                await withdrawApplication(confirm);
                setConfirm(null);
                await refresh();
              }, "Participação retirada.")
            }
          >
            Confirmar retirada
          </button>
        </Modal>
      )}
    </>
  );
}
function ApplicationForm({
  cycle,
  close,
  saved,
}: {
  cycle: Cycle;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const s = useStore();
  const [captcha, setCaptcha] = useState("");
  const [captchaEpoch, setCaptchaEpoch] = useState(0);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Record<string, unknown> | null>(null);
  return (
    <Modal
      title={review ? "Confirmar candidatura" : `Candidatura — ${cycle.title}`}
      onClose={close}
    >
      {review && (
        <Turnstile
          key={captchaEpoch}
          action="recruitment"
          onToken={setCaptcha}
        />
      )}
      {review ? (
        <>
          <p>
            Nickname: {String(review.nickname)}. Confirme o envio de informações
            privadas para este ciclo. Não há garantia de seleção.
          </p>
          <button className="button" onClick={() => setReview(null)}>
            Revisar campos
          </button>
          <button
            className="button primary"
            disabled={s.busy}
            onClick={() =>
              s.run(async () => {
                try {
                  await submitApplication(cycle.id, review, captcha);
                } finally {
                  setCaptcha("");
                  setCaptchaEpoch((n) => n + 1);
                }
                await saved();
              }, "Candidatura recebida pelo servidor.")
            }
          >
            Confirmar envio
          </button>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setDraft(
              Object.fromEntries([...f].map(([k, v]) => [k, String(v)])),
            );
            setReview({
              ...Object.fromEntries(f),
              accepted: f.get("accepted") === "on",
              links: String(f.get("links") || "")
                .split("\n")
                .map((v) => v.trim())
                .filter(Boolean),
              policy_version: cycle.policy_version,
              rules_version: String(cycle.version),
            });
          }}
        >
          <div className="form-grid">
            {[
              ["nickname", "Nickname"],
              ["epic_nick", "Nick Epic declarado"],
              ["format", "Formato de prática"],
              ["experience", "Experiência"],
              ["region", "Região ampla"],
            ].map(([name, label]) => (
              <label key={name}>
                {label}
                <input
                  name={name}
                  defaultValue={draft[name]}
                  required
                  maxLength={120}
                />
              </label>
            ))}
            <label>
              Modalidade
              <select
                name="mode"
                defaultValue={
                  draft.mode || (cycle.mode === "zero" ? "zero" : "build")
                }
              >
                {cycle.mode !== "zero" && (
                  <option value="build">Construção</option>
                )}
                {cycle.mode !== "build" && (
                  <option value="zero">Zero Build</option>
                )}
              </select>
            </label>
            <label>
              Faixa etária declarada
              <select name="age_band" defaultValue={draft.age_band || "adult"}>
                <option value="adult">18 anos ou mais</option>
                <option value="adolescent">
                  Adolescente — autorização necessária
                </option>
              </select>
            </label>
          </div>
          {[
            ["objectives", "Objetivos"],
            ["availability", "Disponibilidade"],
            ["motivation", "Motivação"],
          ].map(([name, label]) => (
            <label key={name}>
              {label}
              <textarea
                defaultValue={draft[name]}
                required
                name={name}
                maxLength={2000}
              />
            </label>
          ))}
          <label>
            Links opcionais de VOD ou resultados
            <textarea
              name="links"
              defaultValue={draft.links}
              placeholder="Um link HTTPS por linha, até 5"
              maxLength={2500}
            />
          </label>
          <p>
            Não envie endereço, documentos, senhas ou códigos de acesso. Links
            fornecidos são declarações suas e não são verificados
            automaticamente.
          </p>
          <p className="preserve-lines">{cycle.privacy_notice}</p>
          <details>
            <summary>Ler regras do ciclo</summary>
            <p className="preserve-lines">{cycle.rules}</p>
          </details>
          <label className="checkbox">
            <input
              type="checkbox"
              name="accepted"
              defaultChecked={draft.accepted === "on"}
              required
            />
            Li os critérios, regras e aviso de privacidade desta versão (
            {cycle.policy_version}).
          </label>
          <button className="button primary">Revisar candidatura</button>
        </form>
      )}
    </Modal>
  );
}
