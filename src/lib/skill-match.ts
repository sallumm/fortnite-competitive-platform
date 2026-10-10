import type { Exercise, Profile } from "./types";
import type { Skill } from "./performance-types";
const terms: Record<Skill, RegExp> = {
  aim: /aim|mira|clicking|tracking|microcorrec|shotgun|crosshair/,
  tracking: /tracking/,
  shotgun: /shotgun/,
  editing: /edit/,
  building: /freebuild|building|retake/,
  piece: /piece control|controle de peças/,
  movement: /movement|movimentação|mira em movimento/,
  decisions: /decision|decisões|noção de jogo|fight selection/,
  rotations: /rotaç|rotation|deadside/,
  endgame: /endgame|zone wars|tarpar|tarping|refresh/,
  vod: /vod|revisão de partida/,
  box_fighting: /box fight|boxfight/,
  positioning: /posicion|position|right.hand|cover/,
};
export function matchesSkill(e: Exercise, skill: Skill) {
  const text = [e.title, ...(e.tags || []), ...(e.skills || [])]
    .join(" ")
    .toLowerCase();
  return (
    e.skills?.includes(skill) ||
    terms[skill].test(text) ||
    (skill === "aim" && e.category === "aim")
  );
}
export function compatibleExercises(
  exercises: Exercise[],
  skill: Skill,
  profile: Profile,
) {
  if (
    profile.mode === "zero" &&
    ["building", "editing", "piece", "box_fighting"].includes(skill)
  )
    return [];
  return exercises.filter(
    (e) =>
      e.published &&
      (e.mode === "both" || e.mode === profile.mode) &&
      matchesSkill(e, skill),
  );
}
