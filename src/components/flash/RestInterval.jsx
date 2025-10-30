import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coffee, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const restMessages = [
  { icon: Coffee, message: "Quick break! お疲れ様です", color: "from-amber-500 to-orange-500" },
  { icon: Brain, message: "Let your brain rest 🧠", color: "from-purple-500 to-pink-500" },
  { icon: Sparkles, message: "Recharge time! ✨", color: "from-blue-500 to-cyan-500" },
];

export default function RestInterval({ onContinue }) {
  const [countdown, setCountdown] = useState(5);
  const randomRest = restMessages[Math.floor(Math.random() * restMessages.length)];

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-8"
      >
        {/* Icon */}
        <motion.div
          animate={{ 
            rotate: [0, 10, -10, 0],
            scale: [1, 1.1, 1]
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`w-32 h-32 mx-auto rounded-3xl bg-gradient-to-br ${randomRest.color} flex items-center justify-center shadow-2xl`}
        >
          <randomRest.icon className="w-16 h-16 text-white" />
        </motion.div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            {randomRest.message}
          </h2>
          <p className="text-xl text-white/70">
            Take a moment to breathe and relax
          </p>
        </div>

        {/* Countdown */}
        <motion.div
          key={countdown}
          initial={{ scale: 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-8xl font-bold text-white"
        >
          {countdown}
        </motion.div>

        {/* Ad Banner Placeholder */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 max-w-md mx-auto">
          <p className="text-white/50 text-sm">Advertisement Space</p>
          <p className="text-white/30 text-xs mt-1">Banner ad could be displayed here</p>
        </div>

        {/* Continue Button */}
        {countdown === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={onContinue}
              size="lg"
              className="bg-white text-indigo-900 hover:bg-white/90 font-bold text-lg px-8 py-6"
            >
              Continue Studying →
            </Button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}