// server/src/modules/feedback/feedbackRoutes.js
// Layer 2: Student flagging & Teacher review routes (FR-24)

const express = require("express");
const feedbackService = require("./feedbackService");

function createFeedbackRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.post("/course/:courseId", (req, res, next) => {
    try {
      const item = feedbackService.submitFeedback(
        {
          courseId: req.params.courseId,
          ...(req.body || {}),
        },
        req.user,
        adapters.repos
      );
      res.status(201).json({ feedback: item });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/course/:courseId",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const items = feedbackService.listCourseFeedback(
          req.params.courseId,
          req.user,
          adapters.repos
        );
        res.json({ feedback: items });
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    "/course/:courseId/:feedbackId",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const updated = feedbackService.reviewFeedback(
          {
            courseId: req.params.courseId,
            feedbackId: req.params.feedbackId,
            ...(req.body || {}),
          },
          req.user,
          adapters.repos
        );
        res.json({ feedback: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

module.exports = { createFeedbackRoutes };

