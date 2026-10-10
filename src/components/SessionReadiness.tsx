import { useState } from "react";
import { useStore } from "../lib/store";
import type { Readiness } from "../lib/intelligence-types";
export function SessionReadiness({ sessionId }: { sessionId: string }) {
  const s = useStore(),
    saved = s.data.readiness.find((r) => r.id === sessionId);
  const [row, setRow] = useState<Readiness>(
    saved || {
      id: sessionId,
      user_id: s.data.profile!.id,
      energy: null,
      focus: null,
      available_minutes: s.data.profile!.minutes,
      style: "habitual",
      created_at: new Date().toISOString(),
    },
  );
  return (
    <details className="panel">
      <summary>Como quero organizar esta sessão? (opcional)</summary>
      <p className="muted">
        Percepção pessoal, sem avaliação de saúde. Não é enviada ao Coach ou a
        provedores externos. Você pode deixar os campos vazios ou excluir o
        registro.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          s.run(
            () => s.save("readiness", row),
            "Preferência desta sessão salva.",
          );
        }}
      >
        <div className="form-grid">
          {(["energy", "focus"] as const).map((key) => (
            <label key={key}>
              {key === "energy"
                ? "Energia percebida"
                : "Concentração percebida"}
              <select
                value={row[key] ?? ""}
                onChange={(e) =>
                  setRow({
                    ...row,
                    [key]: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">Prefiro não informar</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} ·{" "}
                    {n === 1 ? "baixa" : n === 5 ? "alta" : "intermediária"}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label>
            Tempo disponível nesta sessão
            <input
              required
              type="number"
              min={1}
              max={240}
              value={row.available_minutes}
              onChange={(e) =>
                setRow({ ...row, available_minutes: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Preferência de sessão
            <select
              value={row.style}
              onChange={(e) =>
                setRow({ ...row, style: e.target.value as Readiness["style"] })
              }
            >
              <option value="light">Leve</option>
              <option value="habitual">Habitual</option>
            </select>
          </label>
        </div>
        {row.style === "light" && (
          <p>
            Você pode pausar, pular etapas ou encerrar sem concluir todas. Sua
            escolha não muda automaticamente a rotina, a agenda ou os
            resultados.
          </p>
        )}
        <div className="row wrap">
          <button className="button" disabled={s.busy}>
            Salvar preferência da sessão
          </button>
          {saved && (
            <button
              className="button"
              type="button"
              disabled={s.busy}
              onClick={() =>
                s.run(
                  () => s.remove("readiness", sessionId),
                  "Registro opcional excluído.",
                )
              }
            >
              Excluir registro opcional
            </button>
          )}
        </div>
      </form>
    </details>
  );
}
