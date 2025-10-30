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
  const [countdown, setCountdown] = useState(600); // 10 minutes = 600 seconds
  const randomRest = restMessages[Math.floor(Math.random() * restMessages.length)];

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-4 overflow-hidden">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-6 md:space-y-8 max-w-2xl"
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
          className={`w-24 h-24 md:w-32 md:h-32 mx-auto rounded-3xl bg-gradient-to-br ${randomRest.color} flex items-center justify-center shadow-2xl`}
        >
          <randomRest.icon className="w-12 h-12 md:w-16 md:h-16 text-white" />
        </motion.div>

        {/* Message */}
        <div className="space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold text-white px-4">
            {randomRest.message}
          </h2>
          <p className="text-lg md:text-xl text-white/70 px-4">
            Random rest interval - scientifically proven to boost learning
          </p>
        </div>

        {/* Countdown */}
        <motion.div
          key={Math.floor(countdown / 10)}
          initial={{ scale: 1.2, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-6xl md:text-8xl font-bold text-white"
        >
          {formatTime(countdown)}
        </motion.div>

        <p className="text-white/60 text-sm md:text-base px-4">
          Take this time to rest your eyes, stretch, or have a drink of water
        </p>

        {/* Ad Banner Placeholder */}
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 md:p-8 mx-4">
          <p className="text-white/50 text-sm">Advertisement Space</p>
          <p className="text-white/30 text-xs mt-1">Banner ad could be displayed here</p>
        </div>

        {/* Continue Button - only show when countdown is 0 */}
        {countdown === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Button
              onClick={onContinue}
              size="lg"
              className="bg-white text-indigo-900 hover:bg-white/90 font-bold text-base md:text-lg px-6 md:px-8 py-5 md:py-6"
            >
              Continue Studying →
            </Button>
          </motion.div>
        )}

        {/* Skip button - available at any time */}
        {countdown > 0 && (
          <Button
            onClick={onContinue}
            variant="outline"
            size="sm"
            className="border-white/20 text-white hover:bg-white/10"
          >
            Skip Rest (Not Recommended)
          </Button>
        )}
      </motion.div>
    </div>
  );
}