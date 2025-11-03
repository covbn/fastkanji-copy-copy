
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
      className="w-full max-w-2xl"
    >
      <Card className="border-none shadow-2xl bg-white/95 backdrop-blur-sm">
        <CardContent className="p-8 md:p-12">
          <div className="space-y-6 md:space-y-8">
            {/* Question */}
            <div className="text-center space-y-4">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                {mode.replace(/_/g, ' → ').replace(/to/g, '')}
              </p>
              <motion.div
                className="text-5xl md:text-8xl font-bold text-slate-900 min-h-[80px] md:min-h-[120px] flex items-center justify-center"
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
                  className="text-xl md:text-2xl text-slate-500"
                >
                  {vocabulary.hiragana}
                </motion.p>
              )}
              {/* Show example sentence when revealed */}
              {revealed && shouldShowExample && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm md:text-base text-slate-500 mt-4 p-4 bg-slate-50 rounded-lg"
                >
                  <p className="font-medium mb-1 text-indigo-600">Example:</p>
                  <p className="text-slate-700 text-base md:text-lg mb-2">{vocabulary.example_sentence}</p>
                  {vocabulary.example_sentence_kana && (
                    <p className="text-slate-500 text-sm mb-1">{vocabulary.example_sentence_kana}</p>
                  )}
                  {vocabulary.example_sentence_meaning && (
                    <p className="text-slate-600 text-xs md:text-sm italic">{vocabulary.example_sentence_meaning}</p>
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
                  className="bg-white px-4 py-2"
                >
                  <Eye className="w-4 h-4 mr-2" />
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
                  className="space-y-4 md:space-y-6"
                >
                  <div className="text-center">
                    <p className="text-4xl md:text-6xl font-bold text-indigo-600 min-h-[60px] md:min-h-[80px] flex items-center justify-center px-2">
                      {getAnswer()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <Button
                      onClick={() => handleAnswer(false)}
                      size="lg"
                      variant="outline"
                      className="h-14 md:h-16 text-base md:text-lg font-semibold border-2 border-red-500 text-red-600 hover:bg-red-50 hover:border-red-600"
                    >
                      <X className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                      Wrong
                    </Button>
                    <Button
                      onClick={() => handleAnswer(true)}
                      size="lg"
                      className="h-14 md:h-16 text-base md:text-lg font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      <Check className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                      Correct
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-8 md:py-12"
                >
                  <p className="text-slate-400 text-base md:text-lg">Click reveal to check your answer</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
