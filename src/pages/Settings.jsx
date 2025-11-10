
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge"; // Added Badge import
import { Settings as SettingsIcon, Moon, Sun, Clock, Save, Brain } from "lucide-react";
import { motion } from "framer-motion";

export default function Settings() {
  const queryClient = useQueryClient();
  
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['userSettings', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const existing = await base44.entities.UserSettings.filter({ user_email: user.email });
      return existing.length > 0 ? existing[0] : null;
    },
    enabled: !!user,
  });

  const [formData, setFormData] = useState({
    night_mode: false,
    rest_min_seconds: 90,
    rest_max_seconds: 150,
    rest_duration_seconds: 10,
    show_example_sentences: true,
    daily_target: 20,
    max_new_cards_per_day: 20,
    max_reviews_per_day: 200,
    desired_retention: 0.9,
    learning_steps: [1, 10], // Default for FSRS-4 learning steps
    relearning_steps: [10], // Default for FSRS-4 relearning steps
    graduating_interval: 1, // Default for FSRS-4 graduating interval
    easy_interval: 4, // Default for FSRS-4 easy interval
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        night_mode: settings.night_mode || false,
        rest_min_seconds: settings.rest_min_seconds || 90,
        rest_max_seconds: settings.rest_max_seconds || 150,
        rest_duration_seconds: settings.rest_duration_seconds || 10,
        show_example_sentences: settings.show_example_sentences !== false,
        daily_target: settings.daily_target || 20,
        max_new_cards_per_day: settings.max_new_cards_per_day || 20,
        max_reviews_per_day: settings.max_reviews_per_day || 200,
        desired_retention: settings.desired_retention || 0.9,
        learning_steps: settings.learning_steps || [1, 10],
        relearning_steps: settings.relearning_steps || [10],
        graduating_interval: settings.graduating_interval || 1,
        easy_interval: settings.easy_interval || 4,
      });
    }
  }, [settings]);

  const nightMode = settings?.night_mode || false;
  const isPremium = settings?.subscription_status === 'premium'; // Added isPremium calculation

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (!user) return;
      
      // Ensure integer values are actually integers, especially after parsing from input
      const dataToSave = {
        ...data,
        rest_min_seconds: parseInt(data.rest_min_seconds),
        rest_max_seconds: parseInt(data.rest_max_seconds),
        rest_duration_seconds: parseInt(data.rest_duration_seconds),
        daily_target: parseInt(data.daily_target),
        max_new_cards_per_day: parseInt(data.max_new_cards_per_day),
        max_reviews_per_day: parseInt(data.max_reviews_per_day),
        graduating_interval: parseInt(data.graduating_interval),
        easy_interval: parseInt(data.easy_interval),
        // desired_retention is already a float
      };

      if (settings) {
        return base44.entities.UserSettings.update(settings.id, dataToSave);
      } else {
        return base44.entities.UserSettings.create({
          ...dataToSave,
          user_email: user.email,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });

  const handleSave = () => {
    saveSettingsMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-4 md:p-8 ${nightMode ? 'bg-slate-900' : 'bg-stone-50'}`}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <SettingsIcon className="w-8 h-8 text-teal-600" />
            <h1 className="text-4xl font-semibold text-slate-800" style={{fontFamily: "'Crimson Pro', serif"}}>
              Settings
            </h1>
          </div>
          <p className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Customize your learning experience</p>
        </motion.div>

        {/* Appearance */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
            <CardTitle className={`flex items-center gap-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
              {formData.night_mode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Appearance
            </CardTitle>
            <CardDescription className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Adjust visual preferences</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className={`text-base font-medium ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>Night Mode</Label>
                <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Enable dark theme for studying</p>
              </div>
              <Switch
                checked={formData.night_mode}
                onCheckedChange={(checked) => setFormData({ ...formData, night_mode: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className={`text-base font-medium ${nightMode ? 'text-slate-200' : 'text-slate-800'}`}>Show Example Sentences</Label>
                <p className={`text-sm ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Display context sentences on flashcards</p>
              </div>
              <Switch
                checked={formData.show_example_sentences}
                onCheckedChange={(checked) => setFormData({ ...formData, show_example_sentences: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* FSRS-4 Settings */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
            <CardTitle className={`flex items-center gap-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
              <Brain className="w-5 h-5" />
              Spaced Repetition (FSRS-4)
            </CardTitle>
            <CardDescription className={nightMode ? 'text-slate-400' : 'text-slate-600'}>
              Advanced algorithm for optimal memory retention
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Max New Cards/Day</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.max_new_cards_per_day}
                  onChange={(e) => setFormData({ ...formData, max_new_cards_per_day: parseInt(e.target.value) })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Maximum new words to learn daily</p>
              </div>

              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Max Reviews/Day</Label>
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={formData.max_reviews_per_day}
                  onChange={(e) => setFormData({ ...formData, max_reviews_per_day: parseInt(e.target.value) })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Maximum reviews per day</p>
              </div>

              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Desired Retention (%)</Label>
                <Input
                  type="number"
                  min="80"
                  max="95"
                  step="1"
                  value={Math.round(formData.desired_retention * 100)}
                  onChange={(e) => setFormData({ ...formData, desired_retention: parseInt(e.target.value) / 100 })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Target recall rate (80-95%)</p>
              </div>

              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Graduating Interval (days)</Label>
                <Input
                  type="number"
                  min="1"
                  max="7"
                  value={formData.graduating_interval}
                  onChange={(e) => setFormData({ ...formData, graduating_interval: parseInt(e.target.value) })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Days after completing learning</p>
              </div>
            </div>

            <div className={`${nightMode ? 'bg-slate-700' : 'bg-teal-50'} p-4 rounded-lg border ${nightMode ? 'border-slate-600' : 'border-teal-200'}`}>
              <p className={`text-sm ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                <strong>FSRS-4</strong> is the latest algorithm used by Anki, optimizing review timing based on memory stability and difficulty. 
                Higher retention means more reviews but better memory.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Rest Intervals */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'} ${!isPremium ? 'opacity-50' : ''}`}>
          <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
            <CardTitle className={`flex items-center gap-2 ${nightMode ? 'text-slate-100' : 'text-slate-800'}`}>
              <Clock className="w-5 h-5" />
              Random Rest Intervals
              {!isPremium && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 ml-2">
                  Premium Only
                </Badge>
              )}
            </CardTitle>
            <CardDescription className={nightMode ? 'text-slate-400' : 'text-slate-600'}>
              Science-backed random breaks activate neuroplasticity 10x more effectively
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Min Interval (seconds)</Label>
                <Input
                  type="number"
                  step="10"
                  min="30"
                  value={formData.rest_min_seconds}
                  onChange={(e) => setFormData({ ...formData, rest_min_seconds: parseInt(e.target.value) })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                  disabled={!isPremium}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Minimum time before rest</p>
              </div>

              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Max Interval (seconds)</Label>
                <Input
                  type="number"
                  step="10"
                  min="30"
                  value={formData.rest_max_seconds}
                  onChange={(e) => setFormData({ ...formData, rest_max_seconds: parseInt(e.target.value) })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                  disabled={!isPremium}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>Maximum time before rest</p>
              </div>

              <div className="space-y-2">
                <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Rest Duration (seconds)</Label>
                <Input
                  type="number"
                  step="30"
                  min="60"
                  value={formData.rest_duration_seconds}
                  onChange={(e) => setFormData({ ...formData, rest_duration_seconds: parseInt(e.target.value) })}
                  className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
                  disabled={!isPremium}
                />
                <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>How long to rest</p>
              </div>
            </div>

            {!isPremium && (
              <div className={`${nightMode ? 'bg-slate-700' : 'bg-amber-50'} p-4 rounded-lg border ${nightMode ? 'border-slate-600' : 'border-amber-200'}`}>
                <p className={`text-sm ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                  <strong>Upgrade to Premium</strong> to customize your rest interval settings and maximize your learning efficiency!
                </p>
              </div>
            )}

            <div className={`${nightMode ? 'bg-slate-700' : 'bg-teal-50'} p-4 rounded-lg border ${nightMode ? 'border-slate-600' : 'border-teal-200'}`}>
              <p className={`text-sm ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
                <strong>Why random?</strong> Research shows that unpredictable rest intervals trigger heightened alertness 
                and attention, activating neural pathways 10x more effectively than scheduled breaks.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Learning Goals */}
        <Card className={`border shadow-sm ${nightMode ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
          <CardHeader className={`border-b ${nightMode ? 'border-slate-700' : 'border-stone-200'}`}>
            <CardTitle className={nightMode ? 'text-slate-100' : 'text-slate-800'}>Learning Goals</CardTitle>
            <CardDescription className={nightMode ? 'text-slate-400' : 'text-slate-600'}>Set your daily targets</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className={nightMode ? 'text-slate-200' : 'text-slate-800'}>Daily Target (cards)</Label>
              <Input
                type="number"
                min="5"
                step="5"
                value={formData.daily_target}
                onChange={(e) => setFormData({ ...formData, daily_target: parseInt(e.target.value) })}
                className={nightMode ? 'bg-slate-700 border-slate-600 text-slate-100' : ''}
              />
              <p className={`text-xs ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}>How many cards you want to study daily (for flash mode)</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            size="lg"
            className="bg-teal-600 hover:bg-teal-700 text-white"
            disabled={saveSettingsMutation.isPending}
          >
            <Save className="w-5 h-5 mr-2" />
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {saveSettingsMutation.isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center text-emerald-600 font-medium"
          >
            Settings saved successfully!
          </motion.div>
        )}
      </div>
    </div>
  );
}
