// server/src/modules/quizzes/quizService.js
// Layer 3: Quiz & Question Bank domain service (FR-13, FR-14, FR-16)

const {
  ValidationError,
  AuthorizationError,
  NotFoundError,
} = require("../../models/domainErrors");
const { assertCourseAccess, findTopicInCourse } = require("../courses/courseService");

const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

async function generateMcqsForTopic(
  { courseId, topicId, count = 3, difficulty = "medium", autoApprove = false },
  user,
  adapters
) {
  const course = assertCourseAccess(courseId, user, adapters.repos, {
    requireTeacherOwnership: true,
  });
  const topic = findTopicInCourse(course, topicId);
  if (!topic) {
    throw new ValidationError("Valid topicId for this course is required");
  }
  if (!ALLOWED_DIFFICULTIES.has(difficulty)) {
    throw new ValidationError('difficulty must be "easy", "medium", or "hard"');
  }
  const numQuestions = Math.min(Math.max(Number(count) || 3, 1), 10);

  const courseChunks = adapters.repos.chunks
    .listByCourse(courseId, { activeOnly: true })
    .filter((c) => c.topicId === topicId);

  if (courseChunks.length === 0) {
    throw new ValidationError(
      "No indexed, approved course material found for this topic. Upload and index material first."
    );
  }

  const existingPrompts = adapters.repos.questions
    .listByCourse(courseId, { topicId })
    .map((q) => q.prompt);

  const generated = await adapters.llmAdapter.generateMcqs({
    topicTitle: topic.title,
    chunks: courseChunks,
    count: numQuestions,
    difficulty,
    excludePrompts: existingPrompts,
  });

  const now = new Date().toISOString();
  const status = autoApprove && (user.role === "Teacher" || user.role === "Admin")
    ? "APPROVED"
    : "PENDING_REVIEW";

  const saved = generated.map((item, idx) => {
    const q = {
      id: `q-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      courseId,
      topicId,
      prompt: item.prompt,
      options: item.options,
      correctIndex: item.correctIndex,
      explanation: item.explanation,
      difficulty,
      status,
      sourceFile: item.sourceFile,
      sourcePage: item.sourcePage,
      createdBy: user.id,
      createdAt: now,
    };
    adapters.repos.questions.create(q);
    return q;
  });

  return saved;
}

function listQuestions({ courseId, topicId = null, status = null }, user, repos) {
  assertCourseAccess(courseId, user, repos);
  const effectiveStatus = user.role === "Student" ? "APPROVED" : status;
  const items = repos.questions.listByCourse(courseId, {
    topicId: topicId || null,
    status: effectiveStatus || null,
  });
  if (user.role === "Student") {
    return items.map(({ correctIndex, ...safe }) => safe);
  }
  return items;
}

function reviewQuestion({ courseId, questionId, decision, edits = {} }, user, repos) {
  assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  const existing = repos.questions.findById(questionId, courseId);
  if (!existing) {
    throw new NotFoundError("Question not found in this course");
  }

  const allowedDecisions = new Set(["APPROVE", "EDIT_AND_APPROVE", "REJECT"]);
  if (!allowedDecisions.has(decision)) {
    throw new ValidationError('decision must be "APPROVE", "EDIT_AND_APPROVE", or "REJECT"');
  }

  const patch = {
    reviewedBy: user.id,
    reviewedAt: new Date().toISOString(),
  };

  if (decision === "REJECT") {
    patch.status = "REJECTED";
  } else {
    patch.status = "APPROVED";
    if (decision === "EDIT_AND_APPROVE" && edits) {
      if (typeof edits.prompt === "string" && edits.prompt.trim()) {
        patch.prompt = edits.prompt.trim();
      }
      if (Array.isArray(edits.options) && edits.options.length >= 2) {
        patch.options = edits.options.map((o) => String(o).trim());
      }
      if (Number.isInteger(edits.correctIndex)) {
        patch.correctIndex = edits.correctIndex;
      }
      if (typeof edits.explanation === "string" && edits.explanation.trim()) {
        patch.explanation = edits.explanation.trim();
      }
      if (ALLOWED_DIFFICULTIES.has(edits.difficulty)) {
        patch.difficulty = edits.difficulty;
      }
    }
  }

  const updated = repos.questions.update(questionId, courseId, patch);
  repos.auditLogs.create({
    id: `aud-${Date.now()}`,
    action: `QUESTION_${decision}`,
    actorId: user.id,
    targetId: questionId,
    details: { courseId, status: updated.status },
    createdAt: new Date().toISOString(),
  });
  return updated;
}

function buildQuizForStudent(
  { courseId, topicId = null, count = 5, difficulty = null, retryMissedOnly = false },
  user,
  repos
) {
  assertCourseAccess(courseId, user, repos);
  if (user.role !== "Student" && user.role !== "Teacher" && user.role !== "Admin") {
    throw new AuthorizationError("Unauthorized role");
  }

  let pool = repos.questions.listByCourse(courseId, {
    topicId: topicId || null,
    status: "APPROVED",
  });

  if (retryMissedOnly && user.role === "Student") {
    const attempts = repos.attempts.listByStudentAndCourse(user.id, courseId);
    const missedIds = new Set();
    for (const att of attempts) {
      for (const ans of att.answers || []) {
        if (!ans.isCorrect) missedIds.add(ans.questionId);
      }
    }
    const missedPool = pool.filter((q) => missedIds.has(q.id));
    if (missedPool.length > 0) {
      pool = missedPool;
    }
  }

  if (difficulty && ALLOWED_DIFFICULTIES.has(difficulty)) {
    const diffMatches = pool.filter((q) => q.difficulty === difficulty);
    if (diffMatches.length > 0) {
      pool = diffMatches;
    }
  }

  const selected = pool.slice(0, Math.min(Math.max(Number(count) || 5, 1), 20));
  return selected.map((q) => ({
    id: q.id,
    courseId: q.courseId,
    topicId: q.topicId,
    prompt: q.prompt,
    options: q.options,
    difficulty: q.difficulty,
    sourceFile: q.sourceFile,
    sourcePage: q.sourcePage,
  }));
}

module.exports = {
  generateMcqsForTopic,
  listQuestions,
  reviewQuestion,
  buildQuizForStudent,
};

