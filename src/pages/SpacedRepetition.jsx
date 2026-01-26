import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Brain, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeVocabArray, uiLevelToDatasetLevel, datasetLevelToUiLevel } from "@/components/utils/vocabNormalizer";

import FlashCard from "../components/flash/FlashCard";
import GradingButtons from "../components/srs/GradingButtons";
import AccuracyMeter from "../components/flash/AccuracyMeter";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";

// New Anki-style SM-2 scheduler
import { DEFAULT_OPTIONS } from "../components/scheduler/types";
import { getCardState, applyRating, cardToProgress } from "../components/scheduler/sm2Anki";
import { buildQueues, getNextCard as getNextCardFromQueue, getSessionEndState } from "../components/scheduler/queue";
import { calculateTodayStats, getTodayDateString } from "../components/scheduler/todayStats";

export default function SpacedRepetition() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'kanji_to_meaning';
  const uiLevel = (urlParams.get('level') || 'N5').toUpperCase();

  // 🎯 STATE MACHINE: STUDYING | ADVANCING | DONE
  const [studyMode, setStudyMode] = useState('STUDYING');
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
  const [currentUsage, setCurrentUsage] = useState(0);
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);
  const [limitPromptType, setLimitPromptType] = useState(null); // 'new', 'review', or 'both'
  
  const { data: rawVocabulary = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['allVocabulary'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

  // Normalize and filter vocabulary (use UI level for filtering after normalization)
  const vocabulary = React.useMemo(() => {
    const normalized = normalizeVocabArray(rawVocabulary);
    console.log('[SR] Loaded', rawVocabulary.length, 'raw vocab,', normalized.length, 'normalized');
    console.log('[SR] UI level:', uiLevel, 'filtering normalized cards');
    const filtered = normalized.filter(v => v.level === uiLevel);
    console.log('[SR] Filtered to', filtered.length, 'cards for UI level', uiLevel);
    return filtered;
  }, [rawVocabulary, uiLevel]);

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
  
  // Today-only extension deltas (persisted in settings)
  const todayNewDelta = settings?.last_usage_date === today ? (settings?.today_new_delta || 0) : 0;
  const todayReviewDelta = settings?.last_usage_date === today ? (settings?.today_review_delta || 0) : 0;
  const baseMaxNewCardsPerDay = settings?.max_new_cards_per_day || 20;
  const baseMaxReviewsPerDay = settings?.max_reviews_per_day || 200;
  const maxNewCardsPerDay = baseMaxNewCardsPerDay + todayNewDelta;
  const maxReviewsPerDay = baseMaxReviewsPerDay + todayReviewDelta;
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
      level: uiLevel,
      total_cards: correctCount + incorrectCount,
      correct_answers: correctCount,
      accuracy: correctCount + incorrectCount > 0 ? (correctCount / (correctCount + incorrectCount)) * 100 : 0,
      duration,
      session_type: 'spaced_repetition',
    });

    setSessionComplete(true);
  }, [sessionStartTime, createSessionMutation, mode, uiLevel, correctCount, incorrectCount]);

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
    // Use new calculateTodayStats from scheduler
    const stats = calculateTodayStats(userProgress);
    
    console.log('[SR] ========== MOUNT/RELOAD STATS ==========');
    console.log('[SR] Progress records loaded:', userProgress.length);
    console.log('[SR] Stats from DB:', stats);
    console.log('[SR] Daily new limit:', maxNewCardsPerDay);
    console.log('[SR] New remaining:', Math.max(0, maxNewCardsPerDay - stats.newIntroducedToday));
    
    // Validation: newIntroducedToday must never exceed limit
    if (stats.newIntroducedToday > maxNewCardsPerDay) {
      console.error('[SR] ⚠️ CRITICAL: newIntroducedToday exceeds limit!', {
        introduced: stats.newIntroducedToday,
        limit: maxNewCardsPerDay
      });
    }
    console.log('[SR] ========================================');
    
    setNewCardsToday(stats.newIntroducedToday);
    setReviewsToday(stats.reviewsDoneToday);
  }, [userProgress, maxNewCardsPerDay]);

  const updateProgressMutation = useMutation({
    mutationFn: async ({ vocabularyId, rating }) => {
      if (!user) return null;
      
      console.log(`[SR] Updating progress for ${vocabularyId} with rating ${rating}`);
      
      const existing = await base44.entities.UserProgress.filter({
        vocabulary_id: vocabularyId,
        user_email: user.email
      });

      const now = Date.now();
      const options = {
        maxNewCardsPerDay,
        maxReviewsPerDay,
        learningSteps,
        relearningSteps,
        graduatingInterval,
        easyInterval,
        startingEase: 2.5,
        hardIntervalMultiplier: 1.2,
        easyBonus: 1.3,
        intervalModifier: 1.0,
        lapseEasePenalty: -0.2,
        hardEasePenalty: -0.15,
        easyEaseBonus: 0.15,
        newIgnoresReviewLimit
      };

      // Find the vocabulary item
      const vocab = vocabulary.find(v => v.id === vocabularyId);
      if (!vocab) {
        console.error('[SR] Vocabulary not found:', vocabularyId);
        return null;
      }

      const progress = existing.length > 0 ? existing[0] : null;

      // Get current card state
      const card = getCardState(progress, vocab);

      // Apply rating using new SM-2 scheduler
      const result = applyRating(card, rating, now, options);
      
      console.log('[SR] Rating result:', result);

      // Convert to database format
      const todayKey = new Date().toISOString().split('T')[0]; // Use simple ISO date
      const progressData = cardToProgress(result.card, user.email, todayKey);

      if (existing.length > 0) {
        return await base44.entities.UserProgress.update(progress.id, progressData);
      } else {
        return await base44.entities.UserProgress.create(progressData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProgress'] });
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
    },
  });

  const cardCategories = React.useMemo(() => {
    if (!vocabulary.length) {
      console.log('[SR] No vocabulary loaded');
      return { 
        newCards: [], 
        learningCards: [], 
        dueCards: [],
        totalLearning: 0,
        totalUnseen: 0,
        nextLearningCard: null
      };
    }
    
    console.log('[SR] Building queues from', vocabulary.length, 'vocabulary and', userProgress.length, 'progress records');
    
    const now = Date.now();
    const options = {
      maxNewCardsPerDay,
      maxReviewsPerDay,
      learningSteps,
      relearningSteps,
      graduatingInterval,
      easyInterval,
      startingEase: 2.5,
      hardIntervalMultiplier: 1.2,
      easyBonus: 1.3,
      intervalModifier: 1.0,
      lapseEasePenalty: -0.2,
      hardEasePenalty: -0.15,
      easyEaseBonus: 0.15,
      newIgnoresReviewLimit
    };

    // Build queues using new scheduler
    const queues = buildQueues(vocabulary, userProgress, now, options);

    console.log('[SR] Queues built:', {
      intradayLearning: queues.intradayLearning.length,
      interdayLearning: queues.interdayLearning.length,
      reviewDue: queues.reviewDue.length,
      newCards: queues.newCards.length,
      totalLearning: queues.totalLearning,
      totalUnseen: queues.totalUnseen
    });

    return {
      newCards: queues.newCards,
      learningCards: [...queues.intradayLearning, ...queues.interdayLearning].map(v => ({ word: v, progress: v._cardState })),
      dueCards: queues.reviewDue.map(v => ({ word: v, progress: v._cardState })),
      totalLearning: queues.totalLearning,
      totalUnseen: queues.totalUnseen,
      nextLearningCard: queues.nextLearningCard
    };
  }, [vocabulary, userProgress, maxNewCardsPerDay, maxReviewsPerDay, learningSteps, relearningSteps, graduatingInterval, easyInterval, newIgnoresReviewLimit, newCardsToday]);

  const buildQueue = React.useMemo(() => {
    const { newCards, learningCards, dueCards } = cardCategories;
    const queue = [];

    // Compute remaining new cards
    const remainingNew = Math.max(0, maxNewCardsPerDay - newCardsToday);

    console.log('[Queue] ========== BUILD QUEUE ==========');
    console.log('[Queue] Day:', getTodayDateString());
    console.log('[Queue] Daily new limit:', maxNewCardsPerDay, '(base:', baseMaxNewCardsPerDay, '+ delta:', todayNewDelta, ')');
    console.log('[Queue] New introduced today (from DB):', newCardsToday);
    console.log('[Queue] Remaining new:', remainingNew);
    console.log('[Queue] Available new cards in pool:', newCards.length);
    
    // Validation
    if (newCardsToday > maxNewCardsPerDay) {
      console.error('[Queue] ⚠️ CRITICAL: introduced count exceeds limit!', {
        introduced: newCardsToday,
        limit: maxNewCardsPerDay
      });
    }

    // Priority 1: Learning cards (already filtered to be due now or within lookahead)
    const learningWords = learningCards.map(l => l.word).filter(w => !recentlyRatedIds.has(w.id));
    queue.push(...learningWords);
    console.log('[Queue] ✓ Learning:', learningWords.length);

    // Priority 2: Due review cards (within daily limit)
    const remainingReviews = Math.max(0, maxReviewsPerDay - reviewsToday);
    const dueWords = dueCards.map(d => d.word).filter(w => !recentlyRatedIds.has(w.id)).slice(0, remainingReviews);
    queue.push(...dueWords);
    console.log('[Queue] ✓ Due:', dueWords.length, '(remaining reviews:', remainingReviews, ')');

    // Priority 3: New cards (STRICT GATING with effective count)
    const reviewLimitReached = remainingReviews <= 0;
    const canIntroduceNew = (newIgnoresReviewLimit || !reviewLimitReached) && remainingNew > 0;

    const newWordsToAdd = canIntroduceNew ? newCards.filter(w => !recentlyRatedIds.has(w.id)).slice(0, remainingNew) : [];
    queue.push(...newWordsToAdd);
    console.log('[Queue] ✓ New:', newWordsToAdd.length, '(canIntroduce:', canIntroduceNew, ', available:', newCards.length, ')');

    console.log('[Queue] Final queue:', queue.length, 'cards');
    console.log('[Queue] ====================================');
    return queue;
  }, [cardCategories, maxNewCardsPerDay, maxReviewsPerDay, newCardsToday, reviewsToday, newIgnoresReviewLimit, recentlyRatedIds, baseMaxNewCardsPerDay, todayNewDelta]);

  // 🎯 QUEUE REBUILD EFFECT: Transition between state machine modes
  useEffect(() => {
    console.log('[Effect] Queue rebuild effect:', {
      buildQueue: buildQueue.length,
      studyQueue: studyQueue.length,
      mode: studyMode,
      hasCard: !!currentCard,
      sessionComplete
    });
    
    if (buildQueue.length > 0 && studyQueue.length === 0 && !sessionComplete) {
      console.log('[Effect] 🔄 Rebuilding queue with', buildQueue.length, 'cards - mode → STUDYING');
      setStudyQueue(buildQueue);
      setCurrentCard(buildQueue[0]);
      setStudyMode('STUDYING');
    } else if (buildQueue.length === 0 && studyQueue.length === 0 && studyMode === 'ADVANCING') {
      // Queue rebuild complete and still empty - transition to DONE
      console.log('[Effect] Queue rebuild complete, no cards available - mode → DONE');
      setStudyMode('DONE');
      setCurrentCard(null);
    }
  }, [buildQueue, studyQueue.length, sessionComplete, studyMode, currentCard]);

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

    // First rating tracking is now handled in cardToProgress with first_reviewed_day_key
    // No need for pending set - DB is source of truth

    // Clear from recently rated after refetch completes
    setTimeout(() => {
      setRecentlyRatedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }, 500);

    // 🚀 OPTIMISTIC UI: Compute next card IMMEDIATELY before clearing current
    const newQueue = studyQueue.slice(1);

    if (newQueue.length === 0) {
      console.log('[SpacedRepetition] ⏳ Queue empty - mode → ADVANCING (keeping current card visible)');
      setStudyQueue([]);
      setStudyMode('ADVANCING'); // Keep card visible while computing next
      // DON'T clear currentCard - let useEffect handle transition to DONE
    } else {
      console.log('[SpacedRepetition] Moving to next card,', newQueue.length, 'cards remaining');
      setStudyQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setStudyMode('STUDYING');

      // 🚀 PERFORMANCE: Log card transition time
      requestAnimationFrame(() => {
        const nextCardRenderedTime = performance.now();
        const deltaMs = nextCardRenderedTime - tapTime;
        console.log(`[PERF] Card transition: ${deltaMs.toFixed(2)}ms`);
      });
    }

    // 🔄 BACKGROUND: Update progress and refetch IMMEDIATELY (optimized)
    updateProgressMutation.mutate({
      vocabularyId: cardId,
      rating: finalRating
    });

    refetchProgress();
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

  // 🚫 CRITICAL GUARD: NEVER show end screen unless mode is DONE
  // This prevents menu flash during ADVANCING
  console.log('[Render] Mode:', studyMode, 'Queue:', buildQueue.length, 'Card:', !!currentCard);
  
  if (studyMode === 'DONE' && buildQueue.length === 0 && !showLimitPrompt) {
    const remainingNew = maxNewCardsPerDay - newCardsToday;
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
      newToday: newCardsToday,
      nextLearningIn: nextLearning?.minutesUntilDue || 'N/A'
    });
    
    // 🎯 CRITICAL: If ANY learning cards exist (even if not due now), prioritize that over limit screens
    // Learning cards are ongoing reviews that must be completed regardless of daily limits
    if (totalLearningCount > 0) {
      return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
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
                onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + uiLevel))}
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
    const newLimitReached = newCardsToday >= maxNewCardsPerDay && hasNewAvailable;
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
      <div className={`min-h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
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
            <Button onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + uiLevel))} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
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
      <div className={`min-h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
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
                <span className="font-semibold text-cyan-600">{newCardsToday} / {maxNewCardsPerDay}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Reviews completed:</span>
                <span className="font-semibold text-emerald-600">{reviewsToday} / {maxReviewsPerDay}</span>
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
                onClick={async () => {
                  console.log('[EXTEND] ===== +10 New Cards CLICKED =====');

                  if (!user?.email) {
                    alert('You must be logged in to extend limits.');
                    return;
                  }

                  // Ensure settings exist
                  let currentSettings = settings;
                  if (!currentSettings) {
                    alert('Please visit Settings page first to initialize your preferences.');
                    navigate(createPageUrl('Settings'));
                    return;
                  }

                  console.log('[EXTEND] Before:', {
                    todayNewDelta,
                    baseLimit: baseMaxNewCardsPerDay,
                    currentEffective: maxNewCardsPerDay,
                    newToday: newCardsToday
                  });

                  const newDelta = todayNewDelta + 10;
                  console.log('[EXTEND] Updating delta:', todayNewDelta, '→', newDelta);

                  await base44.entities.UserSettings.update(currentSettings.id, {
                    today_new_delta: newDelta,
                    last_usage_date: today
                  });

                  await queryClient.invalidateQueries(['userSettings']);
                  await queryClient.invalidateQueries(['userProgress']);

                  setShowLimitPrompt(false);
                  setLimitPromptType(null);
                  setStudyMode('STUDYING');

                  console.log('[EXTEND] ===== EXTENSION COMPLETE =====');
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                + 10 New Cards (Today Only)
              </Button>
            )}
            {hasDue && (limitPromptType === 'review' || limitPromptType === 'both') && (
              <Button
                onClick={async () => {
                  if (!user?.email) {
                    alert('You must be logged in to extend limits.');
                    return;
                  }

                  let currentSettings = settings;
                  if (!currentSettings) {
                    alert('Please visit Settings page first to initialize your preferences.');
                    navigate(createPageUrl('Settings'));
                    return;
                  }

                  const newDelta = todayReviewDelta + 50;
                  await base44.entities.UserSettings.update(currentSettings.id, {
                    today_review_delta: newDelta,
                    last_usage_date: today
                  });
                  await queryClient.invalidateQueries(['userSettings']);
                  await queryClient.invalidateQueries(['userProgress']);
                  setShowLimitPrompt(false);
                  setLimitPromptType(null);
                  setStudyMode('STUDYING');
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                + 50 Reviews (Today Only)
              </Button>
            )}
            {hasNew && hasDue && limitPromptType === 'both' && (
              <Button
                onClick={async () => {
                  if (!user?.email) {
                    alert('You must be logged in to extend limits.');
                    return;
                  }

                  let currentSettings = settings;
                  if (!currentSettings) {
                    alert('Please visit Settings page first to initialize your preferences.');
                    navigate(createPageUrl('Settings'));
                    return;
                  }

                  const newNewDelta = todayNewDelta + 10;
                  const newReviewDelta = todayReviewDelta + 50;
                  await base44.entities.UserSettings.update(currentSettings.id, {
                    today_new_delta: newNewDelta,
                    today_review_delta: newReviewDelta,
                    last_usage_date: today
                  });
                  await queryClient.invalidateQueries(['userSettings']);
                  await queryClient.invalidateQueries(['userProgress']);
                  setShowLimitPrompt(false);
                  setLimitPromptType(null);
                  setStudyMode('STUDYING');
                }}
                variant="outline"
                className={`w-full ${nightMode ? 'border-amber-500 text-amber-400 hover:bg-amber-900/20' : 'border-amber-500 text-amber-700 hover:bg-amber-50'}`}
              >
                Extend Both Limits
              </Button>
            )}
            <Button
              onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + uiLevel))}
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

  // 🎯 CRITICAL: Never show loading/empty if we have a card OR if we're in ADVANCING
  // This prevents the menu flash bug
  if (!currentCard && studyMode !== 'ADVANCING' && studyMode !== 'STUDYING') {
    console.log('[Render] Showing loading screen - no card, mode:', studyMode);
    return (
      <div className={`min-h-screen flex items-center justify-center ${nightMode ? 'bg-slate-900' : ''}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Preparing cards...</p>
        </div>
      </div>
    );
  }
  
  // 🎯 If we're ADVANCING or STUDYING, we MUST have a card to show
  // If not, force back to STUDYING and wait for queue rebuild
  if (!currentCard && (studyMode === 'ADVANCING' || studyMode === 'STUDYING')) {
    console.log('[Render] WARNING: No card in ADVANCING/STUDYING mode, waiting for queue...');
    return (
      <div className={`min-h-screen flex items-center justify-center ${nightMode ? 'bg-slate-900' : ''}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Loading next card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50'}`}>
      <div className={`border-b px-3 md:px-6 py-2 md:py-3 ${nightMode ? 'bg-slate-800/80 backdrop-blur-sm border-slate-700' : 'bg-white/80 backdrop-blur-sm border-stone-200'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 md:gap-2">
              <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-cyan-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>New:</span>
              <span className={`font-semibold text-cyan-700 text-sm md:text-base ${nightMode ? 'text-cyan-400' : ''}`}>
                {Math.max(0, maxNewCardsPerDay - newCardsToday)}
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
        {studyMode === 'ADVANCING' && (
          <div className={`mb-2 px-3 py-1.5 rounded-full text-xs ${nightMode ? 'bg-slate-700 text-slate-300' : 'bg-stone-200 text-slate-600'}`}>
            Loading next card...
          </div>
        )}
        
        {currentCard && (
          <>
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
            
            {studyMode === 'STUDYING' && (
              <GradingButtons
                onGrade={(rating) => handleAnswer(rating >= 3, rating)}
                nightMode={nightMode}
                revealed={currentCard?._revealed}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}