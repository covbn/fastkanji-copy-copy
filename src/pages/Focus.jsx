import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Play, Pause, RotateCcw, Home, Sparkles, Brain, X } from "lucide-react";

export default function Focus() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("ready"); // ready, breathing, hold_empty, inhale_hold, complete
  const [breathCount, setBreathCount] = useState(0);
  const [holdTimer, setHoldTimer] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState("inhale"); // inhale, exhale
  const [breathTimer, setBreathTimer] = useState(0);

  const totalBreaths = 30;
  const inhaleSeconds = 4;
  const exhaleSeconds = 4;

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

  // Automatic breathing timer
  useEffect(() => {
    let interval = null;
    if (phase === "breathing" && isActive) {
      interval = setInterval(() => {
        setBreathTimer((prev) => {
          const cycleLength = inhaleSeconds + exhaleSeconds;
          const newTimer = prev + 1;
          
          // Determine phase
          if (newTimer <= inhaleSeconds) {
            setBreathPhase("inhale");
          } else if (newTimer <= cycleLength) {
            setBreathPhase("exhale");
          } else {
            // Complete one breath cycle
            const newCount = breathCount + 1;
            setBreathCount(newCount);
            
            if (newCount >= totalBreaths) {
              setPhase("hold_empty");
              setHoldTimer(0);
              setIsActive(false);
            }
            return 0; // Reset timer for next breath
          }
          
          return newTimer;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, isActive, breathCount]);

  // Timer for hold phases
  useEffect(() => {
    let interval = null;
    if (isActive && (phase === "hold_empty" || phase === "inhale_hold")) {
      interval = setInterval(() => {
        setHoldTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, phase]);

  const startExercise = () => {
    setPhase("breathing");
    setBreathCount(0);
    setBreathTimer(0);
    setBreathPhase("inhale");
    setIsActive(true);
  };

  const skipToEnd = () => {
    setPhase("complete");
    setIsActive(false);
  };

  const finishEmptyHold = () => {
    setPhase("inhale_hold");
    setHoldTimer(0);
    setIsActive(true);
  };

  const finishInhaleHold = () => {
    setPhase("complete");
    setIsActive(false);
  };

  const reset = () => {
    setPhase("ready");
    setBreathCount(0);
    setHoldTimer(0);
    setBreathTimer(0);
    setIsActive(false);
  };

  const getBreathProgress = () => {
    const cycleLength = inhaleSeconds + exhaleSeconds;
    return (breathTimer / cycleLength) * 100;
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${nightMode ? 'bg-slate-900' : 'bg-gradient-to-br from-teal-50 via-cyan-50 to-stone-50'}`}>
      <Card className={`w-full max-w-2xl shadow-lg ${nightMode ? 'bg-slate-800 border-slate-700' : 'border-stone-200'}`}>
        <CardContent className="p-8 md:p-12">
          <AnimatePresence mode="wait">
            {/* Ready Phase */}
            {phase === "ready" && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <div className="w-20 h-20 mx-auto bg-gradient-to-br from-teal-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-lg">
                    <Wind className="w-10 h-10 text-white" />
                  </div>
                  <h1 className={`text-4xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
                    Focus Exercise
                  </h1>
                  <p className={nightMode ? 'text-slate-400 max-w-md mx-auto' : 'text-slate-600 max-w-md mx-auto'}>
                    Prime your brain for peak learning with this neuroplasticity-activating breathing protocol
                  </p>
                </div>

                <div className={`p-6 rounded-xl border text-left space-y-3 ${nightMode ? 'bg-slate-700/50 border-slate-600' : 'bg-teal-50 border-teal-200'}`}>
                  <h3 className={`font-bold flex items-center gap-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    <Brain className="w-5 h-5 text-teal-600" />
                    The Protocol
                  </h3>
                  <ol className={`space-y-2 ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-teal-600">1.</span>
                      <span>Take {totalBreaths} deep breaths (automatic 4s in, 4s out)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-teal-600">2.</span>
                      <span>Hold your breath with empty lungs for 15-60 seconds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-teal-600">3.</span>
                      <span>Take one deep breath and hold for 15 seconds</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-teal-600">4.</span>
                      <span>Resume normal breathing - you're ready!</span>
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={startExercise}
                    size="lg"
                    className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Start Exercise
                  </Button>
                  <Button
                    onClick={() => navigate(createPageUrl("Home"))}
                    variant="outline"
                    size="lg"
                    className={`w-full ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
                  >
                    <Home className="w-5 h-5 mr-2" />
                    Back to Home
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Breathing Phase */}
            {phase === "breathing" && (
              <motion.div
                key="breathing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <motion.div
                    animate={{ 
                      scale: breathPhase === "inhale" ? [1, 1.3] : [1.3, 1],
                    }}
                    transition={{ 
                      duration: breathPhase === "inhale" ? inhaleSeconds : exhaleSeconds,
                      ease: "easeInOut"
                    }}
                    className="w-32 h-32 mx-auto bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-xl relative"
                  >
                    <Wind className="w-16 h-16 text-white" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h2 className={`text-5xl font-bold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
                      {breathCount}/{totalBreaths}
                    </h2>
                    <p className={`text-2xl font-semibold ${breathPhase === 'inhale' ? 'text-teal-600' : 'text-cyan-600'}`}>
                      {breathPhase === 'inhale' ? 'Breathe In' : 'Breathe Out'}
                    </p>
                    <p className={nightMode ? 'text-slate-400' : 'text-slate-500'}>
                      Follow the circle
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className={`w-full h-2 rounded-full overflow-hidden ${nightMode ? 'bg-slate-700' : 'bg-stone-200'}`}>
                    <motion.div
                      className="h-full bg-teal-600"
                      style={{ width: `${getBreathProgress()}%` }}
                    />
                  </div>
                </div>

                <Button
                  onClick={skipToEnd}
                  variant="outline"
                  className={nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}
                >
                  <X className="w-4 h-4 mr-2" />
                  Skip Exercise
                </Button>
              </motion.div>
            )}

            {/* Hold Empty Phase */}
            {phase === "hold_empty" && (
              <motion.div
                key="hold_empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <div className="w-32 h-32 mx-auto bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-xl">
                    <Pause className="w-16 h-16 text-white" />
                  </div>
                  
                  <h2 className={`text-6xl font-bold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {holdTimer}s
                  </h2>
                  <p className={`text-xl ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Hold with empty lungs
                  </p>
                  <p className={nightMode ? 'text-slate-400' : 'text-slate-500'}>
                    Feel the tension build... this activates your alertness
                  </p>
                </div>

                <Button
                  onClick={finishEmptyHold}
                  size="lg"
                  className="w-full h-16 text-xl bg-amber-600 hover:bg-amber-700"
                >
                  Ready to Inhale
                </Button>
              </motion.div>
            )}

            {/* Inhale Hold Phase */}
            {phase === "inhale_hold" && (
              <motion.div
                key="inhale_hold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-32 h-32 mx-auto bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-xl"
                  >
                    <Sparkles className="w-16 h-16 text-white" />
                  </motion.div>
                  
                  <h2 className={`text-6xl font-bold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
                    {holdTimer}s
                  </h2>
                  <p className={`text-xl ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Hold deep breath
                  </p>
                  <p className={nightMode ? 'text-slate-400' : 'text-slate-500'}>
                    Hold for ~15 seconds, then release
                  </p>
                </div>

                <Button
                  onClick={finishInhaleHold}
                  size="lg"
                  className="w-full h-16 text-xl bg-emerald-600 hover:bg-emerald-700"
                >
                  Complete Exercise
                </Button>
              </motion.div>
            )}

            {/* Complete Phase */}
            {phase === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <motion.div
                    animate={{ 
                      rotate: [0, 360],
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: 3,
                      ease: "easeInOut"
                    }}
                    className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center shadow-xl"
                  >
                    <Sparkles className="w-12 h-12 text-white" />
                  </motion.div>
                  
                  <h2 className={`text-4xl font-semibold ${nightMode ? 'text-slate-100' : 'text-slate-800'}`} style={{fontFamily: "'Crimson Pro', serif"}}>
                    Exercise Complete!
                  </h2>
                  <p className={`text-lg max-w-md mx-auto ${nightMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    Your brain is now primed for maximum learning. Your alertness and focus are heightened - perfect time to study! 🧠
                  </p>
                </div>

                <div className={`p-6 rounded-xl border ${nightMode ? 'bg-slate-700/50 border-slate-600' : 'bg-teal-50 border-teal-200'}`}>
                  <p className={nightMode ? 'text-slate-300' : 'text-slate-700'}>
                    <strong>Pro tip:</strong> Do this exercise before each study session for best results. 
                    The effects last 45-90 minutes.
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={() => navigate(createPageUrl("Home"))}
                    size="lg"
                    className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700"
                  >
                    Start Studying
                  </Button>
                  <Button
                    onClick={reset}
                    variant="outline"
                    size="lg"
                    className={`w-full ${nightMode ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : ''}`}
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Do Another Round
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}