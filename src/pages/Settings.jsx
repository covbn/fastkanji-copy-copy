import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge"; // Added Badge import
import { Settings as SettingsIcon, Moon, Sun, Clock, Save, Brain, Bug, Trash2, CheckCircle2, XCircle, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { loadRemainingTime, saveRemainingTime } from "@/components/utils/timerPersistence";
import { confirmDialog } from "@/components/utils/ConfirmDialog";
import MobileHeader from "@/components/mobile/MobileHeader";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Settings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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

  const [formData, setFormData] = useState(() => {
    // Load night mode from localStorage immediately
    const savedTheme = localStorage.getItem('theme');
    return {
      night_mode: savedTheme === 'dark',
      rest_min_seconds: 90,
      rest_max_seconds: 150,
      rest_duration_seconds: 10,
      show_example_sentences: true,
      max_new_cards_per_day: 20,
      max_reviews_per_day: 200,
      debug_mode: false,
      debug_focus_breaths: 20,
    };
  });

  const [debugStats, setDebugStats] = useState(null);

  useEffect(() => {
    if (settings) {
      const savedTheme = localStorage.getItem('theme');
      setFormData({
        night_mode: savedTheme ? savedTheme === 'dark' : (settings.night_mode || false),
        rest_min_seconds: settings.rest_min_seconds || 90,
        rest_max_seconds: settings.rest_max_seconds || 150,
        rest_duration_seconds: settings.rest_duration_seconds || 10,
        show_example_sentences: settings.show_example_sentences !== false,
        max_new_cards_per_day: settings.max_new_cards_per_day || 20,
        max_reviews_per_day: settings.max_reviews_per_day || 200,
        debug_mode: settings.debug_mode || false,
        debug_focus_breaths: settings.debug_focus_breaths || 20,
      });
    }
  }, [settings]);

  // Apply night mode globally + persist to localStorage
  useEffect(() => {
    if (formData.night_mode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    
    // Diagnostic log on toggle
    console.log(`[THEME] nightMode=${formData.night_mode} darkClassApplied=${document.documentElement.classList.contains('dark')} root=${document.documentElement.className}`);
  }, [formData.night_mode]);

  const { data: userProgress = [], refetch: refetchProgress } = useQuery({
    queryKey: ['userProgress', user?.email],
    queryFn: async () => {
      if (!user) return [];
      return base44.entities.UserProgress.filter({ user_email: user.email });
    },
    enabled: !!user, // Always enabled so data is ready
  });

  useEffect(() => {
    if (formData.debug_mode && userProgress.length >= 0) {
      const today = new Date().setHours(0, 0, 0, 0);
      const todaysProgress = userProgress.filter(p => {
        if (!p.last_reviewed) return false;
        const reviewDate = new Date(p.last_reviewed).setHours(0, 0, 0, 0);
        return reviewDate === today;
      });

      const stats = {
        totalProgress: userProgress.length,
        newState: userProgress.filter(p => p.state === "New").length,
        learningState: userProgress.filter(p => p.state === "Learning").length,
        reviewState: userProgress.filter(p => p.state === "Review").length,
        relearningState: userProgress.filter(p => p.state === "Relearning").length,
        newToday: todaysProgress.filter(p => p.reps === 1).length,
        reviewsToday: todaysProgress.filter(p => p.state === "Review" && p.reps > 1).length,
        dailyUsage: settings?.daily_usage_seconds || 0,
        lastUsageDate: settings?.last_usage_date || 'N/A',
      };
      setDebugStats(stats);
    }
  }, [formData.debug_mode, userProgress, settings]);

  const nightMode = settings?.night_mode || false;
  const isPremium = settings?.subscription_status === 'premium' || localStorage.getItem('premium_status') === 'premium';

  const saveSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const hasExisting = !!settings?.id;
      console.warn('[SETTINGS] save start hasExisting=', hasExisting, 'userId=', user?.email);
      
      if (!user?.email) {
        throw new Error('User not authenticated');
      }
      
      const dataToSave = {
        ...data,
        rest_min_seconds: parseInt(data.rest_min_seconds),
        rest_max_seconds: parseInt(data.rest_max_seconds),
        rest_duration_seconds: parseInt(data.rest_duration_seconds),
        max_new_cards_per_day: parseInt(data.max_new_cards_per_day),
        max_reviews_per_day: parseInt(data.max_reviews_per_day),
      };

      // Only update if settings exist, otherwise save to localStorage
      if (settings?.id) {
        console.warn('[SETTINGS] save path = update');
        return base44.entities.UserSettings.update(settings.id, dataToSave);
      } else {
        console.warn('[SETTINGS] save path = local (no cloud record)');
        // Save to localStorage as fallback
        localStorage.setItem('userSettings', JSON.stringify(dataToSave));
        return { saved: 'local', data: dataToSave };
      }
    },
    onSuccess: (result) => {
      console.warn('[SETTINGS] save success');
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      
      if (result?.saved === 'local') {
        toast({
          title: "✅ Settings Saved Locally",
          description: "Your preferences have been saved to this device.",
          duration: 3000,
        });
      } else {
        toast({
          title: "✅ Settings Saved",
          description: "Your preferences have been updated successfully.",
          duration: 3000,
        });
      }
    },
    onError: (error) => {
      console.warn('[SETTINGS] save error', error.message);
      // Even on error, save to localStorage
      try {
        const dataToSave = {
          ...formData,
          rest_min_seconds: parseInt(formData.rest_min_seconds),
          rest_max_seconds: parseInt(formData.rest_max_seconds),
          rest_duration_seconds: parseInt(formData.rest_duration_seconds),
          max_new_cards_per_day: parseInt(formData.max_new_cards_per_day),
          max_reviews_per_day: parseInt(formData.max_reviews_per_day),
        };
        localStorage.setItem('userSettings', JSON.stringify(dataToSave));
        toast({
          title: "✅ Saved Locally",
          description: "Cloud save unavailable, saved to this device instead.",
          duration: 3000,
        });
      } catch (localError) {
        toast({
          variant: "destructive",
          title: "❌ Save Failed",
          description: error.message || "Failed to save settings.",
          duration: 5000,
        });
      }
    },
  });

  const handleSave = (e) => {
    e?.preventDefault();
    saveSettingsMutation.mutate(formData);
  };

  const resetProgressMutation = useMutation({
    mutationFn: async () => {
      console.log('[DEBUG] 🗑️ Starting reset operation...');
      
      if (!user) {
        throw new Error('No user found');
      }
      
      try {
        // Step 1: Fetch all user progress
        console.log('[DEBUG] 📥 Fetching all user progress...');
        const allProgress = await base44.entities.UserProgress.filter({ user_email: user.email });
        console.log('[DEBUG] 📋 Found', allProgress.length, 'progress records');
        
        // Step 2: Delete all progress records
        if (allProgress.length > 0) {
          console.log('[DEBUG] 🔥 Deleting', allProgress.length, 'progress records...');
          const deletePromises = allProgress.map(async (p) => {
            console.log('[DEBUG]   - Deleting progress ID:', p.id);
            return base44.entities.UserProgress.delete(p.id);
          });
          await Promise.all(deletePromises);
          console.log('[DEBUG] ✅ All progress records deleted');
        } else {
          console.log('[DEBUG] ⚠️ No progress records to delete');
        }
        
        // Step 3: Clear localStorage daily limit deltas
        console.log('[DEBUG] 🧹 Clearing localStorage daily limit deltas...');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sr:newLimitDelta:')) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log('[DEBUG] ✅ Cleared', keysToRemove.length, 'localStorage delta keys');
        
        // Step 4: Reset daily limits in settings
        if (settings) {
          console.log('[DEBUG] 🔄 Resetting daily usage counters...');
          await base44.entities.UserSettings.update(settings.id, {
            daily_usage_seconds: 0,
            last_usage_date: new Date().toISOString().split('T')[0],
          });
          console.log('[DEBUG] ✅ Daily limits reset');
        } else {
          console.warn('[DEBUG] ⚠️ No settings found to reset');
        }
        
        // Step 5: Verify reset
        console.log('[DEBUG] 🔍 Verifying reset...');
        const remainingProgress = await base44.entities.UserProgress.filter({ user_email: user.email });
        console.log('[DEBUG] 📊 Remaining progress records:', remainingProgress.length);
        
        if (remainingProgress.length > 0) {
          throw new Error(`Reset failed - ${remainingProgress.length} records still exist`);
        }
        
        console.log('[DEBUG] 🎉 Reset complete and verified!');
        return { deletedCount: allProgress.length };
      } catch (error) {
        console.error('[DEBUG] ❌ Reset failed:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log('[DEBUG] 🔄 Invalidating queries and refetching...');
      
      // Invalidate all relevant queries
      await queryClient.invalidateQueries({ queryKey: ['userProgress'] });
      await queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      await queryClient.invalidateQueries({ queryKey: ['recentSessions'] });
      
      // Force refetch
      await refetchProgress();
      
      console.log('[DEBUG] 🎉 UI updated successfully - Deleted', data?.deletedCount || 0, 'progress records');
    },
    onError: (error) => {
      console.error('[DEBUG] ❌ Reset mutation error:', error);
      toast({
        variant: "destructive",
        title: "❌ Reset Failed",
        description: error.message || "Failed to reset progress. Check console for details.",
        duration: 5000,
      });
    },
  });

  const handleResetProgress = async () => {
    console.log('[DEBUG] 🖱️ Reset button clicked');
    const confirmed = await confirmDialog.show({
      title: "⚠️ Reset All Progress",
      description: "This will delete ALL card progress, reset all scheduling data, and reset daily limits. This cannot be undone. Continue?",
      confirmText: "Reset Everything",
      cancelText: "Cancel",
      destructive: true
    });
    
    if (confirmed) {
      console.log('[DEBUG] ✅ User confirmed reset');
      resetProgressMutation.mutate();
    } else {
      console.log('[DEBUG] ❌ User cancelled reset');
    }
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
    <div className="min-h-dvh bg-background">
      <MobileHeader title="Settings" />
      <div className="appPage">
        <div className="max-w-md md:max-w-4xl mx-auto appSectionGap">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <SettingsIcon className="w-8 h-8 text-teal-600" />
            <h1 className="text-4xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
              Settings
            </h1>
          </div>
          <p className="text-muted-foreground">Customize your learning experience</p>
        </motion.div>

        {/* Appearance */}
        <Card className="border border-border shadow-sm bg-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              {formData.night_mode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              Appearance
            </CardTitle>
            <CardDescription>Adjust visual preferences</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium text-foreground">Night Mode</Label>
                <p className="text-sm text-muted-foreground">Enable dark theme for studying</p>
              </div>
              <Switch
                checked={formData.night_mode}
                onCheckedChange={(checked) => setFormData({ ...formData, night_mode: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium text-foreground">Show Example Sentences</Label>
                <p className="text-sm text-muted-foreground">Display context sentences on flashcards</p>
              </div>
              <Switch
                checked={formData.show_example_sentences}
                onCheckedChange={(checked) => setFormData({ ...formData, show_example_sentences: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Spaced Repetition Settings */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-card-foreground">
              <Brain className="w-5 h-5" />
              Spaced Repetition Limits
            </CardTitle>
            <CardDescription>
              Daily limits for new cards and reviews
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Max New Cards/Day</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.max_new_cards_per_day}
                  onChange={(e) => setFormData({ ...formData, max_new_cards_per_day: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">Maximum new words to learn daily (Spaced Repetition mode)</p>
              </div>

              <div className="space-y-2">
                <Label>Max Reviews/Day</Label>
                <Input
                  type="number"
                  min="0"
                  max="1000"
                  value={formData.max_reviews_per_day}
                  onChange={(e) => setFormData({ ...formData, max_reviews_per_day: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">Maximum reviews per day (Spaced Repetition mode)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rest Intervals */}
        <Card className={!isPremium ? 'opacity-50' : ''}>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Random Rest Intervals
              {!isPremium && (
                <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300 ml-2">
                  Premium Only
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Science-backed random breaks activate neuroplasticity 10x more effectively
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Min Interval (seconds)</Label>
                <Input
                  type="number"
                  step="10"
                  min="30"
                  value={formData.rest_min_seconds}
                  onChange={(e) => setFormData({ ...formData, rest_min_seconds: parseInt(e.target.value) })}
                  disabled={!isPremium}
                />
                <p className="text-xs text-muted-foreground">Minimum time before rest</p>
              </div>

              <div className="space-y-2">
                <Label>Max Interval (seconds)</Label>
                <Input
                  type="number"
                  step="10"
                  min="30"
                  value={formData.rest_max_seconds}
                  onChange={(e) => setFormData({ ...formData, rest_max_seconds: parseInt(e.target.value) })}
                  disabled={!isPremium}
                />
                <p className="text-xs text-muted-foreground">Maximum time before rest</p>
              </div>

              <div className="space-y-2">
                <Label>Rest Duration (seconds)</Label>
                <Input
                  type="number"
                  step="30"
                  min="60"
                  value={formData.rest_duration_seconds}
                  onChange={(e) => setFormData({ ...formData, rest_duration_seconds: parseInt(e.target.value) })}
                  disabled={!isPremium}
                />
                <p className="text-xs text-muted-foreground">How long to rest</p>
              </div>
            </div>

            {!isPremium && (
              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-foreground">
                  <strong>Upgrade to Premium</strong> to customize your rest interval settings and maximize your learning efficiency!
                </p>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg border border-border">
              <p className="text-sm text-foreground">
                <strong>Why random?</strong> Research shows that unpredictable rest intervals trigger heightened alertness 
                and attention, activating neural pathways 10x more effectively than scheduled breaks.
              </p>
            </div>
          </CardContent>
        </Card>



        {/* Debug Tools */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5" />
              Debug Tools
            </CardTitle>
            <CardDescription>
              Developer tools for testing
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label className="text-base font-medium text-foreground">Debug Mode</Label>
                <p className="text-sm text-muted-foreground">Show detailed stats and reset tools</p>
              </div>
              <Switch
                checked={formData.debug_mode}
                onCheckedChange={(checked) => setFormData({ ...formData, debug_mode: checked })}
              />
            </div>

            {formData.debug_mode && (
              <>
                {/* Focus Exercise Debug */}
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <h4 className="font-semibold mb-2 text-foreground">Focus Exercise</h4>
                  <div className="space-y-2">
                    <Label className="text-sm">Number of Breaths (for testing)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="50"
                      value={formData.debug_focus_breaths || 20}
                      onChange={(e) => setFormData({ ...formData, debug_focus_breaths: parseInt(e.target.value) || 20 })}
                      className="w-32"
                    />
                    <p className="text-xs text-muted-foreground">
                      Set a lower number to quickly test the focus exercise flow
                    </p>
                  </div>
                </div>

                {/* Remove Premium Button */}
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <h4 className="font-semibold mb-2 text-foreground">Premium Status</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Current: <strong>{isPremium ? 'Premium' : 'Free'}</strong>
                  </p>
                  {isPremium && (
                    <Button
                      onClick={async () => {
                        try {
                          // Remove from cloud if settings exist
                          if (settings?.id) {
                            await base44.entities.UserSettings.update(settings.id, {
                              subscription_status: 'free'
                            });
                          }
                          
                          // Remove from localStorage
                          localStorage.removeItem('premium_status');
                          
                          // Invalidate queries
                          await queryClient.invalidateQueries({ queryKey: ['userSettings'] });
                          
                          console.log('[PREMIUM] debugRemove -> isPremium=false (source=both)');
                          
                          toast({
                            title: "Premium Removed",
                            description: "Switched back to free plan for testing.",
                            duration: 3000,
                          });
                        } catch (e) {
                          console.error('[PREMIUM] debugRemove error:', e);
                        }
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Remove Premium (Testing)
                    </Button>
                  )}
                </div>

                {/* Free Timer Controls */}
                {!isPremium && (
                  <div className="p-4 rounded-lg bg-muted border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="w-4 h-4 text-foreground" />
                      <h4 className="font-semibold text-foreground">Free Timer</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Adjust remaining time for testing
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => {
                          const userId = user?.email || 'guest';
                          const dayKey = new Date().toISOString().split('T')[0];
                          const { remainingSeconds } = loadRemainingTime(userId);
                          const newRemaining = Math.max(0, remainingSeconds - 30);
                          saveRemainingTime(userId, newRemaining, 'debug');
                          console.log(`[TIMER DEBUG] adjust delta=-30 newRemaining=${newRemaining} dayKey=${dayKey}`);
                          toast({ title: "Timer adjusted", description: `-30 seconds`, duration: 2000 });
                        }}
                        variant="outline"
                        size="sm"
                      >
                        -30s
                      </Button>
                      <Button
                        onClick={() => {
                          const userId = user?.email || 'guest';
                          const dayKey = new Date().toISOString().split('T')[0];
                          const { remainingSeconds } = loadRemainingTime(userId);
                          const newRemaining = Math.max(0, remainingSeconds - 120);
                          saveRemainingTime(userId, newRemaining, 'debug');
                          console.log(`[TIMER DEBUG] adjust delta=-120 newRemaining=${newRemaining} dayKey=${dayKey}`);
                          toast({ title: "Timer adjusted", description: `-2 minutes`, duration: 2000 });
                        }}
                        variant="outline"
                        size="sm"
                      >
                        -2m
                      </Button>
                      <Button
                        onClick={() => {
                          const userId = user?.email || 'guest';
                          const dayKey = new Date().toISOString().split('T')[0];
                          const { remainingSeconds } = loadRemainingTime(userId);
                          const newRemaining = Math.max(0, remainingSeconds - 600);
                          saveRemainingTime(userId, newRemaining, 'debug');
                          console.log(`[TIMER DEBUG] adjust delta=-600 newRemaining=${newRemaining} dayKey=${dayKey}`);
                          toast({ title: "Timer adjusted", description: `-10 minutes`, duration: 2000 });
                        }}
                        variant="outline"
                        size="sm"
                      >
                        -10m
                      </Button>
                      <Button
                        onClick={() => {
                          const userId = user?.email || 'guest';
                          const dayKey = new Date().toISOString().split('T')[0];
                          saveRemainingTime(userId, 7.5 * 60, 'debug-reset');
                          console.log(`[TIMER DEBUG] adjust delta=reset newRemaining=${7.5 * 60} dayKey=${dayKey}`);
                          toast({ title: "Timer reset", description: `Reset to 7.5 minutes`, duration: 2000 });
                        }}
                        variant="default"
                        size="sm"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}

            {formData.debug_mode && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                {debugStats && (
                  <div className="p-4 rounded-lg bg-muted border border-border">
                    <h4 className="font-semibold mb-3 text-foreground">📊 Debug Stats</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm text-foreground">
                      <div>Total Progress: <strong>{debugStats.totalProgress}</strong></div>
                      <div>New State: <strong>{debugStats.newState}</strong></div>
                      <div>Learning: <strong>{debugStats.learningState}</strong></div>
                      <div>Review: <strong>{debugStats.reviewState}</strong></div>
                      <div>Relearning: <strong>{debugStats.relearningState}</strong></div>
                      <div>New Today: <strong className="text-cyan-600">{debugStats.newToday}</strong></div>
                      <div>Reviews Today: <strong className="text-emerald-600">{debugStats.reviewsToday}</strong></div>
                      <div>Daily Usage: <strong>{debugStats.dailyUsage}s</strong></div>
                      <div className="col-span-2">Last Usage: <strong>{debugStats.lastUsageDate}</strong></div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleResetProgress}
                  variant="destructive"
                  className="w-full"
                  disabled={resetProgressMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {resetProgressMutation.isPending ? 'Resetting...' : 'Reset All Progress & Daily Limits'}
                </Button>
                
                {resetProgressMutation.isSuccess && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Reset successful! All data cleared.</span>
                  </motion.div>
                )}
                
                {resetProgressMutation.isError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                  >
                    <XCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Reset failed: {resetProgressMutation.error?.message}</span>
                  </motion.div>
                )}

                <p className="text-xs text-muted-foreground">
                  ⚠️ This will delete all card progress and reset daily new/review counts to 0. Use for testing only.
                </p>
              </motion.div>
            )}
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

        {/* Delete Account Section */}
        <Card className="border-2 border-red-200 dark:border-red-900">
          <CardHeader className="border-b border-red-200 dark:border-red-900">
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-foreground">Delete Account</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Permanently delete your account and all associated data. This action cannot be undone.
              </p>
              <Button
                onClick={async () => {
                  const confirmed = await confirmDialog.show({
                    title: "Delete Account",
                    description: "Are you absolutely sure? This will permanently delete your account, all your progress, and settings. This action cannot be undone.",
                    confirmText: "Delete Account",
                    cancelText: "Cancel"
                  });
                  
                  if (confirmed) {
                    try {
                      // Delete user's settings
                      if (settings?.id) {
                        await base44.entities.UserSettings.delete(settings.id);
                      }
                      
                      // Delete all user progress
                      const progress = await base44.entities.UserProgress.filter({ user_email: user.email });
                      for (const p of progress) {
                        await base44.entities.UserProgress.delete(p.id);
                      }
                      
                      // Delete all study sessions
                      const sessions = await base44.entities.StudySession.filter({ created_by: user.email });
                      for (const s of sessions) {
                        await base44.entities.StudySession.delete(s.id);
                      }
                      
                      // Logout
                      toast({
                        title: "Account Deleted",
                        description: "Your account has been permanently deleted.",
                        duration: 3000,
                      });
                      
                      setTimeout(() => {
                        base44.auth.logout();
                      }, 1000);
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to delete account. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }
                }}
                variant="destructive"
              >
                Delete My Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center hidden md:block">
          <Button
            onClick={() => navigate(createPageUrl('Home'))}
            variant="outline"
            size="lg"
          >
            Back to Home
          </Button>
        </div>

      </div>
      </div>
    </div>
  );
}