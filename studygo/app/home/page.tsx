import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { WorkspaceShell } from "../components/workspace-shell";
import { WorkspaceIcon } from "../components/workspace-icon";
import { createSupabaseServerClient } from "../../utils/supabase/server";
import { getSupabaseConfig } from "../../utils/supabase/env";

async function PersonalizedWelcomeHeading() {
  let displayName = "Alex";

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

      displayName =
        metadataName?.trim() ??
        data.user.email?.split("@")[0] ??
        "there";
    }
  }

  return <h1>A good day to learn, {displayName}.</h1>;
}

export default function Home() {
  return (
    <WorkspaceShell active="home" currentPage="Welcome">
      <div className="workspace-content" id="welcome">
        <div className="workspace-page-heading">
          <Suspense fallback={<h1>A good day to learn, Alex.</h1>}>
            <PersonalizedWelcomeHeading />
          </Suspense>
          <p>Pick up where you left off, or start with something new.</p>
        </div>

        <section className="workspace-hero" aria-labelledby="companion-heading">
          <div className="workspace-hero-copy">
            <p className="workspace-eyebrow">Your personal study companion</p>
            <h2 id="companion-heading">Less overwhelm.<br />More understanding.</h2>
            <p>StudyGo helps you turn class notes into focused practice and a clearer picture of what to work on next.</p>
            <Link className="workspace-primary-button" href="/study-materials">
              <WorkspaceIcon name="plus" /> Add study materials
            </Link>
          </div>
          <div className="workspace-hero-illustration" aria-hidden="true">
            <div className="illustration-paper">
              <WorkspaceIcon name="sparkle" />
              <span /><span /><span />
            </div>
            <div className="illustration-base" />
            <div className="illustration-shadow" />
          </div>
        </section>

        <section className="workspace-shortcuts" aria-label="Study tools">
          <article className="workspace-shortcut">
            <span className="shortcut-icon shortcut-purple"><WorkspaceIcon name="upload" /></span>
            <h2>Bring your notes</h2>
            <p>Upload coursework and keep your study materials together.</p>
            <Link href="/study-materials">Upload materials <WorkspaceIcon name="arrow" /></Link>
          </article>
          <article className="workspace-shortcut" id="mock-quiz">
            <span className="shortcut-icon shortcut-purple"><WorkspaceIcon name="quiz" /></span>
            <h2>Test what you know</h2>
            <p>Practice with a mock quiz built from your own notes.</p>
            <Link href="/mock-quiz">Start a mock quiz <WorkspaceIcon name="arrow" /></Link>
          </article>
          <article className="workspace-shortcut" id="schoolwork-insights">
            <span className="shortcut-icon shortcut-purple"><WorkspaceIcon name="insights" /></span>
            <h2>Find your next focus</h2>
            <p>Turn feedback into small, achievable improvements.</p>
            <Link href="/schoolwork-insights">View schoolwork insights <WorkspaceIcon name="arrow" /></Link>
          </article>
        </section>

        <section className="continue-studying" id="continue-studying" aria-labelledby="continue-heading">
          <h2 id="continue-heading">Continue studying</h2>
          <div className="course-row">
            <span className="course-icon"><WorkspaceIcon name="leaf" /></span>
            <div className="course-details">
              <strong>Biology · Cell structure &amp; function</strong>
              <span>3 study materials · Last studied yesterday</span>
            </div>
            <span className="course-status">Quiz ready</span>
            <Link className="practice-button" href="/mock-quiz">Practice now</Link>
          </div>
        </section>
      </div>
    </WorkspaceShell>
  );
}
