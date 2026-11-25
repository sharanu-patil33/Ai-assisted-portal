// server/src/modules/ingestion/ingestionService.js

const SUPPORTED_FILE_TYPES = new Set(["PDF", "DOCX", "PPTX", "TXT"]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function ingestAndIndexMaterial(material, adapters) {
  if (!material || typeof material !== "object") {
    throw new TypeError("material must be a valid object");
  }
  if (!adapters || typeof adapters !== "object") {
    throw new TypeError("adapters must be a valid object");
  }

  // Rule 1: Validate required fields and supported fileType
  const requiredFields = ["materialId", "courseId", "topicId", "fileName", "version"];
  for (const field of requiredFields) {
    const value = material[field];
    const valid =
      field === "version"
        ? (typeof value === "number" && Number.isFinite(value)) || isNonEmptyString(value)
        : isNonEmptyString(value);
    if (!valid) {
      return {
        indexed: false,
        status: "FAILED",
        chunkCount: 0,
        reason: `Missing or invalid required field: ${field}`,
      };
    }
  }

  if (!SUPPORTED_FILE_TYPES.has(material.fileType)) {
    return {
      indexed: false,
      status: "FAILED",
      chunkCount: 0,
      reason: `Unsupported file type: ${material.fileType}`,
    };
  }

  // Rule 2 & Rule 3: Extract pages (OCR for scanned PDFs, text extractor otherwise)
  let pages;
  try {
    if (material.isScanned === true && material.fileType === "PDF") {
      if (!adapters.ocrAdapter || typeof adapters.ocrAdapter.extractPages !== "function") {
        throw new TypeError("ocrAdapter.extractPages is required for scanned PDFs");
      }
      pages = await adapters.ocrAdapter.extractPages(material);
    } else {
      if (!adapters.textExtractor || typeof adapters.textExtractor.extractPages !== "function") {
        throw new TypeError("textExtractor.extractPages is required");
      }
      pages = await adapters.textExtractor.extractPages(material);
    }
  } catch (err) {
    return {
      indexed: false,
      status: "FAILED",
      chunkCount: 0,
      reason: `Extraction failed: ${err && err.message ? err.message : "Unknown error"}`,
    };
  }

  if (!Array.isArray(pages) || pages.length === 0) {
    return {
      indexed: false,
      status: "FAILED",
      chunkCount: 0,
      reason: "No pages extracted from uploaded material",
    };
  }

  // Rule 4: Tag every chunk with required metadata and index via indexAdapter
  const chunks = pages
    .filter((page) => page && isNonEmptyString(page.text))
    .map((page, idx) => ({
      courseId: material.courseId,
      topicId: material.topicId,
      materialId: material.materialId,
      fileName: material.fileName,
      version: material.version,
      pageNumber: Number.isInteger(page.pageNumber) && page.pageNumber > 0 ? page.pageNumber : idx + 1,
      active: true,
      text: page.text.trim(),
    }));

  if (chunks.length === 0) {
    return {
      indexed: false,
      status: "FAILED",
      chunkCount: 0,
      reason: "Extracted pages contained no indexable text",
    };
  }

  if (!adapters.indexAdapter || typeof adapters.indexAdapter.upsertChunks !== "function") {
    throw new TypeError("indexAdapter.upsertChunks is required");
  }

  try {
    await adapters.indexAdapter.upsertChunks(chunks);
  } catch (err) {
    return {
      indexed: false,
      status: "FAILED",
      chunkCount: 0,
      reason: `Indexing failed: ${err && err.message ? err.message : "Unknown error"}`,
    };
  }

  return {
    indexed: true,
    status: "INDEXED",
    chunkCount: chunks.length,
    reason: "Material indexed successfully",
  };
}

module.exports = { ingestAndIndexMaterial };

