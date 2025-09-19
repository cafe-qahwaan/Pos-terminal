// POST /api/sale -> records a full order (cart + payment info) and returns a printable receipt page
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { cart, payment_method, staff, amount_received } = body;

    if (!Array.isArray(cart) || cart.length === 0) {
      return new Response("Cart is empty", { status: 400 });
    }
    if (!payment_method || !staff) {
      return new Response("Missing payment_method or staff", { status: 400 });
    }

    const order_id = crypto.randomUUID();
    const subtotal = cart.reduce((s, i) => s + (Number(i.price) * Number(i.qty)), 0);
    const received = Number(amount_received || 0);
    const change_due = received - subtotal;
    const nowIso = new Date().toISOString();

    // Insert one row per cart line
    const rows = cart.map(item => ({
      order_id,
      ts: nowIso,
      item: String(item.name),
      qty: Number(item.qty),
      price: Number(item.price),
      payment_method: String(payment_method),
      staff: String(staff),
      amount_received: received,
      change_due: Number(change_due)
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

    // Build receipt HTML
    const money = n => "£" + Number(n || 0).toFixed(2);
    const when = new Date().toLocaleString("en-GB", { hour12: false });
    const lines = cart.map(i => `
      <tr>
        <td>${escapeHtml(i.name)}</td>
        <td class="r">${Number(i.qty)}</td>
        <td class="r">${money(i.price)}</td>
        <td class="r">${money(Number(i.price) * Number(i.qty))}</td>
      </tr>
    `).join("");

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt — ${order_id}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    :root { --ink:#111; --muted:#6b7280; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin:20px; color:var(--ink); }
    .wrap { max-width: 560px; margin: 0 auto; }
    h1 { margin: 0 0 2px; font-size: 1.2rem; }
    .muted { color: var(--muted); font-size: .9rem; }
    table { width:100%; border-collapse: collapse; margin-top: 14px; }
    th, td { padding:8px 6px; border-bottom:1px dashed #ddd; }
    th { text-align:left; font-weight:600; }
    .r { text-align:right; }
    .tot { font-weight:700; }
    .actions { margin-top:16px; display:flex; gap:8px; }
    button { padding:10px 12px; border:1px solid #ddd; background:#f9fafb; border-radius:8px; cursor:pointer; }
    @media print {
      .actions { display:none; }
      body { margin:0; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Cafe Qahwaan — Receipt</h1>
    <div class="muted">Order: ${order_id}<br>${when}</div>

    <table>
      <thead>
        <tr><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr>
      </thead>
      <tbody>
        ${lines}
      </tbody>
      <tfoot>
        <tr><td colspan="3" class="r">Subtotal</td><td class="r tot">${money(subtotal)}</td></tr>
        <tr><td colspan="3" class="r">Amount received</td><td class="r">${money(received)}</td></tr>
        <tr><td colspan="3" class="r">Change due</td><td class="r tot">${money(change_due)}</td></tr>
        <tr><td colspan="3" class="r">Payment method</td><td class="r">${escapeHtml(payment_method)}</td></tr>
        <tr><td colspan="3" class="r">Staff</td><td class="r">${escapeHtml(staff)}</td></tr>
      </tfoot>
    </table>

    <div class="actions">
      <button onclick="window.print()">🖨️ Print</button>
      <button onclick="location.href='/'">⬅️ New order</button>
    </div>
  </div>
  <script>
    // Auto-open print on mobile only if you want:
    // window.print();
  </script>
</body>
</html>`;

    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });

  } catch (e) {
    return new Response("Server error: " + e.message, { status: 500 });
  }
}

// simple HTML escape to avoid broken receipt if names have < > "&
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}
