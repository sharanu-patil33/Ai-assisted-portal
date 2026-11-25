// server/src/config/adapters.js
// Layer 4: Data Access & Integration Adapters (ADR-003, ADR-004)
// Wraps persistence, course-scoped search index, text extraction, OCR, LLM, and job queue.

const { defaultStore } = require("./store");

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "what", "which", "who", "whom", "how", "why", "when", "where", "can",
  "could", "would", "should", "do", "does", "did", "in", "on", "at",
  "to", "for", "of", "with", "by", "from", "and", "or", "not", "this",
  "that", "it", "its", "as", "into", "about", "explain", "me", "give",
  "please", "tell", "define", "difference", "between",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok.length > 1 && !STOP_WORDS.has(tok));
}

function splitTextIntoPages(text, charsPerPage = 900) {
  const cleaned = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!cleaned) return [];
  if (cleaned.includes("\f")) {
    return cleaned
      .split("\f")
      .map((part, idx) => ({ pageNumber: idx + 1, text: part.trim() }))
      .filter((p) => p.text.length > 0);
  }
  const paragraphs = cleaned.split(/\n{2,}/);
  const pages = [];
  let buffer = "";
  let pageNumber = 1;

  for (const para of paragraphs) {
    if (buffer.length + para.length > charsPerPage && buffer.trim().length > 0) {
      pages.push({ pageNumber, text: buffer.trim() });
      pageNumber += 1;
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }
  if (buffer.trim().length > 0) {
    pages.push({ pageNumber, text: buffer.trim() });
  }
  return pages;
}

function extractReadableTextFromBuffer(buffer, fileType) {
  if (!buffer) return "";
  const raw = Buffer.isBuffer(buffer) ? buffer.toString("latin1") : String(buffer);

  if (fileType === "TXT") {
    return Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
  }

  if (fileType === "DOCX" || fileType === "PPTX") {
    const utf8 = Buffer.isBuffer(buffer) ? buffer.toString("utf8") : String(buffer);
    const xmlMatches = utf8.match(/<(?:w:t|a:t)[^>]*>([^<]+)<\/(?:w:t|a:t)>/g);
    if (xmlMatches && xmlMatches.length > 0) {
      return xmlMatches
        .map((tag) => tag.replace(/<[^>]+>/g, ""))
        .join(" ")
        .trim();
    }
    return utf8.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
  }

  if (fileType === "PDF") {
    // Extract literal PDF text operators (e.g. (Hello world) Tj) if uncompressed, or readable ASCII lines
    const tjMatches = [];
    const regex = /\(([^()]{3,240})\)\s*Tj/g;
    let m;
    while ((m = regex.exec(raw)) !== null) {
      tjMatches.push(m[1].replace(/\\([()\\])/g, "$1"));
    }
    if (tjMatches.length > 0) {
      return tjMatches.join(" ").trim();
    }
    // Fallback: extract printable lines that look like natural text rather than PDF structural tokens
    const printable = raw
      .replace(/[^\x20-\x7E\n]/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.length > 12 &&
          !/^(%PDF|obj|endobj|stream|endstream|xref|trailer|startxref|<<|>>|\/\w+)/.test(l)
      );
    return printable.join("\n").trim();
  }

  return "";
}

