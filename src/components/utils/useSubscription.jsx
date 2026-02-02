import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useSubscription(user) {
  const normalizedEmail = user?.email?.toLowerCase().trim();
  
  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', normalizedEmail],
    queryFn: async () => {
      if (!normalizedEmail) return null;
      const existing = await base44.entities.UserSubscription.filter({ 
        user_email: normalizedEmail 
      });
      
      const sub = existing.length > 0 ? existing[0] : null;
      
      // Diagnostic log
      console.log(`[SUB] email=${normalizedEmail} status=${sub?.subscription_status || 'null'} subId=${sub?.stripe_subscription_id || 'none'} updatedAt=${sub?.updated_date || 'none'}`);
      
      return sub;
    },
    enabled: !!normalizedEmail,
  });

  const isPremium = subscription?.subscription_status === 'premium' && 
                    ['active', 'trialing'].includes(subscription?.stripe_status || '');
  
  // Diagnostic log (only when subscription changes)
  if (subscription) {
    console.log(`[PREMIUM] isPremium=${isPremium} sourceStatus=${subscription?.stripe_status} email=${normalizedEmail}`);
  }

  return {
    subscription,
    isPremium,
    isLoading,
    refetch,
  };
}