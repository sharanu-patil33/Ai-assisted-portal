// server/src/modules/courses/courseRoutes.js
// Layer 2: Courses & Enrolment API routes

const express = require("express");
const courseService = require("./courseService");

function createCourseRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.get("/", (req, res, next) => {
    try {
      const courses = courseService.listCoursesForUser(req.user, adapters.repos);
      res.json({ courses });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:courseId", (req, res, next) => {
    try {
      const course = courseService.getCourseById(
        req.params.courseId,
        req.user,
        adapters.repos
      );
      res.json({ course });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const course = courseService.createCourse(
          req.body || {},
          req.user,
          adapters.repos
        );
        res.status(201).json({ course });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    "/:courseId/topics",
    authMiddleware.requireRole("Teacher", "Admin"),
    (req, res, next) => {
      try {
        const result = courseService.addTopicToCourse(
          req.params.courseId,
          req.body || {},
          req.user,
          adapters.repos
        );
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  router.post(
    "/enrol",
    authMiddleware.requireRole("Student"),
    (req, res, next) => {
      try {
        const result = courseService.enrolStudent(
          req.body || {},
          req.user,
          adapters.repos
        );
        res.status(result.alreadyEnrolled ? 200 : 201).json(result);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

module.exports = { createCourseRoutes };

