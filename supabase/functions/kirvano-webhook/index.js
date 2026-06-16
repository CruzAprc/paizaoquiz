/* ============================================================================
   EDGE FUNCTION — kirvano-webhook
   Recebe o webhook de venda da Kirvano e:
     1) grava a venda em public.paizao_purchases (aparece no painel /pedro)
     2) dispara o evento Purchase pra Meta via Conversions API (server-side)
   Segredos vêm de variáveis de ambiente (nunca no código):
     META_PIXEL_ID, META_CAPI_TOKEN, KIRVANO_WEBHOOK_TOKEN
   + injetados pelo Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
============================================================================ */
const PIXEL = Deno.env.get("META_PIXEL_ID");
const CAPI = Deno.env.get("META_CAPI_TOKEN");
const HOOK = Deno.env.get("KIRVANO_WEBHOOK_TOKEN");
const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

async function sha256(s) {
  const data = new TextEncoder().encode(String(s).trim().toLowerCase());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function pick(o, keys) {
  for (const k of keys) {
    const v = k.split(".").reduce((a, c) => (a && a[c] != null ? a[c] : undefined), o);
    if (v != null && v !== "") return v;
  }
  return null;
}
function toNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  let s = String(v).replace(/[^0-9.,-]/g, "");
  if (s.indexOf(",") > -1 && s.indexOf(".") > -1) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.indexOf(",") > -1) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const url = new URL(req.url);
  const token = url.searchParams.get("token") || req.headers.get("x-webhook-token");
  if (!HOOK || token !== HOOK) return new Response("unauthorized", { status: 401 });

  let body = {};
  try { body = await req.json(); }
  catch (_) { try { body = Object.fromEntries(new URLSearchParams(await req.text())); } catch (__) { body = {}; } }

  const event = pick(body, ["event", "event_type", "type"]);
  const status = pick(body, ["status", "sale_status", "payment_status"]);
  const transaction_id = pick(body, ["sale_id", "transaction_id", "id", "order_id", "checkout_id", "reference"]);
  const email = pick(body, ["customer.email", "buyer.email", "client.email", "email"]);
  const name = pick(body, ["customer.name", "buyer.name", "client.name", "name"]);
  const value = toNumber(pick(body, ["total_price", "amount", "value", "total", "price", "net_amount"]));
  const currency = pick(body, ["currency"]) || "BRL";
  const utm_source = pick(body, ["utm_source", "src", "utm.utm_source", "tracking.utm_source", "utms.utm_source"]);
  const utm_medium = pick(body, ["utm_medium", "utm.utm_medium", "tracking.utm_medium"]);
  const utm_campaign = pick(body, ["utm_campaign", "utm.utm_campaign", "tracking.utm_campaign"]);
  const utm_content = pick(body, ["utm_content", "utm.utm_content"]);
  const utm_term = pick(body, ["utm_term", "utm.utm_term"]);
  const fbclid = pick(body, ["fbclid", "fbc", "utm.fbclid", "tracking.fbclid"]);

  // 1) grava no banco (service role -> ignora RLS)
  try {
    await fetch(`${SB_URL}/rest/v1/paizao_purchases`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ event, status, transaction_id, email, customer_name: name, value, currency, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, raw: body }),
    });
  } catch (e) { console.error("db insert fail", e); }

  // 2) só dispara Purchase pra Meta se a venda foi aprovada
  const approved = /approv|aprovad|paid|pago|complete|SALE_APPROVED/i.test(String(event || "") + " " + String(status || ""));
  if (approved && PIXEL && CAPI) {
    try {
      const user_data = {};
      if (email) user_data.em = [await sha256(email)];
      const ev = { event_name: "Purchase", event_time: Math.floor(Date.now() / 1000), action_source: "website", user_data, custom_data: { currency } };
      if (transaction_id) ev.event_id = String(transaction_id);
      if (value != null) ev.custom_data.value = value;
      const r = await fetch(`https://graph.facebook.com/v19.0/${PIXEL}/events?access_token=${CAPI}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: [ev] }),
      });
      console.log("capi", r.status, await r.text());
    } catch (e) { console.error("capi fail", e); }
  }

  return new Response(JSON.stringify({ ok: true, approved }), { status: 200, headers: { "Content-Type": "application/json" } });
});
