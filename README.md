# AI-Assisted Personalized Learning System

An engineering education platform implementing the **5-Layer Modular Architecture** (Lab 3 ADRs) and **Verified Layer 3 Domain Services** for FR-07 to FR-12 (Lab 4).

## Architecture Overview (ADR-001 to ADR-005)

- **Layer 1 (`client/`)**: React + Vite academic UI. Contains no business rules; communicates with Layer 2 exclusively via `client/src/services/`.
- **Layer 2 (`server/src/middleware/` & module controllers/routes)**: Request/file validation, centralized authentication & RBAC (`Student`, `Teacher`, `Admin`), course enrolment/ownership checks, and domain-error-to-JSON mapping.
- **Layer 3 (`server/src/modules/*/service`)**: Pure domain modules (`auth`, `courses`, `materials`, `ingestion`, `ai-assistant`, `quizzes`, `assessment`, `analytics`, `recommendations`, `feedback`, `notifications`). Never imports Express, `req`/`res`, DB drivers, or external AI/OCR SDKs.
- **Layer 4 (`server/src/config/adapters.js` & module adapters)**: Replaceable interfaces for persistence, course-scoped retrieval index, text extraction, OCR, LLM generation, and background job queue. Enforces `courseId` isolation on every query/retrieval (ADR-003).
- **Layer 5 (`server/src/config/store.js`)**: Zero-config local in-memory + JSON persistence store seeded with sample engineering courses, materials, and users.
- **Background Workers (`server/src/workers/`)**: Asynchronous material ingestion, OCR, indexing, and analytics refresh calling Layer 3 services only with tracked job state (`PENDING`, `INDEXED`, `FAILED`) and retry safety (ADR-002).

## Quick Start

1. Install dependencies:
   ```bash
   npm --prefix server install
   npm --prefix client install
   ```
2. Run both server (`http://localhost:5000`) and client (`http://localhost:5173`):
   ```bash
   npm run dev
   ```
3. Run Lab 4 & architecture verification tests:
   ```bash
   npm test
   ```

## Demo Accounts

- **Student**: `student@edu.local` / `Student@123` (also `ananya@edu.local` / `Student@123`)
- **Teacher**: `teacher@edu.local` / `Teacher@123`
- **Admin**: `admin@edu.local` / `Admin@123`

