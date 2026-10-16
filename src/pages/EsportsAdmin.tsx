import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { Heading, Modal, Badge, Empty } from "../components/ui";
import { AnimatedTabs } from "../components/experience/primitives";
import { useStore } from "../lib/store";
import { adminAction, loadAdmin } from "../lib/esports/service";
import {
  nextStatuses,
  statusLabels,
  roleLabels,
  type AdminData,
  type Application,
  type Cycle,
} from "../lib/esports/domain";
export function Field({
  name,
  label,
  defaultValue = "",
  type = "text",
  required = true,
  multiline = false,
}: {
  name: string;
  label: string;
  defaultValue?: string | number;
  type?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <label>
      {label}
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          required={required}
          maxLength={8000}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue}
          required={required}
        />
      )}
    </label>
  );
}
export function CheckField({
  name,
  label,
  checked = false,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="checkbox">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}
export function Form({
  children,
  save,
}: {
  children: ReactNode;
  save: (f: FormData) => Promise<void>;
}) {
  const s = useStore();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        void s.run(() => save(f), "Alteração confirmada pelo servidor.");
      }}
    >
      {children}
      <button className="button primary" disabled={s.busy}>
        Salvar no servidor
      </button>
    </form>
  );
}
export const localDate = (v?: string) =>
  v
    ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16)
    : "";
export const isoDate = (v: FormDataEntryValue | null) =>
  new Date(String(v)).toISOString();
