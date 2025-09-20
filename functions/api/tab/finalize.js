// Path: /functions/api/tab/finalize.js
// POST /api/tab/finalize
// Body: { tab_id, payment_method, staff, amount_received }
export async function onRequestPost({ request, env }) {
  // 1) Read & validate body
  let body;
  try { body = await request.json(); }
  catch { return new Response("Bad JSON body", { status: 400 }); }

  const { tab_id, payment_method, staff, amount_received = 0 } = body || {};
  if (!tab_id || !payment_method || !staff) {
    return new Response("Missing tab_id, payment_method, or staff", { status: 400 });
  }

  // 2) Load tab (must be open)
  const tabUrl = `${env.SUPABASE_URL}/rest/v1/tabs`
    + `?id=eq.${encodeURIComponent(tab_id)}`
    + `&select=id,spot,status,cart,opened_at,updated_at`
    + `&limit=1`;

  const tabRes = await fetch(tabUrl, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Accept: "application/json"
    }
  });
  if (!tabRes.ok) return new Response(await tabRes.text(), { status: 500 });

  const rows = await tabRes.json();
  if (!rows.length) return new Response("Tab not found", { status: 404 });

  const tab = rows[0];
  if (tab.status && tab.status !== "open") {
    return new Response("Tab already closed", { status: 409 });
  }

  // 3) Coerce cart & totals
  const cart = toArray(tab.cart);
  if (!cart.length) return new Response("Cart is empty", { status: 400 });

  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
  const received = Number(amount_received || 0);
  const change_due = Math.max(0, received - subtotal);

  // 4) Insert order (generate UUID; do NOT rely on created_at/source/spot)
  const orderRow = {
    id: crypto.randomUUID(),    // <- important: avoid NOT NULL id issues
    cart,
    subtotal,
    payment_method,
    staff,
    amount_received: received,
    change_due
  };

  const ordersUrl = `${env.SUPABASE_URL}/rest/v1/orders`;
  const orderRes = await fetch(ordersUrl, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify([orderRow])
  });
  if (!orderRes.ok) return new Response(await orderRes.text(), { status: 500 });

  const [savedOrder] = await orderRes.json();

  // 5) Close the tab
  const closeUrl = `${env.SUPABASE_URL}/rest/v1/tabs?id=eq.${encodeURIComponent(tab_id)}`;
  const closeRes = await fetch(closeUrl, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ status: "closed", closed_at: new Date().toISOString() })
  });
  if (!closeRes.ok && closeRes.status !== 204) {
    return new Response("Order saved but closing tab failed: " + (await closeRes.text()), { status: 500 });
  }

  // 6) Return receipt HTML
  return new Response(renderReceipt("Cafe Qahwaan — Receipt", savedOrder, tab.spot), {
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
}

/* ---------- helpers ---------- */
function toArray(v) {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  try { const p = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; }
  catch { return []; }
}
function money(n) { return "£" + Number(n || 0).toFixed(2); }
function esc(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function renderReceipt(title, order, spot) {
  const lines = (order.cart || []).map(
    i => `<tr><td>${esc(i.name)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${money(i.price*i.qty)}</td></tr>`
  ).join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;padding:20px;color:#222}
  h1{font-size:18px;margin:0 0 8px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  td{padding:4px 0;border-bottom:1px dashed #ccc}
  .right{float:right}
</style></head>
<body>
  <h1>${esc(title)}</h1>
  <div>Spot: <strong>${esc(spot || "-")}</strong> <span class="right">${new Date().toLocaleString()}</span></div>
  <table>${lines}</table>
  <p><strong>Subtotal:</strong> ${money(order.subtotal)}</p>
  <p><strong>Payment:</strong> ${esc(order.payment_method)} &nbsp; <strong>Received:</strong> ${money(order.amount_received)} &nbsp; <strong>Change:</strong> ${money(order.change_due)}</p>
  <p><strong>Staff:</strong> ${esc(order.staff || "-")}</p>
  <hr>
  <p>Thanks for visiting Cafe Qahwaan!</p>
</body></html>`;
}
