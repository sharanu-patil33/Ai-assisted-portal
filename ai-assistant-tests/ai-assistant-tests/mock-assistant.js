'use strict';
/**
 * Reference implementation of the AI Course Assistant contract (no real AI, no network).
 * It exists so the test suite runs out of the box and so you can see what each rule means.
 * Replace it with your own code through assistant.adapter.js (see README.md).
 */

const DEFAULT_CONFIG = {
  maxFileBytes: 20 * 1024 * 1024,
  maxPages: 200,
  minQuestionChars: 1,
  maxQuestionChars: 1000,
  threshold: 0.6,
  contextTurns: 5,
  responseTimeTargetMs: 5000,
  canary: 'CANARY-7F3A', // secret marker placed in the (hidden) system prompt
};

const EXT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
};

const STOP = new Set((
  'a an the is are was were be been being of in on at to for from by with and or but not nor so if then than as ' +
  'it its they them those these this that there here i you we he she my your our me us do does did done can could ' +
  'should would will shall may might must please tell about explain describe define give show used use using ' +
  'what which who whom whose when where why how also any some all each every other another more most very just only ' +
  'into onto over under such compare comparison differ difference differs between allowed able simple simpler ' +
  'easier easy words word terms detail details deeper depth elaborate example examples again bit little'
).split(/\s+/));

const INJECTION_Q = /(ignore|disregard|forget)\s+(all\s+|your\s+|the\s+|any\s+|previous\s+)*(rules|instructions|restrictions)|system prompt|reveal .*prompt/i;
const INJECTION_DOC = /(ignore|disregard)\s+(all\s+|previous\s+|the\s+)*(rules|instructions)|^\s*system:|reveal .*(prompt|canary)/i;
const MODE = [
  ['simpler', /simpl|easier|eli5/i],
  ['deeper', /deeper|more detail|in depth|in-depth|elaborate/i],
  ['example', /example/i],
];

const stem = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const tokenize = (text) => [...new Set(
  (String(text).toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length >= 2 && !STOP.has(w)).map(stem)
)];
const sentences = (t) => t.split(/(?<=\.)\s+/).filter(Boolean);
const hasNonLatinLetters = (q) => [...q].some((ch) => /\p{L}/u.test(ch) && !/\p{Script=Latin}/u.test(ch));
const tick = () => new Promise((r) => setImmediate(r));

