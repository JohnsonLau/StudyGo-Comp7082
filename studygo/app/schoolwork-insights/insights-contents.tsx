import { Suspense } from "react";
import Link from "next/link";
import { WorkspaceIcon } from "../components/workspace-icon";
import "./insights.css";
import { createSupabaseServerClient } from "../../utils/supabase/server";
import { getSupabaseConfig } from "../../utils/supabase/env";

type QuizInsightRow = {
    id: string;
    title: string;
    source_file_ids: string[];
    questions: unknown;
    answers: unknown;
    score: number | null;
    created_at: string;
    completed_at: string;
};

type QuizQuestion = {
    correct: number;
    explanation: string;
};

type FileCourseRow = {
    id: string;
    courses: { name: string } | null;
};

function isQuizQuestion(value: unknown): value is QuizQuestion {
    if (typeof value !== "object" || value === null) {
        return false;
    }

    const question = value as Record<string, unknown>;
    return typeof question.correct === "number" && typeof question.explanation === "string";
}

async function QuizInsights() {
    if (!getSupabaseConfig()) {
        return <p>Quiz insights are unavailable</p>;
    }

    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();

    if (authError) {
        console.error("Could not verify the signed-in user:", authError.message);
        return <p role="alert">Could not load quiz insights right now.</p>;
    }

    if (!auth.user) {
        return <p>Sign in to view quiz insights.</p>;
    }

    const utcDayStart = new Date();
    utcDayStart.setUTCHours(0, 0, 0, 0);
    const [quizResult, todayResult] = await Promise.all([
        supabase
            .from("mock_quizzes")
            .select("id, title, source_file_ids, questions, answers, score, created_at, completed_at")
            .eq("user_id", auth.user.id)
            .not("completed_at", "is", null)
            .not("score", "is", null)
            .not("answers", "is", null)
            .order("created_at", { ascending: false })
            .limit(30)
            .returns<QuizInsightRow[]>(),
        supabase
            .from("mock_quizzes")
            .select("source_file_ids")
            .eq("user_id", auth.user.id)
            .gte("completed_at", utcDayStart.toISOString())
            .returns<{ source_file_ids: string[] }[]>(),
    ]);

    if (quizResult.error || todayResult.error) {
        console.error(
            "Could not load quiz insights:",
            quizResult.error?.message ?? todayResult.error?.message,
        );
        return <p role="alert">Could not load quiz insights right now.</p>;
    }
    const quizzes = quizResult.data;

    const sourceFileIds = [...new Set(quizzes.flatMap((quiz) =>
        Array.isArray(quiz.source_file_ids)
            ? quiz.source_file_ids.filter((id): id is string => typeof id === "string")
            : [],
    ))];
    const materialsReviewedToday = new Set(todayResult.data.flatMap((quiz) =>
        Array.isArray(quiz.source_file_ids)
            ? quiz.source_file_ids.filter((id): id is string => typeof id === "string")
            : [],
    )).size;
    const courseNamesByFile = new Map<string, string>();

    if (sourceFileIds.length > 0) {
        const { data: files, error: filesError } = await supabase
            .from("files")
            .select("id, courses(name)")
            .eq("user_id", auth.user.id)
            .in("id", sourceFileIds)
            .returns<FileCourseRow[]>();

        if (filesError) {
            console.error("Could not load quiz source courses:", filesError.message);
            return <p role="alert">Could not load course-specific suggestions right now.</p>;
        }

        for (const file of files) {
            if (file.courses?.name) {
                courseNamesByFile.set(file.id, file.courses.name);
            }
        }
    }

    const results = quizzes.flatMap((quiz) => {
        const answers: unknown[] = Array.isArray(quiz.answers) ? quiz.answers : [];
        const questions = Array.isArray(quiz.questions) && quiz.questions.every(isQuizQuestion)
            ? quiz.questions
            : [];

        if (
            quiz.score === null ||
            !Number.isInteger(quiz.score) ||
            quiz.score < 0 ||
            answers.length === 0 ||
            questions.length !== answers.length ||
            quiz.score > answers.length ||
            !answers.every((answer): answer is number =>
                typeof answer === "number" && Number.isInteger(answer) && answer >= 0)
        ) {
            return [];
        }

        const missedExplanations = questions.flatMap((question, index) =>
            answers[index] === question.correct ? [] : [question.explanation],
        );
        const correctExplanations = questions.flatMap((question, index) =>
            answers[index] === question.correct ? [question.explanation] : [],
        );
        const courseNames = [...new Set(
            quiz.source_file_ids
                .map((fileId) => courseNamesByFile.get(fileId))
                .filter((name): name is string => Boolean(name)),
        )];

        return [{
            quiz,
            answers,
            missedExplanations,
            correctExplanations,
            courseNames,
            percentage: Math.round((quiz.score / answers.length) * 100),
        }];
    }).sort((a, b) => a.percentage - b.percentage);

    const improvementResults = results.slice(0, 3);
    const strengths = [...new Set(results.flatMap((result) => result.correctExplanations))].slice(0, 4);
    const lowestResult = results[0];
    const summaryTitle = lowestResult
        ? lowestResult.courseNames.length > 0
            ? `Next step: focus on ${lowestResult.courseNames.join(", ")}`
            : `Next step: revisit ${lowestResult.quiz.title}`
        : "Take a mock quiz to find your next focus.";
    const summarySuggestion = lowestResult
        ? lowestResult.missedExplanations.length > 0
            ? `Review ${lowestResult.missedExplanations.join(" ")} Then try another quiz to check your understanding.`
            : `Your lowest-scoring recent quiz was ${lowestResult.quiz.title}, and you answered every question correctly. Try a new quiz to keep building on that progress.`
        : "Choose a course and complete a quiz. Your results will help identify which concepts to review next.";

    return (
        <>
            <section className="insights-summary" aria-label="Overall feedback">
                <span className="summary-icon" aria-hidden="true">
                    <WorkspaceIcon name="insights" />
                </span>
                <div className="summary-copy">
                    <h2>{summaryTitle}</h2>
                    <p>{summarySuggestion}</p>
                </div>
                <div className="summary-meta">
                    <strong>
                        {materialsReviewedToday} {materialsReviewedToday === 1 ? "material" : "materials"} reviewed today
                    </strong>
                    <span>Based on quizzes completed today</span>
                </div>
            </section>

            <section className="improvement-section" aria-labelledby="areas-title">
                <div className="section-heading">
                    <h2 id="areas-title">Your improvement areas</h2>
                    <span>Start with one small action</span>
                </div>
                {improvementResults.length === 0 ? (
                    <p>Complete a mock quiz to see course-specific improvement suggestions.</p>
                ) : (
                    <div className="improvement-grid">
                        {improvementResults.map(({ quiz, answers, missedExplanations, courseNames, percentage }) => {
                            const focusSuggestion = missedExplanations.length > 0
                                ? `Review these concepts: ${missedExplanations.join(" ")}`
                                : "You answered every question correctly. Try another quiz from this course to keep reinforcing what you know.";

                            return (
                                <article className="improvement-card" key={quiz.id}>
                                    <div className="card-meta">
                                        <span>{courseNames.length > 0 ? courseNames.join(", ") : "Unassigned course"}</span>
                                    </div>
                                    <div className="improvement-score">
                                        <strong>{percentage}%</strong>
                                        <span>{quiz.score}/{answers.length} correct</span>
                                    </div>
                                    <h3>{quiz.title}</h3>
                                    <p className="card-description">
                                        {missedExplanations.length > 0
                                            ? `Focus on the ${missedExplanations.length} concept${missedExplanations.length === 1 ? "" : "s"} you missed.`
                                            : "Strong result on this quiz."}
                                    </p>
                                    <div className="try-this">
                                        <span>What to focus on</span>
                                        <p>{focusSuggestion}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <div className="insights-bottom-grid">
                <section className="strengths-card" aria-labelledby="strengths-title">
                    <h2 id="strengths-title">Keep doing what’s working</h2>
                    {strengths.length > 0 ? (
                        <>
                            <ul>
                                {strengths.map((strength) => (
                                    <li key={strength}><span aria-hidden="true">✓</span>{strength}</li>
                                ))}
                            </ul>
                            <p>
                                You answered these concepts correctly. Keep building on
                                what you already understand.
                            </p>
                        </>
                    ) : (
                        <p>
                            Complete a quiz to see which concepts you already know well
                            and keep building on those strengths.
                        </p>
                    )}
                </section>

                <section className="next-step-card" aria-labelledby="next-step-title">
                    <h2 id="next-step-title">Ready to take the next step?</h2>
                    <p>
                        Revise one piece of coursework, then upload it for fresh
                        feedback.
                    </p>
                    <Link className="materials-button" href="/study-materials">
                        Open study materials
                    </Link>
                </section>
            </div>
        </>
    );
}

export function AddCourseWorkButton() {
    return (
        <Link className="add-button" href="/study-materials">
            <WorkspaceIcon name="plus" />
            Add coursework
        </Link>
    );
}

export default function InsightsContents() {
    return (
        <div className="workspace-content insights-content">
            <section className="insights-heading" aria-labelledby="insights-title">
                <div>
                    <h1 id="insights-title">Know What To Work On Next.</h1>
                    <p>
                        Broader feedback across your notes and coursework — beyond a
                        single quiz.
                    </p>
                </div>
                <AddCourseWorkButton />
            </section>

            <Suspense fallback={<p>Loading your quiz insights...</p>}>
                <QuizInsights />
            </Suspense>

            <p className="insights-disclaimer">
                AI-generated guidance, not a grade. Use it alongside your teacher’s
                feedback.
            </p>
        </div>
    );
}
