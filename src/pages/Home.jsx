
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Zap, Brain, Target, TrendingUp, Award, Flame, Wind, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import ModeSelector from "../components/home/ModeSelector";
import LevelSelector from "../components/home/LevelSelector";
import QuickStats from "../components/home/QuickStats";
import SessionSizeSelector from "../components/home/SessionSizeSelector";

export default function Home() {
  const navigate = useNavigate();
  const [selectedMode, setSelectedMode] = useState("kanji_to_meaning");
  const [selectedLevel, setSelectedLevel] = useState("N5");
  const [sessionSize, setSessionSize] = useState(20);
  const [showFocusPrompt, setShowFocusPrompt] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

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

  const { data: settings, refetch: refetchSettings } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const existing = await base44.entities.UserSettings.filter({ user_email: user.email });
      return existing.length > 0 ? existing[0] : null;
    },
    enabled: !!user,
  });

  const nightMode = settings?.night_mode || false;
  const isPremium = settings?.subscription_status === 'premium';
  
  // Check daily usage limit for free users
  const dailyLimit = 7.5 * 60; // 7.5 minutes in seconds
  const usageToday = settings?.daily_usage_seconds || 0;
  const usageDate = settings?.last_usage_date;
  const today = new Date().toISOString().split('T')[0];
  const isNewDay = usageDate !== today;
  const remainingTime = isNewDay ? dailyLimit : Math.max(0, dailyLimit - usageToday);
  const hasReachedLimit = !isPremium && remainingTime <= 0 && !isNewDay;

  // Check if user should see focus exercise prompt
  useEffect(() => {
    const checkFocusPrompt = () => {
      const lastPrompt = localStorage.getItem('lastFocusPrompt');
      if (!lastPrompt) return true;
      
      const lastPromptTime = new Date(lastPrompt).getTime();
      const now = new Date().getTime();
      const sixHours = 6 * 60 * 60 * 1000;
      
      return now - lastPromptTime >= sixHours;
    };

    if (recentSessions.length === 0 || checkFocusPrompt()) {
      // Show prompt on first session or after 6 hours
      setShowFocusPrompt(true);
    }
  }, [recentSessions]);

  const handleStartStudy = (url) => {
    if (hasReachedLimit) {
      alert("You've reached your daily study limit (7.5 minutes). Upgrade to Premium for unlimited access!");
      navigate(createPageUrl('Subscription'));
      return;
    }

    const lastPrompt = localStorage.getItem('lastFocusPrompt');
    const shouldShowPrompt = !lastPrompt || (new Date().getTime() - new Date(lastPrompt).getTime()) >= (6 * 60 * 60 * 1000);
    
    if (shouldShowPrompt && showFocusPrompt) {
      setPendingNavigation(url);
    } else {
      navigate(url);
    }
  };

  const dismissFocusPrompt = () => {
    localStorage.setItem('lastFocusPrompt', new Date().toISOString());
    setShowFocusPrompt(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const goToFocusExercise = () => {
    localStorage.setItem('lastFocusPrompt', new Date().toISOString());
    setShowFocusPrompt(false);
    navigate(createPageUrl('Focus'));
  };

  const startFlashStudy = () => {
    handleStartStudy(createPageUrl(`FlashStudy?mode=${selectedMode}&level=${selectedLevel}&size=${sessionSize}`));
  };

  const startSpacedRepetition = () => {
    handleStartStudy(createPageUrl(`SpacedRepetition?mode=${selectedMode}&level=${selectedLevel}`));
  };

  const getStreak = () => {
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-medium border border-amber-200">
              <Flame className="w-4 h-4" />
              {getStreak()} Day Streak
            </div>
            {!isPremium && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-full text-sm font-medium border border-teal-200">
                ⏱️ {formatTime(remainingTime)} remaining today
              </div>
            )}
          </div>
          <h1 className={`text-4xl md:text-6xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            Master Japanese Vocabulary
          </h1>
          <p className={`text-lg max-w-2xl mx-auto font-light ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Lightning-fast flashcards with spaced repetition
          </p>
        </motion.div>

        {/* Free user limit warning */}
        {!isPremium && hasReachedLimit && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto"
          >
            <Card className="border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2">Daily Limit Reached</h3>
                <p className="text-slate-600 mb-4">
                  You've used your 7.5 minutes today. Upgrade to Premium for unlimited study time and access to all JLPT levels!
                </p>
                <Button
                  onClick={() => navigate(createPageUrl('Subscription'))}
                  className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
                >
                  Upgrade to Premium
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Stats */}
        <QuickStats 
          sessions={recentSessions}
          totalWords={vocabularyCount.length}
          streak={getStreak()}
        />

        {/* Study Setup */}
        <Card className={`border ${nightMode ? 'border-slate-700 bg-slate-800/80' : 'border-stone-200 bg-white'} shadow-sm ${hasReachedLimit ? 'opacity-50' : ''}`}>
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
                isPremium={isPremium}
              />
              
              <ModeSelector 
                selectedMode={selectedMode}
                onSelectMode={setSelectedMode}
              />
            </div>

            {/* Session Size - Only for Flash Study */}
            <div className={`p-4 rounded-lg border ${nightMode ? 'bg-slate-700 border-slate-600' : 'bg-teal-50 border-teal-200'}`}>
              <h3 className={`text-sm font-semibold mb-3 ${nightMode ? 'text-slate-200' : 'text-slate-700'}`}>
                Flash Study Session Size
              </h3>
              <SessionSizeSelector
                sessionSize={sessionSize}
                onSelectSize={setSessionSize}
              />
              <p className={`text-xs mt-2 ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                Note: Spaced Repetition continues until all due cards are reviewed
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-4">
              <Button
                onClick={startFlashStudy}
                size="lg"
                disabled={hasReachedLimit}
                className="h-14 text-base font-medium bg-teal-500 hover:bg-teal-600 text-white shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-5 h-5 mr-2" />
                Flash Study Mode
              </Button>

              <Button
                onClick={startSpacedRepetition}
                size="lg"
                variant="outline"
                disabled={hasReachedLimit}
                className="h-14 text-base font-medium border-2 border-teal-200 text-teal-700 hover:bg-teal-50 hover:border-teal-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        <Brain className="w-5 h-5 text-cyan-600" />
                      )}
                      <div>
                        <p className={`font-medium ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>
                          {session.mode.replace(/_/g, ' ').replace('to', '→').toUpperCase()}
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

      {/* Focus Exercise Prompt */}
      <AnimatePresence>
        {showFocusPrompt && pendingNavigation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={dismissFocusPrompt}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`max-w-md w-full rounded-2xl shadow-2xl p-6 space-y-4 ${nightMode ? 'bg-slate-800 border border-slate-700' : 'bg-white'}`}
            >
              <button
                onClick={dismissFocusPrompt}
                className={`absolute top-4 right-4 p-1 rounded-lg ${nightMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-stone-100 text-slate-500'}`}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <Wind className="w-8 h-8 text-white" />
              </div>

              <div className="text-center space-y-2">
                <h3 className={`text-2xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
                  Boost Your Learning?
                </h3>
                <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  Science shows that doing the focus exercise before studying can increase retention by 10x. 
                  It only takes 2-3 minutes!
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  onClick={goToFocusExercise}
                  size="lg"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <Wind className="w-4 h-4 mr-2" />
                  Do Focus Exercise (2-3 min)
                </Button>
                <Button
                  onClick={dismissFocusPrompt}
                  variant="outline"
                  size="lg"
                  className={`w-full ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
                >
                  Skip for Now
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
