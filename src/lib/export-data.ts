import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerData } from "./types";
export async function exportPlayerData(
  data: PlayerData,
  client: SupabaseClient | null,
  demo: boolean,
  local: Storage = localStorage,
) {
  if (!data.profile)
    throw new Error("kyrven: entre novamente para exportar seus dados.");
  const owner = data.profile.id;
  const additional: Record<string, unknown> = {};
  if (demo) {
    for (const key of Object.keys(local).filter(
      (key) =>
        key.startsWith("clutchfolio-meta-training-demo:" + owner) ||
        key.startsWith("clutchfolio-coach-demo:") ||
        key.startsWith("clutchfolio-preparation-demo:") ||
        key.startsWith("clutchfolio-result-revisions:" + owner) ||
        key.startsWith("clutchfolio-plan-draft:" + owner + ":") ||
        key.startsWith("clutchfolio-session-" + owner + ":") ||
        key === "clutchfolio-competitive-demo" ||
        key === "clutchfolio-road-demo-v1" ||
        key === "clutchfolio-academy-demo-v1",
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
        "kyrven: a exportação está indisponível. Tente novamente.",
      );
    for (const table of [
      "account_acceptances",
      "training_result_revisions",
      "goal_revisions",
      "coach_preferences",
      "coach_conversations",
      "coach_messages",
      "coach_actions",
      "competitive_preferences",
      "evolution_settings",
      "evolution_batches",
      "learning_journeys",
      "learning_journey_events",
      "learning_journey_batches",
      "academy_records",
      "academy_notes",
      "meta_study_notes",
      "meta_plan_approvals",
      "competition_preparations",
      "competition_proposals",
    ]) {
      const rows: unknown[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await client
          .from(table)
          .select("*")
          .eq(
            table.endsWith("preferences") || table === "evolution_settings"
              ? "id"
              : "user_id",
            owner,
          )
          .order(table === "competition_preparations" ? "tournament_id" : "id")
          .range(offset, offset + 499);
        if (result.error)
          throw new Error(
            "kyrven: não foi possível exportar todos os registros. Tente novamente.",
          );
        rows.push(...(result.data || []));
        if ((result.data?.length || 0) < 500) break;
      }
      additional[table] = rows;
    }
    // Group data is already authorized by membership RLS; export only this player's own contribution.
    for (const [table, key] of [
      ["training_team_members", "team_id"],
      ["training_team_participation", "session_id"],
      ["training_team_resources", "id"],
    ]) {
      const rows: unknown[] = [];
      const ownerColumn =
        table === "training_team_resources" ? "author_id" : "user_id";
      for (let offset = 0; ; offset += 500) {
        const result = await client
          .from(table)
          .select("*")
          .eq(ownerColumn, owner)
          .order(key)
          .range(offset, offset + 499);
        if (result.error)
          throw new Error(
            "kyrven: não foi possível exportar suas contribuições de equipe.",
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
