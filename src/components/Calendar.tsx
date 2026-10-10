import * as m from "motion/react-m";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensors,
  useSensor,
} from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { AnimatedTabs } from "./experience/primitives";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
export interface CalendarItem {
  id: string;
  date: string;
  title: string;
  tone?: string;
  draggable?: boolean;
  onClick: () => void;
}
export function Calendar({
  items,
  timezone,
  onRangeChange,
  onMove,
}: {
  items: CalendarItem[];
  onMove?: (id: string, date: string) => void;
  timezone?: string;
  onRangeChange?: (from: string, to: string) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );
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
    <DndContext
      sensors={sensors}
      onDragEnd={({ active, over }) => {
        if (over && onMove) onMove(String(active.id), String(over.id));
      }}
    >
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
            <AnimatedTabs
              label="Visualização do calendário"
              value={view}
              onChange={setView}
              items={[
                { value: "agenda", label: "Agenda" },
                { value: "month", label: "Mês" },
                { value: "week", label: "Semana" },
                { value: "day", label: "Dia" },
              ]}
            />
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
        <m.div
          key={from + view}
          className={`calendar-grid ${view}`}
          initial={{ opacity: 0.85 }}
          animate={{ opacity: 1 }}
        >
          {days.map((date) => {
            const key = [
              date.getFullYear(),
              String(date.getMonth() + 1).padStart(2, "0"),
              String(date.getDate()).padStart(2, "0"),
            ].join("-");
            return (
              <CalendarDay
                date={key}
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
                  <CalendarEvent
                    key={item.id}
                    item={item}
                    enabled={!!onMove && !!item.draggable}
                  />
                ))}
              </CalendarDay>
            );
          })}
        </m.div>
      </div>
    </DndContext>
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

function CalendarDay({
  date,
  className,
  children,
}: {
  date: string;
  className: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  return (
    <div
      ref={setNodeRef}
      data-calendar-date={date}
      className={`${className} ${isOver ? "drop-target" : ""}`}
    >
      {children}
    </div>
  );
}
function CalendarEvent({
  item,
  enabled,
}: {
  item: CalendarItem;
  enabled: boolean;
}) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({
    id: item.id,
    disabled: !enabled,
  });
  return (
    <div
      ref={setNodeRef}
      className={`calendar-event-row ${isDragging ? "dragging" : ""}`}
      style={{
        transform: transform
          ? `translate3d(${transform.x}px,${transform.y}px,0)`
          : undefined,
      }}
    >
      {enabled && (
        <span
          className="calendar-drag"
          {...listeners}
          aria-hidden="true"
          title="Arrastar para outro dia. Use o botão da atividade para editar pelo teclado."
        >
          <GripVertical size={14} />
        </span>
      )}
      <button className={"event " + (item.tone || "")} onClick={item.onClick}>
        {item.title}
      </button>
    </div>
  );
}
