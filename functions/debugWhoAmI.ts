import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("[DEBUG_WHO_AM_I] user object", user);

    // Attempt to read UserSubscription
    let subscriptionData = null;
    try {
      const subs = await base44.entities.UserSubscription.list('-updated_date', 5);
      subscriptionData = {
        count: subs.length,
        firstRow: subs[0] ? {
          user_id: subs[0].user_id,
          user_email: subs[0].user_email,
          subscription_status: subs[0].subscription_status
        } : null
      };
    } catch (error) {
      subscriptionData = { error: error.message };
    }

    return Response.json({
      authUser: {
        id: user.id,
        email: user.email,
        allKeys: Object.keys(user),
        fullObject: user
      },
      subscriptionQuery: subscriptionData
    });

  } catch (error) {
    console.error("[DEBUG_WHO_AM_I] error", error.message, error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});