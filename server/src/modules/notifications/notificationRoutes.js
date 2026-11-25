// server/src/modules/notifications/notificationRoutes.js
// Layer 2: Notifications & revision reminders routes

const express = require("express");
const notificationService = require("./notificationService");

function createNotificationRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.get("/", (req, res, next) => {
    try {
      const notifications = notificationService.listNotificationsForUser(
        req.user,
        adapters.repos
      );
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:notificationId/read", (req, res, next) => {
    try {
      const notification = notificationService.markAsRead(
        req.params.notificationId,
        req.user,
        adapters.repos
      );
      res.json({ notification });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createNotificationRoutes };

