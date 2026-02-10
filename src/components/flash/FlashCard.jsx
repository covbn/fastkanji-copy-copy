import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eye } from "lucide-react";
import { boldVocabInSentence, renderWithBold } from "../utils/boldVocabInSentence";

export default function FlashCard({ vocabulary, mode, onAnswer, showExampleSentences = true, hideButtons = false, onRevealChange }) {
  const [revealed, setRevealed] = useState(false);

  // Reset reveal state when card changes
  React.useEffect(() => {
    setRevealed(false);
  }, [vocabulary.id]);

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
      initial={{ scale: 0.97, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.97, opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full px-4"
      style={{height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column'}}
    >
      <Card 
        className="w-full cursor-pointer active:scale-[0.99] transition-transform rounded-3xl shadow-lg flex flex-col"
        onClick={() => !revealed && setRevealed(true)}
        style={{height: '100%', minHeight: 0, maxHeight: '100%', display: 'flex', flexDirection: 'column'}}
      >
        <CardContent className="p-4 md:p-5 flex flex-col flex-1 overflow-hidden" style={{minHeight: 0}}>
          <div className="flex-1 flex flex-col justify-center overflow-y-auto" style={{minHeight: 0}}>
            <div className="space-y-2 md:space-y-2.5">
            {/* Question */}
            <div className="text-center space-y-2">
              <p className="text-[10px] md:text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {getModeDisplay()}
              </p>

              {/* Example sentence hint for reading_to_meaning (before reveal) */}
              {isReadingToMeaning && shouldShowExample && !revealed && (
                <div className="mb-1.5 px-3">
                  <p 
                    className="text-lg md:text-xl text-foreground italic leading-snug"
                    style={{fontFamily: "'Crimson Pro', serif"}}
                  >
                    {renderWithBold(boldVocabInSentence(vocabulary.example_sentence, vocabulary.kanji))}
                  </p>
                  {vocabulary.example_sentence_kana && (
                    <p className="text-xs md:text-sm text-muted-foreground mt-1.5 italic">
                      {renderWithBold(boldVocabInSentence(vocabulary.example_sentence_kana, vocabulary.hiragana))}
                    </p>
                  )}
                </div>
              )}

              <motion.div
                className="text-4xl sm:text-5xl md:text-6xl font-light text-foreground min-h-[60px] flex items-center justify-center px-2 break-all"
                style={{fontFamily: "'Crimson Pro', serif"}}
                initial={{ y: 10 }}
                animate={{ y: 0 }}
              >
                {getQuestion()}
              </motion.div>
              {mode === 'kanji_to_meaning' && revealed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-base md:text-lg text-muted-foreground"
                >
                  {vocabulary.hiragana}
                </motion.p>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealed(!revealed)}
                  className="bg-card px-4 py-2 text-xs md:text-sm"
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
                  className="space-y-2.5"
                >
                  <div className="text-center">
                    <p className="text-xl sm:text-2xl md:text-3xl font-normal text-teal-700 min-h-[32px] md:min-h-[40px] flex items-center justify-center px-2 break-all" style={{fontFamily: "'Crimson Pro', serif"}}>
                      {getAnswer()}
                    </p>
                  </div>

                  {/* Example - at bottom (for all modes after reveal, or reading_to_meaning with translation) */}
                  {shouldShowExample && (
                   <motion.div
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     className="text-xs text-muted-foreground p-2 md:p-2.5 bg-muted rounded-lg border border-border flex-1 overflow-y-auto custom-scrollbar"
                     style={{minHeight: '60px', maxHeight: '140px'}}
                   >
                     <p className="font-medium mb-1 text-teal-700 dark:text-teal-400 text-[10px] md:text-xs">Example</p>
                      {!isReadingToMeaning && (
                        <p 
                          className="text-foreground text-[10px] md:text-xs mb-1 break-words" 
                          style={{fontFamily: "'Crimson Pro', serif"}}
                          dangerouslySetInnerHTML={{ __html: vocabulary.example_sentence }}
                        />
                      )}
                      {vocabulary.example_sentence_kana && !isReadingToMeaning && (
                        <p 
                          className="text-muted-foreground text-[10px] mb-1 break-words"
                          dangerouslySetInnerHTML={{ __html: vocabulary.example_sentence_kana }}
                        />
                      )}
                      {vocabulary.example_sentence_meaning && (
                        <p className="text-muted-foreground text-[10px] italic break-words">{vocabulary.example_sentence_meaning}</p>
                      )}
                    </motion.div>
                  )}

                  {/* Action Buttons - only show if not hidden */}
                  {!hideButtons && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}
                        variant="outline"
                        className="h-14 text-base font-semibold border-2 border-rose-300 text-rose-700 hover:bg-rose-50 hover:border-rose-400 rounded-xl"
                      >
                        <X className="w-5 h-5 mr-2" />
                        <span className="md:inline hidden">Wrong</span>
                        <span className="md:hidden">Again</span>
                      </Button>
                      <Button
                        onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}
                        className="h-14 text-base font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-lg"
                      >
                        <Check className="w-5 h-5 mr-2" />
                        <span className="md:inline hidden">Correct</span>
                        <span className="md:hidden">Good</span>
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
                  <p className="text-muted-foreground text-sm hidden md:block">Press Space/Enter to reveal</p>
                </motion.div>
              )}
            </AnimatePresence>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}