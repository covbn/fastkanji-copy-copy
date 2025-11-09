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
    <div className={`h-screen flex items-center justify-center p-4 overflow-y-auto ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-teal-50 via-cyan-50 to-stone-50'}`}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl space-y-6"
      >
        {/* Celebration Icon */}
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
          className={`w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br ${
            isExcellent ? 'from-emerald-500 to-teal-500' : 
            isGood ? 'from-cyan-500 to-teal-500' : 
            'from-amber-500 to-orange-500'
          } flex items-center justify-center shadow-2xl`}
        >
          <Trophy className="w-12 h-12 text-white" />
        </motion.div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className={`text-4xl md:text-5xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            {isExcellent ? "Excellent Work!" : isGood ? "Great Job!" : "Session Complete!"}
          </h1>
          <p className={`text-lg ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
            You studied {totalCards} cards
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 md:gap-4">
          <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
            <CardContent className="p-4 md:p-6 text-center">
              <div className={`w-10 h-10 md:w-12 md:h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                isExcellent ? 'bg-emerald-500' : isGood ? 'bg-cyan-500' : 'bg-amber-500'
              }`}>
                <Target className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <p className={`text-2xl md:text-3xl font-bold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
                {accuracy.toFixed(0)}%
              </p>
              <p className={`text-xs md:text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Accuracy</p>
            </CardContent>
          </Card>

          <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
            <CardContent className="p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-2">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <p className={`text-2xl md:text-3xl font-bold text-emerald-600 ${nightMode ? 'text-emerald-400' : ''}`}>
                {correctCount}
              </p>
              <p className={`text-xs md:text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Correct</p>
            </CardContent>
          </Card>

          <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
            <CardContent className="p-4 md:p-6 text-center">
              <div className="w-10 h-10 md:w-12 md:h-12 mx-auto rounded-full bg-rose-500 flex items-center justify-center mb-2">
                <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <p className={`text-2xl md:text-3xl font-bold text-rose-600 ${nightMode ? 'text-rose-400' : ''}`}>
                {incorrectCount}
              </p>
              <p className={`text-xs md:text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>To Review</p>
            </CardContent>
          </Card>
        </div>

        {/* Review Words */}
        {reviewWords.length > 0 && (
          <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
            <CardContent className="p-4 md:p-6">
              <h3 className={`text-lg font-semibold mb-3 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
                Words to Review
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                {reviewWords.map((word, idx) => (
                  <div
                    key={idx}
                    className={`p-2 rounded-lg border text-center ${nightMode ? 'bg-slate-700 border-slate-600' : 'bg-stone-50 border-stone-200'}`}
                  >
                    <p className={`font-medium text-sm ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>{word.kanji}</p>
                    <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>{word.meaning}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Encouragement Message */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-teal-200 bg-teal-50'}`}>
          <CardContent className="p-4 md:p-6 text-center">
            <p className={`text-sm md:text-base ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
              {isExcellent ? "🎯 Outstanding! Your retention is excellent. Keep up the amazing work!" :
               isGood ? "💪 Great progress! You're building strong memories." :
               "📚 Every review makes you stronger. Keep practicing!"}
            </p>
          </CardContent>
        </Card>

        {/* Action Button */}
        <Button
          onClick={onContinue}
          size="lg"
          className="w-full h-14 text-lg font-medium bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Home className="w-5 h-5 mr-2" />
          Back to Home
        </Button>
      </motion.div>
    </div>
  );
}