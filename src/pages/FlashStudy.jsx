
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";

import FlashCard from "../components/flash/FlashCard";
import AccuracyMeter from "../components/flash/AccuracyMeter";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";

export default function FlashStudy() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'kanji_to_meaning';
  const levelParam = urlParams.get('level') || 'N5';
  const level = levelParam.toUpperCase();
  const sessionSize = parseInt(urlParams.get('size')) || 20;

  const [studyQueue, setStudyQueue] = useState([]);
  const [currentCard, setCurrentCard] = useState(null);
  const [cardsStudied, setCardsStudied] = useState(0);
  const [wordsLearned, setWordsLearned] = useState(0); // Track words that achieved 2x correct
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [reviewAfterRest, setReviewAfterRest] = useState([]);
  const [lastRestTime, setLastRestTime] = useState(Date.now());
  
  // Track streak for each card (need 2 correct in a row to be "learned")
  const [cardStreaks, setCardStreaks] = useState(new Map());
  
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

  const [nextRestDuration, setNextRestDuration] = useState(() => {
    return Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000);
  });

  // Track usage time and enforce limits
  useEffect(() => {
    // Only apply limits if user is logged in, settings are loaded, and user is not premium
    if (!settings || !user || isPremium) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - sessionStartTime) / 1000);
      const today = new Date().toISOString().split('T')[0];
      const usageDate = settings.last_usage_date;
      const isNewDay = usageDate !== today;
      
      const dailyLimit = 7.5 * 60; // 7.5 minutes in seconds
      // Calculate current total usage. If it's a new day, start with current session's elapsed seconds.
      // Otherwise, add current session's elapsed seconds to previously recorded daily usage.
      const currentTotalUsage = isNewDay ? elapsedSeconds : (settings.daily_usage_seconds || 0) + elapsedSeconds;

      if (currentTotalUsage >= dailyLimit && !sessionComplete) {
        completeSession(); // End session if limit reached
        alert("Daily study limit reached (7.5 minutes). Upgrade to Premium for unlimited access!");
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [settings, user, isPremium, sessionStartTime, sessionComplete]); // Added sessionComplete to dependencies to avoid re-triggering alert after session ends

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => base44.entities.StudySession.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
      queryClient.invalidateQueries({ queryKey: ['allSessions'] });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ vocabularyId, correct }) => {
      if (!user) return;
      
      const existing = await base44.entities.UserProgress.filter({
        vocabulary_id: vocabularyId,
        user_email: user.email
      });

      if (existing.length > 0) {
        const progress = existing[0];
        return base44.entities.UserProgress.update(progress.id, {
          correct_count: progress.correct_count + (correct ? 1 : 0),
          incorrect_count: progress.incorrect_count + (correct ? 0 : 1),
          last_reviewed: new Date().toISOString(),
        });
      } else {
        return base44.entities.UserProgress.create({
          vocabulary_id: vocabularyId,
          user_email: user.email,
          correct_count: correct ? 1 : 0,
          incorrect_count: correct ? 0 : 1,
          last_reviewed: new Date().toISOString(),
          next_review: new Date(Date.now() + 86400000).toISOString(),
        });
      }
    },
  });

  const updateUsageMutation = useMutation({
    mutationFn: async (elapsedSeconds) => {
      if (!settings || !user) return;
      
      const today = new Date().toISOString().split('T')[0];
      const usageDate = settings.last_usage_date;
      const isNewDay = usageDate !== today;
      
      const newUsage = isNewDay ? elapsedSeconds : (settings.daily_usage_seconds || 0) + elapsedSeconds;
      
      return base44.entities.UserSettings.update(settings.id, {
        daily_usage_seconds: newUsage,
        last_usage_date: today
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });

  // Initialize study queue
  useEffect(() => {
    if (vocabulary.length > 0 && studyQueue.length === 0) {
      const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
      const initial = shuffled.slice(0, Math.min(sessionSize, shuffled.length));
      setStudyQueue(initial);
      setCurrentCard(initial[0]);
      
      // Initialize streaks
      const streaks = new Map();
      initial.forEach(card => streaks.set(card.id, 0));
      setCardStreaks(streaks);
    }
  }, [vocabulary, sessionSize, studyQueue.length]);

  const totalAnswered = correctCount + incorrectCount;
  const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

  // Check for rest time
  useEffect(() => {
    const checkRestTime = setInterval(() => {
      const timeSinceLastRest = Date.now() - lastRestTime;
      if (timeSinceLastRest >= nextRestDuration && !showRest && !sessionComplete && cardsStudied > 0) {
        setShowRest(true);
      }
    }, 1000);

    return () => clearInterval(checkRestTime);
  }, [lastRestTime, nextRestDuration, showRest, sessionComplete, cardsStudied]);

  const handleAnswer = (correct) => {
    if (!currentCard) return;
    
    setCardsStudied(prev => prev + 1);
    
    if (correct) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
      setReviewAfterRest(prev => [...prev, currentCard]);
    }

    updateProgressMutation.mutate({
      vocabularyId: currentCard.id,
      correct
    });

    // Update streak for this card
    const currentStreak = cardStreaks.get(currentCard.id) || 0;
    const newStreak = correct ? currentStreak + 1 : 0;
    const newStreaks = new Map(cardStreaks);
    newStreaks.set(currentCard.id, newStreak);
    setCardStreaks(newStreaks);

    // Check if word is now "learned" (2 correct in a row)
    const wasLearned = newStreak >= 2 && currentStreak < 2;
    if (wasLearned) {
      setWordsLearned(prev => prev + 1);
    }

    // Remove current card from queue
    let newQueue = studyQueue.slice(1);
    
    // If wrong OR not yet 2 correct in a row, add back to queue
    if (!correct || newStreak < 2) {
      // Add back at a random position (between 2-5 cards ahead)
      const insertPosition = Math.min(
        Math.floor(Math.random() * 4) + 2,
        newQueue.length
      );
      newQueue.splice(insertPosition, 0, currentCard);
    }
    // else: card has 2 correct in a row, it's "learned" and removed from queue

    // Check if session is complete (all words learned OR hit session size limit)
    if (wordsLearned + (wasLearned ? 1 : 0) >= sessionSize || newQueue.length === 0) {
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

  const completeSession = () => {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    // Update usage time for free users
    if (!isPremium) {
      updateUsageMutation.mutate(duration);
    }
    
    createSessionMutation.mutate({
      mode,
      level,
      total_cards: totalAnswered,
      correct_answers: correctCount,
      accuracy,
      duration,
      session_type: 'flash',
    });

    setSessionComplete(true);
  };

  const continueAfterRest = () => {
    setShowRest(false);
    setLastRestTime(Date.now());
    setNextRestDuration(Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000));
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
      <div className="h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-xl text-slate-600">No vocabulary found for {level}</p>
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="text-teal-600 hover:text-teal-700 font-medium"
          >
            ← Back to Home
          </button>
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
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600">Preparing cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-stone-100 via-teal-50 to-cyan-50'}`}>
      <div className={`border-b px-3 md:px-6 py-2 md:py-3 flex items-center justify-between ${nightMode ? 'bg-slate-800/80 backdrop-blur-sm border-slate-700' : 'bg-white/80 backdrop-blur-sm border-stone-200'}`}>
        <AccuracyMeter
          accuracy={accuracy}
          correctCount={correctCount}
          incorrectCount={incorrectCount}
          currentCard={wordsLearned}
          totalCards={sessionSize}
          nightMode={nightMode}
        />
        
        <Button
          onClick={handleEndSession}
          variant="ghost"
          size="sm"
          className={`text-xs ${nightMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-600 hover:text-slate-800 hover:bg-stone-100'}`}
        >
          End Session
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <FlashCard
          vocabulary={currentCard}
          mode={mode}
          onAnswer={handleAnswer}
          showExampleSentences={settings?.show_example_sentences !== false}
        />
      </div>
    </div>
  );
}
