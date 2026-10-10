import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { loadPaths, savePath, type AcademyPath } from "../lib/academy-paths";
import { Empty, Heading } from "../components/ui";
export default function AcademyAdmin() {
  const s = useStore();
  const [paths, setPaths] = useState<AcademyPath[]>([]);
  const [edit, setEdit] = useState<AcademyPath | null>(null);
  const [error, setError] = useState("");
  const refresh = () =>
    loadPaths(false)
      .then(setPaths)
      .catch(() => setError("Não foi possível carregar as trilhas."));
  useEffect(() => {
    if (s.admin && !s.demo) void refresh();
  }, [s.admin, s.demo]);
  if (!s.admin || s.demo) return <Empty title="Acesso restrito à curadoria" />;
  const lessons = s.editorial.articles.filter(
    (a) => a.kind === "lesson" && a.curriculum,
  );
  return (
    <>
      <Heading
        eyebrow="CURADORIA"
        title="Organização da Academy"
        description="Trilhas reutilizam as aulas, fontes e pré-requisitos do cadastro editorial. Publique somente módulos com conteúdo real."
      />
      <Link to="/admin">Editar aulas, perguntas e fontes</Link>
      {error && <p role="alert">{error}</p>}
      <div className="two-grid">
        <section className="panel">
          <h2>Trilhas</h2>
          <button
            className="button"
            onClick={() =>
              setEdit({
                id: `trilha-${crypto.randomUUID()}`,
                title: "",
                description: "",
                slugs: [],
                published: false,
                position: paths.length,
              })
            }
          >
            Nova trilha
          </button>
          {paths.map((p) => (
            <p key={p.id}>
              <button onClick={() => setEdit(structuredClone(p))}>
                {p.title} · {p.published ? "Publicada" : "Rascunho"}
              </button>
            </p>
          ))}
        </section>
        {edit && (
          <form
            className="panel"
            onSubmit={(e) => {
              e.preventDefault();
              void s.run(async () => {
                await savePath(edit);
                await refresh();
              }, "Trilha salva.");
            }}
          >
            <label>
              Título da trilha
              <input
                value={edit.title}
                maxLength={160}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
              />
            </label>
            <label>
              Descrição e limites
              <textarea
                value={edit.description}
                maxLength={1000}
                onChange={(e) =>
                  setEdit({ ...edit, description: e.target.value })
                }
              />
            </label>
            <label>
              Posição
              <input
                type="number"
                min={0}
                max={1000}
                value={edit.position}
                onChange={(e) =>
                  setEdit({ ...edit, position: Number(e.target.value) })
                }
              />
            </label>
            <h3>Aulas na ordem de estudo</h3>
            {edit.slugs.map((slug, i) => (
              <div className="row" key={slug}>
                <span>
                  {lessons.find((a) => a.slug === slug)?.title || slug}
                </span>
                <button
                  type="button"
                  aria-label={`Mover ${slug} para cima`}
                  disabled={i === 0}
                  onClick={() => {
                    const slugs = [...edit.slugs];
                    [slugs[i - 1], slugs[i]] = [slugs[i], slugs[i - 1]];
                    setEdit({ ...edit, slugs });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEdit({
                      ...edit,
                      slugs: edit.slugs.filter((x) => x !== slug),
                    })
                  }
                >
                  Remover
                </button>
              </div>
            ))}
            <label>
              Adicionar aula
              <select
                value=""
                onChange={(e) =>
                  setEdit({ ...edit, slugs: [...edit.slugs, e.target.value] })
                }
              >
                <option value="">Selecione</option>
                {lessons
                  .filter((a) => !edit.slugs.includes(a.slug))
                  .map((a) => (
                    <option key={a.id} value={a.slug}>
                      {a.title}
                      {a.published ? "" : " (rascunho)"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={edit.published}
                onChange={(e) =>
                  setEdit({ ...edit, published: e.target.checked })
                }
              />
              Publicada (desmarque para arquivar)
            </label>
            <button className="button primary" disabled={s.busy}>
              Salvar trilha
            </button>
          </form>
        )}
      </div>
    </>
  );
}
