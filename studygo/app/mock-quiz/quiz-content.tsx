"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WorkspaceIcon } from "../components/workspace-icon";
import { sampleCourses } from "./quiz-data";
import styles from "./quiz.module.css";

export default function QuizContent() {
  const [courseId, setCourseId] = useState("software");
  const [count, setCount] = useState(5);
  const [stage, setStage] = useState<"setup" | "quiz" | "results">("setup");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const heading = useRef<HTMLHeadingElement>(null);
  const course = sampleCourses.find(item => item.id === courseId)!;
  const questions = course.questions.slice(0, count);
  const answered = Object.keys(answers).length;
  const score = questions.filter((question, i) => question.correct === answers[i]).length;
  const question = questions[index];

  useEffect(() => { heading.current?.focus(); }, [stage, index]);

  function start() {
    setAnswers({});
    setIndex(0);
    setStage("quiz");
  }

  return (
    <div className={`workspace-content ${styles.root}`}>
      <div className="workspace-page-heading">
        <span className={styles.badge}>Interactive wireframe</span>
        <h1>Mock quiz</h1>
        <p>A little practice. A clearer picture of what you know.</p>
      </div>
      <p className={styles.notice}>Sample questions only. This preview does not use your uploaded notes or save results. Progress resets when you leave or refresh.</p>

      {stage === "setup" ? (
        <div className={styles.layout}>
          <section className={styles.card} aria-labelledby="setup-heading">
            <span className={styles.icon}><WorkspaceIcon name="quiz" /></span>
            <h2 id="setup-heading" ref={heading} tabIndex={-1}>Make room for a practice round</h2>
            <p>Choose a sample course and set a pace that works for you.</p>
            <form onSubmit={event => { event.preventDefault(); start(); }}>
              <label className={styles.label} htmlFor="quiz-course">Sample course</label>
              <select id="quiz-course" value={courseId} onChange={event => setCourseId(event.target.value)}>
                {sampleCourses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <p className={styles.hint}>{course.topic}</p>
              <fieldset className={styles.countChoices}>
                <legend>Number of questions</legend>
                {[3, 5].map(size => <label key={size}><input type="radio" name="question-count" checked={count === size} onChange={() => setCount(size)} /><span>{size} questions</span></label>)}
              </fieldset>
              <div className={styles.summary}><span>Multiple choice</span><span>Untimed practice</span></div>
              <button className={styles.primary} type="submit">Start practice <WorkspaceIcon name="arrow" /></button>
            </form>
          </section>
          <aside className={styles.aside}>
            <h2>A small step toward feeling ready.</h2>
            <ol><li><strong>Pick your focus</strong><p>Try a sample topic to explore the quiz experience.</p></li><li><strong>Take your time</strong><p>Move between questions and change your answers.</p></li><li><strong>Learn from the results</strong><p>Review each answer with a short explanation.</p></li></ol>
            <Link href="/study-materials">Browse study materials <WorkspaceIcon name="arrow" /></Link>
          </aside>
        </div>
      ) : stage === "quiz" ? (
        <section className={styles.card} aria-labelledby="question-heading">
          <div className={styles.meta}><span>{course.name}</span><span>{answered} of {count} answered</span></div>
          <progress className={styles.progress} value={answered} max={count} aria-label="Questions answered" />
          <p className={styles.kicker}>Question {index + 1} of {count} · {course.topic}</p>
          <h2 id="question-heading" ref={heading} tabIndex={-1}>{question.prompt}</h2>
          <fieldset className={styles.options}>
            <legend className={styles.hint}>Choose one answer</legend>
            {question.options.map((option, optionIndex) => (
              <label key={option} className={answers[index] === optionIndex ? styles.selected : ""}>
                <input type="radio" name={`answer-${index}`} checked={answers[index] === optionIndex} onChange={() => setAnswers(current => ({ ...current, [index]: optionIndex }))} />
                <span className={styles.letter}>{String.fromCharCode(65 + optionIndex)}</span><span>{option}</span>
              </label>
            ))}
          </fieldset>
          <nav className={styles.questionNav} aria-label="Quiz questions">
            {questions.map((_, i) => <button type="button" key={i} aria-label={`Question ${i + 1}${answers[i] !== undefined ? ", answered" : ", unanswered"}`} aria-current={i === index ? "step" : undefined} className={answers[i] !== undefined ? styles.answered : ""} onClick={() => setIndex(i)}>{i + 1}</button>)}
          </nav>
          <div className={styles.actions}>
            <button className={styles.secondary} type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>Previous</button>
            {index < count - 1 ? <button className={styles.primary} type="button" onClick={() => setIndex(index + 1)}>Next question <WorkspaceIcon name="arrow" /></button> : <button className={styles.primary} disabled={answered !== count} type="button" onClick={() => setStage("results")}>Finish quiz</button>}
          </div>
          {index === count - 1 && answered !== count && <p role="status" className={styles.hint}>Answer all {count} questions to finish. Use the numbered buttons to revisit unanswered questions.</p>}
        </section>
      ) : (
        <section className={styles.card} aria-labelledby="results-heading">
          <p className={styles.kicker}>Practice complete · {course.name}</p>
          <h2 id="results-heading" ref={heading} tabIndex={-1}>Every round is a step forward.</h2>
          <div className={styles.score}><strong>{Math.round(score / count * 100)}%</strong><span>{score} of {count} correct · {count - score} to review</span></div>
          <h3>Review your answers</h3>
          <div className={styles.review}>
            {questions.map((item, i) => <article key={item.prompt}>
              <span className={styles.kicker}>{answers[i] === item.correct ? "Correct" : "Needs practice"} · Question {i + 1}</span>
              <h4>{item.prompt}</h4>
              <p>Your answer: <strong>{item.options[answers[i]]}</strong></p>
              {answers[i] !== item.correct && <p>Correct answer: <strong>{item.options[item.correct]}</strong></p>}
              <p>{item.explanation}</p>
            </article>)}
          </div>
          <div className={styles.actions}><button className={styles.secondary} type="button" onClick={() => setStage("setup")}>Change setup</button><button className={styles.primary} type="button" onClick={start}>Try again <WorkspaceIcon name="arrow" /></button></div>
        </section>
      )}
    </div>
  );
}
