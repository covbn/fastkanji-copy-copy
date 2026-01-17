import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Brain, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

import FlashCard from "../components/flash/FlashCard";
import GradingButtons from "../components/srs/GradingButtons";
import AccuracyMeter from "../components/flash/AccuracyMeter";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";
import FSRSQueueManager from "../components/fsrs/QueueManager";

// Legacy FSRS-4 class - kept for backward compatibility
class FSRS4 {
  constructor(params = {}) {
    this.w = params.w || [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
    this.requestRetention = params.requestRetention || 0.9;
    this.maximumInterval = params.maximumInterval || 36500;
  }

  calculateStability(state, difficulty, stability, rating) {
    if (state === "New") {
      return this.w[rating - 1];
    }
    
    if (state === "Review" || state === "Relearning") {
      if (rating === 1) {
        return this.w[11] * Math.pow(difficulty, -this.w[12]) * (Math.pow(stability + 1, this.w[13]) - 1) * Math.exp((1 - this.w[14]) * stability);
      } else if (rating === 2) {
        return stability * (1 + Math.exp(this.w[15]) * (11 - difficulty) * Math.pow(stability, -this.w[16]) * (Math.exp((1 - this.w[14]) * stability) - 1));
      } else if (rating === 3) {
        return stability * (1 + Math.exp(this.w[8]) * (11 - difficulty) * Math.pow(stability, -this.w[9]) * (Math.exp((1 - this.w[10]) * stability) - 1));
      } else {
        return stability * (1 + Math.exp(this.w[15]) * (11 - difficulty) * Math.pow(stability, -this.w[16]) * (Math.exp((1 - this.w[10]) * stability) - 1));
      }
    }
    
    return stability;
  }

  calculateDifficulty(difficulty, rating) {
    const newDifficulty = difficulty - this.w[6] * (rating - 3);
    return Math.min(Math.max(newDifficulty, 1), 10);
  }

  calculateInterval(stability, desiredRetention) {
    const interval = Math.round(stability * Math.log(desiredRetention) / Math.log(0.9));
    return Math.min(Math.max(interval, 1), this.maximumInterval);
  }

  getRetrievability(elapsedDays, stability) {
    return Math.pow(1 + elapsedDays / (9 * stability), -1);
  }
}

export default function SpacedRepetition() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'kanji_to_meaning';
  const levelParam = urlParams.get('level') || 'N5';
  const level = levelParam.toUpperCase();

