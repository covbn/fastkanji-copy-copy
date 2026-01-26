import React from "react";
import { Button } from "@/components/ui/button";
import { XCircle, Zap, CheckCircle, TrendingUp } from "lucide-react";

/**
 * 4-button grading system with Anki semantics
 * Maps to ratings: 1=Again, 2=Hard, 3=Good, 4=Easy
 * 
 * UI shows all 4 buttons after reveal, engine uses all 4 ratings correctly
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
        onGrade(3); // Good
      } else if (e.key === '4') {
        onGrade(4); // Easy
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [revealed, disabled, onGrade]);

  if (!revealed) return null;

  return (
    <div className="grid grid-cols-4 gap-2 w-full max-w-3xl">
      {/* Again (1) - Red */}
      <Button
        onClick={() => onGrade(1)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-red-600 hover:bg-red-700 text-white shadow-md transition-all"
      >
        <XCircle className="w-5 h-5" />
        <span className="text-sm font-semibold">Again</span>
        <span className="text-xs opacity-80">1</span>
      </Button>

      {/* Hard (2) - Amber */}
      <Button
        onClick={() => onGrade(2)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all"
      >
        <Zap className="w-5 h-5" />
        <span className="text-sm font-semibold">Hard</span>
        <span className="text-xs opacity-80">2</span>
      </Button>

      {/* Good (3) - Green */}
      <Button
        onClick={() => onGrade(3)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all"
      >
        <CheckCircle className="w-5 h-5" />
        <span className="text-sm font-semibold">Good</span>
        <span className="text-xs opacity-80">3</span>
      </Button>

      {/* Easy (4) - Cyan */}
      <Button
        onClick={() => onGrade(4)}
        disabled={disabled}
        className="flex flex-col items-center gap-1 h-auto py-4 bg-cyan-600 hover:bg-cyan-700 text-white shadow-md transition-all"
      >
        <TrendingUp className="w-5 h-5" />
        <span className="text-sm font-semibold">Easy</span>
        <span className="text-xs opacity-80">4</span>
      </Button>
    </div>
  );
}