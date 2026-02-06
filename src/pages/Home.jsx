import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Zap, Brain, Target, TrendingUp, Award, Flame, Wind, X, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription } from "@/components/utils/useSubscription";
import { usePullToRefresh } from "@/components/utils/usePullToRefresh";

import ModeSelector from "../components/home/ModeSelector";
import LevelSelector from "../components/home/LevelSelector";
import QuickStats from "../components/home/QuickStats";
import SessionSizeSelector from "../components/home/SessionSizeSelector";
import { useDailyStudyTimer } from "../components/utils/useDailyStudyTimer";
import { confirmDialog } from "../components/utils/ConfirmDialog";

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMode, setSelectedMode] = useState("kanji_to_meaning");
  const [selectedLevel, setSelectedLevel] = useState("N5");
  const [sessionSize, setSessionSize] = useState(20);
  const [showFocusPrompt, setShowFocusPrompt] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Pull to refresh
  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
    await queryClient.invalidateQueries({ queryKey: ['vocabularyCount'] });
    await queryClient.invalidateQueries({ queryKey: ['userSettings'] });
  };

  const { isPulling, pullDistance } = usePullToRefresh(handleRefresh);

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

  const { isPremium } = useSubscription(user);

  const nightMode = settings?.night_mode || false;
  
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
    <div className="min-h-dvh appPage bg-background">
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 flex justify-center z-50 transition-opacity"
          style={{ 
            paddingTop: 'env(safe-area-inset-top)',
            opacity: Math.min(pullDistance / 60, 1) 
          }}
        >
          <div className="bg-teal-500 text-white px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${isPulling ? 'animate-spin' : ''}`} />
            <span className="text-xs font-medium">
              {isPulling ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}
      
      <div className="max-w-md md:max-w-6xl mx-auto appSectionGap">
        {/* Compact Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="appH1" style={{fontFamily: "'Crimson Pro', serif"}}>
            FastKanji
          </h1>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 h-7 px-3 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 rounded-full text-xs font-medium border border-amber-200 dark:border-amber-800">
              <Flame className="w-3.5 h-3.5" />
              {getStreak()}d
            </div>
            {!isPremium && (
              <div className="inline-flex items-center gap-1.5 h-7 px-3 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-full text-xs font-medium border border-teal-200 dark:border-teal-800">
                ⏱️ {formatTime(remainingTime)}
              </div>
            )}
          </div>
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
        <Card className={`appCard shadow-sm ${hasReachedLimit ? 'opacity-50' : ''}`}>
          <CardHeader className="border-b border-border appCardPad">
            <CardTitle className="text-lg font-semibold flex items-center gap-2 text-card-foreground">
              <Target className="w-5 h-5 text-teal-600" />
              Start Studying
            </CardTitle>
          </CardHeader>
          <CardContent className="appCardPad space-y-4">
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
            <div className="p-3 rounded-lg border border-border bg-muted">
              <h3 className="text-xs font-semibold mb-2 text-foreground">
                Flash Study Size
              </h3>
              <SessionSizeSelector
                sessionSize={sessionSize}
                onSelectSize={setSessionSize}
              />
              <p className="text-[11px] mt-2 text-muted-foreground">
                SRS continues until all due cards reviewed
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={startFlashStudy}
                size="sm"
                disabled={hasReachedLimit}
                className="h-11 text-sm font-medium bg-teal-500 hover:bg-teal-600 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4 mr-1.5" />
                Flash
              </Button>

              <Button
                onClick={startSpacedRepetition}
                size="sm"
                variant="outline"
                disabled={hasReachedLimit}
                className="h-11 text-sm font-medium border-2 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Brain className="w-4 h-4 mr-1.5" />
                SRS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <Card className="appCard shadow-sm">
            <CardHeader className="border-b border-border appCardPad">
              <CardTitle className="flex items-center gap-2 text-base font-semibold text-card-foreground">
                <TrendingUp className="w-4 h-4 text-teal-600" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="appCardPad">
              <div className="space-y-2">
                {recentSessions.slice(0, 5).map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted hover:bg-accent transition-colors border border-border"
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