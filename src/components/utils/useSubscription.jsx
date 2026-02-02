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
  
  // Log RLS rule for verification
  console.log("[RLS_RULE] read", JSON.stringify({ owner: "{{user.id}}" }));
  
  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      console.log("[SUB_FETCH] start", { 
        userId,
        hasModel: !!base44.entities.UserSubscription 
      });
      
      // First: check if ANY rows exist (no filter)
      const anyRows = await base44.entities.UserSubscription.list('-updated_date', 5);
      console.log("[SUB_FETCH] anyRows", {
        count: anyRows?.length ?? 0,
        owners: (anyRows ?? []).map(r => r.owner).slice(0, 5),
        userIds: (anyRows ?? []).map(r => r.user_id).slice(0, 5),
        emails: (anyRows ?? []).map(r => r.user_email).slice(0, 5),
        keys: anyRows?.[0] ? Object.keys(anyRows[0]).slice(0, 20) : [],
        firstRow: anyRows?.[0] ?? null
      });
      
      // Then: filtered query by owner
      const whereClause = { owner: userId };
      console.log("[SUB_FETCH] attempting filter", { whereClause });
      
      const existing = await base44.entities.UserSubscription.filter(whereClause);
      
      const sub = existing.length > 0 ? existing[0] : null;
      
      // Diagnostic logs
      console.log("[SUB_FETCH] filtered", { 
        whereClause, 
        found: !!sub, 
        rowCount: existing.length,
        status: sub?.subscription_status, 
        stripe: sub?.stripe_status,
        row: sub
      });
      
      return sub;
    },
    enabled: !!userId,
  });

  const isPremium = subscription?.subscription_status === 'premium' && 
                    ['active', 'trialing'].includes(subscription?.stripe_status || '');
  
  // Diagnostic log (only when subscription changes)
  if (subscription) {
    console.log(`[PREMIUM] isPremium=${isPremium} sourceStatus=${subscription?.stripe_status} userId=${userId}`);
  }

  return {
    subscription,
    isPremium,
    isLoading,
    refetch,
  };
}