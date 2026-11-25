// server/src/modules/recommendations/recommendationService.js
// Layer 3: Adaptive & Personalized Recommendation domain service (FR-19, FR-20, ADR-005)

const { assertCourseAccess } = require("../courses/courseService");
const { computeTopicMasteryForStudent, determineAdaptiveDifficulty } = require("../analytics/analyticsService");

function generateRecommendations(courseId, user, repos) {
  const course = assertCourseAccess(courseId, user, repos);
  const masteryList = computeTopicMasteryForStudent(course, user.id, repos);
  const materials = repos.materials.listByCourse(courseId, { includeHidden: false });

  const masteryById = new Map(masteryList.map((m) => [m.topicId, m]));

  const prioritized = masteryList
    .filter((m) => m.classification === "weak" || m.classification === "moderate" || m.classification === "not_started")
    .map((item) => {
      // Prerequisite-aware ordering (FR-19): if prerequisite exists and isn't strong, highlight it first
      let targetTopic = item;
      let prerequisiteWarning = null;
      if (item.prerequisiteTopicId) {
        const prereq = masteryById.get(item.prerequisiteTopicId);
        if (prereq && prereq.classification !== "strong" && prereq.classification !== "moderate") {
          prerequisiteWarning = `Prerequisite "${prereq.topicTitle}" should be reviewed first.`;
          targetTopic = prereq;
        }
      }

      const linkedMaterial =
        materials.find((m) => m.topicId === targetTopic.topicId && m.status === "INDEXED") ||
        materials.find((m) => m.topicId === targetTopic.topicId) ||
        null;

      const adaptive = determineAdaptiveDifficulty(
        { courseId, topicId: targetTopic.topicId, studentId: user.id },
        repos
      );

      let message;
      if (targetTopic.classification === "weak") {
        message = `You are weak in ${targetTopic.topicTitle} (${targetTopic.masteryScore}% mastery). Revise ${
          linkedMaterial ? linkedMaterial.fileName : "course notes"
        } before the next quiz.`;
      } else if (targetTopic.classification === "moderate") {
        message = `Consolidate ${targetTopic.topicTitle} (${targetTopic.masteryScore}% mastery) with a ${adaptive.difficulty}-level practice quiz.`;
      } else {
        message = `Start ${targetTopic.topicTitle} by reading ${
          linkedMaterial ? linkedMaterial.fileName : "the topic material"
        } and taking an introductory quiz.`;
      }

      return {
        id: `rec-${courseId}-${targetTopic.topicId}`,
        courseId,
        topicId: targetTopic.topicId,
        topicTitle: targetTopic.topicTitle,
        severity:
          targetTopic.classification === "weak"
            ? "HIGH"
            : targetTopic.classification === "moderate"
            ? "MEDIUM"
            : "LOW",
        classification: targetTopic.classification,
        masteryScore: targetTopic.masteryScore,
        recommendedDifficulty: adaptive.difficulty,
        prerequisiteWarning,
        message,
        materialLink: linkedMaterial
          ? {
              materialId: linkedMaterial.id,
              fileName: linkedMaterial.fileName,
              topicId: linkedMaterial.topicId,
            }
          : null,
        practiceQuizLink: {
          courseId,
          topicId: targetTopic.topicId,
          difficulty: adaptive.difficulty,
        },
      };
    });

  // Deduplicate by topicId and sort weak first
  const seen = new Set();
  const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return prioritized
    .filter((r) => {
      if (seen.has(r.topicId)) return false;
      seen.add(r.topicId);
      return true;
    })
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

module.exports = {
  generateRecommendations,
};

