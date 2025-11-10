import React from "react";
import { motion } from "framer-motion";
import { Target, TrendingUp, TrendingDown } from "lucide-react";

export default function AccuracyMeter({ accuracy, correctCount, incorrectCount, currentCard, totalCards, nightMode = false, showProgress = true }) {
  const targetAccuracy = 85;
  const isOnTarget = accuracy >= targetAccuracy;

  return (
    <div className="flex items-center gap-3">
      {/* Progress - Only show if showProgress is true */}
      {showProgress && (
        <>
          <div className={nightMode ? 'text-slate-200' : 'text-slate-700'}>
            <p className={`text-xs font-medium ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Progress</p>
            <p className="text-lg md:text-2xl font-semibold whitespace-nowrap">
              {currentCard}/{totalCards}
            </p>
          </div>

          <div className={`h-8 md:h-12 w-px ${nightMode ? 'bg-slate-600' : 'bg-stone-300'}`}></div>
        </>
      )}

      <div className={nightMode ? 'text-slate-200' : 'text-slate-700'}>
        <p className={`text-xs font-medium ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>✓</p>
        <p className="text-lg md:text-2xl font-semibold text-emerald-600">{correctCount}</p>
      </div>

      <div className={nightMode ? 'text-slate-200' : 'text-slate-700'}>
        <p className={`text-xs font-medium ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>✗</p>
        <p className="text-lg md:text-2xl font-semibold text-rose-600">{incorrectCount}</p>
      </div>

      <div className={`h-8 md:h-12 w-px ${nightMode ? 'bg-slate-600' : 'bg-stone-300'}`}></div>

      {/* Accuracy Gauge */}
      <div className="flex items-center gap-2">
        <div className="text-right hidden sm:block">
          <p className={`text-xs font-medium flex items-center justify-end gap-1.5 ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>
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
        <div className={`w-16 md:w-32 h-2 md:h-3 rounded-full overflow-hidden hidden sm:block ${nightMode ? 'bg-slate-700' : 'bg-stone-200'}`}>
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
  );
}