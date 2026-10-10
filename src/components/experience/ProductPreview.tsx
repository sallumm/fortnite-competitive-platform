import { useState } from "react";
import { CalendarDays, Target, ArrowRight } from "lucide-react";
import {
  AnimatedTabs,
  ProgressIndicator,
  StatCounter,
  TrainingStepTransition,
} from "./primitives";
import { useStore } from "../../lib/store";
export function ProductPreview({ onExplore }: { onExplore: () => void }) {
  const s = useStore();
  const [tab, setTab] = useState("plan");
  const [minutes, setMinutes] = useState(30);
  const [days, setDays] = useState([0, 2, 4]);
  const [completed, setCompleted] = useState(0);
  const exercise = s.catalog.exercises.find((e) => e.category === "aim");
  return (
    <div className="product-preview">
      <div className="preview-top">
        <span className="brand-mark">C</span>
        <strong>SEU PLANO DE JOGO</strong>
        <span className="badge green">INTERATIVO</span>
      </div>
      <AnimatedTabs
        label="Prévia do produto"
        value={tab}
        onChange={setTab}
        items={[
          { value: "plan", label: "Planejamento" },
          { value: "progress", label: "Evolução" },
          { value: "coach", label: "Coach" },
        ]}
      />
      <TrainingStepTransition identity={tab}>
        {tab === "plan" && (
          <>
            <h3>Uma semana com intenção.</h3>
            <label>
              Duração da sessão
              <select
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              >
                {[30, 45, 60].map((n) => (
                  <option value={n} key={n}>
                    {n} minutos
                  </option>
                ))}
              </select>
            </label>
            <div className="preview-days">
              {["SEG", "TER", "QUA", "QUI", "SEX"].map((day, i) => (
                <button
                  key={day}
                  aria-pressed={days.includes(i)}
                  onClick={() =>
                    setDays((old) =>
                      old.includes(i)
                        ? old.filter((d) => d !== i)
                        : [...old, i],
                    )
                  }
                >
                  <small>{day}</small>
                  <CalendarDays size={20} />
                  <span>{days.includes(i) ? `${minutes} min` : "Livre"}</span>
                </button>
              ))}
            </div>
            <div className="preview-objective">
              <Target size={20} />
              <div>
                Exercício do catálogo
                <strong>{exercise?.title || "Biblioteca de exercícios"}</strong>
              </div>
            </div>
            <p className="muted">
              {days.length} sessões · {days.length * minutes} minutos planejados
              nesta prévia.
            </p>
          </>
        )}
        {tab === "progress" && (
          <>
            <h3>Um registro por vez.</h3>
            <div className="preview-stat">
              <StatCounter value={completed} />
              <span>sessões de exemplo registradas</span>
            </div>
            <ProgressIndicator value={completed} max={4} />
            <p>
              Experimente registrar uma conclusão. Quantidade de sessões indica
              participação; evolução de habilidade exige testes comparáveis.
            </p>
            <div className="row wrap">
              <button
                className="button primary small"
                disabled={completed >= 4}
                onClick={() => setCompleted((n) => n + 1)}
              >
                Registrar sessão de exemplo
              </button>
              <button
                className="button small"
                disabled={!completed}
                onClick={() => setCompleted(0)}
              >
                Reiniciar prévia
              </button>
            </div>
          </>
        )}
        {tab === "coach" && (
          <>
            <h3>Contexto para decidir.</h3>
            <div className="preview-message">O que devo treinar hoje?</div>
            <p className="preview-answer">
              O Clutch Coach consulta seu objetivo, seus registros autorizados e
              os exercícios verificados. Com poucos dados, propõe um ponto de
              partida e explica os limites da recomendação.
            </p>
            <p className="muted">
              Reagendamentos e alterações sempre passam por prévia e
              confirmação. Esta explicação é editorial, não uma resposta de IA.
            </p>
          </>
        )}
      </TrainingStepTransition>
      <button className="button primary full" onClick={onExplore}>
        Testar este fluxo <ArrowRight size={16} />
      </button>
      <p className="preview-disclosure">
        Prévia interativa com dados de exemplo. Nada aqui é salvo na sua conta.
      </p>
    </div>
  );
}
