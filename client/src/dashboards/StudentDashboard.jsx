// client/src/dashboards/StudentDashboard.jsx
// FR-18 to FR-21: Topic mastery (weak/moderate/strong), progress bar, score trend,
// and personalized study recommendations linked to material & practice quiz.

import React, { useEffect, useState } from "react";
import { TrendingUp, BookOpen, PlayCircle, AlertCircle } from "lucide-react";
import { analyticsApi, recommendationsApi } from "../services/platformService";

function getClassificationBadge(cls) {
  if (cls === "strong") return "badge badge-green";
  if (cls === "moderate") return "badge badge-amber";
  if (cls === "weak") return "badge badge-red";
  return "badge badge-navy";
}

function getBarColor(cls) {
  if (cls === "strong") return "var(--green)";
  if (cls === "moderate") return "#d97706";
  if (cls === "weak") return "var(--red)";
  return "#94a3b8";
}

export default function StudentDashboard({
  course,
  refreshKey,
  onNavigateTab,
  onStartRecommendedQuiz,
}) {
  const [dashboard, setDashboard] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      try {
        const [dRes, rRes] = await Promise.all([
          analyticsApi.studentDashboard(course.id),
          recommendationsApi.list(course.id),
        ]);
        if (!active) return;
        setDashboard(dRes.dashboard);
        setRecommendations(rRes.recommendations || []);
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [course.id, refreshKey]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!dashboard) return <div className="card">Loading student analytics...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="grid-4">
        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            OVERALL PROGRESS
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--navy)", margin: "4px 0" }}>
            {dashboard.overallProgress}%
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${dashboard.overallProgress}%`, background: "var(--blue)" }}
            />
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6 }}>
            {dashboard.completedTopics} of {dashboard.totalTopics} topics completed
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            AVERAGE QUIZ SCORE
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--navy)", margin: "4px 0" }}>
            {dashboard.avgQuizScore}%
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Across {dashboard.totalAttempts} quiz attempt(s)
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            STRONG TOPICS
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--green)", margin: "4px 0" }}>
            {dashboard.strongAreas.length}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Mastery score ≥ 75%
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            WEAK AREAS
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--red)", margin: "4px 0" }}>
            {dashboard.weakAreas.length}
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Needs targeted revision
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
            Topic Mastery Breakdown
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {dashboard.topicMastery.map((t) => (
              <div key={t.topicId} className="card-subtle" style={{ padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{t.topicTitle}</div>
                    <div style={{ fontSize: "0.76rem", color: "var(--text-subtle)" }}>
                      {t.unitTitle} • Attempts: {t.attemptsCount} • AI Doubts: {t.doubtCount}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{t.masteryScore}%</span>
                    <span className={getClassificationBadge(t.classification)}>
                      {t.classification.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="progress-track" style={{ marginTop: 8 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${t.masteryScore}%`,
                      background: getBarColor(t.classification),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>
            <TrendingUp size={17} color="var(--blue)" /> Score Trend & Recommendations
          </h3>

          {dashboard.scoreTrend.length > 0 && (
            <div className="card-subtle" style={{ marginBottom: 14 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-subtle)", marginBottom: 8 }}>
                Recent Attempt Scores
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 84 }}>
                {dashboard.scoreTrend.map((pt) => (
                  <div
                    key={pt.attemptId}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>{pt.scorePercent}%</span>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 36,
                        height: `${Math.max(10, Math.round((pt.scorePercent / 100) * 52))}px`,
                        background:
                          pt.scorePercent >= 75
                            ? "var(--green)"
                            : pt.scorePercent >= 50
                            ? "#d97706"
                            : "var(--red)",
                        borderRadius: "4px 4px 0 0",
                      }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-subtle)" }}>
                      #{pt.attemptNumber}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recommendations.length === 0 ? (
              <div className="alert alert-info">
                All topics are strong! Keep practicing with adaptive quizzes.
              </div>
            ) : (
              recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="card-subtle"
                  style={{
                    borderColor: rec.severity === "HIGH" ? "#fecaca" : "var(--border)",
                    background: rec.severity === "HIGH" ? "var(--red-soft)" : "var(--surface)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span
                      className={`badge ${
                        rec.severity === "HIGH"
                          ? "badge-red"
                          : rec.severity === "MEDIUM"
                          ? "badge-amber"
                          : "badge-blue"
                      }`}
                    >
                      <AlertCircle size={12} /> {rec.severity} PRIORITY
                    </span>
                    <span className="badge badge-navy">Next Quiz: {rec.recommendedDifficulty}</span>
                  </div>

                  <p style={{ margin: "8px 0", fontSize: "0.88rem", fontWeight: 500 }}>
                    {rec.message}
                  </p>

                  {rec.prerequisiteWarning && (
                    <div style={{ fontSize: "0.78rem", color: "var(--amber)", marginBottom: 8 }}>
                      {rec.prerequisiteWarning}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {rec.materialLink && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => onNavigateTab("materials")}
                      >
                        <BookOpen size={13} /> Open {rec.materialLink.fileName}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onStartRecommendedQuiz(rec.topicId)}
                    >
                      <PlayCircle size={13} /> Practice Quiz
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

