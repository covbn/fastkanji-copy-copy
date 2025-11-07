import React from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

export default function AccuracyMeter({ accuracy, correctCount, incorrectCount, currentCard, totalCards }) {
  const targetAccuracy = 85;
  const isOnTarget = accuracy >= targetAccuracy;

  return (
    <div className="bg-white/80 backdrop-blur-sm border-b border-stone-200 px-3 md:px-6 py-3">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          {/* Progress - Mobile optimized */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-slate-700">
              <p className="text-xs font-medium text-slate-500">Progress</p>
              <p className="text-lg md:text-2xl font-semibold whitespace-nowrap">
                {currentCard}/{totalCards}
              </p>
            </div>

            <div className="h-8 md:h-12 w-px bg-stone-300"></div>

            <div className="text-slate-700">
              <p className="text-xs font-medium text-slate-500">✓</p>
              <p className="text-lg md:text-2xl font-semibold text-emerald-600">{correctCount}</p>
            </div>

            <div className="text-slate-700">
              <p className="text-xs font-medium text-slate-500">✗</p>
              <p className="text-lg md:text-2xl font-semibold text-rose-600">{incorrectCount}</p>
            </div>
          </div>

          {/* Accuracy Gauge - Mobile optimized */}
          <div className="flex items-center gap-2 md:gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-medium text-slate-500 flex items-center justify-end gap-1.5">
                <Target className="w-3 h-3" />
                {targetAccuracy}%
              </p>
              <div className="flex items-center gap-2 mt-1">
                <motion.p
                  key={accuracy}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className={`text-2xl md:text-3xl font-semibold ${
                    isOnTarget ? 'text-emerald-600' : accuracy < 70 ? 'text-rose-600' : 'text-amber-600'
                  }`}
                >
                  {accuracy.toFixed(0)}%
                </motion.p>
                {isOnTarget ? (
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-600" />
                )}
              </div>
            </div>

            {/* Mobile version - simplified */}
            <div className="text-right sm:hidden">
              <motion.p
                key={accuracy}
                initial={{ scale: 1.2 }}
                animate={{ scale: 1 }}
                className={`text-2xl font-semibold ${
                  isOnTarget ? 'text-emerald-600' : accuracy < 70 ? 'text-rose-600' : 'text-amber-600'
                }`}
              >
                {accuracy.toFixed(0)}%
              </motion.p>
            </div>

            {/* Visual Meter */}
            <div className="w-16 md:w-32 h-2 md:h-3 bg-stone-200 rounded-full overflow-hidden hidden sm:block">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${accuracy}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full rounded-full ${
                  isOnTarget ? 'bg-emerald-500' : accuracy < 70 ? 'bg-rose-500' : 'bg-amber-500'
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}