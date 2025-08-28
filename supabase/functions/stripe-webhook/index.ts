import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Resend } from "npm:resend@4.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Helper logging function for debugging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!stripeSecretKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
    
    logStep("Environment variables verified");

    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2023-10-16" });
    
    // Initialize Supabase with service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify webhook signature
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    logStep("Verifying webhook signature");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(`Webhook signature verification failed: ${err.message}`, { 
        status: 400,
        headers: corsHeaders 
      });
    }

    logStep("Webhook verified", { eventType: event.type, eventId: event.id });

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Processing checkout.session.completed", { sessionId: session.id });

        // Get customer details
        const customerEmail = session.customer_email || session.customer_details?.email;
        const customerName = session.customer_details?.name;
        
        if (!customerEmail) {
          logStep("No customer email found in session");
          break;
        }

        // Update payment record using secure function
        const { data: updateSuccess, error: paymentError } = await supabase
          .rpc('update_payment_status', {
            p_status: 'completed',
            p_stripe_session_id: session.id,
            p_stripe_payment_intent_id: session.payment_intent as string,
            p_payment_method: session.payment_method_types?.[0] || 'card',
            p_metadata: {
              webhook_event_id: event.id,
              payment_status: session.payment_status,
              amount_total: session.amount_total,
              currency: session.currency
            }
          });

        if (paymentError) {
          logStep("Error updating payment", { error: paymentError });
          // Don't fail the webhook, just log the error
        } else if (!updateSuccess) {
          logStep("Payment record not found for update", { sessionId: session.id });
        } else {
          logStep("Payment updated successfully", { sessionId: session.id });
        }

        // Send notification email if Resend is configured and payment was updated successfully
        if (resendApiKey && updateSuccess) {
          try {
            const resend = new Resend(resendApiKey);
            
            // Send customer confirmation email
            const customerEmailResult = await resend.emails.send({
              from: "BusinessForms Pro <noreply@yourdomain.com>",
              to: [customerEmail],
              subject: "Payment Confirmation - BusinessForms Pro",
              html: `
                <h1>Payment Confirmed!</h1>
                <p>Thank you for your payment, ${customerName || 'valued customer'}!</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Payment Details:</h3>
                  <p><strong>Amount:</strong> ${session.currency?.toUpperCase()} ${(session.amount_total! / 100).toFixed(2)}</p>
                  <p><strong>Session ID:</strong> ${session.id}</p>
                  <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <p>If you have any questions, please contact our support team.</p>
                <p>Best regards,<br>BusinessForms Pro Team</p>
              `,
            });

            logStep("Customer email sent", { emailId: customerEmailResult.data?.id });

            // Send admin notification email (optional)
            const adminEmail = "admin@yourdomain.com"; // Replace with your admin email
            const adminEmailResult = await resend.emails.send({
              from: "BusinessForms Pro <noreply@yourdomain.com>",
              to: [adminEmail],
              subject: "New Payment Received - BusinessForms Pro",
              html: `
                <h1>New Payment Received</h1>
                <p>A new payment has been processed successfully.</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3>Payment Details:</h3>
                  <p><strong>Customer:</strong> ${customerName || 'N/A'} (${customerEmail})</p>
                  <p><strong>Amount:</strong> ${session.currency?.toUpperCase()} ${(session.amount_total! / 100).toFixed(2)}</p>
                  <p><strong>Session ID:</strong> ${session.id}</p>
                  <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                </div>
                
                <p>View full details in the admin dashboard.</p>
              `,
            });

            logStep("Admin email sent", { emailId: adminEmailResult.data?.id });

          } catch (emailError) {
            logStep("Error sending emails", { error: emailError.message });
          }
        }

        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Processing payment_intent.payment_failed", { paymentIntentId: paymentIntent.id });

        // Update payment record as failed using secure function
        await supabase
          .rpc('update_payment_status', {
            p_status: 'failed',
            p_stripe_payment_intent_id: paymentIntent.id,
            p_metadata: {
              webhook_event_id: event.id,
              failure_reason: paymentIntent.last_payment_error?.message
            }
          });

        logStep("Payment marked as failed");
        break;
      }

      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        logStep("Processing charge.dispute.created", { disputeId: dispute.id });
        
        // Handle dispute - you might want to send an alert email here
        if (resendApiKey) {
          try {
            const resend = new Resend(resendApiKey);
            await resend.emails.send({
              from: "BusinessForms Pro <noreply@yourdomain.com>",
              to: ["admin@yourdomain.com"], // Replace with your admin email
              subject: "Payment Dispute Alert - BusinessForms Pro",
              html: `
                <h1>Payment Dispute Alert</h1>
                <p>A payment dispute has been created for charge: ${dispute.charge}</p>
                <p><strong>Amount:</strong> ${dispute.currency?.toUpperCase()} ${(dispute.amount / 100).toFixed(2)}</p>
                <p><strong>Reason:</strong> ${dispute.reason}</p>
                <p>Please review this dispute in your Stripe dashboard.</p>
              `,
            });
            logStep("Dispute alert email sent");
          } catch (emailError) {
            logStep("Error sending dispute alert", { error: emailError.message });
          }
        }
        break;
      }

      default:
        logStep("Unhandled event type", { eventType: event.type });
    }

    logStep("Webhook processed successfully");
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in webhook", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});