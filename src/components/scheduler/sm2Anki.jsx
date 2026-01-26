/**
 * SM-2 Anki-style scheduling algorithm
 * @file components/scheduler/sm2Anki.js
 */

import { CARD_STATES, RATINGS, DEFAULT_OPTIONS } from './types.js';

const MINUTES_TO_MS = 60 * 1000;
const DAYS_TO_MS = 24 * 60 * 60 * 1000;

/**
 * Get current card state from progress data
 * @param {Object} progress - UserProgress record (or null for new card)
 * @param {Object} vocabulary - Vocabulary record
 * @returns {CardData}
 */
export function getCardState(progress, vocabulary) {
  if (!progress || !progress.reps || progress.reps === 0) {
    return {
      id: vocabulary.id,
      state: CARD_STATES.NEW,
      dueAt: 0,
      intervalDays: 0,
      ease: 0,
      stepIndex: 0,
      steps: [],
      lastReviewedAt: 0,
      reps: 0,
      lapses: 0,
      firstReviewedAt: null
    };
  }

  return {
    id: progress.vocabulary_id,
    state: progress.state || CARD_STATES.NEW,
    dueAt: progress.next_review ? new Date(progress.next_review).getTime() : 0,
    intervalDays: progress.scheduled_days || 0,
    ease: progress.difficulty || 0, // Will be properly set at graduation
    stepIndex: progress.learning_step || 0,
    steps: [], // Will be set by applyRating
    lastReviewedAt: progress.last_reviewed ? new Date(progress.last_reviewed).getTime() : 0,
    reps: progress.reps || 0,
    lapses: progress.lapses || 0,
    firstReviewedAt: progress.created_date ? new Date(progress.created_date).getTime() : null
  };
}

/**
 * Apply a rating to a card and return updated state
 * @param {CardData} card
 * @param {Rating} rating - 1=Again, 2=Hard, 3=Good, 4=Easy
 * @param {number} now - Current timestamp (ms)
 * @param {SchedulerOptions} options
 * @returns {{card: CardData, todayDelta: {newIntroduced: number, reviewsDone: number}}}
 */
export function applyRating(card, rating, now, options = DEFAULT_OPTIONS) {
  const newCard = { ...card };
  newCard.lastReviewedAt = now;
  newCard.reps++;
  
  const todayDelta = { newIntroduced: 0, reviewsDone: 0 };

  console.log('[SM2] Applying rating', rating, 'to card in state', card.state);

  switch (card.state) {
    case CARD_STATES.NEW:
      return handleNewCard(newCard, rating, now, options, todayDelta);
    
    case CARD_STATES.LEARNING:
      return handleLearningCard(newCard, rating, now, options, todayDelta);
    
    case CARD_STATES.REVIEW:
      return handleReviewCard(newCard, rating, now, options, todayDelta);
    
    case CARD_STATES.RELEARNING:
      return handleRelearningCard(newCard, rating, now, options, todayDelta);
    
    default:
      console.error('[SM2] Unknown card state:', card.state);
      return { card: newCard, todayDelta };
  }
}

/**
 * Handle New card rating
 */
function handleNewCard(card, rating, now, options, todayDelta) {
  // First rating of a new card - increment newIntroduced counter
  if (!card.firstReviewedAt) {
    card.firstReviewedAt = now;
    todayDelta.newIntroduced = 1;
  }

  card.steps = [...options.learningSteps];

  if (rating === RATINGS.EASY) {
    // Easy: immediate graduation to Review
    graduateCard(card, options.easyInterval, options.startingEase, now);
    console.log('[SM2] New→Review (Easy): interval =', card.intervalDays, 'days');
  } else if (rating === RATINGS.AGAIN) {
    // Again: start learning from first step
    card.state = CARD_STATES.LEARNING;
    card.stepIndex = 0;
    card.dueAt = now + card.steps[0] * MINUTES_TO_MS;
    console.log('[SM2] New→Learning: step 0, due in', card.steps[0], 'min');
  } else {
    // Hard/Good: start learning, advance to appropriate step
    card.state = CARD_STATES.LEARNING;
    if (rating === RATINGS.HARD && card.steps.length > 1) {
      // Hard on first step: average of first two steps
      const avgStep = (card.steps[0] + card.steps[1]) / 2;
      card.dueAt = now + avgStep * MINUTES_TO_MS;
      card.stepIndex = 0;
      console.log('[SM2] New→Learning (Hard): avg step =', avgStep, 'min');
    } else {
      // Good: advance to next step (or graduate)
      card.stepIndex = 0;
      card.dueAt = now + card.steps[0] * MINUTES_TO_MS;
      console.log('[SM2] New→Learning (Good): step 0, due in', card.steps[0], 'min');
    }
  }

  return { card, todayDelta };
}

