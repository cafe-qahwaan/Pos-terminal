// POST /api/tab/save { tab_id, cart } -> updates cart & timestamp
export async function onRequestPost({ request, env }) {
  const { tab_id, cart } = await request.json();
  if (!tab_id || !Array.isArray(cart)) {
    return new Response("Missing tab_id or cart", { status: 400 });
  }

  const url = `${env.SUPABASE_URL}/rest/v1/tabs?id=eq.${encodeURIComponent(tab_id)}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      // Ask for the updated row, but we also handle 204 just in case
      Prefer: "return=representation"
    },
    body: JSON.stringify({ cart, updated_at: new Date().toISOString() })
  });

  // Supabase may return 204 No Content if it didn't honor the Prefer header
  if (resp.status === 204) {
    return json({ ok: true });
  }
  if (!resp.ok) {
    const txt = await resp.text();
    return new Response(txt || "Save failed", { status: 500 });
  }

  let data = [];
  try { data = await resp.json(); } catch (_) {}
  const saved = Array.isArray(data) && data[0] ? data[0] : { cart };
  return json({ ok: true, cart: saved.cart });
}

function json(obj) {
  return new Response(JSON.stringify(obj), {
    headers: { "Content-Type": "application/json" }
  });
}
