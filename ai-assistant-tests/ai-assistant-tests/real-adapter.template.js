'use strict';
/**
 * Connect the test suite to YOUR project.
 *   1. Copy this file to real-adapter.js
 *   2. Fill in each TODO so it calls your own functions
 *   3. Run:   ASSISTANT_IMPL=./real-adapter.js npm test        (Windows PowerShell:  $env:ASSISTANT_IMPL="./real-adapter.js"; npm test)
 *
 * Every method must return the plain objects described in README.md ("Contract").
 * If one of your functions has a different name or shape, convert it here: do NOT edit the tests.
 */
// const svc = require('../src/courseAssistantService');   // TODO: your module(s)

module.exports = function createRealAssistant(overrides = {}) {
  const config = {
    maxFileBytes: 20 * 1024 * 1024, maxPages: 200,            // TODO: your real limits
    minQuestionChars: 1, maxQuestionChars: 1000,
    threshold: 0.6, contextTurns: 5, responseTimeTargetMs: 5000,
    canary: null,                                              // TODO: put a secret marker in your system prompt and set it here (SEC-04, EA-13)
    ...overrides,
  };
  return {
    config,

    // ---- test setup helpers ----
    enroll(userId, courseId) { /* TODO: svc.enrollStudent(userId, courseId) */ },
    seedUserData(userId, secret) { /* optional (SEC-05): store a secret string for that user */ },
    classifyEvidence(score) { /* TODO: return svc.isEvidenceSufficient(score) ? 'sufficient' : 'insufficient' */ },

    // ---- failure injection (use stubs / mocks of your OCR, network and AI provider) ----
    simulate: {
      ocrFailure(on) { /* TODO: make your OCR stub throw while on === true */ },
      offline(on) { /* TODO: make your network layer fail while on === true */ },
      providerFailure(kind) { /* TODO: make your AI provider stub time out when kind === 'timeout', null = normal */ },
      dropMetadata(on) { /* TODO: make retrieved chunks lose file/page metadata while on === true */ },
    },

    // ---- teacher operations ----
    async uploadDocument({ actor, courseId, file, approved }) { /* TODO */ },
    async retryIndexing({ actor, docId }) { /* TODO */ },
    async setApproval({ actor, docId, approved }) { /* TODO */ },
    async hideDocument({ actor, docId }) { /* TODO */ },
    async deleteDocument({ actor, docId }) { /* TODO */ },
    async listDocuments({ actor, courseId }) { /* TODO */ },
    async getChunkCount({ docId }) { /* TODO */ },
    async getSource({ actor, courseId, file, page }) { /* TODO */ },

    // ---- student operations ----
    async ask({ actor, courseId, sessionId, question, requestId }) { /* TODO */ },
    async getContext({ actor, sessionId }) { /* TODO: [{ question, status }, ...] */ },
  };
};
