// server/src/modules/assessment/assessmentRoutes.js
// Layer 2: Quiz attempt submission & auto-grading routes

const express = require("express");
const assessmentService = require("./assessmentService");

function createAssessmentRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.post("/course/:courseId/submit", (req, res, next) => {
    try {
      const body = req.body || {};
      const attempt = assessmentService.submitQuizAttempt(
        {
          courseId: req.params.courseId,
          topicId: body.topicId || null,
          difficulty: body.difficulty || "medium",
          answers: body.answers,
          timeTakenSec: body.timeTakenSec,
          clientAttemptId: body.clientAttemptId || null,
        },
        req.user,
        adapters.repos
      );
      res.status(201).json({ attempt });
    } catch (err) {
      next(err);
    }
  });

  router.get("/course/:courseId/attempts", (req, res, next) => {
    try {
      const attempts = assessmentService.listAttemptsForStudent(
        req.params.courseId,
        req.user,
        adapters.repos
      );
      res.json({ attempts });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAssessmentRoutes };

