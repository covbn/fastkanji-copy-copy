import React from "react";
import { Button } from "@/components/ui/button";
import { XCircle, Zap, CheckCircle2, TrendingUp } from "lucide-react";

/**
 * Anki-style grading buttons with 4 options
 * Maps to FSRS ratings: Again=1, Hard=2, Good=3, Easy=4
 */
export default function GradingButtons({ onGrade, disabled = false, nightMode = false }) {
  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-2xl">
      {/* Again (1) - Red */}
      <Button
        onClick={() => onGrade(1)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-red-600 hover:bg-red-700 text-white"
      >
        <XCircle className="w-5 h-5" />
        <span className="text-sm font-semibold">Again</span>
        <span className="text-xs opacity-80">&lt;1m</span>
      </Button>

      {/* Hard (2) - Yellow */}
      <Button
        onClick={() => onGrade(2)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-amber-600 hover:bg-amber-700 text-white"
      >
        <Zap className="w-5 h-5" />
        <span className="text-sm font-semibold">Hard</span>
        <span className="text-xs opacity-80">~10m</span>
      </Button>

      {/* Good (3) - Green */}
      <Button
        onClick={() => onGrade(3)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        <CheckCircle2 className="w-5 h-5" />
        <span className="text-sm font-semibold">Good</span>
        <span className="text-xs opacity-80">Next step</span>
      </Button>

      {/* Easy (4) - Blue */}
      <Button
        onClick={() => onGrade(4)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-cyan-600 hover:bg-cyan-700 text-white"
      >
        <TrendingUp className="w-5 h-5" />
        <span className="text-sm font-semibold">Easy</span>
        <span className="text-xs opacity-80">Skip ahead</span>
      </Button>
    </div>
  );
}