import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";

const modes = [
  {
    id: "kanji_to_meaning",
    label: "Kanji → Meaning",
    description: "Learn word meanings",
    example: "食べる → to eat",
  },
  {
    id: "kanji_to_reading",
    label: "Kanji → Reading",
    description: "Practice reading kanji",
    example: "食べる → たべる",
  },
  {
    id: "reading_to_meaning",
    label: "Reading → Meaning",
    description: "Test comprehension",
    example: "たべる → to eat",
  },
];

export default function ModeSelector({ selectedMode, onSelectMode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">Study Mode</Label>
      <div className="space-y-1.5">
        {modes.map((mode) => (
          <motion.div
            key={mode.id}
            whileTap={{ scale: 0.98 }}
          >
            <div
              onClick={() => onSelectMode(mode.id)}
              className={`cursor-pointer p-3 rounded-lg border transition-all ${
                selectedMode === mode.id
                  ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                  : 'border-border hover:border-teal-300'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{mode.label}</p>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                  <p className="text-sm font-medium text-teal-700 dark:text-teal-400 mt-1">{mode.example}</p>
                </div>
                {selectedMode === mode.id && (
                  <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}