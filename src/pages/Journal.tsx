import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import {
  difficulties,
  type Journal as JournalRow,
  type Difficulty,
} from "../lib/performance-types";
import { dateLabel } from "../lib/logic";
import { Badge, Empty, Heading } from "../components/ui";
export default function Journal() {
  const { id } = useParams();
  return <JournalEntry key={id} id={id} />;
}
function JournalEntry({ id }: { id: string | undefined }) {
  const s = useStore();
  const session = s.data.sessions.find((x) => x.id === id);
  const [row, setRow] = useState<JournalRow>(
    () =>
      s.data.journals.find((j) => j.session_id === id) || {
        id: crypto.randomUUID(),
        user_id: s.data.profile!.id,
        session_id: id!,
        practiced: "",
        improved: "",
        difficult: "",
        next_focus: "",
        difficulties: [],
      },
  );
  if (!session || session.status === "active")
    return (
      <Empty
        title="Encerre uma sessão para escrever seu diário"
        to="/app/reports"
        label="Ver histórico"
      />
    );
  return (
    <>
      <Heading
        eyebrow="DIÁRIO DE TREINAMENTO"
        title="Uma revisão breve, do seu jeito."
        description={`${session.title} · ${dateLabel(session.started_at, s.data.profile!.timezone)}. Todas as respostas são opcionais.`}
        action={
          <Link className="button" to="/app/reports">
            Usar apenas resultados objetivos
          </Link>
        }
      />
      <section className="panel journal">
        <Badge>Relato pessoal · sem pontuação de habilidade</Badge>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            s.run(() => s.save("journals", row));
          }}
        >
          <div className="two-grid">
            {(
              [
                ["practiced", "O que pratiquei?"],
                ["improved", "O que consegui executar melhor?"],
                ["difficult", "Em que tive dificuldade?"],
                ["next_focus", "O que quero trabalhar na próxima sessão?"],
              ] as const
            ).map(([key, title]) => (
              <label key={key}>
                {title}
                <textarea
                  maxLength={1000}
                  rows={3}
                  value={row[key]}
                  onChange={(e) => setRow({ ...row, [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
          <fieldset>
            <legend>Dificuldades recorrentes (opcional)</legend>
            <div className="weekday-picker">
              {Object.entries(difficulties).map(([key, title]) => (
                <label key={key} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={row.difficulties.includes(key as Difficulty)}
                    onChange={(e) =>
                      setRow({
                        ...row,
                        difficulties: e.target.checked
                          ? [...row.difficulties, key as Difficulty]
                          : row.difficulties.filter((d) => d !== key),
                      })
                    }
                  />
                  {title}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="row wrap">
            <button className="button primary" disabled={s.busy}>
              Salvar diário
            </button>
            <Link className="button" to="/app/reports">
              Voltar ao histórico
            </Link>
            {s.data.journals.some((j) => j.id === row.id) && (
              <button
                className="button danger"
                type="button"
                disabled={s.busy}
                onClick={() =>
                  s.run(async () => {
                    await s.remove("journals", row.id);
                    setRow({
                      ...row,
                      practiced: "",
                      improved: "",
                      difficult: "",
                      next_focus: "",
                      difficulties: [],
                    });
                  })
                }
              >
                Excluir diário
              </button>
            )}
          </div>
        </form>
      </section>
    </>
  );
}
