import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, Check, Zap, Lock, Unlock, Clock, Brain, TrendingUp, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";

export default function Subscription() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subscription } = useQuery({
    queryKey: ['userSubscription', user?.email],
    queryFn: async () => {
      if (!user) return null;
      const existing = await base44.entities.UserSubscription.filter({ user_email: user.email });
      return existing.length > 0 ? existing[0] : null;
    },
    enabled: !!user,
  });

  const isPremium = subscription?.subscription_status === 'premium';

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      // Check if running in iframe (preview mode)
      if (window.self !== window.top) {
        throw new Error('IFRAME_BLOCKED');
      }

      // Create Stripe checkout session
      const response = await base44.functions.invoke('createCheckoutSession', {
        priceId: 'price_1Sw5soEgEO1hy3ItM5zgSb8D'
      });

      if (!response.data.url) {
        throw new Error('Failed to create checkout session');
      }

      return response.data;
    },
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      window.location.href = data.url;
    },
    onError: (error) => {
      if (error.message === 'IFRAME_BLOCKED') {
        toast({
          title: "Please Open Published App",
          description: "Checkout only works in the published app, not in the preview. Click 'Publish' to open your live app.",
          variant: "destructive",
          duration: 5000,
        });
      } else {
        toast({
          title: "Checkout Error",
          description: error.message || "Failed to start checkout. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  // Check for successful checkout
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // Refetch subscription immediately
      queryClient.invalidateQueries({ queryKey: ['userSubscription'] });
      
      toast({
        title: "🎉 Welcome to Premium!",
        description: "Your subscription is now active. Enjoy unlimited access!",
        duration: 5000,
      });
      
      // Clean up URL
      window.history.replaceState({}, '', createPageUrl('Subscription'));
      
      console.log(`[PREMIUM][UI] loaded isPremium=${subscription?.subscription_status === 'premium'} source=db`);
    }
  }, [queryClient, toast, subscription]);

  const freeFeatures = [
    { name: "N5 Vocabulary Access", included: true },
    { name: "7.5 Minutes Daily Study", included: true },
    { name: "Basic Flash Study Mode", included: true },
    { name: "Spaced Repetition (Limited)", included: true },
    { name: "Focus Exercise", included: true },
  ];

  const premiumFeatures = [
    { name: "All JLPT Levels (N5-N1)", icon: Unlock, color: "text-teal-600" },
    { name: "Unlimited Study Time", icon: Clock, color: "text-cyan-600" },
    { name: "Custom Rest Intervals", icon: SettingsIcon, color: "text-amber-600" },
    { name: "Advanced Analytics", icon: TrendingUp, color: "text-emerald-600" },
    { name: "Priority Support", icon: Zap, color: "text-indigo-600" },
    { name: "All Features Unlocked", icon: Brain, color: "text-rose-600" },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8 bg-background">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Crown className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-foreground" style={{fontFamily: "'Crimson Pro', serif"}}>
            Upgrade to Premium
          </h1>
          <p className="text-lg max-w-2xl mx-auto text-muted-foreground">
            Unlock unlimited learning potential and master Japanese faster
          </p>
        </motion.div>

        {/* Current Status */}
        {isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
              <CardContent className="p-6 text-center">
                <Crown className="w-12 h-12 mx-auto mb-3 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xl font-semibold text-foreground mb-2">You're a Premium Member! 🎉</h3>
                <p className="text-muted-foreground">
                  Enjoying unlimited access to all features. Keep up the great work!
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Pricing Comparison */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-full">
              <CardHeader className="border-b border-border">
                <Badge variant="outline" className="w-fit mb-2">Free</Badge>
                <CardTitle className="text-3xl font-bold text-foreground">
                  $0
                  <span className="text-base font-normal text-muted-foreground"> / forever</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-4">
                  {freeFeatures.map((feature, idx) => (
                    <motion.li
                      key={feature.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + idx * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <Check className={`w-5 h-5 flex-shrink-0 ${feature.included ? 'text-teal-600' : 'text-muted-foreground'}`} />
                      <span className="text-foreground">{feature.name}</span>
                    </motion.li>
                  ))}
                </ul>
                {isPremium && (
                  <div className="mt-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      To manage your subscription, visit your Stripe customer portal or contact support.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Premium Plan */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-2 border-amber-400 dark:border-amber-600 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 shadow-xl relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 bg-gradient-to-br from-amber-500 to-orange-500 text-white px-4 py-1 text-sm font-semibold transform rotate-12 translate-x-8 translate-y-4">
                BEST VALUE
              </div>
              <CardHeader className="border-b border-amber-200 dark:border-amber-800">
                <Badge className="w-fit mb-2 bg-amber-500 text-white">Premium</Badge>
                <CardTitle className="text-3xl font-bold text-foreground">
                  $9.99
                  <span className="text-base font-normal text-muted-foreground"> / month</span>
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-2">Limited time: First month free! 🎁</p>
              </CardHeader>
              <CardContent className="p-6">
                <ul className="space-y-4">
                  {premiumFeatures.map((feature, idx) => (
                    <motion.li
                      key={feature.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + idx * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm">
                        <feature.icon className={`w-4 h-4 ${feature.color}`} />
                      </div>
                      <span className="text-foreground font-medium">{feature.name}</span>
                    </motion.li>
                  ))}
                </ul>
                {!isPremium && (
                  <Button
                    onClick={() => upgradeMutation.mutate()}
                    size="lg"
                    className="w-full mt-6 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-lg"
                    disabled={upgradeMutation.isPending}
                  >
                    <Crown className="w-5 h-5 mr-2" />
                    {upgradeMutation.isPending ? 'Redirecting to Checkout...' : 'Subscribe Now - $9.99/month'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Why Premium Section */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-card-foreground">Why Go Premium?</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500 flex items-center justify-center">
                  <Unlock className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Full Access</h3>
                <p className="text-sm text-muted-foreground">
                  Study all JLPT levels from beginner to expert without restrictions
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">No Limits</h3>
                <p className="text-sm text-muted-foreground">
                  Study as long as you want, whenever you want, with no daily restrictions
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-lg text-foreground">Learn Faster</h3>
                <p className="text-sm text-muted-foreground">
                  Customize rest intervals and leverage advanced features to optimize learning
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
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
  );
}