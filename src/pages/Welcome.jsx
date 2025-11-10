
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Although not directly used in new steps, it was part of original imports. Keep it.
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Coffee, TrendingUp, ArrowRight, Sparkles, Wind } from "lucide-react"; // Added Wind icon

export default function Welcome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [learningGoal, setLearningGoal] = useState('');
  const [dailyTarget, setDailyTarget] = useState(20);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const createSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (!user) return;
      return base44.entities.UserSettings.create({
        user_email: user.email,
        onboarding_completed: true,
        learning_goal: data.learning_goal,
        daily_target: data.daily_target,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      navigate(createPageUrl('Home'));
    },
  });

  const handleComplete = () => {
    createSettingsMutation.mutate({ learning_goal: learningGoal, daily_target: dailyTarget });
  };

  const steps = [
    // Step 0: Welcome
    {
      title: "Welcome to FastKanji",
      subtitle: "Your intelligent Japanese learning companion",
      content: (
        <div className="space-y-6">
          <div className="text-6xl text-center">速</div>
          <p className="text-center text-slate-600">
            FastKanji combines cutting-edge spaced repetition algorithms with science-backed learning techniques
            to help you master Japanese vocabulary faster than ever before.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-teal-600">2,000+</div>
              <p className="text-sm text-slate-500">Words</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-cyan-600">JLPT</div>
              <p className="text-sm text-slate-500">All Levels</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-amber-600">AI</div>
              <p className="text-sm text-slate-500">Powered</p>
            </div>
          </div>
          <Button
            onClick={() => setStep(step + 1)}
            size="lg"
            className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700 text-white mt-8"
          >
            Next Step
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )
    },

    // Step 1: Science-Backed Learning
    {
      title: "Science-Backed Learning",
      subtitle: "Neuroplasticity meets spaced repetition",
      content: (
        <div className="space-y-6"> {/* Changed from space-y-4 to space-y-6 for consistency with button below */}
          <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
            <h3 className="font-semibold text-teal-800 mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5" />
              FSRS-4 Algorithm
            </h3>
            <p className="text-sm text-slate-700">
              We use the same advanced algorithm as Anki to optimize your review schedule.
              Learn more efficiently by studying cards exactly when you're about to forget them.
            </p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Wind className="w-5 h-5" />
              Focus Exercise
            </h3>
            <p className="text-sm text-slate-700">
              Before studying, try our 2-minute neuroplasticity-activating breathing exercise.
              Research shows it can increase retention by up to 10x by priming your brain for learning.
            </p>
          </div>
          <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
            <h3 className="font-semibold text-cyan-800 mb-2 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Random Rest Intervals
            </h3>
            <p className="text-sm text-slate-700">
              Unpredictable breaks during study sessions trigger heightened alertness and attention,
              activating neural pathways more effectively than scheduled breaks.
            </p>
          </div>
          <Button
            onClick={() => setStep(step + 1)}
            size="lg"
            className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700 text-white mt-8"
          >
            Next Step
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )
    },

    // Step 2: Try the Focus Exercise
    {
      title: "Try the Focus Exercise",
      subtitle: "Prime your brain for optimal learning",
      content: (
        <div className="space-y-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-teal-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-lg">
              <Wind className="w-10 h-10 text-white" />
            </div>
            <p className="text-slate-600">
              This quick 2-minute exercise activates neuroplasticity through controlled breathing and focus training.
              Let's try it now!
            </p>
          </div>
          <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200">
            <h3 className="font-semibold text-slate-800 mb-3">What you'll do:</h3>
            <ol className="space-y-2 text-sm text-slate-700">
              <li className="flex gap-2">
                <span className="font-semibold text-teal-600">1.</span>
                <span>20 deep breaths (guided automatically)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-teal-600">2.</span>
                <span>Hold breath with empty lungs</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-teal-600">3.</span>
                <span>Deep breath hold for 15 seconds</span>
              </li>
              <li className="flex gap-2">
                <span className="font-semibold text-teal-600">4.</span>
                <span>30-second focus dot exercise</span>
              </li>
            </ol>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('Focus'))}
            size="lg"
            className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Wind className="w-5 h-5 mr-2" />
            Start Focus Exercise
          </Button>
          {/* Add a 'Skip' or 'Continue' button to allow progression without navigating away, if desired for linear flow */}
          <Button
            onClick={() => setStep(step + 1)}
            variant="ghost"
            size="lg"
            className="w-full mt-4 text-teal-600 hover:text-teal-700"
          >
            Skip for now & Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )
    },

    // Step 3: Set Your Goals
    {
      title: "Set Your Goals",
      subtitle: "Personalize your learning experience",
      content: (
        <div className="space-y-6">
          <div>
            <Label htmlFor="learningGoal" className="text-base font-semibold mb-3 block">What's your learning goal?</Label>
            <Input
              id="learningGoal"
              placeholder="e.g., Pass JLPT N3, Travel to Japan, Read manga..."
              value={learningGoal}
              onChange={(e) => setLearningGoal(e.target.value)}
              className="text-base"
            />
          </div>
          <div>
            <Label className="text-base font-semibold mb-3 block">Daily target (cards)</Label>
            <div className="grid grid-cols-4 gap-2">
              {[10, 20, 30, 50].map((target) => (
                <Button
                  key={target}
                  type="button"
                  variant={dailyTarget === target ? "default" : "outline"}
                  onClick={() => setDailyTarget(target)}
                  className={dailyTarget === target ? "bg-teal-600 hover:bg-teal-700 text-white" : "border-slate-300 hover:bg-slate-50"}
                >
                  {target}
                </Button>
              ))}
            </div>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-slate-700">
              <strong>Tip:</strong> Start with a manageable goal. Consistency matters more than quantity.
              You can always adjust this later in settings!
            </p>
          </div>
          <Button
            onClick={handleComplete}
            size="lg"
            disabled={createSettingsMutation.isPending}
            className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700 text-white mt-8"
          >
            {createSettingsMutation.isPending ? (
              'Setting up...'
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Start Learning
              </>
            )}
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-none shadow-2xl">
          <CardContent className="p-8 md:p-12">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Progress */}
                <div className="flex gap-2 mb-8">
                  {steps.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2 flex-1 rounded-full transition-colors ${
                        index <= step ? 'bg-teal-600' : 'bg-stone-200'
                      }`}
                    />
                  ))}
                </div>

                {/* Content */}
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl md:text-4xl font-semibold text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
                    {steps[step].title}
                  </h1>
                  <p className="text-slate-600">{steps[step].subtitle}</p>
                </div>

                {steps[step].content}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
