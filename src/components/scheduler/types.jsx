/**
 * Type definitions for the Anki-style scheduler
 * @file components/scheduler/types.js
 */

/**
 * @typedef {'New' | 'Learning' | 'Review' | 'Relearning'} CardState
 */

/**
 * @typedef {1 | 2 | 3 | 4} Rating
 * 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */

/**
 * @typedef {Object} CardData
 * @property {string} id - Vocabulary ID
 * @property {CardState} state - Current card state
 * @property {number} dueAt - Due timestamp (ms)
 * @property {number} intervalDays - Review interval in days (0 for learning/relearning)
 * @property {number} ease - Ease factor (2.5 default, used for reviews)
 * @property {number} stepIndex - Current step in learning/relearning
 * @property {number[]} steps - Learning/relearning steps array (in minutes)
 * @property {number} lastReviewedAt - Last review timestamp (ms)
 * @property {number} reps - Total repetitions
 * @property {number} lapses - Times card lapsed
 * @property {number|null} firstReviewedAt - First review timestamp (for new→learning transition)
 */

/**
 * @typedef {Object} SchedulerOptions
 * @property {number} maxNewCardsPerDay - Daily new card limit
 * @property {number} maxReviewsPerDay - Daily review limit
 * @property {number[]} learningSteps - Steps in minutes for new cards
 * @property {number[]} relearningSteps - Steps in minutes for lapsed cards
 * @property {number} graduatingInterval - Days after completing learning (Good)
 * @property {number} easyInterval - Days for Easy graduation
 * @property {number} startingEase - Initial ease for graduated cards (2.5 default)
 * @property {number} hardIntervalMultiplier - Multiplier for Hard on reviews (1.2)
 * @property {number} easyBonus - Bonus multiplier for Easy on reviews (1.3)
 * @property {number} intervalModifier - Global interval modifier (1.0)
 * @property {number} lapseEasePenalty - Ease decrease on lapse (-0.2)
 * @property {number} hardEasePenalty - Ease decrease on Hard (-0.15)
 * @property {number} easyEaseBonus - Ease increase on Easy (+0.15)
 * @property {boolean} newIgnoresReviewLimit - Can introduce new if reviews exhausted
 */

/**
 * @typedef {Object} TodayStats
 * @property {string} date - YYYY-MM-DD date string
 * @property {number} newIntroducedToday - Count of new cards introduced (New→Learning first rating)
 * @property {number} reviewsDoneToday - Count of review cards answered
 */

/**
 * @typedef {Object} QueueInfo
 * @property {Array} intradayLearning - Learning/relearning due now (< 1 day steps)
 * @property {Array} interdayLearning - Learning that crossed day boundary
 * @property {Array} reviewDue - Review cards due
 * @property {Array} newCards - Available new cards
 * @property {number} totalLearning - Total learning cards (any state)
 * @property {number} totalUnseen - Total new/unseen cards
 * @property {Object|null} nextLearningCard - Next card due with minutes until due
 */

export const CARD_STATES = {
  NEW: 'New',
  LEARNING: 'Learning',
  REVIEW: 'Review',
  RELEARNING: 'Relearning'
};

export const RATINGS = {
  AGAIN: 1,
  HARD: 2,
  GOOD: 3,
  EASY: 4
};

/**
 * Default Anki-like scheduler options
 * 
 * Learning Steps Explanation:
 * - With [10] (one step): New card → Learning → Review = 2 Good presses to graduate
 * - With [1, 10] (two steps): New card → Learning step 0 → step 1 → Review = 3 Good presses
 * 
 * Anki's common default is [10] or [1, 10]. We use [10] for faster graduation (2 Good presses).
 * To require 3 Good presses, change to: learningSteps: [1, 10]
 */
export const DEFAULT_OPTIONS = {
  maxNewCardsPerDay: 20,
  maxReviewsPerDay: 200,
  learningSteps: [10], // minutes - ONE step = 2 Good presses to graduate
  relearningSteps: [10], // minutes
  graduatingInterval: 1, // days
  easyInterval: 4, // days
  startingEase: 2.5,
  hardIntervalMultiplier: 1.2,
  easyBonus: 1.3,
  intervalModifier: 1.0,
  lapseEasePenalty: -0.2,
  hardEasePenalty: -0.15,
  easyEaseBonus: 0.15,
  newIgnoresReviewLimit: false
};