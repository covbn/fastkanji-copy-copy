import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Zap, Brain, Target, TrendingUp, Award, Flame } from "lucide-react";
import { motion } from "framer-motion";

import ModeSelector from "../components/home/ModeSelector";
import LevelSelector from "../components/home/LevelSelector";
import QuickStats from "../components/home/QuickStats";

export default function Home() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState("kanji_to_meaning");
  const [selectedLevel, setSelectedLevel] = useState("N5");

  const { data: recentSessions = [] } = useQuery({
    queryKey: ['recentSessions'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 10),
  });

  const { data: vocabularyCount = [] } = useQuery({
    queryKey: ['vocabularyCount'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

  const startFlashStudy = () => {
    navigate(createPageUrl(`FlashStudy?mode=${selectedMode}&level=${selectedLevel}`));
  };

  const startSpacedRepetition = () => {
    navigate(createPageUrl(`SpacedRepetition?mode=${selectedMode}&level=${selectedLevel}`));
  };

  const getStreak = () => {
    // Calculate study streak
    if (recentSessions.length === 0) return 0;
    let streak = 0;
    const today = new Date().setHours(0, 0, 0, 0);
    
    for (let i = 0; i < recentSessions.length; i++) {
      const sessionDate = new Date(recentSessions[i].created_date).setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today - sessionDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === streak) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 py-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium mb-4">
            <Flame className="w-4 h-4" />
            {getStreak()} Day Streak
          </div>
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Master Japanese Vocabulary
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Lightning-fast flashcards with spaced repetition. Learn smarter, not harder.
          </p>
        </motion.div>

        {/* Quick Stats */}
        <QuickStats 
          sessions={recentSessions}
          totalWords={vocabularyCount.length}
          streak={getStreak()}
        />

        {/* Study Setup */}
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Target className="w-6 h-6 text-indigo-600" />
              Start Your Study Session
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <LevelSelector 
                selectedLevel={selectedLevel}
                onSelectLevel={setSelectedLevel}
                vocabularyCount={vocabularyCount}
              />
              
              <ModeSelector 
                selectedMode={selectedMode}
                onSelectMode={setSelectedMode}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-4">
              <Button
                onClick={startFlashStudy}
                size="lg"
                className="h-16 text-lg font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Zap className="w-5 h-5 mr-2" />
                Flash Study Mode
              </Button>

              <Button
                onClick={startSpacedRepetition}
                size="lg"
                variant="outline"
                className="h-16 text-lg font-semibold border-2 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-300"
              >
                <Brain className="w-5 h-5 mr-2" />
                Spaced Repetition
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {recentSessions.slice(0, 5).map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      {session.session_type === 'flash' ? (
                        <Zap className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Brain className="w-5 h-5 text-purple-600" />
                      )}
                      <div>
                        <p className="font-medium text-slate-900">
                          {session.mode.replace(/_/g, ' → ').replace(/to/g, '').toUpperCase()}
                        </p>
                        <p className="text-sm text-slate-500">
                          {session.level} • {session.total_cards} cards
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge 
                        variant={session.accuracy >= 85 ? "default" : "secondary"}
                        className={session.accuracy >= 85 ? "bg-green-500" : "bg-orange-500"}
                      >
                        {session.accuracy.toFixed(0)}% Accuracy
                      </Badge>
                      {session.accuracy >= 85 && (
                        <Award className="w-5 h-5 text-yellow-500" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}