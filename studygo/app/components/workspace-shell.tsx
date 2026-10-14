import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import { createSupabaseServerClient } from "../../utils/supabase/server";
import { getSupabaseConfig } from "../../utils/supabase/env";
import { DarkModeToggle } from "./dark-mode-toggle";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceIcon } from "./workspace-icon";

const navigation = [
  { label: "Welcome", icon: "home" as const, href: "/home", id: "home" },
  { label: "Study materials", icon: "folder" as const, href: "/study-materials", id: "materials" },
  { label: "Mock quiz", icon: "quiz" as const, href: "/mock-quiz", id: "quiz" },
  { label: "Quiz results", icon: "results" as const, href: "/quiz-results", id: "results" },
  { label: "Schoolwork insights", icon: "insights" as const, href: "/schoolwork-insights", id: "insights" },
  { label: "Profile", icon: "profile" as const, href: "/profile", id: "profile" },
  { label: "Settings", icon: "settings" as const, href: "/settings", id: "settings" },
];

async function WorkspaceStudent() {
  let displayName = "Student";
  let avatarUrl: string | undefined;
  let streakMessage = "Sign in to track your streak";
  let streakDetail = "Consecutive UTC days";

  if (getSupabaseConfig()) {
    await connection();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Could not load the signed-in user's profile:", error.message);
    } else if (data.user) {
      const metadataName = [
        data.user.user_metadata.full_name,
        data.user.user_metadata.name,
        data.user.user_metadata.given_name,
      ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

      displayName = metadataName?.trim() ?? data.user.email?.split("@")[0] ?? "Student";
      const metadataAvatar = data.user.user_metadata.avatar_url ?? data.user.user_metadata.picture;
      if (typeof metadataAvatar === "string" && /^https?:\/\//i.test(metadataAvatar)) {
        avatarUrl = metadataAvatar;
      }

      const { data: streak, error: streakError } = await supabase.rpc("record_daily_login");
      if (streakError) {
        console.error("Could not load the signed-in user's login streak:", streakError.message);
        streakMessage = "Login streak unavailable";
        streakDetail = "Please try again later";
      } else if (typeof streak === "number") {
        streakMessage = `${streak} day${streak === 1 ? "" : "s"} in a row`;
        streakDetail = "Consecutive UTC login days";
      } else {
        console.error("Could not load the signed-in user's login streak: unexpected response");
        streakMessage = "Login streak unavailable";
        streakDetail = "Please try again later";
      }
    }
  }

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase())
    .join("");

  return (
    <>
      <div className="workspace-note">
        <WorkspaceIcon name="insights" />
        <strong>{streakMessage}</strong>
        <span>{streakDetail}</span>
      </div>
      <Link className="workspace-student" href="/profile">
        {avatarUrl ? (
          <Image className="student-avatar" src={avatarUrl} alt="" width={27} height={27} unoptimized />
        ) : (
          <span className="student-avatar">{initials || "S"}</span>
        )}
        <span><strong>{displayName}</strong><small>Student workspace</small></span>
      </Link>
    </>
  );
}

function WorkspaceStudentFallback() {
  return (
    <>
      <div className="workspace-note">
        <WorkspaceIcon name="insights" />
        <strong>Loading login streak…</strong>
        <span>Consecutive UTC login days</span>
      </div>
      <Link className="workspace-student" href="/profile">
        <span className="student-avatar">S</span>
        <span><strong>Student</strong><small>Student workspace</small></span>
      </Link>
    </>
  );
}

export function WorkspaceShell({
  active,
  children,
  currentPage,
}: {
  active: "home" | "materials" | "quiz" | "results" | "insights" | "profile" | "settings";
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
          <SignOutButton />
        </nav>
        <div className="workspace-sidebar-bottom">
          <Suspense fallback={<WorkspaceStudentFallback />}>
            <WorkspaceStudent />
          </Suspense>
        </div>
      </aside>

      <div className="workspace-main-column">
        <header className="workspace-topbar">
          <p><span>Workspace</span><span className="breadcrumb-divider">/</span><strong>{currentPage}</strong></p>
          <div className="workspace-topbar-actions">
            <span>Fall semester 2026</span>
            <DarkModeToggle />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
