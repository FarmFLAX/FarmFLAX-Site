// Shared helpers for the order API (runs on Cloudflare Pages Functions).

export function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(head.map((h, j) => [h, (r[j] || "").trim()])));
}

// Reads the same products.csv the website uses, so prices can never be changed from the browser.
export async function loadCatalog(context) {
  const url = new URL("/products/products.csv", context.request.url);
  const res = await context.env.ASSETS.fetch(url);
  if (!res.ok) throw new Error("products.csv not found");
  const map = {};
  for (const p of parseCSV(await res.text())) {
    map[p.id] = { id: p.id, name: p.name, weight: Number(p.weight_g) || 0, price: Number(p.price) || 0, inStock: /^(yes|y|true|1)$/i.test(p.in_stock) };
  }
  return map;
}

export function newOrderId() {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000); // India time
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, "");
  const rnd = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().slice(0, 4).padStart(4, "0");
  return `FF-${ymd}-${rnd}`;
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

// Sends a WhatsApp alert to each team number using the WhatsApp Cloud API (Meta).
// Needs an approved "utility" message template. See README, section "WhatsApp order alerts".
export async function sendWhatsAppAlerts(env, order) {
  if (!env.WA_TOKEN || !env.WA_PHONE_NUMBER_ID || !env.ALERT_NUMBERS) return { skipped: true };
  const version = env.WA_API_VERSION || "v21.0";
  const items = order.lines.map((l) => `${l.qty} x ${l.name}`).join(", ");
  const c = order.customer;
  const params = [
    order.orderId,
    `Rs ${order.total}`,
    items,
    `${c.name}, ${c.phone}`,
    `${c.city}, ${c.state} ${c.pincode}`,
    { online: "Paid online", cod: "Cash on delivery", whatsapp: "Awaiting payment on WhatsApp" }[order.method] || order.method,
  ].map((t) => ({ type: "text", text: String(t).replace(/\s+/g, " ").slice(0, 900) }));

  const to = env.ALERT_NUMBERS.split(",").map((s) => s.trim()).filter(Boolean);
  const results = await Promise.allSettled(to.map((num) =>
    fetch(`https://graph.facebook.com/${version}/${env.WA_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.WA_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: num,
        type: "template",
        template: { name: env.WA_TEMPLATE || "new_order_alert", language: { code: env.WA_TEMPLATE_LANG || "en" }, components: [{ type: "body", parameters: params }] },
      }),
    }).then(async (r) => { if (!r.ok) throw new Error(`${num}: ${r.status} ${await r.text()}`); })
  ));
  const failed = results.filter((r) => r.status === "rejected").map((r) => String(r.reason));
  if (failed.length) console.error("WhatsApp alert failed", failed);
  return { sent: to.length - failed.length, failed };
}
