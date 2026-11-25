// server/src/modules/auth/authRoutes.js
// Layer 2: Auth & Admin API routes

const express = require("express");
const authService = require("./authService");

function createAuthRoutes(adapters, authMiddleware) {
  const router = express.Router();

  router.post("/register", (req, res, next) => {
    try {
      const result = authService.registerUser(req.body || {}, adapters.repos);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", (req, res, next) => {
    try {
      const result = authService.loginUser(req.body || {}, adapters.repos);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get("/me", authMiddleware.authenticate, (req, res) => {
    res.json({ user: req.user });
  });

  router.get(
    "/users",
    authMiddleware.authenticate,
    authMiddleware.requireRole("Admin"),
    (req, res, next) => {
      try {
        const users = authService.listUsers(req.user, adapters.repos);
        res.json({ users });
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    "/users/:userId",
    authMiddleware.authenticate,
    authMiddleware.requireRole("Admin"),
    (req, res, next) => {
      try {
        const user = authService.updateUserAdmin(
          req.params.userId,
          req.body || {},
          req.user,
          adapters.repos
        );
        res.json({ user });
      } catch (err) {
        next(err);
      }
    }
  );

  router.get(
    "/audit-logs",
    authMiddleware.authenticate,
    authMiddleware.requireRole("Admin"),
    (req, res, next) => {
      try {
        const logs = authService.listAuditLogs(req.user, adapters.repos);
        res.json({ logs });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}

module.exports = { createAuthRoutes };

