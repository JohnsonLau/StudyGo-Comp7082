"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../components/workspace-icon";
import type { SavedQuiz } from "./quiz-data";
import { createQuiz, loadQuizLibrary, submitQuiz, type Course, type Note } from "./quiz-library";
import styles from "./quiz.module.css";

export default function QuizContent({ resultsOnly = false }: { resultsOnly?: boolean }) {
  const [courseId, setCourseId] = useState("all");
  const [courses, setCourses] = useState<Course[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [quizzes, setQuizzes] = useState<SavedQuiz[]>([]);
  const [quiz, setQuiz] = useState<SavedQuiz | null>(null);
  const [count, setCount] = useState(5);
  const [stage, setStage] = useState<"setup" | "quiz" | "results">("setup");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const questions = quiz?.questions ?? [];
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const score = quiz?.score ?? 0;
  const question = questions[index];
  const visibleNotes = notes.filter(note => courseId === "all" || (courseId === "unassigned" ? note.course_id === null : note.course_id === courseId));
  const readyNotes = visibleNotes.filter(note => note.file_extractions?.status === "ready");

  function load() {
    return loadQuizLibrary().then(data => {
      if (!mounted.current) return;
      setCourses(data.courses);
      setNotes(data.notes);
      setQuizzes(data.quizzes);
      setSelected(current => current.filter(id => data.notes.some(note => note.id === id && note.file_extractions?.status === "ready")));
    }).catch(cause => {
      if (mounted.current) setError(cause instanceof Error ? cause.message : "Could not load quizzes.");
    }).finally(() => {
      if (mounted.current) setLoading(false);
    });
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { heading.current?.focus(); }, [stage, index]);

  function openQuiz(saved: SavedQuiz) {
    setQuiz(saved);
    setAnswers(Object.fromEntries((saved.answers ?? []).map((answer, i) => [i, answer])));
    setIndex(0);
    setError("");
    setStage(saved.completed_at ? "results" : "quiz");
  }

  async function start(fileIds = selected, questionCount = count) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await createQuiz(fileIds, questionCount);
      setQuizzes(current => [saved, ...current].slice(0, 30));
      openQuiz(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your quiz. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function finish() {
    if (!quiz || answered !== total || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const saved = await submitQuiz(quiz.id, questions.map((_, i) => answers[i]));
      setQuizzes(current => current.map(item => item.id === saved.id ? saved : item));
      openQuiz(saved);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your result. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <div className={`workspace-content ${styles.root}`}>
      <div className="workspace-page-heading">
        <h1>{resultsOnly ? "Quiz results" : "Mock quiz"}</h1>
        <p>Turn your notes into a little practice and a clearer picture of what you know.</p>
      </div>
      <p className={styles.notice}>Practice key terms from your processed notes. Quizzes and completed results are saved to your account. Unsubmitted answers reset when you leave or refresh.</p>
      {error && <div className={styles.error} role="alert">{error}{stage === "setup" && <button type="button" className={styles.secondary} disabled={loading} onClick={() => { setLoading(true); setError(""); void load(); }}>Reload library</button>}</div>}

      {stage === "setup" ? (
        <>
          {!resultsOnly && <div className={styles.layout}>
            <section className={styles.card} aria-labelledby="setup-heading" aria-busy={loading}>
              <span className={styles.icon}><WorkspaceIcon name="quiz" /></span>
              <h2 id="setup-heading" ref={heading} tabIndex={-1}>Choose your focus</h2>
              <p>Select notes individually, or select all processed notes in a course.</p>
              <form onSubmit={event => { event.preventDefault(); void start(); }}>
                <label className={styles.label} htmlFor="quiz-course">Filter by course</label>
                <select id="quiz-course" disabled={loading || busy} value={courseId} onChange={event => setCourseId(event.target.value)}>
                  <option value="all">All courses</option>
                  <option value="unassigned">Unassigned notes</option>
                  {courses.map(item => <option key={item.id} value={item.id}>{[item.code, item.name].filter(Boolean).join(" · ")}</option>)}
                </select>
                <fieldset className={styles.noteChoices} disabled={loading || busy}>
                  <legend>Study notes · {selected.length} selected across all courses</legend>
                  {loading ? <p role="status">Loading your notes…</p> : <>
                    <div className={styles.actions}>
                      <button type="button" className={styles.secondary} disabled={readyNotes.length === 0} onClick={() => setSelected(current => [...new Set([...current, ...readyNotes.map(note => note.id)])])}>Select all in view</button>
                      <button type="button" className={styles.secondary} disabled={selected.length === 0} onClick={() => setSelected([])}>Clear selection</button>
                    </div>
                    {visibleNotes.length === 0 && <p>No notes in this view. <Link href="/study-materials">Add study materials</Link> to get started.</p>}
                    {visibleNotes.map(note => {
                      const ready = note.file_extractions?.status === "ready";
                      return <label key={note.id}>
                        <input type="checkbox" disabled={!ready} checked={selected.includes(note.id)} onChange={event => setSelected(current => event.target.checked ? [...current, note.id] : current.filter(id => id !== note.id))} />
                        <span><strong>{note.file_name}</strong><small>{ready ? `${note.file_extractions?.content?.key_terms?.length ?? 0} key terms` : "Process this note in Study materials first"}</small></span>
                      </label>;
                    })}
                  </>}
                </fieldset>
                <p className={styles.hint}>You need at least four distinct key terms and definitions for answer choices, and at least as many terms as questions. Select up to 50 notes. Selections stay checked when you change the course filter.</p>
                <fieldset className={styles.countChoices} disabled={busy}>
                  <legend>Number of questions</legend>
                  {[3, 5].map(size => <label key={size}><input type="radio" name="question-count" checked={count === size} onChange={() => setCount(size)} /><span>{size} questions</span></label>)}
                </fieldset>
                <div className={styles.summary}><span>Multiple choice</span><span>Untimed practice</span></div>
                <button className={styles.primary} disabled={loading || busy || selected.length === 0 || selected.length > 50} type="submit">{busy ? "Creating quiz…" : "Create quiz"} <WorkspaceIcon name="arrow" /></button>
              </form>
            </section>
            <aside className={styles.aside}>
              <h2>A small step toward feeling ready.</h2>
              <ol><li><strong>Pick your focus</strong><p>Combine notes across courses or focus on a single class.</p></li><li><strong>Take your time</strong><p>Match definitions to key terms from your selected notes.</p></li><li><strong>Learn from the results</strong><p>Review the source note and explanation for every answer.</p></li></ol>
              <Link href="/study-materials">Browse study materials <WorkspaceIcon name="arrow" /></Link>
            </aside>
          </div>}
          <section className={`${styles.card} ${styles.history}`} aria-labelledby="history-heading">
            <h2 id="history-heading">{resultsOnly ? "Completed quizzes" : "Recent quizzes"}</h2>
            {resultsOnly && <Link className={styles.secondary} href="/mock-quiz">Create a quiz</Link>}
            {!loading && quizzes.filter(item => !resultsOnly || item.completed_at).length === 0 && <p>Your saved quizzes will appear here.</p>}
            <p className={styles.hint}>Showing results from your 30 most recent quizzes. Completed scores can be reviewed at any time.</p>
            {quizzes.filter(item => !resultsOnly || item.completed_at).map(item => <article key={item.id} className={styles.historyRow}>
              <div><strong>{item.title}</strong><small>{item.questions.length} questions · {new Date(item.created_at).toLocaleDateString()}{item.completed_at ? ` · ${item.score}/${item.questions.length} correct` : " · Not completed"}</small></div>
              <button type="button" className={styles.secondary} disabled={busy} onClick={() => openQuiz(item)}>{item.completed_at ? "Review result" : "Resume quiz"}</button>
            </article>)}
          </section>
        </>
      ) : stage === "quiz" && quiz ? (
        <section className={styles.card} aria-labelledby="question-heading">
          <div className={styles.meta}><span>{quiz.title}</span><span>{answered} of {total} answered</span></div>
          <progress className={styles.progress} value={answered} max={total} aria-label="Questions answered" />
          <p className={styles.kicker}>Question {index + 1} of {total} · {question.source_name}</p>
          <h2 className={styles.prompt} id="question-heading" ref={heading} tabIndex={-1}>{question.prompt}</h2>
          <fieldset className={styles.options} disabled={busy}>
            <legend className={styles.hint}>Choose one answer</legend>
            {question.options.map((option, optionIndex) => (
              <label key={option} className={answers[index] === optionIndex ? styles.selected : ""}>
                <input type="radio" name={`answer-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [index]: optionIndex }))} />
                <span className={styles.letter}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>
              </label>
            ))}
          </fieldset>
          <nav className={styles.questionNav} aria-label="Quiz questions">
            {questions.map((_, i) => <button type="button" disabled={busy} key={i} aria-label={`Question ${i + 1}${answers[i] !== undefined ? ", answered" : ", unanswered"}`} aria-current={i === index ? "step" : undefined} className={answers[i] !== undefined ? styles.answered : ""} onClick={() => setIndex(i)}>{i + 1}</button>)}
          </nav>
          <div className={styles.actions}>
            <button className={styles.secondary} type="button" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
            {index < total - 1 ? <button className={styles.primary} disabled={busy} type="button" onClick={() => setIndex(index + 1)}>Next question <WorkspaceIcon name="arrow" /></button> : <button className={styles.primary} disabled={busy || answered !== total} type="button" onClick={() => void finish()}>{busy ? "Saving result…" : "Finish quiz"}</button>}
          </div>
          {index === total - 1 && answered !== total && <p role="status" className={styles.hint}>Answer all {total} questions to finish. Use the numbered buttons to revisit unanswered questions.</p>}
          <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setError(""); setStage("setup"); }}>Back to library</button>
        </section>
      ) : quiz ? (
        <section className={styles.card} aria-labelledby="results-heading">
          <p className={styles.kicker}>Result saved · {quiz.title}</p>
          <h2 id="results-heading" ref={heading} tabIndex={-1}>Every round is a step forward.</h2>
          <div className={styles.score}><strong>{Math.round(score / total * 100)}%</strong><span>{score} of {total} correct · {total - score} to review</span></div>
          <h3>Review your answers</h3>
          <div className={styles.review}>
            {questions.map((item, i) => <article key={i}>
              <span className={styles.kicker}>{answers[i] === item.correct ? "Correct" : "Needs practice"} · Question {i + 1}</span>
              <h4 className={styles.prompt}>{item.prompt}</h4>
              <p>Your answer: <strong>{item.options[answers[i]]}</strong></p>
              {answers[i] !== item.correct && <p>Correct answer: <strong>{item.options[item.correct]}</strong></p>}
              <p>{item.explanation}</p>
              <p className={styles.hint}>Source: {item.source_name}</p>
            </article>)}
          </div>
          <div className={styles.actions}><button className={styles.secondary} disabled={busy} type="button" onClick={() => { setError(""); setStage("setup"); }}>Change setup</button><button className={styles.primary} disabled={busy} type="button" onClick={() => void start(quiz.source_file_ids, total)}>{busy ? "Creating quiz…" : "Practice again"} <WorkspaceIcon name="arrow" /></button></div>
        </section>
      ) : null}
    </div>
  );
}
