import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerData } from "./types";
export async function exportPlayerData(
  data: PlayerData,
  client: SupabaseClient | null,
  demo: boolean,
  local: Storage = localStorage,
) {
  if (!data.profile)
    throw new Error("Clutchfolio: entre novamente para exportar seus dados.");
  const owner = data.profile.id;
  const additional: Record<string, unknown> = {};
  if (demo) {
    for (const key of Object.keys(local).filter(
      (key) =>
        key.startsWith("clutchfolio-coach-demo:") ||
        key.startsWith("clutchfolio-preparation-demo:") ||
        key === "clutchfolio-competitive-demo",
    )) {
      try {
        additional[key] = JSON.parse(local.getItem(key) || "null");
      } catch {
        additional[key] = null;
      }
    }
  } else {
    if (!client)
      throw new Error(
        "Clutchfolio: a exportação está indisponível. Tente novamente.",
      );
    for (const table of [
      "coach_preferences",
      "coach_conversations",
      "coach_messages",
      "coach_actions",
      "competitive_preferences",
      "competition_preparations",
      "competition_proposals",
    ]) {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await client
          .from(table)
          .select("*")
          .eq(table.endsWith("preferences") ? "id" : "user_id", owner)
          .order(table === "competition_preparations" ? "tournament_id" : "id")
          .range(offset, offset + 499);
        if (result.error)
          throw new Error(
            "Clutchfolio: não foi possível exportar todos os registros. Tente novamente.",
          );
        rows.push(...(result.data || []));
        if ((result.data?.length || 0) < 500) break;
      }
      additional[table] = rows;
    }
  }
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    training: data,
    additional,
  };
}
