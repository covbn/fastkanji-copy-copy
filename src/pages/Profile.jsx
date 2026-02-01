import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Award, Flame, Target, Trophy, Zap, Brain, BookOpen, Clock, Wind } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function Profile() {
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

  const { data: sessions = [] } = useQuery({
    queryKey: ['allSessions'],
    queryFn: () => base44.entities.StudySession.list('-created_date', 100),
  });

  const { data: progress = [] } = useQuery({
    queryKey: ['userProgress'],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProgress.filter({ user_email: user.email });
    },
    enabled: !!user,
  });

  // Calculate stats
  const totalCards = sessions.reduce((sum, s) => sum + s.total_cards, 0);
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correct_answers, 0);
  const avgAccuracy = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length 
    : 0;

  const getStreak = () => {
    if (sessions.length === 0) return 0;
    let streak = 0;
    const today = new Date().setHours(0, 0, 0, 0);
    
    // Sort sessions by date in descending order to ensure correctness
    const sortedSessions = [...sessions].sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

    let lastSessionDate = today;

    for (let i = 0; i < sortedSessions.length; i++) {
      const sessionDate = new Date(sortedSessions[i].created_date).setHours(0, 0, 0, 0);
      const daysDiff = Math.round((lastSessionDate - sessionDate) / (1000 * 60 * 60 * 24)); // Round to handle potential timezone issues for same day

      if (daysDiff === 0) { // Same day as last recorded, continue
        // Do nothing, already counted if it was yesterday
      } else if (daysDiff === 1) { // Session was yesterday or day before if current streak is not consecutive
        streak++;
      } else if (daysDiff > 1) { // Gap in streak
        break;
      }
      lastSessionDate = sessionDate;
    }
    return streak;
  };

  const totalStudyTime = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalHours = Math.floor(totalStudyTime / 3600);
  const totalMinutes = Math.floor((totalStudyTime % 3600) / 60);

  const focusCount = settings?.focus_exercises_completed || 0;

  // SM-2 Scheduler stats
  const today = new Date().toISOString().split('T')[0];
  
  const newIntroducedToday = progress.filter(p => 
    p.first_reviewed_day_key === today
  ).length;
  
  const newLearnedToday = progress.filter(p => {
    // Card was introduced today AND is now in Review state
    return p.first_reviewed_day_key === today && p.state === "Review";
  }).length;
  
  const reviewsCompletedToday = progress.filter(p => {
    // Card was reviewed today but NOT introduced today (i.e., was already known from before)
    const wasReviewedToday = p.last_reviewed && 
      new Date(p.last_reviewed).toISOString().split('T')[0] === today;
    const wasIntroducedToday = p.first_reviewed_day_key === today;
    return wasReviewedToday && !wasIntroducedToday;
  }).length;
  
  const learningInProgress = progress.filter(p => 
    p.state === "Learning" || p.state === "Relearning"
  ).length;
  
  // State breakdown
  const newCards = progress.filter(p => !p.state || p.state === "New").length;
  const reviewCards = progress.filter(p => p.state === "Review").length;

  // Achievements - expanded
  const achievements = [
    { 
      name: "First Steps", 
      description: "Complete your first study session", 
      icon: Zap,
      unlocked: sessions.length >= 1,
      color: "bg-cyan-500"
    },
    { 
      name: "Dedicated Learner", 
      description: "Study for 3 days in a row", 
      icon: Flame,
      unlocked: getStreak() >= 3,
      color: "bg-amber-500"
    },
    { 
      name: "Week Warrior", 
      description: "Maintain a 7-day streak", 
      icon: Trophy,
      unlocked: getStreak() >= 7,
      color: "bg-emerald-500"
    },
    { 
      name: "Month Master", 
      description: "Maintain a 30-day streak", 
      icon: Flame,
      unlocked: getStreak() >= 30,
      color: "bg-rose-500"
    },
    { 
      name: "Vocabulary Master", 
      description: "Learn 100 words", 
      icon: BookOpen,
      unlocked: progress.length >= 100,
      color: "bg-indigo-500"
    },
    { 
      name: "Vocabulary Expert", 
      description: "Learn 500 words", 
      icon: BookOpen,
      unlocked: progress.length >= 500,
      color: "bg-purple-500"
    },
    { 
      name: "Kanji King", 
      description: "Learn 1000 words", 
      icon: BookOpen,
      unlocked: progress.length >= 1000,
      color: "bg-pink-500"
    },
    { 
      name: "Accuracy Expert", 
      description: "Achieve 90%+ accuracy in 5 sessions", 
      icon: Target,
      unlocked: sessions.filter(s => s.accuracy >= 90).length >= 5,
      color: "bg-teal-500"
    },
    { 
      name: "Perfect Score", 
      description: "Get 100% accuracy in any session", 
      icon: Award,
      unlocked: sessions.some(s => s.accuracy === 100),
      color: "bg-amber-600"
    },
    { 
      name: "Time Invested", 
      description: "Study for over 10 hours total", 
      icon: Clock,
      unlocked: totalHours >= 10,
      color: "bg-rose-500"
    },
    { 
      name: "Marathon Learner", 
      description: "Study for over 50 hours total", 
      icon: Clock,
      unlocked: totalHours >= 50,
      color: "bg-indigo-600"
    },
    { 
      name: "Focus Beginner", 
      description: "Complete 5 focus exercises", 
      icon: Wind,
      unlocked: focusCount >= 5,
      color: "bg-cyan-600"
    },
    { 
      name: "Focus Practitioner", 
      description: "Complete 25 focus exercises", 
      icon: Wind,
      unlocked: focusCount >= 25,
      color: "bg-teal-600"
    },
    { 
      name: "Focus Master", 
      description: "Complete 100 focus exercises", 
      icon: Wind,
      unlocked: focusCount >= 100,
      color: "bg-emerald-600"
    },
    { 
      name: "Consistent Scholar", 
      description: "Complete 50 study sessions", 
      icon: Zap,
      unlocked: sessions.length >= 50,
      color: "bg-blue-500"
    },
    { 
      name: "Knowledge Seeker", 
      description: "Study 1000 total cards", 
      icon: Target,
      unlocked: totalCards >= 1000,
      color: "bg-purple-600"
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg">
            <span className="text-4xl">学</span>
          </div>
          <div>
            <h1 className="text-4xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
              {user.full_name || "Learner"}
            </h1>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Badge className="bg-teal-500 text-white">
                <Flame className="w-3 h-3 mr-1" />
                {getStreak()} Day Streak
              </Badge>
              <Badge variant="outline">
                Level {Math.floor(progress.length / 50) + 1}
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Stats Overview */}
        <div className="grid md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-teal-500 flex items-center justify-center mb-3">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-foreground">{sessions.length}</p>
              <p className="text-sm mt-1 text-muted-foreground">Sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-3">
                <Target className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-foreground">{totalCards}</p>
              <p className="text-sm mt-1 text-muted-foreground">Cards Studied</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500 flex items-center justify-center mb-3">
                <Award className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-foreground">{avgAccuracy.toFixed(0)}%</p>
              <p className="text-sm mt-1 text-muted-foreground">Avg Accuracy</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-amber-500 flex items-center justify-center mb-3">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-foreground">{totalHours}h {totalMinutes}m</p>
              <p className="text-sm mt-1 text-muted-foreground">Study Time</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-500 flex items-center justify-center mb-3">
                <Wind className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-foreground">{focusCount}</p>
              <p className="text-sm mt-1 text-muted-foreground">Focus Exercises</p>
            </CardContent>
          </Card>
        </div>

        {/* Spaced Repetition Progress */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-teal-600" />
              Spaced Repetition Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg border bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="w-5 h-5 text-cyan-600" />
                  <p className="font-semibold text-foreground">New Today</p>
                </div>
                <p className="text-3xl font-bold text-cyan-700 dark:text-cyan-400">{newIntroducedToday}</p>
                <p className="text-sm mt-1 text-muted-foreground">Cards introduced today</p>
              </div>

              <div className="p-4 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-5 h-5 text-blue-600" />
                  <p className="font-semibold text-foreground">Learned Today</p>
                </div>
                <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">{newLearnedToday}</p>
                <p className="text-sm mt-1 text-muted-foreground">New cards graduated</p>
              </div>

              <div className="p-4 rounded-lg border bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-emerald-600" />
                  <p className="font-semibold text-foreground">Reviews Today</p>
                </div>
                <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{reviewsCompletedToday}</p>
                <p className="text-sm mt-1 text-muted-foreground">Older cards reviewed</p>
              </div>

              <div className="p-4 rounded-lg border bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-5 h-5 text-amber-600" />
                  <p className="font-semibold text-foreground">In Learning</p>
                </div>
                <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">{learningInProgress}</p>
                <p className="text-sm mt-1 text-muted-foreground">Cards in progress</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-muted">
                <div className="flex items-center gap-3 mb-2">
                  <BookOpen className="w-5 h-5 text-muted-foreground" />
                  <p className="font-semibold text-foreground">Unseen</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{newCards}</p>
                <p className="text-sm mt-1 text-muted-foreground">Words not yet started</p>
              </div>

              <div className="p-4 rounded-lg border bg-muted">
                <div className="flex items-center gap-3 mb-2">
                  <Trophy className="w-5 h-5 text-muted-foreground" />
                  <p className="font-semibold text-foreground">In Review</p>
                </div>
                <p className="text-3xl font-bold text-foreground">{reviewCards}</p>
                <p className="text-sm mt-1 text-muted-foreground">Cards in review phase</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Achievements ({unlockedCount}/{achievements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-4 gap-4">
              {achievements.map((achievement, idx) => (
                <motion.div
                  key={achievement.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`p-4 rounded-lg border ${
                    achievement.unlocked 
                      ? 'bg-card border-teal-200 dark:border-teal-800' 
                      : 'bg-muted border-border opacity-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${achievement.color} flex items-center justify-center flex-shrink-0 ${!achievement.unlocked && 'opacity-50'}`}>
                      <achievement.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-foreground ${!achievement.unlocked && 'opacity-50'}`}>
                        {achievement.name}
                      </p>
                      <p className={`text-sm mt-1 text-muted-foreground ${!achievement.unlocked && 'opacity-50'}`}>
                        {achievement.description}
                      </p>
                      {achievement.unlocked && (
                        <Badge className="bg-emerald-500 text-white mt-2">Unlocked!</Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Member Since */}
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              Member since {format(new Date(user.created_date), 'MMMM yyyy')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}