// client/src/services/platformService.js
// Layer 1 Service Facade calling Layer 2 API endpoints exclusively

import { apiRequest } from "./apiClient";

export const authApi = {
  login: (payload) =>
    apiRequest("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  register: (payload) =>
    apiRequest("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  me: () => apiRequest("/auth/me"),
  listUsers: () => apiRequest("/auth/users"),
  updateUser: (userId, payload) =>
    apiRequest(`/auth/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  auditLogs: () => apiRequest("/auth/audit-logs"),
};

export const coursesApi = {
  list: () => apiRequest("/courses"),
  getById: (courseId) => apiRequest(`/courses/${courseId}`),
  create: (payload) =>
    apiRequest("/courses", { method: "POST", body: JSON.stringify(payload) }),
  addTopic: (courseId, payload) =>
    apiRequest(`/courses/${courseId}/topics`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  enrol: (payload) =>
    apiRequest("/courses/enrol", { method: "POST", body: JSON.stringify(payload) }),
};

export const materialsApi = {
  list: (courseId) => apiRequest(`/materials/course/${courseId}`),
  upload: (courseId, formData) =>
    apiRequest(`/materials/course/${courseId}/upload`, {
      method: "POST",
      body: formData,
    }),
  setVisibility: (courseId, materialId, active) =>
    apiRequest(`/materials/course/${courseId}/${materialId}/visibility`, {
      method: "PATCH",
      body: JSON.stringify({ active }),
    }),
  recordRead: (courseId, topicId) =>
    apiRequest(`/materials/course/${courseId}/read`, {
      method: "POST",
      body: JSON.stringify({ topicId }),
    }),
};

export const assistantApi = {
  history: (courseId) => apiRequest(`/ai-assistant/course/${courseId}/history`),
  ask: (courseId, payload) =>
    apiRequest(`/ai-assistant/course/${courseId}/ask`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  followUp: (courseId, payload) =>
    apiRequest(`/ai-assistant/course/${courseId}/follow-up`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  clearHistory: (courseId) =>
    apiRequest(`/ai-assistant/course/${courseId}/history`, { method: "DELETE" }),
};

export const quizzesApi = {
  generate: (courseId, payload) =>
    apiRequest(`/quizzes/course/${courseId}/generate`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listQuestions: (courseId, params = {}) => {
    const query = new URLSearchParams();
    if (params.topicId) query.set("topicId", params.topicId);
    if (params.status) query.set("status", params.status);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest(`/quizzes/course/${courseId}/questions${qs}`);
  },
  reviewQuestion: (courseId, questionId, payload) =>
    apiRequest(`/quizzes/course/${courseId}/questions/${questionId}/review`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  buildQuiz: (courseId, payload) =>
    apiRequest(`/quizzes/course/${courseId}/build`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export const assessmentApi = {
  submit: (courseId, payload) =>
    apiRequest(`/assessment/course/${courseId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  attempts: (courseId) => apiRequest(`/assessment/course/${courseId}/attempts`),
};

export const analyticsApi = {
  studentDashboard: (courseId) =>
    apiRequest(`/analytics/course/${courseId}/student-dashboard`),
  teacherDashboard: (courseId) =>
    apiRequest(`/analytics/course/${courseId}/teacher-dashboard`),
  exportCsv: (courseId) =>
    apiRequest(`/analytics/course/${courseId}/teacher-export`, { rawText: true }),
};

export const recommendationsApi = {
  list: (courseId) => apiRequest(`/recommendations/course/${courseId}`),
};

export const feedbackApi = {
  submit: (courseId, payload) =>
    apiRequest(`/feedback/course/${courseId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: (courseId) => apiRequest(`/feedback/course/${courseId}`),
  review: (courseId, feedbackId, payload) =>
    apiRequest(`/feedback/course/${courseId}/${feedbackId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};

export const notificationsApi = {
  list: () => apiRequest("/notifications"),
  markRead: (id) => apiRequest(`/notifications/${id}/read`, { method: "PATCH" }),
};

