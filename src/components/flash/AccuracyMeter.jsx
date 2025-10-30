import React from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

export default function AccuracyMeter({ accuracy, correctCount, incorrectCount, currentCard, totalCards }) {
  const targetAccuracy = 85;
  const isOnTarget = accuracy >= targetAccuracy;

  return (
    <div className="bg-white/10 backdrop-blur-md border-b border-white/20 px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {/* Progress */}
          <div className="flex items-center gap-6">
            <div className="text-white/90">
              <p className="text-sm font-medium opacity-75">Progress</p>
              <p className="text-2xl font-bold">
                {currentCard} / {totalCards}
              </p>
            </div>

            <div className="h-12 w-px bg-white/20"></div>

            <div className="text-white/90">
              <p className="text-sm font-medium opacity-75">Correct</p>
              <p className="text-2xl font-bold text-green-400">{correctCount}</p>
            </div>

            <div className="text-white/90">
              <p className="text-sm font-medium opacity-75">Wrong</p>
              <p className="text-2xl font-bold text-red-400">{incorrectCount}</p>
            </div>
          </div>

          {/* Accuracy Gauge */}
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-white/75 flex items-center justify-end gap-2">
                <Target className="w-4 h-4" />
                Target: {targetAccuracy}%
              </p>
              <div className="flex items-center gap-2 mt-1">
                <motion.p
                  key={accuracy}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className={`text-3xl font-bold ${
                    isOnTarget ? 'text-green-400' : accuracy < 70 ? 'text-red-400' : 'text-yellow-400'
                  }`}
                >
                  {accuracy.toFixed(0)}%
                </motion.p>
                {isOnTarget ? (
                  <TrendingUp className="w-5 h-5 text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )}
              </div>
            </div>

            {/* Visual Meter */}
            <div className="w-32 h-3 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  isOnTarget ? 'bg-green-400' : accuracy < 70 ? 'bg-red-400' : 'bg-yellow-400'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}