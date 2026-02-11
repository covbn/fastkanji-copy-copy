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
    <div className="fixed left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-sm px-3 py-2" style={{bottom: '56px', paddingBottom: 'max(0.5rem, calc(env(safe-area-inset-bottom) + 0.5rem))'}}>
      <div className="grid grid-cols-4 gap-2 w-full max-w-3xl mx-auto">
        <Button
          onClick={() => onGrade(1)}
          disabled={disabled}
          className="h-10 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-medium shadow-sm transition-all rounded-lg"
        >
          Again
        </Button>

        <Button
          onClick={() => onGrade(2)}
          disabled={disabled}
          className="h-10 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-medium shadow-sm transition-all rounded-lg"
        >
          Hard
        </Button>

        <Button
          onClick={() => onGrade(3)}
          disabled={disabled}
          className="h-10 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-medium shadow-sm transition-all rounded-lg"
        >
          Good
        </Button>

        <Button
          onClick={() => onGrade(4)}
          disabled={disabled}
          className="h-10 bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white text-xs font-medium shadow-sm transition-all rounded-lg"
        >
          Easy
        </Button>
      </div>
    </div>
  );
}