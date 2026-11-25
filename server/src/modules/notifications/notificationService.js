// server/src/modules/notifications/notificationService.js
// Layer 3: Reminder and Alert domain service (FR-20, FR-23)

const { NotFoundError } = require("../../models/domainErrors");

function listNotificationsForUser(user, repos) {
  return repos.notifications
    .listByUser(user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function markAsRead(notificationId, user, repos) {
  const updated = repos.notifications.markRead(notificationId, user.id);
  if (!updated) {
    throw new NotFoundError("Notification not found");
  }
  return updated;
}

function createNotification({ userId, courseId, type = "REVISION_REMINDER", title, message }, repos) {
  const item = {
    id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    userId,
    courseId,
    type,
    title,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  repos.notifications.create(item);
  return item;
}

module.exports = {
  listNotificationsForUser,
  markAsRead,
  createNotification,
};

