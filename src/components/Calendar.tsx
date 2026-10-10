import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export interface CalendarItem {
  id: string;
  date: string;
  title: string;
  tone?: string;
  onClick: () => void;
}
export function Calendar({
  items,
  timezone,
  onRangeChange,
}: {
  items: CalendarItem[];
  timezone?: string;
  onRangeChange?: (from: string, to: string) => void;
}) {
  const [cursor, setCursor] = useState(() =>
    timezone
      ? new Date(localDate(new Date().toISOString(), timezone) + "T12:00:00")
      : new Date(),
  );
  const [view, setView] = useState<"month" | "week" | "day" | "agenda">(() =>
    window.matchMedia?.("(max-width: 680px)").matches ? "agenda" : "month",
  );
  const start = new Date(
    cursor.getFullYear(),
    cursor.getMonth(),
    view === "month" ? 1 : cursor.getDate(),
  );
  if (view === "month")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (view === "week")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const days = Array.from(
    {
      length:
        view === "month" ? 42 : view === "week" || view === "agenda" ? 7 : 1,
    },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
  const keyOf = (date: Date) =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
  const from = keyOf(days[0]),
    to = keyOf(days[days.length - 1]);
  useEffect(() => onRangeChange?.(from, to), [from, to, onRangeChange]);
  const byDate = useMemo(() => {
    const result = new Map<string, CalendarItem[]>();
    for (const item of items)
      result.set(item.date, [...(result.get(item.date) || []), item]);
    return result;
  }, [items]);
  const move = (amount: number) => {
    const next = new Date(cursor);
    if (view === "month") {
      next.setDate(1);
      next.setMonth(next.getMonth() + amount);
    } else
      next.setDate(
        next.getDate() +
          amount * (view === "week" || view === "agenda" ? 7 : 1),
      );
    setCursor(next);
  };
  return (
    <div className="calendar panel">
      <div className="calendar-toolbar">
        <div className="row">
          <button
            className="icon-button"
            aria-label="Período anterior"
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <h3>
            {cursor.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
              ...(view === "day" ? { day: "numeric" } : {}),
            })}
          </h3>
          <button
            className="icon-button"
            aria-label="Próximo período"
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="tabs">
          {(["agenda", "month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "agenda"
                ? "Agenda"
                : v === "month"
                  ? "Mês"
                  : v === "week"
                    ? "Semana"
                    : "Dia"}
            </button>
          ))}
          <button
            onClick={() =>
              setCursor(
                timezone
                  ? new Date(
                      localDate(new Date().toISOString(), timezone) +
                        "T12:00:00",
                    )
                  : new Date(),
              )
            }
          >
            Hoje
          </button>
        </div>
      </div>
      {(view === "week" || view === "agenda") && (
        <p className="calendar-range" aria-live="polite">
          {days[0].toLocaleDateString("pt-BR")} a{" "}
          {days.at(-1)!.toLocaleDateString("pt-BR")}
        </p>
      )}
      <div className={`calendar-grid ${view}`}>
        {days.map((date) => {
          const key = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0"),
          ].join("-");
          return (
            <div
              className={`calendar-day ${date.getMonth() !== cursor.getMonth() ? "other-month" : ""}`}
              key={key}
            >
              <span>
                {date.toLocaleDateString("pt-BR", { weekday: "short" })}{" "}
                <strong>{date.getDate()}</strong>
              </span>
              {view === "agenda" && !byDate.has(key) && (
                <p className="muted small-text">Sem atividades planejadas</p>
              )}
              {(byDate.get(key) || []).map((item) => (
                <button
                  className={"event " + (item.tone || "")}
                  key={item.id}
                  onClick={item.onClick}
                >
                  {item.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function localDate(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
