import questions from "../data/academy-questions.json";
import lessons from "../data/mastery-lessons.json" with { type: "json" };
import type { Article } from "./types";
const bySlug = questions as Record<string, Article["academy_questions"]>;
export default (lessons as Article[]).map((a) => ({
  ...a,
  academy_questions: bySlug[a.slug] || [],
}));
