import { WorkspaceShell } from "../components/workspace-shell";
import QuizContent from "../mock-quiz/quiz-content";

export default function QuizResultsPage() {
  return (
    <WorkspaceShell active="results" currentPage="Quiz results">
      <QuizContent resultsOnly />
    </WorkspaceShell>
  );
}
