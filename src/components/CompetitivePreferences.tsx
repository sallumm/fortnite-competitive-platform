import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { supabase } from "../lib/client";
import { regions } from "../lib/competitive";
export function CompetitivePreferences({
  onChange,
}: {
  onChange: (xs: string[]) => void;
}) {
  const s = useStore(),
    [chosen, setChosen] = useState<string[]>(["BR"]),
    [reminders, setReminders] = useState(false),
    [ready, setReady] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    setReady(false);
    async function load() {
      try {
        let row;
        if (s.demo)
          row = JSON.parse(
            localStorage.getItem("clutchfolio-competitive-demo") || "null",
          );
        else if (supabase && s.data.profile) {
          const r = await supabase
            .from("competitive_preferences")
            .select("*")
            .eq("id", s.data.profile.id)
            .maybeSingle();
          if (r.error) throw r.error;
          row = r.data;
        }
        if (active) {
          const xs = row?.regions || ["BR"];
          setChosen(xs);
          onChange(xs);
          setReminders(row?.reminders_enabled || false);
          setReady(true);
        }
      } catch {
        if (active) setMessage("Não foi possível carregar suas preferências.");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [s.data.profile?.id, s.demo, onChange]);
  if (!s.data.profile) return null;
  return (
    <details className="panel">
      <summary>Regiões e lembretes opcionais</summary>
      <fieldset disabled={!ready}>
        <legend>Regiões para a aba Minhas regiões</legend>
        <div className="row">
          {[...regions, "GLOBAL"].map((r) => (
            <label key={r} className="checkbox-label">
              <input
                type="checkbox"
                checked={chosen.includes(r)}
                onChange={(e) => {
                  const xs = e.target.checked
                    ? [...chosen, r]
                    : chosen.filter((x) => x !== r);
                  setChosen(xs);
                  onChange(xs);
                }}
              />
              {r}
            </label>
          ))}
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={reminders}
            onChange={(e) => setReminders(e.target.checked)}
          />
          Resumo de favoritos da semana ao abrir esta central
        </label>
        <button
          className="button"
          disabled={s.busy || !chosen.length}
          onClick={() =>
            s.run(async () => {
              const row = {
                id: s.data.profile!.id,
                regions: chosen,
                reminders_enabled: reminders,
              };
              if (s.demo)
                localStorage.setItem(
                  "clutchfolio-competitive-demo",
                  JSON.stringify(row),
                );
              else {
                const r = await supabase!
                  .from("competitive_preferences")
                  .upsert(row);
                if (r.error) throw r.error;
              }
              setMessage("Preferências salvas.");
            })
          }
        >
          Salvar preferências
        </button>
      </fieldset>
      {message && <p role="status">{message}</p>}
      {reminders && (
        <p className="alert">
          Favoritos desta semana:{" "}
          {
            s.catalog.tournaments.filter(
              (t) =>
                s.data.bookmarks.some(
                  (b) => b.kind === "tournament" && b.target_id === t.id,
                ) &&
                t.start_date <=
                  new Date(Date.now() + 7 * 86400000)
                    .toISOString()
                    .slice(0, 10) &&
                t.end_date >= new Date().toISOString().slice(0, 10),
            ).length
          }
          . Confira a fonte de cada evento. Lembrete exibido somente com esta
          página aberta.
        </p>
      )}
    </details>
  );
}
