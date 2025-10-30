import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Zap, Award, BookOpen } from "lucide-react";
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
      color: "from-blue-500 to-cyan-500",
      suffix: ""
    },
    { 
      label: "Cards Studied", 
      value: totalCards, 
      icon: Zap, 
      color: "from-indigo-500 to-purple-500",
      suffix: ""
    },
    { 
      label: "Avg Accuracy", 
      value: avgAccuracy.toFixed(0), 
      icon: Target, 
      color: "from-green-500 to-emerald-500",
      suffix: "%"
    },
    { 
      label: "Study Streak", 
      value: streak, 
      icon: Award, 
      color: "from-orange-500 to-red-500",
      suffix: " days"
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
        >
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {stat.value}{stat.suffix}
              </p>
              <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}