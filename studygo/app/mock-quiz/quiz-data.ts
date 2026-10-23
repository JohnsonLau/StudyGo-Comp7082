export type Question = {
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  source_file_id: string;
  source_name: string;
};

export type SavedQuiz = {
  id: string;
  title: string;
  source_file_ids: string[];
  questions: Question[];
  answers: number[] | null;
  score: number | null;
  created_at: string;
  completed_at: string | null;
};