  const [studyQueue, setStudyQueue] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [cardsStudied, setCardsStudied] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [reviewAfterRest, setReviewAfterRest] = useState([]);
  const [lastRestTime, setLastRestTime] = useState(Date.now());
  const [newCardsToday, setNewCardsToday] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  const [recentlyRatedIds, setRecentlyRatedIds] = useState(new Set());
  const [pendingNewIntroCardIds, setPendingNewIntroCardIds] = useState(new Set());
  const [currentUsage, setCurrentUsage] = useState(0);
  const [tempNewCardLimit, setTempNewCardLimit] = useState(null);
  const [tempReviewLimit, setTempReviewLimit] = useState(null);
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);
  const [limitPromptType, setLimitPromptType] = useState(null); // 'new', 'review', or 'both'
  
  const { data: allVocabulary = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['allVocabulary'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

  const vocabulary = React.useMemo(() => {
    return allVocabulary.filter(v => v.level === level);
  }, [allVocabulary, level]);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const existing = await base44.entities.UserSettings.filter({ user_email: user.email });
      return existing.length > 0 ? existing[0] : null;
    },
    enabled: !!user,
  });

  const restMinSeconds = settings?.rest_min_seconds || 90;
  const restMaxSeconds = settings?.rest_max_seconds || 150;
  const restDurationSeconds = settings?.rest_duration_seconds || 10;
  const nightMode = settings?.night_mode || false;
  const isPremium = settings?.subscription_status === 'premium';
  
  const dailyLimit = 7.5 * 60;
  const today = new Date().toISOString().split('T')[0];
  const usageDate = settings?.last_usage_date;
  const isNewDay = usageDate !== today;
  const baseUsage = isNewDay ? 0 : (settings?.daily_usage_seconds || 0);
  const totalUsage = baseUsage + currentUsage;
  const remainingSeconds = Math.max(0, dailyLimit - totalUsage);
  
  const maxNewCardsPerDay = tempNewCardLimit || settings?.max_new_cards_per_day || 20;
  const maxReviewsPerDay = tempReviewLimit || settings?.max_reviews_per_day || 200;
  const newIgnoresReviewLimit = settings?.new_ignores_review_limit || false; // Anki default: OFF
  const desiredRetention = settings?.desired_retention || 0.9;
  const learningSteps = settings?.learning_steps || [1, 10];
  const relearningSteps = settings?.relearning_steps || [10];
  const graduatingInterval = settings?.graduating_interval || 1;
  const easyInterval = settings?.easy_interval || 4;

  const [nextRestDuration, setNextRestDuration] = useState(() => {
    return Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000);
  });

  const { data: userProgress = [], refetch: refetchProgress } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: async () => {
      if (!user) return [];
      const allProgress = await base44.entities.UserProgress.filter({ user_email: user.email });
      return allProgress;
    },
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
  });

  const totalAnswered = correctCount + incorrectCount;
  const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => base44.entities.StudySession.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
      queryClient.invalidateQueries({ queryKey: ['allSessions'] });
    },
  });

  const updateUsageMutation = useMutation({
    mutationFn: async (elapsedSeconds) => {
      if (!settings || !user) return;
      
      const today = new Date().toISOString().split('T')[0];
      const usageDate = settings.last_usage_date;
      
      let newUsage;
      if (usageDate === today) {
        newUsage = (settings.daily_usage_seconds || 0) + elapsedSeconds;
      } else {
        newUsage = elapsedSeconds;
      }
      
      return base44.entities.UserSettings.update(settings.id, {
        daily_usage_seconds: newUsage,
        last_usage_date: today
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });

  // Define completeSession early using useCallback
  const completeSession = useCallback(() => {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    createSessionMutation.mutate({
      mode,
      level,
      total_cards: correctCount + incorrectCount,
      correct_answers: correctCount,
      accuracy: correctCount + incorrectCount > 0 ? (correctCount / (correctCount + incorrectCount)) * 100 : 0,
      duration,
      session_type: 'spaced_repetition',
    });

    setSessionComplete(true);
  }, [sessionStartTime, createSessionMutation, mode, level, correctCount, incorrectCount]);

  // Track usage time in real-time
  useEffect(() => {
    if (isPremium || sessionComplete) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
      setCurrentUsage(elapsed);

      // Update usage in real-time (every 10 seconds)
      if (elapsed % 10 === 0 && elapsed > 0 && settings) {
        const currentStoredUsage = settings.daily_usage_seconds || 0;
        base44.entities.UserSettings.update(settings.id, {
          daily_usage_seconds: currentStoredUsage + 10,
          last_usage_date: today
        });
      }

      if (baseUsage + elapsed >= dailyLimit) {
        alert("Daily study limit reached (7.5 minutes). Upgrade to Premium for unlimited access!");
        navigate(createPageUrl('Subscription'));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isPremium, sessionComplete, baseUsage, dailyLimit, sessionStartTime, today, navigate, settings]);

  useEffect(() => {
    if (userProgress.length > 0) {
      const today = new Date().setHours(0, 0, 0, 0);

      // 🎯 COUNT NEW CARDS INTRODUCED TODAY
      // A card is "introduced today" if its progress record was created today (first rating happened today)
      const newToday = userProgress.filter(p => {
        if (!p.created_date) return false;
        const createdDate = new Date(p.created_date).setHours(0, 0, 0, 0);
        return createdDate === today && p.reps > 0;
      }).length;
      
      // 🎯 COUNT REVIEWS DONE TODAY (Review state cards reviewed today, reps > 1)
      const reviewsToday = userProgress.filter(p => {
        if (!p.last_reviewed || p.state !== "Review") return false;
        const reviewDate = new Date(p.last_reviewed).setHours(0, 0, 0, 0);
        return reviewDate === today && p.reps > 1;
      }).length;
      
      console.log('[SpacedRepetition] Daily stats - New introduced today:', newToday, ', Reviews completed today:', reviewsToday);
      
      setNewCardsToday(newToday);
      setReviewsToday(reviewsToday);
      
      // 🧹 Clean up pending set: remove IDs that are now in DB
      setPendingNewIntroCardIds(prev => {
        const newSet = new Set(prev);
        userProgress.forEach(p => {
          if (p.created_date) {
            const createdDate = new Date(p.created_date).setHours(0, 0, 0, 0);
            if (createdDate === today && p.reps > 0) {
              newSet.delete(p.vocabulary_id);
            }
          }
        });
        if (newSet.size !== prev.size) {
          console.log('[SpacedRepetition] Cleaned pending new intro IDs:', prev.size - newSet.size);
        }
        return newSet;
      });
    } else {
      setNewCardsToday(0);
      setReviewsToday(0);
    }
  }, [userProgress]);

  const updateProgressMutation = useMutation({
    mutationFn: async ({ vocabularyId, rating }) => {
      if (!user) return null;
      
      console.log(`[SpacedRepetition] Updating progress for ${vocabularyId} with rating ${rating}`);
      
      const existing = await base44.entities.UserProgress.filter({
        vocabulary_id: vocabularyId,
        user_email: user.email
      });

      const now = new Date();
      const queueManager = new FSRSQueueManager({
        max_new_cards_per_day: maxNewCardsPerDay,
        max_reviews_per_day: maxReviewsPerDay,
        learning_steps: learningSteps,
        relearning_steps: relearningSteps,
        graduating_interval: graduatingInterval,
        easy_interval: easyInterval,
        desired_retention: desiredRetention,
      });

      // Find the card
      const card = vocabulary.find(v => v.id === vocabularyId);
      if (!card) {
        console.error('[SpacedRepetition] Card not found:', vocabularyId);
        return null;
      }

      const progress = existing.length > 0 ? existing[0] : null;

      // Apply rating using centralized queue manager
      const updatedProgress = queueManager.applyRating(card, progress, rating, now);
      updatedProgress.user_email = user.email;

      console.log('[SpacedRepetition] Updated progress:', updatedProgress);

      if (existing.length > 0) {
        return await base44.entities.UserProgress.update(progress.id, updatedProgress);
      } else {
        return await base44.entities.UserProgress.create(updatedProgress);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProgress'] });
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
    },
  });

  const cardCategories = React.useMemo(() => {
    if (!vocabulary.length) return { 
      newCards: [], 
      learningCards: [], 
      dueCards: [],
      totalLearning: 0,
      totalUnseen: 0,
      nextLearningCard: null
    };
    
    console.log('[SpacedRepetition] Building card categories from', vocabulary.length, 'vocabulary and', userProgress.length, 'progress records');
    
    const now = new Date();
    const progressMap = {};
    userProgress.forEach(p => {
      progressMap[p.vocabulary_id] = p;
    });

    const queueManager = new FSRSQueueManager({
      max_new_cards_per_day: maxNewCardsPerDay,
      max_reviews_per_day: maxReviewsPerDay,
      learning_steps: learningSteps,
      relearning_steps: relearningSteps,
      graduating_interval: graduatingInterval,
      easy_interval: easyInterval,
      desired_retention: desiredRetention,
      learning_lookahead_minutes: 20, // Anki default
    });

    // Build queues with lookahead if nothing strictly due
    // First try without lookahead
    const queues = queueManager.buildQueues(vocabulary, progressMap, now, false);
    
    // Apply lookahead if: no learning due, no reviews due, and can't introduce new (due to limits)
    const remainingNew = maxNewCardsPerDay - newCardsToday;
    const canIntroduceNew = queues.new.length > 0 && remainingNew > 0;
    
    let finalQueues = queues;
    if (queues.learning.length === 0 && queues.due.length === 0 && !canIntroduceNew) {
      console.log('[SpacedRepetition] No strictly due cards and no new available - applying 20m lookahead');
      finalQueues = queueManager.buildQueues(vocabulary, progressMap, now, true);
    }

    console.log('[SpacedRepetition] Queue counts:', {
      unseenTotal: finalQueues.totalUnseen,
      learningTotal: finalQueues.totalLearning,
      learningDue: finalQueues.learning.length,
      reviewDue: finalQueues.due.length,
      nextLearningIn: finalQueues.nextLearningCard?.minutesUntilDue || 'N/A'
    });

    return { 
      newCards: finalQueues.new.map(c => c), 
      learningCards: finalQueues.learning.map(c => ({ word: c, progress: c.progress })), 
      dueCards: finalQueues.due.map(c => ({ word: c, progress: c.progress })),
      totalLearning: finalQueues.totalLearning,
      totalUnseen: finalQueues.totalUnseen,
      nextLearningCard: finalQueues.nextLearningCard
    };
  }, [vocabulary, userProgress, maxNewCardsPerDay, maxReviewsPerDay, learningSteps, relearningSteps, graduatingInterval, easyInterval, desiredRetention]);

  const buildQueue = React.useMemo(() => {
    const { newCards, learningCards, dueCards } = cardCategories;
    const queue = [];

    // 🎯 EFFECTIVE NEW COUNT: DB count + pending introductions
    const effectiveNewIntroducedToday = newCardsToday + pendingNewIntroCardIds.size;

    console.log('[SpacedRepetition] Building study queue - Anki priority');
    console.log('[SpacedRepetition] Effective new introduced today:', effectiveNewIntroducedToday, '(DB:', newCardsToday, '+ pending:', pendingNewIntroCardIds.size, ')');

    // Priority 1: Learning cards (already filtered to be due now or within lookahead)
    const learningWords = learningCards.map(l => l.word).filter(w => !recentlyRatedIds.has(w.id));
    queue.push(...learningWords);
    console.log('[SpacedRepetition] ✓ Learning:', learningWords.length, '(excluded recently rated:', learningCards.length - learningWords.length, ')');

    // Priority 2: Due review cards (within daily limit)
    const remainingReviews = maxReviewsPerDay - reviewsToday;
    const dueWords = dueCards.map(d => d.word).filter(w => !recentlyRatedIds.has(w.id)).slice(0, Math.max(0, remainingReviews));
    queue.push(...dueWords);
    console.log('[SpacedRepetition] ✓ Due:', dueWords.length, '(limit:', remainingReviews, ')');

    // Priority 3: New cards (STRICT GATING with effective count)
    const remainingNew = maxNewCardsPerDay - effectiveNewIntroducedToday;
    const reviewLimitReached = remainingReviews <= 0;
    const canShowNew = (newIgnoresReviewLimit || !reviewLimitReached) && effectiveNewIntroducedToday < maxNewCardsPerDay;

    const newWordsToAdd = canShowNew ? newCards.filter(w => !recentlyRatedIds.has(w.id)).slice(0, Math.max(0, remainingNew)) : [];
    queue.push(...newWordsToAdd);
    console.log('[SpacedRepetition] ✓ New:', newWordsToAdd.length, '(remaining:', remainingNew, ', allowed:', canShowNew, ')');

    console.log('[SpacedRepetition] Final queue:', queue.length, 'cards');
    return queue;
  }, [cardCategories, maxNewCardsPerDay, maxReviewsPerDay, newCardsToday, reviewsToday, newIgnoresReviewLimit, recentlyRatedIds, pendingNewIntroCardIds]);

  useEffect(() => {
    if (buildQueue.length > 0 && studyQueue.length === 0 && !sessionComplete) {
      console.log('[SpacedRepetition] 🔄 Rebuilding queue with', buildQueue.length, 'cards');
      setStudyQueue(buildQueue);
      setCurrentCard(buildQueue[0]);
    }
  }, [buildQueue, studyQueue.length, sessionComplete]);

  useEffect(() => {
    const checkRestTime = setInterval(() => {
      const timeSinceLastRest = Date.now() - lastRestTime;
      if (timeSinceLastRest >= nextRestDuration && !showRest && !sessionComplete && cardsStudied > 0) {
        setShowRest(true);
      }
    }, 1000);

    return () => clearInterval(checkRestTime);
  }, [lastRestTime, nextRestDuration, showRest, sessionComplete, cardsStudied]);



  const handleAnswer = (correct, rating = null) => {
    if (!currentCard) return;

    // 🚀 PERFORMANCE: Record tap time
    const tapTime = performance.now();

    setCardsStudied(prev => prev + 1);

    // Use provided rating, fallback to correct/incorrect conversion
    const finalRating = rating !== null ? rating : (correct ? 3 : 1);

    if (finalRating >= 3) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
      setReviewAfterRest(prev => [...prev, currentCard]);
    }

    console.log('[SpacedRepetition] User answered with rating:', finalRating);

    // 🛡️ Prevent this card from appearing again immediately
    const cardId = currentCard.id;
    setRecentlyRatedIds(prev => new Set([...prev, cardId]));

    // 🎯 CHECK IF THIS WAS A NEW CARD (first-time introduction)
    const existingProgress = userProgress.find(p => p.vocabulary_id === cardId);
    const isNewCard = !existingProgress || existingProgress.reps === 0;
    
    if (isNewCard && !pendingNewIntroCardIds.has(cardId)) {
      console.log('[SpacedRepetition] 🆕 First-time rating of NEW card:', cardId);
      setPendingNewIntroCardIds(prev => new Set([...prev, cardId]));
    }

    // Clear from recently rated after refetch completes
    setTimeout(() => {
      setRecentlyRatedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }, 500);

    // 🚀 OPTIMISTIC UI: Move to next card IMMEDIATELY (non-blocking)
    const newQueue = studyQueue.slice(1);

    // ✅ CRITICAL FIX: Never end session in handleAnswer
    // Let the render cycle check eligibility after refetch completes
    // Just clear the queue and let buildQueue rebuild it
    if (newQueue.length === 0) {
      console.log('[SpacedRepetition] ⏳ Queue empty - clearing and will rebuild after refetch');
      setStudyQueue([]);
      setCurrentCard(null);
    } else {
      console.log('[SpacedRepetition] Moving to next card,', newQueue.length, 'cards remaining');
      setStudyQueue(newQueue);
      setCurrentCard(newQueue[0]);
    }

    // 🚀 PERFORMANCE: Log card transition time
    requestAnimationFrame(() => {
      const nextCardRenderedTime = performance.now();
      const deltaMs = nextCardRenderedTime - tapTime;
      console.log(`[PERF] Card transition: ${deltaMs.toFixed(2)}ms`);
    });

    // 🔄 BACKGROUND: Update progress in the background (non-blocking)
    updateProgressMutation.mutate({
      vocabularyId: cardId,
      rating: finalRating
    });

    // 🔄 BACKGROUND: Refetch progress to rebuild queue (non-blocking)
    setTimeout(() => {
      refetchProgress();
    }, 100);
  };

  const continueAfterRest = () => {
    setShowRest(false);
    setLastRestTime(Date.now());
    setNextRestDuration(Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000));
  };

  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end this session early? Your progress will be saved.')) {
      completeSession();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoadingAll) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600">Loading vocabulary...</p>
        </div>
      </div>
    );
  }

  if (buildQueue.length === 0 && !showLimitPrompt) {
    const effectiveNewIntroducedToday = newCardsToday + pendingNewIntroCardIds.size;
    const remainingNew = maxNewCardsPerDay - effectiveNewIntroducedToday;
    const remainingReviews = maxReviewsPerDay - reviewsToday;
    const hasLearningDue = cardCategories.learningCards.length > 0;
    const hasDueDue = cardCategories.dueCards.length > 0;
    const hasNewAvailable = cardCategories.newCards.length > 0;
    const totalLearningCount = cardCategories.totalLearning || 0;
    const nextLearning = cardCategories.nextLearningCard;
    
    console.log('[SpacedRepetition] Session end check:', {
      learningDue: hasLearningDue,
      learningTotal: totalLearningCount,
      dueDue: hasDueDue,
      newAvailable: hasNewAvailable,
      remainingNew,
      effectiveNewIntroduced: effectiveNewIntroducedToday,
      nextLearningIn: nextLearning?.minutesUntilDue || 'N/A'
    });
    
    // 🎯 CRITICAL: If ANY learning cards exist (even if not due now), prioritize that over limit screens
    // Learning cards are ongoing reviews that must be completed regardless of daily limits
    if (totalLearningCount > 0) {
      return (
        <div className={`h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
          <div className="text-center space-y-6 max-w-md">
            <div className="text-6xl">⏰</div>
            <h2 className={`text-2xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
              Done for Now!
            </h2>
            <div className={`p-4 rounded-lg ${nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-stone-200'}`}>
              <p className={nightMode ? 'text-slate-300' : 'text-slate-700'}>
                📊 Today's Progress:
              </p>
              <div className={`mt-3 space-y-2 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <p>New cards introduced: {newCardsToday} / {maxNewCardsPerDay}</p>
                <p>Reviews completed: {reviewsToday} / {maxReviewsPerDay}</p>
                <p className="text-amber-600 font-medium">{totalLearningCount} learning card{totalLearningCount !== 1 ? 's' : ''} in progress</p>
                {nextLearning && (
                  <p className="text-teal-600 font-medium">Next card in ~{nextLearning.minutesUntilDue} minute{nextLearning.minutesUntilDue !== 1 ? 's' : ''}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Button
                onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + level))}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                Continue with Flash Study (No Limits)
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('Home'))}
                variant="outline"
                className={`w-full ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    // Anki behavior: Detect termination reason (only if NO learning exists)
    // Only consider limit "reached" if we've actually hit it, not if we're negative
    const newLimitReached = effectiveNewIntroducedToday >= maxNewCardsPerDay && hasNewAvailable;
    const reviewLimitReached = reviewsToday >= maxReviewsPerDay && hasDueDue;
    
    // Check limit-based termination (only if no learning exists)
    if (newLimitReached && !hasDueDue) {
      setLimitPromptType('new');
      setShowLimitPrompt(true);
      return null;
    } else if (reviewLimitReached && hasDueDue && !hasNewAvailable) {
      setLimitPromptType('review');
      setShowLimitPrompt(true);
      return null;
    } else if (newLimitReached && reviewLimitReached) {
      setLimitPromptType('both');
      setShowLimitPrompt(true);
      return null;
    }
    
    // Truly done - nothing available
    return (
      <div className={`h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
        <div className="text-center space-y-6 max-w-md">
          <div className="text-6xl">🎉</div>
          <h2 className={`text-2xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            All Done!
          </h2>
          <div className={`p-4 rounded-lg ${nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-stone-200'}`}>
            <p className={nightMode ? 'text-slate-300' : 'text-slate-700'}>📊 Today's Progress:</p>
            <div className={`mt-3 space-y-2 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <p>New cards introduced: {newCardsToday} / {maxNewCardsPerDay}</p>
              <p>Reviews completed: {reviewsToday} / {maxReviewsPerDay}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Button onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + level))} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
              Continue with Flash Study
            </Button>
            <Button onClick={() => navigate(createPageUrl('Home'))} variant="outline" className={`w-full ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}>
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showLimitPrompt) {
    const remainingNew = maxNewCardsPerDay - newCardsToday;
    const remainingReviews = maxReviewsPerDay - reviewsToday;
    const hasNew = cardCategories.newCards.length > 0;
    const hasDue = cardCategories.dueCards.length > 0;
    
    // 🎉 ANKI-LIKE CONGRATS SCREEN
    return (
      <div className={`h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
        <div className="text-center space-y-6 max-w-lg">
          <div className="text-6xl">🎉</div>
          <h2 className={`text-2xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            {limitPromptType === 'both' ? 'Daily Limits Reached!' : 
             limitPromptType === 'review' ? 'Daily Review Limit Reached!' :
             'Daily New Card Limit Reached!'}
          </h2>
          
          <div className={`p-5 rounded-lg ${nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-stone-200'}`}>
            <p className={`font-medium mb-3 ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}>
              📊 Today's Progress:
            </p>
            <div className={`space-y-2 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <div className="flex justify-between items-center">
                <span>New cards introduced:</span>
                <span className="font-semibold text-cyan-600">{newCardsToday} / {settings?.max_new_cards_per_day || 20}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Reviews completed:</span>
                <span className="font-semibold text-emerald-600">{reviewsToday} / {settings?.max_reviews_per_day || 200}</span>
              </div>
            </div>
            
            {(hasDue || hasNew) && (
              <div className={`mt-4 pt-4 border-t ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
                <p className={`text-sm font-medium mb-2 ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  Cards Hidden by Limits:
                </p>
                <div className={`space-y-1 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  {hasDue && limitPromptType !== 'new' && (
                    <p>• {cardCategories.dueCards.length} review cards blocked</p>
                  )}
                  {hasNew && (
                    <p>• {cardCategories.newCards.length} new cards available</p>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
            You can extend today's limits (won't affect future days)
          </p>
          
          <div className="space-y-2">
            {hasNew && limitPromptType !== 'review' && (
              <Button
                onClick={() => {
                  setTempNewCardLimit((settings?.max_new_cards_per_day || 20) + 10);
                  setShowLimitPrompt(false);
                  setLimitPromptType(null);
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                + 10 New Cards (Today Only)
              </Button>
            )}
            {hasDue && (limitPromptType === 'review' || limitPromptType === 'both') && (
              <Button
                onClick={() => {
                  setTempReviewLimit((settings?.max_reviews_per_day || 200) + 50);
                  setShowLimitPrompt(false);
                  setLimitPromptType(null);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                + 50 Reviews (Today Only)
              </Button>
            )}
            {hasNew && hasDue && limitPromptType === 'both' && (
              <Button
                onClick={() => {
                  setTempNewCardLimit((settings?.max_new_cards_per_day || 20) + 10);
                  setTempReviewLimit((settings?.max_reviews_per_day || 200) + 50);
                  setShowLimitPrompt(false);
                  setLimitPromptType(null);
                }}
                variant="outline"
                className={`w-full ${nightMode ? 'border-amber-500 text-amber-400 hover:bg-amber-900/20' : 'border-amber-500 text-amber-700 hover:bg-amber-50'}`}
              >
                Extend Both Limits
              </Button>
            )}
            <Button
              onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + level))}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white"
            >
              Switch to Flash Study (No Limits)
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('Home'))}
              variant="outline"
              className={`w-full ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
            >
              Done for Today
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <SessionComplete
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        accuracy={accuracy}
        onContinue={() => navigate(createPageUrl('Home'))}
        reviewWords={reviewAfterRest}
      />
    );
  }

  if (showRest) {
    return <RestInterval onContinue={continueAfterRest} duration={restDurationSeconds} />;
  }

  if (!currentCard) {
    return (
      <div className={`h-screen flex items-center justify-center ${nightMode ? 'bg-slate-900' : ''}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Preparing cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50'}`}>
      <div className={`border-b px-3 md:px-6 py-2 md:py-3 ${nightMode ? 'bg-slate-800/80 backdrop-blur-sm border-slate-700' : 'bg-white/80 backdrop-blur-sm border-stone-200'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 md:gap-2">
              <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-cyan-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>New:</span>
              <span className={`font-semibold text-cyan-700 text-sm md:text-base ${nightMode ? 'text-cyan-400' : ''}`}>
                {Math.max(0, maxNewCardsPerDay - newCardsToday - pendingNewIntroCardIds.size)}
              </span>
              <span className={`text-xs opacity-50 ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                ({cardCategories.totalUnseen || 0} unseen)
              </span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Brain className="w-3 h-3 md:w-4 md:h-4 text-amber-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Learning:</span>
              <span className={`font-semibold text-amber-700 text-sm md:text-base ${nightMode ? 'text-amber-400' : ''}`}>
                {cardCategories.totalLearning || 0}
              </span>
              {cardCategories.learningCards.length < (cardCategories.totalLearning || 0) && (
                <span className={`text-xs opacity-50 ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  ({cardCategories.learningCards.length} due)
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Due:</span>
              <span className={`font-semibold text-emerald-700 text-sm md:text-base ${nightMode ? 'text-emerald-400' : ''}`}>
                {cardCategories.dueCards.length} <span className="text-xs opacity-60">({reviewsToday}/{maxReviewsPerDay})</span>
              </span>
            </div>
            
            <div className={`h-6 w-px ${nightMode ? 'bg-slate-600' : 'bg-stone-300'} hidden md:block`}></div>

            <div className="hidden md:flex items-center gap-3">
              <AccuracyMeter
                accuracy={accuracy}
                correctCount={correctCount}
                incorrectCount={incorrectCount}
                currentCard={0}
                totalCards={0}
                nightMode={nightMode}
                showProgress={false}
              />
              
              {!isPremium && (
                <>
                  <div className={`h-6 w-px ${nightMode ? 'bg-slate-600' : 'bg-stone-300'}`}></div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Free:</span>
                    <span className={`font-semibold text-sm ${remainingSeconds < 60 ? 'text-rose-600' : nightMode ? 'text-teal-400' : 'text-teal-600'}`}>
                      {formatTime(remainingSeconds)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <Button
            onClick={handleEndSession}
            variant="ghost"
            size="sm"
            className={`text-xs ${nightMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-600 hover:text-slate-800 hover:bg-stone-100'}`}
          >
            End Session
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto gap-6">
        <FlashCard
          key={currentCard.id}
          vocabulary={currentCard}
          mode={mode}
          onAnswer={handleAnswer}
          showExampleSentences={settings?.show_example_sentences !== false}
          hideButtons={true}
          onRevealChange={(isRevealed) => {
            // Pass reveal state to parent for grading buttons
            setCurrentCard(prev => ({ ...prev, _revealed: isRevealed }));
          }}
        />
        
        <GradingButtons
          onGrade={(rating) => handleAnswer(rating >= 3, rating)}
          nightMode={nightMode}
          revealed={currentCard?._revealed}
        />
      </div>
    </div>
  );
}