import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Play, Pause, RotateCcw, Home, Sparkles, Brain } from "lucide-react";

export default function Focus() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("ready"); // ready, breathing, hold_empty, inhale_hold, complete
  const [breathCount, setBreathCount] = useState(0);
  const [holdTimer, setHoldTimer] = useState(0);
  const [isActive, setIsActive] = useState(false);

  const totalBreaths = 30;

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
    setIsActive(true);
  };

  const handleBreath = () => {
    const newCount = breathCount + 1;
    setBreathCount(newCount);
    
    if (newCount >= totalBreaths) {
      setPhase("hold_empty");
      setHoldTimer(0);
    }
  };

  const finishEmptyHold = () => {
    setPhase("inhale_hold");
    setHoldTimer(0);
  };

  const finishInhaleHold = () => {
    setPhase("complete");
    setIsActive(false);
  };

  const reset = () => {
    setPhase("ready");
    setBreathCount(0);
    setHoldTimer(0);
    setIsActive(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-cyan-50 to-stone-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl border-stone-200 shadow-lg">
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
                  <h1 className="text-4xl font-semibold text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
                    Focus Exercise
                  </h1>
                  <p className="text-slate-600 max-w-md mx-auto">
                    Prime your brain for peak learning with this neuroplasticity-activating breathing protocol
                  </p>
                </div>

                <div className="bg-teal-50 p-6 rounded-xl border border-teal-200 text-left space-y-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Brain className="w-5 h-5 text-teal-600" />
                    The Protocol
                  </h3>
                  <ol className="space-y-2 text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="font-semibold text-teal-600">1.</span>
                      <span>Take {totalBreaths} deep breaths (inhale through nose, exhale through mouth)</span>
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
                      scale: [1, 1.2, 1],
                      rotate: [0, 180, 360]
                    }}
                    transition={{ 
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="w-32 h-32 mx-auto bg-gradient-to-br from-teal-500 to-cyan-500 rounded-full flex items-center justify-center shadow-xl"
                  >
                    <Wind className="w-16 h-16 text-white" />
                  </motion.div>
                  
                  <h2 className="text-5xl font-bold text-slate-800">
                    {breathCount}/{totalBreaths}
                  </h2>
                  <p className="text-xl text-slate-600">
                    Deep breaths
                  </p>
                  <p className="text-slate-500">
                    Inhale through nose • Exhale through mouth
                  </p>
                </div>

                <Button
                  onClick={handleBreath}
                  size="lg"
                  className="w-full h-16 text-xl bg-teal-600 hover:bg-teal-700"
                >
                  Breath Complete
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
                  
                  <h2 className="text-6xl font-bold text-slate-800">
                    {holdTimer}s
                  </h2>
                  <p className="text-xl text-slate-600">
                    Hold with empty lungs
                  </p>
                  <p className="text-slate-500">
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
                  
                  <h2 className="text-6xl font-bold text-slate-800">
                    {holdTimer}s
                  </h2>
                  <p className="text-xl text-slate-600">
                    Hold deep breath
                  </p>
                  <p className="text-slate-500">
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
                  
                  <h2 className="text-4xl font-semibold text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
                    Exercise Complete!
                  </h2>
                  <p className="text-lg text-slate-600 max-w-md mx-auto">
                    Your brain is now primed for maximum learning. Your alertness and focus are heightened - perfect time to study! 🧠
                  </p>
                </div>

                <div className="bg-teal-50 p-6 rounded-xl border border-teal-200">
                  <p className="text-slate-700">
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