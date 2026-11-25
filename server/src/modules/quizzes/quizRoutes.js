// server/src/modules/quizzes/quizRoutes.js
// Layer 2: Quiz generation, teacher approval queue & adaptive quiz builder routes

const express = require("express");
const quizService = require("./quizService");
const analyticsService = require("../analytics/analyticsService");

function createQuizRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.post(
    "/course/:courseId/generate",
    authMiddleware.requireRole("Teacher", "Admin"),
    async (req, res, next) => {
      try {
        const { topicId, count, difficulty, autoApprove } = req.body || {};
        const questions = await quizService.generateMcqsForTopic(
          {
            courseId: req.params.courseId,
            topicId,
            count,
            difficulty,
            autoApprove: Boolean(autoApprove),
          },
          req.user,
          adapters
        );
        res.status(201).json({ questions });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get("/course/:courseId/questions", (req, res, next) => {
    try {
      const questions = quizService.listQuestions(
        {
          courseId: req.params.courseId,
          topicId: req.query.topicId || null,
          status: req.query.status || null,
        },
        req.user,
        adapters.repos
      );
      res.json({ questions });
    } catch (err) {
      next(err);
    }
  });

  router.patch(
    "/course/:courseId/questions/:questionId/review",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const { decision, edits } = req.body || {};
        const question = quizService.reviewQuestion(
          {
            courseId: req.params.courseId,
            questionId: req.params.questionId,
            decision,
            edits,
          },
          req.user,
          adapters.repos
        );
        res.json({ question });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post("/course/:courseId/build", (req, res, next) => {
    try {
      const { courseId } = req.params;
      const { topicId = null, count = 5, difficulty = null, retryMissedOnly = false } =
        req.body || {};

      const adaptive = difficulty
        ? { difficulty, reason: "Selected manually" }
        : analyticsService.determineAdaptiveDifficulty(
            { courseId, topicId, studentId: req.user.id },
            adapters.repos
          );

      const questions = quizService.buildQuizForStudent(
        {
          courseId,
          topicId,
          count,
          difficulty: adaptive.difficulty,
          retryMissedOnly: Boolean(retryMissedOnly),
        },
        req.user,
        adapters.repos
      );

      res.json({
        difficulty: adaptive.difficulty,
        adaptiveReason: adaptive.reason,
        questions,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createQuizRoutes };

