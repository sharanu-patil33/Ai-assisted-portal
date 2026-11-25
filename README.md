# AI-Assisted Personalized Learning System for Engineering Courses

## 1. Project Overview

The **AI-Assisted Personalized Learning System** is designed to help engineering students understand their course subjects through AI-generated explanations based only on uploaded course materials.

The system allows students to access learning materials, ask questions in natural language, receive simplified explanations, practice quizzes, track their learning progress and identify areas that need improvement.

Unlike general AI chatbots, this system focuses on providing answers grounded in approved course materials, along with relevant source file and page references.

## 2. Problem Statement

Engineering students often find it difficult to understand complex concepts using traditional learning materials. They may have to search through multiple PDFs, presentations and notes to find answers to their questions.

Existing general-purpose AI tools may also provide information beyond the prescribed syllabus, making it difficult for students to identify whether an answer is relevant to their course.

This project aims to provide a personalized learning environment where students can learn, practice and track their progress using their approved course materials.

## 3. Objectives

- Provide AI-generated explanations based on uploaded course materials.
- Allow students to ask questions using natural language.
- Extract and index content from different document formats.
- Display source file names and page references with AI answers.
- Generate quizzes to improve conceptual understanding.
- Analyse student performance and identify learning gaps.
- Recommend relevant topics based on student performance.
- Provide dashboards for students and teachers.

## 4. Key Features

### AI-Assisted Learning
- Ask questions related to uploaded course materials.
- Generate explanations using approved learning resources.
- Simplify complex concepts.
- Provide detailed explanations and relevant examples.
- Support follow-up questions with conversation context.

### Course Material Management
- Upload PDF, DOCX, PPTX and TXT documents.
- Extract text from uploaded documents.
- Support OCR for scanned PDF materials.
- Organize materials based on courses, units and topics.
- Manage updated document versions.

### Source-Based Answering
- Display source document names.
- Provide relevant PDF page references.
- Avoid generating unsupported answers.
- Identify questions outside the available course material.
- Prevent retrieval across unauthorized courses.

### Quiz and Assessment
- Generate quizzes based on course materials.
- Allow students to attempt quizzes.
- Evaluate submitted answers.
- Display scores and feedback.
- Support adaptive quiz difficulty.

### Personalized Learning
- Track student learning activities.
- Analyse topic-wise performance.
- Identify weak and strong areas.
- Recommend topics for improvement.
- Monitor learning progress through dashboards.

### Student and Teacher Dashboards
- Student learning progress.
- Quiz performance and mastery tracking.
- Course and topic management.
- Teacher monitoring and review.
- Learning activity reports.

## 5. Functional Modules

The system is organized into the following major modules:

| Module | Responsibility |
|---|---|
| User Management | Registration, login and role-based access |
| Course Management | Courses, units, topics and enrollment |
| Material Management | Upload, update and delete learning materials |
| Document Processing | Text extraction, OCR and indexing |
| AI Learning Assistant | Question answering and grounded explanations |
| Source Reference | File and page-level citations |
| Quiz Management | Quiz generation and question management |
| Assessment | Quiz attempts, grading and feedback |
| Learning Analytics | Performance and mastery tracking |
| Recommendation Engine | Personalized topic recommendations |
| Dashboard | Student and teacher progress visualization |
| Feedback and Review | Student feedback and teacher review |

## 6. AI-Assisted Learning Workflow

1. Teacher uploads approved course materials.
2. System extracts text from the uploaded documents.
3. Extracted content is divided into meaningful sections and indexed.
4. Student selects a course and asks a question.
5. System retrieves relevant content from the selected course.
6. AI generates an explanation using the retrieved course material.
7. Answer is displayed with source file and page references.
8. Student can request simpler explanations, detailed explanations or follow-up answers.

**Important:** AI-generated explanations are restricted to the uploaded approved course material.

## 7. System Architecture

The project follows a modular architecture with the following layers:

- **Presentation Layer:** Student and teacher interfaces.
- **Authentication Layer:** User identity and access management.
- **Course Management Layer:** Courses, enrollment, units and topics.
- **Document Processing Layer:** Extraction, OCR and indexing.
- **AI Processing Layer:** Retrieval, question answering and explanation generation.
- **Assessment Layer:** Quiz generation, attempts and grading.
- **Analytics Layer:** Performance analysis and learning-gap identification.
- **Recommendation Layer:** Personalized learning suggestions.
- **Reporting Layer:** Dashboards, reports and feedback.

## 8. Technology Stack

The exact technologies should be updated according to the tools and frameworks used in the final implementation.

| Component | Technology |
|---|---|
| Frontend | To be specified |
| Backend | To be specified |
| Database | To be specified |
| AI / LLM | To be specified |
| Document Processing | To be specified |
| OCR | To be specified |
| Vector Search / Indexing | To be specified |
| Testing | To be specified |
| Version Control | Git and GitHub |

## 9. Testing Approach

The system is tested using three major software testing techniques:

### Equivalence Partitioning (EP)
Tests valid and invalid input categories to verify the expected system behaviour.

### Boundary Value Analysis (BVA)
Tests minimum, maximum and values around configured limits.

### Error Analysis (EA)
Tests unexpected inputs, processing failures, security issues and recovery scenarios.

For the AI-Assisted Learning and Question Answering requirements (FR-07 to FR-12), the prepared test suite contains:

| Testing Technique | Test Cases |
|---|---:|
| Equivalence Partitioning | 36 |
| Boundary Value Analysis | 8 |
| Error Analysis | 14 |
| **Total** | **58** |

Testing also includes integration and regression testing to verify that different modules work correctly together.

## 10. Project Structure

The following is a suggested repository organization. Update folder and file names to match the actual implementation.

```text
AI-Assisted-Learning-System/
│
├── frontend/
│
├── backend/
│
├── tests/
│   ├── test_document_processing.py
│   ├── test_question_answering.py
│   ├── test_ai_responses.py
│   └── test_citations.py
│
├── documentation/
│   ├── SRS/
│   ├── Test-Cases/
│   └── Reports/
│
├── README.md
└── requirements.txt
```

## 11. Installation and Execution

Clone the repository:

```bash
git clone <repository-url>
cd AI-Assisted-Learning-System
```

Install the required dependencies according to the project's backend and frontend configuration.

For a Python backend with a requirements file:

```bash
pip install -r requirements.txt
```

Configure the required environment variables and database connection.

Start the backend and frontend using the commands defined in their respective project configurations.

## 12. Team Collaboration

The project follows a collaborative development and testing approach.

- Developers are responsible for implementing assigned functional modules.
- Testers prepare test cases and automated test scripts.
- GitHub is used for source-code management and collaboration.
- Integration testing is performed after combining the modules.
- Identified defects are reported, corrected and retested.

## 13. Expected Outcome

The expected outcome is an AI-assisted learning platform that helps engineering students understand their prescribed subjects through course-material-based explanations, interactive assessments and personalized learning recommendations.

The system aims to make learning more accessible, structured and focused on individual student needs.

## 14. Future Enhancements

- Support additional document formats.
- Improve multilingual learning support.
- Introduce advanced learning analytics.
- Enhance personalized learning recommendations.
- Provide additional interactive learning activities.

## 15. Contributors

**Project Team:** 4 Members

| Member | Responsibility |
|---|---|
| Member 1 | Development |
| Member 2 | Development |
| Member 3 | Testing |
| Member 4 | Testing |

---

**Project:** AI-Assisted Personalized Learning System for Engineering Courses

**Repository:** AI-Assisted-Learning-System


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

