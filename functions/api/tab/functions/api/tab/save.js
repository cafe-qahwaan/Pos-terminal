// POST /api/tab/save { tab_id, cart } -> updates cart & timestamp
export async function onRequestPost({ request, env }) {
  const { tab_id, cart } = await request.json();
  if (!tab_id || !Array.isArray(cart)) return new Response("Missing tab_id or cart", { status: 400 });

  const patch = await fetch(`${env.SUPABASE_URL}/rest/v1/tabs?id=eq.${tab_id}`, {
    method: "PATCH",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify({ cart, updated_at: new Date().toISOString() })
  });
  if (!patch.ok) return new Response(await patch.text(), { status: 500 });
  const [t] = await patch.json();
  return new Response(JSON.stringify({ ok: true, cart: t.cart }), { headers: { "Content-Type": "application/json" } });
}
