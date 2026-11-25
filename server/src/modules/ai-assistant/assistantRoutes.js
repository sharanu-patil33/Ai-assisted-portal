// server/src/modules/ai-assistant/assistantRoutes.js
// Layer 2: AI Course Assistant API routes orchestrating Lab 4 verified functions (FR-08 to FR-12)

const express = require("express");
const assistantService = require("./assistantService");
const { assertCourseAccess } = require("../courses/courseService");

function createAssistantRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.get("/course/:courseId/history", (req, res, next) => {
    try {
      assertCourseAccess(req.params.courseId, req.user, adapters.repos);
      const conv = adapters.repos.conversations.find(
        req.params.courseId,
        req.user.id
      );
      res.json({ history: conv ? conv.messages : [] });
    } catch (err) {
      next(err);
    }
  });

  router.post("/course/:courseId/ask", async (req, res, next) => {
    try {
      const { courseId } = req.params;
      assertCourseAccess(courseId, req.user, adapters.repos);

      const { question, explanationLevel = "standard", minRelevanceScore = 0.15 } =
        req.body || {};

      // Step 1: Lab 4 retrieveCourseContext
      const context = await assistantService.retrieveCourseContext(
        {
          courseId,
          question,
          minRelevanceScore: Number(minRelevanceScore),
        },
        adapters.retrievalAdapter
      );

      // Step 2: Lab 4 generateGroundedAnswer
      const answerResult = await assistantService.generateGroundedAnswer(
        {
          question,
          explanationLevel,
        },
        context,
        adapters.llmAdapter
      );

      // Step 3: Lab 4 attachSourceCitations
      const cited = assistantService.attachSourceCitations(
        answerResult,
        context.chunks
      );

      // Persist conversation turn and doubt signal (FR-08, FR-17)
      const existingConv = adapters.repos.conversations.find(courseId, req.user.id);
      const priorMessages = existingConv ? existingConv.messages : [];
      const messageId = `msg-${Date.now()}`;

      const updatedHistory = [
        ...priorMessages,
        {
          id: `${messageId}-q`,
          role: "student",
          text: String(question).trim(),
          createdAt: new Date().toISOString(),
        },
        {
          id: `${messageId}-a`,
          role: "assistant",
          answered: cited.answered,
          inScope: context.inScope,
          detectedTopicId: context.detectedTopicId,
          text: cited.answered
            ? cited.explanation
            : `${cited.reason}. Please ask questions related to the uploaded materials for this course.`,
          example: cited.example,
          citations: cited.citations,
          chunkIds: answerResult.usedChunkIds || [],
          reason: cited.reason,
          createdAt: new Date().toISOString(),
        },
      ];

      adapters.repos.conversations.upsert(courseId, req.user.id, updatedHistory);

      if (context.detectedTopicId) {
        adapters.repos.activities.create({
          id: `act-${Date.now()}`,
          studentId: req.user.id,
          courseId,
          topicId: context.detectedTopicId,
          type: "AI_DOUBT",
          question: String(question).trim(),
          createdAt: new Date().toISOString(),
        });
      }

      res.json({
        messageId: `${messageId}-a`,
        inScope: context.inScope,
        detectedTopicId: context.detectedTopicId,
        answered: cited.answered,
        explanation: cited.explanation,
        example: cited.example,
        citations: cited.citations,
        reason: cited.reason,
        history: updatedHistory,
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/course/:courseId/follow-up", async (req, res, next) => {
    try {
      const { courseId } = req.params;
      assertCourseAccess(courseId, req.user, adapters.repos);

      const { mode, message = "" } = req.body || {};
      const conv = adapters.repos.conversations.find(courseId, req.user.id);
      const history = conv ? conv.messages : [];

      const result = await assistantService.handleFollowUpRequest(
        {
          courseId,
          mode,
          message,
        },
        history,
        adapters.retrievalAdapter,
        adapters.llmAdapter
      );

      if (result.answered) {
        const messageId = `msg-${Date.now()}`;
        // Enrich latest assistant turn with UI metadata while keeping Lab 4 updatedHistory intact
        const enriched = result.updatedHistory.map((turn, idx, arr) => {
          if (idx === arr.length - 1 && turn.role === "assistant") {
            return {
              ...turn,
              id: `${messageId}-a`,
              answered: true,
              inScope: true,
              mode: result.mode,
              example: result.example,
              citations: result.citations,
              createdAt: new Date().toISOString(),
            };
          }
          if (idx === arr.length - 2 && turn.role === "student" && !turn.id) {
            return {
              ...turn,
              id: `${messageId}-q`,
              createdAt: new Date().toISOString(),
            };
          }
          return turn;
        });

        adapters.repos.conversations.upsert(courseId, req.user.id, enriched);
        return res.json({
          ...result,
          messageId: `${messageId}-a`,
          history: enriched,
        });
      }

      res.json({
        ...result,
        history,
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/course/:courseId/history", (req, res, next) => {
    try {
      assertCourseAccess(req.params.courseId, req.user, adapters.repos);
      adapters.repos.conversations.upsert(req.params.courseId, req.user.id, []);
      res.json({ cleared: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createAssistantRoutes };

