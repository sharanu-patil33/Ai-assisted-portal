// server/test/lab4.test.js
// Automated verification for Lab 4 functions (FR-07 to FR-12) and End-to-End 5-Layer API Flows

const test = require("node:test");
const assert = require("node:assert/strict");

const { ingestAndIndexMaterial } = require("../src/modules/ingestion/ingestionService");
const {
  retrieveCourseContext,
  generateGroundedAnswer,
  attachSourceCitations,
  handleFollowUpRequest,
} = require("../src/modules/ai-assistant/assistantService");

const { LocalStore, createInitialData } = require("../src/config/store");
const { createApp } = require("../src/app");

// ============================================================
// Part A: Lab 4 Verified Functions Unit Tests (R1-R4)
// ============================================================

test("FR-07 ingestAndIndexMaterial: rejects missing fields and unsupported file types (R1)", async () => {
  const adapters = {
    textExtractor: { extractPages: async () => [{ pageNumber: 1, text: "abc" }] },
    ocrAdapter: { extractPages: async () => [{ pageNumber: 1, text: "abc" }] },
    indexAdapter: { upsertChunks: async () => {} },
  };

  const missingRes = await ingestAndIndexMaterial(
    { materialId: "m1", courseId: "c1", topicId: "t1", fileName: "", version: 1, fileType: "PDF" },
    adapters
  );
  assert.equal(missingRes.indexed, false);
  assert.equal(missingRes.status, "FAILED");
  assert.match(missingRes.reason, /fileName/);

  const badTypeRes = await ingestAndIndexMaterial(
    { materialId: "m1", courseId: "c1", topicId: "t1", fileName: "video.mp4", version: 1, fileType: "MP4" },
    adapters
  );
  assert.equal(badTypeRes.indexed, false);
  assert.equal(badTypeRes.status, "FAILED");
  assert.match(badTypeRes.reason, /Unsupported file type/);
});

test("FR-07 ingestAndIndexMaterial: routes scanned PDF to ocrAdapter and tags chunks (R2-R4)", async () => {
  let ocrCalled = false;
  let textCalled = false;
  let indexedChunks = [];

  const adapters = {
    ocrAdapter: {
      extractPages: async () => {
        ocrCalled = true;
        return [{ pageNumber: 2, text: "Scanned OCR content about polymorphism." }];
      },
    },
    textExtractor: {
      extractPages: async () => {
        textCalled = true;
        return [];
      },
    },
    indexAdapter: {
      upsertChunks: async (chunks) => {
        indexedChunks = chunks;
      },
    },
  };

  const res = await ingestAndIndexMaterial(
    {
      materialId: "m-scan",
      courseId: "c-oops-101",
      topicId: "t-oops-2",
      fileName: "Scanned_Notes.pdf",
      version: 2,
      fileType: "PDF",
      isScanned: true,
    },
    adapters
  );

  assert.equal(ocrCalled, true);
  assert.equal(textCalled, false);
  assert.equal(res.indexed, true);
  assert.equal(res.status, "INDEXED");
  assert.equal(res.chunkCount, 1);
  assert.equal(indexedChunks[0].courseId, "c-oops-101");
  assert.equal(indexedChunks[0].topicId, "t-oops-2");
  assert.equal(indexedChunks[0].version, 2);
  assert.equal(indexedChunks[0].pageNumber, 2);
  assert.equal(indexedChunks[0].active, true);
});

test("FR-07 ingestAndIndexMaterial: failed or empty extraction never returns INDEXED (R3)", async () => {
  const resEmpty = await ingestAndIndexMaterial(
    { materialId: "m1", courseId: "c1", topicId: "t1", fileName: "a.txt", version: 1, fileType: "TXT" },
    {
      textExtractor: { extractPages: async () => [] },
      indexAdapter: { upsertChunks: async () => {} },
    }
  );
  assert.equal(resEmpty.indexed, false);
  assert.equal(resEmpty.status, "FAILED");

  const resError = await ingestAndIndexMaterial(
    { materialId: "m1", courseId: "c1", topicId: "t1", fileName: "a.txt", version: 1, fileType: "TXT" },
    {
      textExtractor: {
        extractPages: async () => {
          throw new Error("Corrupt stream");
        },
      },
      indexAdapter: { upsertChunks: async () => {} },
    }
  );
  assert.equal(resError.indexed, false);
  assert.equal(resError.status, "FAILED");
  assert.match(resError.reason, /Corrupt stream/);
});

