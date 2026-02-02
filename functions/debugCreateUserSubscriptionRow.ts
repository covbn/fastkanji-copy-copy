import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("[DEBUG_CREATE] user authenticated", { email: user.email });

    // Create a test subscription row with authenticated user's email
    const testRow = {
      user_email: user.email,
      subscription_status: "premium",
      stripe_status: "active",
      stripe_subscription_id: "debug_test_sub",
      stripe_customer_id: "debug_test_cus",
      debug_email_written: user.email
    };

    console.log("[DEBUG_CREATE] creating row", testRow);

    // Create using user context (not service role) to test RLS
    const created = await base44.entities.UserSubscription.create(testRow);
    console.log("[DEBUG_CREATE] created ok", { id: created.id });

    // Now try to read it back
    const allRows = await base44.entities.UserSubscription.list('-updated_date', 5);
    console.log("[DEBUG_CREATE] read back", { 
      count: allRows.length,
      emails: allRows.map(r => r.user_email),
      statuses: allRows.map(r => r.subscription_status)
    });

    // Try filtered read
    const filtered = await base44.entities.UserSubscription.filter({ 
      user_email: user.email 
    });
    console.log("[DEBUG_CREATE] filtered read", { 
      count: filtered.length,
      found: filtered.length > 0
    });

    return Response.json({
      success: true,
      created: created,
      readBack: {
        allCount: allRows.length,
        filteredCount: filtered.length
      }
    });

  } catch (error) {
    console.error("[DEBUG_CREATE] error", error.message, error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});