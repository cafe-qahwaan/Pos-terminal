// POST /api/tab/open { spot } -> returns { tab_id, spot, cart }
export async function onRequestPost({ request, env }) {
  const { spot } = await request.json();
  if (!spot) return new Response("Missing spot", { status: 400 });

  // 1) Try to find existing open tab for this spot
  const q = await fetch(`${env.SUPABASE_URL}/rest/v1/tabs?spot=eq.${encodeURIComponent(spot)}&status=eq.open&select=*`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` }
  });
  if (!q.ok) return new Response(await q.text(), { status: 500 });
  const rows = await q.json();
  if (rows.length > 0) {
    const t = rows[0];
    return json({ tab_id: t.id, spot: t.spot, cart: t.cart });
  }

  // 2) Create a new open tab
  const tab_id = crypto.randomUUID();
  const create = await fetch(`${env.SUPABASE_URL}/rest/v1/tabs`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation"
    },
    body: JSON.stringify([{ id: tab_id, spot, status: "open", cart: [] }])
  });
  if (!create.ok) return new Response(await create.text(), { status: 500 });
  const [t] = await create.json();
  return json({ tab_id: t.id, spot: t.spot, cart: t.cart });
}

function json(obj){ return new Response(JSON.stringify(obj), { headers: { "Content-Type": "application/json" } }); }
