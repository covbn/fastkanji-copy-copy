import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/*
 * RLS_READ_JSON (from Base44 UI):
 * {"owner": "{{user.id}}"}
 * 
 * This means: reads are allowed only when row.owner === authenticated_user.id
 */

export function useSubscription(user) {
  const userId = user?.id;
  
  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const whereClause = { owner: userId };
      const existing = await base44.entities.UserSubscription.filter(whereClause);
      const sub = existing.length > 0 ? existing[0] : null;
      
      return sub;
    },
    enabled: !!userId,
  });

  const isPremium = subscription?.subscription_status === 'premium' && 
                    ['active', 'trialing'].includes(subscription?.stripe_status || '');

  return {
    subscription,
    isPremium,
    isLoading,
    refetch,
  };
}