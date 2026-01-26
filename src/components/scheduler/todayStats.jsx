/**
 * Daily statistics tracker for Anki-style limits
 * @file components/scheduler/todayStats.js
 */

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
  // A card is "new introduced today" if:
  // - created_date is today (Brussels timezone)
  // - AND reps >= 1 (first rating happened)
  const newIntroduced = userProgress.filter(p => {
    if (!p.created_date || !p.reps || p.reps === 0) return false;
    const createdBrussels = new Date(new Date(p.created_date).toLocaleString('en-US', { timeZone: 'Europe/Brussels' }));
    createdBrussels.setHours(0, 0, 0, 0);
    const isToday = createdBrussels.getTime() === todayTimestamp;
    if (isToday) {
      console.log('[TodayStats] New card introduced today:', p.vocabulary_id, 'created:', p.created_date, 'reps:', p.reps);
    }
    return isToday;
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

  console.log('[TodayStats] ========== DAILY STATS ==========');
  console.log('[TodayStats] Day key:', getTodayDateString());
  console.log('[TodayStats] Total progress records:', userProgress.length);
  console.log('[TodayStats] New introduced today:', newIntroduced);
  console.log('[TodayStats] Reviews done today:', reviewsDone);
  console.log('[TodayStats] ===================================');

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