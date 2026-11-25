// client/src/components/CourseManagerPanel.jsx
// FR-03, FR-04: Course Creation with Units/Topics (Teacher) & Course Enrolment (Student)

import React, { useState } from "react";
import { Plus, BookPlus, UserPlus } from "lucide-react";
import { coursesApi } from "../services/platformService";

export default function CourseManagerPanel({ user, courses, onRefreshCourses, onSelectCourse }) {
  const [courseCode, setCourseCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [initialTopic, setInitialTopic] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleEnrol(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await coursesApi.enrol({ courseCode });
      setNotice(
        res.alreadyEnrolled
          ? `Already enrolled in ${res.course.title}.`
          : `Enrolled in ${res.course.title}!`
      );
      setCourseCode("");
      await onRefreshCourses(res.course.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleEnrolCatalog(id) {
    setError("");
    setNotice("");
    try {
      const res = await coursesApi.enrol({ courseId: id });
      setNotice(`Enrolled in ${res.course.title}!`);
      await onRefreshCourses(res.course.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateCourse(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await coursesApi.create({
        code: newCode,
        title: newTitle,
        description: newDescription,
        units: initialTopic.trim()
          ? [{ title: "Unit 1", topics: [{ title: initialTopic.trim() }] }]
          : [],
      });
      setNotice(`Created course ${res.course.code} — ${res.course.title}.`);
      setNewCode("");
      setNewTitle("");
      setNewDescription("");
      setInitialTopic("");
      await onRefreshCourses(res.course.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      {user.role === "Student" && (
        <div className="card">
          <h3 style={{ margin: "0 0 10px", fontSize: "1rem", color: "var(--navy)" }}>
            Enrol in a Course
          </h3>
          <form onSubmit={handleEnrol} style={{ display: "flex", gap: 10, maxWidth: 460 }}>
            <input
              className="input"
              placeholder="Enter course code (e.g. CS201, CS302, CS304)"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">
              <UserPlus size={15} /> Enrol
            </button>
          </form>

          <div className="grid-3" style={{ marginTop: 16 }}>
            {courses.map((c) => (
              <div key={c.id} className="card-subtle">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="badge badge-navy">{c.code}</span>
                  <span className={c.enrolled ? "badge badge-green" : "badge badge-amber"}>
                    {c.enrolled ? "Enrolled" : "Available"}
                  </span>
                </div>
                <div style={{ fontWeight: 700, marginTop: 8, fontSize: "0.95rem" }}>{c.title}</div>
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "6px 0 12px" }}>
                  {c.description}
                </p>
                {c.enrolled ? (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => onSelectCourse(c.id)}
                  >
                    Open Course
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-accent btn-sm"
                    onClick={() => handleEnrolCatalog(c.id)}
                  >
                    Enrol Now
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(user.role === "Teacher" || user.role === "Admin") && (
        <form className="card" onSubmit={handleCreateCourse}>
          <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 8 }}>
            <BookPlus size={18} /> Create New Course with Initial Unit & Topic
          </h3>
          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div>
              <label className="label">Course Code</label>
              <input
                className="input"
                placeholder="e.g. CS401"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Course Title</label>
              <input
                className="input"
                placeholder="e.g. Computer Networks"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">First Topic (Unit 1)</label>
              <input
                className="input"
                placeholder="e.g. OSI & TCP/IP Layers"
                value={initialTopic}
                onChange={(e) => setInitialTopic(e.target.value)}
              />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="Brief syllabus overview..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            <Plus size={15} /> Create Course
          </button>
        </form>
      )}
    </div>
  );
}

