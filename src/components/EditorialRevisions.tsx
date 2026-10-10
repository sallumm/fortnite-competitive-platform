import { useEffect, useState } from "react";
import { supabase } from "../lib/client";
type Revision = {
  id: number;
  operation: string;
  changed_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};
export function EditorialRevisions({
  table,
  id,
}: {
  table: string;
  id: string;
}) {
  const [rows, setRows] = useState<Revision[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setRows([]);
    setError("");
    void (async () => {
      const r = await supabase!
        .from("content_revision_history")
        .select("id,operation,changed_at,before_data,after_data")
        .eq("table_name", table)
        .eq("record_id", id)
        .order("changed_at", { ascending: false })
        .limit(20);
      if (active) {
        if (r.error) setError("Não foi possível carregar revisões.");
        else setRows(r.data || []);
      }
    })();
    return () => {
      active = false;
    };
  }, [table, id]);
  return (
    <details className="panel">
      <summary>Histórico de edição · últimas 20 revisões</summary>
      {error && <p role="alert">{error}</p>}
      {rows.map((r) => (
        <div key={r.id} className="list-row">
          <div>
            <strong>
              {r.operation} · {new Date(r.changed_at).toLocaleString("pt-BR")}
            </strong>
            <small>
              Campos:{" "}
              {Object.keys(r.after_data || r.before_data || {})
                .filter(
                  (k) =>
                    JSON.stringify(r.before_data?.[k]) !==
                    JSON.stringify(r.after_data?.[k]),
                )
                .join(", ")}
            </small>
          </div>
        </div>
      ))}
      {!rows.length && !error && <p>Sem revisões carregadas.</p>}
    </details>
  );
}
