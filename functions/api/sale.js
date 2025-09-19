// Cloudflare Pages Function: handles POST /api/sale
export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const item = (form.get("item") || "").toString().trim();
    const qty = Number(form.get("qty"));
    const price = Number(form.get("price"));
    const payment_method = (form.get("payment_method") || "").toString().trim();
    const staff = (form.get("staff") || "").toString().trim();

    if (!item || !staff || !["Cash","Card","Online"].includes(payment_method)) {
      return new Response("Invalid input", { status: 400 });
    }
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      return new Response("Invalid numbers", { status: 400 });
    }

    const sale = {
      ts: new Date().toISOString(),
      item,
      qty,
      price: Number(price.toFixed(2)),
      payment_method,
      staff
    };

    const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/sales`, {
      method: "POST",
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify([sale])
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response("DB error: " + text, { status: 500 });
    }

    return new Response(`<!doctype html>
<html><head><meta charset="utf-8"><title>Saved</title>
<meta http-equiv="refresh" content="1; url=/" />
<style>body{font-family:system-ui;display:grid;place-items:center;height:100vh}</style>
</head><body>
  <p>✅ Sale recorded. Redirecting… <a href="/">Back</a></p>
</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8" }});
  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500 });
  }
}
