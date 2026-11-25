// client/src/App.jsx
import React, { useEffect, useState } from "react";
import { getStoredToken, setStoredToken } from "./services/apiClient";
import { authApi, coursesApi, notificationsApi } from "./services/platformService";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import CourseManagerPanel from "./components/CourseManagerPanel";
import CourseWorkspacePage from "./pages/CourseWorkspacePage";
import AdminPanel from "./dashboards/AdminPanel";

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [showManageCourses, setShowManageCourses] = useState(false);

  async function loadWorkspaceData(preferredCourseId = null) {
    const [cRes, nRes] = await Promise.all([
      coursesApi.list(),
      notificationsApi.list(),
    ]);
    const list = cRes.courses || [];
    setCourses(list);
    setNotifications(nRes.notifications || []);

    const accessible = list.filter((c) => c.enrolled || c.isOwner);
    const pool = accessible.length > 0 ? accessible : list;
    const targetId =
      preferredCourseId && pool.some((c) => c.id === preferredCourseId)
        ? preferredCourseId
        : selectedCourseId && pool.some((c) => c.id === selectedCourseId)
        ? selectedCourseId
        : pool[0]?.id || "";
    setSelectedCourseId(targetId);
  }

  useEffect(() => {
    async function restoreSession() {
      const token = getStoredToken();
      if (!token) {
        setBooting(false);
        return;
      }
      try {
        const res = await authApi.me();
        setUser(res.user);
        await loadWorkspaceData();
      } catch (_err) {
        setStoredToken(null);
      } finally {
        setBooting(false);
      }
    }
    restoreSession();
  }, []);

  async function handleAuthenticated(loggedInUser, token) {
    setStoredToken(token);
    setUser(loggedInUser);
    await loadWorkspaceData();
  }

  function handleLogout() {
    setStoredToken(null);
    setUser(null);
    setCourses([]);
    setSelectedCourseId("");
    setNotifications([]);
  }

  async function handleMarkNotificationRead(id) {
    await notificationsApi.markRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  if (booting) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "var(--text-subtle)" }}>
        Loading AI-Assisted Personalized Learning System...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onAuthenticated={handleAuthenticated} />;
  }

  const accessibleCourses =
    user.role === "Student" ? courses.filter((c) => c.enrolled) : courses;
  const activeCourse =
    accessibleCourses.find((c) => c.id === selectedCourseId) || accessibleCourses[0] || null;

  return (
    <Layout
      user={user}
      notifications={notifications}
      onMarkNotificationRead={handleMarkNotificationRead}
      onLogout={handleLogout}
    >
      <div
        className="card"
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <label className="label" style={{ margin: 0 }}>
            Active Course
          </label>
          <select
            className="select"
            style={{ minWidth: 280, width: "auto" }}
            value={activeCourse?.id || ""}
            onChange={(e) => {
              setSelectedCourseId(e.target.value);
              setShowManageCourses(false);
            }}
          >
            {accessibleCourses.length === 0 ? (
              <option value="">No courses yet</option>
            ) : (
              accessibleCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setShowManageCourses((v) => !v)}
        >
          {showManageCourses
            ? "Back to Course Workspace"
            : user.role === "Student"
            ? "Enrol / Course Catalog"
            : "Create Course"}
        </button>
      </div>

      {showManageCourses || !activeCourse ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <CourseManagerPanel
            user={user}
            courses={courses}
            onRefreshCourses={(id) => loadWorkspaceData(id)}
            onSelectCourse={(id) => {
              setSelectedCourseId(id);
              setShowManageCourses(false);
            }}
          />
          {user.role === "Admin" && <AdminPanel />}
        </div>
      ) : (
        <CourseWorkspacePage
          user={user}
          course={activeCourse}
          onCourseUpdated={() => loadWorkspaceData(activeCourse.id)}
        />
      )}
    </Layout>
  );
}

