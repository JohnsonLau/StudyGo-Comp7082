import { WorkspaceShell } from "../components/workspace-shell";
import AwardsContent from "./awards-content";

export default function AwardsPage() {
  return (
    <WorkspaceShell active="awards" currentPage="Awards">
      <AwardsContent />
    </WorkspaceShell>
  );
}
