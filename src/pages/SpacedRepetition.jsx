
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Brain, Clock } from "lucide-react";

import FlashCard from "../components/flash/FlashCard";
import AccuracyMeter from "../components/flash/AccuracyMeter";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";

export default function SpacedRepetition() {
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
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [reviewAfterRest, setReviewAfterRest] = useState([]);
  const [lastRestTime, setLastRestTime] = useState(Date.now());
  
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

  // Use settings for rest intervals
  const restMinSeconds = settings?.rest_min_seconds || 90;
  const restMaxSeconds = settings?.rest_max_seconds || 150;
  const restDurationSeconds = settings?.rest_duration_seconds || 600;
  const nightMode = settings?.night_mode || false; // Added nightMode from settings

  // Update initial rest duration based on settings
  const [nextRestDuration, setNextRestDuration] = useState(() => {
    return Math.floor(Math.random() * (restMaxSeconds - restMinSeconds) * 1000) + (restMinSeconds * 1000);
  });

  const { data: userProgress = [] } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProgress.filter({ user_email: user.email });
    },
    enabled: !!user,
  });

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

      const now = new Date();

      if (existing.length > 0) {
        const progress = existing[0];
        
        // Anki-like SRS algorithm
        let newState = progress.card_state || 'new';
        let newStep = progress.learning_step || 0;
        let newInterval = progress.interval_days || 1;
        let newEaseFactor = progress.ease_factor || 2.5;
        let newNextReview = now;
        let newLapses = progress.lapses || 0;

        if (progress.card_state === 'new' || !progress.card_state) {
          // New card
          if (correct) {
            newState = 'learning';
            newStep = 1;
            newNextReview = new Date(now.getTime() + 10 * 60000); // 10 minutes
          } else {
            newState = 'learning';
            newStep = 0;
            newNextReview = new Date(now.getTime() + 1 * 60000); // 1 minute
          }
        } else if (progress.card_state === 'learning') {
          // Learning card
          if (correct) {
            if (newStep >= 2) {
              // Graduate to review
              newState = 'review';
              newInterval = 1;
              newNextReview = new Date(now.getTime() + 1 * 86400000); // 1 day
            } else {
              // Move to next learning step
              newStep++;
              const minutes = newStep === 1 ? 10 : 1440; // 10 min or 1 day
              newNextReview = new Date(now.getTime() + minutes * 60000);
            }
          } else {
            // Reset to first learning step
            newStep = 0;
            newNextReview = new Date(now.getTime() + 1 * 60000); // 1 minute
          }
        } else if (progress.card_state === 'review') {
          // Review card
          if (correct) {
            // Increase interval using ease factor
            newInterval = Math.round(progress.interval_days * newEaseFactor);
            newEaseFactor = Math.min(2.5 + 1.0, newEaseFactor + 0.15); // Max 3.5
            newNextReview = new Date(now.getTime() + newInterval * 86400000);
          } else {
            // Lapse - back to learning
            newState = 'learning';
            newStep = 0;
            newLapses++;
            newEaseFactor = Math.max(1.3, newEaseFactor - 0.2);
            newInterval = 1;
            newNextReview = new Date(now.getTime() + 10 * 60000); // 10 minutes
          }
        }

        return base44.entities.UserProgress.update(progress.id, {
          correct_count: progress.correct_count + (correct ? 1 : 0),
          incorrect_count: progress.incorrect_count + (correct ? 0 : 1),
          last_reviewed: now.toISOString(),
          next_review: newNextReview.toISOString(),
          ease_factor: newEaseFactor,
          interval_days: newInterval,
          card_state: newState,
          learning_step: newStep,
          lapses: newLapses,
        });
      } else {
        // Brand new card
        const nextReview = correct 
          ? new Date(now.getTime() + 10 * 60000) // 10 minutes
          : new Date(now.getTime() + 1 * 60000); // 1 minute

        return base44.entities.UserProgress.create({
          vocabulary_id: vocabularyId,
          user_email: user.email,
          correct_count: correct ? 1 : 0,
          incorrect_count: correct ? 0 : 1,
          last_reviewed: now.toISOString(),
          next_review: nextReview.toISOString(),
          ease_factor: 2.5,
          interval_days: 1,
          card_state: 'learning',
          learning_step: correct ? 1 : 0,
          lapses: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProgress'] });
    },
  });

  // Categorize cards (Anki-style: New, Learning, Due)
  const cardCategories = React.useMemo(() => {
    if (!vocabulary.length) return { newCards: [], learningCards: [], dueCards: [] };
    
    const now = new Date();
    const progressMap = new Map(userProgress.map(p => [p.vocabulary_id, p]));
    
    const newCards = [];
    const learningCards = [];
    const dueCards = [];
    
    vocabulary.forEach(word => {
      const progress = progressMap.get(word.id);
      
      if (!progress || progress.card_state === 'new') {
        newCards.push(word);
      } else if (progress.card_state === 'learning') {
        const nextReview = new Date(progress.next_review);
        if (nextReview <= now) {
          learningCards.push({ word, progress });
        }
      } else if (progress.card_state === 'review') {
        const nextReview = new Date(progress.next_review);
        if (nextReview <= now) {
          dueCards.push({ word, progress });
        }
      }
    });

    // Sort by priority
    learningCards.sort((a, b) => 
      new Date(a.progress.next_review) - new Date(b.progress.next_review)
    );
    dueCards.sort((a, b) => 
      new Date(a.progress.next_review) - new Date(b.progress.next_review)
    );

    return { newCards, learningCards, dueCards };
  }, [vocabulary, userProgress]);

  // Build study queue based on Anki's algorithm
  const buildQueue = React.useMemo(() => {
    const { newCards, learningCards, dueCards } = cardCategories;
    const queue = [];
    
    // Add cards in Anki order: Due cards, Learning cards, then New cards
    // But interleave them intelligently
    const dueWords = dueCards.map(d => d.word);
    const learningWords = learningCards.map(l => l.word);
    
    // Add due cards first (most important)
    queue.push(...dueWords);
    
    // Add learning cards
    queue.push(...learningWords);
    
    // Add new cards (fill up to session size)
    const remaining = sessionSize - queue.length;
    if (remaining > 0) {
      queue.push(...newCards.slice(0, remaining));
    }
    
    return queue.slice(0, sessionSize);
  }, [cardCategories, sessionSize]);

  // Initialize study queue
  useEffect(() => {
    if (buildQueue.length > 0 && studyQueue.length === 0) {
      setStudyQueue(buildQueue);
      setCurrentCard(buildQueue[0]);
    }
  }, [buildQueue, studyQueue.length]); // Added studyQueue.length to dependencies

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

    // Remove current card from queue
    const newQueue = studyQueue.slice(1);

    // Check if session is complete
    if (cardsStudied + 1 >= sessionSize || newQueue.length === 0) {
      completeSession();
      return;
    }

    setStudyQueue(newQueue);
    setCurrentCard(newQueue[0]);
  };

  const completeSession = () => {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    
    createSessionMutation.mutate({
      mode,
      level,
      total_cards: totalAnswered,
      correct_answers: correctCount,
      accuracy,
      duration,
      session_type: 'spaced_repetition',
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

  if (buildQueue.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-xl text-slate-600">No cards due for review!</p>
          <p className="text-sm text-slate-500">Come back later or try flash study mode</p>
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
      {/* Anki-style card counts */}
      <div className={`border-b px-3 md:px-6 py-2 md:py-3 ${nightMode ? 'bg-slate-800/80 backdrop-blur-sm border-slate-700' : 'bg-white/80 backdrop-blur-sm border-stone-200'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 md:gap-2">
              <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-cyan-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>New:</span>
              <span className={`font-semibold text-cyan-700 text-sm md:text-base ${nightMode ? 'text-cyan-400' : ''}`}>{cardCategories.newCards.length}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Brain className="w-3 h-3 md:w-4 md:h-4 text-amber-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Learning:</span>
              <span className={`font-semibold text-amber-700 text-sm md:text-base ${nightMode ? 'text-amber-400' : ''}`}>{cardCategories.learningCards.length}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Due:</span>
              <span className={`font-semibold text-emerald-700 text-sm md:text-base ${nightMode ? 'text-emerald-400' : ''}`}>{cardCategories.dueCards.length}</span>
            </div>
          </div>
        </div>
      </div>

      <AccuracyMeter
        accuracy={accuracy}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        currentCard={cardsStudied + 1}
        totalCards={sessionSize}
        nightMode={nightMode}
      />

      <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
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
