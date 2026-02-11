import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Brain, Clock, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeVocabArray, uiLevelToDatasetLevel, datasetLevelToUiLevel } from "@/components/utils/vocabNormalizer";
import { useSubscription } from "@/components/utils/useSubscription";

import FlashCard from "../components/flash/FlashCard";
import GradingButtons from "../components/srs/GradingButtons";
import AccuracyMeter from "../components/flash/AccuracyMeter";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";
import { loadRemainingTime, saveRemainingTime, checkAndResetIfNewDay, logTick } from "@/components/utils/timerPersistence";
import { confirmDialog } from "@/components/utils/ConfirmDialog";

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
  const [newLearnedToday, setNewLearnedToday] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  const [recentlyRatedIds, setRecentlyRatedIds] = useState(new Set());
  const [currentUsage, setCurrentUsage] = useState(0);
  const [showLimitPrompt, setShowLimitPrompt] = useState(false);
  const [limitPromptType, setLimitPromptType] = useState(null); // 'new', 'review', or 'both'
  const [statsReady, setStatsReady] = useState(false);
  const [doneReason, setDoneReason] = useState(null);
  const [dayKey] = useState(() => new Date().toISOString().split('T')[0]);
  const [remainingTime, setRemainingTime] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  
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

  const { isPremium } = useSubscription(user);

  const restMinSeconds = settings?.rest_min_seconds || 90;
  const restMaxSeconds = settings?.rest_max_seconds || 150;
  const restDurationSeconds = settings?.rest_duration_seconds || 10;
  const nightMode = settings?.night_mode || false;
  
  const remainingSeconds = remainingTime !== null ? remainingTime : (7.5 * 60);

  // Load persisted timer on mount
  useEffect(() => {
    if (isPremium) return;
    
    const userId = user?.email || 'guest';
    const currentDayKey = new Date().toISOString().split('T')[0];
    
    // Check for day change
    checkAndResetIfNewDay(userId, dayKey);
    
    // Load remaining time
    const { remainingSeconds } = loadRemainingTime(userId);
    setRemainingTime(remainingSeconds);
  }, [user, isPremium]);
  
  // Today-only extension deltas (persisted in localStorage)
  const baseMaxNewCardsPerDay = settings?.max_new_cards_per_day || 20;
  const baseMaxReviewsPerDay = settings?.max_reviews_per_day || 200;
  
  const getTodayDelta = () => {
    const storageKey = `sr:newLimitDelta:${uiLevel}:${today}`;
    const stored = localStorage.getItem(storageKey);
    return stored ? parseInt(stored, 10) : 0;
  };
  
  const todayNewDelta = getTodayDelta();
  const todayReviewDelta = 0; // Not implemented yet
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

  // Define completeSession early using useCallback
  const completeSession = useCallback(() => {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    // Save timer before completing
    if (!isPremium && remainingTime !== null) {
      const userId = user?.email || 'guest';
      saveRemainingTime(userId, remainingTime, 'finish');
    }
    
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
  }, [sessionStartTime, createSessionMutation, mode, uiLevel, correctCount, incorrectCount, isPremium, remainingTime, user]);

  // Track usage time in real-time
  useEffect(() => {
    if (isPremium || sessionComplete || remainingTime === null) return;

    const interval = setInterval(() => {
      setRemainingTime(prev => {
        const newRemaining = Math.max(0, prev - 1);
        logTick(newRemaining);
        
        if (newRemaining <= 0) {
          confirmDialog.show({
            title: "Daily Limit Reached",
            description: "You've used your 7.5 minutes today. Upgrade to Premium for unlimited access!",
            confirmText: "Upgrade Now",
            cancelText: "OK"
          }).then((ok) => {
            if (ok) navigate(createPageUrl('Subscription'));
            else navigate(createPageUrl('Home'));
          });
        }
        
        return newRemaining;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      // Save on unmount
      const userId = user?.email || 'guest';
      saveRemainingTime(userId, remainingTime, 'unmount');
    };
  }, [isPremium, sessionComplete, remainingTime, navigate, user]);

  useEffect(() => {
    const stats = calculateTodayStats(userProgress);
    setNewCardsToday(stats.newIntroducedToday);
    setNewLearnedToday(stats.newLearnedToday);
    setReviewsToday(stats.reviewsCompletedToday);
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

  const [limitLogOnce, setLimitLogOnce] = useState(false);

  const buildQueue = React.useMemo(() => {
    if (!statsReady) return [];

    const { newCards, learningCards, dueCards } = cardCategories;
    const queue = [];

    const remainingNew = Math.max(0, maxNewCardsPerDay - newCardsToday);
    
    if (!limitLogOnce) {
      console.log('[LIMIT] base=', baseMaxNewCardsPerDay, 'delta=', todayNewDelta, 'effective=', maxNewCardsPerDay, 'introducedToday=', newCardsToday);
      setLimitLogOnce(true);
    }
    
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
  }, [cardCategories, maxNewCardsPerDay, maxReviewsPerDay, newCardsToday, reviewsToday, newIgnoresReviewLimit, recentlyRatedIds, statsReady, baseMaxNewCardsPerDay, todayNewDelta, limitLogOnce]);

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
      const nextNonNew = studyQueue.slice(1).find(card => {
        const prog = userProgress.find(p => p.vocabulary_id === card.id);
        return prog && prog.state !== 'New';
      });
      
      if (nextNonNew) {
        setStudyQueue(prev => prev.slice(1));
        setCurrentCard(nextNonNew);
      } else {
        const reason = getNoCardsReason();
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
        
        setStudyQueue(buildQueue);
        setCurrentCard(nextCard);
        setStudyMode('STUDYING');
      } else {
        const reason = getNoCardsReason();
        setDoneReason(reason);
        setStudyMode('DONE');
        setCurrentCard(null);
      }
    } else if (buildQueue.length === 0 && studyQueue.length === 0 && (studyMode === 'ADVANCING' || studyMode === 'STUDYING')) {
      const reason = getNoCardsReason();
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

  const handleEndSession = async () => {
    const ok = await confirmDialog.show({
      title: "End Session Early?",
      description: "Your progress will be saved. Are you sure you want to stop now?",
      confirmText: "End Session",
      cancelText: "Keep Studying"
    });
    if (ok) {
      // Save timer before completing
      if (!isPremium && remainingTime !== null) {
        const userId = user?.email || 'guest';
        saveRemainingTime(userId, remainingTime, 'quit');
      }
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
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-muted-foreground">Loading vocabulary...</p>
        </div>
      </div>
    );
  }

  if (studyMode === 'DONE') {
    const totalLearningCount = cardCategories.totalLearning || 0;
    const nextLearning = cardCategories.nextLearningCard;

    // Unified completion screen - compact and momentum-focused
    return (
      <div className="px-3 py-4 bg-background max-w-lg mx-auto space-y-4" style={{paddingBottom: 'max(1.5rem, calc(env(safe-area-inset-bottom) + 1.5rem))'}}>
        <div className="text-center space-y-0">
          <div className="text-4xl leading-none">{totalLearningCount > 0 ? '⏰' : '🎉'}</div>
          <h2 className="text-xl font-semibold text-foreground mt-3" style={{fontFamily: "'Crimson Pro', serif"}}>
            {totalLearningCount > 0 ? 'Done for Now!' : 'All Done!'}
          </h2>
        </div>

        <div className="p-4 rounded-lg bg-card border border-border">
          <p className="font-medium mb-2 text-foreground text-sm">
            📊 Today's Progress
          </p>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between items-center">
              <span>New introduced:</span>
              <span className="font-semibold text-lg text-cyan-600">{newCardsToday} / {maxNewCardsPerDay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>New learned:</span>
              <span className="font-semibold text-lg text-blue-600">{newLearnedToday}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Reviews (older):</span>
              <span className="font-semibold text-lg text-emerald-600">{reviewsToday} / {maxReviewsPerDay}</span>
            </div>
            {totalLearningCount > 0 && (
              <>
                <div className="flex justify-between items-center">
                  <span>Learning:</span>
                  <span className="font-semibold text-lg text-amber-600">{totalLearningCount} in progress</span>
                </div>
                {nextLearning && (
                  <div className="flex justify-between items-center">
                    <span>Next card:</span>
                    <span className="font-semibold text-lg text-teal-600">~{nextLearning.minutesUntilDue} min</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <Button
          onClick={() => {
            try {
              const dayKey = new Date().toISOString().split('T')[0];
              const currentDelta = getTodayDelta();
              const nextDelta = currentDelta + 10;
              const storageKey = `sr:newLimitDelta:${uiLevel}:${dayKey}`;
              localStorage.setItem(storageKey, nextDelta.toString());
              
              setLimitLogOnce(false);
              setDoneReason(null);
              setStudyQueue([]);
              setCurrentCard(null);
              setStudyMode('STUDYING');
            } catch (e) {
              console.error('[EXTEND] ERROR', e);
            }
          }}
          className="w-full h-10 text-sm bg-amber-600 hover:bg-amber-700 text-white"
        >
          +10 New Cards (Today Only)
        </Button>

        <div className="space-y-3">
          <Button
            onClick={() => navigate(createPageUrl('FlashStudy?mode=' + mode + '&level=' + uiLevel))}
            className="w-full h-9 text-sm bg-teal-600 hover:bg-teal-700 text-white"
          >
            Switch to Flash Study
          </Button>
          <Button
            onClick={() => navigate(createPageUrl('Home'))}
            variant="outline"
            className="w-full h-9 text-sm"
          >
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-muted-foreground">Loading next card...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex flex-col bg-background" style={{paddingTop: 'env(safe-area-inset-top, 0)'}}>
      {/* Compact Header */}
      <div className="border-b border-border px-4 py-2 bg-card/95 backdrop-blur-sm flex-shrink-0" style={{minHeight: '52px'}}>
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={handleEndSession}
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          {/* Compact stats on mobile */}
          <div className="flex-1 md:hidden flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">New:</span>
              <span className="font-semibold text-cyan-700">{Math.max(0, maxNewCardsPerDay - newCardsToday)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Learning:</span>
              <span className="font-semibold text-amber-700">{cardCategories.totalLearning || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Due:</span>
              <span className="font-semibold text-emerald-700">{cardCategories.dueCards.length}</span>
            </div>
          </div>

          {/* Desktop stats */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-600" />
              <span className="text-xs text-muted-foreground">New:</span>
              <span className="font-semibold text-sm text-cyan-700">{Math.max(0, maxNewCardsPerDay - newCardsToday)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Learning:</span>
              <span className="font-semibold text-sm text-amber-700">{cardCategories.totalLearning || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span className="text-xs text-muted-foreground">Due:</span>
              <span className="font-semibold text-sm text-emerald-700">{cardCategories.dueCards.length}</span>
            </div>
            
            {!isPremium && (
              <>
                <div className="h-4 w-px bg-border"></div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Time:</span>
                  <span className={`font-semibold text-sm ${remainingSeconds < 60 ? 'text-rose-600' : 'text-teal-600'}`}>
                    {formatTime(remainingSeconds)}
                  </span>
                </div>
              </>
            )}
          </div>
          
          <Button
            onClick={handleEndSession}
            variant="ghost"
            size="sm"
            className="text-xs hidden md:inline-flex h-9"
          >
            End
          </Button>
        </div>
      </div>

      {/* Study Area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 relative" style={{paddingBottom: currentCard?._revealed ? '64px' : '16px'}}>
        {studyMode === 'ADVANCING' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs bg-muted text-foreground z-10">
            Loading next card...
          </div>
        )}
        
        {currentCard && (
          <FlashCard
            key={currentCard.id}
            vocabulary={currentCard}
            mode={mode}
            onAnswer={handleAnswer}
            showExampleSentences={settings?.show_example_sentences !== false}
            hideButtons={true}
            onRevealChange={handleRevealChange}
          />
        )}
      </div>
      
      {studyMode === 'STUDYING' && currentCard && (
        <GradingButtons
          onGrade={(rating) => handleAnswer(rating >= 3, rating)}
          nightMode={nightMode}
          revealed={currentCard?._revealed}
        />
      )}
    </div>
  );
}