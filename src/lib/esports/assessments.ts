import { esportsRPC } from "./service";
export type Difficulty = "foundation" | "intermediate" | "advanced";
export type Question = {
  id: string;
  version: number;
  category: string;
  difficulty: Difficulty;
  kind: "objective" | "discursive";
  prompt: string;
  options: string[];
  correct?: number | null;
  explanation?: string;
  references_list?: string[];
  weight: number;
  published?: boolean;
  reviewed_at?: string;
};
export type Blueprint = {
  category: string;
  difficulty: Difficulty;
  count: number;
};
export type Exam = {
  id: string;
  version: number;
  title: string;
  instructions: string;
  rules: string;
  blueprint: Blueprint[];
  minutes: number;
  max_attempts: number;
  published: boolean;
};
export type Answers = Record<string, number | string>;
export type Attempt = {
  id: string;
  application_id: string;
  exam_id: string;
  number: number;
  version: number;
  server_now: string;
  exam_snapshot: Exam;
  questions: Question[];
  answers: Answers;
  status: "active" | "submitted" | "graded";
  started_at: string;
  deadline: string;
  submitted_at: string | null;
  result: {
    objective_points: number;
    objective_max: number;
    manual_grades: Record<string, number>;
    feedback: string;
  } | null;
  objective_points?: number;
  objective_max?: number;
  manual_grades?: Record<string, number>;
  review_note?: string;
  feedback?: string;
  released?: boolean;
  seed?: string;
};
export type Assignment = {
  application_id: string;
  exam_id: string;
  title: string;
  instructions: string;
  rules: string;
  minutes: number;
  max_attempts: number;
  available_until: string;
  count: number;
  revoked_at?: string | null;
};
export type Trials = {
  assignments: Assignment[];
  attempts: Attempt[];
  technical_notice: string;
};
export type AssessmentAdmin = {
  admin: boolean;
  questions: Question[];
  exams: Exam[];
  assignments: Assignment[];
  attempts: Attempt[];
  review_history: {
    id: string;
    attempt_id: string;
    reviewer_id: string;
    attempt_version: number;
    grades: Record<string, number>;
    review_note: string;
    feedback: string;
    created_at: string;
  }[];
};
export const loadTrials = () => esportsRPC<Trials>("esports_trials");
export const startExam = (application: string, exam: string) =>
  esportsRPC<Attempt>("esports_start_exam", {
    p_application: application,
    p_exam: exam,
    p_accepted: true,
  });
export const answerExam = (
  attempt: Attempt,
  action: "save" | "submit" | "timeout",
  answers: Answers,
) =>
  esportsRPC<Attempt>("esports_answer_exam", {
    p_attempt: attempt.id,
    p_action: action,
    p_expected: attempt.version,
    p_answers: answers,
  });
export const loadAssessments = (
  offset = 0,
  query = "",
  reviewOffset = 0,
  attempt: string | null = null,
) =>
  esportsRPC<AssessmentAdmin>("esports_assessment_page", {
    p_offset: offset,
    p_query: query,
    p_review_offset: reviewOffset,
    p_attempt: attempt,
  });
export const expireAssessments = () =>
  esportsRPC<number>("esports_expire_assessments");
export const assessmentAction = (
  action: string,
  id: string | null,
  expected: number,
  payload: unknown,
) =>
  esportsRPC<Record<string, unknown>>("esports_assessment_action", {
    p_action: action,
    p_id: id,
    p_expected: expected,
    p_payload: payload,
  });
