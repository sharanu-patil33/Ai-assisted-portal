// client/src/pages/CourseWorkspacePage.jsx
import React, { useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  ClipboardCheck,
  FolderOpen,
  Shield,
} from "lucide-react";
import StudentDashboard from "../dashboards/StudentDashboard";
import TeacherDashboard from "../dashboards/TeacherDashboard";
import AdminPanel from "../dashboards/AdminPanel";
import CourseChatbot from "../chatbot/CourseChatbot";
import QuizWorkspace from "../quizzes/QuizWorkspace";
import CourseMaterialsPanel from "../components/CourseMaterialsPanel";

export default function CourseWorkspacePage({
  user,
  course,
  onCourseUpdated,
}) {
  const isTeacherOrAdmin = user.role === "Teacher" || user.role === "Admin";
  const [activeTab, setActiveTab] = useState("dashboard");
  const [quizTopicId, setQuizTopicId] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  function bumpRefresh() {
    setRefreshKey((k) => k + 1);
    if (onCourseUpdated) onCourseUpdated();
  }

  function handleStartRecommendedQuiz(topicId) {
    setQuizTopicId(topicId);
    setActiveTab("quizzes");
  }

  return (
    <div>
      <div className="tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <LayoutDashboard size={15} />
          {isTeacherOrAdmin ? "Class Analytics" : "My Progress & Recommendations"}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "assistant" ? "active" : ""}`}
          onClick={() => setActiveTab("assistant")}
        >
          <MessageSquare size={15} /> AI Course Assistant
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "quizzes" ? "active" : ""}`}
          onClick={() => setActiveTab("quizzes")}
        >
          <ClipboardCheck size={15} />
          {isTeacherOrAdmin ? "Quizzes & Feedback Review" : "Adaptive Quizzes"}
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "materials" ? "active" : ""}`}
          onClick={() => setActiveTab("materials")}
        >
          <FolderOpen size={15} /> Course Materials
        </button>

        {user.role === "Admin" && (
          <button
            type="button"
            className={`tab-btn ${activeTab === "admin" ? "active" : ""}`}
            onClick={() => setActiveTab("admin")}
          >
            <Shield size={15} /> Admin Governance
          </button>
        )}
      </div>

      {activeTab === "dashboard" &&
        (isTeacherOrAdmin ? (
          <TeacherDashboard
            course={course}
            refreshKey={refreshKey}
            onCourseUpdated={bumpRefresh}
          />
        ) : (
          <StudentDashboard
            course={course}
            refreshKey={refreshKey}
            onNavigateTab={setActiveTab}
            onStartRecommendedQuiz={handleStartRecommendedQuiz}
          />
        ))}

      {activeTab === "assistant" && (
        <CourseChatbot course={course} onActivityLogged={bumpRefresh} />
      )}

      {activeTab === "quizzes" && (
        <QuizWorkspace
          course={course}
          user={user}
          initialTopicId={quizTopicId}
          onQuizCompleted={bumpRefresh}
        />
      )}

      {activeTab === "materials" && (
        <CourseMaterialsPanel
          course={course}
          user={user}
          onCourseDataChanged={bumpRefresh}
        />
      )}

      {activeTab === "admin" && user.role === "Admin" && <AdminPanel />}
    </div>
  );
}

