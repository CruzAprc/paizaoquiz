/* ============================================================================
   EDGE FUNCTION — kirvano-webhook
   Recebe o webhook de venda da Kirvano e grava a venda em
   public.paizao_purchases (aparece no painel /pedro).

   OBS: a Conversions API (Purchase server-side pra Meta) foi REMOVIDA porque
   estava duplicando o evento no Gerenciador (o Purchase já é disparado pelo
   pixel no navegador / integração da Kirvano). Este webhook só persiste a venda.

   Segredos vêm de variáveis de ambiente (nunca no código):
     KIRVANO_WEBHOOK_TOKEN
   + injetados pelo Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
============================================================================ */
const HOOK = Deno.env.get("KIRVANO_WEBHOOK_TOKEN");
const SB_URL = Deno.env.get("SUPABASE_URL");
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

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

  // grava a venda no banco (service role -> ignora RLS). NÃO dispara Purchase
  // pra Meta — a CAPI foi removida pra não duplicar o evento no Gerenciador.
  try {
    await fetch(`${SB_URL}/rest/v1/paizao_purchases`, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ event, status, transaction_id, email, customer_name: name, value, currency, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, raw: body }),
    });
  } catch (e) { console.error("db insert fail", e); }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
