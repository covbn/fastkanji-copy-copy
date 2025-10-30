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
  const level = urlParams.get('level') || 'N5';

  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [showRest, setShowRest] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [reviewAfterRest, setReviewAfterRest] = useState([]);
  const [cardsUntilRest, setCardsUntilRest] = useState(Math.floor(Math.random() * 11) + 10);

  const { data: vocabulary = [], isLoading } = useQuery({
    queryKey: ['vocabulary', level],
    queryFn: () => base44.entities.Vocabulary.filter({ level }),
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const createSessionMutation = useMutation({
    mutationFn: (sessionData) => base44.entities.StudySession.create(sessionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
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

  const shuffledVocab = React.useMemo(() => {
    return [...vocabulary].sort(() => Math.random() - 0.5);
  }, [vocabulary]);

  const totalAnswered = correctCount + incorrectCount;
  const accuracy = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

  const handleAnswer = (correct) => {
    const currentVocab = shuffledVocab[currentIndex];
    
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

    const newCardsUntilRest = cardsUntilRest - 1;
    
    // Check if we should take a rest
    if (newCardsUntilRest === 0 && currentIndex < shuffledVocab.length - 1) {
      setShowRest(true);
      setCardsUntilRest(Math.floor(Math.random() * 11) + 10); // Reset to new random number
      return;
    }
    
    setCardsUntilRest(newCardsUntilRest);
    moveToNext();
  };

  const moveToNext = () => {
    if (currentIndex < shuffledVocab.length - 1) {
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
      session_type: 'flash',
    });

    setSessionComplete(true);
  };

  const continueAfterRest = () => {
    setShowRest(false);
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

  if (shuffledVocab.length === 0) {
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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 overflow-hidden">
      <AccuracyMeter
        accuracy={accuracy}
        correctCount={correctCount}
        incorrectCount={incorrectCount}
        currentCard={currentIndex + 1}
        totalCards={shuffledVocab.length}
      />

      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <FlashCard
          vocabulary={shuffledVocab[currentIndex]}
          mode={mode}
          onAnswer={handleAnswer}
        />
      </div>
    </div>
  );
}