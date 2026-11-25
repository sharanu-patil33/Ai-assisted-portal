// server/src/modules/recommendations/recommendationRoutes.js
// Layer 2: Personalized study recommendations routes

const express = require("express");
const recommendationService = require("./recommendationService");

function createRecommendationRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.get("/course/:courseId", (req, res, next) => {
    try {
      const recommendations = recommendationService.generateRecommendations(
        req.params.courseId,
        req.user,
        adapters.repos
      );
      res.json({ recommendations });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createRecommendationRoutes };

