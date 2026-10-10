import { supabase } from "./client";
import {
  assessmentResult,
  emptyStudy,
  questionsSchema,
  studyDataSchema,
  type StudyData,
  type StudyNote,
  type StudyRecord,
} from "./academy";
import type { Article } from "./types";
const KEY = "clutchfolio-academy-demo-v1";
export function demoStudy(): StudyData {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null");
    const parsed = studyDataSchema.safeParse(d);
    if (parsed.success) return parsed.data;
  } catch {
    /* an invalid local draft never authorizes a server operation */
  }
  return emptyStudy();
}
function persist(d: StudyData) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
async function checked<T>(p: PromiseLike<{ data: T; error: unknown }>) {
  const r = await p;
  if (r.error)
    throw new Error(
      "Não foi possível salvar ou consultar o estudo. Tente novamente.",
    );
  return r.data;
}
export async function loadStudy(demo: boolean): Promise<StudyData> {
  if (demo) return demoStudy();
  if (!supabase)
    throw new Error("Entre em sua conta para acompanhar o estudo.");
  async function rows(table: string) {
    const out: unknown[] = [];
    for (let i = 0; i < 10000; i += 500) {
      const page = await checked(
        supabase!
          .from(table)
          .select("*")
          .order(table === "academy_records" ? "created_at" : "id")
          .order("id")
          .range(i, i + 499),
      );
      out.push(...(page || []));
      if (!page || page.length < 500) return out;
    }
    throw new Error(
      "Limite de consulta atingido. Exporte os registros antes de continuar.",
    );
  }
  const [records, notes] = await Promise.all([
    rows("academy_records"),
    rows("academy_notes"),
  ]);
  return { records: records as StudyRecord[], notes: notes as StudyNote[] };
}
export async function recordStudy(
  demo: boolean,
  lesson: Article,
  action: StudyRecord["action"],
  answers: number[] = [],
) {
  const questions = questionsSchema.parse(lesson.academy_questions || []);
  if (action === "assessment") assessmentResult(questions, answers);
  if (demo) {
    const d = demoStudy();
    d.records.push({
      id: crypto.randomUUID(),
      lesson_id: lesson.id,
      action,
      answers,
      snapshot: {
        title: lesson.title,
        slug: lesson.slug,
        version: lesson.curriculum!.version,
        body: lesson.body,
        curriculum: lesson.curriculum,
        questions,
      },
      created_at: new Date().toISOString(),
    });
    persist(d);
  } else {
    if (!supabase) throw new Error("Entre em sua conta.");
    await checked(
      supabase.rpc("record_academy_study", {
        p_lesson: lesson.id,
        p_action: action,
        p_answers: answers,
      }),
    );
  }
}
export async function saveStudyNote(
  demo: boolean,
  n: Omit<StudyNote, "updated_at">,
) {
  if (n.note.length > 4000 || n.difficulty.length > 1000)
    throw new Error("Reduza o tamanho da anotação.");
  if (demo) {
    const d = demoStudy();
    d.notes = d.notes.filter((x) => x.lesson_id !== n.lesson_id);
    d.notes.push({ ...n, updated_at: new Date().toISOString() });
    persist(d);
  } else {
    if (!supabase) throw new Error("Entre em sua conta.");
    await checked(
      supabase.rpc("save_academy_note", {
        p_lesson: n.lesson_id,
        p_note: n.note,
        p_difficulty: n.difficulty,
        p_favorite: n.favorite,
      }),
    );
  }
}
export async function clearStudy(demo: boolean) {
  if (demo) localStorage.removeItem(KEY);
  else {
    if (!supabase) throw new Error("Entre em sua conta.");
    await checked(supabase.rpc("clear_academy_study"));
  }
}
