import { expect, it } from "vitest";
import {
  assessmentResult,
  lessonState,
  questionsSchema,
  tracks,
  studyDataSchema,
} from "../src/lib/academy";
import questions from "../src/data/academy-questions.json";
import lessons from "../src/lib/mastery-catalog";
it("assessment answers and flexible tracks use real lessons without assigning practical mastery", () => {
  for (const [slug, qs] of Object.entries(questions)) {
    expect(lessons.some((a) => a.slug === slug)).toBe(true);
    expect(questionsSchema.safeParse(qs).success).toBe(true);
    expect(
      assessmentResult(
        qs,
        qs.map((q) => q.answer),
      ).correct,
    ).toBe(qs.length);
    expect(() => assessmentResult(qs, [])).toThrow();
  }
  for (const t of tracks)
    for (const slug of t.slugs)
      expect(lessons.some((a) => a.slug === slug)).toBe(true);
  expect(lessonState([], lessons[0].id)).toBeNull();
  expect(
    studyDataSchema.safeParse({ records: [{ action: "invented" }], notes: [] })
      .success,
  ).toBe(false);
  const pair = [
    ...questions["primeira-partida"],
    ...questions["zero-cobertura"],
  ];
  expect(() => assessmentResult(pair, new Array(2))).toThrow();
  expect(
    questionsSchema.safeParse([
      {
        id: "q-1",
        prompt: "Uma pergunta válida",
        options: ["a", "b"],
        answer: 3,
        explanation: "Explicação verificável.",
      },
    ]).success,
  ).toBe(false);
});
