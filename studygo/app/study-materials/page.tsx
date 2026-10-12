import { WorkspaceShell } from "../components/workspace-shell";
import MaterialsContent from "./materials-content";

export default function StudyMaterialsPage() {
  return (
    <WorkspaceShell active="materials" currentPage="Study materials">
      <MaterialsContent />
    </WorkspaceShell>
  );
}