function createAdapters(store = defaultStore) {
  // Layer 4: Text Extractor Adapter
  const textExtractor = {
    async extractPages(material) {
      if (material.simulateFailure) {
        throw new Error("Simulated text extraction error");
      }
      if (Array.isArray(material.pages) && material.pages.length > 0) {
        return material.pages;
      }
      if (typeof material.contentText === "string" && material.contentText.trim().length > 0) {
        return splitTextIntoPages(material.contentText);
      }
      if (material.buffer) {
        const extracted = extractReadableTextFromBuffer(material.buffer, material.fileType);
        return splitTextIntoPages(extracted);
      }
      return [];
    },
  };

  // Layer 4: OCR Adapter (for scanned PDFs)
  const ocrAdapter = {
    async extractPages(material) {
      if (material.simulateFailure) {
        throw new Error("Simulated OCR engine error");
      }
      if (Array.isArray(material.ocrPages) && material.ocrPages.length > 0) {
        return material.ocrPages;
      }
      if (Array.isArray(material.pages) && material.pages.length > 0) {
        return material.pages;
      }
      if (typeof material.contentText === "string" && material.contentText.trim().length > 0) {
        return splitTextIntoPages(material.contentText);
      }
      if (material.buffer) {
        const extracted = extractReadableTextFromBuffer(material.buffer, "PDF");
        if (extracted) {
          return splitTextIntoPages(extracted);
        }
      }
      return [];
    },
  };

  // Layer 4: Search Index Adapter
  const indexAdapter = {
    async upsertChunks(chunks) {
      if (!Array.isArray(chunks) || chunks.length === 0) return;
      const materialId = chunks[0].materialId;
      const courseId = chunks[0].courseId;
      const mat = store.data.materials.find(
        (m) => m.id === materialId && m.courseId === courseId
      );
      const isApproved = mat ? mat.approved !== false : true;

      // Deactivate older chunks for this material (ADR-002 atomic version switch)
      for (const existing of store.data.chunks) {
        if (existing.materialId === materialId && existing.courseId === courseId) {
          existing.active = false;
        }
      }

      chunks.forEach((chunk, idx) => {
        store.data.chunks.push({
          ...chunk,
          chunkId: `${chunk.materialId}_v${chunk.version}_p${chunk.pageNumber}_${idx}`,
          approved: isApproved,
        });
      });

      store.save();
    },

    async deactivateMaterialChunks({ materialId, courseId }) {
      for (const chunk of store.data.chunks) {
        if (chunk.materialId === materialId && chunk.courseId === courseId) {
          chunk.active = false;
        }
      }
      store.save();
    },

    async setMaterialApproval({ materialId, courseId, approved }) {
      for (const chunk of store.data.chunks) {
        if (chunk.materialId === materialId && chunk.courseId === courseId) {
          chunk.approved = Boolean(approved);
        }
      }
      store.save();
    },
  };

  // Layer 4: Course-Scoped Retrieval Adapter (ADR-003 enforced at data boundary)
  const retrievalAdapter = {
    async searchApprovedChunks({ courseId, query }) {
      if (!courseId) return [];
      const queryTokens = tokenize(query);
      const queryLower = String(query || "").toLowerCase().trim();

      // Mandatory courseId isolation filter at Layer 4 boundary
      const courseChunks = store.data.chunks.filter(
        (c) => c.courseId === courseId && c.active === true && c.approved === true
      );

      if (queryTokens.length === 0) {
        return courseChunks.map((c) => ({ ...c, score: 0.25 }));
      }

      const scored = courseChunks.map((chunk) => {
        const textLower = chunk.text.toLowerCase();
        const fileLower = (chunk.fileName || "").toLowerCase();
        const chunkTokens = new Set(tokenize(`${chunk.text} ${chunk.fileName}`));

        let matches = 0;
        for (const token of queryTokens) {
          if (chunkTokens.has(token)) {
            matches += 1;
          } else {
            for (const ct of chunkTokens) {
              if (ct.includes(token) || token.includes(ct)) {
                matches += 0.65;
                break;
              }
            }
          }
        }

        const coverage = matches / queryTokens.length;
        const phraseBonus = queryLower.length > 4 && textLower.includes(queryLower) ? 0.25 : 0;
        const fileBonus = queryTokens.some((t) => fileLower.includes(t)) ? 0.1 : 0;
        const score = Math.min(1, Number((coverage * 0.85 + phraseBonus + fileBonus).toFixed(4)));

        return {
          ...chunk,
          score,
        };
      });

      return scored.sort((a, b) => b.score - a.score);
    },
  };

  // Layer 4: Replaceable LLM Adapter (Grounded synthesis without external paid API keys)
  const llmAdapter = {
    async generateExplanation({ question, chunks, level }) {
      const sorted = [...chunks].sort((a, b) => (b.score || 0) - (a.score || 0));
      const selected = sorted.slice(0, 3);
      const usedChunkIds = selected.map((c) => c.chunkId);

      const primaryText = selected.map((c) => c.text.trim()).join(" ");
      const sentences = primaryText
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);

      let explanation;
      if (level === "simple") {
        const concise = sentences.slice(0, 2).join(" ");
        explanation = `In simple terms: ${concise} (Grounded in ${selected[0].fileName}, p. ${selected[0].pageNumber}).`;
      } else if (level === "deep") {
        const detailed = selected
          .map((c) => `• [${c.fileName}, Page ${c.pageNumber}] ${c.text.trim()}`)
          .join("\n");
        explanation = `Detailed analysis for "${question}":\n${detailed}`;
      } else {
        explanation = `${sentences.slice(0, 3).join(" ")}`;
      }

      const exampleSentence =
        sentences.find((s) => /example|such as|ideal for|avoids|using|extends/i.test(s)) ||
        `Refer to ${selected[0].fileName} (Page ${selected[0].pageNumber}) for the worked concept: "${sentences[0] || primaryText.slice(0, 120)}".`;

      return {
        explanation,
        example: exampleSentence,
        usedChunkIds,
      };
    },

    async generateFollowUp({ mode, message, history, chunks }) {
      const selected = chunks.slice(0, 3);
      const usedChunkIds = selected.map((c) => c.chunkId);
      const primary = selected[0];
      const sentences = selected
        .map((c) => c.text.trim())
        .join(" ")
        .split(/(?<=[.!?])\s+/)
        .filter(Boolean);

      let explanation = "";
      let example = null;

      if (mode === "simpler") {
        explanation = `Simpler breakdown: ${sentences[0] || primary.text} Think of it step-by-step directly from ${primary.fileName} (Page ${primary.pageNumber}).`;
        example = `Quick illustration: ${sentences[1] || primary.text}`;
      } else if (mode === "deeper") {
        explanation = `Deeper technical explanation:\n${selected
          .map((c) => `• (${c.fileName}, p. ${c.pageNumber}) ${c.text}`)
          .join("\n")}`;
        example = `Applied context from ${primary.fileName}: ${sentences[sentences.length - 1] || primary.text}`;
      } else if (mode === "another_example") {
        const alt = selected[1] || primary;
        explanation = `Here is another grounded perspective from ${alt.fileName} (Page ${alt.pageNumber}): ${alt.text}`;
        example = `Example scenario: ${alt.text}`;
      } else {
        explanation = `Regarding "${message}": ${sentences.slice(0, 3).join(" ")}`;
        example = sentences[1] ? `Supporting detail: ${sentences[1]}` : null;
      }

      return {
        explanation,
        example,
        usedChunkIds,
      };
    },

    async generateMcqs({ topicTitle, chunks, count = 3, difficulty = "medium", excludePrompts = [] }) {
      const excluded = new Set(excludePrompts.map((p) => p.toLowerCase()));
      const generated = [];

      const templates = chunks.map((chunk) => {
        const sentences = chunk.text
          .split(/(?<=[.!?])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 20);
        return { chunk, sentences };
      });

      let idx = 0;
      for (const { chunk, sentences } of templates) {
        for (const sentence of sentences) {
          if (generated.length >= count) break;
          const prompt = `Based on "${topicTitle}" (${chunk.fileName}, p. ${chunk.pageNumber}), which statement is accurate?`;
          const specificPrompt =
            idx === 0
              ? prompt
              : `In ${topicTitle} (Ref: ${chunk.fileName}, p. ${chunk.pageNumber}, Q${idx + 1}), which concept applies directly?`;
          idx += 1;

          if (excluded.has(specificPrompt.toLowerCase())) continue;

          generated.push({
            prompt: specificPrompt,
            options: [
              sentence,
              `It bypasses ${topicTitle} rules completely without validation`,
              `It is strictly prohibited in all ${topicTitle} implementations`,
              `It only applies to unindexed external modules`,
            ],
            correctIndex: 0,
            explanation: `Verified from ${chunk.fileName} (Page ${chunk.pageNumber}): ${sentence}`,
            difficulty,
            sourceFile: chunk.fileName,
            sourcePage: chunk.pageNumber,
          });
        }
        if (generated.length >= count) break;
      }

      return generated;
    },
  };

  // Layer 4: Course-Scoped Persistence Repositories
  const repos = {
    users: {
      findByEmail(email) {
        return store.data.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase()) || null;
      },
      findById(id) {
        return store.data.users.find((u) => u.id === id) || null;
      },
      listAll() {
        return store.data.users.map(({ passwordHash, ...safe }) => safe);
      },
      create(user) {
        store.data.users.push(user);
        store.save();
        return user;
      },
      update(id, patch) {
        const user = store.data.users.find((u) => u.id === id);
        if (!user) return null;
        Object.assign(user, patch);
        store.save();
        return user;
      },
    },
    courses: {
      listAll() {
        return store.data.courses;
      },
      findById(courseId) {
        return store.data.courses.find((c) => c.id === courseId) || null;
      },
      findByCode(code) {
        return store.data.courses.find((c) => c.code.toUpperCase() === String(code).toUpperCase()) || null;
      },
      listByTeacher(teacherId) {
        return store.data.courses.filter((c) => c.teacherId === teacherId);
      },
      create(course) {
        store.data.courses.push(course);
        store.save();
        return course;
      },
      update(courseId, patch) {
        const course = store.data.courses.find((c) => c.id === courseId);
        if (!course) return null;
        Object.assign(course, patch);
        store.save();
        return course;
      },
    },
    enrolments: {
      listByStudent(studentId) {
        return store.data.enrolments.filter((e) => e.studentId === studentId);
      },
      listByCourse(courseId) {
        return store.data.enrolments.filter((e) => e.courseId === courseId);
      },
      isEnrolled(courseId, studentId) {
        return store.data.enrolments.some(
          (e) => e.courseId === courseId && e.studentId === studentId
        );
      },
      create(enrolment) {
        store.data.enrolments.push(enrolment);
        store.save();
        return enrolment;
      },
    },
    materials: {
      listByCourse(courseId, { includeHidden = false } = {}) {
        return store.data.materials.filter(
          (m) => m.courseId === courseId && (includeHidden || m.active === true)
        );
      },
      findById(materialId, courseId = null) {
        return (
          store.data.materials.find(
            (m) => m.id === materialId && (!courseId || m.courseId === courseId)
          ) || null
        );
      },
      create(material) {
        store.data.materials.push(material);
        store.save();
        return material;
      },
      update(materialId, courseId, patch) {
        const mat = store.data.materials.find(
          (m) => m.id === materialId && m.courseId === courseId
        );
        if (!mat) return null;
        Object.assign(mat, patch);
        store.save();
        return mat;
      },
    },
    jobs: {
      listByCourse(courseId) {
        return store.data.jobs.filter((j) => j.courseId === courseId);
      },
      findById(jobId) {
        return store.data.jobs.find((j) => j.id === jobId) || null;
      },
      create(job) {
        store.data.jobs.push(job);
        store.save();
        return job;
      },
      update(jobId, patch) {
        const job = store.data.jobs.find((j) => j.id === jobId);
        if (!job) return null;
        Object.assign(job, patch);
        store.save();
        return job;
      },
    },
    conversations: {
      find(courseId, studentId) {
        return (
          store.data.conversations.find(
            (c) => c.courseId === courseId && c.studentId === studentId
          ) || null
        );
      },
      upsert(courseId, studentId, messages) {
        let conv = store.data.conversations.find(
          (c) => c.courseId === courseId && c.studentId === studentId
        );
        if (!conv) {
          conv = {
            id: `conv-${Date.now()}`,
            courseId,
            studentId,
            messages,
            updatedAt: new Date().toISOString(),
          };
          store.data.conversations.push(conv);
        } else {
          conv.messages = messages;
          conv.updatedAt = new Date().toISOString();
        }
        store.save();
        return conv;
      },
    },
    questions: {
      listByCourse(courseId, { topicId = null, status = null } = {}) {
        return store.data.questions.filter(
          (q) =>
            q.courseId === courseId &&
            (!topicId || q.topicId === topicId) &&
            (!status || q.status === status)
        );
      },
      findById(questionId, courseId = null) {
        return (
          store.data.questions.find(
            (q) => q.id === questionId && (!courseId || q.courseId === courseId)
          ) || null
        );
      },
      create(question) {
        store.data.questions.push(question);
        store.save();
        return question;
      },
      update(questionId, courseId, patch) {
        const q = store.data.questions.find(
          (item) => item.id === questionId && item.courseId === courseId
        );
        if (!q) return null;
        Object.assign(q, patch);
        store.save();
        return q;
      },
    },
    attempts: {
      listByStudentAndCourse(studentId, courseId) {
        return store.data.quizAttempts.filter(
          (a) => a.studentId === studentId && a.courseId === courseId
        );
      },
      listByCourse(courseId) {
        return store.data.quizAttempts.filter((a) => a.courseId === courseId);
      },
      findById(attemptId) {
        return store.data.quizAttempts.find((a) => a.id === attemptId) || null;
      },
      create(attempt) {
        store.data.quizAttempts.push(attempt);
        store.save();
        return attempt;
      },
    },
    activities: {
      listByStudentAndCourse(studentId, courseId) {
        return store.data.activities.filter(
          (a) => a.studentId === studentId && a.courseId === courseId
        );
      },
      listByCourse(courseId) {
        return store.data.activities.filter((a) => a.courseId === courseId);
      },
      create(activity) {
        store.data.activities.push(activity);
        store.save();
        return activity;
      },
    },
    feedback: {
      listByCourse(courseId) {
        return store.data.feedback.filter((f) => f.courseId === courseId);
      },
      findById(feedbackId, courseId = null) {
        return (
          store.data.feedback.find(
            (f) => f.id === feedbackId && (!courseId || f.courseId === courseId)
          ) || null
        );
      },
      create(item) {
        store.data.feedback.push(item);
        store.save();
        return item;
      },
      update(feedbackId, courseId, patch) {
        const item = store.data.feedback.find(
          (f) => f.id === feedbackId && f.courseId === courseId
        );
        if (!item) return null;
        Object.assign(item, patch);
        store.save();
        return item;
      },
    },
    notifications: {
      listByUser(userId) {
        return store.data.notifications.filter((n) => n.userId === userId);
      },
      create(notification) {
        store.data.notifications.push(notification);
        store.save();
        return notification;
      },
      markRead(notificationId, userId) {
        const n = store.data.notifications.find(
          (item) => item.id === notificationId && item.userId === userId
        );
        if (!n) return null;
        n.read = true;
        store.save();
        return n;
      },
    },
    auditLogs: {
      list(limit = 50) {
        return store.data.auditLogs.slice(-limit).reverse();
      },
      create(entry) {
        store.data.auditLogs.push(entry);
        store.save();
        return entry;
      },
    },
    chunks: {
      listByCourse(courseId, { activeOnly = true } = {}) {
        return store.data.chunks.filter(
          (c) => c.courseId === courseId && (!activeOnly || (c.active === true && c.approved === true))
        );
      },
    },
  };

  return {
    textExtractor,
    ocrAdapter,
    indexAdapter,
    retrievalAdapter,
    llmAdapter,
    repos,
    store,
  };
}

module.exports = {
  createAdapters,
  splitTextIntoPages,
  tokenize,
};

