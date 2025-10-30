import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const levels = [
  { id: "N5", label: "N5 - Beginner", description: "Basic vocabulary", color: "from-green-500 to-emerald-500" },
  { id: "N4", label: "N4 - Elementary", description: "Daily conversations", color: "from-blue-500 to-cyan-500" },
  { id: "N3", label: "N3 - Intermediate", description: "Complex topics", color: "from-purple-500 to-pink-500" },
];

export default function LevelSelector({ selectedLevel, onSelectLevel, vocabularyCount = [] }) {
  const getCountForLevel = (level) => {
    return vocabularyCount.filter(v => v.level === level).length;
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold text-slate-700">JLPT Level</Label>
      <div className="space-y-2">
        {levels.map((level) => (
          <motion.div
            key={level.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card
              onClick={() => onSelectLevel(level.id)}
              className={`cursor-pointer transition-all duration-300 ${
                selectedLevel === level.id
                  ? 'border-2 border-indigo-500 bg-indigo-50 shadow-lg'
                  : 'border border-slate-200 hover:border-indigo-300 hover:shadow-md'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center text-white font-bold text-lg shadow-md`}>
                      {level.id}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{level.label}</p>
                      <p className="text-sm text-slate-500">{level.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {getCountForLevel(level.id)} words
                    </Badge>
                    {selectedLevel === level.id && (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
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
        ))}
      </div>
    </div>
  );
}