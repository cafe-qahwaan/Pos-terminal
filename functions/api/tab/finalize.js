// POST /api/tab/finalize
// Body: { tab_id, payment_method, staff, amount_received }
export async function onRequestPost({ request, env }) {
  // --- 1) Read and validate body
  let body;
  try { body = await request.json(); } catch { 
    return new Response("Bad JSON body", { status: 400 });
  }
  const { tab_id, payment_method, staff, amount_received = 0 } = body || {};
  if (!tab_id || !payment_method || !staff) {
    return new Response("Missing tab_id, payment_method, or staff", { status: 400 });
  }

  // --- 2) Load the tab (must be open)
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

  // Coerce cart into an array
  const cart = ensureArray(tab.cart);
  if (!cart.length) {
    return new Response("Cart is empty", { status: 400 });
  }

  // --- 3) Compute totals
  const subtotal = cart.reduce((s, i) => s + Number(i.price || 0) * Number(i.qty || 1), 0);
  const received = Number(amount_received || 0);
  const change_due = Math.max(0, received - subtotal);
  const nowIso = new Date().toISOString();

  // --- 4) Insert order (same shape as /api/sale)
  const orderRow = {
    cart,
    subtotal,
    payment_method,
    staff,
    amount_received: received,
    change_due,
    created_at: nowIso,
    source: "tab",
    spot: tab.spot || null
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

  // --- 5) Close the tab
  const closeUrl = `${env.SUPABASE_URL}/rest/v1/tabs?id=eq.${encodeURIComponent(tab_id)}`;
  const closeRes = await fetch(closeUrl, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify({ status: "closed", closed_at: nowIso })
  });
  if (!closeRes.ok && closeRes.status !== 204) {
    // Not fatal for the customer, but let’s surface it.
    return new Response("Order saved but closing tab failed: " + (await closeRes.text()), { status: 500 });
  }

  // --- 6) Return a simple receipt HTML
  const receipt = renderReceipt({
    title: "Cafe Qahwaan — Receipt",
    order: savedOrder
  });
  return new Response(receipt, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/* ---------- helpers ---------- */
function ensureArray(val) {
  if (Array.isArray(val)) return val;
  if (val == null) return [];
  try {
    const p = typeof val === "string" ? JSON.parse(val) : val;
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function money(n) { return "£" + Number(n || 0).toFixed(2); }

function renderReceipt({ title, order }) {
  const lines = (order.cart || []).map(
    i => `<tr><td>${escapeHtml(i.name)}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${money(i.price*i.qty)}</td></tr>`
  ).join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font-family:system-ui,Arial,sans-serif;padding:20px;color:#222}
  h1{font-size:18px;margin:0 0 8px}
  table{width:100%;border-collapse:collapse;margin-top:10px}
  td{padding:4px 0;border-bottom:1px dashed #ccc}
  .right{float:right}
</style></head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div>Spot: <strong>${escapeHtml(order.spot || "-")}</strong> <span class="right">${new Date(order.created_at).toLocaleString()}</span></div>
  <table>${lines}</table>
  <p><strong>Subtotal:</strong> ${money(order.subtotal)}</p>
  <p><strong>Payment:</strong> ${escapeHtml(order.payment_method)} &nbsp; <strong>Received:</strong> ${money(order.amount_received)} &nbsp; <strong>Change:</strong> ${money(order.change_due)}</p>
  <p><strong>Staff:</strong> ${escapeHtml(order.staff || "-")}</p>
  <hr>
  <p>Thanks for visiting Cafe Qahwaan!</p>
</body></html>`;
}

function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
