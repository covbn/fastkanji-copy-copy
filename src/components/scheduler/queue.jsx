/**
 * Anki-style queue builder
 * @file components/scheduler/queue.js
 */

import { CARD_STATES } from './types.js';
import { getCardState } from './sm2Anki.js';

const MINUTES_TO_MS = 60 * 1000;
const DAYS_TO_MS = 24 * 60 * 60 * 1000;

/**
 * Build study queues with Anki-like priority
 * @param {Array} vocabulary - All vocabulary items
 * @param {Array} userProgress - User progress records
 * @param {number} now - Current timestamp (ms)
 * @param {SchedulerOptions} options
 * @returns {QueueInfo}
 */
export function buildQueues(vocabulary, userProgress, now, options) {
  const progressMap = {};
  userProgress.forEach(p => {
    progressMap[p.vocabulary_id] = p;
  });

  const queues = {
    intradayLearning: [],
    interdayLearning: [],
    reviewDue: [],
    newCards: [],
    totalLearning: 0,
    totalUnseen: 0,
    nextLearningCard: null
  };

  let earliestLearningDue = null;

  vocabulary.forEach(vocab => {
    const progress = progressMap[vocab.id];
    const card = getCardState(progress, vocab);

    if (card.state === CARD_STATES.NEW) {
      queues.totalUnseen++;
      queues.newCards.push({ ...vocab, _cardState: card });
    } else if (card.state === CARD_STATES.LEARNING || card.state === CARD_STATES.RELEARNING) {
      queues.totalLearning++;

      // Check if this is intraday (< 1 day) or interday (>= 1 day)
      const dueInMs = card.dueAt - now;
      const isIntraday = dueInMs < DAYS_TO_MS;

      if (isIntraday && card.dueAt <= now) {
        // Intraday learning due now
        queues.intradayLearning.push({ ...vocab, _cardState: card, _dueAt: card.dueAt });
      } else if (!isIntraday) {
        // Interday learning (crossed day boundary)
        if (card.dueAt <= now) {
          queues.interdayLearning.push({ ...vocab, _cardState: card, _dueAt: card.dueAt });
        }
      }

      // Track next learning card
      if (card.dueAt > now) {
        if (!earliestLearningDue || card.dueAt < earliestLearningDue.dueAt) {
          earliestLearningDue = {
            dueAt: card.dueAt,
            minutesUntilDue: Math.ceil((card.dueAt - now) / MINUTES_TO_MS)
          };
        }
      }
    } else if (card.state === CARD_STATES.REVIEW) {
      if (card.dueAt <= now) {
        queues.reviewDue.push({ ...vocab, _cardState: card, _dueAt: card.dueAt });
      }
    }
  });

  // Sort queues by due time (earliest first)
  queues.intradayLearning.sort((a, b) => a._dueAt - b._dueAt);
  queues.interdayLearning.sort((a, b) => a._dueAt - b._dueAt);
  queues.reviewDue.sort((a, b) => a._dueAt - b._dueAt);

  queues.nextLearningCard = earliestLearningDue;

  console.log('[Queue] Built queues:', {
    intradayLearning: queues.intradayLearning.length,
    interdayLearning: queues.interdayLearning.length,
    reviewDue: queues.reviewDue.length,
    newCards: queues.newCards.length,
    totalLearning: queues.totalLearning,
    totalUnseen: queues.totalUnseen,
    nextLearningIn: earliestLearningDue?.minutesUntilDue || 'N/A'
  });

  return queues;
}

/**
 * Get next card to study based on Anki priority rules
 * @param {QueueInfo} queues
 * @param {TodayStats} todayStats
 * @param {SchedulerOptions} options
 * @param {Set} recentlyRatedIds - IDs to skip (just rated)
 * @returns {Object|null} Next vocabulary item or null
 */
export function getNextCard(queues, todayStats, options, recentlyRatedIds = new Set()) {
  // Priority 1: Intraday learning due now
  const nextIntraday = queues.intradayLearning.find(v => !recentlyRatedIds.has(v.id));
  if (nextIntraday) {
    console.log('[Queue] Selected: intraday learning');
    return nextIntraday;
  }

  // Priority 2: Interday learning due
  const nextInterday = queues.interdayLearning.find(v => !recentlyRatedIds.has(v.id));
  if (nextInterday) {
    console.log('[Queue] Selected: interday learning');
    return nextInterday;
  }

  // Priority 3: Review due (check limit)
  const remainingReviews = options.maxReviewsPerDay - todayStats.reviewsDoneToday;
  if (remainingReviews > 0) {
    const nextReview = queues.reviewDue.find(v => !recentlyRatedIds.has(v.id));
    if (nextReview) {
      console.log('[Queue] Selected: review (', remainingReviews, 'remaining )');
      return nextReview;
    }
  }

  // Priority 4: New cards (check limits)
  const remainingNew = options.maxNewCardsPerDay - todayStats.newIntroducedToday;
  const reviewLimitReached = todayStats.reviewsDoneToday >= options.maxReviewsPerDay;
  const canIntroduceNew = remainingNew > 0 && (options.newIgnoresReviewLimit || !reviewLimitReached);

  if (canIntroduceNew) {
    const nextNew = queues.newCards.find(v => !recentlyRatedIds.has(v.id));
    if (nextNew) {
      console.log('[Queue] Selected: new card (', remainingNew, 'remaining )');
      return nextNew;
    }
  }

  console.log('[Queue] No cards available');
  return null;
}

/**
 * Determine session end state
 * @param {QueueInfo} queues
 * @param {TodayStats} todayStats
 * @param {SchedulerOptions} options
 * @returns {{isDone: boolean, reason: string, hasLearningPending: boolean}}
 */
export function getSessionEndState(queues, todayStats, options) {
  const hasIntradayLearning = queues.intradayLearning.length > 0;
  const hasInterdayLearning = queues.interdayLearning.length > 0;
  const hasReviewDue = queues.reviewDue.length > 0;
  const hasNewAvailable = queues.newCards.length > 0;
  const hasLearningPending = queues.totalLearning > 0;

  // If learning exists (any state), prioritize that in messaging
  if (hasIntradayLearning || hasInterdayLearning) {
    return {
      isDone: false,
      reason: 'learning_available',
      hasLearningPending: true
    };
  }

  // Check limits
  const remainingNew = options.maxNewCardsPerDay - todayStats.newIntroducedToday;
  const remainingReviews = options.maxReviewsPerDay - todayStats.reviewsDoneToday;
  const newLimitReached = remainingNew <= 0 && hasNewAvailable;
  const reviewLimitReached = remainingReviews <= 0 && hasReviewDue;

  if (hasLearningPending) {
    return {
      isDone: true,
      reason: 'learning_pending',
      hasLearningPending: true
    };
  }

  if (newLimitReached && !hasReviewDue) {
    return {
      isDone: true,
      reason: 'new_limit_reached',
      hasLearningPending: false
    };
  }

  if (reviewLimitReached && !hasNewAvailable) {
    return {
      isDone: true,
      reason: 'review_limit_reached',
      hasLearningPending: false
    };
  }

  if (newLimitReached && reviewLimitReached) {
    return {
      isDone: true,
      reason: 'both_limits_reached',
      hasLearningPending: false
    };
  }

  return {
    isDone: true,
    reason: 'all_done',
    hasLearningPending: false
  };
}