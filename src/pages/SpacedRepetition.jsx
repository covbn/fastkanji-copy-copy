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

// FSRS-4 Algorithm Implementation
class FSRS4 {
  constructor(params = {}) {
    // FSRS-4 default parameters (optimized for general learning)
    this.w = params.w || [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
    this.requestRetention = params.requestRetention || 0.9;
    this.maximumInterval = params.maximumInterval || 36500; // 100 years
  }

  // Calculate memory stability after review
  calculateStability(state, difficulty, stability, rating) {
    if (state === "New") {
      return this.w[rating - 1];
    }
    
    if (state === "Review" || state === "Relearning") {
      if (rating === 1) { // Again
        return this.w[11] * Math.pow(difficulty, -this.w[12]) * (Math.pow(stability + 1, this.w[13]) - 1) * Math.exp((1 - this.w[14]) * stability);
      } else if (rating === 2) { // Hard
        return stability * (1 + Math.exp(this.w[15]) * (11 - difficulty) * Math.pow(stability, -this.w[16]) * (Math.exp((1 - this.w[14]) * stability) - 1));
      } else if (rating === 3) { // Good
        return stability * (1 + Math.exp(this.w[8]) * (11 - difficulty) * Math.pow(stability, -this.w[9]) * (Math.exp((1 - this.w[10]) * stability) - 1));
      } else { // Easy
        return stability * (1 + Math.exp(this.w[15]) * (11 - difficulty) * Math.pow(stability, -this.w[16]) * (Math.exp((1 - this.w[10]) * stability) - 1));
      }
    }
    
    return stability;
  }

  // Calculate difficulty after review
  calculateDifficulty(difficulty, rating) {
    const newDifficulty = difficulty - this.w[6] * (rating - 3);
    return Math.min(Math.max(newDifficulty, 1), 10);
  }

  // Calculate next interval based on stability and desired retention
  calculateInterval(stability, desiredRetention) {
    const interval = Math.round(stability * Math.log(desiredRetention) / Math.log(0.9));
    return Math.min(Math.max(interval, 1), this.maximumInterval);
  }

  // Get retrievability (probability of recall)
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
  const [newCardsToday, setNewCardsToday] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  
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

  // Use settings for rest intervals and FSRS parameters
  const restMinSeconds = settings?.rest_min_seconds || 90;
  const restMaxSeconds = settings?.rest_max_seconds || 150;
  const restDurationSeconds = settings?.rest_duration_seconds || 600;
  const nightMode = settings?.night_mode || false;
  
  // FSRS settings
  const maxNewCardsPerDay = settings?.max_new_cards_per_day || 20;
  const maxReviewsPerDay = settings?.max_reviews_per_day || 200;
  const desiredRetention = settings?.desired_retention || 0.9;
  const learningSteps = settings?.learning_steps || [1, 10];
  const relearningSteps = settings?.relearning_steps || [10];
  const graduatingInterval = settings?.graduating_interval || 1;
  const easyInterval = settings?.easy_interval || 4;

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

  // Count today's new cards and reviews
  useEffect(() => {
    if (userProgress.length > 0) {
      const today = new Date().setHours(0, 0, 0, 0);
      const todaysProgress = userProgress.filter(p => {
        const reviewDate = new Date(p.last_reviewed).setHours(0, 0, 0, 0);
        return reviewDate === today;
      });
      
      const newCards = todaysProgress.filter(p => p.state === "New" || (p.reps === 1 && p.state === "Learning")).length;
      const reviews = todaysProgress.filter(p => p.state === "Review" || p.state === "Relearning").length;
      
      setNewCardsToday(newCards);
      setReviewsToday(reviews);
    }
  }, [userProgress]);

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
      const fsrs = new FSRS4({ requestRetention: desiredRetention });

      if (existing.length > 0) {
        const progress = existing[0];
        const state = progress.state || "New";
        const difficulty = progress.difficulty || 5;
        const stability = progress.stability || 0;
        const lastReview = progress.last_reviewed ? new Date(progress.last_reviewed) : now;
        const elapsedDays = (now - lastReview) / (1000 * 60 * 60 * 24);
        
        // Rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
        let rating = correct ? 3 : 1;
        
        let newState = state;
        let newStability = stability;
        let newDifficulty = difficulty;
        let newInterval = 0;
        let newNextReview = now;
        let newLearningStep = progress.learning_step || 0;

        if (state === "New") {
          // New card
          newStability = fsrs.calculateStability(state, difficulty, stability, rating);
          newDifficulty = fsrs.calculateDifficulty(difficulty, rating);
          
          if (rating === 1) { // Again
            newState = "Learning";
            newLearningStep = 0;
            newInterval = learningSteps[0] / (24 * 60); // Convert minutes to days
            newNextReview = new Date(now.getTime() + learningSteps[0] * 60000);
          } else if (rating === 2) { // Hard
            newState = "Learning";
            newLearningStep = 0;
            newInterval = learningSteps[0] / (24 * 60);
            newNextReview = new Date(now.getTime() + learningSteps[0] * 60000);
          } else if (rating === 3) { // Good
            newState = "Learning";
            newLearningStep = 0;
            newInterval = learningSteps[0] / (24 * 60);
            newNextReview = new Date(now.getTime() + learningSteps[0] * 60000);
          } else { // Easy - skip learning
            newState = "Review";
            newInterval = easyInterval;
            newNextReview = new Date(now.getTime() + easyInterval * 86400000);
          }
        } else if (state === "Learning") {
          // Learning card
          newStability = fsrs.calculateStability(state, difficulty, stability, rating);
          newDifficulty = fsrs.calculateDifficulty(difficulty, rating);
          
          if (rating === 1) { // Again - restart learning
            newLearningStep = 0;
            newInterval = learningSteps[0] / (24 * 60);
            newNextReview = new Date(now.getTime() + learningSteps[0] * 60000);
          } else {
            newLearningStep++;
            if (newLearningStep >= learningSteps.length) {
              // Graduate to review
              newState = "Review";
              newInterval = graduatingInterval;
              newNextReview = new Date(now.getTime() + graduatingInterval * 86400000);
            } else {
              newInterval = learningSteps[newLearningStep] / (24 * 60);
              newNextReview = new Date(now.getTime() + learningSteps[newLearningStep] * 60000);
            }
          }
        } else if (state === "Review") {
          // Review card
          newStability = fsrs.calculateStability(state, difficulty, stability, rating);
          newDifficulty = fsrs.calculateDifficulty(difficulty, rating);
          
          if (rating === 1) { // Again - move to relearning
            newState = "Relearning";
            newLearningStep = 0;
            newInterval = relearningSteps[0] / (24 * 60);
            newNextReview = new Date(now.getTime() + relearningSteps[0] * 60000);
          } else {
            newInterval = fsrs.calculateInterval(newStability, desiredRetention);
            newNextReview = new Date(now.getTime() + newInterval * 86400000);
          }
        } else if (state === "Relearning") {
          // Relearning card
          newStability = fsrs.calculateStability(state, difficulty, stability, rating);
          newDifficulty = fsrs.calculateDifficulty(difficulty, rating);
          
          if (rating === 1) { // Again - restart relearning
            newLearningStep = 0;
            newInterval = relearningSteps[0] / (24 * 60);
            newNextReview = new Date(now.getTime() + relearningSteps[0] * 60000);
          } else {
            newLearningStep++;
            if (newLearningStep >= relearningSteps.length) {
              // Graduate back to review
              newState = "Review";
              newInterval = fsrs.calculateInterval(newStability, desiredRetention);
              newNextReview = new Date(now.getTime() + newInterval * 86400000);
            } else {
              newInterval = relearningSteps[newLearningStep] / (24 * 60);
              newNextReview = new Date(now.getTime() + relearningSteps[newLearningStep] * 60000);
            }
          }
        }

        return base44.entities.UserProgress.update(progress.id, {
          correct_count: progress.correct_count + (correct ? 1 : 0),
          incorrect_count: progress.incorrect_count + (correct ? 0 : 1),
          last_reviewed: now.toISOString(),
          next_review: newNextReview.toISOString(),
          state: newState,
          stability: newStability,
          difficulty: newDifficulty,
          elapsed_days: elapsedDays,
          scheduled_days: newInterval,
          reps: (progress.reps || 0) + 1,
          lapses: progress.lapses + (correct ? 0 : 1),
          learning_step: newLearningStep,
        });
      } else {
        // Brand new card
        const fsrs = new FSRS4({ requestRetention: desiredRetention });
        const rating = correct ? 3 : 1;
        const stability = fsrs.calculateStability("New", 5, 0, rating);
        const difficulty = fsrs.calculateDifficulty(5, rating);
        
        let nextReview;
        let state;
        let interval;
        
        if (rating === 4) { // Easy - skip learning
          state = "Review";
          interval = easyInterval;
          nextReview = new Date(now.getTime() + easyInterval * 86400000);
        } else {
          state = "Learning";
          interval = learningSteps[0] / (24 * 60);
          nextReview = new Date(now.getTime() + learningSteps[0] * 60000);
        }

        return base44.entities.UserProgress.create({
          vocabulary_id: vocabularyId,
          user_email: user.email,
          correct_count: correct ? 1 : 0,
          incorrect_count: correct ? 0 : 1,
          last_reviewed: now.toISOString(),
          next_review: nextReview.toISOString(),
          state: state,
          stability: stability,
          difficulty: difficulty,
          elapsed_days: 0,
          scheduled_days: interval,
          reps: 1,
          lapses: correct ? 0 : 1,
          learning_step: 0,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProgress'] });
    },
  });

  // Categorize cards with FSRS-4
  const cardCategories = React.useMemo(() => {
    if (!vocabulary.length) return { newCards: [], learningCards: [], dueCards: [] };
    
    const now = new Date();
    const progressMap = new Map(userProgress.map(p => [p.vocabulary_id, p]));
    
    const newCards = [];
    const learningCards = [];
    const dueCards = [];
    
    vocabulary.forEach(word => {
      const progress = progressMap.get(word.id);
      
      if (!progress || progress.state === "New") {
        newCards.push(word);
      } else if (progress.state === "Learning" || progress.state === "Relearning") {
        const nextReview = new Date(progress.next_review);
        if (nextReview <= now) {
          learningCards.push({ word, progress });
        }
      } else if (progress.state === "Review") {
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

  // Build study queue respecting daily limits
  const buildQueue = React.useMemo(() => {
    const { newCards, learningCards, dueCards } = cardCategories;
    const queue = [];
    
    // Add due review cards first (most important)
    const remainingReviews = maxReviewsPerDay - reviewsToday;
    const dueWords = dueCards.map(d => d.word).slice(0, Math.max(0, remainingReviews));
    queue.push(...dueWords);
    
    // Add learning/relearning cards (always show these)
    const learningWords = learningCards.map(l => l.word);
    queue.push(...learningWords);
    
    // Add new cards (respecting daily limit)
    const remainingNew = maxNewCardsPerDay - newCardsToday;
    const newWordsToAdd = newCards.slice(0, Math.max(0, remainingNew));
    queue.push(...newWordsToAdd);
    
    return queue.slice(0, sessionSize);
  }, [cardCategories, sessionSize, maxNewCardsPerDay, maxReviewsPerDay, newCardsToday, reviewsToday]);

  // Initialize study queue
  useEffect(() => {
    if (buildQueue.length > 0 && studyQueue.length === 0) {
      setStudyQueue(buildQueue);
      setCurrentCard(buildQueue[0]);
    }
  }, [buildQueue, studyQueue.length]);

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
    const remainingNew = maxNewCardsPerDay - newCardsToday;
    const remainingReviews = maxReviewsPerDay - reviewsToday;
    
    return (
      <div className={`h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
        <div className="text-center space-y-6 max-w-md">
          <div className="text-6xl">🎉</div>
          <h2 className={`text-2xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            All Done for Today!
          </h2>
          <div className={`p-4 rounded-lg ${nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-stone-200'}`}>
            <p className={nightMode ? 'text-slate-300' : 'text-slate-700'}>
              📊 Today's Progress:
            </p>
            <div className={`mt-3 space-y-2 text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
              <p>New cards: {newCardsToday} / {maxNewCardsPerDay}</p>
              <p>Reviews: {reviewsToday} / {maxReviewsPerDay}</p>
            </div>
          </div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>
            {remainingNew === 0 && remainingReviews === 0 
              ? "You've completed all your reviews and new cards for today!"
              : "No cards are due for review right now. Come back later or try flash study mode!"}
          </p>
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
      {/* FSRS-4 card counts */}
      <div className={`border-b px-3 md:px-6 py-2 md:py-3 ${nightMode ? 'bg-slate-800/80 backdrop-blur-sm border-slate-700' : 'bg-white/80 backdrop-blur-sm border-stone-200'}`}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-6">
            <div className="flex items-center gap-1.5 md:gap-2">
              <BookOpen className="w-3 h-3 md:w-4 md:h-4 text-cyan-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>New:</span>
              <span className={`font-semibold text-cyan-700 text-sm md:text-base ${nightMode ? 'text-cyan-400' : ''}`}>
                {cardCategories.newCards.length} <span className="text-xs opacity-60">({newCardsToday}/{maxNewCardsPerDay})</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Brain className="w-3 h-3 md:w-4 md:h-4 text-amber-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Learning:</span>
              <span className={`font-semibold text-amber-700 text-sm md:text-base ${nightMode ? 'text-amber-400' : ''}`}>{cardCategories.learningCards.length}</span>
            </div>
            <div className="flex items-center gap-1.5 md:gap-2">
              <Clock className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
              <span className={`text-xs md:text-sm ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>Due:</span>
              <span className={`font-semibold text-emerald-700 text-sm md:text-base ${nightMode ? 'text-emerald-400' : ''}`}>
                {cardCategories.dueCards.length} <span className="text-xs opacity-60">({reviewsToday}/{maxReviewsPerDay})</span>
              </span>
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