test("FR-08/FR-12 retrieveCourseContext: validates inputs, isolates courses, and allows threshold equality", async () => {
  await assert.rejects(
    () => retrieveCourseContext({ courseId: "", question: "hi", minRelevanceScore: 0.5 }, { searchApprovedChunks: async () => [] }),
    TypeError
  );

  const retrievalAdapter = {
    searchApprovedChunks: async () => [
      { chunkId: "other", courseId: "c-other", topicId: "t1", active: true, approved: true, score: 0.99 },
      { chunkId: "hidden", courseId: "c1", topicId: "t1", active: false, approved: true, score: 0.99 },
      { chunkId: "unapproved", courseId: "c1", topicId: "t1", active: true, approved: false, score: 0.99 },
      { chunkId: "equal", courseId: "c1", topicId: "t-equal", active: true, approved: true, score: 0.5 },
    ],
  };

  const ctx = await retrieveCourseContext(
    { courseId: "c1", question: "encapsulation", minRelevanceScore: 0.5 },
    retrievalAdapter
  );
  assert.equal(ctx.inScope, true);
  assert.equal(ctx.detectedTopicId, "t-equal");
  assert.equal(ctx.chunks.length, 1);
  assert.equal(ctx.chunks[0].chunkId, "equal");

  const outOfScope = await retrieveCourseContext(
    { courseId: "c1", question: "world cup", minRelevanceScore: 0.8 },
    retrievalAdapter
  );
  assert.equal(outOfScope.inScope, false);
  assert.deepEqual(outOfScope.chunks, []);
});

test("FR-08/FR-09 generateGroundedAnswer: skips LLM on out-of-scope and validates usedChunkIds", async () => {
  let llmCalled = false;
  const llmAdapter = {
    generateExplanation: async () => {
      llmCalled = true;
      return { explanation: "Answer", example: "Ex", usedChunkIds: ["c1"] };
    },
  };

  const outRes = await generateGroundedAnswer(
    { question: "anything", explanationLevel: "simple" },
    { inScope: false, chunks: [] },
    llmAdapter
  );
  assert.equal(llmCalled, false);
  assert.equal(outRes.answered, false);

  // Fabricated chunkId rejected (R4)
  const fabricated = await generateGroundedAnswer(
    { question: "anything" },
    { inScope: true, chunks: [{ chunkId: "real-1", text: "abc" }] },
    {
      generateExplanation: async () => ({
        explanation: "Hallucinated",
        usedChunkIds: ["fake-99"],
      }),
    }
  );
  assert.equal(fabricated.answered, false);
});

test("FR-10 attachSourceCitations: deduplicates { fileName, pageNumber } and rejects invalid pages", () => {
  assert.throws(() => attachSourceCitations(null, []), TypeError);

  const chunks = [
    { chunkId: "k1", fileName: "Notes.pdf", pageNumber: 3 },
    { chunkId: "k2", fileName: "Notes.pdf", pageNumber: 3 },
    { chunkId: "k3", fileName: "Notes.pdf", pageNumber: 0 },
    { chunkId: "k4", fileName: "", pageNumber: 4 },
  ];

  const cited = attachSourceCitations(
    { answered: true, explanation: "Valid", example: null, usedChunkIds: ["k1", "k2", "k3", "k4"] },
    chunks
  );
  assert.equal(cited.answered, true);
  assert.deepEqual(cited.citations, [{ fileName: "Notes.pdf", pageNumber: 3 }]);

  const uncited = attachSourceCitations(
    { answered: true, explanation: "Valid", usedChunkIds: ["k3", "k4"] },
    chunks
  );
  assert.equal(uncited.answered, false);
  assert.deepEqual(uncited.citations, []);
});

test("FR-11 handleFollowUpRequest: preserves history immutability and course isolation", async () => {
  const history = [
    { role: "student", text: "What is encapsulation?" },
    { role: "assistant", text: "Bundling data and methods." },
  ];
  const snapshot = JSON.stringify(history);

  const res = await handleFollowUpRequest(
    { courseId: "c1", mode: "simpler" },
    history,
    {
      searchApprovedChunks: async () => [
        {
          chunkId: "c1-p1",
          courseId: "c1",
          active: true,
          approved: true,
          fileName: "OOP.pdf",
          pageNumber: 1,
          text: "Encapsulation hides fields.",
        },
        {
          chunkId: "c2-p1",
          courseId: "c2",
          active: true,
          approved: true,
          fileName: "Other.pdf",
          pageNumber: 9,
          text: "Wrong course.",
        },
      ],
    },
    {
      generateFollowUp: async () => ({
        explanation: "Simple: hiding internal fields.",
        example: "private balance",
        usedChunkIds: ["c1-p1"],
      }),
    }
  );

  assert.equal(res.answered, true);
  assert.deepEqual(res.citations, [{ fileName: "OOP.pdf", pageNumber: 1 }]);
  assert.equal(JSON.stringify(history), snapshot); // input history never mutated
  assert.equal(res.updatedHistory.length, 4);
});

