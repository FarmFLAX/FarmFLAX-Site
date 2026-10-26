// GET or POST /api/payment-return — where the payment gateway sends the customer back after paying.
import { verifyPayment } from "../_lib/payment.js";
import { sendWhatsAppAlerts } from "../_lib/orders.js";

async function handle(context) {
  const { request, env } = context;
  const params = request.method === "POST" ? new URLSearchParams(await request.text()) : new URL(request.url).searchParams;
  const result = await verifyPayment(env, params);
  const back = new URL("/order-status.html", request.url);
  back.searchParams.set("order", result.orderId || "");

  if (result.paid && env.ORDERS) {
    const raw = await env.ORDERS.get(`order:${result.orderId}`);
    if (raw) {
      const order = JSON.parse(raw);
      if (order.status !== "paid") {
        order.status = "paid";
        order.method = "online";
        await env.ORDERS.put(`order:${order.orderId}`, JSON.stringify(order));
        context.waitUntil(sendWhatsAppAlerts(env, order));
      }
    }
  }
  back.searchParams.set("paid", result.paid ? "1" : "0");
  return Response.redirect(back.toString(), 303);
}

export const onRequestGet = handle;
export const onRequestPost = handle;
