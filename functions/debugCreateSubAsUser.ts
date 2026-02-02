import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    // Use client context (NOT service role) to test RLS
    const base44 = createClientFromRequest(req);
    
    // Get authenticated user
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("[DEBUG_CREATE_AS_USER] user", { id: user.id, email: user.email });

    // Create using USER CONTEXT (not service role) to test RLS
    const testRow = {
      user_id: user.id,
      user_email: user.email,
      subscription_status: "premium",
      stripe_status: "active",
      stripe_subscription_id: "debug_user_create",
      stripe_customer_id: "debug_user_create",
      debug_email_written: user.email
    };

    console.log("[DEBUG_CREATE_AS_USER] creating row", testRow);

    // Create using user context (RLS applies)
    const created = await base44.entities.UserSubscription.create(testRow);
    console.log("[DEBUG_CREATE_AS_USER] created ok", { id: created.id });

    // Read back using user context (RLS applies)
    const allRows = await base44.entities.UserSubscription.list('-updated_date', 5);
    console.log("[DEBUG_CREATE_AS_USER] list result", { 
      count: allRows.length,
      userIds: allRows.map(r => r.user_id),
    });

    // Filtered read
    const filtered = await base44.entities.UserSubscription.filter({ 
      user_id: user.id 
    });
    console.log("[DEBUG_CREATE_AS_USER] filter result", { 
      count: filtered.length,
    });

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        keys: Object.keys(user)
      },
      created: {
        id: created.id,
        user_id: created.user_id,
        user_email: created.user_email
      },
      readBack: {
        listCount: allRows.length,
        filteredCount: filtered.length,
        firstRow: allRows[0] ? {
          user_id: allRows[0].user_id,
          user_email: allRows[0].user_email,
          subscription_status: allRows[0].subscription_status
        } : null
      }
    });

  } catch (error) {
    console.error("[DEBUG_CREATE_AS_USER] error", error.message, error.stack);
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});