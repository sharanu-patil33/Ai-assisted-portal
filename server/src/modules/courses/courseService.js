// server/src/modules/courses/courseService.js
// Layer 3: Course and Enrolment domain service (FR-03, FR-04, ADR-003)

const {
  ValidationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
} = require("../../models/domainErrors");

function assertCourseAccess(courseId, user, repos, { requireTeacherOwnership = false } = {}) {
  const course = repos.courses.findById(courseId);
  if (!course) {
    throw new NotFoundError("Course not found");
  }
  if (!user) {
    throw new AuthorizationError("User context is required");
  }

  if (user.role === "Admin") {
    if (requireTeacherOwnership && course.teacherId !== user.id) {
      // Admins have platform management access; allow if explicitly not student-only, or enforce ownership if teacher-specific
      return course;
    }
    return course;
  }

  if (user.role === "Teacher") {
    if (course.teacherId !== user.id) {
      throw new AuthorizationError("Teachers can only access their assigned courses");
    }
    return course;
  }

  if (user.role === "Student") {
    if (requireTeacherOwnership) {
      throw new AuthorizationError("Students cannot perform teacher operations on a course");
    }
    if (!repos.enrolments.isEnrolled(courseId, user.id)) {
      throw new AuthorizationError("You must be enrolled in this course to access its resources");
    }
    return course;
  }

  throw new AuthorizationError("Unsupported user role");
}

function listCoursesForUser(user, repos) {
  const allCourses = repos.courses.listAll();
  if (user.role === "Admin") {
    return allCourses.map((c) => ({ ...c, enrolled: true, isOwner: true }));
  }
  if (user.role === "Teacher") {
    return allCourses
      .filter((c) => c.teacherId === user.id)
      .map((c) => ({ ...c, isOwner: true }));
  }
  const enrolledIds = new Set(
    repos.enrolments.listByStudent(user.id).map((e) => e.courseId)
  );
  return allCourses.map((c) => ({
    ...c,
    enrolled: enrolledIds.has(c.id),
  }));
}

function getCourseById(courseId, user, repos) {
  const course = assertCourseAccess(courseId, user, repos);
  const enrolments = repos.enrolments.listByCourse(courseId);
  return {
    ...course,
    enrolledCount: enrolments.length,
  };
}

function createCourse({ code, title, description = "", units = [] }, user, repos) {
  if (!user || (user.role !== "Teacher" && user.role !== "Admin")) {
    throw new AuthorizationError("Only teachers or administrators can create courses");
  }
  if (!code || typeof code !== "string" || code.trim().length < 2) {
    throw new ValidationError("Course code is required");
  }
  if (!title || typeof title !== "string" || title.trim().length < 3) {
    throw new ValidationError("Course title is required");
  }
  const existing = repos.courses.findByCode(code.trim());
  if (existing) {
    throw new ConflictError(`Course with code ${code.trim().toUpperCase()} already exists`);
  }

  const normalizedUnits = Array.isArray(units)
    ? units.map((u, uIdx) => ({
        id: u.id || `u-${Date.now()}-${uIdx}`,
        title: String(u.title || `Unit ${uIdx + 1}`).trim(),
        order: uIdx + 1,
        topics: Array.isArray(u.topics)
          ? u.topics.map((t, tIdx) => ({
              id: t.id || `t-${Date.now()}-${uIdx}-${tIdx}`,
              title: String(t.title || `Topic ${tIdx + 1}`).trim(),
              order: tIdx + 1,
              prerequisiteTopicId: t.prerequisiteTopicId || null,
            }))
          : [],
      }))
    : [];

  const course = {
    id: `c-${code.trim().toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now()}`,
    code: code.trim().toUpperCase(),
    title: title.trim(),
    description: String(description || "").trim(),
    teacherId: user.id,
    units: normalizedUnits,
    createdAt: new Date().toISOString(),
  };

  repos.courses.create(course);
  return course;
}

function addTopicToCourse(courseId, { unitId, unitTitle, topicTitle, prerequisiteTopicId = null }, user, repos) {
  const course = assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  if (!topicTitle || typeof topicTitle !== "string" || topicTitle.trim().length < 2) {
    throw new ValidationError("Topic title is required");
  }

  let unit = unitId ? course.units.find((u) => u.id === unitId) : null;
  if (!unit) {
    const newUnitTitle =
      unitTitle && unitTitle.trim().length > 0
        ? unitTitle.trim()
        : `Unit ${course.units.length + 1}`;
    unit = {
      id: `u-${Date.now()}`,
      title: newUnitTitle,
      order: course.units.length + 1,
      topics: [],
    };
    course.units.push(unit);
  }

  const topic = {
    id: `t-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    title: topicTitle.trim(),
    order: unit.topics.length + 1,
    prerequisiteTopicId: prerequisiteTopicId || null,
  };
  unit.topics.push(topic);
  repos.courses.update(courseId, { units: course.units });
  return { course, topic };
}

function enrolStudent({ courseCode, courseId }, student, repos) {
  if (!student || student.role !== "Student") {
    throw new AuthorizationError("Only students can enrol in courses");
  }
  let course = null;
  if (courseId) {
    course = repos.courses.findById(courseId);
  } else if (courseCode) {
    course = repos.courses.findByCode(courseCode.trim());
  }
  if (!course) {
    throw new NotFoundError("Course not found for enrolment");
  }
  if (repos.enrolments.isEnrolled(course.id, student.id)) {
    return { alreadyEnrolled: true, course };
  }
  const enrolment = {
    id: `enr-${Date.now()}`,
    courseId: course.id,
    studentId: student.id,
    enrolledAt: new Date().toISOString(),
  };
  repos.enrolments.create(enrolment);
  return { alreadyEnrolled: false, enrolment, course };
}

function findTopicInCourse(course, topicId) {
  for (const unit of course.units || []) {
    const found = (unit.topics || []).find((t) => t.id === topicId);
    if (found) return found;
  }
  return null;
}

module.exports = {
  assertCourseAccess,
  listCoursesForUser,
  getCourseById,
  createCourse,
  addTopicToCourse,
  enrolStudent,
  findTopicInCourse,
};

