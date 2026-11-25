// server/src/modules/materials/materialService.js
// Layer 3: Material Management domain service (FR-05, FR-06, ADR-002)

const {
  ValidationError,
  NotFoundError,
} = require("../../models/domainErrors");
const { assertCourseAccess, findTopicInCourse } = require("../courses/courseService");

const SUPPORTED_EXTENSIONS = new Set(["PDF", "DOCX", "PPTX", "TXT"]);

function inferFileType(fileName, explicitType) {
  if (explicitType && SUPPORTED_EXTENSIONS.has(String(explicitType).toUpperCase())) {
    return String(explicitType).toUpperCase();
  }
  const ext = String(fileName || "").split(".").pop().toUpperCase();
  return ext;
}

function listMaterials(courseId, user, repos) {
  assertCourseAccess(courseId, user, repos);
  const includeHidden = user.role === "Teacher" || user.role === "Admin";
  const materials = repos.materials.listByCourse(courseId, { includeHidden });
  const jobs = repos.jobs.listByCourse(courseId);

  return materials.map((mat) => {
    const latestJob = [...jobs]
      .reverse()
      .find((j) => j.materialId === mat.id && j.version === mat.version);
    return {
      ...mat,
      job: latestJob || null,
    };
  });
}

function createOrUpdateMaterial(
  {
    courseId,
    topicId,
    fileName,
    fileType,
    isScanned = false,
    contentText = "",
    buffer = null,
    pages = null,
    materialId = null,
    simulateFailure = false,
  },
  user,
  repos
) {
  const course = assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  if (!topicId || !findTopicInCourse(course, topicId)) {
    throw new ValidationError("A valid topicId belonging to this course is required");
  }
  if (!fileName || typeof fileName !== "string" || !fileName.trim()) {
    throw new ValidationError("fileName is required");
  }

  const resolvedType = inferFileType(fileName, fileType);
  if (!SUPPORTED_EXTENSIONS.has(resolvedType)) {
    throw new ValidationError("Unsupported file type. Allowed formats: PDF, DOCX, PPTX, TXT");
  }

  const now = new Date().toISOString();
  let material;

  if (materialId) {
    const existing = repos.materials.findById(materialId, courseId);
    if (!existing) {
      throw new NotFoundError("Material to update not found in this course");
    }
    const nextVersion = (Number(existing.version) || 1) + 1;
    const versions = [
      ...(existing.versions || []),
      { version: nextVersion, fileName: fileName.trim(), status: "PENDING", createdAt: now },
    ];
    material = repos.materials.update(materialId, courseId, {
      topicId,
      fileName: fileName.trim(),
      fileType: resolvedType,
      isScanned: Boolean(isScanned),
      version: nextVersion,
      status: "PENDING",
      active: true,
      approved: true,
      errorReason: null,
      updatedAt: now,
      versions,
    });
  } else {
    const id = `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    material = {
      id,
      courseId,
      topicId,
      fileName: fileName.trim(),
      fileType: resolvedType,
      isScanned: Boolean(isScanned),
      version: 1,
      status: "PENDING",
      active: true,
      approved: true,
      chunkCount: 0,
      errorReason: null,
      uploadedBy: user.id,
      createdAt: now,
      updatedAt: now,
      versions: [{ version: 1, fileName: fileName.trim(), status: "PENDING", createdAt: now }],
    };
    repos.materials.create(material);
  }

  const job = {
    id: `job-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    courseId,
    materialId: material.id,
    version: material.version,
    status: "PENDING",
    attempts: 0,
    maxRetries: 2,
    errorReason: null,
    payload: {
      materialId: material.id,
      courseId: material.courseId,
      topicId: material.topicId,
      fileName: material.fileName,
      fileType: material.fileType,
      isScanned: material.isScanned,
      version: material.version,
      contentText,
      buffer,
      pages,
      simulateFailure: Boolean(simulateFailure),
    },
    createdAt: now,
    updatedAt: now,
  };
  repos.jobs.create(job);

  repos.auditLogs.create({
    id: `aud-${Date.now()}`,
    action: materialId ? "MATERIAL_VERSION_UPLOADED" : "MATERIAL_UPLOADED",
    actorId: user.id,
    targetId: material.id,
    details: { courseId, topicId, version: material.version, fileType: resolvedType },
    createdAt: now,
  });

  return { material, job };
}

async function setMaterialVisibility({ courseId, materialId, active }, user, repos, indexAdapter) {
  assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  const material = repos.materials.findById(materialId, courseId);
  if (!material) {
    throw new NotFoundError("Material not found in this course");
  }

  const nextActive = Boolean(active);
  const updated = repos.materials.update(materialId, courseId, {
    active: nextActive,
    updatedAt: new Date().toISOString(),
  });

  if (!nextActive && indexAdapter && typeof indexAdapter.deactivateMaterialChunks === "function") {
    await indexAdapter.deactivateMaterialChunks({ materialId, courseId });
  }

  repos.auditLogs.create({
    id: `aud-${Date.now()}`,
    action: nextActive ? "MATERIAL_RESTORED" : "MATERIAL_HIDDEN",
    actorId: user.id,
    targetId: materialId,
    details: { courseId, active: nextActive },
    createdAt: new Date().toISOString(),
  });

  return updated;
}

function recordMaterialRead({ courseId, topicId }, user, repos) {
  const course = assertCourseAccess(courseId, user, repos);
  if (!topicId || !findTopicInCourse(course, topicId)) {
    throw new ValidationError("Invalid topicId for course");
  }
  const activity = {
    id: `act-${Date.now()}`,
    studentId: user.id,
    courseId,
    topicId,
    type: "MATERIAL_READ",
    createdAt: new Date().toISOString(),
  };
  repos.activities.create(activity);
  return activity;
}

module.exports = {
  listMaterials,
  createOrUpdateMaterial,
  setMaterialVisibility,
  recordMaterialRead,
};

