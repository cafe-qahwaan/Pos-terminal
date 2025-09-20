// GET /api/tabs -> list open tabs with item_count & subtotal (computed from cart)
export async function onRequestGet({ env }) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/tabs?status=eq.open&select=id,spot,cart,updated_at`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  if (!r.ok) return new Response(await r.text(), { status: 500 });

  const rows = await r.json();
  const out = rows.map(t => {
    let item_count = 0, subtotal = 0;
    try {
      for (const it of t.cart || []) {
        item_count += Number(it.qty || 0);
        subtotal += Number(it.qty || 0) * Number(it.price || 0);
      }
    } catch (_) {}
    return { tab_id: t.id, spot: t.spot, item_count, subtotal, updated_at: t.updated_at };
  });
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
