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
      Prefer: "return=representation"
    },
    body: JSON.stringify({ cart, updated_at: new Date().toISOString() })
  });

  if (resp.status === 204) return json({ ok: true });
  if (!resp.ok) return new Response(await resp.text(), { status: 500 });

  let data = [];
  try { data = await resp.json(); } catch {}
  const saved = Array.isArray(data) && data[0] ? data[0] : { cart };
  return json({ ok: true, cart: saved.cart });
}

function json(obj){ return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } }); }
