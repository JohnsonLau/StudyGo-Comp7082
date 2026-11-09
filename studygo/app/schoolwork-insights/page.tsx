import { WorkspaceShell } from "../components/workspace-shell";
import InsightsContents from "./insights-contents"

export default function SchoolworkInsightsPage() {
  return (
    <WorkspaceShell active="insights" currentPage="insights">
      <InsightsContents />
    </WorkspaceShell>
  );
  
}
