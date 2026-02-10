import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { normalizeVocabArray } from "@/components/utils/vocabNormalizer";
import { confirmDialog } from "@/components/utils/ConfirmDialog";
import { useSubscription } from "@/components/utils/useSubscription";

import FlashCard from "../components/flash/FlashCard";
import GradingButtons from "../components/srs/GradingButtons";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";
import { loadRemainingTime, saveRemainingTime, checkAndResetIfNewDay, logTick } from "@/components/utils/timerPersistence";

export default function FlashStudy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'kanji_to_meaning';
  const uiLevel = (urlParams.get('level') || 'N5').toUpperCase();
  const sessionSize = parseInt(urlParams.get('size')) || 20;

  // Session-only state (no UserProgress writes)
  const [studyQueue, setStudyQueue] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [sessionCards, setSessionCards] = useState(new Map()); // cardId -> {state: 'unseen'|'learning', goodStreak: number}
  const [graduated, setGraduated] = useState(new Set());
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [lastRestTime, setLastRestTime] = useState(Date.now());
  const [currentUsage, setCurrentUsage] = useState(0);
  const [dayKey] = useState(() => new Date().toISOString().split('T')[0]);
  const [remainingTime, setRemainingTime] = useState(null);

  const today = new Date().toISOString().split('T')[0];
  
  const { data: rawVocabulary = [], isLoading: isLoadingAll } = useQuery({
    queryKey: ['allVocabulary'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

  // Normalize and filter vocabulary (use UI level for filtering after normalization)
  const vocabulary = React.useMemo(() => {
    const normalized = normalizeVocabArray(rawVocabulary);
    console.log('[FlashStudy] Loaded', rawVocabulary.length, 'raw vocab,', normalized.length, 'normalized');
    console.log('[FlashStudy] UI level:', uiLevel, 'filtering normalized cards');
    const filtered = normalized.filter(v => v.level === uiLevel);
    console.log('[FlashStudy] Filtered to', filtered.length, 'cards for UI level', uiLevel);
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

  const [nextRestDuration, setNextRestDuration] = useState(() => {
    return Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000);
  });

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => base44.entities.StudySession.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
      queryClient.invalidateQueries({ queryKey: ['allSessions'] });
    },
  });

  const totalAnswered = correctCount + incorrectCount;
  const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

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
      session_type: 'flash',
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

  // Initialize session with random cards
  useEffect(() => {
    if (vocabulary.length > 0 && studyQueue.length === 0) {
      const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
      const initial = shuffled.slice(0, Math.min(sessionSize, shuffled.length));
      setStudyQueue(initial);
      setCurrentCard(initial[0]);
      
      const cards = new Map();
      initial.forEach(card => cards.set(card.id, { state: 'unseen', goodStreak: 0 }));
      setSessionCards(cards);
    }
  }, [vocabulary, sessionSize, studyQueue.length]);

  useEffect(() => {
    const checkRestTime = setInterval(() => {
      const timeSinceLastRest = Date.now() - lastRestTime;
      const hasAnswered = correctCount + incorrectCount > 0;
      if (timeSinceLastRest >= nextRestDuration && !showRest && !sessionComplete && hasAnswered) {
        setShowRest(true);
      }
    }, 1000);

    return () => clearInterval(checkRestTime);
  }, [lastRestTime, nextRestDuration, showRest, sessionComplete, correctCount, incorrectCount]);

  const handleRevealChange = useCallback((isRevealed) => {
    setCurrentCard(prev => prev ? { ...prev, _revealed: isRevealed } : null);
  }, []);

  const handleGrade = (rating) => {
    if (!currentCard) return;

    const cardState = sessionCards.get(currentCard.id) || { state: 'unseen', goodStreak: 0 };
    let newQueue = studyQueue.slice(1);
    let shouldGraduate = false;

    // Rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    if (rating === 4) {
      // Easy: immediate graduation
      shouldGraduate = true;
      setCorrectCount(prev => prev + 1);
    } else if (rating === 3) {
      // Good: needs two consecutive Good to graduate
      setCorrectCount(prev => prev + 1);
      if (cardState.goodStreak === 1) {
        // Second consecutive Good → graduate
        shouldGraduate = true;
      } else {
        // First Good → mark learning, requeue mid/late
        sessionCards.set(currentCard.id, { state: 'learning', goodStreak: 1 });
        const insertPos = Math.floor(newQueue.length * (0.4 + Math.random() * 0.4));
        newQueue.splice(insertPos, 0, currentCard);
      }
    } else if (rating === 2) {
      // Hard: keep in learning, reset streak, requeue mid
      setIncorrectCount(prev => prev + 1);
      sessionCards.set(currentCard.id, { state: 'learning', goodStreak: 0 });
      const insertPos = Math.floor(newQueue.length * 0.4);
      newQueue.splice(insertPos, 0, currentCard);
    } else if (rating === 1) {
      // Again: reset, requeue near front
      setIncorrectCount(prev => prev + 1);
      sessionCards.set(currentCard.id, { state: 'learning', goodStreak: 0 });
      const insertPos = Math.min(2, newQueue.length);
      newQueue.splice(insertPos, 0, currentCard);
    }

    if (shouldGraduate) {
      setGraduated(prev => new Set([...prev, currentCard.id]));
    }

    // Session complete when all graduated or queue empty
    if (graduated.size + (shouldGraduate ? 1 : 0) >= sessionSize || newQueue.length === 0) {
      completeSession();
      return;
    }

    setStudyQueue(newQueue);
    setCurrentCard(newQueue[0]);
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

  const continueAfterRest = () => {
    setShowRest(false);
    setLastRestTime(Date.now());
    setNextRestDuration(Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000));
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

  if (vocabulary.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center space-y-4">
          <p className="text-xl text-foreground">No vocabulary loaded for {uiLevel}</p>
          <Button
            onClick={() => navigate(createPageUrl('Home'))}
            variant="outline"
          >
            ← Back to Home
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
        reviewWords={[]}
      />
    );
  }

  if (showRest) {
    return <RestInterval onContinue={continueAfterRest} duration={restDurationSeconds} />;
  }

  if (!currentCard) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-muted-foreground">Preparing cards...</p>
        </div>
      </div>
    );
  }

  const learningCount = Array.from(sessionCards.values()).filter(c => c.state === 'learning').length;
  const remainingCount = sessionSize - graduated.size;

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Compact Header */}
      <div className="border-b border-border px-4 py-2 bg-card/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between gap-2">
          <Button
            onClick={handleEndSession}
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          
          {/* Progress bar on mobile */}
          <div className="flex-1 md:hidden">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Card {sessionSize - remainingCount + 1} of {sessionSize}</span>
              <span>{graduated.size} done</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300"
                style={{ width: `${(graduated.size / sessionSize) * 100}%` }}
              />
            </div>
          </div>

          {/* Stats row on desktop */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Remaining:</span>
              <span className="font-semibold text-sm text-cyan-700 dark:text-cyan-400">{remainingCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Done:</span>
              <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">{graduated.size}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Learning:</span>
              <span className="font-semibold text-sm text-amber-700 dark:text-amber-400">{learningCount}</span>
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
      <div className="flex-1 flex flex-col items-center justify-between overflow-hidden">
        <FlashCard
          vocabulary={currentCard}
          mode={mode}
          onAnswer={() => {}}
          showExampleSentences={settings?.show_example_sentences !== false}
          hideButtons={true}
          onRevealChange={handleRevealChange}
        />
        
        <GradingButtons
          onGrade={handleGrade}
          nightMode={nightMode}
          revealed={currentCard?._revealed}
        />
      </div>
    </div>
  );
}