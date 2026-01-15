/**
 * FSRS Queue Manager - Anki-like study queue logic
 * 
 * Card Classification Rules:
 * - New: Never studied (no rating history), state = "New"
 * - Learning: In learning steps, state = "Learning" or "Relearning"
 * - Due: Review cards where next_review <= now
 * 
 * Priority Rules:
 * 1. Learning cards due now (earliest first)
 * 2. Due review cards (earliest first)
 * 3. New cards (only if allowed, in order)
 */

export class FSRSQueueManager {
  constructor(settings = {}) {
    // Default FSRS settings
    this.maxNewCardsPerDay = settings.max_new_cards_per_day || 20;
    this.maxReviewsPerDay = settings.max_reviews_per_day || 200;
    this.learningSteps = settings.learning_steps || [1, 10]; // minutes
    this.relearningSteps = settings.relearning_steps || [10]; // minutes
    this.graduatingInterval = settings.graduating_interval || 1; // days
    this.easyInterval = settings.easy_interval || 4; // days
    this.desiredRetention = settings.desired_retention || 0.9;
    this.learningLookaheadMinutes = settings.learning_lookahead_minutes || 20; // Anki default

    // FSRS-4 algorithm parameters
    this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
  }

  /**
   * Classify a single card based on its state and timing
   * @returns "new" | "learning" | "due" | "notAvailable"
   */
  classifyCard(card, progress, now = new Date()) {
    // No progress = New card
    if (!progress) {
      return "new";
    }

    const state = progress.state || "New";
    const nextReview = progress.next_review ? new Date(progress.next_review) : null;
    const reps = progress.reps || 0;

    // New card that hasn't been studied yet
    if (state === "New" && reps === 0) {
      return "new";
    }

    // Learning or Relearning cards
    if (state === "Learning" || state === "Relearning") {
      if (!nextReview || nextReview <= now) {
        return "learning";
      }
      return "notAvailable"; // Learning but not due yet
    }

    // Review cards
    if (state === "Review") {
      if (!nextReview || nextReview <= now) {
        return "due";
      }
      return "notAvailable"; // Review but not due yet
    }

    return "notAvailable";
  }

