import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

const levels = [
  { id: "N5", label: "N5 - Beginner", description: "Basic vocabulary", color: "bg-emerald-500" },
  { id: "N4", label: "N4 - Elementary", description: "Daily conversations", color: "bg-cyan-500" },
  { id: "N3", label: "N3 - Intermediate", description: "Complex topics", color: "bg-amber-500" },
  { id: "N2", label: "N2 - Advanced", description: "News & articles", color: "bg-rose-500" },
  { id: "N1", label: "N1 - Expert", description: "Native-level content", color: "bg-indigo-500" },
];

export default function LevelSelector({ selectedLevel, onSelectLevel, vocabularyCount = [], isPremium = false }) {
  const getCountForLevel = (level) => {
    return vocabularyCount.filter(v => v.level === level).length;
  };

  const isLocked = (level) => {
    return !isPremium && level !== "N5";
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold text-slate-700">JLPT Level</Label>
      <div className="space-y-2">
        {levels.map((level) => {
          const locked = isLocked(level.id);
          return (
            <motion.div
              key={level.id}
              whileHover={!locked ? { scale: 1.02 } : {}}
              whileTap={!locked ? { scale: 0.98 } : {}}
            >
              <Card
                onClick={() => !locked && onSelectLevel(level.id)}
                className={`${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} transition-all duration-300 border ${
                  selectedLevel === level.id && !locked
                    ? 'border-2 border-teal-500 bg-teal-50 shadow-md'
                    : 'border-stone-200 hover:border-teal-300 hover:shadow-sm'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg ${level.color} flex items-center justify-center text-white font-semibold text-base shadow-sm ${locked ? 'opacity-50' : ''}`}>
                        {locked ? <Lock className="w-6 h-6" /> : level.id}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-800">{level.label}</p>
                          {locked && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                              Premium
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{level.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {!locked && (
                        <Badge variant="secondary" className="text-xs bg-stone-100 text-slate-600">
                          {getCountForLevel(level.id)} words
                        </Badge>
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
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}