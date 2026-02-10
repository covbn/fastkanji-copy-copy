import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Zap, Target, Flame } from "lucide-react";
import { motion } from "framer-motion";

export default function QuickStats({ sessions = [], totalWords = 0, streak = 0 }) {
  const totalCards = sessions.reduce((sum, s) => sum + s.total_cards, 0);
  const avgAccuracy = sessions.length > 0 
    ? sessions.reduce((sum, s) => sum + s.accuracy, 0) / sessions.length 
    : 0;
  
  const stats = [
    { 
      label: "Total Words", 
      value: totalWords, 
      icon: BookOpen, 
      color: "bg-teal-500",
      suffix: ""
    },
    { 
      label: "Cards Studied", 
      value: totalCards, 
      icon: Zap, 
      color: "bg-cyan-500",
      suffix: ""
    },
    { 
      label: "Avg Accuracy", 
      value: avgAccuracy.toFixed(0), 
      icon: Target, 
      color: "bg-emerald-500",
      suffix: "%"
    },
    { 
      label: "Study Streak", 
      value: streak, 
      icon: Flame, 
      color: "bg-amber-500",
      suffix: " days"
    },
  ];

  return (
    <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
      <div className="flex gap-3 min-w-max">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.05 }}
            className="flex-shrink-0 w-32"
          >
            <div className="p-3 rounded-2xl border border-border bg-card shadow-sm">
              <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <stat.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-xl font-bold text-foreground leading-none mb-0.5">
                {stat.value}{stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground leading-tight">{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}