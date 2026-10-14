import { WorkspaceShell } from "./workspace-shell";

export function EmptyWorkspacePage({
  active,
  title,
}: {
  active: "quiz" | "results" | "insights" | "profile" | "settings";
  title: string;
}) {
  return (
    <WorkspaceShell active={active} currentPage={title}>
      <div className="workspace-content">
        <div className="workspace-page-heading">
          <h1>{title}</h1>
        </div>
      </div>
    </WorkspaceShell>
  );
}
