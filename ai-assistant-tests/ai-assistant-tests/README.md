# AI Course Assistant: Test Suite (80 cases)

Automates the TDR test cases: **EP 36, BVA 8, EA 14, Decision Table 8, Security 6, Non-Functional 8**.
Every test title starts with its TDR ID (e.g. `TC-AI-EP-12`), so results map straight into the PDF.

## Run it (Node 18+, no installs)

```bash
npm test            # readable pass/fail list
npm run report      # also writes results.csv (ID, PASS/FAIL, failure note) for the TDR table
node --test --test-name-pattern="TC-AI-EA" # run one group
```

By default it runs against `mock-assistant.js`, a small reference implementation (all 80 pass).
That proves the suite works and shows what each rule means.

## Test YOUR project

1. Copy `real-adapter.template.js` to `real-adapter.js`.
2. Fill in each `TODO` so it calls your functions (upload, index, ask, approve, hide...).
3. Run `ASSISTANT_IMPL=./real-adapter.js npm test`
   (PowerShell: `$env:ASSISTANT_IMPL="./real-adapter.js"; npm test`).

Do not edit the tests to make them pass. If a test fails, it is a bug, a setup problem or a spec gap (see TDR section 11).

## Contract (what your adapter must return)

| Call | Returns |
|---|---|
| `uploadDocument({actor, courseId, file, approved})` | `{status: 'indexed'｜'rejected'｜'failed'｜'denied'｜'unauthenticated', indexed, docId, chunkCount, version, ocrApplied, message, error:{code,message}}` |
| `ask({actor, courseId, sessionId, question, requestId})` | `{status: 'answered'｜'out_of_scope'｜'insufficient_evidence'｜'clarification'｜'rejected'｜'denied'｜'unauthenticated'｜'refused'｜'unsupported_language'｜'error', answer, message, citations:[{file,page}], partial, missing, conflict}` |
| `listDocuments / getChunkCount / getSource / getContext` | document records `{docId,name,courseId,version,status,approved,hidden,active}`, a number, `{status:'ok'｜'denied'｜'not_found', text}`, `[{question,status}]` |
| `setApproval / hideDocument / deleteDocument / retryIndexing` | `{status:'ok'｜'denied'...}` |
| `classifyEvidence(score)` | `'sufficient'` or `'insufficient'` |
| `simulate.*` | switches that make OCR, network, AI provider or citation metadata fail |

`file` = `{name, detectedType, sizeBytes, pages: [text per page], scanned, corrupted, imageCount}`.
`actor` = `{userId, role: 'student'｜'teacher', token: 'valid'｜'expired'}`.

## Notes

- Tests check **behaviour** (status, citations, no leakage), not exact AI wording, so they work with a real LLM.
  The fixtures (`fixtures.js`) use short course text so retrieval is predictable; with embeddings, keep the questions as they are.
- Limits (20 MB, 200 pages, 1000 characters, threshold 0.60, 5 turns, 5 s) are the **assumed** values from the TDR. Change them in `real-adapter.js`.
- **TC-AI-NF-07**: the API half (readable error and notice messages) is automated. Keyboard-only use and screen-reader checks need a manual run or a UI tool such as Playwright.
- **TC-AI-NF-02 / NF-03** check concurrency with simple parallel calls, not a load test. For real load, use a tool such as k6 or autocannon.
- `canary` (SEC-04, EA-13): put a secret marker string in your system prompt and set it in the adapter. If `null`, those leak checks are skipped.

## Files

`ai-assistant.test.js` (80 tests) · `assistant.adapter.js` (switch mock/real) · `mock-assistant.js` (reference) · `real-adapter.template.js` (fill in) · `fixtures.js` (course data) · `run-report.js` (CSV report)
