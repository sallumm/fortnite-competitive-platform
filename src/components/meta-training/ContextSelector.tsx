import { useEffect, useState } from "react";
import { loadMeta } from "../../lib/meta-service";
import type { MetaCatalog } from "../../lib/meta";
import { useStore } from "../../lib/store";
export function ContextSelector({
  value,
  onChange,
  mode,
}: {
  value: string;
  onChange: (id: string, catalog: MetaCatalog) => void;
  mode?: "build" | "zero";
}) {
  const s = useStore();
  const [catalog, setCatalog] = useState<MetaCatalog | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadMeta(s.demo)
      .then((c) => {
        if (active) setCatalog(c);
      })
      .catch(() => {
        if (active)
          setError("Não foi possível carregar os contextos editoriais.");
      });
    return () => {
      active = false;
    };
  }, [s.demo]);
  return (
    <label>
      Contexto do jogo e regulamento
      <select
        value={value}
        disabled={!catalog}
        onChange={(e) => catalog && onChange(e.target.value, catalog)}
      >
        <option value="">Sem contexto · fundamentos gerais</option>
        {catalog?.contexts
          .filter(
            (c) =>
              !mode ||
              catalog.modes.find((m) => m.id === c.mode_id)?.construction ===
                (mode === "build"),
          )
          .map((c) => (
            <option value={c.id} key={c.id}>
              {catalog.versions.find((v) => v.id === c.version_id)?.patch} ·{" "}
              {catalog.modes.find((m) => m.id === c.mode_id)?.title} ·{" "}
              {catalog.formats.find((f) => f.id === c.format_id)?.title} ·{" "}
              {c.play_context} · {c.region}
            </option>
          ))}
      </select>
      <small>
        Ranked e torneios são contextos distintos. Formatos não especificados
        não confirmam Solo, Duplas ou Trios.
      </small>
      {error && <span role="alert">{error}</span>}
    </label>
  );
}