  /**
   * Build study queues from vocabulary and progress data
   * 
   * Returns two types of counts:
   * - Queue counts: Cards that are DUE NOW and ready to study
   * - Total counts: All cards in each state (including not yet due)
   * 
   * With Anki-like learning lookahead support
   */
  buildQueues(vocabularyList, progressMap, now = new Date(), applyLookahead = false) {
    const lookaheadWindow = applyLookahead ? this.addMinutes(now, this.learningLookaheadMinutes) : now;
    
    const queues = {
      new: [],       // Cards ready to introduce (respects daily limit)
      learning: [],  // Learning cards DUE NOW (or within lookahead)
      due: [],       // Review cards DUE NOW
      
      // 🆕 TOTAL COUNTS (for UI display)
      totalLearning: 0,  // ALL Learning cards (including not yet due)
      totalUnseen: 0,    // Total cards never studied
      nextLearningCard: null, // Next learning card and its due time (for "come back in X")
    };

    let earliestLearningCard = null;
    let earliestLearningTime = null;

    vocabularyList.forEach(vocab => {
      const progress = progressMap[vocab.id];
      const classification = this.classifyCard(vocab, progress, applyLookahead ? lookaheadWindow : now);

      const cardData = {
        ...vocab,
        progress: progress || null,
        classification
      };

      if (classification === "new") {
        queues.new.push(cardData);
        queues.totalUnseen++;
      } else if (classification === "learning") {
        queues.learning.push(cardData);
        queues.totalLearning++;
      } else if (classification === "due") {
        queues.due.push(cardData);
      } else if (classification === "notAvailable") {
        // Count cards in Learning state but not yet due
        const state = progress?.state;
        if (state === "Learning" || state === "Relearning") {
          queues.totalLearning++;
          
          // Track earliest learning card for "come back in X" display
          const nextReview = progress?.next_review ? new Date(progress.next_review) : null;
          if (nextReview && nextReview > now) {
            if (!earliestLearningTime || nextReview < earliestLearningTime) {
              earliestLearningTime = nextReview;
              earliestLearningCard = cardData;
            }
          }
        }
      }
    });

    // Sort queues according to Anki rules
    // Learning: earliest due first
    queues.learning.sort((a, b) => {
      const aNext = a.progress?.next_review ? new Date(a.progress.next_review) : new Date(0);
      const bNext = b.progress?.next_review ? new Date(b.progress.next_review) : new Date(0);
      return aNext - bNext;
    });

    // Due: earliest due first
    queues.due.sort((a, b) => {
      const aNext = a.progress?.next_review ? new Date(a.progress.next_review) : new Date(0);
      const bNext = b.progress?.next_review ? new Date(b.progress.next_review) : new Date(0);
      return aNext - bNext;
    });

    // New: keep in original order (or by vocab_index if available)
    queues.new.sort((a, b) => {
      return (a.vocab_index || 0) - (b.vocab_index || 0);
    });

    // Set next learning card info
    if (earliestLearningCard && earliestLearningTime) {
      queues.nextLearningCard = {
        card: earliestLearningCard,
        dueTime: earliestLearningTime,
        minutesUntilDue: Math.ceil((earliestLearningTime - now) / 60000)
      };
    }

    console.log('[QueueManager] Queue totals:', {
      unseenCards: queues.totalUnseen,
      learningTotal: queues.totalLearning,
      learningDue: queues.learning.length,
      reviewDue: queues.due.length,
      nextLearningIn: queues.nextLearningCard?.minutesUntilDue || 'N/A',
      lookaheadApplied: applyLookahead
    });

    return queues;
  }

  /**
   * Get the next card to study following Anki priority rules:
   * 1. Learning cards due now
   * 2. Due review cards
   * 3. New cards (if limits not exceeded)
   */
  getNextCard(queues, sessionStats = { newToday: 0, reviewsToday: 0 }) {
    // Priority 1: Learning cards
    if (queues.learning.length > 0) {
      console.log('[QueueManager] Next card: Learning queue (top priority)');
      return queues.learning[0];
    }

    // Priority 2: Due review cards
    if (queues.due.length > 0) {
      console.log('[QueueManager] Next card: Due review queue');
      return queues.due[0];
    }

    // Priority 3: New cards (check limits)
    if (queues.new.length > 0 && sessionStats.newToday < this.maxNewCardsPerDay) {
      console.log('[QueueManager] Next card: New queue (within limits)');
      return queues.new[0];
    }

    console.log('[QueueManager] No cards available');
    return null;
  }

