// server/src/modules/feedback/feedbackService.js
// Layer 3: Feedback and Human-in-the-Loop Review domain service (FR-24)

const { ValidationError, NotFoundError } = require("../../models/domainErrors");
const { assertCourseAccess } = require("../courses/courseService");

const ALLOWED_TARGET_TYPES = new Set(["AI_ANSWER", "QUIZ_QUESTION"]);
const ALLOWED_RATINGS = new Set(["up", "down", "flag"]);
const ALLOWED_REVIEW_STATUSES = new Set(["RESOLVED", "CORRECTED", "DISMISSED"]);

function submitFeedback(
  { courseId, targetType, targetId, rating = "flag", reason = "", excerpt = "" },
  user,
  repos
) {
  assertCourseAccess(courseId, user, repos);

  if (!ALLOWED_TARGET_TYPES.has(targetType)) {
    throw new ValidationError('targetType must be "AI_ANSWER" or "QUIZ_QUESTION"');
  }
  if (!targetId || typeof targetId !== "string") {
    throw new ValidationError("targetId is required");
  }
  if (!ALLOWED_RATINGS.has(rating)) {
    throw new ValidationError('rating must be "up", "down", or "flag"');
  }

  const item = {
    id: `fb-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    courseId,
    targetType,
    targetId,
    studentId: user.id,
    rating,
    reason: String(reason || "").trim(),
    excerpt: String(excerpt || "").trim(),
    status: rating === "up" ? "ACKNOWLEDGED" : "PENDING",
    teacherNote: "",
    reviewedBy: null,
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };

  repos.feedback.create(item);
  return item;
}

function listCourseFeedback(courseId, user, repos) {
  assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  return repos.feedback.listByCourse(courseId).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

function reviewFeedback(
  { courseId, feedbackId, status, teacherNote = "", disableTarget = false },
  user,
  repos
) {
  assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  if (!ALLOWED_REVIEW_STATUSES.has(status)) {
    throw new ValidationError('status must be "RESOLVED", "CORRECTED", or "DISMISSED"');
  }

  const existing = repos.feedback.findById(feedbackId, courseId);
  if (!existing) {
    throw new NotFoundError("Feedback item not found in this course");
  }

  const now = new Date().toISOString();
  const updated = repos.feedback.update(feedbackId, courseId, {
    status,
    teacherNote: String(teacherNote || "").trim(),
    reviewedBy: user.id,
    reviewedAt: now,
  });

  if (disableTarget && existing.targetType === "QUIZ_QUESTION") {
    repos.questions.update(existing.targetId, courseId, {
      status: "REJECTED",
      reviewedBy: user.id,
      reviewedAt: now,
    });
  }

  repos.auditLogs.create({
    id: `aud-${Date.now()}`,
    action: "FEEDBACK_REVIEWED",
    actorId: user.id,
    targetId: feedbackId,
    details: { courseId, status, disableTarget: Boolean(disableTarget) },
    createdAt: now,
  });

  return updated;
}

module.exports = {
  submitFeedback,
  listCourseFeedback,
  reviewFeedback,
};

