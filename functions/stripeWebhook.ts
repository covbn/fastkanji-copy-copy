import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

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

    console.log('[Stripe Webhook] Event received:', event.type);

    // Handle subscription events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userEmail = session.metadata?.user_email;

      if (userEmail && session.mode === 'subscription') {
        // Update user settings to premium
        const settings = await base44.asServiceRole.entities.UserSettings.filter({ 
          user_email: userEmail 
        });

        if (settings.length > 0) {
          await base44.asServiceRole.entities.UserSettings.update(settings[0].id, {
            subscription_status: 'premium'
          });
          console.log(`[Stripe Webhook] User ${userEmail} upgraded to premium`);
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customer = await stripe.customers.retrieve(subscription.customer);
      
      if (customer.email) {
        const settings = await base44.asServiceRole.entities.UserSettings.filter({ 
          user_email: customer.email 
        });

        if (settings.length > 0) {
          await base44.asServiceRole.entities.UserSettings.update(settings[0].id, {
            subscription_status: 'free'
          });
          console.log(`[Stripe Webhook] User ${customer.email} downgraded to free`);
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook Error]', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 400 });
  }
});