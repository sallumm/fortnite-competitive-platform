import { NavLink } from "react-router-dom";
const steps = [
  ["/academy", "Aprender"],
  ["/app/training", "Praticar"],
  ["/app/planner", "Organizar"],
  ["/app/reports", "Analisar"],
] as const;
export function JourneyNav() {
  return (
    <nav className="journey-nav" aria-label="Seu ciclo de desenvolvimento">
      {steps.map(([to, label], i) => (
        <NavLink key={to} to={to}>
          <span className="journey-number">0{i + 1}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
