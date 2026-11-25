// client/src/components/Layout.jsx
import React, { useState } from "react";
import { BookOpen, Bell, LogOut, CheckCircle2 } from "lucide-react";

export default function Layout({
  user,
  notifications = [],
  onMarkNotificationRead,
  onLogout,
  children,
}) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <BookOpen size={20} />
            <span>AI-Assisted Personalized Learning</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.2)",
              }}
              onClick={() => setShowNotifs((v) => !v)}
              title="Notifications"
            >
              <Bell size={15} />
              <span>{unreadCount}</span>
            </button>

            {showNotifs && (
              <div
                className="card"
                style={{
                  position: "absolute",
                  top: 42,
                  right: 0,
                  width: 340,
                  zIndex: 50,
                  color: "var(--text)",
                  boxShadow: "0 10px 25px rgba(15, 23, 42, 0.14)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 10,
                  }}
                >
                  <strong style={{ fontSize: "0.9rem" }}>Alerts & Reminders</strong>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setShowNotifs(false)}
                  >
                    Close
                  </button>
                </div>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "var(--text-subtle)", margin: 0 }}>
                    No notifications yet.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 280, overflowY: "auto" }}>
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className="card-subtle"
                        style={{
                          padding: 10,
                          opacity: n.read ? 0.65 : 1,
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{n.title}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {n.message}
                        </div>
                        {!n.read && (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            style={{ marginTop: 6 }}
                            onClick={() => onMarkNotificationRead(n.id)}
                          >
                            <CheckCircle2 size={13} /> Mark read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: "right", fontSize: "0.82rem" }}>
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <div style={{ opacity: 0.8 }}>{user.role}</div>
            </div>

            <button
              type="button"
              className="btn btn-sm"
              style={{
                background: "rgba(255,255,255,0.12)",
                color: "#fff",
                borderColor: "rgba(255,255,255,0.2)",
              }}
              onClick={onLogout}
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="app-container">{children}</main>
    </div>
  );
}

