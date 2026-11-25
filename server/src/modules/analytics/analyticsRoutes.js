// server/src/modules/analytics/analyticsRoutes.js
// Layer 2: Student & Teacher dashboard analytics + CSV export routes

const express = require("express");
const analyticsService = require("./analyticsService");

function createAnalyticsRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.get("/course/:courseId/student-dashboard", (req, res, next) => {
    try {
      const dashboard = analyticsService.getStudentDashboard(
        req.params.courseId,
        req.user,
        adapters.repos
      );
      res.json({ dashboard });
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/course/:courseId/teacher-dashboard",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const dashboard = analyticsService.getTeacherDashboard(
          req.params.courseId,
          req.user,
          adapters.repos
        );
        res.json({ dashboard });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    "/course/:courseId/teacher-export",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const dashboard = analyticsService.getTeacherDashboard(
          req.params.courseId,
          req.user,
          adapters.repos
        );
        const csv = analyticsService.buildTeacherCsvExport(dashboard);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${dashboard.courseCode}_analytics.csv"`
        );
        res.send(csv);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

module.exports = { createAnalyticsRoutes };

