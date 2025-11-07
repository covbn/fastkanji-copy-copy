
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
import SessionSizeSelector from "../components/home/SessionSizeSelector";

export default function Home() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState("kanji_to_meaning");
  const [selectedLevel, setSelectedLevel] = useState("N5");
  const [sessionSize, setSessionSize] = useState(20);

  const { data: recentSessions = [] } = useQuery({
    queryKey: ['recentSessions'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 10),
  });

  const { data: vocabularyCount = [] } = useQuery({
    queryKey: ['vocabularyCount'],
    queryFn: () => base44.entities.Vocabulary.list(),
  });

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

  const nightMode = settings?.night_mode || false;

  const startFlashStudy = () => {
    navigate(createPageUrl(`FlashStudy?mode=${selectedMode}&level=${selectedLevel}&size=${sessionSize}`));
  };

  const startSpacedRepetition = () => {
    navigate(createPageUrl(`SpacedRepetition?mode=${selectedMode}&level=${selectedLevel}&size=${sessionSize}`));
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
    <div className={`min-h-screen p-4 md:p-8 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 py-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium mb-4 border border-amber-200">
            <Flame className="w-4 h-4" />
            {getStreak()} Day Streak
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
            Master Japanese Vocabulary
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto font-light">
            Lightning-fast flashcards with spaced repetition
          </p>
        </motion.div>

        {/* Quick Stats */}
        <QuickStats 
          sessions={recentSessions}
          totalWords={vocabularyCount.length}
          streak={getStreak()}
        />

        {/* Study Setup */}
        <Card className={`border ${nightMode ? 'border-slate-700 bg-slate-800/80' : 'border-stone-200 bg-white'} shadow-sm`}>
          <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
            <CardTitle className={`text-2xl font-semibold flex items-center gap-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
              <Target className="w-6 h-6 text-teal-600" />
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

            <SessionSizeSelector
              sessionSize={sessionSize}
              onSelectSize={setSessionSize}
            />

            <div className="grid md:grid-cols-2 gap-4 pt-4">
              <Button
                onClick={startFlashStudy}
                size="lg"
                className="h-14 text-base font-medium bg-teal-500 hover:bg-teal-600 text-white shadow-sm transition-all duration-200"
              >
                <Zap className="w-5 h-5 mr-2" />
                Flash Study Mode
              </Button>

              <Button
                onClick={startSpacedRepetition}
                size="lg"
                variant="outline"
                className="h-14 text-base font-medium border-2 border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-all duration-200"
              >
                <Brain className="w-5 h-5 mr-2" />
                Spaced Repetition
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <Card className={`border ${nightMode ? 'border-slate-700 bg-slate-800/80' : 'border-stone-200 bg-white'} shadow-sm`}>
            <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
              <CardTitle className={`flex items-center gap-2 font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
                <TrendingUp className="w-5 h-5 text-teal-600" />
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
                    className={`flex items-center justify-between p-4 rounded-lg ${nightMode ? 'bg-slate-700/50 hover:bg-slate-700' : 'bg-stone-50 hover:bg-stone-100'} transition-colors border ${nightMode ? 'border-slate-600' : 'border-stone-200'}`}
                  >
                    <div className="flex items-center gap-4">
                      {session.session_type === 'flash' ? (
                        <Zap className="w-5 h-5 text-teal-600" />
                      ) : (
                        <Brain className="w-5 h-5 text-coral-600" />
                      )}
                      <div>
                        <p className={`font-medium ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {session.mode.replace(/_/g, ' → ').replace(/to/g, '').toUpperCase()}
                        </p>
                        <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          {session.level} • {session.total_cards} cards
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge 
                        variant={session.accuracy >= 85 ? "default" : "secondary"}
                        className={session.accuracy >= 85 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}
                      >
                        {session.accuracy.toFixed(0)}%
                      </Badge>
                      {session.accuracy >= 85 && (
                        <Award className="w-5 h-5 text-amber-500" />
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