/**
 * Handle Learning card rating
 */
function handleLearningCard(card, rating, now, options, todayDelta) {
  if (!card.steps || card.steps.length === 0) {
    card.steps = [...options.learningSteps];
  }

  if (rating === RATINGS.EASY) {
    // Easy: graduate immediately
    graduateCard(card, options.easyInterval, options.startingEase, now);
    console.log('[SM2] Learning→Review (Easy): interval =', card.intervalDays, 'days');
  } else if (rating === RATINGS.AGAIN) {
    // Again: back to first step
    card.stepIndex = 0;
    card.dueAt = now + card.steps[0] * MINUTES_TO_MS;
    console.log('[SM2] Learning (Again): reset to step 0');
  } else if (rating === RATINGS.HARD) {
    // Hard: repeat current step or average with next
    if (card.stepIndex === 0 && card.steps.length > 1) {
      const avgStep = (card.steps[0] + card.steps[1]) / 2;
      card.dueAt = now + avgStep * MINUTES_TO_MS;
      console.log('[SM2] Learning (Hard): avg =', avgStep, 'min');
    } else {
      card.dueAt = now + card.steps[card.stepIndex] * MINUTES_TO_MS;
      console.log('[SM2] Learning (Hard): repeat step', card.stepIndex);
    }
  } else if (rating === RATINGS.GOOD) {
    // Good: advance to next step or graduate
    card.stepIndex++;
    if (card.stepIndex >= card.steps.length) {
      // Completed all steps - graduate
      graduateCard(card, options.graduatingInterval, options.startingEase, now);
      console.log('[SM2] Learning→Review (Good): interval =', card.intervalDays, 'days');
    } else {
      const nextStep = card.steps[card.stepIndex];
      card.dueAt = now + nextStep * MINUTES_TO_MS;
      console.log('[SM2] Learning (Good): advance to step', card.stepIndex, '=', nextStep, 'min');
    }
  }

  return { card, todayDelta };
}

/**
 * Handle Review card rating
 */
function handleReviewCard(card, rating, now, options, todayDelta) {
  // Increment review counter
  todayDelta.reviewsDone = 1;

  const currentInterval = card.intervalDays || 1;

  if (rating === RATINGS.AGAIN) {
    // Again: enter relearning, decrease ease, set lapse
    card.state = CARD_STATES.RELEARNING;
    card.ease = Math.max(1.3, card.ease + options.lapseEasePenalty);
    card.lapses++;
    card.steps = [...options.relearningSteps];
    card.stepIndex = 0;
    card.dueAt = now + card.steps[0] * MINUTES_TO_MS;
    // Store minimum interval for after relearning
    card.intervalDays = Math.max(1, Math.floor(currentInterval * 0.5)); // Reset to ~50%
    console.log('[SM2] Review→Relearning (Again): ease =', card.ease, ', minInterval =', card.intervalDays);
  } else {
    // Hard/Good/Easy: adjust ease and compute next interval
    let newInterval;

    if (rating === RATINGS.HARD) {
      card.ease = Math.max(1.3, card.ease + options.hardEasePenalty);
      newInterval = currentInterval * options.hardIntervalMultiplier * options.intervalModifier;
      console.log('[SM2] Review (Hard): ease =', card.ease, ', interval =', newInterval);
    } else if (rating === RATINGS.GOOD) {
      // Good: ease unchanged
      newInterval = currentInterval * card.ease * options.intervalModifier;
      console.log('[SM2] Review (Good): ease =', card.ease, ', interval =', newInterval);
    } else if (rating === RATINGS.EASY) {
      card.ease = card.ease + options.easyEaseBonus;
      newInterval = currentInterval * card.ease * options.easyBonus * options.intervalModifier;
      console.log('[SM2] Review (Easy): ease =', card.ease, ', interval =', newInterval);
    }

    card.intervalDays = Math.max(1, Math.round(newInterval));
    card.dueAt = now + card.intervalDays * DAYS_TO_MS;
  }

  return { card, todayDelta };
}

