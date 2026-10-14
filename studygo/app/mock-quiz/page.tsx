import { WorkspaceShell } from "../components/workspace-shell";

export default function MockQuizPage() {
  return (
    <WorkspaceShell active="quiz" currentPage="Mock quiz">
      <div className="workspace-content">
        <div className="workspace-page-heading">
          <h1>Mock quiz</h1>
          <p>Test your knowledge with a quick practice round.</p>
        </div>
       Mock quiz content goes here.
      </div>
    </WorkspaceShell>
  );
}
