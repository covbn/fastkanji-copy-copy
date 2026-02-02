import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

/**
 * Get user ID and email from Stripe event (multiple fallback strategies)
 */
async function getUserId(event, stripe) {
  const obj = event.data.object;
  let userId = null;
  let userEmail = null;
  
  // Priority 1: metadata.base44UserId
  if (obj.metadata?.base44UserId) {
    userId = obj.metadata.base44UserId;
    userEmail = obj.metadata?.userEmail || null;
  }
  
  // Priority 2: subscription_data.metadata (for checkout.session.completed)
  if (!userId && obj.subscription_data?.metadata?.base44UserId) {
    userId = obj.subscription_data.metadata.base44UserId;
    userEmail = obj.subscription_data.metadata?.userEmail || null;
  }
  
  // Priority 3: client_reference_id (for sessions)
  if (!userId && obj.client_reference_id) {
    userId = obj.client_reference_id;
    userEmail = obj.customer_email || null;
  }
  
  // Priority 4: For subscription events, fetch subscription metadata
  if (!userId && event.type.startsWith('customer.subscription.') && obj.id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(obj.id);
      if (subscription.metadata?.base44UserId) {
        userId = subscription.metadata.base44UserId;
        userEmail = subscription.metadata?.userEmail || null;
      }
    } catch (err) {
      console.error('[Stripe Webhook] Failed to fetch subscription:', err.message);
    }
  }
  
  // Priority 5: Fetch customer email if not yet found
  if (!userEmail && obj.customer) {
    try {
      const customer = await stripe.customers.retrieve(obj.customer);
      if (customer.email) userEmail = customer.email;
    } catch (err) {
      console.error('[Stripe Webhook] Failed to fetch customer:', err.message);
    }
  }
  
  console.log(`[STRIPE][GET_USER] userId=${userId} email=${userEmail}`);
  return { userId, userEmail };
}

/**
 * Update user premium status
 */
async function updatePremiumStatus(base44, userId, userEmail, isPremium, stripeData = {}) {
  if (!userId) {
    console.error(`[STRIPE][DB] ERROR: no userId provided`);
    return false;
  }
  
  console.log(`[STRIPE][DB][PRE-WRITE] userId="${userId}" email="${userEmail || 'null'}"`);
  
  // Filter by user_id (stable join key)
  const subscriptions = await base44.asServiceRole.entities.UserSubscription.filter({ 
    user_id: userId 
  });

  const updateData = {
    subscription_status: isPremium ? 'premium' : 'free',
    stripe_status: stripeData.premium_status || stripeData.stripe_status,
    user_email: userEmail || null,
    debug_email_written: userEmail || null,
    ...stripeData
  };

  if (subscriptions.length === 0) {
    // Create new subscription record
    const created = await base44.asServiceRole.entities.UserSubscription.create({
      user_id: userId,
      ...updateData
    });
    console.log(`[STRIPE][DB] create ok isPremium=${isPremium} userId="${userId}" id=${created.id}`);
  } else {
    // Update existing subscription record
    await base44.asServiceRole.entities.UserSubscription.update(subscriptions[0].id, updateData);
    console.log(`[STRIPE][DB] update ok isPremium=${isPremium} userId="${userId}" id=${subscriptions[0].id}`);
  }
  
  return true;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    if (!signature || !webhookSecret) {
      console.error('[Stripe Webhook] Missing signature or webhook secret');
      return Response.json({ error: 'Webhook validation failed' }, { status: 400 });
    }

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret
    );

    console.log(`[STRIPE][WEBHOOK] type=${event.type} id=${event.id}`);

    const obj = event.data.object;
    const { userId, userEmail } = await getUserId(event, stripe);
    
    if (!userId) {
      console.error(`[STRIPE][ERROR] missing user mapping (no userId found)`);
      return Response.json({ received: true, warning: 'No user ID found' });
    }

    const subId = obj.id || obj.subscription || 'n/a';
    const status = obj.status || 'unknown';
    console.log(`[STRIPE][MAP] userId=${userId} email=${userEmail} subId=${subId} status=${status}`);

    // Handle subscription lifecycle events
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode === 'subscription' && obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const isPremium = ['active', 'trialing'].includes(subscription.status);
          
          await updatePremiumStatus(base44, userId, userEmail, isPremium, {
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            stripe_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const isPremium = ['active', 'trialing'].includes(obj.status);
        
        await updatePremiumStatus(base44, userId, userEmail, isPremium, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.id,
          stripe_status: obj.status,
          current_period_end: new Date(obj.current_period_end * 1000).toISOString()
        });
        break;
      }

      case 'customer.subscription.deleted': {
        await updatePremiumStatus(base44, userId, userEmail, false, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.id,
          stripe_status: 'canceled',
          current_period_end: null
        });
        break;
      }

      case 'invoice.paid': {
        if (obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const isPremium = ['active', 'trialing'].includes(subscription.status);
          
          await updatePremiumStatus(base44, userId, userEmail, isPremium, {
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            stripe_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        if (obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const isPremium = subscription.status === 'active'; // Keep active briefly during past_due
          
          await updatePremiumStatus(base44, userId, userEmail, isPremium, {
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            stripe_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
        }
        break;
      }

      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook Error]', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 400 });
  }
});