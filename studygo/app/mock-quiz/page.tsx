import { WorkspaceShell } from "../components/workspace-shell";
import QuizContent from "./quiz-content";

export default function MockQuizPage() {
  return (
    <WorkspaceShell active="quiz" currentPage="Mock quiz">
      <QuizContent />
    </WorkspaceShell>
  );
}
