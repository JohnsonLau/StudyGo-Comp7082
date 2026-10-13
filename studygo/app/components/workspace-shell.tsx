import Link from "next/link";
import type { ReactNode } from "react";
import { WorkspaceIcon } from "./workspace-icon";

const navigation = [
  { label: "Welcome", icon: "home" as const, href: "/home", id: "home" },
  { label: "Study materials", icon: "folder" as const, href: "/study-materials", id: "materials" },
  { label: "Mock quiz", icon: "quiz" as const, href: "/#mock-quiz", id: "quiz" },
  { label: "Quiz results", icon: "results" as const, href: "/#continue-studying", id: "results" },
  { label: "Schoolwork insights", icon: "insights" as const, href: "/#schoolwork-insights", id: "insights" },
  { label: "Profile", icon: "profile" as const, href: "/#student-profile", id: "profile" },
  { label: "Settings", icon: "settings" as const, href: "/#workspace-settings", id: "settings" },
];

export function WorkspaceShell({
  active,
  children,
  currentPage,
}: {
  active: "home" | "materials";
  children: ReactNode;
  currentPage: string;
}) {
  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="workspace-brand" href="/" aria-label="StudyGo home">
          <span className="workspace-brand-mark"><WorkspaceIcon name="book" /></span>
          <span>StudyGo</span>
        </Link>
        <p className="workspace-nav-label">Your workspace</p>
        <nav className="workspace-nav" aria-label="Your workspace">
          {navigation.map((item) => (
            <Link
              aria-current={active === item.id ? "page" : undefined}
              className={`workspace-nav-link${active === item.id ? " active" : ""}`}
              href={item.href}
              key={item.id}
            >
              <WorkspaceIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <div className="workspace-note">
            <WorkspaceIcon name="insights" />
            <strong>A little progress, every day.</strong>
            <span>Your next chapter starts here.</span>
          </div>
          <Link className="workspace-student" href="/#student-profile">
            <span className="student-avatar">AL</span>
            <span><strong>User</strong><small>Student workspace</small></span>
          </Link>
        </div>
      </aside>

      <div className="workspace-main-column">
        <header className="workspace-topbar">
          <p><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{currentPage}</strong></p>
          <div className="workspace-topbar-actions">
            <span>Fall semester 2026</span>
            <button className="notification-button" type="button" aria-label="Notifications">
              <WorkspaceIcon name="bell" />
              <span className="notification-dot" />
            </button>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
