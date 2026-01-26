/**
 * Daily statistics tracker for Anki-style limits
 * @file components/scheduler/todayStats.js
 */

const DEBUG_SCHEDULER = true; // Set to false to disable verbose logging
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
      reviewsDoneToday: 0
    };
  }

  const nowBrussels = new Date();
  const brusselsToday = new Date(nowBrussels.toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
  brusselsToday.setHours(0, 0, 0, 0);
  const todayTimestamp = brusselsToday.getTime();

  // Count new cards introduced today
  // CRITICAL: Use first_reviewed_day_key as source of truth
  // This field is set ONLY on first rating and never changes
  const todayKey = getTodayDateString();
  const newIntroduced = userProgress.filter(p => {
    return p.first_reviewed_day_key === todayKey;
  }).length;

  // Count reviews done today
  // A review is "done today" if:
  // - last_reviewed is today (Brussels timezone)
  // - AND state is Review (or interday learning if we count that)
  // - AND reps > 1 (not the first rating)
  const reviewsDone = userProgress.filter(p => {
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
      reviewsDone
    };

    const hasChanged = !lastLoggedStats || 
      lastLoggedStats.dayKey !== currentStats.dayKey ||
      lastLoggedStats.progressCount !== currentStats.progressCount ||
      lastLoggedStats.newIntroduced !== currentStats.newIntroduced ||
      lastLoggedStats.reviewsDone !== currentStats.reviewsDone;

    if (hasChanged) {
      console.log('[TodayStats] Day:', todayKey, '| New:', newIntroduced, '| Reviews:', reviewsDone, '| Progress records:', userProgress.length);
      lastLoggedStats = currentStats;
    }
  }

  return {
    date: getTodayDateString(),
    newIntroducedToday: newIntroduced,
    reviewsDoneToday: reviewsDone
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
 * @param {number} reviewsDone - Current reviews done (may differ from stats if updated)
 * @returns {boolean}
 */
export function canIntroduceNewCard(stats, maxNewCardsPerDay, maxReviewsPerDay, newIgnoresReviewLimit, reviewsDone = null) {
  const actualReviewsDone = reviewsDone !== null ? reviewsDone : stats.reviewsDoneToday;
  
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
  return stats.reviewsDoneToday < maxReviewsPerDay;
}