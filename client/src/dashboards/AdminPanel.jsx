// client/src/dashboards/AdminPanel.jsx
// FR-01, FR-02: Administrator User, Role & Audit Log Management

import React, { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { authApi } from "../services/platformService";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [uRes, lRes] = await Promise.all([authApi.listUsers(), authApi.auditLogs()]);
      setUsers(uRes.users || []);
      setLogs(lRes.logs || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(userId, role) {
    try {
      await authApi.updateUser(userId, { role });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleActive(user) {
    try {
      await authApi.updateUser(user.id, { active: !user.active });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: "1.02rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>
          <ShieldCheck size={18} color="var(--blue)" /> Platform Accounts & Role Management
        </h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    className="select"
                    style={{ width: 130, padding: "4px 8px" }}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                  >
                    <option value="Student">Student</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Admin">Admin</option>
                  </select>
                </td>
                <td>
                  <span className={`badge ${u.active ? "badge-green" : "badge-red"}`}>
                    {u.active ? "Active" : "Suspended"}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleToggleActive(u)}
                  >
                    {u.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ margin: "0 0 12px", fontSize: "1rem", color: "var(--navy)" }}>
          Recent Governance & Audit Logs
        </h3>
        {logs.length === 0 ? (
          <p style={{ color: "var(--text-subtle)", fontSize: "0.88rem", margin: 0 }}>
            No audit events recorded in this session yet.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-navy">{l.action}</span>
                  </td>
                  <td>{l.actorId}</td>
                  <td>{l.targetId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