/**
 * Handle Relearning card rating
 */
function handleRelearningCard(card, rating, now, options, todayDelta) {
  if (!card.steps || card.steps.length === 0) {
    card.steps = [...options.relearningSteps];
  }

  if (rating === RATINGS.EASY) {
    // Easy: graduate back to Review with stored interval
    card.state = CARD_STATES.REVIEW;
    card.dueAt = now + (card.intervalDays || 1) * DAYS_TO_MS;
    console.log('[SM2] Relearning→Review (Easy): interval =', card.intervalDays, 'days');
  } else if (rating === RATINGS.AGAIN) {
    // Again: back to first relearning step
    card.stepIndex = 0;
    card.dueAt = now + card.steps[0] * MINUTES_TO_MS;
    console.log('[SM2] Relearning (Again): reset to step 0');
  } else if (rating === RATINGS.HARD) {
    // Hard: repeat current step
    if (card.stepIndex === 0 && card.steps.length > 1) {
      const avgStep = (card.steps[0] + card.steps[1]) / 2;
      card.dueAt = now + avgStep * MINUTES_TO_MS;
      console.log('[SM2] Relearning (Hard): avg =', avgStep, 'min');
    } else {
      card.dueAt = now + card.steps[card.stepIndex] * MINUTES_TO_MS;
      console.log('[SM2] Relearning (Hard): repeat step', card.stepIndex);
    }
  } else if (rating === RATINGS.GOOD) {
    // Good: advance to next step or graduate
    card.stepIndex++;
    if (card.stepIndex >= card.steps.length) {
      // Completed relearning - return to Review
      card.state = CARD_STATES.REVIEW;
      card.dueAt = now + (card.intervalDays || 1) * DAYS_TO_MS;
      console.log('[SM2] Relearning→Review (Good): interval =', card.intervalDays, 'days');
    } else {
      const nextStep = card.steps[card.stepIndex];
      card.dueAt = now + nextStep * MINUTES_TO_MS;
      console.log('[SM2] Relearning (Good): advance to step', card.stepIndex, '=', nextStep, 'min');
    }
  }

  return { card, todayDelta };
}

/**
 * Graduate a card from Learning to Review
 */
function graduateCard(card, intervalDays, startingEase, now) {
  card.state = CARD_STATES.REVIEW;
  card.intervalDays = intervalDays;
  card.ease = startingEase;
  card.dueAt = now + intervalDays * DAYS_TO_MS;
  card.stepIndex = 0;
  card.steps = [];
}

/**
 * Convert card state to UserProgress database format
 * @param {CardData} card
 * @param {string} userEmail
 * @returns {Object} UserProgress update object
 */
export function cardToProgress(card, userEmail) {
  return {
    vocabulary_id: card.id,
    user_email: userEmail,
    state: card.state,
    next_review: new Date(card.dueAt).toISOString(),
    scheduled_days: card.intervalDays,
    difficulty: card.ease,
    learning_step: card.stepIndex,
    last_reviewed: new Date(card.lastReviewedAt).toISOString(),
    reps: card.reps,
    lapses: card.lapses,
    // Store first review time for newIntroduced counter
    created_date: card.firstReviewedAt ? new Date(card.firstReviewedAt).toISOString() : undefined
  };
}