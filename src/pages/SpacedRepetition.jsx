import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

import FlashCard from "../components/flash/FlashCard";
import AccuracyMeter from "../components/flash/AccuracyMeter";
import RestInterval from "../components/flash/RestInterval";
import SessionComplete from "../components/flash/SessionComplete";

export default function SpacedRepetition() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'kanji_to_meaning';
  const level = urlParams.get('level') || 'N5';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [reviewAfterRest, setReviewAfterRest] = useState([]);
  const [lastRestTime, setLastRestTime] = useState(Date.now());
  const [nextRestDuration, setNextRestDuration] = useState(() => {
    return Math.floor(Math.random() * 60000) + 90000;
  });

  const { data: vocabulary = [], isLoading } = useQuery({
    queryKey: ['vocabulary', level],
    queryFn: () => base44.entities.Vocabulary.filter({ level }),
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
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

      if (existing.length > 0) {
        const progress = existing[0];
        const newInterval = correct ? progress.interval_days * 2 : 1;
        const newEaseFactor = correct 
          ? Math.max(1.3, progress.ease_factor + 0.1)
          : Math.max(1.3, progress.ease_factor - 0.2);

        return base44.entities.UserProgress.update(progress.id, {
          correct_count: progress.correct_count + (correct ? 1 : 0),
          incorrect_count: progress.incorrect_count + (correct ? 0 : 1),
          last_reviewed: new Date().toISOString(),
          next_review: new Date(Date.now() + newInterval * 86400000).toISOString(),
          ease_factor: newEaseFactor,
          interval_days: newInterval,
        });
      } else {
        return base44.entities.UserProgress.create({
          vocabulary_id: vocabularyId,
          user_email: user.email,
          correct_count: correct ? 1 : 0,
          incorrect_count: correct ? 0 : 1,
          last_reviewed: new Date().toISOString(),
          next_review: new Date(Date.now() + 86400000).toISOString(),
          ease_factor: 2.5,
          interval_days: 1,
        });
      }
    },
  });

  // Get words due for review
  const dueWords = React.useMemo(() => {
    if (!vocabulary.length) return vocabulary;
    if (!userProgress.length) return vocabulary.slice(0, 20); // New learner gets first 20
    
    const now = new Date();
    const progressMap = new Map(userProgress.map(p => [p.vocabulary_id, p]));
    
    const wordsWithPriority = vocabulary
      .map(word => {
        const progress = progressMap.get(word.id);
        if (!progress) return { word, priority: 1000 }; // New words highest priority
        
        const nextReview = new Date(progress.next_review);
        const daysDue = Math.floor((now - nextReview) / 86400000);
        
        return { word, priority: daysDue };
      })
      .filter(({ priority }) => priority >= 0)
      .sort((a, b) => b.priority - a.priority);

    return wordsWithPriority.length > 0 
      ? wordsWithPriority.map(({ word }) => word)
      : vocabulary.slice(0, 20);
  }, [vocabulary, userProgress]);

  const totalAnswered = correctCount + incorrectCount;
  const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

  // Check for rest time
  useEffect(() => {
    const checkRestTime = setInterval(() => {
      const timeSinceLastRest = Date.now() - lastRestTime;
      if (timeSinceLastRest >= nextRestDuration && !showRest && !sessionComplete) {
        setShowRest(true);
      }
    }, 1000);

    return () => clearInterval(checkRestTime);
  }, [lastRestTime, nextRestDuration, showRest, sessionComplete]);

  const handleAnswer = (correct) => {
    const currentVocab = dueWords[currentIndex];
    
    if (correct) {
      setCorrectCount(prev => prev + 1);
    } else {
      setIncorrectCount(prev => prev + 1);
      setReviewAfterRest(prev => [...prev, currentVocab]);
    }

    updateProgressMutation.mutate({
      vocabularyId: currentVocab.id,
      correct
    });

    moveToNext();
  };

  const moveToNext = () => {
    if (currentIndex < dueWords.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      completeSession();
    }
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
    setNextRestDuration(Math.floor(Math.random() * 60000) + 90000);
    moveToNext();
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">Loading vocabulary...</p>
        </div>
      </div>
    );
  }

  if (dueWords.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-xl text-slate-600">No words available for {level}</p>
          <p className="text-sm text-slate-500">Add vocabulary words in the Dashboard or try another level</p>
          <button
            onClick={() => navigate(createPageUrl('Home'))}
            className="text-indigo-600 hover:text-indigo-700 font-medium"
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
    return <RestInterval onContinue={continueAfterRest} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 overflow-hidden">
      <AccuracyMeter
        accuracy={accuracy}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        currentCard={currentIndex + 1}
        totalCards={dueWords.length}
      />

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <FlashCard
          vocabulary={dueWords[currentIndex]}
          mode={mode}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}