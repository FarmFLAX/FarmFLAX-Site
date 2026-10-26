// POST /api/order — checks the cart against products.csv, saves the order and alerts the team on WhatsApp.
import { loadCatalog, newOrderId, json, sendWhatsAppAlerts } from "../_lib/orders.js";
import { paymentConfigured, createPaymentSession } from "../_lib/payment.js";

const FREE_ABOVE = 499; // keep in sync with assets/js/config.js
const SHIPPING_FEE = 49;

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }

  const items = Array.isArray(body.items) ? body.items : [];
  const c = body.customer || {};
  const method = ["online", "cod", "whatsapp"].includes(body.method) ? body.method : "whatsapp";

  if (!items.length || items.length > 30) return json({ error: "Your cart is empty." }, 400);
  if (!c.name || String(c.name).length > 80) return json({ error: "Please enter your full name." }, 400);
  if (!/^[6-9]\d{9}$/.test(String(c.phone || ""))) return json({ error: "Please enter a valid 10-digit mobile number." }, 400);
  if (!/^\d{6}$/.test(String(c.pincode || ""))) return json({ error: "Please enter a 6-digit PIN code." }, 400);
  if (!c.line1 || !c.city || !c.state) return json({ error: "Please complete your delivery address." }, 400);

  const catalog = await loadCatalog(context);
  const lines = [];
  for (const it of items) {
    const p = catalog[it.id];
    const qty = Math.floor(Number(it.qty));
    if (!p) return json({ error: "A product in your cart is no longer available. Please refresh your cart." }, 409);
    if (!p.inStock) return json({ error: `${p.name} is out of stock. Please remove it from your cart.` }, 409);
    if (!(qty >= 1 && qty <= 20)) return json({ error: "Please check the quantities in your cart." }, 400);
    lines.push({ id: p.id, name: p.name, qty, price: p.price, total: p.price * qty });
  }
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const shipping = subtotal >= FREE_ABOVE ? 0 : SHIPPING_FEE;

  const clean = (v, n) => String(v || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
  const customer = {
    name: clean(c.name, 80), phone: String(c.phone), email: clean(c.email, 120),
    line1: clean(c.line1, 160), line2: clean(c.line2, 160), city: clean(c.city, 60),
    state: clean(c.state, 60), pincode: String(c.pincode), notes: clean(c.notes, 300),
  };
  const order = {
    orderId: newOrderId(), createdAt: new Date().toISOString(), method,
    status: method === "online" ? "awaiting_payment" : "new",
    lines, subtotal, shipping, total: subtotal + shipping, customer,
  };

  if (method === "cod" && env.COD_ENABLED !== "true") return json({ error: "Cash on delivery is not available yet." }, 400);
  if (method === "online" && !paymentConfigured(env)) return json({ error: "Online payment is not available yet. Please choose WhatsApp." }, 400);

  // Keep a copy of every order if the ORDERS storage is connected (Cloudflare KV, free tier).
  if (env.ORDERS) await env.ORDERS.put(`order:${order.orderId}`, JSON.stringify(order));

  if (method === "online") {
    try {
      const { payUrl } = await createPaymentSession(env, order, new URL(request.url).origin);
      return json({ orderId: order.orderId, total: order.total, payUrl });
    } catch (e) {
      return json({ error: "Online payment failed to start. Please try again or choose WhatsApp." }, 502);
    }
  }

  context.waitUntil(sendWhatsAppAlerts(env, order));
  return json({ orderId: order.orderId, lines: lines.map(({ name, qty, total }) => ({ name, qty, total })), subtotal, shipping, total: order.total });
}
