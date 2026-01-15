import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eye } from "lucide-react";

export default function FlashCard({ vocabulary, mode, onAnswer, showExampleSentences = true, hideButtons = false, onRevealChange }) {
  const [revealed, setRevealed] = useState(false);

  React.useEffect(() => {
    if (onRevealChange) {
      onRevealChange(revealed);
    }
  }, [revealed, onRevealChange]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!revealed) {
          setRevealed(true);
        }
      } else if (revealed) {
        if (e.key === '1' || e.key === 'ArrowLeft') {
          e.preventDefault();
          handleAnswer(false);
        } else if (e.key === '2' || e.key === 'ArrowRight') {
          e.preventDefault();
          handleAnswer(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [revealed]);

  const getQuestion = () => {
    switch (mode) {
      case 'kanji_to_reading':
        return vocabulary.kanji;
      case 'kanji_to_meaning':
        return vocabulary.kanji;
      case 'reading_to_meaning':
        return vocabulary.hiragana;
      default:
        return vocabulary.kanji;
    }
  };

  const getAnswer = () => {
    switch (mode) {
      case 'kanji_to_reading':
        return vocabulary.hiragana;
      case 'kanji_to_meaning':
        return vocabulary.meaning;
      case 'reading_to_meaning':
        return vocabulary.meaning;
      default:
        return vocabulary.meaning;
    }
  };

  const handleAnswer = (correct, rating = null) => {
    onAnswer(correct, rating);
    setRevealed(false);
  };

  const getModeDisplay = () => {
    return mode.replace(/_/g, ' ').replace('to', '→');
  };

  const shouldShowExample = showExampleSentences && vocabulary.example_sentence;
  const isReadingToMeaning = mode === 'reading_to_meaning';

  return (
    <motion.div
      key={vocabulary.id}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-3xl px-2"
    >
      <Card className="border border-stone-200 shadow-md bg-white">
        <CardContent className="p-6 md:p-10">
          <div className="space-y-4 md:space-y-6">
            {/* Question */}
            <div className="text-center space-y-3">
              <p className="text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider">
                {getModeDisplay()}
              </p>

              {/* Example sentence hint for reading_to_meaning (before reveal) */}
              {isReadingToMeaning && shouldShowExample && !revealed && (
                <div className="text-xs text-slate-400 mb-2 px-4">
                  <p 
                    className="italic"
                    dangerouslySetInnerHTML={{ __html: vocabulary.example_sentence }}
                  />
                </div>
              )}

              <motion.div
                className="text-5xl sm:text-6xl md:text-7xl font-light text-slate-800 min-h-[60px] md:min-h-[80px] flex items-center justify-center px-2 break-all"
                style={{fontFamily: "'Crimson Pro', serif"}}
                initial={{ y: 20 }}
                animate={{ y: 0 }}
              >
                {getQuestion()}
              </motion.div>
              {mode === 'kanji_to_meaning' && revealed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-lg md:text-xl text-slate-500"
                >
                  {vocabulary.hiragana}
                </motion.p>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-stone-200"></div>
              </div>
              <div className="relative flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealed(!revealed)}
                  className="bg-white px-4 py-2 text-xs md:text-sm border-stone-300 hover:bg-stone-50"
                >
                  <Eye className="w-3 h-3 md:w-4 md:h-4 mr-1.5" />
                  {revealed ? 'Hide' : 'Reveal'}
                </Button>
              </div>
            </div>

            {/* Answer */}
            <AnimatePresence mode="wait">
              {revealed ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-4"
                >
                  <div className="text-center">
                    <p className="text-3xl sm:text-4xl md:text-5xl font-normal text-teal-700 min-h-[50px] md:min-h-[60px] flex items-center justify-center px-2 break-all" style={{fontFamily: "'Crimson Pro', serif"}}>
                      {getAnswer()}
                    </p>
                  </div>

                  {/* Example - at bottom (for all modes after reveal, or reading_to_meaning with translation) */}
                  {shouldShowExample && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs md:text-sm text-slate-600 p-3 md:p-4 bg-stone-50 rounded-lg border border-stone-200 max-h-32 md:max-h-40 overflow-y-auto custom-scrollbar"
                    >
                      <p className="font-medium mb-1.5 text-teal-700 text-xs md:text-sm">Example</p>
                      {!isReadingToMeaning && (
                        <p 
                          className="text-slate-700 text-xs md:text-sm mb-1.5 break-words" 
                          style={{fontFamily: "'Crimson Pro', serif"}}
                          dangerouslySetInnerHTML={{ __html: vocabulary.example_sentence }}
                        />
                      )}
                      {vocabulary.example_sentence_kana && !isReadingToMeaning && (
                        <p 
                          className="text-slate-500 text-xs mb-1.5 break-words"
                          dangerouslySetInnerHTML={{ __html: vocabulary.example_sentence_kana }}
                        />
                      )}
                      {vocabulary.example_sentence_meaning && (
                        <p className="text-slate-600 text-xs italic break-words">{vocabulary.example_sentence_meaning}</p>
                      )}
                    </motion.div>
                  )}

                  {/* Action Buttons - only show if not hidden */}
                  {!hideButtons && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <Button
                        onClick={() => handleAnswer(false)}
                        size="sm"
                        variant="outline"
                        className="h-8 md:h-9 text-xs font-medium border-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400"
                      >
                        <X className="w-3 h-3 mr-1" />
                        Wrong (1/←)
                      </Button>
                      <Button
                        onClick={() => handleAnswer(true)}
                        size="sm"
                        className="h-8 md:h-9 text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white"
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Correct (2/→)
                      </Button>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-6 md:py-8"
                >
                  <p className="text-slate-400 text-sm md:text-base">Press Space/Enter to reveal</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}