  /**
   * Apply a rating to a card and calculate new state/timing
   * @param rating: 1=Again, 2=Hard, 3=Good, 4=Easy
   */
  applyRating(card, progress, rating, now = new Date()) {
    const currentState = progress?.state || "New";
    const learningStep = progress?.learning_step || 0;
    const reps = (progress?.reps || 0);
    const lapses = progress?.lapses || 0;
    const stability = progress?.stability || 0;
    const difficulty = progress?.difficulty || 5;

    let newState = currentState;
    let newLearningStep = learningStep;
    let newNextReview = now;
    let newStability = stability;
    let newDifficulty = difficulty;
    let newReps = reps + 1;
    let newLapses = lapses;

    console.log(`[QueueManager] Applying rating ${rating} to card in state ${currentState}, step ${learningStep}`);

    // NEW CARD FIRST RATING - Anki-like behavior
    if (currentState === "New") {
      newState = "Learning";
      newLearningStep = 0;

      if (rating === 1) { // Again → ~1m
        newNextReview = this.addMinutes(now, this.learningSteps[0]);
        newDifficulty = 7;
      } else if (rating === 2) { // Hard → ~6m (average of steps)
        const avgMinutes = this.learningSteps.length >= 2 
          ? (this.learningSteps[0] + this.learningSteps[1]) / 2
          : this.learningSteps[0];
        newNextReview = this.addMinutes(now, avgMinutes);
        newDifficulty = 6;
      } else if (rating === 3) { // Good → first step (~1m typically)
        newNextReview = this.addMinutes(now, this.learningSteps[0]);
        newDifficulty = 5;
      } else if (rating === 4) { // Easy → graduate immediately (~4d)
        newState = "Review";
        newNextReview = this.addDays(now, this.easyInterval);
        newStability = this.easyInterval;
        newDifficulty = 4;
      }

      console.log(`[QueueManager] New → ${newState}, next review: ${newNextReview.toISOString()}`);
    }
    // LEARNING CARD - Anki-like behavior
    else if (currentState === "Learning") {
      if (rating === 1) { // Again → restart (~1m)
        newLearningStep = 0;
        newNextReview = this.addMinutes(now, this.learningSteps[0]);
        newLapses = lapses + 1;
        console.log(`[QueueManager] Learning Again: reset to step 0`);
      } else if (rating === 2) { // Hard → repeat or average step
        // Anki: Hard = repeat current step (or average if no repetition)
        const currentStepMinutes = this.learningSteps[learningStep] || this.learningSteps[this.learningSteps.length - 1];
        const nextStepMinutes = this.learningSteps[learningStep + 1];
        const hardMinutes = nextStepMinutes ? (currentStepMinutes + nextStepMinutes) / 2 : currentStepMinutes;
        newNextReview = this.addMinutes(now, hardMinutes);
        console.log(`[QueueManager] Learning Hard: ${hardMinutes}m`);
      } else if (rating === 4) { // Easy → graduate (~4d)
        newState = "Review";
        newNextReview = this.addDays(now, this.easyInterval);
        newStability = this.easyInterval;
        newDifficulty = Math.max(1, difficulty - 1);
        console.log(`[QueueManager] Learning Easy: graduate to Review`);
      } else { // Good (rating === 3) → advance to next step or graduate
        const nextStep = learningStep + 1;
        if (nextStep >= this.learningSteps.length) {
          // Graduate to Review
          newState = "Review";
          newNextReview = this.addDays(now, this.graduatingInterval);
          newStability = this.graduatingInterval;
          console.log(`[QueueManager] Learning completed: graduate to Review`);
        } else {
          // Continue learning
          newLearningStep = nextStep;
          newNextReview = this.addMinutes(now, this.learningSteps[nextStep]);
          console.log(`[QueueManager] Learning advance to step ${nextStep}`);
        }
      }
    }
    // RELEARNING CARD
    else if (currentState === "Relearning") {
      if (rating === 1) { // Again - restart relearning
        newLearningStep = 0;
        newNextReview = this.addMinutes(now, this.relearningSteps[0]);
        console.log(`[QueueManager] Relearning Again: reset to step 0`);
      } else { // Advance through relearning
        const nextStep = learningStep + 1;
        if (nextStep >= this.relearningSteps.length) {
          // Return to Review
          newState = "Review";
          const { stability: s, difficulty: d } = this.calculateFSRS(
            stability,
            difficulty,
            rating,
            (progress.last_reviewed ? this.daysBetween(new Date(progress.last_reviewed), now) : 0)
          );
          newStability = s;
          newDifficulty = d;
          newNextReview = this.addDays(now, s);
          console.log(`[QueueManager] Relearning completed: return to Review, S=${s}`);
        } else {
          newLearningStep = nextStep;
          newNextReview = this.addMinutes(now, this.relearningSteps[nextStep]);
          console.log(`[QueueManager] Relearning advance to step ${nextStep}`);
        }
      }
    }
    // REVIEW CARD
    else if (currentState === "Review") {
      if (rating === 1) { // Again - lapse to relearning
        newState = "Relearning";
        newLearningStep = 0;
        newNextReview = this.addMinutes(now, this.relearningSteps[0]);
        newLapses = lapses + 1;
        newDifficulty = Math.min(10, difficulty + 1);
        console.log(`[QueueManager] Review Again: lapse to Relearning`);
      } else { // Apply FSRS
        const elapsedDays = progress.last_reviewed 
          ? this.daysBetween(new Date(progress.last_reviewed), now)
          : 0;
        
        const { stability: s, difficulty: d } = this.calculateFSRS(
          stability,
          difficulty,
          rating,
          elapsedDays
        );
        
        newStability = s;
        newDifficulty = d;
        newNextReview = this.addDays(now, s);
        console.log(`[QueueManager] Review FSRS: S=${s.toFixed(2)}, D=${d.toFixed(2)}, next=${newNextReview.toISOString()}`);
      }
    }

    const updatedProgress = {
      vocabulary_id: card.id,
      user_email: progress?.user_email,
      state: newState,
      learning_step: newLearningStep,
      next_review: newNextReview.toISOString(),
      last_reviewed: now.toISOString(),
      stability: newStability,
      difficulty: newDifficulty,
      reps: newReps,
      lapses: newLapses,
      elapsed_days: progress?.last_reviewed 
        ? this.daysBetween(new Date(progress.last_reviewed), now)
        : 0,
      scheduled_days: this.daysBetween(now, newNextReview),
      correct_count: rating >= 3 ? (progress?.correct_count || 0) + 1 : (progress?.correct_count || 0),
      incorrect_count: rating < 3 ? (progress?.incorrect_count || 0) + 1 : (progress?.incorrect_count || 0),
    };

    return updatedProgress;
  }

