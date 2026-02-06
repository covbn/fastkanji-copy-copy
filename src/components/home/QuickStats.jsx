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
    <div className="appTileGrid md:grid-cols-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <Card className="appCard hover:shadow-md transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-start justify-between mb-2">
                <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center shadow-sm`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-xl font-semibold text-foreground">
                {stat.value}{stat.suffix}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}