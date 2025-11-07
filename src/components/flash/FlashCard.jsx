import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Eye } from "lucide-react";

export default function FlashCard({ vocabulary, mode, onAnswer, showExampleSentences = true }) {
  const [revealed, setRevealed] = useState(false);

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

  const handleAnswer = (correct) => {
    onAnswer(correct);
    setRevealed(false);
  };

  const shouldShowExample = showExampleSentences && vocabulary.example_sentence;

  return (
    <motion.div
      key={vocabulary.id}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full max-w-3xl px-2"
    >
      <Card className="border-none shadow-2xl bg-white/95 backdrop-blur-sm">
        <CardContent className="p-4 md:p-8">
          <div className="space-y-4 md:space-y-6">
            {/* Question */}
            <div className="text-center space-y-3">
              <p className="text-xs md:text-sm font-medium text-slate-500 uppercase tracking-wider">
                {mode.replace(/_/g, ' → ').replace(/to/g, '')}
              </p>
              <motion.div
                className="text-4xl sm:text-5xl md:text-7xl font-bold text-slate-900 min-h-[60px] md:min-h-[100px] flex items-center justify-center px-2 break-all"
                initial={{ y: 20 }}
                animate={{ y: 0 }}
              >
                {getQuestion()}
              </motion.div>
              {/* Show reading for kanji_to_meaning mode when revealed */}
              {mode === 'kanji_to_meaning' && revealed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-lg md:text-2xl text-slate-500"
                >
                  {vocabulary.hiragana}
                </motion.p>
              )}
              {/* Show example sentence when revealed */}
              {revealed && shouldShowExample && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs md:text-base text-slate-500 mt-3 p-3 md:p-4 bg-slate-50 rounded-lg max-h-32 overflow-y-auto"
                >
                  <p className="font-medium mb-1 text-indigo-600 text-sm">Example:</p>
                  <p className="text-slate-700 text-sm md:text-base mb-1 break-words">{vocabulary.example_sentence}</p>
                  {vocabulary.example_sentence_kana && (
                    <p className="text-slate-500 text-xs mb-1 break-words">{vocabulary.example_sentence_kana}</p>
                  )}
                  {vocabulary.example_sentence_meaning && (
                    <p className="text-slate-600 text-xs italic break-words">{vocabulary.example_sentence_meaning}</p>
                  )}
                </motion.div>
              )}
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevealed(!revealed)}
                  className="bg-white px-3 py-1.5 text-xs md:text-sm"
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
                    <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-indigo-600 min-h-[50px] md:min-h-[70px] flex items-center justify-center px-2 break-all">
                      {getAnswer()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 md:gap-3">
                    <Button
                      onClick={() => handleAnswer(false)}
                      size="lg"
                      variant="outline"
                      className="h-12 md:h-14 text-sm md:text-base font-semibold border-2 border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600"
                    >
                      <X className="w-4 h-4 md:w-5 md:h-5 mr-1.5" />
                      Wrong
                    </Button>
                    <Button
                      onClick={() => handleAnswer(true)}
                      size="lg"
                      className="h-12 md:h-14 text-sm md:text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      <Check className="w-4 h-4 md:w-5 md:h-5 mr-1.5" />
                      Correct
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-6 md:py-10"
                >
                  <p className="text-slate-400 text-sm md:text-base">Click reveal to check your answer</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}