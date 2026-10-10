import { loadMeta } from "../lib/meta-service";
import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  emptyTeams,
  loadTeams,
  teamRpc,
  type TeamData,
} from "../lib/meta-training/service";
import { contextLabel } from "../lib/meta-training/context";
import { ContextSelector } from "../components/meta-training/ContextSelector";
import { Heading, Modal, Empty } from "../components/ui";
import { zonedInstant } from "../lib/calendar";
export default function Teams() {
  const navigate = useNavigate();
  const s = useStore(),
    owner = s.data.profile!.id,
    [params, setParams] = useSearchParams();
  const [data, setData] = useState<TeamData>(emptyTeams),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(!s.demo),
    [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState(""),
    [alias, setAlias] = useState(s.data.profile!.display_name),
    [capacity, setCapacity] = useState(2),
    [token, setToken] = useState(params.get("invite") || ""),
    [invite, setInvite] = useState("");
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    run: () => Promise<void>;
  } | null>(null);
  const [activity, setActivity] = useState({
    title: "",
    objective: "",
    date: "",
    time: "18:00",
    minutes: 30,
    exercise_ids: [] as string[],
    context: "",
  });
  const [resource, setResource] = useState({
    kind: "goal",
    title: "",
    body: "",
    video: "",
    authorized: false,
    context: "",
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const refresh = async () => {
    const next = await loadTeams();
    setData(next);
    setTeamId((id) =>
      next.teams.some((t) => t.id === id) ? id : next.teams[0]?.id || "",
    );
  };
  useEffect(() => {
    let active = true;
    if (!s.demo)
      loadTeams()
        .then((d) => {
          if (active) {
            setData(d);
            setTeamId(d.teams[0]?.id || "");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    return () => {
      active = false;
    };
  }, [s.demo, owner]);
  const selected = data.teams.find((t) => t.id === teamId),
    members = data.members.filter((m) => m.team_id === teamId),
    sessions = data.sessions
      .filter((x) => x.team_id === teamId)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const propose = (
    title: string,
    description: string,
    action: () => Promise<unknown>,
  ) =>
    setConfirm({
      title,
      description,
      run: async () => {
        await action();
        await refresh();
        setConfirm(null);
      },
    });
  return (
    <div>
      <Heading
        eyebrow="PRÁTICA COMPARTILHADA · ACEITE VOLUNTÁRIO"
        title="Minhas equipes"
        description="Organize Duplas, Trios ou um grupo de prática. O grupo não determina o formato oficial de um torneio."
        action={
          <Link className="button" to="/app/meta-training">
            Treinos por contexto
          </Link>
        }
      />
      <p className="alert">
        Somente o apelido escolhido, sessões do grupo, participação e materiais
        explicitamente compartilhados ficam visíveis aos integrantes. Seus
        relatórios, VODs, resultados e agenda particulares continuam privados.
      </p>
      {s.demo ? (
        <Empty title="Equipes exigem contas autenticadas">
          A demonstração não simula o aceite de outra pessoa. Criação, convites
          privados e participação estarão disponíveis com o banco configurado e
          os usuários autenticados.
        </Empty>
      ) : (
        <>
          {error && <p role="alert">{error}</p>}
          {loading && <p aria-live="polite">Carregando minhas equipes…</p>}
          <section className="panel">
            <h2>Criar um grupo</h2>
            <div className="form-grid">
              <label>
                Nome da equipe
                <input
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                Meu apelido compartilhado
                <input
                  maxLength={60}
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                />
              </label>
              <label>
                Integrantes
                <select
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                >
                  <option value={2}>Dupla · 2</option>
                  <option value={3}>Trio · 3</option>
                  <option value={4}>Grupo · 4</option>
                </select>
              </label>
            </div>
            <button
              className="button primary"
              disabled={s.busy || title.trim().length < 3 || !alias.trim()}
              onClick={() =>
                propose(
                  "Confirmar criação da equipe",
                  `${title} · até ${capacity} integrantes. Seu apelido ${alias} será compartilhado após o aceite dos convidados.`,
                  () =>
                    teamRpc("create_training_team", {
                      p_title: title,
                      p_capacity: capacity,
                      p_alias: alias,
                    }),
                )
              }
            >
              Revisar criação
            </button>
          </section>
          <section className="panel">
            <h2>Aceitar convite privado</h2>
            <p>
              Use somente o convite recebido de alguém que você conhece. Ele
              expira em 24 horas e só pode ser usado uma vez. Não há busca de
              desconhecidos ou mensagens na plataforma.
            </p>
            <label>
              Código de convite
              <input
                maxLength={72}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </label>
            <button
              className="button"
              disabled={s.busy || token.length !== 72 || !alias.trim()}
              onClick={() =>
                propose(
                  "Autorizar vínculo de equipe",
                  `Você entrará no grupo que forneceu este código e compartilhará o apelido ${alias}. Seus registros particulares não serão compartilhados.`,
                  async () => {
                    await teamRpc("accept_training_invite", {
                      p_token: token,
                      p_alias: alias,
                      p_confirmation: "ACEITAR",
                    });
                    setToken("");
                    setParams({}, { replace: true });
                  },
                )
              }
            >
              Revisar aceite
            </button>
          </section>
          <label>
            Equipe selecionada
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setInvite("");
              }}
            >
              <option value="">Selecione um grupo</option>
              {data.teams.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.title} · {t.capacity} integrantes
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <section className="panel">
                <h2>{selected.title}</h2>
                <p>
                  {members
                    .map(
                      (m) =>
                        m.alias +
                        (m.user_id === selected.owner_id
                          ? " (responsável)"
                          : ""),
                    )
                    .join(" · ")}
                </p>
                {selected.owner_id === owner && (
                  <>
                    <button
                      className="button"
                      disabled={s.busy}
                      onClick={() =>
                        void s.run(async () => {
                          const result = await teamRpc(
                            "invite_training_member",
                            { p_team: teamId },
                          );
                          setInvite(result.token);
                          await refresh();
                        }, false)
                      }
                    >
                      Gerar convite privado
                    </button>
                    {invite && (
                      <label>
                        Convite · compartilhe pessoalmente com alguém conhecido
                        <input
                          readOnly
                          value={`${window.location.origin}/app/teams?invite=${invite}`}
                        />
                      </label>
                    )}
                    {data.invites
                      .filter(
                        (i) => i.team_id === teamId && !i.used_by && !i.revoked,
                      )
                      .map((i) => (
                        <p key={i.id}>
                          Expira em{" "}
                          {new Date(i.expires_at).toLocaleString("pt-BR")}{" "}
                          <button
                            className="button"
                            onClick={() =>
                              propose(
                                "Revogar este convite?",
                                "O código não poderá mais ser aceito.",
                                () =>
                                  teamRpc("revoke_training_invite", {
                                    p_id: i.id,
                                    p_confirmation: "REVOGAR",
                                  }),
                              )
                            }
                          >
                            Revogar convite
                          </button>
                        </p>
                      ))}
                  </>
                )}
                <button
                  className="button"
                  onClick={() =>
                    propose(
                      selected.owner_id === owner
                        ? "Excluir equipe e registros compartilhados?"
                        : "Sair da equipe?",
                      selected.owner_id === owner
                        ? "A equipe, convites e registros compartilhados serão removidos. Seus dados pessoais serão preservados."
                        : "Seu acesso ao grupo e suas contribuições compartilhadas serão removidos. Seus dados pessoais serão preservados.",
                      () =>
                        teamRpc(
                          selected.owner_id === owner
                            ? "close_training_team"
                            : "leave_training_team",
                          {
                            p_team: teamId,
                            p_confirmation:
                              selected.owner_id === owner
                                ? "EXCLUIR EQUIPE"
                                : "SAIR",
                          },
                        ),
                    )
                  }
                >
                  {selected.owner_id === owner
                    ? "Excluir equipe"
                    : "Sair da equipe"}
                </button>
              </section>
              <section className="panel">
                <h2>Propor sessão compartilhada</h2>
                <div className="form-grid">
                  <label>
                    Nome da sessão
                    <input
                      maxLength={160}
                      value={activity.title}
                      onChange={(e) =>
                        setActivity({ ...activity, title: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Objetivo conjunto
                    <input
                      maxLength={1000}
                      value={activity.objective}
                      onChange={(e) =>
                        setActivity({ ...activity, objective: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Data
                    <input
                      type="date"
                      value={activity.date}
                      onChange={(e) =>
                        setActivity({ ...activity, date: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Horário · {s.data.profile!.timezone}
                    <input
                      type="time"
                      value={activity.time}
                      onChange={(e) =>
                        setActivity({ ...activity, time: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Duração em minutos
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={activity.minutes}
                      onChange={(e) =>
                        setActivity({
                          ...activity,
                          minutes: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <ContextSelector
                  value={activity.context}
                  onChange={(id) => setActivity({ ...activity, context: id })}
                />
                <fieldset>
                  <legend>Exercícios compartilhados</legend>
                  {s.catalog.exercises
                    .filter((e) => e.published)
                    .map((e) => (
                      <label className="checkbox-label" key={e.id}>
                        <input
                          type="checkbox"
                          checked={activity.exercise_ids.includes(e.id)}
                          onChange={(ev) =>
                            setActivity({
                              ...activity,
                              exercise_ids: ev.target.checked
                                ? [...activity.exercise_ids, e.id]
                                : activity.exercise_ids.filter(
                                    (id) => id !== e.id,
                                  ),
                            })
                          }
                        />
                        {e.title}
                      </label>
                    ))}
                </fieldset>
                <button
                  className="button primary"
                  disabled={
                    s.busy ||
                    activity.title.trim().length < 3 ||
                    activity.objective.trim().length < 3 ||
                    !activity.date ||
                    !activity.exercise_ids.length ||
                    activity.minutes < 1 ||
                    activity.minutes > 120 ||
                    activity.minutes < activity.exercise_ids.length
                  }
                  onClick={() => {
                    try {
                      const starts = zonedInstant(
                        activity.date,
                        activity.time,
                        s.data.profile!.timezone,
                      );
                      propose(
                        "Confirmar proposta de sessão",
                        `${activity.title} · ${activity.date} às ${activity.time} (${s.data.profile!.timezone}), ${activity.minutes} min. Cada integrante deverá aceitar individualmente; a agenda privada dele não será modificada.`,
                        () =>
                          teamRpc("schedule_training_team", {
                            p_team: teamId,
                            p_title: activity.title,
                            p_objective: activity.objective,
                            p_starts: starts,
                            p_minutes: activity.minutes,
                            p_exercises: activity.exercise_ids,
                            p_context: activity.context || null,
                            p_confirmation: "AGENDAR",
                          }),
                      );
                    } catch {
                      setError("Confira a data, o horário e o fuso.");
                    }
                  }}
                >
                  Revisar proposta
                </button>
              </section>
              <section className="panel">
                <h2>Calendário e participação do grupo</h2>
                {!sessions.length && (
                  <p>Nenhuma sessão compartilhada registrada.</p>
                )}
                {sessions.map((x) => (
                  <article className="panel" key={x.id}>
                    <h3>{x.title}</h3>
                    <p>
                      {new Date(x.starts_at).toLocaleString("pt-BR", {
                        timeZone: s.data.profile!.timezone,
                      })}{" "}
                      · {x.duration_minutes} min · {x.status}
                    </p>
                    <p>{x.objective}</p>
                    <p className="muted">{contextLabel(x.game_context)}</p>
                    <ul>
                      {x.exercise_ids.map((id, index) => (
                        <li key={index}>
                          <Link to={`/library/${id}`}>
                            {s.catalog.exercises.find((e) => e.id === id)
                              ?.title || "Exercício"}
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <p>
                      {data.participation
                        .filter((p) => p.session_id === x.id)
                        .map(
                          (p) =>
                            (members.find((m) => m.user_id === p.user_id)
                              ?.alias || "Integrante") +
                            ": " +
                            p.status,
                        )
                        .join(" · ") || "Aguardando aceites individuais"}
                    </p>
                    <label>
                      Observação que desejo compartilhar
                      <textarea
                        maxLength={4000}
                        value={
                          notes[x.id] ??
                          data.participation.find(
                            (p) => p.session_id === x.id && p.user_id === owner,
                          )?.notes ??
                          ""
                        }
                        onChange={(e) =>
                          setNotes({ ...notes, [x.id]: e.target.value })
                        }
                      />
                    </label>
                    {x.status === "planned" &&
                      data.participation.some(
                        (p) =>
                          p.session_id === x.id &&
                          p.user_id === owner &&
                          p.status === "accepted",
                      ) && (
                        <button
                          className="button primary"
                          disabled={s.busy}
                          onClick={() =>
                            propose(
                              "Criar minha rotina desta sessão?",
                              "Os exercícios do grupo serão copiados para uma rotina privada sua. Seus resultados continuarão particulares; a participação compartilhada é registrada separadamente.",
                              async () => {
                                const corpus = x.game_context
                                  ? await loadMeta(false)
                                  : null;
                                const teamMode = corpus?.modes.find(
                                  (m) => m.id === x.game_context?.mode_id,
                                );
                                const practiceMode = teamMode
                                  ? teamMode.construction
                                    ? ("build" as const)
                                    : ("zero" as const)
                                  : s.data.profile!.mode;
                                const each = Math.max(
                                  1,
                                  Math.floor(
                                    x.duration_minutes / x.exercise_ids.length,
                                  ),
                                );
                                const plan = {
                                  id: crypto.randomUUID(),
                                  user_id: owner,
                                  title: x.title.slice(0, 80),
                                  objective: x.objective.slice(0, 500),
                                  mode: practiceMode,
                                  level: s.data.profile!.level,
                                  practice_format:
                                    selected.capacity === 2
                                      ? ("duo" as const)
                                      : selected.capacity === 3
                                        ? ("trio" as const)
                                        : ("squad" as const),
                                  meta_context_id:
                                    x.game_context?.context_id || null,
                                  meta_entry_ids: [],
                                  steps: x.exercise_ids.map((id, i) => ({
                                    id: crypto.randomUUID(),
                                    exercise_id: id,
                                    minutes:
                                      i === x.exercise_ids.length - 1
                                        ? Math.max(
                                            1,
                                            x.duration_minutes - each * i,
                                          )
                                        : each,
                                  })),
                                };
                                await s.save("plans", plan);
                                const session = await s.start(plan);
                                navigate(`/app/session/${session.id}`);
                              },
                            )
                          }
                        >
                          Executar minha prática
                        </button>
                      )}
                    {x.status === "planned" && (
                      <div className="actions">
                        {[
                          "accepted",
                          "declined",
                          ...(Date.parse(x.starts_at) <= Date.now()
                            ? ["completed", "interrupted"]
                            : []),
                        ].map((status) => (
                          <button
                            className="button"
                            key={status}
                            onClick={() =>
                              propose(
                                "Confirmar minha participação",
                                `Registrar ${status} nesta sessão e compartilhar somente a observação informada. Não concede XP nem comprova melhoria individual.`,
                                () =>
                                  teamRpc("respond_training_session", {
                                    p_session: x.id,
                                    p_status: status,
                                    p_notes:
                                      notes[x.id] ??
                                      data.participation.find(
                                        (p) =>
                                          p.session_id === x.id &&
                                          p.user_id === owner,
                                      )?.notes ??
                                      "",
                                    p_confirmation: "CONFIRMAR",
                                  }),
                              )
                            }
                          >
                            {
                              {
                                accepted: "Aceitar sessão",
                                declined: "Recusar sessão",
                                completed: "Registrar participação concluída",
                                interrupted: "Registrar interrupção",
                              }[status]
                            }
                          </button>
                        ))}
                        {(x.author_id === owner ||
                          selected.owner_id === owner) && (
                          <button
                            className="button"
                            onClick={() =>
                              propose(
                                "Cancelar sessão do grupo?",
                                "Os registros já feitos serão preservados; a sessão ficará cancelada.",
                                () =>
                                  teamRpc("cancel_training_team_session", {
                                    p_session: x.id,
                                    p_confirmation: "CANCELAR",
                                  }),
                              )
                            }
                          >
                            Cancelar sessão
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <section className="panel">
                <h2>Metas, VODs e notas compartilhadas</h2>
                <p>
                  Registros manuais da equipe, separados dos seus resultados
                  pessoais. Não há análise automática de vídeo.
                </p>
                <label>
                  Tipo
                  <select
                    value={resource.kind}
                    onChange={(e) =>
                      setResource({ ...resource, kind: e.target.value })
                    }
                  >
                    <option value="goal">Objetivo conjunto</option>
                    <option value="vod">VOD Review coletivo</option>
                    <option value="note">Nota de preparação</option>
                  </select>
                </label>
                <label>
                  Título
                  <input
                    maxLength={160}
                    value={resource.title}
                    onChange={(e) =>
                      setResource({ ...resource, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  Objetivo, observações e critérios verificáveis
                  <textarea
                    maxLength={4000}
                    value={resource.body}
                    onChange={(e) =>
                      setResource({ ...resource, body: e.target.value })
                    }
                  />
                </label>
                <ContextSelector
                  value={resource.context}
                  onChange={(id) => setResource({ ...resource, context: id })}
                />
                {resource.kind === "vod" && (
                  <>
                    <label>
                      Link autorizado do vídeo
                      <input
                        type="url"
                        maxLength={500}
                        value={resource.video}
                        onChange={(e) =>
                          setResource({ ...resource, video: e.target.value })
                        }
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={resource.authorized}
                        onChange={(e) =>
                          setResource({
                            ...resource,
                            authorized: e.target.checked,
                          })
                        }
                      />
                      Tenho autorização para compartilhar este vídeo com o grupo
                    </label>
                  </>
                )}
                <button
                  className="button"
                  disabled={
                    s.busy ||
                    resource.title.trim().length < 3 ||
                    (!!resource.video && !resource.authorized)
                  }
                  onClick={() =>
                    propose(
                      "Compartilhar material com a equipe?",
                      `${resource.title}: o texto e o link autorizado serão visíveis aos integrantes deste grupo.`,
                      () =>
                        teamRpc("save_training_team_resource", {
                          p_team: teamId,
                          p_kind: resource.kind,
                          p_title: resource.title,
                          p_body: resource.body,
                          p_video:
                            resource.kind === "vod" ? resource.video : "",
                          p_authorized: resource.authorized,
                          p_context: resource.context || null,
                          p_confirmation: "COMPARTILHAR",
                        }),
                    )
                  }
                >
                  Revisar compartilhamento
                </button>
                {data.resources
                  .filter((r) => r.team_id === teamId)
                  .map((r) => (
                    <article key={r.id}>
                      <h3>{r.title}</h3>
                      <p className="muted">
                        {r.kind} · {contextLabel(r.game_context)}
                      </p>
                      <p>{r.body}</p>
                      {r.video_url && (
                        <a
                          href={r.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Abrir vídeo autorizado
                        </a>
                      )}
                      {r.author_id === owner && (
                        <button
                          className="button"
                          onClick={() =>
                            propose(
                              "Excluir meu material compartilhado?",
                              "O material deixará de estar disponível ao grupo.",
                              () =>
                                teamRpc("delete_training_team_resource", {
                                  p_id: r.id,
                                  p_confirmation: "EXCLUIR",
                                }),
                            )
                          }
                        >
                          Excluir material
                        </button>
                      )}
                    </article>
                  ))}
              </section>
            </>
          )}
          {confirm && (
            <Modal title={confirm.title} onClose={() => setConfirm(null)}>
              <p>{confirm.description}</p>
              <button
                className="button primary"
                disabled={s.busy}
                onClick={() => void s.run(confirm.run, "Operação confirmada.")}
              >
                Confirmar operação
              </button>
              <button
                className="button"
                disabled={s.busy}
                onClick={() => setConfirm(null)}
              >
                Voltar sem alterar
              </button>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
