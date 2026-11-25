// client/src/pages/LoginPage.jsx
// FR-01: Role-based Login & Registration (Student, Teacher, Admin)

import React, { useState } from "react";
import { GraduationCap } from "lucide-react";
import { authApi } from "../services/platformService";

export default function LoginPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("student@edu.local");
  const [password, setPassword] = useState("Student@123");
  const [role, setRole] = useState("Student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res =
        mode === "login"
          ? await authApi.login({ email, password })
          : await authApi.register({ name, email, password, role });
      onAuthenticated(res.user, res.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail, demoPassword) {
    setMode("login");
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 440, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 9,
              background: "var(--navy)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GraduationCap size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.15rem", color: "var(--navy)" }}>
              AI-Assisted Personalized Learning
            </h1>
            <div style={{ fontSize: "0.8rem", color: "var(--text-subtle)" }}>
              Course-grounded Q&A, adaptive quizzes & mastery analytics
            </div>
          </div>
        </div>

        <div className="tabs" style={{ marginTop: 18, marginBottom: 18 }}>
          <button
            type="button"
            className={`tab-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Register
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {mode === "register" && (
            <>
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kavya Rao"
                  required
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="Student">Student</option>
                  <option value="Teacher">Teacher</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="label">Institutional Email</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label">Password</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? "Authenticating..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 14,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-subtle)", marginBottom: 8 }}>
            Quick Demo Accounts
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fillDemo("student@edu.local", "Student@123")}
            >
              Student Demo
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fillDemo("teacher@edu.local", "Teacher@123")}
            >
              Teacher Demo
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fillDemo("admin@edu.local", "Admin@123")}
            >
              Admin Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

