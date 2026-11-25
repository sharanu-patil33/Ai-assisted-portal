// client/src/chatbot/CourseChatbot.jsx
// FR-08 to FR-12 & FR-24: Course AI Assistant with verified { fileName, pageNumber } citations,
// out-of-scope detection, one-click Explain Simpler / Go Deeper / Another Example, follow-up input,
// and answer flagging.

import React, { useEffect, useState } from "react";
import {
  Send,
  Sparkles,
  AlertTriangle,
  FileCheck2,
  ThumbsUp,
  Flag,
  Trash2,
} from "lucide-react";
import { assistantApi, feedbackApi } from "../services/platformService";

export default function CourseChatbot({ course, onActivityLogged }) {
  const [history, setHistory] = useState([]);
  const [question, setQuestion] = useState("");
  const [explanationLevel, setExplanationLevel] = useState("standard");
  const [followUpText, setFollowUpText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [flagStatus, setFlagStatus] = useState("");

  async function loadHistory() {
    try {
      const res = await assistantApi.history(course.id);
      setHistory(res.history || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    setError("");
    setFlagStatus("");
    loadHistory();
  }, [course.id]);

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError("");
    setFlagStatus("");
    try {
      const res = await assistantApi.ask(course.id, {
        question: question.trim(),
        explanationLevel,
      });
      setHistory(res.history || []);
      setQuestion("");
      if (onActivityLogged) onActivityLogged();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFollowUp(mode, message = "") {
    if (history.length === 0) return;
    if (mode === "follow_up" && !message.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await assistantApi.followUp(course.id, {
        mode,
        message: message.trim(),
      });
      if (res.answered) {
        setHistory(res.history || []);
        if (mode === "follow_up") setFollowUpText("");
      } else {
        setError(res.reason || "Follow-up could not be answered from course material.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(msg, rating) {
    let reason = "";
    if (rating === "flag") {
      reason = window.prompt("Why are you flagging this AI answer?", "Incomplete or unclear explanation");
      if (reason === null) return;
    }
    try {
      await feedbackApi.submit(course.id, {
        targetType: "AI_ANSWER",
        targetId: msg.id || `msg-${Date.now()}`,
        rating,
        reason,
        excerpt: (msg.text || "").slice(0, 180),
      });
      setFlagStatus(
        rating === "flag"
          ? "Answer flagged and sent to the teacher review queue."
          : "Feedback recorded."
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClear() {
    await assistantApi.clearHistory(course.id);
    setHistory([]);
    setFlagStatus("");
  }

  const topics = (course.units || []).flatMap((u) => u.topics || []);
  const topicTitleMap = new Map(topics.map((t) => [t.id, t.title]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.02rem", color: "var(--navy)", display: "flex", alignItems: "center", gap: 7 }}>
              <Sparkles size={17} color="var(--blue)" />
              Course AI Assistant — {course.code}
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "0.84rem", color: "var(--text-subtle)" }}>
              Grounded strictly in approved materials for {course.title}. Every reply includes source file & page citations.
            </p>
          </div>
          {history.length > 0 && (
            <button type="button" className="btn btn-outline btn-sm" onClick={handleClear}>
              <Trash2 size={14} /> Clear Chat
            </button>
          )}
        </div>

        <form onSubmit={handleAsk} style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            className="input"
            style={{ flex: "1 1 320px" }}
            placeholder="Ask a course question (e.g. How does finally work in exception handling?)"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
          <select
            className="select"
            style={{ width: 160 }}
            value={explanationLevel}
            onChange={(e) => setExplanationLevel(e.target.value)}
            disabled={loading}
          >
            <option value="simple">Simple level</option>
            <option value="standard">Standard level</option>
            <option value="deep">Deep level</option>
          </select>
          <button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>
            <Send size={15} /> {loading ? "Thinking..." : "Ask Assistant"}
          </button>
        </form>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text-subtle)", alignSelf: "center" }}>
            Try:
          </span>
          {[
            "How does encapsulation protect fields?",
            "Difference between checked and unchecked exceptions",
            "Who won the 2022 FIFA World Cup?",
          ].map((sample) => (
            <button
              key={sample}
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setQuestion(sample)}
            >
              {sample}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {flagStatus && <div className="alert alert-info">{flagStatus}</div>}

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {history.length === 0 ? (
          <p style={{ color: "var(--text-subtle)", fontSize: "0.9rem", margin: 0 }}>
            Ask any question above to begin a grounded study session for {course.code}.
          </p>
        ) : (
          history.map((turn, idx) => {
            if (turn.role === "student") {
              return (
                <div
                  key={turn.id || idx}
                  style={{
                    alignSelf: "flex-end",
                    maxWidth: "82%",
                    background: "var(--navy)",
                    color: "#ffffff",
                    padding: "10px 14px",
                    borderRadius: 10,
                    fontSize: "0.9rem",
                  }}
                >
                  {turn.text}
                </div>
              );
            }

            const isOutOfScope = turn.answered === false || turn.inScope === false;
            return (
              <div
                key={turn.id || idx}
                className="card-subtle"
                style={{
                  maxWidth: "90%",
                  borderColor: isOutOfScope ? "#fde68a" : "var(--border)",
                  background: isOutOfScope ? "var(--amber-soft)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 8, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {isOutOfScope ? (
                      <span className="badge badge-amber">
                        <AlertTriangle size={12} /> Out of Scope
                      </span>
                    ) : (
                      <span className="badge badge-blue">Grounded Answer</span>
                    )}
                    {turn.detectedTopicId && (
                      <span className="badge badge-navy">
                        Topic: {topicTitleMap.get(turn.detectedTopicId) || turn.detectedTopicId}
                      </span>
                    )}
                  </div>

                  {!isOutOfScope && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleFeedback(turn, "up")}
                        title="Helpful"
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleFeedback(turn, "flag")}
                        title="Flag inaccurate answer"
                      >
                        <Flag size={13} /> Flag
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ whiteSpace: "pre-line", fontSize: "0.92rem" }}>{turn.text}</div>

                {turn.example && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: "#ffffff",
                      borderLeft: "3px solid var(--blue)",
                      borderRadius: 4,
                      fontSize: "0.86rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    <strong>Example:</strong> {turn.example}
                  </div>
                )}

                {Array.isArray(turn.citations) && turn.citations.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {turn.citations.map((c, cIdx) => (
                      <span key={`${c.fileName}-${c.pageNumber}-${cIdx}`} className="badge badge-green">
                        <FileCheck2 size={12} /> {c.fileName} — Page {c.pageNumber}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}

        {history.length > 0 && (
          <div
            style={{
              marginTop: 6,
              paddingTop: 14,
              borderTop: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={loading}
                onClick={() => handleFollowUp("simpler")}
              >
                Explain Simpler
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={loading}
                onClick={() => handleFollowUp("deeper")}
              >
                Go Deeper
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={loading}
                onClick={() => handleFollowUp("another_example")}
              >
                Another Example
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input"
                placeholder="Ask a follow-up question in context..."
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                className="btn btn-accent"
                disabled={loading || !followUpText.trim()}
                onClick={() => handleFollowUp("follow_up", followUpText)}
              >
                Follow Up
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

