// client/src/quizzes/QuizWorkspace.jsx
// FR-13 to FR-16 & FR-24: Student Adaptive Quizzes + Auto-grading + Flagging;
// Teacher MCQ Generation, Approval Queue & Feedback Review.

import React, { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Sparkles,
  Check,
  X,
  Edit3,
  Flag,
  RotateCcw,
} from "lucide-react";
import {
  quizzesApi,
  assessmentApi,
  feedbackApi,
} from "../services/platformService";

export default function QuizWorkspace({
  course,
  user,
  initialTopicId = "",
  onQuizCompleted,
}) {
  const isTeacherOrAdmin = user.role === "Teacher" || user.role === "Admin";
  const topics = (course.units || []).flatMap((u) =>
    (u.topics || []).map((t) => ({ ...t, unitTitle: u.title }))
  );
  const topicMap = new Map(topics.map((t) => [t.id, t]));

  const [selectedTopicId, setSelectedTopicId] = useState(initialTopicId || topics[0]?.id || "");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Student quiz state
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizDifficulty, setQuizDifficulty] = useState("");
  const [adaptiveReason, setAdaptiveReason] = useState("");
  const [answers, setAnswers] = useState({});
  const [retryMissedOnly, setRetryMissedOnly] = useState(false);
  const [quizStartTs, setQuizStartTs] = useState(null);
  const [attemptResult, setAttemptResult] = useState(null);
  const [pastAttempts, setPastAttempts] = useState([]);

  // Teacher bank & feedback state
  const [bankQuestions, setBankQuestions] = useState([]);
  const [feedbackItems, setFeedbackItems] = useState([]);
  const [genCount, setGenCount] = useState(3);
  const [genDifficulty, setGenDifficulty] = useState("medium");
  const [editingId, setEditingId] = useState(null);
  const [editPrompt, setEditPrompt] = useState("");

  useEffect(() => {
    if (initialTopicId) {
      setSelectedTopicId(initialTopicId);
    } else if (topics[0]?.id) {
      setSelectedTopicId(topics[0].id);
    }
    setQuizQuestions([]);
    setAttemptResult(null);
    setError("");
    setNotice("");
    if (isTeacherOrAdmin) {
      loadTeacherData();
    } else {
      loadStudentAttempts();
    }
  }, [course.id, initialTopicId]);

  async function loadStudentAttempts() {
    try {
      const res = await assessmentApi.attempts(course.id);
      setPastAttempts(res.attempts || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadTeacherData() {
    try {
      const [qRes, fRes] = await Promise.all([
        quizzesApi.listQuestions(course.id),
        feedbackApi.list(course.id),
      ]);
      setBankQuestions(qRes.questions || []);
      setFeedbackItems(fRes.feedback || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStartQuiz() {
    setError("");
    setNotice("");
    setAttemptResult(null);
    setAnswers({});
    try {
      const res = await quizzesApi.buildQuiz(course.id, {
        topicId: selectedTopicId || null,
        count: 5,
        retryMissedOnly,
      });
      if (!res.questions || res.questions.length === 0) {
        setError("No approved quiz questions available for this selection yet.");
        setQuizQuestions([]);
        return;
      }
      setQuizQuestions(res.questions);
      setQuizDifficulty(res.difficulty);
      setAdaptiveReason(res.adaptiveReason);
      setQuizStartTs(Date.now());
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSubmitQuiz(e) {
    e.preventDefault();
    setError("");
    const formatted = quizQuestions.map((q) => ({
      questionId: q.id,
      selectedIndex: answers[q.id] ?? -1,
    }));
    const timeTakenSec = quizStartTs ? Math.round((Date.now() - quizStartTs) / 1000) : 0;

    try {
      const res = await assessmentApi.submit(course.id, {
        topicId: selectedTopicId || null,
        difficulty: quizDifficulty || "medium",
        answers: formatted,
        timeTakenSec,
        clientAttemptId: `att-ui-${quizStartTs || Date.now()}`,
      });
      setAttemptResult(res.attempt);
      setQuizQuestions([]);
      await loadStudentAttempts();
      if (onQuizCompleted) onQuizCompleted();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleFlagQuestion(questionId, promptText) {
    const reason = window.prompt("Describe the issue with this question:", "Ambiguous or incorrect option");
    if (reason === null) return;
    try {
      await feedbackApi.submit(course.id, {
        targetType: "QUIZ_QUESTION",
        targetId: questionId,
        rating: "flag",
        reason,
        excerpt: promptText.slice(0, 160),
      });
      setNotice("Question flagged for teacher review.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleGenerateMcqs(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await quizzesApi.generate(course.id, {
        topicId: selectedTopicId,
        count: Number(genCount),
        difficulty: genDifficulty,
        autoApprove: false,
      });
      setNotice(`Generated ${res.questions.length} MCQs into the teacher review queue.`);
      await loadTeacherData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReviewQuestion(questionId, decision, edits = {}) {
    setError("");
    try {
      await quizzesApi.reviewQuestion(course.id, questionId, { decision, edits });
      setEditingId(null);
      await loadTeacherData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReviewFeedback(feedbackId, status, disableTarget = false) {
    setError("");
    const teacherNote = window.prompt("Optional teacher resolution note:", "Reviewed and updated");
    if (teacherNote === null) return;
    try {
      await feedbackApi.review(course.id, feedbackId, {
        status,
        teacherNote,
        disableTarget,
      });
      await loadTeacherData();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!isTeacherOrAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <div className="alert alert-error">{error}</div>}
        {notice && <div className="alert alert-info">{notice}</div>}

        <div className="card">
          <h3 style={{ margin: "0 0 8px", fontSize: "1.02rem", color: "var(--navy)" }}>
            Adaptive Practice Quiz — {course.code}
          </h3>
          <p style={{ margin: "0 0 14px", fontSize: "0.85rem", color: "var(--text-subtle)" }}>
            Difficulty adapts automatically based on your topic performance. Instant grading & source explanations included.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
            <div style={{ minWidth: 260, flex: "1 1 260px" }}>
              <label className="label">Topic</label>
              <select
                className="select"
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
              >
                <option value="">All Course Topics</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.85rem", paddingBottom: 8 }}>
              <input
                type="checkbox"
                checked={retryMissedOnly}
                onChange={(e) => setRetryMissedOnly(e.target.checked)}
              />
              Retry missed questions only
            </label>

            <button type="button" className="btn btn-primary" onClick={handleStartQuiz}>
              <ClipboardCheck size={15} /> Start Adaptive Quiz
            </button>
          </div>
        </div>

        {quizQuestions.length > 0 && (
          <form className="card" onSubmit={handleSubmitQuiz}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              <div>
                <span className="badge badge-blue">Difficulty: {quizDifficulty.toUpperCase()}</span>
                <span style={{ marginLeft: 10, fontSize: "0.82rem", color: "var(--text-subtle)" }}>
                  {adaptiveReason}
                </span>
              </div>
              <span className="badge badge-navy">{quizQuestions.length} Questions</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {quizQuestions.map((q, idx) => (
                <div key={q.id} className="card-subtle">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.94rem" }}>
                      {idx + 1}. {q.prompt}
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleFlagQuestion(q.id, q.prompt)}
                      title="Flag question"
                    >
                      <Flag size={13} />
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {q.options.map((opt, optIdx) => (
                      <label
                        key={optIdx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "8px 10px",
                          background: answers[q.id] === optIdx ? "var(--blue-soft)" : "#ffffff",
                          border: "1px solid var(--border)",
                          borderRadius: 7,
                          cursor: "pointer",
                          fontSize: "0.88rem",
                        }}
                      >
                        <input
                          type="radio"
                          name={`q-${q.id}`}
                          checked={answers[q.id] === optIdx}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <button type="submit" className="btn btn-accent">
                Submit & Auto-Grade Quiz
              </button>
            </div>
          </form>
        )}

        {attemptResult && (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <h3 style={{ margin: 0, color: "var(--navy)" }}>
                Quiz Result: {attemptResult.scorePercent}% ({attemptResult.correctCount}/{attemptResult.totalQuestions})
              </h3>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleStartQuiz}>
                <RotateCcw size={14} /> Take Next Adaptive Quiz
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
              {attemptResult.answers.map((ans, idx) => (
                <div
                  key={ans.questionId}
                  className="card-subtle"
                  style={{
                    borderColor: ans.isCorrect ? "#bbf7d0" : "#fecaca",
                    background: ans.isCorrect ? "var(--green-soft)" : "var(--red-soft)",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    {idx + 1}. {ans.prompt}
                  </div>
                  <div style={{ fontSize: "0.84rem", marginTop: 4 }}>
                    <strong>Your Answer:</strong>{" "}
                    {ans.selectedIndex >= 0 ? ans.options[ans.selectedIndex] : "Not answered"}{" "}
                    {ans.isCorrect ? "✓" : `✗ (Correct: ${ans.options[ans.correctIndex]})`}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 4 }}>
                    <strong>Explanation:</strong> {ans.explanation}
                    {ans.sourceFile ? ` (${ans.sourceFile}, p. ${ans.sourcePage})` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
            Recent Quiz History
          </h3>
          {pastAttempts.length === 0 ? (
            <p style={{ fontSize: "0.88rem", color: "var(--text-subtle)", margin: 0 }}>
              No quiz attempts recorded in this course yet.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Topic</th>
                  <th>Difficulty</th>
                  <th>Score</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {pastAttempts.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.submittedAt).toLocaleDateString()}</td>
                    <td>{topicMap.get(a.topicId)?.title || a.topicId || "Mixed"}</td>
                    <td>
                      <span className="badge badge-navy">{a.difficulty}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          a.scorePercent >= 75
                            ? "badge-green"
                            : a.scorePercent >= 50
                            ? "badge-amber"
                            : "badge-red"
                        }`}
                      >
                        {a.scorePercent}% ({a.correctCount}/{a.totalQuestions})
                      </span>
                    </td>
                    <td>{a.timeTakenSec}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  // Teacher / Admin Quiz Bank & Feedback Review View
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      <form className="card" onSubmit={handleGenerateMcqs}>
        <h3 style={{ margin: "0 0 10px", fontSize: "1rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={17} color="var(--blue)" /> Generate Grounded MCQs from Course Content
        </h3>
        <div className="grid-4" style={{ alignItems: "end" }}>
          <div>
            <label className="label">Topic</label>
            <select
              className="select"
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
            >
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select
              className="select"
              value={genDifficulty}
              onChange={(e) => setGenDifficulty(e.target.value)}
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div>
            <label className="label">Count</label>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              value={genCount}
              onChange={(e) => setGenCount(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Generate MCQs
          </button>
        </div>
      </form>

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
          Question Bank & Teacher Approval Queue ({bankQuestions.length})
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bankQuestions.map((q) => (
            <div key={q.id} className="card-subtle">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span
                    className={`badge ${
                      q.status === "APPROVED"
                        ? "badge-green"
                        : q.status === "REJECTED"
                        ? "badge-red"
                        : "badge-amber"
                    }`}
                  >
                    {q.status}
                  </span>
                  <span className="badge badge-navy">{q.difficulty}</span>
                  <span className="badge badge-blue">
                    {topicMap.get(q.topicId)?.title || q.topicId}
                  </span>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  {q.status !== "APPROVED" && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleReviewQuestion(q.id, "APPROVE")}
                    >
                      <Check size={13} /> Approve
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      setEditingId(q.id);
                      setEditPrompt(q.prompt);
                    }}
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                  {q.status !== "REJECTED" && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => handleReviewQuestion(q.id, "REJECT")}
                    >
                      <X size={13} /> Reject
                    </button>
                  )}
                </div>
              </div>

              {editingId === q.id ? (
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <input
                    className="input"
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() =>
                      handleReviewQuestion(q.id, "EDIT_AND_APPROVE", { prompt: editPrompt })
                    }
                  >
                    Save & Approve
                  </button>
                </div>
              ) : (
                <div style={{ fontWeight: 600, marginTop: 8, fontSize: "0.92rem" }}>{q.prompt}</div>
              )}

              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 6 }}>
                Correct: <strong>{q.options[q.correctIndex]}</strong> • Source: {q.sourceFile} (p. {q.sourcePage})
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
          Student Feedback & Flagged Items Review Queue ({feedbackItems.length})
        </h3>
        {feedbackItems.length === 0 ? (
          <p style={{ color: "var(--text-subtle)", fontSize: "0.88rem", margin: 0 }}>
            No feedback flags submitted for this course.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {feedbackItems.map((fb) => (
              <div key={fb.id} className="card-subtle">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span className="badge badge-navy">{fb.targetType}</span>
                    <span className={`badge ${fb.status === "PENDING" ? "badge-amber" : "badge-green"}`}>
                      {fb.status}
                    </span>
                  </div>
                  {fb.status === "PENDING" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleReviewFeedback(fb.id, "CORRECTED", fb.targetType === "QUIZ_QUESTION")}
                      >
                        Correct / Disable
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleReviewFeedback(fb.id, "RESOLVED", false)}
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleReviewFeedback(fb.id, "DISMISSED", false)}
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: "0.88rem", marginTop: 6 }}>
                  <strong>Reason:</strong> {fb.reason || fb.rating}
                </div>
                {fb.excerpt && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)", marginTop: 4 }}>
                    Excerpt: “{fb.excerpt}”
                  </div>
                )}
                {fb.teacherNote && (
                  <div style={{ fontSize: "0.8rem", color: "var(--green)", marginTop: 4 }}>
                    Teacher note: {fb.teacherNote}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

