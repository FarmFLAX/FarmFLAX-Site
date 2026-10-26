// Online payment adapter.
//
// HDFC Bank is setting up the payment gateway as part of the account opening. When their team shares
// the integration kit (API keys, test credentials and documentation), fill in createPaymentSession()
// below using HDFC's own documentation. Until then, online payment stays switched off
// (onlinePayment: false in assets/js/config.js) and customers confirm orders on WhatsApp.
//
// Keep every key in Cloudflare environment variables (Settings > Variables and Secrets), never in this file.

export function paymentConfigured(env) {
  return Boolean(env.PAYMENT_PROVIDER && env.PAYMENT_API_KEY);
}

// Must return { payUrl } — the gateway page the customer is sent to.
export async function createPaymentSession(env, order, siteOrigin) {
  // TODO(HDFC): create a payment session for `order.total` rupees with `order.orderId` as the reference,
  // and the return URL `${siteOrigin}/api/payment-return`. Follow HDFC's integration document exactly.
  throw new Error("Online payment is not set up yet");
}

// Must confirm with the gateway (server to server) that the order was really paid.
export async function verifyPayment(env, params) {
  // TODO(HDFC): check payment status with the gateway using the order reference in `params`.
  return { paid: false, orderId: params.get("order_id") || "" };
}
