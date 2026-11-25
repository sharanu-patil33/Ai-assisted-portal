// server/src/config/store.js
// Layer 5: Zero-config local in-memory + JSON persistence store

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = path.join(__dirname, "store-data.json");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function createInitialData() {
  const now = new Date().toISOString();

  const users = [
    {
      id: "u-admin-1",
      name: "System Administrator",
      email: "admin@edu.local",
      role: "Admin",
      passwordHash: hashPassword("Admin@123"),
      active: true,
      createdAt: now,
    },
    {
      id: "u-teacher-1",
      name: "Prof. Aarav Kulkarni",
      email: "teacher@edu.local",
      role: "Teacher",
      passwordHash: hashPassword("Teacher@123"),
      active: true,
      createdAt: now,
    },
    {
      id: "u-teacher-2",
      name: "Dr. Meera Nair",
      email: "meera@edu.local",
      role: "Teacher",
      passwordHash: hashPassword("Teacher@123"),
      active: true,
      createdAt: now,
    },
    {
      id: "u-student-1",
      name: "Rohan Sharma",
      email: "student@edu.local",
      role: "Student",
      passwordHash: hashPassword("Student@123"),
      active: true,
      createdAt: now,
    },
    {
      id: "u-student-2",
      name: "Ananya Verma",
      email: "ananya@edu.local",
      role: "Student",
      passwordHash: hashPassword("Student@123"),
      active: true,
      createdAt: now,
    },
  ];

  const courses = [
    {
      id: "c-oops-101",
      code: "CS201",
      title: "Object-Oriented Programming & Java",
      description:
        "Core OOP design principles, inheritance, polymorphism, interfaces, exception handling, and collections.",
      teacherId: "u-teacher-1",
      units: [
        {
          id: "u-oops-1",
          title: "Unit 1: Object Model",
          order: 1,
          topics: [
            {
              id: "t-oops-1",
              title: "Classes, Objects & Encapsulation",
              order: 1,
              prerequisiteTopicId: null,
            },
            {
              id: "t-oops-2",
              title: "Inheritance & Polymorphism",
              order: 2,
              prerequisiteTopicId: "t-oops-1",
            },
          ],
        },
        {
          id: "u-oops-2",
          title: "Unit 2: Abstraction & Reliability",
          order: 2,
          topics: [
            {
              id: "t-oops-3",
              title: "Interfaces & Abstract Classes",
              order: 3,
              prerequisiteTopicId: "t-oops-2",
            },
            {
              id: "t-oops-4",
              title: "Exception Handling & Collections",
              order: 4,
              prerequisiteTopicId: "t-oops-1",
            },
          ],
        },
      ],
      createdAt: now,
    },
    {
      id: "c-dbms-201",
      code: "CS302",
      title: "Database Management Systems",
      description:
        "Relational modeling, SQL querying, normalization forms, transaction management, and concurrency control.",
      teacherId: "u-teacher-1",
      units: [
        {
          id: "u-dbms-1",
          title: "Unit 1: Relational Foundations",
          order: 1,
          topics: [
            {
              id: "t-dbms-1",
              title: "ER Modeling & Relational Algebra",
              order: 1,
              prerequisiteTopicId: null,
            },
            {
              id: "t-dbms-2",
              title: "SQL & Normalization (1NF-BCNF)",
              order: 2,
              prerequisiteTopicId: "t-dbms-1",
            },
            {
              id: "t-dbms-3",
              title: "Transactions, ACID & Concurrency",
              order: 3,
              prerequisiteTopicId: "t-dbms-2",
            },
          ],
        },
      ],
      createdAt: now,
    },
    {
      id: "c-os-301",
      code: "CS304",
      title: "Operating Systems",
      description:
        "Process scheduling, synchronization, deadlocks, virtual memory, and file systems.",
      teacherId: "u-teacher-2",
      units: [
        {
          id: "u-os-1",
          title: "Unit 1: Processes & Memory",
          order: 1,
          topics: [
            {
              id: "t-os-1",
              title: "CPU Scheduling & Deadlocks",
              order: 1,
              prerequisiteTopicId: null,
            },
          ],
        },
      ],
      createdAt: now,
    },
  ];

  const enrolments = [
    { id: "enr-1", courseId: "c-oops-101", studentId: "u-student-1", enrolledAt: now },
    { id: "enr-2", courseId: "c-dbms-201", studentId: "u-student-1", enrolledAt: now },
    { id: "enr-3", courseId: "c-oops-101", studentId: "u-student-2", enrolledAt: now },
    { id: "enr-4", courseId: "c-os-301", studentId: "u-student-2", enrolledAt: now },
  ];

  const materials = [
    {
      id: "mat-oops-1",
      courseId: "c-oops-101",
      topicId: "t-oops-1",
      fileName: "OOP_Encapsulation_Notes.pdf",
      fileType: "PDF",
      isScanned: false,
      version: 1,
      status: "INDEXED",
      active: true,
      approved: true,
      chunkCount: 2,
      uploadedBy: "u-teacher-1",
      createdAt: now,
      updatedAt: now,
      versions: [{ version: 1, fileName: "OOP_Encapsulation_Notes.pdf", status: "INDEXED", createdAt: now }],
    },
    {
      id: "mat-oops-2",
      courseId: "c-oops-101",
      topicId: "t-oops-2",
      fileName: "Polymorphism_And_Inheritance.pdf",
      fileType: "PDF",
      isScanned: false,
      version: 1,
      status: "INDEXED",
      active: true,
      approved: true,
      chunkCount: 2,
      uploadedBy: "u-teacher-1",
      createdAt: now,
      updatedAt: now,
      versions: [{ version: 1, fileName: "Polymorphism_And_Inheritance.pdf", status: "INDEXED", createdAt: now }],
    },
    {
      id: "mat-oops-4",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      fileName: "Exception_Handling_Guide.pdf",
      fileType: "PDF",
      isScanned: false,
      version: 1,
      status: "INDEXED",
      active: true,
      approved: true,
      chunkCount: 2,
      uploadedBy: "u-teacher-1",
      createdAt: now,
      updatedAt: now,
      versions: [{ version: 1, fileName: "Exception_Handling_Guide.pdf", status: "INDEXED", createdAt: now }],
    },
    {
      id: "mat-dbms-2",
      courseId: "c-dbms-201",
      topicId: "t-dbms-2",
      fileName: "Normalization_BCNF_Slides.pptx",
      fileType: "PPTX",
      isScanned: false,
      version: 1,
      status: "INDEXED",
      active: true,
      approved: true,
      chunkCount: 2,
      uploadedBy: "u-teacher-1",
      createdAt: now,
      updatedAt: now,
      versions: [{ version: 1, fileName: "Normalization_BCNF_Slides.pptx", status: "INDEXED", createdAt: now }],
    },
    {
      id: "mat-os-1",
      courseId: "c-os-301",
      topicId: "t-os-1",
      fileName: "Deadlock_Bankers_Algorithm.pdf",
      fileType: "PDF",
      isScanned: false,
      version: 1,
      status: "INDEXED",
      active: true,
      approved: true,
      chunkCount: 1,
      uploadedBy: "u-teacher-2",
      createdAt: now,
      updatedAt: now,
      versions: [{ version: 1, fileName: "Deadlock_Bankers_Algorithm.pdf", status: "INDEXED", createdAt: now }],
    },
  ];

  const chunks = [
    {
      chunkId: "mat-oops-1_v1_p1_0",
      courseId: "c-oops-101",
      topicId: "t-oops-1",
      materialId: "mat-oops-1",
      fileName: "OOP_Encapsulation_Notes.pdf",
      version: 1,
      pageNumber: 1,
      active: true,
      approved: true,
      text: "Encapsulation bundles data fields and methods operating on that data inside a single class while restricting direct external access using private visibility modifiers and public getter/setter methods.",
    },
    {
      chunkId: "mat-oops-1_v1_p2_1",
      courseId: "c-oops-101",
      topicId: "t-oops-1",
      materialId: "mat-oops-1",
      fileName: "OOP_Encapsulation_Notes.pdf",
      version: 1,
      pageNumber: 2,
      active: true,
      approved: true,
      text: "A constructor initializes an object's invariants at creation time. Marking fields private prevents invalid state mutations, such as setting a negative bank account balance.",
    },
    {
      chunkId: "mat-oops-2_v1_p1_0",
      courseId: "c-oops-101",
      topicId: "t-oops-2",
      materialId: "mat-oops-2",
      fileName: "Polymorphism_And_Inheritance.pdf",
      version: 1,
      pageNumber: 4,
      active: true,
      approved: true,
      text: "Inheritance allows a subclass to reuse fields and methods from a superclass using the extends keyword. Method overriding enables runtime polymorphism via dynamic method dispatch.",
    },
    {
      chunkId: "mat-oops-2_v1_p2_1",
      courseId: "c-oops-101",
      topicId: "t-oops-2",
      materialId: "mat-oops-2",
      fileName: "Polymorphism_And_Inheritance.pdf",
      version: 1,
      pageNumber: 7,
      active: true,
      approved: true,
      text: "Compile-time polymorphism (method overloading) selects a method signature based on parameter types at compile time, whereas runtime polymorphism resolves overridden methods based on the actual object instance.",
    },
    {
      chunkId: "mat-oops-4_v1_p1_0",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      materialId: "mat-oops-4",
      fileName: "Exception_Handling_Guide.pdf",
      version: 1,
      pageNumber: 3,
      active: true,
      approved: true,
      text: "Exception handling separates normal execution flow from error recovery using try, catch, and finally blocks. Checked exceptions must be declared with throws or caught explicitly, whereas unchecked exceptions extend RuntimeException.",
    },
    {
      chunkId: "mat-oops-4_v1_p2_1",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      materialId: "mat-oops-4",
      fileName: "Exception_Handling_Guide.pdf",
      version: 1,
      pageNumber: 6,
      active: true,
      approved: true,
      text: "The finally block always executes whether an exception is thrown or not, making it ideal for closing files or releasing database connections. Custom exceptions extend Exception or RuntimeException.",
    },
    {
      chunkId: "mat-dbms-2_v1_p1_0",
      courseId: "c-dbms-201",
      topicId: "t-dbms-2",
      materialId: "mat-dbms-2",
      fileName: "Normalization_BCNF_Slides.pptx",
      version: 1,
      pageNumber: 5,
      active: true,
      approved: true,
      text: "Database normalization reduces redundancy and update anomalies. First Normal Form (1NF) requires atomic attributes; Second Normal Form (2NF) removes partial dependencies on a composite key; Third Normal Form (3NF) removes transitive dependencies.",
    },
    {
      chunkId: "mat-dbms-2_v1_p2_1",
      courseId: "c-dbms-201",
      topicId: "t-dbms-2",
      materialId: "mat-dbms-2",
      fileName: "Normalization_BCNF_Slides.pptx",
      version: 1,
      pageNumber: 8,
      active: true,
      approved: true,
      text: "Boyce-Codd Normal Form (BCNF) requires that for every non-trivial functional dependency X -> Y, X must be a superkey of the relation.",
    },
    {
      chunkId: "mat-os-1_v1_p1_0",
      courseId: "c-os-301",
      topicId: "t-os-1",
      materialId: "mat-os-1",
      fileName: "Deadlock_Bankers_Algorithm.pdf",
      version: 1,
      pageNumber: 2,
      active: true,
      approved: true,
      text: "A deadlock occurs when four Coffman conditions hold simultaneously: mutual exclusion, hold and wait, no preemption, and circular wait. Banker's algorithm avoids deadlocks by checking safe sequences.",
    },
  ];

  const questions = [
    {
      id: "q-oops-1",
      courseId: "c-oops-101",
      topicId: "t-oops-1",
      prompt: "Which access modifier best enforces encapsulation for internal class fields?",
      options: ["public", "private", "static", "volatile"],
      correctIndex: 1,
      explanation: "Marking fields private hides internal state and forces access through validated public methods.",
      difficulty: "easy",
      status: "APPROVED",
      sourceFile: "OOP_Encapsulation_Notes.pdf",
      sourcePage: 1,
      createdBy: "u-teacher-1",
      createdAt: now,
    },
    {
      id: "q-oops-2",
      courseId: "c-oops-101",
      topicId: "t-oops-2",
      prompt: "How does Java resolve an overridden method call on a superclass reference at runtime?",
      options: [
        "Static compile-time binding",
        "Dynamic method dispatch based on the actual object type",
        "Alphabetical signature lookup",
        "Preprocessor macro expansion",
      ],
      correctIndex: 1,
      explanation: "Runtime polymorphism uses dynamic method dispatch to invoke the subclass's overridden implementation.",
      difficulty: "medium",
      status: "APPROVED",
      sourceFile: "Polymorphism_And_Inheritance.pdf",
      sourcePage: 4,
      createdBy: "u-teacher-1",
      createdAt: now,
    },
    {
      id: "q-oops-3",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      prompt: "Which block in Java exception handling always executes regardless of whether an exception occurred?",
      options: ["try", "catch", "finally", "throws"],
      correctIndex: 2,
      explanation: "The finally block executes after try/catch completes, making it ideal for releasing resources.",
      difficulty: "easy",
      status: "APPROVED",
      sourceFile: "Exception_Handling_Guide.pdf",
      sourcePage: 6,
      createdBy: "u-teacher-1",
      createdAt: now,
    },
    {
      id: "q-oops-4",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      prompt: "What distinguishes a checked exception from an unchecked exception in Java?",
      options: [
        "Checked exceptions extend RuntimeException",
        "Checked exceptions must be caught or declared with throws at compile time",
        "Unchecked exceptions cannot be caught in a catch block",
        "Checked exceptions only occur inside finally blocks",
      ],
      correctIndex: 1,
      explanation: "Checked exceptions are verified at compile time and must be handled via try-catch or declared using throws.",
      difficulty: "medium",
      status: "APPROVED",
      sourceFile: "Exception_Handling_Guide.pdf",
      sourcePage: 3,
      createdBy: "u-teacher-1",
      createdAt: now,
    },
    {
      id: "q-oops-5",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      prompt: "When creating a custom checked exception in Java, which class should it extend?",
      options: ["Throwable directly only", "Exception", "Error", "Object"],
      correctIndex: 1,
      explanation: "Custom checked exceptions extend java.lang.Exception so the compiler enforces handling.",
      difficulty: "hard",
      status: "PENDING_REVIEW",
      sourceFile: "Exception_Handling_Guide.pdf",
      sourcePage: 6,
      createdBy: "AI_GENERATOR",
      createdAt: now,
    },
    {
      id: "q-dbms-1",
      courseId: "c-dbms-201",
      topicId: "t-dbms-2",
      prompt: "Which condition defines Boyce-Codd Normal Form (BCNF)?",
      options: [
        "Every attribute must be atomic",
        "For every non-trivial functional dependency X -> Y, X is a superkey",
        "All foreign keys must be null",
        "Tables must have at least three columns",
      ],
      correctIndex: 1,
      explanation: "BCNF requires the determinant X of every non-trivial functional dependency X -> Y to be a superkey.",
      difficulty: "medium",
      status: "APPROVED",
      sourceFile: "Normalization_BCNF_Slides.pptx",
      sourcePage: 8,
      createdBy: "u-teacher-1",
      createdAt: now,
    },
  ];

  const quizAttempts = [
    {
      id: "att-1",
      courseId: "c-oops-101",
      topicId: "t-oops-1",
      studentId: "u-student-1",
      difficulty: "easy",
      totalQuestions: 1,
      correctCount: 1,
      scorePercent: 100,
      timeTakenSec: 28,
      answers: [{ questionId: "q-oops-1", selectedIndex: 1, correctIndex: 1, isCorrect: true }],
      submittedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
    {
      id: "att-2",
      courseId: "c-oops-101",
      topicId: "t-oops-2",
      studentId: "u-student-1",
      difficulty: "medium",
      totalQuestions: 1,
      correctCount: 1,
      scorePercent: 75,
      timeTakenSec: 42,
      answers: [{ questionId: "q-oops-2", selectedIndex: 1, correctIndex: 1, isCorrect: true }],
      submittedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
    {
      id: "att-3",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      studentId: "u-student-1",
      difficulty: "medium",
      totalQuestions: 2,
      correctCount: 0,
      scorePercent: 35,
      timeTakenSec: 75,
      answers: [
        { questionId: "q-oops-3", selectedIndex: 0, correctIndex: 2, isCorrect: false },
        { questionId: "q-oops-4", selectedIndex: 0, correctIndex: 1, isCorrect: false },
      ],
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "att-4",
      courseId: "c-oops-101",
      topicId: "t-oops-4",
      studentId: "u-student-2",
      difficulty: "medium",
      totalQuestions: 2,
      correctCount: 1,
      scorePercent: 45,
      timeTakenSec: 65,
      answers: [
        { questionId: "q-oops-3", selectedIndex: 2, correctIndex: 2, isCorrect: true },
        { questionId: "q-oops-4", selectedIndex: 0, correctIndex: 1, isCorrect: false },
      ],
      submittedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];

  const activities = [
    { id: "act-1", studentId: "u-student-1", courseId: "c-oops-101", topicId: "t-oops-1", type: "MATERIAL_READ", createdAt: now },
    { id: "act-2", studentId: "u-student-1", courseId: "c-oops-101", topicId: "t-oops-4", type: "AI_DOUBT", question: "Difference between checked and unchecked exceptions", createdAt: now },
    { id: "act-3", studentId: "u-student-1", courseId: "c-oops-101", topicId: "t-oops-4", type: "AI_DOUBT", question: "When does finally execute?", createdAt: now },
    { id: "act-4", studentId: "u-student-2", courseId: "c-oops-101", topicId: "t-oops-4", type: "AI_DOUBT", question: "Why use custom checked exceptions?", createdAt: now },
  ];

  const feedback = [
    {
      id: "fb-1",
      courseId: "c-oops-101",
      targetType: "AI_ANSWER",
      targetId: "msg-demo-1",
      studentId: "u-student-2",
      rating: "down",
      reason: "Clarify whether finally runs when System.exit(0) is called.",
      excerpt: "The finally block always executes whether an exception is thrown or not.",
      status: "PENDING",
      teacherNote: "",
      reviewedBy: null,
      createdAt: now,
      reviewedAt: null,
    },
  ];

  const notifications = [
    {
      id: "notif-1",
      userId: "u-student-1",
      courseId: "c-oops-101",
      type: "REVISION_REMINDER",
      title: "Revise Exception Handling & Collections",
      message: "Your recent quiz score in Unit 4: Exception Handling & Collections was 35%. Review Exception_Handling_Guide.pdf before retaking.",
      read: false,
      createdAt: now,
    },
    {
      id: "notif-2",
      userId: "u-teacher-1",
      courseId: "c-oops-101",
      type: "CLASS_ALERT",
      title: "Struggling Topic Alert: Exception Handling & Collections",
      message: "100% of attempted students scored below 60% in Unit 4: Exception Handling & Collections.",
      read: false,
      createdAt: now,
    },
  ];

  return {
    users,
    courses,
    enrolments,
    materials,
    chunks,
    jobs: [],
    conversations: [],
    questions,
    quizAttempts,
    activities,
    recommendations: [],
    feedback,
    notifications,
    auditLogs: [],
  };
}

class LocalStore {
  constructor(options = {}) {
    this.persistToDisk = options.persistToDisk !== false;
    this.data = this._load();
  }

  _load() {
    if (this.persistToDisk && fs.existsSync(DATA_FILE)) {
      try {
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.courses)) {
          return parsed;
        }
      } catch (_err) {
        // Fallback to fresh seed if JSON is corrupted
      }
    }
    const seed = createInitialData();
    if (this.persistToDisk) {
      this._write(seed);
    }
    return seed;
  }

  _write(data) {
    if (!this.persistToDisk) return;
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (_err) {
      // Avoid crashing request paths on transient disk write errors
    }
  }

  save() {
    this._write(this.data);
  }

  reset(seed = createInitialData()) {
    this.data = seed;
    this.save();
  }
}

const defaultStore = new LocalStore({
  persistToDisk: process.env.NODE_ENV !== "test",
});

module.exports = {
  LocalStore,
  defaultStore,
  createInitialData,
  hashPassword,
};

