import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { uiLevelToDatasetLevel } from "../utils/vocabNormalizer";

const levels = [
  { id: "N5", label: "N5 - Beginner", description: "Basic vocabulary", color: "bg-emerald-500" },
  { id: "N4", label: "N4 - Elementary", description: "Daily conversations", color: "bg-cyan-500" },
  { id: "N3", label: "N3 - Intermediate", description: "Complex topics", color: "bg-amber-500" },
  { id: "N2", label: "N2 - Advanced", description: "News & articles", color: "bg-rose-500" },
  { id: "N1", label: "N1 - Expert", description: "Native-level content", color: "bg-indigo-500" },
];

export default function LevelSelector({ selectedLevel, onSelectLevel, vocabularyCount = [], isPremium = false }) {
  const getCountForLevel = (uiLevel) => {
    const datasetLevel = uiLevelToDatasetLevel(uiLevel);
    return vocabularyCount.filter(v => v.level === datasetLevel).length;
  };

  const isLocked = (level) => {
    if (isPremium) return false;
    return level !== "N5";
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">JLPT Level</Label>
      <div className="space-y-1.5">
        {levels.map((level) => {
          const locked = isLocked(level.id);
          return (
            <motion.div
              key={level.id}
              whileTap={!locked ? { scale: 0.98 } : {}}
            >
              <div
                onClick={() => !locked && onSelectLevel(level.id)}
                className={`${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  selectedLevel === level.id && !locked
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                    : 'border-border hover:border-teal-300'
                }`}
              >
                <div className={`w-10 h-10 rounded-lg ${level.color} flex items-center justify-center text-white font-semibold text-sm shadow-sm ${locked ? 'opacity-50' : ''}`}>
                  {locked ? <Lock className="w-5 h-5" /> : level.id}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">{level.label}</p>
                    {locked && (
                      <Badge variant="outline" className="text-[11px] h-5 px-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700">
                        Premium
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{level.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!locked && (
                    <span className="text-xs text-muted-foreground">
                      {getCountForLevel(level.id)}
                    </span>
                  )}
                  {selectedLevel === level.id && !locked && (
                    <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}