import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useSubscription(user) {
  // DON'T normalize - use exact email to match what's stored and RLS rules
  const email = user?.email;
  
  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', email],
    queryFn: async () => {
      if (!email) return null;
      
      console.log("[SUB_FETCH] start", { email });
      
      // RLS now filters by user reference automatically
      // Just list all subscriptions - RLS will return only the current user's
      const existing = await base44.entities.UserSubscription.list('-updated_date', 1);
      
      const sub = existing.length > 0 ? existing[0] : null;
      
      // Diagnostic logs
      console.log("[SUB_FETCH] result", { 
        found: !!sub, 
        rowCount: existing.length,
        status: sub?.subscription_status, 
        stripe: sub?.stripe_status,
        userEmail: sub?.user_email
      });
      
      return sub;
    },
    enabled: !!email,
  });

  const isPremium = subscription?.subscription_status === 'premium' && 
                    ['active', 'trialing'].includes(subscription?.stripe_status || '');
  
  // Diagnostic log (only when subscription changes)
  if (subscription) {
    console.log(`[PREMIUM] isPremium=${isPremium} sourceStatus=${subscription?.stripe_status} email=${email}`);
  }

  return {
    subscription,
    isPremium,
    isLoading,
    refetch,
  };
}