import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export interface CalendarItem {
  id: string;
  date: string;
  title: string;
  tone?: string;
  onClick: () => void;
}
export function Calendar({ items }: { items: CalendarItem[] }) {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"month" | "week" | "day">("month");
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
    { length: view === "month" ? 42 : view === "week" ? 7 : 1 },
    (_, i) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
  const move = (amount: number) => {
    const next = new Date(cursor);
    if (view === "month") next.setMonth(next.getMonth() + amount);
    else next.setDate(next.getDate() + amount * (view === "week" ? 7 : 1));
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
          {(["month", "week", "day"] as const).map((v) => (
            <button
              key={v}
              aria-pressed={view === v}
              onClick={() => setView(v)}
            >
              {v === "month" ? "Mês" : v === "week" ? "Semana" : "Dia"}
            </button>
          ))}
          <button onClick={() => setCursor(new Date())}>Hoje</button>
        </div>
      </div>
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
              {items
                .filter((x) => x.date === key)
                .map((item) => (
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
