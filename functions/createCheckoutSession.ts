import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Stripe from 'npm:stripe@17.5.0';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { priceId } = await req.json();

    if (!priceId) {
      return Response.json({ error: 'Price ID required' }, { status: 400 });
    }

    // Get app URL for redirects
    const appUrl = req.headers.get('origin') || 'https://your-app-url.com';

    const session = await stripe.checkout.sessions.create({
      customer_email: user.email,
      client_reference_id: user.id, // Use user.id for stable RLS matching
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/?success=true`,
      cancel_url: `${appUrl}/Subscription?canceled=true`,
      subscription_data: {
        metadata: {
          base44UserId: user.id,
          userEmail: user.email,
          base44_app_id: Deno.env.get("BASE44_APP_ID")
        }
      },
      metadata: {
        base44UserId: user.id,
        userEmail: user.email,
        base44_app_id: Deno.env.get("BASE44_APP_ID")
      },
    });

    console.log(`[STRIPE][CHECKOUT] start userId=${user.id} email=${user.email} priceId=${priceId}`);

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('[Stripe Checkout Error]', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});