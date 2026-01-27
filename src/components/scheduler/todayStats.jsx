/**
 * Daily statistics tracker for Anki-style limits
 * @file components/scheduler/todayStats.js
 */

const DEBUG_SCHEDULER = false;
let lastLoggedStats = null;

/**
 * Calculate today's statistics from UserProgress records
 * Uses Brussels timezone (Europe/Brussels = UTC+1/+2) for day boundary
 * @param {Array} userProgress - All UserProgress records for user
 * @returns {TodayStats}
 */
export function calculateTodayStats(userProgress) {
  if (!userProgress || userProgress.length === 0) {
    return {
      date: getTodayDateString(),
      newIntroducedToday: 0,
      newLearnedToday: 0,
      reviewsCompletedToday: 0
    };
  }

  const nowBrussels = new Date();
  const brusselsToday = new Date(nowBrussels.toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
  brusselsToday.setHours(0, 0, 0, 0);
  const todayTimestamp = brusselsToday.getTime();

  const todayKey = getTodayDateString();

  // 1) New Introduced Today
  // Count cards whose first-ever exposure happened today
  const newIntroduced = userProgress.filter(p => {
    return p.first_reviewed_day_key === todayKey;
  }).length;

  // 2) New Learned Today (Graduated)
  // Cards introduced today AND graduated to Review state today
  const newLearned = userProgress.filter(p => {
    if (p.first_reviewed_day_key !== todayKey) return false;
    if (p.state !== 'Review') return false;
    if (!p.last_reviewed) return false;
    
    // Check if last_reviewed (graduation moment) was today
    const reviewedBrussels = new Date(new Date(p.last_reviewed).toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
    reviewedBrussels.setHours(0, 0, 0, 0);
    return reviewedBrussels.getTime() === todayTimestamp;
  }).length;

  // 3) Reviews Completed (Older cards only)
  // Cards introduced BEFORE today that were reviewed today
  const reviewsCompleted = userProgress.filter(p => {
    if (p.first_reviewed_day_key === todayKey) return false; // Exclude today's new cards
    if (!p.last_reviewed || !p.reps || p.reps <= 1) return false;
    if (p.state !== 'Review') return false;
    
    const reviewedBrussels = new Date(new Date(p.last_reviewed).toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
    reviewedBrussels.setHours(0, 0, 0, 0);
    return reviewedBrussels.getTime() === todayTimestamp;
  }).length;

  // Only log when values actually change
  if (DEBUG_SCHEDULER) {
    const currentStats = {
      dayKey: todayKey,
      progressCount: userProgress.length,
      newIntroduced,
      newLearned,
      reviewsCompleted
    };

    const hasChanged = !lastLoggedStats || 
      lastLoggedStats.dayKey !== currentStats.dayKey ||
      lastLoggedStats.progressCount !== currentStats.progressCount ||
      lastLoggedStats.newIntroduced !== currentStats.newIntroduced ||
      lastLoggedStats.newLearned !== currentStats.newLearned ||
      lastLoggedStats.reviewsCompleted !== currentStats.reviewsCompleted;

    if (hasChanged) {
      console.log('[TodayStats] Day:', todayKey, '| New:', newIntroduced, '| Learned:', newLearned, '| Reviews:', reviewsCompleted, '| Progress:', userProgress.length);
      lastLoggedStats = currentStats;
    }
  }

  return {
    date: getTodayDateString(),
    newIntroducedToday: newIntroduced,
    newLearnedToday: newLearned,
    reviewsCompletedToday: reviewsCompleted
  };
}

/**
 * Get today's date string in Brussels timezone
 * @returns {string} YYYY-MM-DD
 */
export function getTodayDateString() {
  const nowBrussels = new Date();
  const brusselsDate = new Date(nowBrussels.toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
  return brusselsDate.toISOString().split('T')[0];
}

/**
 * Check if new cards can be introduced given current stats and limits
 * @param {TodayStats} stats
 * @param {number} maxNewCardsPerDay
 * @param {number} maxReviewsPerDay
 * @param {boolean} newIgnoresReviewLimit
 * @param {number} reviewsCompleted - Current reviews done (may differ from stats if updated)
 * @returns {boolean}
 */
export function canIntroduceNewCard(stats, maxNewCardsPerDay, maxReviewsPerDay, newIgnoresReviewLimit, reviewsCompleted = null) {
  const actualReviewsDone = reviewsCompleted !== null ? reviewsCompleted : stats.reviewsCompletedToday;
  
  // Check new card limit
  if (stats.newIntroducedToday >= maxNewCardsPerDay) {
    return false;
  }

  // Check review limit (unless ignored)
  if (!newIgnoresReviewLimit && actualReviewsDone >= maxReviewsPerDay) {
    return false;
  }

  return true;
}

/**
 * Check if more reviews can be done
 * @param {TodayStats} stats
 * @param {number} maxReviewsPerDay
 * @returns {boolean}
 */
export function canDoReview(stats, maxReviewsPerDay) {
  return stats.reviewsCompletedToday < maxReviewsPerDay;
}