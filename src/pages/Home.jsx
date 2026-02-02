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
import { useDailyStudyTimer } from "../components/utils/useDailyStudyTimer";
import { confirmDialog } from "../components/utils/ConfirmDialog";

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
  
  React.useEffect(() => {
    if (settings) {
      console.log(`[PREMIUM][UI] loaded isPremium=${isPremium} source=db`);
    }
  }, [settings, isPremium]);
  
  // Use shared timer hook for free users
  const { remainingSeconds: remainingTime, isLoading: timerLoading } = useDailyStudyTimer(user?.email, isPremium);
  const hasReachedLimit = !isPremium && remainingTime !== null && remainingTime <= 0;

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

  const handleStartStudy = async (url) => {
    if (hasReachedLimit) {
      const ok = await confirmDialog.show({
        title: "Daily Limit Reached",
        description: "You've reached your 7.5 minute daily limit. Upgrade to Premium for unlimited access!",
        confirmText: "Upgrade Now",
        cancelText: "Cancel"
      });
      if (ok) navigate(createPageUrl('Subscription'));
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
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4 py-8"
        >
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-full text-sm font-medium border border-amber-200 dark:border-amber-800">
              <Flame className="w-4 h-4" />
              {getStreak()} Day Streak
            </div>
            {!isPremium && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-full text-sm font-medium border border-teal-200 dark:border-teal-800">
                ⏱️ {formatTime(remainingTime)} remaining today
              </div>
            )}
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
            Master Japanese Vocabulary
          </h1>
          <p className="text-lg max-w-2xl mx-auto font-light text-muted-foreground">
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
            <Card className="border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <Award className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Daily Limit Reached</h3>
                <p className="text-muted-foreground mb-4">
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
        <Card className={`border border-border bg-card shadow-sm ${hasReachedLimit ? 'opacity-50' : ''}`}>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-2xl font-semibold flex items-center gap-2 text-card-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
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
            <div className="p-4 rounded-lg border border-border bg-muted">
              <h3 className="text-sm font-semibold mb-3 text-foreground">
                Flash Study Session Size
              </h3>
              <SessionSizeSelector
                sessionSize={sessionSize}
                onSelectSize={setSessionSize}
              />
              <p className="text-xs mt-2 text-muted-foreground">
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
                className="h-14 text-base font-medium border-2 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 hover:border-teal-300 dark:hover:border-teal-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Brain className="w-5 h-5 mr-2" />
                Spaced Repetition
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 font-semibold text-card-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
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
                    className="flex items-center justify-between p-4 rounded-lg bg-muted hover:bg-accent transition-colors border border-border"
                  >
                    <div className="flex items-center gap-4">
                      {session.session_type === 'flash' ? (
                        <Zap className="w-5 h-5 text-teal-600" />
                      ) : (
                        <Brain className="w-5 h-5 text-cyan-600" />
                      )}
                      <div>
                        <p className="font-medium text-foreground">
                          {session.mode.replace(/_/g, ' ').replace('to', '→').toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground">
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
              className="max-w-md w-full rounded-2xl shadow-2xl p-6 space-y-4 bg-card border border-border"
            >
              <button
                onClick={dismissFocusPrompt}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-accent text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                <Wind className="w-8 h-8 text-white" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-2xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                  Boost Your Learning?
                </h3>
                <p className="text-sm text-muted-foreground">
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
                  className="w-full"
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