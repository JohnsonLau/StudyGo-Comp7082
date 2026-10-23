import { createSupabaseBrowserClient } from "../../utils/supabase/browser";
import type { SavedQuiz } from "./quiz-data";

export type Course = { id: string; code: string; name: string };
export type Note = {
  id: string;
  file_name: string;
  course_id: string | null;
  file_extractions: { status: string; content: { key_terms: { term: string; definition: string }[] } | null } | null;
};
export const quizColumns = "id, title, source_file_ids, questions, answers, score, created_at, completed_at";

export async function loadQuizLibrary() {
  const db = createSupabaseBrowserClient();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in to create and view your quizzes.");
  const [courses, notes, quizzes] = await Promise.all([
    db.from("courses").select("id, code, name").order("name").returns<Course[]>(),
    db.from("files").select("id, file_name, course_id, file_extractions(status, content)").order("created_at", { ascending: false }).returns<Note[]>(),
    db.from("mock_quizzes").select(quizColumns).order("created_at", { ascending: false }).limit(30).returns<SavedQuiz[]>(),
  ]);
  if (courses.error || notes.error) throw new Error("Could not load your courses and notes. Please try again.");
  if (quizzes.error) throw new Error("Could not load quizzes. Check that the mock quizzes database migration is applied, then try again.");
  return { courses: courses.data ?? [], notes: notes.data ?? [], quizzes: quizzes.data ?? [] };
}

export async function createQuiz(fileIds: string[], count: number): Promise<SavedQuiz> {
  const { data, error } = await createSupabaseBrowserClient().rpc("create_mock_quiz", { p_file_ids: fileIds, p_count: count });
  if (error) throw new Error(error.message);
  return data as SavedQuiz;
}

export async function submitQuiz(quizId: string, answers: number[]): Promise<SavedQuiz> {
  const { data, error } = await createSupabaseBrowserClient().rpc("submit_mock_quiz", { p_quiz_id: quizId, p_answers: answers });
  if (error) throw new Error(error.message);
  return data as SavedQuiz;
}
