
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

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

  // Initialize study queue
  useEffect(() => {
    if (vocabulary.length > 0 && studyQueue.length === 0) {
      const shuffled = [...vocabulary].sort(() => Math.random() - 0.5);
      const initial = shuffled.slice(0, Math.min(sessionSize, shuffled.length));
      setStudyQueue(initial);
      setCurrentCard(initial[0]);
    }
  }, [vocabulary, sessionSize]);

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
    
    // If wrong, add back to queue at a random position (between 2-5 cards ahead)
    if (!correct) {
      const insertPosition = Math.min(
        Math.floor(Math.random() * 4) + 2,
        newQueue.length
      );
      newQueue.splice(insertPosition, 0, currentCard);
    }

    // Check if session is complete
    if (cardsStudied + 1 >= sessionSize) {
      completeSession();
      return;
    }

    if (newQueue.length === 0) {
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
      session_type: 'flash',
    });

    setSessionComplete(true);
  };

  const continueAfterRest = () => {
    setShowRest(false);
    setLastRestTime(Date.now());
    setNextRestDuration(Math.floor(Math.random() * 60000) + 90000);
  };

  if (isLoadingAll) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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

  if (!currentCard) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">Preparing cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 overflow-hidden">
      <AccuracyMeter
        accuracy={accuracy}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        currentCard={cardsStudied + 1}
        totalCards={sessionSize}
      />

      <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-y-auto">
        <FlashCard
          vocabulary={currentCard}
          mode={mode}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}
