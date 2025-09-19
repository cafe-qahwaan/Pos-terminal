// POST /api/sale -> records a full order (cart + payment info)
import { v4 as uuidv4 } from "uuid";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { cart, payment_method, staff, amount_received } = body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response("Cart is empty", { status: 400 });
    }

    const order_id = uuidv4();
    const change_due = amount_received - cart.reduce((s, i) => s + (i.price * i.qty), 0);

    const rows = cart.map(item => ({
      order_id,
      ts: new Date().toISOString(),
      item: item.name,
      qty: item.qty,
      price: item.price,
      payment_method,
      staff,
      amount_received,
      change_due
    }));

    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/sales`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify(rows)
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response("DB error: " + text, { status: 500 });
    }

    return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><title>Saved</title>
<meta http-equiv="refresh" content="2; url=/" />
<style>body{font-family:monospace;background:#111;color:#0f0;display:flex;align-items:center;justify-content:center;height:100vh}</style>
</head><body>
  <div><h2>✅ Order recorded</h2><p>Order ID: ${order_id}</p></div>
</body></html>`, { headers: { "Content-Type": "text/html" }});
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500 });
  }
}
