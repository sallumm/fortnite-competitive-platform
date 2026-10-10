import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { supabase } from "../lib/client";
import { dateInZone, expandCalendar, shiftDate } from "../lib/calendar";
import { CoachAccess } from "./CoachAccess";
export function CoachSummary() {
  const s = useStore(),
    p = s.data.profile,
    [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        let pref;
        if (s.demo)
          pref = JSON.parse(
            localStorage.getItem("clutchfolio-coach-demo:" + p?.id) || "{}",
          ).pref;
        else if (supabase)
          pref = (
            await supabase
              .from("coach_preferences")
              .select("context_enabled,proactive_enabled")
              .maybeSingle()
          ).data;
        if (!cancelled)
          setEnabled(!!pref?.context_enabled && !!pref?.proactive_enabled);
      } catch {
        /* Optional hints never block the dashboard. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [s.demo, p?.id]);
  if (!enabled || !p) return null;
  const today = dateInZone(new Date(), p.timezone),
    agenda = expandCalendar(s.data, today, shiftDate(today, 6)),
    training = agenda.filter(
      (o) =>
        o.status === "planned" && dateInZone(o.starts_at, p.timezone) === today,
    ).length;
  const saved = s.catalog.tournaments.filter(
    (t) =>
      t.start_date >= today &&
      t.start_date <= shiftDate(today, 6) &&
      t.valid_until >= new Date().toISOString() &&
      t.status === "scheduled" &&
      s.data.bookmarks.some(
        (b) => b.kind === "tournament" && b.target_id === t.id,
      ),
  ).length;
  if (!training && !saved) return null;
  return (
    <section className="panel coach-summary">
      <div>
        <span className="eyebrow">CLUTCH COACH · REGISTROS DA SUA CONTA</span>
        <p>
          {training ? `${training} atividades planejadas para hoje. ` : ""}
          {saved
            ? `${saved} campeonatos favoritos nesta semana. Confira os horários oficiais.`
            : ""}
        </p>
      </div>
      <CoachAccess
        question="Mostre meus compromissos da próxima semana."
        label="Revisar com o Coach"
      />
    </section>
  );
}
