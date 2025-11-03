import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Wind, Play, Pause, RotateCcw, Brain, Zap } from "lucide-react";

export default function Focus() {
  const [phase, setPhase] = useState('ready'); // ready, breathing, hold_empty, inhale_hold, complete
  const [breathCount, setBreathCount] = useState(0);
  const [holdTime, setHoldTime] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    let interval = null;

    if (isActive && phase === 'hold_empty') {
      interval = setInterval(() => {
        setHoldTime(prev => prev + 1);
      }, 1000);
    } else if (isActive && phase === 'inhale_hold') {
      interval = setInterval(() => {
        setHoldTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, phase]);

  const startExercise = () => {
    setPhase('breathing');
    setBreathCount(0);
    setIsActive(true);
  };

  const handleBreath = () => {
    const newCount = breathCount + 1;
    setBreathCount(newCount);
    
    if (newCount >= 25) {
      setPhase('hold_empty');
      setHoldTime(0);
    }
  };

  const finishEmptyHold = () => {
    setPhase('inhale_hold');
    setHoldTime(0);
  };

  const finishInhaleHold = () => {
    setPhase('complete');
    setIsActive(false);
  };

  const reset = () => {
    setPhase('ready');
    setBreathCount(0);
    setHoldTime(0);
    setIsActive(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-4">
      <div className="max-w-3xl w-full space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="flex items-center justify-center gap-3">
            <Brain className="w-10 h-10 text-purple-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Focus Exercise
            </h1>
          </div>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Activate neuroplasticity and prime your brain for optimal learning
          </p>
        </motion.div>

        {/* Instructions Card */}
        {phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-white/10 backdrop-blur-md border-white/20 text-white">
              <CardContent className="p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold">Why This Works</h3>
                    <p className="text-white/80 leading-relaxed">
                      To trigger neuroplasticity, your brain needs to be alert. This breathing exercise 
                      releases epinephrine (adrenaline) in your brain and body, creating the optimal 
                      state for learning and memory formation.
                    </p>
                  </div>
                </div>

                <div className="space-y-4 pl-16">
                  <div className="space-y-2">
                    <p className="font-semibold text-lg">The Protocol:</p>
                    <ol className="list-decimal list-inside space-y-2 text-white/80">
                      <li><strong>25-30 Deep Breaths:</strong> Inhale through nose, exhale through mouth</li>
                      <li><strong>Hold Empty:</strong> Exhale fully and hold with empty lungs for 15-60 seconds</li>
                      <li><strong>Inhale & Hold:</strong> Take one deep breath and hold briefly</li>
                      <li><strong>Resume Normal Breathing:</strong> Don't force it - breathe when you feel the urge</li>
                    </ol>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg">
                    <p className="text-sm text-yellow-200">
                      <strong>Important:</strong> Never force the breath holds. This should feel energizing, not stressful.
                      Stop immediately if you feel dizzy or uncomfortable.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={startExercise}
                  size="lg"
                  className="w-full h-14 text-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Exercise
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Breathing Phase */}
        {phase === 'breathing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center shadow-2xl"
            >
              <Wind className="w-24 h-24 text-white" />
            </motion.div>

            <div className="space-y-4">
              <p className="text-white/70 text-lg">Breath Count</p>
              <p className="text-7xl font-bold text-white">{breathCount}</p>
              <p className="text-white/60">/ 25-30 breaths</p>
            </div>

            <div className="space-y-3">
              <p className="text-white text-lg">
                <strong>Inhale</strong> through nose • <strong>Exhale</strong> through mouth
              </p>
              <Button
                onClick={handleBreath}
                size="lg"
                className="w-64 h-16 text-xl bg-white text-indigo-900 hover:bg-white/90"
              >
                Breath {breathCount + 1}
              </Button>
            </div>
          </motion.div>
        )}

        {/* Hold Empty Phase */}
        {phase === 'hold_empty' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <div className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shadow-2xl">
              <p className="text-6xl font-bold text-white">{holdTime}s</p>
            </div>

            <div className="space-y-4">
              <p className="text-2xl font-bold text-white">Hold with Empty Lungs</p>
              <p className="text-white/70 text-lg">15-60 seconds • Don't force it</p>
            </div>

            <Button
              onClick={finishEmptyHold}
              size="lg"
              className="w-64 h-14 bg-white text-indigo-900 hover:bg-white/90"
            >
              Ready to Inhale
            </Button>
          </motion.div>
        )}

        {/* Inhale Hold Phase */}
        {phase === 'inhale_hold' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.05, 1],
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
              }}
              className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-400 flex items-center justify-center shadow-2xl"
            >
              <p className="text-6xl font-bold text-white">{holdTime}s</p>
            </motion.div>

            <div className="space-y-4">
              <p className="text-2xl font-bold text-white">Hold After Inhale</p>
              <p className="text-white/70 text-lg">Hold for 10-15 seconds</p>
            </div>

            <Button
              onClick={finishInhaleHold}
              size="lg"
              className="w-64 h-14 bg-white text-indigo-900 hover:bg-white/90"
            >
              Finish Exercise
            </Button>
          </motion.div>
        )}

        {/* Complete Phase */}
        {phase === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8"
          >
            <div className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 flex items-center justify-center shadow-2xl">
              <Brain className="w-24 h-24 text-white" />
            </div>

            <div className="space-y-4">
              <p className="text-3xl font-bold text-white">Exercise Complete! 🎉</p>
              <p className="text-white/70 text-lg">
                Your brain is now primed for optimal learning and focus
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={reset}
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                <RotateCcw className="w-5 h-5 mr-2" />
                Do Again
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                size="lg"
                className="bg-white text-indigo-900 hover:bg-white/90"
              >
                Start Studying
              </Button>
            </div>
          </motion.div>
        )}

        {/* Reset Button */}
        {phase !== 'ready' && phase !== 'complete' && (
          <div className="flex justify-center">
            <Button
              onClick={reset}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}