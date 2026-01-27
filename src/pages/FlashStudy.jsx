import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { normalizeVocabArray } from "@/components/utils/vocabNormalizer";

import FlashCard from "../components/flash/FlashCard";
import GradingButtons from "../components/srs/GradingButtons";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";

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

  const handleEndSession = () => {
    if (window.confirm('Are you sure you want to end this session early? Your progress will be saved.')) {
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
      <div className={`h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : ''}`}>
        <div className="text-center space-y-4">
          <p className={`text-xl ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>No vocabulary loaded for {uiLevel}</p>
          <Button
            onClick={() => navigate(createPageUrl('Home'))}
            variant="outline"
            className={nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}
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
      <div className={`h-screen flex items-center justify-center ${nightMode ? 'bg-slate-900' : ''}`}>
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Preparing cards...</p>
        </div>
      </div>
    );
  }

  const learningCount = Array.from(sessionCards.values()).filter(c => c.state === 'learning').length;
  const remainingCount = sessionSize - graduated.size;

  return (
    <div className={`min-h-screen flex flex-col ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50'}`}>
      <div className={`border-b px-3 md:px-6 py-2 md:py-3 ${nightMode ? 'bg-slate-800/80 backdrop-blur-sm border-slate-700' : 'bg-white/80 backdrop-blur-sm border-stone-200'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-2">
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Remaining:</span>
              <span className={`font-semibold text-sm md:text-base ${nightMode ? 'text-cyan-400' : 'text-cyan-700'}`}>
                {remainingCount}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Graduated:</span>
              <span className={`font-semibold text-sm md:text-base ${nightMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                {graduated.size}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Learning:</span>
              <span className={`font-semibold text-sm md:text-base ${nightMode ? 'text-amber-400' : 'text-amber-700'}`}>
                {learningCount}
              </span>
            </div>
            
            {!isPremium && (
              <>
                <div className={`h-6 w-px ${nightMode ? 'bg-slate-600' : 'bg-stone-300'} hidden md:block`}></div>
                <div className="hidden md:flex items-center gap-2">
                  <span className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Free:</span>
                  <span className={`font-semibold text-sm ${remainingSeconds < 60 ? 'text-rose-600' : nightMode ? 'text-teal-400' : 'text-teal-600'}`}>
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
            className={`text-xs ${nightMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-600 hover:text-slate-800 hover:bg-stone-100'}`}
          >
            End Session
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto gap-6">
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