export const formObject = (f: FormData) => Object.fromEntries(f);
export default function EsportsAdmin() {
  const s = useStore();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [tab, setTab] = useState("applications");
  const [app, setApp] = useState<Application | null>(null);
  const [cycle, setCycle] = useState<Cycle | null | undefined>(undefined);
  const seq = useRef(0);
  const refresh = useCallback(async () => {
    const generation = ++seq.current;
    setLoading(true);
    setError("");
    try {
      if (s.demo)
        throw new Error("Administração exige uma conta real autorizada.");
      const d = await loadAdmin(query, offset);
      if (generation === seq.current) {
        setData(d);
        setApp((a) =>
          a ? d.applications.find((x) => x.id === a.id) || null : null,
        );
      }
    } catch (e) {
      if (generation === seq.current) {
        setData(null);
        setError(e instanceof Error ? e.message : "Consulta indisponível.");
      }
    } finally {
      if (generation === seq.current) setLoading(false);
    }
  }, [s.session?.user.id, s.demo, query, offset]);
  useEffect(() => {
    void refresh();
    return () => {
      seq.current++;
    };
  }, [refresh]);
  const act = async (
    action: string,
    id: string | null,
    expected: number,
    payload: unknown,
  ) => {
    await adminAction(action, id, expected, payload);
    await refresh();
  };
  return (
    <>
      <Heading
        eyebrow="kyrven esports — Recruitment"
        title="Gestão de recrutamento"
        description="Decisões humanas, acesso por responsabilidade e histórico de alterações."
      />
      {loading && <p role="status">Consultando servidor…</p>}
      {error && (
        <p role="alert" className="alert">
          {error}
          <button onClick={() => void refresh()}>Tentar novamente</button>
        </p>
      )}
      {data && (
        <>
          <div className="row wrap">
            <Link className="button" to="/admin/esports/assessments">
              Provas e revisões
            </Link>
            <Link className="button" to="/admin/esports/development">
              Bolsas e desenvolvimento
            </Link>
          </div>
          <AnimatedTabs
            label="Administração esports"
            value={tab}
            onChange={(value) => {
              setTab(value);
              setOffset(0);
            }}
            items={[
              { value: "applications", label: "Candidaturas" },
              ...(data.settings
                ? [
                    { value: "cycles", label: "Ciclos" },
                    { value: "roles", label: "Cargos" },
                    { value: "settings", label: "Configuração" },
                    { value: "audit", label: "Auditoria" },
                  ]
                : []),
            ]}
          />
          {tab === "applications" && (
            <>
              <form
                className="row wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOffset(0);
                  setQuery(
                    String(new FormData(e.currentTarget).get("query") || ""),
                  );
                }}
              >
                <label>
                  Buscar nickname ou UUID
                  <input name="query" maxLength={120} />
                </label>
                <button className="button">Pesquisar</button>
              </form>
              <div className="esports-list recruitment-register">
                {data.applications.length ? (
                  data.applications.map((a) => (
                    <button
                      key={a.id}
                      className="application-card recruitment-record"
                      onClick={() => setApp(a)}
                    >
                      <strong>{a.payload.nickname}</strong>
                      <Badge>{statusLabels[a.status]}</Badge>
                      <small>
                        {a.payload.mode} ·{" "}
                        {new Date(a.created_at).toLocaleDateString("pt-BR")}
                      </small>
                    </button>
                  ))
                ) : (
                  <Empty title="Nenhuma candidatura neste filtro">
                    Avaliadores veem apenas candidaturas atribuídas.
                  </Empty>
                )}
              </div>
              <div className="row">
                <button
                  className="button"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - 50))}
                >
                  Anterior
                </button>
                <span>
                  Registros {offset + 1}–{offset + data.applications.length}
                </span>
                <button
                  className="button"
                  disabled={data.applications.length < 50}
                  onClick={() => setOffset(offset + 50)}
                >
                  Próxima página
                </button>
              </div>
            </>
          )}
          {tab === "settings" && data.settings && (
            <section className="panel">
              <h2>Configuração da organização</h2>
              <p className="alert">
                Liberação operacional:{" "}
                {data.gate?.reviewed ? "registrada" : "pendente"}. Proteção de
                adolescentes:{" "}
                {data.gate?.minors_reviewed ? "revisada" : "pendente"}. A
                liberação não pode ser alterada nesta interface.
              </p>
              <Form
                save={(f) =>
                  act("settings", null, data.settings!.version, {
                    ...formObject(f),
                    recruitment_enabled: f.get("recruitment_enabled") === "on",
                  })
                }
              >
                <Field
                  name="introduction"
                  label="Apresentação pública"
                  multiline
                  defaultValue={data.settings.introduction}
                />
                <Field
                  name="trial_intro"
                  label="Introdução privada Trialist"
                  multiline
                  defaultValue={data.settings.trial_intro}
                />
                <Field
                  name="support_text"
                  label="Orientações de suporte"
                  multiline
                  defaultValue={data.settings.support_text}
                />
                <Field
                  name="official_discord"
                  label="Discord oficial da organização"
                  type="url"
                  required={false}
                  defaultValue={data.settings.official_discord}
                />
                <CheckField
                  name="recruitment_enabled"
                  label="Habilitar recebimento após liberação operacional"
                  checked={data.settings.recruitment_enabled}
                />
              </Form>
            </section>
          )}
          {tab === "cycles" && (
            <section className="panel">
              <div className="row between wrap">
                <h2>Ciclos de seleção</h2>
                <button className="button" onClick={() => setCycle(null)}>
                  Criar ciclo
                </button>
              </div>
              {data.cycles.map((c) => (
                <article className="application-card" key={c.id}>
                  <h3>{c.title}</h3>
                  <p>
                    Versão {c.version} ·{" "}
                    {c.published ? "Publicado" : "Rascunho"} ·{" "}
                    {c.is_open ? "Aberto" : "Fechado"}
                  </p>
                  <button className="button" onClick={() => setCycle(c)}>
                    Editar ciclo
                  </button>
                </article>
              ))}
            </section>
          )}
          {tab === "roles" && (
            <section className="panel">
              <h2>Cargos temporários</h2>
              <p>
                Assinaturas comerciais não concedem privilégios. Staff/Admin
                exigem um administrador global. Atribuição a si mesmo é recusada
                no servidor.
              </p>
              <Form
                save={(f) =>
                  act(
                    "grant_role",
                    String(f.get("application_id") || "") || null,
                    0,
                    { ...formObject(f), ends_at: isoDate(f.get("ends_at")) },
                  )
                }
              >
                <Field name="user_id" label="UUID da conta" />
                <Field
                  name="application_id"
                  label="UUID da candidatura (Trialist)"
                  required={false}
                />
                <label>
                  Cargo
                  <select name="role">
                    <option value="trialist">Trialist</option>
                    <option value="esports_staff">Avaliador esports</option>
                    <option value="esports_admin">Administrador esports</option>
                  </select>
                </label>
                <Field name="ends_at" label="Expiração" type="datetime-local" />
                <Field name="reason" label="Motivo interno" multiline />
              </Form>
              <form
                className="row wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  setQuery(
                    String(new FormData(e.currentTarget).get("query") || ""),
                  );
                }}
              >
                <label>
                  Buscar conta (nome ou UUID)
                  <input name="query" minLength={3} maxLength={120} />
                </label>
                <button className="button">Buscar usuário</button>
              </form>
              {data.users.map((u) => (
                <p key={u.id}>
                  {u.display_name} · <code>{u.id}</code>
                </p>
              ))}
              {data.roles.map((r) => (
                <article className="application-card" key={r.id}>
                  <Badge>{roleLabels[r.role]}</Badge>
                  <p>
                    {r.user_id} · Até{" "}
                    {new Date(r.ends_at).toLocaleString("pt-BR")} ·{" "}
                    {r.revoked_at ? "Revogado" : "Registro concedido"}
                  </p>
                  <p>{r.reason}</p>
                  {!r.revoked_at && (
                    <Form
                      save={(f) => act("revoke_role", r.id, 0, formObject(f))}
                    >
                      <Field name="reason" label="Motivo da revogação" />
                    </Form>
                  )}
                </article>
              ))}
            </section>
          )}
          {tab === "audit" && (
            <section className="panel">
              <h2>Histórico de operações</h2>
              <p>
                Auditoria interna com responsável e momento. Histórico de cargos
                e candidatos não é público.
              </p>
              {data.audit.map((a) => (
                <article className="application-card" key={a.id}>
                  <strong>{a.action}</strong>
                  <p>
                    Responsável: {a.actor_id || "Conta removida"} · Alvo:{" "}
                    {a.target_id || "Configuração"}
                  </p>
                  <small>
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </small>
                </article>
              ))}
            </section>
          )}
          {(tab === "roles" || tab === "audit") && (
            <nav className="row wrap" aria-label="Paginação administrativa">
              <button
                className="button"
                disabled={loading || offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 100))}
              >
                Página anterior
              </button>
              <span>Página {offset / 100 + 1}</span>
              <button
                className="button"
                disabled={
                  loading ||
                  (tab === "roles" ? data.roles.length : data.audit.length) <
                    100
                }
                onClick={() => setOffset(offset + 100)}
              >
                Próxima página
              </button>
            </nav>
          )}
          {app && (
            <Modal
              title={`Candidatura — ${app.payload.nickname}`}
              onClose={() => setApp(null)}
            >
              <Badge>{statusLabels[app.status]}</Badge>
              <p>
                <code>{app.user_id}</code> · Versão {app.version}
              </p>
              <dl>
                {Object.entries(app.payload)
                  .filter(([k]) => k !== "links")
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>
                        {
                          (
                            {
                              nickname: "Nickname",
                              epic_nick: "Epic declarado",
                              mode: "Modalidade",
                              format: "Formato",
                              experience: "Experiência",
                              objectives: "Objetivos",
                              availability: "Disponibilidade",
                              region: "Região",
                              motivation: "Motivação",
                              age_band: "Faixa etária declarada",
                            } as Record<string, string>
                          )[k]
                        }
                      </dt>
                      <dd className="preserve-lines">{String(v)}</dd>
                    </div>
                  ))}
              </dl>
              {app.payload.links.map((l) => (
                <p key={l}>
                  <a
                    className="text-link"
                    href={l}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Link fornecido pelo candidato
                  </a>
                </p>
              ))}
              <h3>Observações internas</h3>
              {data.reviews
                .filter((r) => r.application_id === app.id)
                .map((r) => (
                  <article className="application-card" key={r.id}>
                    <small>
                      {r.kind === "practical" ? "Avaliação prática" : "Revisão"}{" "}
                      · {r.actor_id}
                    </small>
                    <p className="preserve-lines">{r.note}</p>
                  </article>
                ))}
              <Form
                save={(f) =>
                  act(String(f.get("kind")), app.id, app.version, formObject(f))
                }
              >
                <label>
                  Tipo
                  <select name="kind">
                    <option value="note">Revisão interna</option>
                    <option value="practical">
                      Avaliação prática observada / autodeclarada identificada
                    </option>
                  </select>
                </label>
                <Field
                  name="note"
                  label="Observação (indique origem e contexto)"
                  multiline
                />
              </Form>
              {data.settings && (
                <>
                  <h3>Decisão e mensagem ao candidato</h3>
                  <Form
                    save={(f) =>
                      act("status", app.id, app.version, formObject(f))
                    }
                  >
                    <label>
                      Próximo estado
                      <select name="status" required>
                        {(nextStatuses[app.status] || []).map((st) => (
                          <option key={st} value={st}>
                            {statusLabels[st]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field
                      name="message"
                      label="Mensagem compartilhada com candidato"
                      multiline
                    />
                    <Field
                      name="reason"
                      label="Motivo confidencial da decisão"
                      multiline
                    />
                  </Form>
                  <Link
                    className="button"
                    to={`/admin/esports/development?application_id=${app.id}&version=${app.version}`}
                  >
                    Consultar desenvolvimento e oferecer bolsa
                  </Link>
                  <h3>Delegar avaliação</h3>
                  <Form
                    save={(f) =>
                      act("assign_reviewer", app.id, 0, {
                        ...formObject(f),
                        revoke: f.get("revoke") === "on",
                      })
                    }
                  >
                    <Field
                      name="user_id"
                      label="UUID do avaliador com cargo ativo"
                    />
                    <CheckField name="revoke" label="Revogar atribuição" />
                  </Form>
                </>
              )}
            </Modal>
          )}
          {cycle !== undefined && (
            <Modal
              title={cycle ? "Editar ciclo" : "Novo ciclo"}
              onClose={() => setCycle(undefined)}
            >
              <Form
                save={async (f) => {
                  await act("cycle", cycle?.id || null, cycle?.version || 0, {
                    ...formObject(f),
                    retention_days: Number(f.get("retention_days")),
                    starts_at: isoDate(f.get("starts_at")),
                    ends_at: isoDate(f.get("ends_at")),
                    published: f.get("published") === "on",
                    is_open: f.get("is_open") === "on",
                    allow_minors: f.get("allow_minors") === "on",
                  });
                  setCycle(undefined);
                }}
              >
                <Field
                  name="title"
                  label="Título"
                  defaultValue={cycle?.title}
                />
                <label>
                  Modalidade
                  <select name="mode" defaultValue={cycle?.mode || "both"}>
                    <option value="both">Ambas</option>
                    <option value="build">Construção</option>
                    <option value="zero">Zero Build</option>
                  </select>
                </label>
                <Field
                  name="format"
                  label="Formatos e contexto"
                  defaultValue={cycle?.format}
                />
                <Field
                  name="criteria"
                  label="Critérios transparentes"
                  multiline
                  defaultValue={cycle?.criteria}
                />
                <Field
                  name="rules"
                  label="Regras do ciclo (revisão necessária)"
                  multiline
                  defaultValue={cycle?.rules}
                />
                <Field
                  name="privacy_notice"
                  label="Finalidade, dados, acesso e retenção (revisão necessária)"
                  multiline
                  defaultValue={cycle?.privacy_notice}
                />
                <Field
                  name="policy_version"
                  label="Versão da política revisada"
                  defaultValue={cycle?.policy_version}
                />
                <Field
                  name="retention_days"
                  label="Retenção em dias (30–730)"
                  type="number"
                  defaultValue={cycle?.retention_days || 180}
                />
                <Field
                  name="starts_at"
                  label="Início"
                  type="datetime-local"
                  defaultValue={localDate(cycle?.starts_at)}
                />
                <Field
                  name="ends_at"
                  label="Fim"
                  type="datetime-local"
                  defaultValue={localDate(cycle?.ends_at)}
                />
                <CheckField
                  name="published"
                  label="Publicar informação do ciclo"
                  checked={cycle?.published}
                />
                <CheckField
                  name="is_open"
                  label="Abrir inscrições após liberação operacional"
                  checked={cycle?.is_open}
                />
                <CheckField
                  name="allow_minors"
                  label="Aceitar adolescentes com proteção e autorização verificadas"
                  checked={cycle?.allow_minors}
                />
              </Form>
            </Modal>
          )}
        </>
      )}
    </>
  );
}
