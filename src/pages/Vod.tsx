import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { skills, type Skill } from "../lib/performance-types";
import {
  vodCategories,
  type VodReview,
  type VodMarker,
} from "../lib/intelligence-types";
import { dateInZone } from "../lib/calendar";
import { Badge, Heading, Modal } from "../components/ui";
const kindLabels = {
  mistake: "Erro percebido",
  good: "Decisão correta",
  question: "Questão para investigar",
};
const timestamp = (n: number) =>
  `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
export default function Vod() {
  const s = useStore();
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [editing, setEditing] = useState<VodReview | null>(null),
    [open, setOpen] = useState(false),
    [deleting, setDeleting] = useState<VodReview | null>(null);
  const rows = s.data.vodReviews
    .filter(
      (r) =>
        (!category || r.markers.some((m) => m.category === category)) &&
        [r.title, r.notes, ...r.markers.map((m) => m.note)]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(query.toLocaleLowerCase("pt-BR")),
    )
    .sort((a, b) => b.match_date.localeCompare(a.match_date));
  const recurring = Object.entries(vodCategories)
    .map(([key, label]) => ({
      label,
      count: s.data.vodReviews.filter((r) =>
        r.markers.some((m) => m.category === key && m.kind === "mistake"),
      ).length,
    }))
    .filter((x) => x.count >= 2);
  return (
    <>
      <Heading
        eyebrow="VOD REVIEW CENTER"
        title="Reveja decisões, registre contexto."
        description="Revisões manuais e privadas. Não há análise automática, upload ou processamento de vídeo por IA."
        action={
          <button
            className="button primary"
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            Criar revisão de VOD
          </button>
        }
      />
      <div className="panel form-grid">
        <label>
          Pesquisar revisões
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Partida, problema ou observação"
          />
        </label>
        <label>
          Categoria de VOD
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas as situações</option>
            {Object.entries(vodCategories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {recurring.length > 0 && (
        <section className="panel">
          <h2>Padrões relatados por você</h2>
          {recurring.map((x) => (
            <p key={x.label}>
              {x.label}: erros percebidos em {x.count} revisões distintas.
              Relato manual; frequência não identifica a causa.
            </p>
          ))}
        </section>
      )}
      {!rows.length && (
        <section className="panel">
          <h2>Nenhuma revisão encontrada</h2>
          <p>
            Registre uma decisão, seu timestamp e o que deseja investigar. O
            link do vídeo é opcional.
          </p>
        </section>
      )}
      {rows.map((r) => (
        <article className="panel" key={r.id}>
          <div className="section-title">
            <h2>{r.title}</h2>
            <Badge>Revisão manual</Badge>
          </div>
          <p className="muted">
            {r.match_date} · {r.markers.length} marcadores ·{" "}
            {r.tournament_id
              ? s.catalog.tournaments.find((t) => t.id === r.tournament_id)
                  ?.title
              : "Sem competição vinculada"}
          </p>
          <p>{r.notes}</p>
          {r.video_url && (
            <a
              className="button"
              href={r.video_url}
              target="_blank"
              rel="noreferrer"
            >
              Abrir vídeo autorizado
            </a>
          )}
          <div className="row wrap">
            {r.skills.map((k) => (
              <Badge key={k}>{skills[k]}</Badge>
            ))}
          </div>
          <div className="row wrap">
            {s.catalog.exercises
              .filter((e) => r.exercise_ids.includes(e.id))
              .map((e) => (
                <Link className="text-link" key={e.id} to={"/library/" + e.id}>
                  {e.title}
                </Link>
              ))}
          </div>
          <details>
            <summary>Consultar marcadores e decisões</summary>
            {[...r.markers]
              .sort((a, b) => a.seconds - b.seconds)
              .map((m) => (
                <div key={m.id} className="list-row">
                  <div>
                    <strong>
                      {timestamp(m.seconds)} · {vodCategories[m.category]} ·{" "}
                      {kindLabels[m.kind]}
                    </strong>
                    <p>{m.note}</p>
                    <small>{m.skills.map((k) => skills[k]).join(", ")}</small>
                  </div>
                </div>
              ))}
          </details>
          <div className="row wrap">
            <button
              className="button"
              onClick={() => {
                setEditing(r);
                setOpen(true);
              }}
            >
              Editar revisão {r.title}
            </button>
            <button className="button danger" onClick={() => setDeleting(r)}>
              Excluir revisão {r.title}
            </button>
          </div>
        </article>
      ))}
      <Link className="button" to="/app/evolution">
        Consultar Minha Evolução
      </Link>
      {open && (
        <Editor
          key={editing?.id || "new"}
          initial={editing}
          close={() => setOpen(false)}
        />
      )}
      {deleting && (
        <Modal
          title="Excluir revisão de VOD?"
          onClose={() => setDeleting(null)}
        >
          <p>
            Excluir “{deleting.title}” e seus marcadores? Esta ação não altera
            sessões ou XP.
          </p>
          <button
            className="button danger"
            disabled={s.busy}
            onClick={() =>
              s.run(async () => {
                await s.remove("vodReviews", deleting.id);
                setDeleting(null);
              })
            }
          >
            Confirmar exclusão da revisão
          </button>
        </Modal>
      )}
    </>
  );
}
function Editor({
  initial,
  close,
}: {
  initial: VodReview | null;
  close: () => void;
}) {
  const s = useStore(),
    p = s.data.profile!;
  const [row, setRow] = useState<VodReview>(
    () =>
      initial || {
        id: crypto.randomUUID(),
        user_id: p.id,
        title: "",
        match_date: dateInZone(new Date(), p.timezone),
        tournament_id: null,
        video_url: "",
        video_authorized: false,
        duration_seconds: null,
        exercise_ids: [],
        skills: [],
        notes: "",
        markers: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
  );
  const empty = (): VodMarker => ({
    id: crypto.randomUUID(),
    seconds: 0,
    category: "decisions",
    kind: "question",
    note: "",
    skills: [],
  });
  const [marker, setMarker] = useState(empty),
    [error, setError] = useState("");
  const patch = (value: Partial<VodReview>) =>
    setRow((r) => ({ ...r, ...value }));
  const commitMarker = () => {
    if (
      !marker.note.trim() ||
      !Number.isInteger(marker.seconds) ||
      marker.seconds < 0 ||
      marker.seconds > 86400 ||
      (row.duration_seconds && marker.seconds > row.duration_seconds)
    ) {
      setError("Confira a observação, o timestamp e a duração da partida.");
      return;
    }
    const previous = row.markers.filter((m) => m.id !== marker.id);
    if (previous.length >= 80) {
      setError("Limite de 80 marcadores por revisão.");
      return;
    }
    patch({ markers: [...previous, { ...marker, note: marker.note.trim() }] });
    setMarker(empty());
    setError("");
  };
  return (
    <Modal
      title={initial ? "Editar revisão de VOD" : "Criar revisão de VOD"}
      onClose={close}
    >
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          s.run(async () => {
            const pending = marker.note.trim()
              ? {
                  ...row,
                  markers: [
                    ...row.markers.filter((m) => m.id !== marker.id),
                    { ...marker, note: marker.note.trim() },
                  ],
                }
              : row;
            await s.save("vodReviews", {
              ...pending,
              updated_at: new Date().toISOString(),
            });
            close();
          });
        }}
      >
        <label>
          Nome da partida ou revisão
          <input
            required
            maxLength={160}
            value={row.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Data da partida
            <input
              type="date"
              required
              value={row.match_date}
              onChange={(e) => patch({ match_date: e.target.value })}
            />
          </label>
          <label>
            Competição da revisão
            <select
              value={row.tournament_id || ""}
              onChange={(e) => patch({ tournament_id: e.target.value || null })}
            >
              <option value="">Sem vínculo</option>
              {s.catalog.tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Link autorizado do vídeo (opcional)
          <input
            type="url"
            maxLength={500}
            value={row.video_url}
            onChange={(e) =>
              patch({ video_url: e.target.value, video_authorized: false })
            }
            placeholder="HTTPS · YouTube ou Twitch"
          />
        </label>
        {row.video_url && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              required
              checked={row.video_authorized}
              onChange={(e) => patch({ video_authorized: e.target.checked })}
            />
            Tenho permissão para usar este vídeo nesta revisão privada.
          </label>
        )}
        <label>
          Duração do vídeo em segundos (opcional)
          <input
            type="number"
            min={1}
            max={86400}
            value={row.duration_seconds ?? ""}
            onChange={(e) =>
              patch({
                duration_seconds: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </label>
        <fieldset>
          <legend>Habilidades relacionadas à revisão</legend>
          <div className="weekday-picker">
            {Object.entries(skills).map(([key, label]) => (
              <label className="checkbox-label" key={key}>
                <input
                  type="checkbox"
                  checked={row.skills.includes(key as Skill)}
                  onChange={(e) =>
                    patch({
                      skills: e.target.checked
                        ? [...row.skills, key as Skill]
                        : row.skills.filter((k) => k !== key),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label>
          Exercício relacionado ao VOD
          <select
            value=""
            onChange={(e) => {
              if (
                e.target.value &&
                !row.exercise_ids.includes(e.target.value) &&
                row.exercise_ids.length < 20
              )
                patch({ exercise_ids: [...row.exercise_ids, e.target.value] });
            }}
          >
            <option value="">Adicionar exercício</option>
            {s.catalog.exercises
              .filter((e) => e.published)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title}
                </option>
              ))}
          </select>
        </label>
        {row.exercise_ids.map((id) => (
          <button
            type="button"
            className="button small"
            key={id}
            onClick={() =>
              patch({ exercise_ids: row.exercise_ids.filter((x) => x !== id) })
            }
          >
            Remover vínculo:{" "}
            {s.catalog.exercises.find((e) => e.id === id)?.title}
          </button>
        ))}
        <label>
          Observações da revisão
          <textarea
            maxLength={4000}
            value={row.notes}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </label>
        <fieldset>
          <legend>Marcadores de decisões</legend>
          <div className="form-grid">
            <label>
              Timestamp em segundos
              <input
                type="number"
                min={0}
                max={row.duration_seconds || 86400}
                value={marker.seconds}
                onChange={(e) =>
                  setMarker({ ...marker, seconds: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Situação do marcador
              <select
                value={marker.category}
                onChange={(e) =>
                  setMarker({
                    ...marker,
                    category: e.target.value as VodMarker["category"],
                  })
                }
              >
                {Object.entries(vodCategories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tipo de observação
              <select
                value={marker.kind}
                onChange={(e) =>
                  setMarker({
                    ...marker,
                    kind: e.target.value as VodMarker["kind"],
                  })
                }
              >
                {Object.entries(kindLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Observação do marcador
            <textarea
              maxLength={1000}
              value={marker.note}
              onChange={(e) => setMarker({ ...marker, note: e.target.value })}
            />
          </label>
          <label>
            Habilidade do marcador
            <select
              value={marker.skills[0] || ""}
              onChange={(e) =>
                setMarker({
                  ...marker,
                  skills: e.target.value ? [e.target.value as Skill] : [],
                })
              }
            >
              <option value="">Não especificada</option>
              {Object.entries(skills).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button" onClick={commitMarker}>
            Registrar marcador
          </button>
          {error && <p role="alert">{error}</p>}
          {row.markers.map((m) => (
            <div className="list-row" key={m.id}>
              <div>
                <strong>
                  {timestamp(m.seconds)} · {kindLabels[m.kind]}
                </strong>
                <p>{m.note}</p>
                <div className="row wrap">
                  <button
                    type="button"
                    className="button small"
                    onClick={() => setMarker({ ...m })}
                  >
                    Editar marcador {timestamp(m.seconds)}
                  </button>
                  <button
                    type="button"
                    className="button small"
                    onClick={() =>
                      patch({
                        markers: row.markers.filter((x) => x.id !== m.id),
                      })
                    }
                  >
                    Remover marcador {timestamp(m.seconds)}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </fieldset>
        <button className="button primary" disabled={s.busy}>
          Salvar revisão de VOD
        </button>
      </form>
    </Modal>
  );
}