// ============================================================
// Part B: End-to-End 5-Layer API Integration Tests
// ============================================================

test("End-to-End API: RBAC, Course Isolation, Ingestion, AI Assistant, Quizzes & Feedback", async () => {
  const store = new LocalStore({ persistToDisk: false });
  store.reset(createInitialData());
  const { app } = createApp(store);

  const server = app.listen(0);
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}/api`;

  async function req(path, opts = {}) {
    const r = await fetch(`${baseUrl}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
    });
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body };
  }

  try {
    // 1. Login as Student and Teacher
    const studentLogin = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "student@edu.local", password: "Student@123" }),
    });
    assert.equal(studentLogin.status, 200);
    const studentToken = studentLogin.body.token;

    const teacherLogin = await req("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "teacher@edu.local", password: "Teacher@123" }),
    });
    assert.equal(teacherLogin.status, 200);
    const teacherToken = teacherLogin.body.token;

    // 2. RBAC & Course Isolation (ADR-003)
    const studentForbiddenDashboard = await req("/analytics/course/c-oops-101/teacher-dashboard", {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.equal(studentForbiddenDashboard.status, 403);

    const crossCourseStudent = await req("/ai-assistant/course/c-os-301/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ question: "What is deadlock?" }),
    });
    assert.equal(crossCourseStudent.status, 403);

    const crossCourseTeacher = await req("/analytics/course/c-os-301/teacher-dashboard", {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert.equal(crossCourseTeacher.status, 403);

    // 3. Teacher uploads material (syncProcess for deterministic test) -> INDEXED
    const uploadRes = await req("/materials/course/c-oops-101/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({
        topicId: "t-oops-3",
        fileName: "Interfaces_Guide.txt",
        fileType: "TXT",
        contentText:
          "An interface defines a contract of abstract methods that implementing classes must provide. A class can implement multiple interfaces in Java.",
        syncProcess: true,
      }),
    });
    assert.equal(uploadRes.status, 202);
    assert.equal(uploadRes.body.material.status, "INDEXED");
    const uploadedMatId = uploadRes.body.material.id;

    // 4. Student asks question -> Grounded answer with citation
    const askRes = await req("/ai-assistant/course/c-oops-101/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({
        question: "What is an interface contract in Java?",
        explanationLevel: "simple",
      }),
    });
    assert.equal(askRes.status, 200);
    assert.equal(askRes.body.inScope, true);
    assert.equal(askRes.body.answered, true);
    assert.ok(askRes.body.citations.some((c) => c.fileName === "Interfaces_Guide.txt" && c.pageNumber === 1));

    // 5. Follow-up request ("deeper")
    const followUpRes = await req("/ai-assistant/course/c-oops-101/follow-up", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ mode: "deeper" }),
    });
    assert.equal(followUpRes.status, 200);
    assert.equal(followUpRes.body.answered, true);
    assert.ok(followUpRes.body.citations.length > 0);

    // 6. Out-of-scope detection (FR-12)
    const oosRes = await req("/ai-assistant/course/c-oops-101/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ question: "What is the recipe for lasagna pasta?" }),
    });
    assert.equal(oosRes.status, 200);
    assert.equal(oosRes.body.inScope, false);
    assert.equal(oosRes.body.answered, false);

    // 7. Hide material -> hidden material chunks no longer retrieved (FR-06)
    const hideRes = await req(`/materials/course/c-oops-101/${uploadedMatId}/visibility`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ active: false }),
    });
    assert.equal(hideRes.status, 200);
    assert.equal(hideRes.body.material.active, false);

    const afterHideAsk = await req("/ai-assistant/course/c-oops-101/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ question: "What is an interface contract in Java?" }),
    });
    assert.equal(afterHideAsk.status, 200);
    assert.equal(afterHideAsk.body.inScope, false);
  } finally {
    server.close();
  }
});

