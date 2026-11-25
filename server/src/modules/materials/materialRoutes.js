// server/src/modules/materials/materialRoutes.js
// Layer 2: Materials upload, versioning, hiding & status routes

const express = require("express");
const multer = require("multer");
const materialService = require("./materialService");
const { enqueueIngestionJob, processIngestionJob } = require("../../workers/ingestionWorker");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function createMaterialRoutes(adapters, authMiddleware) {
  const router = express.Router();
  router.use(authMiddleware.authenticate);

  router.get("/course/:courseId", (req, res, next) => {
    try {
      const materials = materialService.listMaterials(
        req.params.courseId,
        req.user,
        adapters.repos
      );
      res.json({ materials });
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/course/:courseId/upload",
    authMiddleware.requireRole("Teacher", "Admin"),
    upload.single("file"),
    async (req, res, next) => {
      try {
        const body = req.body || {};
        const fileName = req.file ? req.file.originalname : body.fileName;
        const isScanned =
          body.isScanned === true || body.isScanned === "true";
        const simulateFailure =
          body.simulateFailure === true || body.simulateFailure === "true";

        const { material, job } = materialService.createOrUpdateMaterial(
          {
            courseId: req.params.courseId,
            topicId: body.topicId,
            fileName,
            fileType: body.fileType,
            isScanned,
            contentText: body.contentText || "",
            buffer: req.file ? req.file.buffer : null,
            pages: Array.isArray(body.pages) ? body.pages : null,
            materialId: body.materialId || null,
            simulateFailure,
          },
          req.user,
          adapters.repos
        );

        // Background worker handles ingestion asynchronously (ADR-002),
        // unless synchronous mode is explicitly requested for testing
        if (body.syncProcess === true || body.syncProcess === "true") {
          await processIngestionJob(job.id, adapters);
        } else {
          enqueueIngestionJob(job.id, adapters);
        }

        const latestMaterial = adapters.repos.materials.findById(
          material.id,
          req.params.courseId
        );
        res.status(202).json({
          material: latestMaterial,
          jobId: job.id,
        });
      } catch (err) {
        next(err);
      }
    }
  );

  router.patch(
    "/course/:courseId/:materialId/visibility",
    authMiddleware.requireRole("Teacher", "Admin"),
    async (req, res, next) => {
      try {
        const { active } = req.body || {};
        const updated = await materialService.setMaterialVisibility(
          {
            courseId: req.params.courseId,
            materialId: req.params.materialId,
            active: Boolean(active),
          },
          req.user,
          adapters.repos,
          adapters.indexAdapter
        );
        res.json({ material: updated });
      } catch (err) {
        next(err);
      }
    }
  );

  router.post("/course/:courseId/read", (req, res, next) => {
    try {
      const activity = materialService.recordMaterialRead(
        {
          courseId: req.params.courseId,
          topicId: (req.body || {}).topicId,
        },
        req.user,
        adapters.repos
      );
      res.status(201).json({ activity });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createMaterialRoutes };

