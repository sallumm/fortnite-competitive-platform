import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useMotionLevel } from "./experience/MotionSystem";
import { Link } from "react-router-dom";
import { Badge } from "./ui";
import type { ReportEvidenceData } from "../lib/intelligence-report";
export function ReportEvidence({ evidence }: { evidence: ReportEvidenceData }) {
  const { effective } = useMotionLevel();
  return (
    <section className="panel">
      <h2>Evidências e continuidade</h2>
      <p>
        Revisões manuais de VOD no período: {evidence.vodCount}. Frequência de
        sessões e dificuldades não medem domínio de habilidade.
      </p>
      <div
        className="chart"
        role="img"
        aria-label={evidence.daily
          .map((x) => `${x.date}: ${x.sessions} sessões`)
          .join(", ")}
      >
        <ResponsiveContainer width="100%" height={230}>
          <LineChart data={evidence.daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line
              dataKey="sessions"
              name="Sessões concluídas"
              stroke="var(--accent)"
              isAnimationActive={effective === "full"}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3>Contextos registrados</h3>
      <p>
        Resultados de versões, modalidades e formatos diferentes são agrupados
        separadamente. Mudanças de resultado não demonstram efeito do meta.
      </p>
      <ul>
        {evidence.contexts?.map((c) => (
          <li key={c.key}>
            {c.label} · prática: {c.practice}: {c.count} sessão(ões)
          </li>
        ))}
      </ul>
      <h3>Testes comparáveis</h3>
      {evidence.comparisons.length ? (
        evidence.comparisons.map((c, i) => (
          <p key={i}>
            {c.title} · {c.context} · {c.configuration} · {c.version}: {c.first}{" "}
            → {c.last} {c.unit}, em {c.count} sessões distintas.{" "}
            {c.direction
              ? `O protocolo busca valores ${c.direction === "lower" ? "menores" : "maiores"}.`
              : "Direção não padronizada."}
          </p>
        ))
      ) : (
        <p>Sem duas sessões comparáveis suficientes.</p>
      )}
      <h3>Observações e próximos passos</h3>
      {evidence.diagnostics.map((d) => (
        <div className="skill-exercise" key={d.key}>
          <Badge>{d.kind === "fact" ? "FATO OBSERVADO" : "RECOMENDAÇÃO"}</Badge>
          <h4>{d.title}</h4>
          <p>{d.detail}</p>
          <Link className="text-link" to={d.to}>
            Consultar
          </Link>
        </div>
      ))}
      <details>
        <summary>
          Atividades sem conclusão registrada ({evidence.pending.length})
        </summary>
        {evidence.pending.map((o, i) => (
          <p key={i}>
            {o.title} · {o.starts_at}. Ausência de registro não prova ausência
            de prática.
          </p>
        ))}
      </details>
    </section>
  );
}
