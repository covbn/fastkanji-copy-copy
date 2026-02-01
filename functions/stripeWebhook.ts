import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

/**
 * Get user email from Stripe event (multiple fallback strategies)
 */
async function getUserEmail(event, stripe) {
  const obj = event.data.object;
  
  // Priority 1: metadata.userEmail or metadata.userId
  if (obj.metadata?.userEmail) return obj.metadata.userEmail;
  if (obj.metadata?.userId) return obj.metadata.userId;
  
  // Priority 2: subscription_data.metadata (for checkout.session.completed)
  if (obj.subscription_data?.metadata?.userEmail) return obj.subscription_data.metadata.userEmail;
  if (obj.subscription_data?.metadata?.userId) return obj.subscription_data.metadata.userId;
  
  // Priority 3: client_reference_id (for sessions)
  if (obj.client_reference_id) return obj.client_reference_id;
  
  // Priority 4: customer_email (for sessions)
  if (obj.customer_email) return obj.customer_email;
  
  // Priority 5: Fetch customer and get email
  if (obj.customer) {
    try {
      const customer = await stripe.customers.retrieve(obj.customer);
      if (customer.email) return customer.email;
    } catch (err) {
      console.error('[Stripe Webhook] Failed to fetch customer:', err.message);
    }
  }
  
  // Priority 6: For subscription events, fetch subscription metadata
  if (event.type.startsWith('customer.subscription.') && obj.id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(obj.id);
      if (subscription.metadata?.userEmail) return subscription.metadata.userEmail;
      if (subscription.metadata?.userId) return subscription.metadata.userId;
    } catch (err) {
      console.error('[Stripe Webhook] Failed to fetch subscription:', err.message);
    }
  }
  
  return null;
}

/**
 * Update user premium status
 */
async function updatePremiumStatus(base44, userEmail, isPremium, stripeData = {}) {
  const settings = await base44.asServiceRole.entities.UserSettings.filter({ 
    user_email: userEmail 
  });

  if (settings.length === 0) {
    console.error(`[Stripe Webhook] No settings found for ${userEmail}`);
    return false;
  }

  const updateData = {
    subscription_status: isPremium ? 'premium' : 'free',
    ...stripeData
  };

  await base44.asServiceRole.entities.UserSettings.update(settings[0].id, updateData);
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

    const obj = event.data.object;
    const userEmail = await getUserEmail(event, stripe);
    
    if (!userEmail) {
      console.error(`[Stripe Webhook] type=${event.type} NO_USER_EMAIL_FOUND subId=${obj.id}`);
      return Response.json({ received: true, warning: 'No user email found' });
    }

    console.log(`[STRIPE WEBHOOK] type=${event.type} userId=${userEmail} status=${obj.status} subId=${obj.id || obj.subscription || 'n/a'}`);

    // Handle subscription lifecycle events
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode === 'subscription' && obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const isPremium = ['active', 'trialing'].includes(subscription.status);
          
          await updatePremiumStatus(base44, userEmail, isPremium, {
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            premium_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
          
          console.log(`[STRIPE WEBHOOK] Checkout complete: ${userEmail} premium=${isPremium} status=${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const isPremium = ['active', 'trialing'].includes(obj.status);
        
        await updatePremiumStatus(base44, userEmail, isPremium, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.id,
          premium_status: obj.status,
          current_period_end: new Date(obj.current_period_end * 1000).toISOString()
        });
        
        console.log(`[STRIPE WEBHOOK] Subscription ${event.type.split('.')[2]}: ${userEmail} premium=${isPremium} status=${obj.status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        await updatePremiumStatus(base44, userEmail, false, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.id,
          premium_status: 'canceled',
          current_period_end: null
        });
        
        console.log(`[STRIPE WEBHOOK] Subscription deleted: ${userEmail} premium=false`);
        break;
      }

      case 'invoice.paid': {
        if (obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const isPremium = ['active', 'trialing'].includes(subscription.status);
          
          await updatePremiumStatus(base44, userEmail, isPremium, {
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            premium_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
          
          console.log(`[STRIPE WEBHOOK] Invoice paid: ${userEmail} premium=${isPremium} periodEnd=${subscription.current_period_end}`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        if (obj.subscription) {
          const subscription = await stripe.subscriptions.retrieve(obj.subscription);
          const isPremium = subscription.status === 'active'; // Keep active briefly during past_due
          
          await updatePremiumStatus(base44, userEmail, isPremium, {
            stripe_customer_id: obj.customer,
            stripe_subscription_id: obj.subscription,
            premium_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
          });
          
          console.log(`[STRIPE WEBHOOK] Invoice payment failed: ${userEmail} premium=${isPremium} status=${subscription.status}`);
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