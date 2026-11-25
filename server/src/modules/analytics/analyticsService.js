// server/src/modules/analytics/analyticsService.js
// Layer 3: Learning Analytics, Topic Mastery, Adaptive Difficulty & Dashboards
// (FR-16, FR-17, FR-18, FR-21, FR-22, FR-23, ADR-005)

const { assertCourseAccess } = require("../courses/courseService");

const MASTERY_FORMULA_VERSION = "v1.0";

function flattenCourseTopics(course) {
  const topics = [];
  for (const unit of course.units || []) {
    for (const topic of unit.topics || []) {
      topics.push({
        ...topic,
        unitId: unit.id,
        unitTitle: unit.title,
      });
    }
  }
  return topics;
}

function classifyMastery(score, attemptsCount, doubtCount) {
  if (attemptsCount === 0 && doubtCount === 0) return "not_started";
  if (score >= 75) return "strong";
  if (score >= 50) return "moderate";
  return "weak";
}

function computeTopicMasteryForStudent(course, studentId, repos) {
  const topics = flattenCourseTopics(course);
  const attempts = repos.attempts.listByStudentAndCourse(studentId, course.id);
  const activities = repos.activities.listByStudentAndCourse(studentId, course.id);

  return topics.map((topic) => {
    const topicAttempts = attempts
      .filter((a) => a.topicId === topic.id)
      .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

    const topicDoubts = activities.filter(
      (act) => act.topicId === topic.id && act.type === "AI_DOUBT"
    );
    const topicReads = activities.filter(
      (act) => act.topicId === topic.id && act.type === "MATERIAL_READ"
    );

    if (topicAttempts.length === 0) {
      // Cold-start or repeated-doubts-only handling (FR-18)
      const baseScore = topicReads.length > 0 ? 35 : 0;
      const doubtPenalty = Math.min(20, topicDoubts.length * 6);
      const masteryScore = Math.max(0, baseScore - doubtPenalty);
      const classification = classifyMastery(masteryScore, 0, topicDoubts.length);
      return {
        topicId: topic.id,
        topicTitle: topic.title,
        unitTitle: topic.unitTitle,
        prerequisiteTopicId: topic.prerequisiteTopicId || null,
        masteryScore,
        classification,
        attemptsCount: 0,
        latestScore: null,
        doubtCount: topicDoubts.length,
        materialReads: topicReads.length,
        completed: false,
        formulaVersion: MASTERY_FORMULA_VERSION,
      };
    }

    // Weighted accuracy (recency + trend): newer attempts carry linearly higher weight
    let weightedSum = 0;
    let totalWeight = 0;
    topicAttempts.forEach((att, idx) => {
      const weight = idx + 1;
      weightedSum += att.scorePercent * weight;
      totalWeight += weight;
    });
    const weightedAccuracy = weightedSum / totalWeight;
    const latest = topicAttempts[topicAttempts.length - 1];
    const prev = topicAttempts.length > 1 ? topicAttempts[topicAttempts.length - 2] : null;
    const trendBonus = prev ? Math.max(-8, Math.min(8, (latest.scorePercent - prev.scorePercent) * 0.2)) : 0;
    const doubtPenalty = Math.min(18, Math.max(0, (topicDoubts.length - 1) * 5));

    const masteryScore = Math.round(
      Math.max(0, Math.min(100, weightedAccuracy + trendBonus - doubtPenalty))
    );
    const classification = classifyMastery(masteryScore, topicAttempts.length, topicDoubts.length);

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      unitTitle: topic.unitTitle,
      prerequisiteTopicId: topic.prerequisiteTopicId || null,
      masteryScore,
      classification,
      attemptsCount: topicAttempts.length,
      latestScore: latest.scorePercent,
      doubtCount: topicDoubts.length,
      materialReads: topicReads.length,
      completed: masteryScore >= 60,
      formulaVersion: MASTERY_FORMULA_VERSION,
    };
  });
}

function determineAdaptiveDifficulty({ courseId, topicId, studentId }, repos) {
  const attempts = repos.attempts
    .listByStudentAndCourse(studentId, courseId)
    .filter((a) => !topicId || a.topicId === topicId)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  if (attempts.length === 0) {
    return { difficulty: "easy", reason: "No prior attempts on this topic; starting with foundational difficulty." };
  }

  const latest = attempts[attempts.length - 1];
  if (latest.scorePercent >= 80) {
    return {
      difficulty: "hard",
      reason: `Strong recent score (${latest.scorePercent}%). Stepping up to challenging questions.`,
    };
  }
  if (latest.scorePercent >= 55) {
    return {
      difficulty: "medium",
      reason: `Moderate recent score (${latest.scorePercent}%). Maintaining intermediate difficulty.`,
    };
  }
  return {
    difficulty: "easy",
    reason: `Recent score (${latest.scorePercent}%) indicates foundational gaps. Adjusting to easy difficulty.`,
  };
}