  /**
   * FSRS-4 Algorithm Implementation
   */
  calculateFSRS(currentStability, currentDifficulty, rating, elapsedDays) {
    // Calculate retrievability (how well remembered)
    const retrievability = Math.pow(1 + elapsedDays / (9 * currentStability), -1);

    // Update difficulty based on rating
    let newDifficulty = currentDifficulty;
    if (rating === 2) { // Hard
      newDifficulty = Math.min(10, currentDifficulty + 0.5);
    } else if (rating === 3) { // Good
      newDifficulty = Math.max(1, currentDifficulty - 0.1);
    } else if (rating === 4) { // Easy
      newDifficulty = Math.max(1, currentDifficulty - 0.3);
    }

    // Calculate new stability
    let newStability;
    if (rating === 1) { // Again
      newStability = this.w[11] * Math.pow(newDifficulty, -this.w[12]) * 
                     (Math.pow(currentStability + 1, this.w[13]) - 1) * 
                     Math.exp(this.w[14] * (1 - retrievability));
    } else { // Hard, Good, Easy
      const hardFactor = this.w[15];
      const easyFactor = this.w[16];
      
      let successStability = currentStability * 
        (1 + Math.exp(this.w[8]) * 
         (11 - newDifficulty) * 
         Math.pow(currentStability, -this.w[9]) * 
         (Math.exp((1 - retrievability) * this.w[10]) - 1));

      if (rating === 2) { // Hard
        newStability = successStability * hardFactor;
      } else if (rating === 3) { // Good
        newStability = successStability;
      } else { // Easy
        newStability = successStability * easyFactor;
      }
    }

    // Ensure minimum stability
    newStability = Math.max(0.1, newStability);
    
    return {
      stability: newStability,
      difficulty: newDifficulty
    };
  }

  // Helper functions
  addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
  }

  addDays(date, days) {
    return new Date(date.getTime() + days * 86400000);
  }

  daysBetween(date1, date2) {
    return Math.max(0, (date2 - date1) / 86400000);
  }
}

export default FSRSQueueManager;