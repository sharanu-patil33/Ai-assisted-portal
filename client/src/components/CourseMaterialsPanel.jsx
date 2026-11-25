// client/src/components/CourseMaterialsPanel.jsx
// FR-05, FR-06, FR-07: Material Upload (PDF/DOCX/PPTX/TXT), Topic Tagging,
// Version Tracking, Hide/Restore, and PENDING/INDEXED/FAILED Ingestion Status.

import React, { useEffect, useState } from "react";
import { UploadCloud, Eye, EyeOff, RefreshCw, FileText, CheckCircle } from "lucide-react";
import { materialsApi } from "../services/platformService";

function getStatusBadge(status) {
  if (status === "INDEXED") return "badge badge-green";
  if (status === "FAILED") return "badge badge-red";
  return "badge badge-amber";
}

export default function CourseMaterialsPanel({ course, user, onCourseDataChanged }) {
  const isTeacherOrAdmin = user.role === "Teacher" || user.role === "Admin";
  const topics = (course.units || []).flatMap((u) =>
    (u.topics || []).map((t) => ({ ...t, unitTitle: u.title }))
  );

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Upload form state (Teacher)
  const [topicId, setTopicId] = useState(topics[0]?.id || "");
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [contentText, setContentText] = useState("");
  const [isScanned, setIsScanned] = useState(false);
  const [updateMaterialId, setUpdateMaterialId] = useState("");
  const [uploading, setUploading] = useState(false);

  async function loadMaterials() {
    setLoading(true);
    setError("");
    try {
      const res = await materialsApi.list(course.id);
      setMaterials(res.materials || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTopicId(topics[0]?.id || "");
    loadMaterials();
  }, [course.id]);

  async function handleUpload(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!topicId) {
      setError("Please select a topic for this material.");
      return;
    }
    if (!file && !fileName.trim()) {
      setError("Please attach a file (PDF/DOCX/PPTX/TXT) or enter a file name with study notes.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("topicId", topicId);
      formData.append("isScanned", String(isScanned));
      if (updateMaterialId) {
        formData.append("materialId", updateMaterialId);
      }
      if (file) {
        formData.append("file", file);
      } else {
        formData.append("fileName", fileName.trim());
      }
      if (contentText.trim()) {
        formData.append("contentText", contentText.trim());
      }

      const res = await materialsApi.upload(course.id, formData);
      setNotice(
        `Queued "${res.material.fileName}" (v${res.material.version}) for background ingestion.`
      );
      setFile(null);
      setFileName("");
      setContentText("");
      setUpdateMaterialId("");
      setIsScanned(false);

      await loadMaterials();
      // Poll briefly so user sees PENDING -> INDEXED/FAILED transition
      setTimeout(loadMaterials, 350);
      if (onCourseDataChanged) onCourseDataChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function toggleVisibility(mat) {
    setError("");
    try {
      await materialsApi.setVisibility(course.id, mat.id, !mat.active);
      await loadMaterials();
      if (onCourseDataChanged) onCourseDataChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleMarkRead(mat) {
    setError("");
    try {
      await materialsApi.recordRead(course.id, mat.topicId);
      setNotice(`Recorded study progress for "${mat.fileName}".`);
      if (onCourseDataChanged) onCourseDataChanged();
    } catch (err) {
      setError(err.message);
    }
  }

  const topicMap = new Map(topics.map((t) => [t.id, t]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-info">{notice}</div>}

      {isTeacherOrAdmin && (
        <form className="card" onSubmit={handleUpload}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--navy)" }}>
                Upload or Update Course Material
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.84rem", color: "var(--text-subtle)" }}>
                Supports PDF, DOCX, PPTX, TXT. Background worker extracts/OCRs and indexes by topic.
              </p>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: 12 }}>
            <div>
              <label className="label">Target Topic</label>
              <select
                className="select"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Upload File (PDF / DOCX / PPTX / TXT)</label>
              <input
                type="file"
                accept=".pdf,.docx,.pptx,.txt"
                className="input"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <div>
              <label className="label">Version Target (Optional Update)</label>
              <select
                className="select"
                value={updateMaterialId}
                onChange={(e) => setUpdateMaterialId(e.target.value)}
              >
                <option value="">New Material (v1)</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    Update {m.fileName} (currently v{m.version})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!file && (
            <div style={{ marginBottom: 12 }}>
              <label className="label">Or Enter File Name (e.g. Lecture5_Notes.txt / .pdf)</label>
              <input
                className="input"
                placeholder="e.g. Lecture5_Interfaces.pdf"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label className="label">
              Extracted / Lecture Content Text (Optional for binary PDF/DOCX or direct notes)
            </label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Paste lecture text or leave blank when uploading a plain .txt file..."
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "0.85rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={isScanned}
                onChange={(e) => setIsScanned(e.target.checked)}
              />
              Scanned PDF (route through OCR adapter)
            </label>

            <button type="submit" className="btn btn-primary" disabled={uploading}>
              <UploadCloud size={16} />
              {uploading ? "Uploading..." : updateMaterialId ? "Upload New Version" : "Upload & Queue Ingestion"}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--navy)" }}>
            Course Materials & Ingestion Status
          </h3>
          <button type="button" className="btn btn-outline btn-sm" onClick={loadMaterials} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {materials.length === 0 ? (
          <p style={{ color: "var(--text-subtle)", fontSize: "0.9rem" }}>
            No materials uploaded for this course yet.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Topic</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Chunks</th>
                  <th>Visibility</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} style={{ opacity: m.active ? 1 : 0.55 }}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
                        <FileText size={15} color="var(--blue)" />
                        <span>{m.fileName}</span>
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-subtle)" }}>
                        {m.fileType} {m.isScanned ? "• Scanned (OCR)" : ""}
                      </div>
                      {m.errorReason && (
                        <div style={{ fontSize: "0.76rem", color: "var(--red)", marginTop: 2 }}>
                          {m.errorReason}
                        </div>
                      )}
                    </td>
                    <td>{topicMap.get(m.topicId)?.title || m.topicId}</td>
                    <td>
                      <span className="badge badge-navy">v{m.version}</span>
                    </td>
                    <td>
                      <span className={getStatusBadge(m.status)}>{m.status}</span>
                    </td>
                    <td>{m.chunkCount || 0}</td>
                    <td>
                      <span className={m.active ? "badge badge-blue" : "badge badge-amber"}>
                        {m.active ? "Active" : "Hidden"}
                      </span>
                    </td>
                    <td>
                      {isTeacherOrAdmin ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => toggleVisibility(m)}
                        >
                          {m.active ? <EyeOff size={13} /> : <Eye size={13} />}
                          {m.active ? "Hide" : "Restore"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleMarkRead(m)}
                        >
                          <CheckCircle size={13} /> Mark Studied
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

