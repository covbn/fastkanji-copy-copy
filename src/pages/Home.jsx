import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Zap, Brain, Target, TrendingUp, Award, Flame, Wind, X, RefreshCw, ChevronRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscription } from "@/components/utils/useSubscription";
import { usePullToRefresh } from "@/components/utils/usePullToRefresh";

import QuickStats from "../components/home/QuickStats";
import StudySettingsSheet from "../components/home/StudySettingsSheet";
import { useDailyStudyTimer } from "../components/utils/useDailyStudyTimer";
import { confirmDialog } from "../components/utils/ConfirmDialog";

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Load persisted settings
  const [selectedMode, setSelectedMode] = useState(() => {
    return localStorage.getItem('lastStudyMode') || 'kanji_to_meaning';
  });
  const [selectedLevel, setSelectedLevel] = useState(() => {
    return localStorage.getItem('lastStudyLevel') || 'N5';
  });
  const [sessionSize, setSessionSize] = useState(() => {
    return parseInt(localStorage.getItem('lastSessionSize') || '20');
  });
  
  const [showFocusPrompt, setShowFocusPrompt] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  // Persist settings on change
  useEffect(() => {
    localStorage.setItem('lastStudyMode', selectedMode);
  }, [selectedMode]);

  useEffect(() => {
    localStorage.setItem('lastStudyLevel', selectedLevel);
  }, [selectedLevel]);

  useEffect(() => {
    localStorage.setItem('lastSessionSize', sessionSize.toString());
  }, [sessionSize]);

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
    localStorage.setItem('lastStudyType', 'flash');
    handleStartStudy(createPageUrl(`FlashStudy?mode=${selectedMode}&level=${selectedLevel}&size=${sessionSize}`));
  };

  const startSpacedRepetition = () => {
    localStorage.setItem('lastStudyType', 'srs');
    handleStartStudy(createPageUrl(`SpacedRepetition?mode=${selectedMode}&level=${selectedLevel}`));
  };

  const getModeName = (mode) => {
    const names = {
      'kanji_to_meaning': 'Kanji → Meaning',
      'kanji_to_reading': 'Kanji → Reading',
      'reading_to_meaning': 'Reading → Meaning'
    };
    return names[mode] || mode;
  };

  const getLevelName = (level) => {
    const names = {
      'N5': 'N5 - Beginner',
      'N4': 'N4 - Elementary',
      'N3': 'N3 - Intermediate',
      'N2': 'N2 - Advanced',
      'N1': 'N1 - Expert'
    };
    return names[level] || level;
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
    <div className="min-h-dvh bg-background" style={{paddingBottom: 'max(4rem, env(safe-area-inset-bottom, 4rem))'}}>
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
      
      <div className="w-full px-4 py-3 space-y-4">
        {/* Compact Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <h1 className="text-2xl font-semibold" style={{fontFamily: "'Crimson Pro', serif"}}>
            FastKanji
          </h1>
          <div className="inline-flex items-center gap-2 h-9 px-3 bg-gradient-to-r from-amber-50 to-teal-50 dark:from-amber-950 dark:to-teal-950 rounded-full border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{getStreak()}d</span>
            </div>
            {!isPremium && (
              <>
                <div className="w-px h-4 bg-border" />
                <span className="text-sm font-medium text-teal-700 dark:text-teal-300">⏱️ {formatTime(remainingTime)}</span>
              </>
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

        {/* Continue Studying Hero Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-2 border-teal-500 rounded-3xl shadow-lg overflow-hidden bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950 dark:to-cyan-950">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Continue Studying</p>
                  <h2 className="text-lg font-bold text-foreground mb-1" style={{fontFamily: "'Crimson Pro', serif"}}>
                    {getLevelName(selectedLevel)}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{getModeName(selectedMode)}</span>
                    <span>•</span>
                    <span>{sessionSize} cards</span>
                  </div>
                </div>
                <StudySettingsSheet
                  selectedLevel={selectedLevel}
                  selectedMode={selectedMode}
                  sessionSize={sessionSize}
                  onSelectLevel={setSelectedLevel}
                  onSelectMode={setSelectedMode}
                  onSelectSize={setSessionSize}
                  vocabularyCount={vocabularyCount}
                  isPremium={isPremium}
                  onConfirm={() => {}}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={startFlashStudy}
                  disabled={hasReachedLimit}
                  className="h-12 text-sm font-semibold bg-teal-500 hover:bg-teal-600 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  Flash
                </Button>

                <Button
                  onClick={startSpacedRepetition}
                  variant="outline"
                  disabled={hasReachedLimit}
                  className="h-12 text-sm font-semibold border-2 border-teal-500 text-teal-700 dark:text-teal-300 hover:bg-teal-100 dark:hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl"
                >
                  <Brain className="w-4 h-4 mr-1.5" />
                  SRS
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Stats */}
        <QuickStats 
          sessions={recentSessions}
          totalWords={vocabularyCount.length}
          streak={getStreak()}
        />

        {/* Recent Activity */}
        {recentSessions.length > 0 && (
          <Card className="border rounded-lg shadow-sm">
            <CardHeader className="border-b border-border p-2.5">
              <CardTitle className="flex items-center gap-1.5 text-xs font-semibold text-card-foreground">
                <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                Recent Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2.5">
              <div className="space-y-1.5">
                {recentSessions.slice(0, 5).map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted hover:bg-accent transition-colors border border-border"
                  >
                    <div className="flex items-center gap-2.5">
                      {session.session_type === 'flash' ? (
                        <Zap className="w-3.5 h-3.5 text-teal-600" />
                      ) : (
                        <Brain className="w-3.5 h-3.5 text-cyan-600" />
                      )}
                      <div>
                        <p className="font-medium text-xs text-foreground leading-tight">
                          {session.mode.replace(/_/g, ' ').replace('to', '→').toUpperCase()}
                        </p>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          {session.level} • {session.total_cards} cards
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={session.accuracy >= 85 ? "default" : "secondary"}
                        className={`text-[10px] h-5 px-1.5 ${session.accuracy >= 85 ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}
                      >
                        {session.accuracy.toFixed(0)}%
                      </Badge>
                      {session.accuracy >= 85 && (
                        <Award className="w-3.5 h-3.5 text-amber-500" />
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