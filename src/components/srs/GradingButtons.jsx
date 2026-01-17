import React from "react";
import { Button } from "@/components/ui/button";
import { XCircle, Zap, TrendingUp } from "lucide-react";

/**
 * 3-button grading system with Anki-like scheduling
 * 
 * SCHEDULING MAPPING:
 * - Again (1): Failed recall → restart learning / lapse to relearning
 * - Hard (2): Hard recall → advance learning step OR review with Hard difficulty
 * - Easy (4): Easy recall → GRADUATE immediately (New/Learning → Review) OR extended review interval
 * 
 * INTERNAL BEHAVIOR (Good=3 removed from UI):
 * - For Learning progression: Hard internally advances like Good but logs as Hard for FSRS
 * - This preserves Anki-like step progression without requiring 4 buttons
 */
export default function GradingButtons({ onGrade, disabled = false, nightMode = false, revealed = false }) {
  React.useEffect(() => {
    if (!revealed || disabled) return;

    const handleKeyPress = (e) => {
      if (e.key === '1') {
        onGrade(1); // Again
      } else if (e.key === '2') {
        onGrade(2); // Hard
      } else if (e.key === '3') {
        onGrade(4); // Easy (mapped to 3 key for convenience)
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [revealed, disabled, onGrade]);

  if (!revealed) return null;

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-2xl">
      {/* Again (1) - Red */}
      <Button
        onClick={() => onGrade(1)}
        disabled={disabled}
        className="flex flex-col items-center gap-1.5 h-auto py-5 bg-red-600 hover:bg-red-700 text-white shadow-md transition-all"
      >
        <XCircle className="w-6 h-6" />
        <span className="text-base font-semibold">Again</span>
        <span className="text-xs opacity-80">&lt;1m · Press 1</span>
      </Button>

      {/* Hard (2) - Amber */}
      <Button
        onClick={() => onGrade(2)}
        disabled={disabled}
        className="flex flex-col items-center gap-1.5 h-auto py-5 bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all"
      >
        <Zap className="w-6 h-6" />
        <span className="text-base font-semibold">Hard</span>
        <span className="text-xs opacity-80">Continue · Press 2</span>
      </Button>

      {/* Easy (4) - Cyan */}
      <Button
        onClick={() => onGrade(4)}
        disabled={disabled}
        className="flex flex-col items-center gap-1.5 h-auto py-5 bg-cyan-600 hover:bg-cyan-700 text-white shadow-md transition-all"
      >
        <TrendingUp className="w-6 h-6" />
        <span className="text-base font-semibold">Easy</span>
        <span className="text-xs opacity-80">Graduate · Press 3</span>
      </Button>
    </div>
  );
}