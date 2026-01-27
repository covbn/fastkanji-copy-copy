import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Play, Pause, RotateCcw, Home, Sparkles, Brain, X, Eye } from "lucide-react";

export default function Focus() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState("ready"); // ready, breathing, hold_empty, inhale_hold, dot_stare, complete
  const [breathCount, setBreathCount] = useState(0);
  const [holdTimer, setHoldTimer] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState("inhale"); // inhale, exhale
  const [breathTimer, setBreathTimer] = useState(0);
  const [dotTimer, setDotTimer] = useState(0);

  const totalBreaths = 20;
  const inhaleSeconds = 4;
  const exhaleSeconds = 4;
  const holdSeconds = 1;
  const dotStareDuration = 30;

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

  const updateFocusCountMutation = useMutation({
    mutationFn: async () => {
      if (!settings || !user) return;
      return base44.entities.UserSettings.update(settings.id, {
        focus_exercises_completed: (settings.focus_exercises_completed || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });

  // Automatic breathing timer
  useEffect(() => {
    let interval = null;
    if (phase === "breathing" && isActive) {
      interval = setInterval(() => {
        setBreathTimer((prev) => {
          const cycleLength = inhaleSeconds + holdSeconds + exhaleSeconds + holdSeconds;
          const newTimer = prev + 1;
          
          // Update phase based on current timer position
          if (newTimer <= inhaleSeconds) {
            setBreathPhase("inhale");
          } else if (newTimer <= inhaleSeconds + holdSeconds) {
            setBreathPhase("hold");
          } else if (newTimer <= inhaleSeconds + holdSeconds + exhaleSeconds) {
            setBreathPhase("exhale");
          } else if (newTimer <= cycleLength) {
            setBreathPhase("hold");
          }
          
          if (newTimer >= cycleLength) {
            const newCount = breathCount + 1;
            setBreathCount(newCount);
            
            if (newCount >= totalBreaths) {
              setPhase("hold_empty");
              setHoldTimer(0);
              setIsActive(false);
              return 0;
            }
            return 1; // Start next cycle at 1
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

  // Dot stare timer
  useEffect(() => {
    let interval = null;
    if (phase === "dot_stare") {
      interval = setInterval(() => {
        setDotTimer((prev) => {
          if (prev + 1 >= dotStareDuration) {
            finishExercise();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  const startExercise = () => {
    setPhase("breathing");
    setBreathCount(0);
    setBreathTimer(0);
    setBreathPhase("inhale");
    setIsActive(true);
  };

  const skipToEnd = () => {
    finishExercise();
  };

  const finishEmptyHold = () => {
    setPhase("inhale_hold");
    setHoldTimer(0);
    setIsActive(true);
  };

  const finishInhaleHold = () => {
    setPhase("dot_stare");
    setDotTimer(0);
    setIsActive(false);
  };

  const finishExercise = () => {
    updateFocusCountMutation.mutate();
    setPhase("complete");
    setIsActive(false);
  };

  const reset = () => {
    setPhase("ready");
    setBreathCount(0);
    setHoldTimer(0);
    setBreathTimer(0);
    setDotTimer(0);
    setIsActive(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-2xl shadow-lg border-border bg-card">
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
                  <h1 className="text-4xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                    Focus Exercise
                  </h1>
                  <p className="text-muted-foreground max-w-md mx-auto">
                    Prime your brain for peak learning with this neuroplasticity-activating protocol
                  </p>
                </div>

                <div className="p-6 rounded-xl border border-border bg-muted text-left space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-foreground">
                    <Brain className="w-5 h-5 text-teal-600" />
                    The Exercise (~2 minutes)
                  </h3>
                  <ol className="space-y-2 text-foreground">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-teal-600">1.</span>
                      <span>Take {totalBreaths} deep breaths (automatic 4s in, 1s hold, 4s out, 1s hold)</span>
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
                      <span>Focus on a dot for 30 seconds to sharpen attention</span>
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
                    className="w-full"
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
                      scale: breathPhase === "inhale" ? 1.3 : breathPhase === "exhale" ? 1 : (breathPhase === "hold" && breathTimer <= inhaleSeconds + holdSeconds) ? 1.3 : 1,
                    }}
                    transition={{ 
                      duration: breathPhase === "inhale" ? inhaleSeconds : breathPhase === "exhale" ? exhaleSeconds : holdSeconds,
                      ease: "easeInOut"
                    }}
                    className="w-32 h-32 md:w-32 md:h-32 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-xl relative"
                  >
                    <Wind className="w-16 h-16 text-white" />
                  </motion.div>
                  
                  <div className="space-y-2">
                    <h2 className="text-5xl font-bold px-4 text-foreground">
                      {breathCount}/{totalBreaths}
                    </h2>
                    <p className={`text-2xl font-semibold ${
                      breathPhase === 'inhale' ? 'text-teal-600' : 
                      breathPhase === 'exhale' ? 'text-cyan-600' : 
                      'text-amber-600'
                    }`}>
                      {breathPhase === 'inhale' ? 'Breathe In' : 
                       breathPhase === 'exhale' ? 'Breathe Out' : 
                       'Hold'}
                    </p>
                    <p className="text-muted-foreground">
                      Follow the circle
                    </p>
                  </div>
                </div>

                <Button
                  onClick={skipToEnd}
                  variant="outline"
                  size="sm"
                >
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
                  
                  <h2 className="text-6xl font-bold text-foreground">
                    {holdTimer}s
                  </h2>
                  <p className="text-xl text-foreground">
                    Hold with empty lungs
                  </p>
                  <p className="text-muted-foreground">
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
                  
                  <h2 className="text-6xl font-bold text-foreground">
                    {holdTimer}s
                  </h2>
                  <p className="text-xl text-foreground">
                    Hold deep breath
                  </p>
                  <p className="text-muted-foreground">
                    Hold for ~15 seconds, then continue
                  </p>
                </div>

                <Button
                  onClick={finishInhaleHold}
                  size="lg"
                  className="w-full h-16 text-xl bg-emerald-600 hover:bg-emerald-700"
                >
                  Continue
                </Button>
              </motion.div>
            )}

            {/* Dot Stare Phase */}
            {phase === "dot_stare" && (
              <motion.div
                key="dot_stare"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <Eye className="w-12 h-12 mx-auto text-muted-foreground" />
                  <h2 className="text-3xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                    Focus on the Dot
                  </h2>
                  <p className="text-muted-foreground">
                    Stare at the dot without looking away. Blink as needed.
                  </p>
                </div>

                {/* Dot */}
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="w-4 h-4 mx-auto rounded-full bg-teal-600 shadow-lg"
                />

                {/* Timer */}
                <div className="space-y-2">
                  <h3 className="text-5xl font-bold text-foreground">
                    {dotStareDuration - dotTimer}s
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    remaining
                  </p>
                </div>

                <Button
                  onClick={finishExercise}
                  variant="outline"
                  size="sm"
                >
                  Skip
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
                  
                  <h2 className="text-4xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
                    Exercise Complete!
                  </h2>
                  <p className="text-lg max-w-md mx-auto text-muted-foreground">
                    Your brain is now primed for maximum learning. Your alertness and focus are heightened - perfect time to study! 🧠
                  </p>
                </div>

                <div className="p-6 rounded-xl border border-border bg-muted">
                  <p className="text-foreground">
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
                    className="w-full"
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