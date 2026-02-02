import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useSubscription(user) {
  // DON'T normalize - use exact email to match what's stored and RLS rules
  const email = user?.email;
  
  const { data: subscription, isLoading, refetch } = useQuery({
    queryKey: ['subscription', email],
    queryFn: async () => {
      if (!email) return null;
      
      console.log("[SUB_FETCH] start", { email, hasModel: !!base44.entities.UserSubscription });
      
      // First: check if ANY rows exist (no filter)
      const anyRows = await base44.entities.UserSubscription.list('-updated_date', 5);
      console.log("[SUB_FETCH] anyRows", {
        count: anyRows?.length ?? 0,
        emails: (anyRows ?? []).map(r => r.user_email ?? r.userEmail ?? r.email).slice(0, 5),
        keys: anyRows?.[0] ? Object.keys(anyRows[0]).slice(0, 20) : [],
        firstRow: anyRows?.[0] ?? null
      });
      
      // Then: filtered query
      const whereClause = { user_email: email };
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