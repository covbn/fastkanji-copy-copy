
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Coffee, TrendingUp, ArrowRight, Sparkles } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState({
    learning_goal: '',
    daily_target: 20,
  });

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
    createSettingsMutation.mutate(formData);
  };

  const steps = [
    // Step 0: Welcome
    {
      title: "Welcome to FastKanji",
      subtitle: "速く学ぶ • Learn Fast",
      content: (
        <div className="space-y-6">
          <p className="text-lg text-slate-700 leading-relaxed">
            FastKanji combines cutting-edge neuroscience with traditional Japanese learning 
            to create the most effective vocabulary study system.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-indigo-50 rounded-xl">
              <Zap className="w-8 h-8 text-indigo-600 mb-2" />
              <h3 className="font-bold mb-1">Lightning Fast</h3>
              <p className="text-sm text-slate-600">Study efficiently with optimized flashcards</p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-xl">
              <Brain className="w-8 h-8 text-purple-600 mb-2" />
              <h3 className="font-bold mb-1">Science-Backed</h3>
              <p className="text-sm text-slate-600">Anki-style SRS for long-term retention</p>
            </div>
          </div>

          <Button
            onClick={() => setStep(1)}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            Get Started
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )
    },
    
    // Step 1: Random Rest Science
    {
      title: "The Power of Random Rest",
      subtitle: "Activate 10x More Neural Pathways",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-orange-50 to-red-50 p-6 rounded-xl">
            <Coffee className="w-10 h-10 text-orange-600 mb-3" />
            <p className="text-slate-700 leading-relaxed mb-4">
              Research shows that <strong>unpredictable rest intervals</strong> trigger heightened 
              alertness and attention, activating neural pathways 10x more effectively than 
              scheduled breaks.
            </p>
            <p className="text-sm text-slate-600">
              Your brain stays alert when it doesn't know when the next break is coming, 
              creating optimal conditions for learning and memory formation.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                1
              </div>
              <p className="text-slate-700">Random intervals between 1.5-2.5 minutes</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                2
              </div>
              <p className="text-slate-700">10-second rest breaks to consolidate learning</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                3
              </div>
              <p className="text-slate-700">Your brain stays primed and focused</p>
            </div>
          </div>

          <Button
            onClick={() => setStep(2)}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )
    },

    // Step 2: Focus Exercise
    {
      title: "Prime Your Brain for Learning",
      subtitle: "The Focus Exercise",
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-xl">
            <Brain className="w-10 h-10 text-purple-600 mb-3" />
            <p className="text-slate-700 leading-relaxed mb-4">
              To trigger <strong>neuroplasticity</strong> (the brain's ability to form new connections), 
              you must be alert. Our breathing exercise releases epinephrine (adrenaline), 
              creating the optimal state for learning.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900">The Protocol:</h4>
            <ol className="space-y-2 text-slate-700">
              <li>1. Take 25-30 deep breaths (nose in, mouth out)</li>
              <li>2. Hold your breath with empty lungs for 15-60 seconds</li>
              <li>3. Inhale once and hold briefly</li>
              <li>4. Resume normal breathing</li>
            </ol>
          </div>

          <p className="text-sm text-slate-600 bg-yellow-50 p-3 rounded-lg">
            💡 Do this before each study session to maximize retention and focus!
          </p>

          <Button
            onClick={() => setStep(3)}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600"
          >
            Continue
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      )
    },

    // Step 3: Goals
    {
      title: "Set Your Learning Goals",
      subtitle: "Customize Your Journey",
      content: (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="goal" className="text-base font-medium">
                What's your learning goal?
              </Label>
              <Textarea
                id="goal"
                placeholder="E.g., Pass JLPT N3, read manga without subtitles, travel to Japan..."
                value={formData.learning_goal}
                onChange={(e) => setFormData({ ...formData, learning_goal: e.target.value })}
                className="h-24 resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target" className="text-base font-medium">
                Daily study target (cards)
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {[20, 50, 100, 150].map((target) => (
                  <Button
                    key={target}
                    type="button"
                    variant={formData.daily_target === target ? "default" : "outline"}
                    onClick={() => setFormData({ ...formData, daily_target: target })}
                    className={formData.daily_target === target ? "bg-indigo-600" : ""}
                  >
                    {target}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-slate-500">Choose how many cards you want to study daily</p>
            </div>
          </div>

          <Button
            onClick={handleComplete}
            size="lg"
            disabled={createSettingsMutation.isPending}
            className="w-full h-14 text-lg bg-gradient-to-r from-indigo-600 to-purple-600"
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
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-4">
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
                        index <= step ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                {/* Content */}
                <div className="text-center space-y-2 mb-8">
                  <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
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
