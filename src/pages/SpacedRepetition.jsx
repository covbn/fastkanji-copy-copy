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

const DEBUG_SCHEDULER = true;
let lastDebugSnapshot = null;

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
  const [statsReady, setStatsReady] = useState(false);
  const [doneReason, setDoneReason] = useState(null);
  
  const handleRevealChange = useCallback((isRevealed) => {
    setCurrentCard(prev => ({ ...prev, _revealed: isRevealed }));
  }, []);
  
  const { data: rawVocabulary = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['allVocabulary'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

  // Normalize and filter vocabulary (use UI level for filtering after normalization)
  const vocabulary = React.useMemo(() => {
    const normalized = normalizeVocabArray(rawVocabulary);
    const filtered = normalized.filter(v => v.level === uiLevel);
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
    const stats = calculateTodayStats(userProgress);
    setNewCardsToday(stats.newIntroducedToday);
    setReviewsToday(stats.reviewsDoneToday);
    setStatsReady(true);
  }, [userProgress]);

  const updateProgressMutation = useMutation({
    mutationFn: async ({ vocabularyId, rating }) => {
      if (!user) return null;
      
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
      if (!vocab) return null;

      const progress = existing.length > 0 ? existing[0] : null;

      // Get current card state
      const card = getCardState(progress, vocab);

      const result = applyRating(card, rating, now, options);

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
      return { 
        newCards: [], 
        learningCards: [], 
        dueCards: [],
        totalLearning: 0,
        totalUnseen: 0,
        nextLearningCard: null
      };
    }
    
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

    const queues = buildQueues(vocabulary, userProgress, now, options);

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
    if (!statsReady) return [];

    const { newCards, learningCards, dueCards } = cardCategories;
    const queue = [];

    const remainingNew = Math.max(0, maxNewCardsPerDay - newCardsToday);
    const learningWords = learningCards.map(l => l.word).filter(w => !recentlyRatedIds.has(w.id));
    queue.push(...learningWords);

    const remainingReviews = Math.max(0, maxReviewsPerDay - reviewsToday);
    const dueWords = dueCards.map(d => d.word).filter(w => !recentlyRatedIds.has(w.id)).slice(0, remainingReviews);
    queue.push(...dueWords);

    const reviewLimitReached = remainingReviews <= 0;
    const canIntroduceNew = remainingNew > 0 && (newIgnoresReviewLimit || !reviewLimitReached);
    
    if (canIntroduceNew) {
      const newWordsToAdd = newCards.filter(w => !recentlyRatedIds.has(w.id)).slice(0, remainingNew);
      queue.push(...newWordsToAdd);
    }

    return queue;
  }, [cardCategories, maxNewCardsPerDay, maxReviewsPerDay, newCardsToday, reviewsToday, newIgnoresReviewLimit, recentlyRatedIds, statsReady]);

  const getNoCardsReason = useCallback(() => {
    const remainingNew = Math.max(0, maxNewCardsPerDay - newCardsToday);
    const canIntroduceNew = remainingNew > 0;
    const learningDueNow = cardCategories.learningCards.length;
    const reviewDue = cardCategories.dueCards.length;
    const availableNew = cardCategories.newCards.length;
    const totalLearning = cardCategories.totalLearning || 0;
    
    if (learningDueNow > 0 || reviewDue > 0) {
      return null; // Should have cards
    }
    
    if (totalLearning > 0) {
      return 'LEARNING_PENDING';
    }
    
    if (!canIntroduceNew && availableNew > 0) {
      return 'DAILY_LIMIT_REACHED';
    }
    
    if (availableNew === 0) {
      return 'NO_MORE_CARDS';
    }
    
    return 'ALL_CAUGHT_UP';
  }, [maxNewCardsPerDay, newCardsToday, cardCategories]);

  const autoSkipIfInvalidCurrentCard = useCallback(() => {
    if (!currentCard || !statsReady) return;
    
    const remainingNew = Math.max(0, maxNewCardsPerDay - newCardsToday);
    const canIntroduceNew = remainingNew > 0;
    const progress = userProgress.find(p => p.vocabulary_id === currentCard.id);
    const cardState = progress ? progress.state : 'New';
    const isNewCard = cardState === 'New';
    
    if (isNewCard && !canIntroduceNew) {
      console.error('[SR ERROR] New card selected while daily cap reached');
      const nextNonNew = studyQueue.slice(1).find(card => {
        const prog = userProgress.find(p => p.vocabulary_id === card.id);
        return prog && prog.state !== 'New';
      });
      
      if (nextNonNew) {
        setStudyQueue(prev => prev.slice(1));
        setCurrentCard(nextNonNew);
        console.log('[PICK] source=auto-skip cardState=', nextNonNew._cardState?.state || 'Unknown', 'canIntroduceNew=', canIntroduceNew);
      } else {
        const reason = getNoCardsReason();
        console.log('[DONE] reason=', reason, 'canIntroduceNew=', canIntroduceNew, 'availableNew=', cardCategories.newCards.length, 'learningNow=', cardCategories.learningCards.length, 'reviewDue=', cardCategories.dueCards.length);
        setDoneReason(reason);
        setStudyMode('DONE');
        setCurrentCard(null);
      }
    }
  }, [currentCard, statsReady, maxNewCardsPerDay, newCardsToday, userProgress, studyQueue, getNoCardsReason, cardCategories]);

  useEffect(() => {
    if (!statsReady) return;
    
    if (buildQueue.length > 0 && studyQueue.length === 0 && !sessionComplete) {
      const remainingNew = Math.max(0, maxNewCardsPerDay - newCardsToday);
      const canIntroduceNew = remainingNew > 0;
      
      let nextCard = buildQueue[0];
      let source = 'fallback';
      
      if (nextCard._cardState) {
        const state = nextCard._cardState.state;
        if (state === 'Learning' || state === 'Relearning') source = 'learning';
        else if (state === 'Review') source = 'review';
        else if (state === 'New') source = 'new';
      }
      
      if (!canIntroduceNew) {
        const progress = userProgress.find(p => p.vocabulary_id === nextCard.id);
        const isNewCard = !progress || progress.state === 'New';
        
        if (isNewCard) {
          nextCard = buildQueue.find(card => {
            const prog = userProgress.find(p => p.vocabulary_id === card.id);
            return prog && prog.state !== 'New';
          });
          source = nextCard ? 'auto-skip' : 'none';
        }
      }
      
      if (nextCard) {
        const progress = userProgress.find(p => p.vocabulary_id === nextCard.id);
        const cardState = progress ? progress.state : 'New';
        console.log('[PICK] source=', source, 'cardState=', cardState, 'canIntroduceNew=', canIntroduceNew);
        
        setStudyQueue(buildQueue);
        setCurrentCard(nextCard);
        setStudyMode('STUDYING');
      } else {
        const reason = getNoCardsReason();
        console.log('[DONE] reason=', reason, 'canIntroduceNew=', canIntroduceNew, 'availableNew=', cardCategories.newCards.length, 'learningNow=', cardCategories.learningCards.length, 'reviewDue=', cardCategories.dueCards.length);
        setDoneReason(reason);
        setStudyMode('DONE');
        setCurrentCard(null);
      }
    } else if (buildQueue.length === 0 && studyQueue.length === 0 && (studyMode === 'ADVANCING' || studyMode === 'STUDYING')) {
      const reason = getNoCardsReason();
      console.log('[DONE] reason=', reason, 'canIntroduceNew=', maxNewCardsPerDay - newCardsToday > 0, 'availableNew=', cardCategories.newCards.length);
      setDoneReason(reason);
      setStudyMode('DONE');
      setCurrentCard(null);
    }
  }, [buildQueue, studyQueue.length, sessionComplete, studyMode, maxNewCardsPerDay, newCardsToday, userProgress, statsReady, getNoCardsReason, cardCategories]);
  
  useEffect(() => {
    autoSkipIfInvalidCurrentCard();
  }, [autoSkipIfInvalidCurrentCard]);

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

    const cardId = currentCard.id;
    const finalRating = rating !== null ? rating : (correct ? 3 : 1);
    
    // 🛡️ HARD GUARD: Block New card grading if limit reached
    const progress = userProgress.find(p => p.vocabulary_id === cardId);
    const cardState = progress ? progress.state : 'New';
    const isNewCard = !progress || cardState === 'New';
    const remainingNew = maxNewCardsPerDay - newCardsToday;
    
    if (isNewCard && remainingNew <= 0) {
      console.log('[GRADE BLOCKED]');
      setRecentlyRatedIds(prev => new Set([...prev, cardId]));
      
      const nextNonNew = studyQueue.slice(1).find(card => {
        const prog = userProgress.find(p => p.vocabulary_id === card.id);
        return prog && prog.state !== 'New';
      });
      
      if (nextNonNew) {
        setStudyQueue(studyQueue.slice(1));
        setCurrentCard(nextNonNew);
        setStudyMode('STUDYING');
      } else {
        const reason = getNoCardsReason();
        console.log('[DONE] reason=', reason, 'canIntroduceNew=false');
        setDoneReason(reason);
        setStudyQueue([]);
        setStudyMode('DONE');
        setCurrentCard(null);
      }
      
      return;
    }

    setCardsStudied(prev => prev + 1);

    if (finalRating >= 3) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
      setReviewAfterRest(prev => [...prev, currentCard]);
    }

    setRecentlyRatedIds(prev => new Set([...prev, cardId]));

    setTimeout(() => {
      setRecentlyRatedIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(cardId);
        return newSet;
      });
    }, 500);

    const newQueue = studyQueue.slice(1);

    if (newQueue.length === 0) {
      setStudyQueue([]);
      setStudyMode('ADVANCING');
    } else {
      setStudyQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setStudyMode('STUDYING');
    }

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

  if (isLoadingAll || !statsReady) {
    return (
      <div className={`h-screen flex items-center justify-center ${nightMode ? 'bg-slate-900' : ''}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Loading vocabulary...</p>
        </div>
      </div>
    );
  }

  if (studyMode === 'DONE') {
    const remainingNew = maxNewCardsPerDay - newCardsToday;
    const remainingReviews = maxReviewsPerDay - reviewsToday;
    const hasNewAvailable = cardCategories.newCards.length > 0;
    const totalLearningCount = cardCategories.totalLearning || 0;
    const nextLearning = cardCategories.nextLearningCard;

    // Learning cards are ongoing reviews that must be completed regardless of daily limits
    if (doneReason === 'LEARNING_PENDING' || totalLearningCount > 0) {
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
                Switch to Flash Study
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

// Check limit-based termination (only if no learning exists)
if (doneReason === 'DAILY_LIMIT_REACHED') {
      return (
        <div className={`min-h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
          <div className="text-center space-y-6 max-w-lg">
            <div className="text-6xl">🎯</div>
            <h2 className={`text-2xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
              Daily Limit Reached
            </h2>

            <div className={`p-5 rounded-lg ${nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-stone-200'}`}>
              <p className={`font-medium mb-3 ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}>
                📊 Today's Progress
              </p>
              <div className={`space-y-2 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <div className="flex justify-between items-center">
                  <span>New cards:</span>
                  <span className="font-semibold text-cyan-600">{newCardsToday} / {maxNewCardsPerDay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Reviews:</span>
                  <span className="font-semibold text-emerald-600">{reviewsToday} / {maxReviewsPerDay}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={async () => {
                  if (!settings) return;
                  const newDelta = todayNewDelta + 10;
                  await base44.entities.UserSettings.update(settings.id, {
                    today_new_delta: newDelta,
                    last_usage_date: today
                  });
                  await queryClient.invalidateQueries(['userSettings']);
                  await queryClient.invalidateQueries(['userProgress']);
                  setDoneReason(null);
                  setStudyMode('STUDYING');
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              >
                Study more new cards today (+10)
              </Button>
              <Button
                onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + uiLevel))}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white"
              >
                Switch to Flash Study
              </Button>
            </div>
          </div>
        </div>
      );
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
          <Button onClick={() => navigate(createPageUrl('Home'))} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
            Back to Home
          </Button>
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

  if (!currentCard && studyMode === 'ADVANCING') {
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
              onRevealChange={handleRevealChange}
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