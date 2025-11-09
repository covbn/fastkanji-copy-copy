import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Coffee, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

const restMessages = [
  { icon: Coffee, message: "Quick break! お疲れ様です", color: "from-amber-500 to-orange-500" },
  { icon: Brain, message: "Let your brain rest 🧠", color: "from-teal-500 to-cyan-500" },
  { icon: Sparkles, message: "Recharge time! ✨", color: "from-emerald-500 to-teal-500" },
];

export default function RestInterval({ onContinue, duration = 600 }) {
  const [countdown, setCountdown] = useState(duration);
  const randomRest = restMessages[Math.floor(Math.random() * restMessages.length)];

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const existing = await base44.entities.UserSettings.filter({ user_email: user.email });
      return existing.length > 0 ? existing[0] : null;
    },
    enabled: !!user,
  });

  const nightMode = settings?.night_mode || false;

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
    <div className={`h-screen flex items-center justify-center p-4 overflow-hidden ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-teal-50 via-cyan-50 to-stone-50'}`}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-6 md:space-y-8 max-w-2xl"
      >
        {/* Icon - Static, no animation */}
        <div className={`w-24 h-24 md:w-32 md:h-32 mx-auto rounded-3xl bg-gradient-to-br ${randomRest.color} flex items-center justify-center shadow-2xl`}>
          <randomRest.icon className="w-12 h-12 md:w-16 md:h-16 text-white" />
        </div>

        {/* Message - Static */}
        <div className="space-y-4">
          <h2 className={`text-3xl md:text-5xl font-bold px-4 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
            {randomRest.message}
          </h2>
          <p className={`text-lg md:text-xl px-4 ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Random rest interval - scientifically proven to boost learning
          </p>
        </div>

        {/* Countdown - Only number changes */}
        <div className={`text-6xl md:text-8xl font-bold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
          {formatTime(countdown)}
        </div>

        <p className={`text-sm md:text-base px-4 ${nightMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Take this time to rest your eyes, stretch, or have a drink of water
        </p>

        {/* Ad Banner Placeholder */}
        <div className={`backdrop-blur-sm border rounded-2xl p-6 md:p-8 mx-4 ${nightMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white/50 border-stone-200'}`}>
          <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Advertisement Space</p>
          <p className={`text-xs mt-1 ${nightMode ? 'text-slate-500' : 'text-slate-400'}`}>Banner ad could be displayed here</p>
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
              className={`font-bold text-base md:text-lg px-6 md:px-8 py-5 md:py-6 ${nightMode ? 'bg-teal-600 hover:bg-teal-700 text-white' : 'bg-slate-800 text-white hover:bg-slate-900'}`}
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
            className={nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-stone-300 text-slate-700 hover:bg-stone-100'}
          >
            Skip Rest (Not Recommended)
          </Button>
        )}
      </motion.div>
    </div>
  );
}