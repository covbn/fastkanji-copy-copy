import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, TrendingUp, Target, CheckCircle, Home } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function SessionComplete({ correctCount, incorrectCount, accuracy, onContinue, reviewWords = [] }) {
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

  const totalCards = correctCount + incorrectCount;
  const isExcellent = accuracy >= 90;
  const isGood = accuracy >= 75;

  return (
    <div className="px-3 py-3 bg-background max-w-2xl mx-auto space-y-3">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="space-y-3"
      >
        {/* Compact Header */}
        <div className="text-center space-y-1">
          <motion.div
            animate={{ 
              rotate: [0, -10, 10, -10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              duration: 1,
              repeat: 2,
              ease: "easeInOut"
            }}
            className={`w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br ${
              isExcellent ? 'from-emerald-500 to-teal-500' : 
              isGood ? 'from-cyan-500 to-teal-500' : 
              'from-amber-500 to-orange-500'
            } flex items-center justify-center shadow-lg`}
          >
            <Trophy className="w-6 h-6 text-white" />
          </motion.div>
          <h1 className="text-xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
            {isExcellent ? "Excellent Work!" : isGood ? "Great Job!" : "Session Complete!"}
          </h1>
          <p className="text-xs text-muted-foreground">
            You studied {totalCards} cards
          </p>
        </div>

        {/* Compact Stat Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border bg-card p-3 text-center">
            <p className="text-base font-semibold text-foreground">
              {accuracy.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Accuracy</p>
          </div>

          <div className="rounded-xl border bg-card p-3 text-center">
            <p className="text-base font-semibold text-emerald-600 dark:text-emerald-400">
              {correctCount}
            </p>
            <p className="text-xs text-muted-foreground">Correct</p>
          </div>

          <div className="rounded-xl border bg-card p-3 text-center">
            <p className="text-base font-semibold text-rose-600 dark:text-rose-400">
              {incorrectCount}
            </p>
            <p className="text-xs text-muted-foreground">To Review</p>
          </div>
        </div>

        {/* Review Words (if any) */}
        {reviewWords.length > 0 && (
          <Card>
            <CardContent className="p-3">
              <h3 className="text-sm font-semibold mb-2 text-foreground">
                Words to Review
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                {reviewWords.map((word, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg border border-border bg-muted text-center"
                  >
                    <p className="font-medium text-xs text-foreground">{word.kanji}</p>
                    <p className="text-[10px] text-muted-foreground">{word.meaning}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Primary CTA */}
        <Button
          onClick={onContinue}
          className="h-10 text-sm w-full bg-teal-600 hover:bg-teal-700 text-white"
        >
          Start Next Session
        </Button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onContinue}
            variant="outline"
            className="h-9 text-sm"
          >
            <Home className="w-3 h-3 mr-1.5" />
            Home
          </Button>
          <Button
            onClick={onContinue}
            variant="outline"
            className="h-9 text-sm"
          >
            <TrendingUp className="w-3 h-3 mr-1.5" />
            Progress
          </Button>
        </div>

        {/* Encouragement Text */}
        <p className="text-xs text-muted-foreground text-center">
          Keep going — consistency builds mastery.
        </p>
      </motion.div>
    </div>
  );
}