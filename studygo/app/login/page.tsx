"use client";

import Link from "next/link";
import { useState } from "react";
import styles from "./login.module.css";

function StudyMark() {
  return (
    <span className="study-mark" aria-hidden="true">
      <svg viewBox="0 0 40 40" fill="none">
        <path d="M8 13.5 20 7l12 6.5v13L20 33 8 26.5v-13Z" fill="currentColor" />
        <path d="m14 19 4 4 8-8" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.9 6.1-15Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.5H5.8v5.2A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.6 27.5a12 12 0 0 1 0-7v-5.2H5.8a20 20 0 0 0 0 17.4l6.8-5.2Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 15.3l6.8 5.2C14.2 15.6 18.7 12 24 12Z" />
    </svg>
  );
}

export default function LoginPage() {
  const [notice, setNotice] = useState("");

  return (
    <main className={styles.loginPage}>
      <aside className="login-visual">
        <Link className="brand brand-on-dark" href="/" aria-label="StudyGo home">
          <StudyMark /><span>StudyGo</span>
        </Link>
        <div className="login-visual-content">
          <div className="visual-spark" aria-hidden="true">✦</div>
          <p className="visual-kicker">YOUR NEXT CHAPTER STARTS HERE</p>
          <h1>Show up for<br />yourself. <span>We&apos;ll<br />help with the rest.</span></h1>
          <p className="visual-description">A little structure can make a big difference. Let&apos;s make studying feel like you&apos;ve got this.</p>
          <div className="visual-quote">
            <span className="quote-stars" aria-label="Five stars">★★★★★</span>
            <p>&ldquo;Finally, a study routine that feels doable.&rdquo;</p>
            <span className="quote-byline">A fresh start, one session at a time.</span>
          </div>
        </div>
        <div className="login-visual-bottom"><span>Small steps. Big possibilities.</span><span>01 — 03</span></div>
        <span className="login-decoration deco-one" aria-hidden="true" />
        <span className="login-decoration deco-two" aria-hidden="true" />
      </aside>

      <section className="login-form-side">
        <div className="login-top-link"><span>New to StudyGo?</span><Link href="/">Explore StudyGo <span aria-hidden="true">↗</span></Link></div>
        <div className="login-card">
          <div className="mobile-brand">
            <Link className="brand" href="/"><StudyMark /><span>StudyGo</span></Link>
          </div>
          <div className="login-heading-icon" aria-hidden="true">✦</div>
          <p className="section-label">YOUR STUDY SPACE AWAITS</p>
          <h2>Welcome back.</h2>
          <p className="login-intro">Sign in to pick up where your goals are waiting.</p>
          <button
            className="google-button"
            type="button"
            onClick={() => setNotice("Google sign-in will be available once authentication is configured.")}
          >
            <GoogleMark />
            <span>Continue with Google</span>
          </button>
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <div className="login-divider"><span>YOUR JOURNEY, YOUR PACE</span></div>
          <div className="login-reassurance">
            <span className="reassurance-icon" aria-hidden="true">♡</span>
            <div><strong>A fresh start, every day</strong><p>Your progress is here whenever you&apos;re ready.</p></div>
          </div>
          <div className="login-reassurance">
            <span className="reassurance-icon reassurance-sun" aria-hidden="true">✧</span>
            <div><strong>Made for real life</strong><p>Study at your own pace. No pressure, just progress.</p></div>
          </div>
        </div>
        <div className="login-footer"><Link href="/">← Back to home</Link><span>Made for your next big thing <span aria-hidden="true">✦</span></span></div>
      </section>
    </main>
  );
}
