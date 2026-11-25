// client/src/dashboards/TeacherDashboard.jsx
// FR-04, FR-22, FR-23: Class average, score distribution, topic performance,
// struggling topic alerts, students needing attention, most-asked doubts, CSV export, and topic creation.

import React, { useEffect, useState } from "react";
import { Download, AlertTriangle, Plus, Users, HelpCircle } from "lucide-react";
import { analyticsApi, coursesApi } from "../services/platformService";

export default function TeacherDashboard({ course, refreshKey, onCourseUpdated }) {
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState("");
  const [unitTitle, setUnitTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setError("");
      try {
        const res = await analyticsApi.teacherDashboard(course.id);
        if (active) setDashboard(res.dashboard);
      } catch (err) {
        if (active) setError(err.message);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [course.id, refreshKey]);

  async function handleExportCsv() {
    try {
      const csv = await analyticsApi.exportCsv(course.id);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${course.code}_analytics.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddTopic(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      await coursesApi.addTopic(course.id, {
        unitTitle: unitTitle.trim() || undefined,
        topicTitle: topicTitle.trim(),
      });
      setNotice(`Added topic "${topicTitle.trim()}" to ${course.code}.`);
      setTopicTitle("");
      setUnitTitle("");
      if (onCourseUpdated) onCourseUpdated();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!dashboard) return <div className="card">Loading class analytics...</div>;

  const distEntries = Object.entries(dashboard.scoreDistribution || {});
  const maxDist = Math.max(1, ...distEntries.map(([, v]) => v));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {notice && <div className="alert alert-info">{notice}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.12rem", color: "var(--navy)" }}>
            Class Performance — {dashboard.courseCode}: {dashboard.courseTitle}
          </h2>
          <div style={{ fontSize: "0.84rem", color: "var(--text-subtle)" }}>
            Real-time mastery, struggling topics, and doubt frequency
          </div>
        </div>
        <button type="button" className="btn btn-outline" onClick={handleExportCsv}>
          <Download size={15} /> Export Analytics CSV
        </button>
      </div>

      {dashboard.strugglingTopics.length > 0 && (
        <div className="alert alert-warning" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Struggling Topic Alert:</strong>{" "}
            {dashboard.strugglingTopics.map((t) => `${t.topicTitle} (${t.lowScorePercent}% low scores)`).join("; ")}
          </div>
        </div>
      )}

      <div className="grid-4">
        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            ENROLLED STUDENTS
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--navy)", marginTop: 4 }}>
            {dashboard.enrolledStudents}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            CLASS AVERAGE
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--blue)", marginTop: 4 }}>
            {dashboard.classAverage}%
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            QUIZ ATTEMPTS
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--navy)", marginTop: 4 }}>
            {dashboard.totalAttempts}
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: "0.78rem", color: "var(--text-subtle)", fontWeight: 600 }}>
            STUDENTS NEEDING ATTENTION
          </div>
          <div style={{ fontSize: "1.65rem", fontWeight: 700, color: "var(--red)", marginTop: 4 }}>
            {dashboard.studentsNeedingAttention.length}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
            Score Distribution
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {distEntries.map(([bucket, count]) => (
              <div key={bucket} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 64, fontSize: "0.82rem", fontWeight: 600 }}>{bucket}%</span>
                <div className="progress-track" style={{ flex: 1, height: 14 }}>
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.round((count / maxDist) * 100)}%`,
                      background: bucket === "0-39" ? "var(--red)" : bucket === "40-59" ? "#d97706" : "var(--blue)",
                    }}
                  />
                </div>
                <span style={{ width: 32, textAlign: "right", fontSize: "0.84rem", fontWeight: 600 }}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>
            <HelpCircle size={17} color="var(--blue)" /> Most-Asked Doubts (Lecture Planning)
          </h3>
          {dashboard.mostAskedDoubts.length === 0 ? (
            <p style={{ color: "var(--text-subtle)", fontSize: "0.88rem", margin: 0 }}>
              No AI doubts logged yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dashboard.mostAskedDoubts.map((d) => (
                <div
                  key={d.topicId}
                  className="card-subtle"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10 }}
                >
                  <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{d.topicTitle}</span>
                  <span className="badge badge-amber">{d.doubtCount} doubts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
          Topic-Wise Class Performance
        </h3>
        <table className="table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Unit</th>
              <th>Attempts</th>
              <th>Average</th>
              <th>AI Doubts</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.topicPerformance.map((t) => (
              <tr key={t.topicId}>
                <td style={{ fontWeight: 600 }}>{t.topicTitle}</td>
                <td>{t.unitTitle}</td>
                <td>{t.attemptsCount}</td>
                <td>{t.averageScore === null ? "—" : `${t.averageScore}%`}</td>
                <td>{t.doubtCount}</td>
                <td>
                  <span className={`badge ${t.struggling ? "badge-red" : "badge-green"}`}>
                    {t.struggling ? "Struggling" : "On Track"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>
          <Users size={17} color="var(--red)" /> Students Needing Attention
        </h3>
        {dashboard.studentsNeedingAttention.length === 0 ? (
          <p style={{ color: "var(--text-subtle)", fontSize: "0.88rem", margin: 0 }}>
            No students currently flagged for intervention.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Email</th>
                <th>Avg Score</th>
                <th>Weak Topics</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.studentsNeedingAttention.map((s) => (
                <tr key={s.studentId}>
                  <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                  <td>{s.studentEmail}</td>
                  <td>
                    <span className="badge badge-red">{s.avgScore}%</span>
                  </td>
                  <td>{s.weakTopicTitles.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <form className="card" onSubmit={handleAddTopic}>
        <h3 style={{ margin: "0 0 10px", fontSize: "0.96rem", color: "var(--navy)" }}>
          Add Syllabus Topic to {course.code}
        </h3>
        <div className="grid-3" style={{ alignItems: "end" }}>
          <div>
            <label className="label">Unit Title (optional)</label>
            <input
              className="input"
              placeholder="e.g. Unit 3: Multithreading"
              value={unitTitle}
              onChange={(e) => setUnitTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Topic Title</label>
            <input
              className="input"
              placeholder="e.g. Synchronization & Locks"
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus size={15} /> Add Topic
          </button>
        </div>
      </form>
    </div>
  );
}

