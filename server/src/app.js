// server/src/app.js
// Layer 2: Express Application Composition Root

const express = require("express");
const cors = require("cors");

const { createAdapters } = require("./config/adapters");
const { createAuthMiddleware } = require("./middleware/authMiddleware");
const { errorHandler } = require("./middleware/errorHandler");

const { createAuthRoutes } = require("./modules/auth/authRoutes");
const { createCourseRoutes } = require("./modules/courses/courseRoutes");
const { createMaterialRoutes } = require("./modules/materials/materialRoutes");
const { createAssistantRoutes } = require("./modules/ai-assistant/assistantRoutes");
const { createQuizRoutes } = require("./modules/quizzes/quizRoutes");
const { createAssessmentRoutes } = require("./modules/assessment/assessmentRoutes");
const { createAnalyticsRoutes } = require("./modules/analytics/analyticsRoutes");
const { createRecommendationRoutes } = require("./modules/recommendations/recommendationRoutes");
const { createFeedbackRoutes } = require("./modules/feedback/feedbackRoutes");
const { createNotificationRoutes } = require("./modules/notifications/notificationRoutes");

function createApp(customStore = null) {
  const app = express();
  const adapters = createAdapters(customStore || undefined);
  const authMiddleware = createAuthMiddleware(adapters);

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      architecture: "5-layer-modular",
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api/auth", createAuthRoutes(adapters, authMiddleware));
  app.use("/api/courses", createCourseRoutes(adapters, authMiddleware));
  app.use("/api/materials", createMaterialRoutes(adapters, authMiddleware));
  app.use("/api/ai-assistant", createAssistantRoutes(adapters, authMiddleware));
  app.use("/api/quizzes", createQuizRoutes(adapters, authMiddleware));
  app.use("/api/assessment", createAssessmentRoutes(adapters, authMiddleware));
  app.use("/api/analytics", createAnalyticsRoutes(adapters, authMiddleware));
  app.use("/api/recommendations", createRecommendationRoutes(adapters, authMiddleware));
  app.use("/api/feedback", createFeedbackRoutes(adapters, authMiddleware));
  app.use("/api/notifications", createNotificationRoutes(adapters, authMiddleware));

  app.use((_req, res) => {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "API endpoint not found", details: null },
    });
  });

  app.use(errorHandler);

  return { app, adapters };
}

module.exports = { createApp };

