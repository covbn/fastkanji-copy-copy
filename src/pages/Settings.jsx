import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings as SettingsIcon, Moon, Sun, Clock, Save } from "lucide-react";
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
    rest_min_minutes: 1.5,
    rest_max_minutes: 2.5,
    rest_duration_minutes: 10,
    show_example_sentences: true,
    daily_target: 20,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        night_mode: settings.night_mode || false,
        rest_min_minutes: settings.rest_min_minutes || 1.5,
        rest_max_minutes: settings.rest_max_minutes || 2.5,
        rest_duration_minutes: settings.rest_duration_minutes || 10,
        show_example_sentences: settings.show_example_sentences !== false,
        daily_target: settings.daily_target || 20,
      });
    }
  }, [settings]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (!user) return;
      
      if (settings) {
        return base44.entities.UserSettings.update(settings.id, data);
      } else {
        return base44.entities.UserSettings.create({
          ...data,
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-slate-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Settings
            </h1>
          </div>
          <p className="text-slate-600">Customize your learning experience</p>
        </motion.div>

        {/* Appearance */}
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              {formData.night_mode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Appearance
            </CardTitle>
            <CardDescription>Adjust visual preferences</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Night Mode</Label>
                <p className="text-sm text-slate-500">Enable dark theme for studying</p>
              </div>
              <Switch
                checked={formData.night_mode}
                onCheckedChange={(checked) => setFormData({ ...formData, night_mode: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium">Show Example Sentences</Label>
                <p className="text-sm text-slate-500">Display context sentences on flashcards</p>
              </div>
              <Switch
                checked={formData.show_example_sentences}
                onCheckedChange={(checked) => setFormData({ ...formData, show_example_sentences: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Rest Intervals */}
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Random Rest Intervals
            </CardTitle>
            <CardDescription>
              Science-backed random breaks activate neuroplasticity 10x more effectively
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Min Interval (minutes)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formData.rest_min_minutes}
                  onChange={(e) => setFormData({ ...formData, rest_min_minutes: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-slate-500">Minimum time before rest</p>
              </div>

              <div className="space-y-2">
                <Label>Max Interval (minutes)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formData.rest_max_minutes}
                  onChange={(e) => setFormData({ ...formData, rest_max_minutes: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-slate-500">Maximum time before rest</p>
              </div>

              <div className="space-y-2">
                <Label>Rest Duration (minutes)</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={formData.rest_duration_minutes}
                  onChange={(e) => setFormData({ ...formData, rest_duration_minutes: parseInt(e.target.value) })}
                />
                <p className="text-xs text-slate-500">How long to rest</p>
              </div>
            </div>

            <div className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-slate-600">
                <strong>Why random?</strong> Research shows that unpredictable rest intervals trigger heightened alertness 
                and attention, activating neural pathways 10x more effectively than scheduled breaks.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Learning Goals */}
        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Learning Goals</CardTitle>
            <CardDescription>Set your daily targets</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>Daily Target (cards)</Label>
              <Input
                type="number"
                min="5"
                step="5"
                value={formData.daily_target}
                onChange={(e) => setFormData({ ...formData, daily_target: parseInt(e.target.value) })}
              />
              <p className="text-xs text-slate-500">How many cards you want to study daily</p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            size="lg"
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
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
            className="text-center text-green-600 font-medium"
          >
            Settings saved successfully!
          </motion.div>
        )}
      </div>
    </div>
  );
}