function getStudentDashboard(courseId, user, repos) {
  const course = assertCourseAccess(courseId, user, repos);
  const topicMastery = computeTopicMasteryForStudent(course, user.id, repos);
  const attempts = repos.attempts
    .listByStudentAndCourse(user.id, courseId)
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

  const completedTopics = topicMastery.filter((t) => t.completed).length;
  const totalTopics = topicMastery.length;
  const overallProgress = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

  const avgQuizScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.scorePercent, 0) / attempts.length)
      : 0;

  const weakAreas = topicMastery.filter((t) => t.classification === "weak");
  const strongAreas = topicMastery.filter((t) => t.classification === "strong");

  const scoreTrend = attempts.map((a, idx) => ({
    attemptNumber: idx + 1,
    attemptId: a.id,
    topicId: a.topicId,
    scorePercent: a.scorePercent,
    submittedAt: a.submittedAt,
  }));

  return {
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
    overallProgress,
    completedTopics,
    totalTopics,
    avgQuizScore,
    totalAttempts: attempts.length,
    topicMastery,
    weakAreas,
    strongAreas,
    scoreTrend,
  };
}

function getTeacherDashboard(courseId, user, repos) {
  const course = assertCourseAccess(courseId, user, repos, { requireTeacherOwnership: true });
  const enrolments = repos.enrolments.listByCourse(courseId);
  const attempts = repos.attempts.listByCourse(courseId);
  const activities = repos.activities.listByCourse(courseId);
  const topics = flattenCourseTopics(course);

  const classAverage =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, a) => sum + a.scorePercent, 0) / attempts.length)
      : 0;

  const scoreDistribution = {
    "0-39": 0,
    "40-59": 0,
    "60-79": 0,
    "80-100": 0,
  };
  for (const a of attempts) {
    if (a.scorePercent < 40) scoreDistribution["0-39"] += 1;
    else if (a.scorePercent < 60) scoreDistribution["40-59"] += 1;
    else if (a.scorePercent < 80) scoreDistribution["60-79"] += 1;
    else scoreDistribution["80-100"] += 1;
  }

  const topicPerformance = topics.map((topic) => {
    const topicAttempts = attempts.filter((a) => a.topicId === topic.id);
    const avgScore =
      topicAttempts.length > 0
        ? Math.round(
            topicAttempts.reduce((sum, a) => sum + a.scorePercent, 0) / topicAttempts.length
          )
        : null;
    const lowCount = topicAttempts.filter((a) => a.scorePercent < 60).length;
    const lowRatio = topicAttempts.length > 0 ? lowCount / topicAttempts.length : 0;
    const doubtCount = activities.filter(
      (act) => act.topicId === topic.id && act.type === "AI_DOUBT"
    ).length;

    return {
      topicId: topic.id,
      topicTitle: topic.title,
      unitTitle: topic.unitTitle,
      attemptsCount: topicAttempts.length,
      averageScore: avgScore,
      lowScorePercent: Math.round(lowRatio * 100),
      struggling: topicAttempts.length > 0 && lowRatio >= 0.4,
      doubtCount,
    };
  });

  const strugglingTopics = topicPerformance.filter((t) => t.struggling);

  const studentsNeedingAttention = enrolments
    .map((enr) => {
      const student = repos.users.findById(enr.studentId);
      const mastery = computeTopicMasteryForStudent(course, enr.studentId, repos);
      const weakTopics = mastery.filter((m) => m.classification === "weak");
      const studentAttempts = attempts.filter((a) => a.studentId === enr.studentId);
      const avgScore =
        studentAttempts.length > 0
          ? Math.round(
              studentAttempts.reduce((s, a) => s + a.scorePercent, 0) / studentAttempts.length
            )
          : 0;

      return {
        studentId: enr.studentId,
        studentName: student ? student.name : enr.studentId,
        studentEmail: student ? student.email : "",
        avgScore,
        weakTopicCount: weakTopics.length,
        weakTopicTitles: weakTopics.map((w) => w.topicTitle),
      };
    })
    .filter((s) => s.weakTopicCount > 0 || (s.avgScore > 0 && s.avgScore < 60));

  const mostAskedDoubts = topicPerformance
    .filter((t) => t.doubtCount > 0)
    .sort((a, b) => b.doubtCount - a.doubtCount)
    .map((t) => ({
      topicId: t.topicId,
      topicTitle: t.topicTitle,
      doubtCount: t.doubtCount,
    }));

  return {
    courseId: course.id,
    courseCode: course.code,
    courseTitle: course.title,
    enrolledStudents: enrolments.length,
    totalAttempts: attempts.length,
    classAverage,
    scoreDistribution,
    topicPerformance,
    strugglingTopics,
    studentsNeedingAttention,
    mostAskedDoubts,
  };
}

function buildTeacherCsvExport(dashboard) {
  const lines = [
    "Topic,Unit,Attempts,Average Score (%),Low Score (%),Struggling,AI Doubts",
    ...dashboard.topicPerformance.map((t) =>
      [
        `"${t.topicTitle.replace(/"/g, '""')}"`,
        `"${t.unitTitle.replace(/"/g, '""')}"`,
        t.attemptsCount,
        t.averageScore === null ? "N/A" : t.averageScore,
        t.lowScorePercent,
        t.struggling ? "YES" : "NO",
        t.doubtCount,
      ].join(",")
    ),
  ];
  return lines.join("\n");
}

module.exports = {
  computeTopicMasteryForStudent,
  determineAdaptiveDifficulty,
  getStudentDashboard,
  getTeacherDashboard,
  buildTeacherCsvExport,
};

