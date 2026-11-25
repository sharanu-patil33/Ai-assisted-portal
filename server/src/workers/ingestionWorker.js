// server/src/workers/ingestionWorker.js
// Background Worker Entry Point (ADR-001, ADR-002): Calls Layer 3 ONLY!
// Runs material ingestion, OCR, and indexing asynchronously with tracked status & retry safety.

const { ingestAndIndexMaterial } = require("../modules/ingestion/ingestionService");

function updateMaterialVersionStatus(material, status) {
  if (!Array.isArray(material.versions)) return [];
  return material.versions.map((v) =>
    v.version === material.version ? { ...v, status } : v
  );
}

async function processIngestionJob(jobId, adapters) {
  const { repos } = adapters;
  const job = repos.jobs.findById(jobId);
  if (!job) return null;

  // Idempotency guard: do not re-run an already INDEXED job
  if (job.status === "INDEXED") {
    return { skipped: true, status: "INDEXED" };
  }

  const attemptNumber = (job.attempts || 0) + 1;
  repos.jobs.update(jobId, {
    status: "PROCESSING",
    attempts: attemptNumber,
    updatedAt: new Date().toISOString(),
  });

  const result = await ingestAndIndexMaterial(job.payload, {
    textExtractor: adapters.textExtractor,
    ocrAdapter: adapters.ocrAdapter,
    indexAdapter: adapters.indexAdapter,
  });

  const now = new Date().toISOString();
  const material = repos.materials.findById(job.materialId, job.courseId);

  if (result.indexed && result.status === "INDEXED") {
    repos.jobs.update(jobId, {
      status: "INDEXED",
      chunkCount: result.chunkCount,
      errorReason: null,
      updatedAt: now,
    });
    if (material) {
      repos.materials.update(material.id, material.courseId, {
        status: "INDEXED",
        chunkCount: result.chunkCount,
        errorReason: null,
        versions: updateMaterialVersionStatus(material, "INDEXED"),
        updatedAt: now,
      });
    }
    return result;
  }

  // Retry-safe failure handling (ADR-002)
  if (attemptNumber <= (job.maxRetries || 0)) {
    repos.jobs.update(jobId, {
      status: "PENDING",
      errorReason: result.reason,
      updatedAt: now,
    });
    return processIngestionJob(jobId, adapters);
  }

  repos.jobs.update(jobId, {
    status: "FAILED",
    chunkCount: 0,
    errorReason: result.reason,
    updatedAt: now,
  });
  if (material) {
    repos.materials.update(material.id, material.courseId, {
      status: "FAILED",
      chunkCount: 0,
      errorReason: result.reason,
      versions: updateMaterialVersionStatus(material, "FAILED"),
      updatedAt: now,
    });
  }
  return result;
}

function enqueueIngestionJob(jobId, adapters) {
  // Schedule asynchronously out of the interactive HTTP request path (AD-06, ADR-002)
  setTimeout(() => {
    processIngestionJob(jobId, adapters).catch(() => {});
  }, 50);
}

module.exports = {
  processIngestionJob,
  enqueueIngestionJob,
};