function createMockAssistant(overrides = {}) {
  const config = { ...DEFAULT_CONFIG, ...overrides };
  const docs = new Map();
  const chunks = [];
  const enrollments = new Map();
  const sessions = new Map();
  const secrets = new Map();
  const flags = { ocrFailure: false, offline: false, provider: null, dropMetadata: false };
  let seq = 0;

  const res = (status, message, extra = {}) => ({ status, message, citations: [], ...extra });
  const rejected = (code, message) => ({ status: 'rejected', indexed: false, message, error: { code, message }, citations: [] });
  const authFail = (actor) =>
    !actor || actor.token !== 'valid' ? res('unauthenticated', 'Your session has expired. Please sign in again.') : null;
  const isTeacher = (a) => a.role === 'teacher';
  const canAccess = (a, courseId) => isTeacher(a) || (enrollments.get(a.userId) || new Set()).has(courseId);
  const denied = (m) => res('denied', m || 'You do not have permission to do that.');

  const isActive = (d) => d && !d.deleted && !d.hidden && d.approved && d.active && d.status === 'indexed';
  const activeChunks = (courseId) => chunks.filter((c) => {
    const d = docs.get(c.docId);
    return d && d.courseId === courseId && isActive(d);
  });

  function buildChunks(doc) {
    for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].docId === doc.docId) chunks.splice(i, 1);
    doc.pages.forEach((text, i) => {
      if (String(text).trim()) chunks.push({ docId: doc.docId, file: doc.name, page: i + 1, version: doc.version, text, tokens: new Set(tokenize(text)) });
    });
  }

  const api = {
    config,
    simulate: {
      ocrFailure: (v) => { flags.ocrFailure = !!v; },
      offline: (v) => { flags.offline = !!v; },
      providerFailure: (v) => { flags.provider = v || null; },
      dropMetadata: (v) => { flags.dropMetadata = !!v; },
    },
    enroll(userId, courseId) {
      if (!enrollments.has(userId)) enrollments.set(userId, new Set());
      enrollments.get(userId).add(courseId);
    },
    seedUserData(userId, secret) { secrets.set(userId, secret); },
    classifyEvidence: (score) => (score >= config.threshold - 1e-9 ? 'sufficient' : 'insufficient'),

    async uploadDocument({ actor, courseId, file, approved = true }) {
      await tick();
      const a = authFail(actor); if (a) return a;
      if (!isTeacher(actor)) return denied('Only teachers can upload course material.');
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!EXT_TYPES[ext] || file.detectedType !== EXT_TYPES[ext]) return rejected('INVALID_TYPE', 'Unsupported or mismatched file type.');
      if (file.sizeBytes > config.maxFileBytes) return rejected('FILE_TOO_LARGE', 'File exceeds the maximum allowed size.');
      if (file.pages.length > config.maxPages) return rejected('TOO_MANY_PAGES', 'Document exceeds the maximum page count.');
      if (file.corrupted) return rejected('CORRUPTED', 'The file is corrupted or unreadable.');
      if (!file.scanned && file.pages.every((p) => !String(p).trim())) return rejected('EMPTY_DOCUMENT', 'The document has no usable content.');

      const hash = JSON.stringify(file.pages);
      let doc = [...docs.values()].find((d) => d.courseId === courseId && d.name === file.name && d.active && !d.deleted);
      if (doc && doc.hash === hash) {
        // Same file again: idempotent, no duplicate chunks.
      } else {
        const version = doc ? doc.version + 1 : 1;
        if (doc) doc.active = false; // older version is superseded
        doc = { docId: `doc-${++seq}`, courseId, name: file.name, version, approved, hidden: false, deleted: false, active: true,
          status: 'pending', pages: file.pages, scanned: !!file.scanned, hash };
        docs.set(doc.docId, doc);
      }
      await tick(); await tick(); await tick(); // indexing takes a moment
      if (doc.scanned && flags.ocrFailure) {
        doc.status = 'failed'; doc.error = { code: 'OCR_FAILED', message: 'OCR service failed. Indexing can be retried.' };
        return { status: 'failed', indexed: false, docId: doc.docId, message: doc.error.message, error: doc.error, citations: [] };
      }
      doc.status = 'indexed'; doc.error = undefined;
      buildChunks(doc);
      return { status: 'indexed', indexed: true, docId: doc.docId, version: doc.version, ocrApplied: doc.scanned,
        chunkCount: chunks.filter((c) => c.docId === doc.docId).length };
    },

    async retryIndexing({ actor, docId }) {
      await tick();
      const a = authFail(actor); if (a) return a;
      if (!isTeacher(actor)) return denied();
      const doc = docs.get(docId);
      if (!doc) return res('not_found', 'Document not found.');
      if (doc.scanned && flags.ocrFailure) return { status: 'failed', indexed: false, docId, message: 'OCR service failed.', citations: [] };
      doc.status = 'indexed'; doc.error = undefined; buildChunks(doc);
      return { status: 'indexed', indexed: true, docId, chunkCount: chunks.filter((c) => c.docId === docId).length };
    },

    async setApproval({ actor, docId, approved }) {
      const a = authFail(actor); if (a) return a;
      if (!isTeacher(actor)) return denied();
      const d = docs.get(docId); if (!d) return res('not_found', 'Document not found.');
      d.approved = !!approved; return { status: 'ok' };
    },
    async hideDocument({ actor, docId }) {
      const a = authFail(actor); if (a) return a;
      if (!isTeacher(actor)) return denied();
      const d = docs.get(docId); if (!d) return res('not_found', 'Document not found.');
      d.hidden = true; return { status: 'ok' };
    },
    async deleteDocument({ actor, docId }) {
      const a = authFail(actor); if (a) return a;
      if (!isTeacher(actor)) return denied();
      const d = docs.get(docId); if (!d) return res('not_found', 'Document not found.');
      d.deleted = true;
      for (let i = chunks.length - 1; i >= 0; i--) if (chunks[i].docId === docId) chunks.splice(i, 1);
      return { status: 'ok' };
    },
    async listDocuments({ actor, courseId }) {
      const a = authFail(actor); if (a) return a;
      if (!canAccess(actor, courseId)) return denied();
      return [...docs.values()].filter((d) => d.courseId === courseId && !d.deleted).map((d) => ({
        docId: d.docId, name: d.name, courseId: d.courseId, version: d.version, status: d.status,
        approved: d.approved, hidden: d.hidden, active: d.active, error: d.error,
      }));
    },
    async getChunkCount({ docId }) { return chunks.filter((c) => c.docId === docId).length; },

    async getSource({ actor, courseId, file, page }) {
      const a = authFail(actor); if (a) return a;
      if (!canAccess(actor, courseId)) return denied('You do not have access to this course.');
      const c = activeChunks(courseId).find((x) => x.file === file && x.page === page);
      return c ? { status: 'ok', text: c.text } : res('not_found', 'Source not available.');
    },

    async getContext({ actor, sessionId }) {
      const s = sessions.get(`${actor.userId}:${sessionId}`);
      return s ? s.turns.map((t) => ({ question: t.question, status: t.status })) : [];
    },

    async ask({ actor, courseId, sessionId = 'default', question, requestId }) {
      await tick();
      const a = authFail(actor); if (a) return a;
      if (typeof question !== 'string' || !question.trim()) return rejected('EMPTY_QUESTION', 'Please enter a question.');
      if (question.length < config.minQuestionChars) return rejected('QUESTION_TOO_SHORT', 'Your question is too short.');
      if (question.length > config.maxQuestionChars) return rejected('QUESTION_TOO_LONG', `Questions can be at most ${config.maxQuestionChars} characters.`);
      if (!canAccess(actor, courseId)) return denied('You are not enrolled in this course.');
      if (flags.offline) return { status: 'error', message: 'Network unavailable. Your question was not sent. Please check your connection and retry.', error: { code: 'NETWORK_UNAVAILABLE' }, citations: [] };

      const key = `${actor.userId}:${sessionId}`;
      let s = sessions.get(key);
      if (!s) { s = { courseId, turns: [], requests: new Map() }; sessions.set(key, s); }
      if (requestId && s.requests.has(requestId)) return s.requests.get(requestId);
      if (s.courseId !== courseId) { s.courseId = courseId; s.turns = []; } // switching course clears context

      const finish = (result, turn) => {
        if (turn) { s.turns.push(turn); s.turns = s.turns.slice(-config.contextTurns); }
        if (requestId) s.requests.set(requestId, result);
        return result;
      };
      const lastAnswered = [...s.turns].reverse().find((t) => t.status === 'answered');

      if (INJECTION_Q.test(question)) return finish(res('refused', 'I can only answer from the approved course material and cannot change my rules.'), { question, status: 'refused' });

      const qTokens = tokenize(question);
      if (qTokens.length === 0 && hasNonLatinLetters(question)) {
        return finish(res('unsupported_language', 'Sorry, this language is not supported yet. Please ask in English.'), { question, status: 'unsupported_language' });
      }

      // Explanation modes (simpler / deeper / another example) re-use the previous answer's sources.
      const mode = qTokens.length === 0 && MODE.find(([, re]) => re.test(question));
      if (mode) {
        if (!lastAnswered) return finish(res('clarification', 'Which answer would you like me to explain? Please ask a question first.'), { question, status: 'clarification' });
        const full = lastAnswered.refs.map((r) => clean(r.text).join(' ')).join(' ');
        const first = lastAnswered.answer.split(/(?<=\.)\s+/)[0];
        const answer = mode[0] === 'simpler' ? `In simple terms: ${first}`
          : mode[0] === 'deeper' ? `In more detail: ${full}`
          : `Example based on the course material: ${first}`;
        return finish({ status: 'answered', message: null, answer, citations: lastAnswered.citations, partial: false, conflict: false },
          { ...lastAnswered, question, answer });
      }

      let tokens = qTokens;
      if (/\b(it|its|they|them|those|these)\b/i.test(question)) {
        if (!lastAnswered) return finish(res('clarification', 'I am not sure what you are referring to. Could you name the topic?'), { question, status: 'clarification' });
        tokens = [...new Set([...qTokens, ...lastAnswered.tokens])];
      }
      if (tokens.length === 0) return finish(res('clarification', 'Could you rephrase your question with more detail?'), { question, status: 'clarification' });

      // ---- retrieval ----
      const scored = activeChunks(courseId)
        .map((c) => ({ c, hits: tokens.filter((t) => c.tokens.has(t)) }))
        .filter((x) => x.hits.length)
        .sort((x, y) => y.hits.length - x.hits.length || x.c.file.localeCompare(y.c.file) || x.c.page - y.c.page);

      let selected = []; const covered = new Set();
      for (const x of scored) {
        if (x.hits.some((t) => !covered.has(t))) { selected.push(x); x.hits.forEach((t) => covered.add(t)); }
        if (covered.size === tokens.length) break;
      }
      // conflict: two different active documents each answer the whole question with different text
      const full = scored.filter((x) => x.hits.length === tokens.length);
      const bestPerDoc = new Map(); full.forEach((x) => { if (!bestPerDoc.has(x.c.docId)) bestPerDoc.set(x.c.docId, x); });
      const conflict = bestPerDoc.size >= 2 && new Set([...bestPerDoc.values()].map((x) => x.c.text)).size >= 2;
      if (conflict) { selected = [...bestPerDoc.values()]; selected.forEach((x) => x.hits.forEach((t) => covered.add(t))); }

      const coverage = covered.size / tokens.length;
      if (selected.length && flags.dropMetadata) {
        return finish(res('insufficient_evidence', 'Source details are unavailable, so I cannot give a verified answer.'), { question, status: 'insufficient_evidence' });
      }
      if (coverage === 0) return finish(res('out_of_scope', 'This question is outside the approved material for this course.'), { question, status: 'out_of_scope' });
      if (api.classifyEvidence(coverage) === 'insufficient') {
        return finish(res('insufficient_evidence', 'The course material does not contain enough evidence to answer this reliably.'), { question, status: 'insufficient_evidence' });
      }

      if (flags.provider) {
        return { status: 'error', message: 'The AI service timed out. Please try again.', error: { code: 'PROVIDER_TIMEOUT' }, citations: [] };
      }

      const qSet = new Set(tokens);
      const answer = selected.map((x) => {
        const sents = clean(x.c.text);
        const picked = sents.filter((st) => tokenize(st).some((t) => qSet.has(t)));
        return (picked.length ? picked : sents.slice(0, 1)).join(' ');
      }).join(' ');
      const citations = selected.map((x) => ({ file: x.c.file, page: x.c.page, version: x.c.version }))
        .sort((p, q) => p.file.localeCompare(q.file) || p.page - q.page);
      const result = { status: 'answered', message: null, answer, citations, partial: coverage < 1,
        missing: tokens.filter((t) => !covered.has(t)), conflict };
      return finish(result, { question, status: 'answered', tokens, answer, citations, refs: selected.map((x) => x.c) });
    },
  };

  // remove sentences that look like instructions hidden inside documents
  function clean(text) { return sentences(text).filter((s) => !INJECTION_DOC.test(s)); }
  return api;
}

module.exports = { createMockAssistant, DEFAULT_CONFIG };
