import React from "react";
import { motion } from "framer-motion";
import { Trophy, Target, Zap, TrendingUp, Award, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SessionComplete({ correctCount, incorrectCount, accuracy, onContinue, reviewWords = [] }) {
  const totalCards = correctCount + incorrectCount;
  const isExcellent = accuracy >= 85;
  const isGood = accuracy >= 70;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl space-y-8"
      >
        {/* Trophy Icon */}
        <motion.div
          animate={{ 
            rotate: [0, -10, 10, -10, 0],
            y: [0, -10, 0]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="text-center"
        >
          <div className={`w-32 h-32 mx-auto rounded-full bg-gradient-to-br ${
            isExcellent ? 'from-yellow-400 to-orange-500' : 
            isGood ? 'from-blue-400 to-indigo-500' : 
            'from-gray-400 to-gray-600'
          } flex items-center justify-center shadow-2xl`}>
            {isExcellent ? (
              <Trophy className="w-16 h-16 text-white" />
            ) : (
              <Award className="w-16 h-16 text-white" />
            )}
          </div>
        </motion.div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h2 className="text-5xl font-bold text-white">
            {isExcellent ? 'Excellent Work!' : isGood ? 'Good Job!' : 'Keep Practicing!'}
          </h2>
          <p className="text-xl text-white/70">
            {isExcellent ? 'You hit the optimal learning zone! 🎯' : 
             isGood ? 'You\'re on the right track!' : 
             'Every session makes you better!'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <Zap className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{totalCards}</p>
              <p className="text-sm text-white/70">Cards Studied</p>
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <Target className="w-8 h-8 text-green-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{accuracy.toFixed(0)}%</p>
              <p className="text-sm text-white/70">Accuracy</p>
              {isExcellent && (
                <Badge className="mt-2 bg-green-500">Target Hit! 🎯</Badge>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <TrendingUp className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
              <p className="text-3xl font-bold text-white">{correctCount}</p>
              <p className="text-sm text-white/70">Correct</p>
            </CardContent>
          </Card>
        </div>

        {/* Review Words */}
        {reviewWords.length > 0 && (
          <Card className="bg-white/10 backdrop-blur-sm border-white/20">
            <CardContent className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">Words to Review</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {reviewWords.slice(0, 10).map((word, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-2xl text-white">{word.kanji}</span>
                    <span className="text-lg text-white/70">{word.hiragana}</span>
                    <span className="text-sm text-white/50">{word.meaning}</span>
                  </div>
                ))}
              </div>
              {reviewWords.length > 10 && (
                <p className="text-sm text-white/50 mt-2 text-center">
                  + {reviewWords.length - 10} more words
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            onClick={onContinue}
            size="lg"
            className="flex-1 h-14 text-lg font-semibold bg-white text-indigo-900 hover:bg-white/90"
          >
            <Home className="w-5 h-5 mr-2" />
            Back to Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}