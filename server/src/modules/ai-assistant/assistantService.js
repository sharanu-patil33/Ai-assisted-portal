// server/src/modules/ai-assistant/assistantService.js

const ALLOWED_EXPLANATION_LEVELS = new Set(["simple", "standard", "deep"]);
const ALLOWED_FOLLOW_UP_MODES = new Set(["simpler", "deeper", "another_example", "follow_up"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function retrieveCourseContext(request, retrievalAdapter) {
  // Rule 1: Validate inputs
  if (!request || typeof request !== "object") {
    throw new TypeError("request must be a valid object");
  }
  if (!isNonEmptyString(request.courseId)) {
    throw new TypeError("request.courseId must be a non-empty string");
  }
  if (!isNonEmptyString(request.question)) {
    throw new TypeError("request.question must be a non-empty string");
  }
  if (typeof request.minRelevanceScore !== "number" || Number.isNaN(request.minRelevanceScore)) {
    throw new TypeError("request.minRelevanceScore must be a valid number");
  }
  if (!retrievalAdapter || typeof retrievalAdapter.searchApprovedChunks !== "function") {
    throw new TypeError("retrievalAdapter.searchApprovedChunks must be a function");
  }

  // Rule 2: Search with explicit courseId
  const rawChunks = await retrievalAdapter.searchApprovedChunks({
    courseId: request.courseId,
    query: request.question.trim(),
  });

  // Rule 3: Filter for course isolation, active, approved, and relevance threshold (equality passes)
  const filteredChunks = Array.isArray(rawChunks)
    ? rawChunks.filter(
        (chunk) =>
          chunk &&
          chunk.courseId === request.courseId &&
          chunk.active === true &&
          chunk.approved === true &&
          typeof chunk.score === "number" &&
          chunk.score >= request.minRelevanceScore
      )
    : [];

  // Rule 4: Handle out-of-scope or return highest-scoring topic
  if (filteredChunks.length === 0) {
    return {
      inScope: false,
      detectedTopicId: null,
      chunks: [],
      reason: "Question is outside the uploaded course material",
    };
  }

  const topChunk = filteredChunks.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  return {
    inScope: true,
    detectedTopicId: topChunk.topicId || null,
    chunks: filteredChunks,
    reason: "Relevant course context found",
  };
}

async function generateGroundedAnswer(request, context, llmAdapter) {
  // Rule 1: Validate inputs and explanationLevel
  if (!request || typeof request !== "object") {
    throw new TypeError("request must be a valid object");
  }
  if (!isNonEmptyString(request.question)) {
    throw new TypeError("request.question must be a non-empty string");
  }
  if (!context || typeof context !== "object") {
    throw new TypeError("context must be a valid object");
  }

  const level =
    request.explanationLevel === undefined || request.explanationLevel === null
      ? "standard"
      : request.explanationLevel;

  if (!ALLOWED_EXPLANATION_LEVELS.has(level)) {
    throw new TypeError('request.explanationLevel must be "simple", "standard", or "deep"');
  }

  // Rule 2: Do not call llmAdapter if out of scope or no chunks
  if (context.inScope !== true || !Array.isArray(context.chunks) || context.chunks.length === 0) {
    return {
      answered: false,
      explanation: "",
      example: null,
      usedChunkIds: [],
      reason: "Out of scope: no approved course material available",
    };
  }

  if (!llmAdapter || typeof llmAdapter.generateExplanation !== "function") {
    throw new TypeError("llmAdapter.generateExplanation must be a function");
  }

  // Rule 3: Call llmAdapter using only context.chunks
  const result = await llmAdapter.generateExplanation({
    question: request.question.trim(),
    chunks: context.chunks,
    level,
  });

  // Rule 4: Verify explanation is non-empty and all usedChunkIds exist in context.chunks
  const explanation = result && isNonEmptyString(result.explanation) ? result.explanation.trim() : "";
  const usedChunkIds = result && Array.isArray(result.usedChunkIds) ? result.usedChunkIds : [];
  const validChunkIds = new Set(context.chunks.map((c) => c.chunkId));
  const allIdsValid = usedChunkIds.length > 0 && usedChunkIds.every((id) => validChunkIds.has(id));

  if (!explanation || !allIdsValid) {
    return {
      answered: false,
      explanation: "",
      example: null,
      usedChunkIds: [],
      reason: "Generated answer was empty or not grounded in approved course chunks",
    };
  }

  return {
    answered: true,
    explanation,
    example: result && isNonEmptyString(result.example) ? result.example.trim() : null,
    usedChunkIds,
    reason: "Grounded answer generated",
  };
}

function attachSourceCitations(answerResult, chunks) {
  // Rule 1: Validate inputs
  if (!answerResult || typeof answerResult !== "object") {
    throw new TypeError("answerResult must be a valid object");
  }
  if (!Array.isArray(chunks)) {
    throw new TypeError("chunks must be an array");
  }

  // Rule 2: Handle unanswered result
  if (answerResult.answered !== true) {
    return {
      answered: false,
      explanation: answerResult.explanation || "",
      example: answerResult.example || null,
      citations: [],
      reason: answerResult.reason || "No answer available to cite",
    };
  }

  // Rule 3 & Rule 4: Match usedChunkIds, validate fileName/pageNumber, and deduplicate
  const chunkMap = new Map();
  for (const chunk of chunks) {
    if (chunk && chunk.chunkId !== undefined) {
      chunkMap.set(chunk.chunkId, chunk);
    }
  }

  const usedIds = Array.isArray(answerResult.usedChunkIds) ? answerResult.usedChunkIds : [];
  const seen = new Set();
  const citations = [];

  for (const id of usedIds) {
    const chunk = chunkMap.get(id);
    if (!chunk) continue;
    if (!isNonEmptyString(chunk.fileName)) continue;
    if (!Number.isInteger(chunk.pageNumber) || chunk.pageNumber <= 0) continue;

    const key = `${chunk.fileName}::${chunk.pageNumber}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        fileName: chunk.fileName,
        pageNumber: chunk.pageNumber,
      });
    }
  }

  if (citations.length === 0) {
    return {
      answered: false,
      explanation: "",
      example: null,
      citations: [],
      reason: "Missing verifiable source citations",
    };
  }

  return {
    answered: true,
    explanation: answerResult.explanation,
    example: answerResult.example || null,
    citations,
    reason: "Citations attached",
  };
}

async function handleFollowUpRequest(followUp, history, retrievalAdapter, llmAdapter) {
  // Rule 1: Validate inputs
  if (!followUp || typeof followUp !== "object") {
    throw new TypeError("followUp must be a valid object");
  }
  if (!isNonEmptyString(followUp.courseId)) {
    throw new TypeError("followUp.courseId must be a non-empty string");
  }
  if (!ALLOWED_FOLLOW_UP_MODES.has(followUp.mode)) {
    throw new TypeError('followUp.mode must be "simpler", "deeper", "another_example", or "follow_up"');
  }
  if (!Array.isArray(history) || history.length === 0) {
    throw new TypeError("history must be a non-empty array");
  }
  if (followUp.mode === "follow_up" && !isNonEmptyString(followUp.message)) {
    throw new TypeError('followUp.message must be a non-empty string when mode is "follow_up"');
  }
  if (!retrievalAdapter || typeof retrievalAdapter.searchApprovedChunks !== "function") {
    throw new TypeError("retrievalAdapter.searchApprovedChunks must be a function");
  }
  if (!llmAdapter || typeof llmAdapter.generateFollowUp !== "function") {
    throw new TypeError("llmAdapter.generateFollowUp must be a function");
  }

  // Rule 2: Build course-scoped query from latest student turn + optional message
  const lastStudentTurn = [...history].reverse().find((turn) => turn && turn.role === "student" && isNonEmptyString(turn.text));
  const baseText = lastStudentTurn ? lastStudentTurn.text.trim() : "";
  const extraMessage = isNonEmptyString(followUp.message) ? followUp.message.trim() : "";
  const query = [baseText, extraMessage].filter(Boolean).join(" ").trim();

  const rawChunks = await retrievalAdapter.searchApprovedChunks({
    courseId: followUp.courseId,
    query,
  });

  const approvedChunks = Array.isArray(rawChunks)
    ? rawChunks.filter(
        (chunk) =>
          chunk &&
          chunk.courseId === followUp.courseId &&
          chunk.active === true &&
          chunk.approved === true
      )
    : [];

  // Rule 3: Handle out-of-scope without mutating history
  if (approvedChunks.length === 0) {
    return {
      answered: false,
      mode: followUp.mode,
      explanation: "",
      example: null,
      citations: [],
      updatedHistory: [...history],
      reason: "Follow-up is outside the uploaded course material",
    };
  }

  // Rule 4: Generate follow-up, attach deduplicated citations, and return new updatedHistory
  const result = await llmAdapter.generateFollowUp({
    mode: followUp.mode,
    message: extraMessage,
    history,
    chunks: approvedChunks,
  });

  const explanation = result && isNonEmptyString(result.explanation) ? result.explanation.trim() : "";
  const usedChunkIds = result && Array.isArray(result.usedChunkIds) ? result.usedChunkIds : [];

  const cited = attachSourceCitations(
    {
      answered: Boolean(explanation),
      explanation,
      example: result && isNonEmptyString(result.example) ? result.example.trim() : null,
      usedChunkIds,
      reason: explanation ? "" : "Empty follow-up explanation",
    },
    approvedChunks
  );

  if (!cited.answered) {
    return {
      answered: false,
      mode: followUp.mode,
      explanation: "",
      example: null,
      citations: [],
      updatedHistory: [...history],
      reason: cited.reason,
    };
  }

  const studentTurnText = extraMessage || `[${followUp.mode}]`;
  const updatedHistory = [
    ...history,
    { role: "student", text: studentTurnText },
    { role: "assistant", text: cited.explanation, chunkIds: usedChunkIds },
  ];

  return {
    answered: true,
    mode: followUp.mode,
    explanation: cited.explanation,
    example: cited.example,
    citations: cited.citations,
    updatedHistory,
    reason: "Follow-up answered",
  };
}

module.exports = {
  retrieveCourseContext,
  generateGroundedAnswer,
  attachSourceCitations,
  handleFollowUpRequest,
};

