// server/src/modules/assessment/assessmentService.js
// Layer 3: Assessment domain service (FR-15, FR-17, ADR-004)

const {
  ValidationError,
  ConflictError,
  NotFoundError,
} = require("../../models/domainErrors");
const { assertCourseAccess } = require("../courses/courseService");

function submitQuizAttempt(
  { courseId, topicId = null, difficulty = "medium", answers, timeTakenSec = 0, clientAttemptId = null },
  user,
  repos
) {
  assertCourseAccess(courseId, user, repos);

  if (!Array.isArray(answers) || answers.length === 0) {
    throw new ValidationError("answers must be a non-empty array");
  }

  // Prevent duplicate quiz submission (FM-06)
  if (clientAttemptId) {
    const existing = repos.attempts
      .listByStudentAndCourse(user.id, courseId)
      .find((a) => a.clientAttemptId === clientAttemptId);
    if (existing) {
      throw new ConflictError("This quiz attempt has already been submitted", { attemptId: existing.id });
    }
  }

  const gradedAnswers = answers.map((entry) => {
    if (!entry || !entry.questionId) {
      throw new ValidationError("Each answer must specify questionId");
    }
    const question = repos.questions.findById(entry.questionId, courseId);
    if (!question || question.status !== "APPROVED") {
      throw new NotFoundError(`Approved question ${entry.questionId} not found in this course`);
    }

    const selectedIndex = Number(entry.selectedIndex);
    const isCorrect = selectedIndex === question.correctIndex;
    return {
      questionId: question.id,
      topicId: question.topicId,
      prompt: question.prompt,
      options: question.options,
      selectedIndex,
      correctIndex: question.correctIndex,
      isCorrect,
      explanation: question.explanation,
      sourceFile: question.sourceFile,
      sourcePage: question.sourcePage,
    };
  });

  const correctCount = gradedAnswers.filter((a) => a.isCorrect).length;
  const totalQuestions = gradedAnswers.length;
  const scorePercent = Math.round((correctCount / totalQuestions) * 100);
  const resolvedTopicId = topicId || gradedAnswers[0].topicId || null;

  const attempt = {
    id: `att-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    clientAttemptId: clientAttemptId || null,
    courseId,
    topicId: resolvedTopicId,
    studentId: user.id,
    difficulty,
    totalQuestions,
    correctCount,
    scorePercent,
    timeTakenSec: Math.max(0, Number(timeTakenSec) || 0),
    answers: gradedAnswers,
    submittedAt: new Date().toISOString(),
  };

  repos.attempts.create(attempt);

  if (resolvedTopicId) {
    repos.activities.create({
      id: `act-${Date.now()}`,
      studentId: user.id,
      courseId,
      topicId: resolvedTopicId,
      type: "QUIZ_ATTEMPT",
      scorePercent,
      createdAt: attempt.submittedAt,
    });
  }

  return attempt;
}

function listAttemptsForStudent(courseId, user, repos) {
  assertCourseAccess(courseId, user, repos);
  return repos.attempts
    .listByStudentAndCourse(user.id, courseId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

module.exports = {
  submitQuizAttempt,
  listAttemptsForStudent,
};

