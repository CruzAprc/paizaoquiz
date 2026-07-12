/* ============================================================================
   FUNIL /insta — gravação no Supabase
   1) Preferência: tabela dedicada paizao_insta_leads via RPC paizao_insta_save
   2) Fallback: paizao_quiz_leads via RPC paizao_quiz_save (answers.flow = "insta")
      → funciona AGORA, sem migration (painel filtra por flow)
============================================================================ */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ewnsttmmbcdzchzpxqjb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_mIb6RJkWqC5QESdczkFWng_Oo5O17hi";
  var SS_KEY = "paizao_insta_lead_id";

  var ENTRY_SEARCH = location.search || "";
  var ENTRY_PATH = location.pathname || "/insta";

  var COLS = [
    "instagram_handle",
    "instagram_followers",
    "tiktok_handle",
    "tiktok_followers",
    "ja_fez_publi",
    "conhece_app_paizao"
  ];

  var client = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });
    }
  } catch (e) {
    console.warn("[paizao-insta] supabase init falhou:", e && e.message);
  }

  function meta() {
    var p = new URLSearchParams(ENTRY_SEARCH);
    var g = function (k) { return p.get(k) || null; };
    return {
      utm_source: g("utm_source"),
      utm_medium: g("utm_medium"),
      utm_campaign: g("utm_campaign"),
      utm_content: g("utm_content"),
      utm_term: g("utm_term"),
      referrer: document.referrer || null,
      landing_path: (ENTRY_PATH + ENTRY_SEARCH) || null,
      user_agent: navigator.userAgent || null
    };
  }

  function pickCols(answers) {
    var out = {};
    for (var i = 0; i < COLS.length; i++) {
      var c = COLS[i];
      if (answers && answers[c] != null && answers[c] !== "") out[c] = answers[c];
    }
    return out;
  }

  function newId() {
    try { if (crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var leadId = null;
  try { leadId = sessionStorage.getItem(SS_KEY) || null; } catch (e) {}
  if (!leadId) {
    leadId = newId();
    try { sessionStorage.setItem(SS_KEY, leadId); } catch (e) {}
  }
  var metaSent = false;
  // após 1 falha da RPC dedicada, só usa o fallback do quiz
  var instaRpcOk = null; // null | true | false

  function save(patch) {
    if (!client) return;
    var body = Object.assign({}, patch);
    if (!metaSent) {
      Object.assign(body, meta());
      metaSent = true;
    }

    function fallbackQuiz() {
      // Guarda tudo no jsonb answers com flow=insta (não polui colunas do quiz)
      var ans = Object.assign({ flow: "insta" }, body.answers || {}, pickCols(body));
      // last_step_slug com prefixo insta/ pra filtrar no painel
      var slug = body.last_step_slug || null;
      if (slug && String(slug).indexOf("insta/") !== 0) slug = "insta/" + slug;
      var quizPatch = {
        answers: ans,
        last_step: body.last_step,
        last_step_slug: slug,
        last_step_label: body.last_step_label ? ("insta · " + body.last_step_label) : body.last_step_label,
        last_step_at: body.last_step_at,
        completed: body.completed,
        completed_at: body.completed_at,
        utm_source: body.utm_source,
        utm_medium: body.utm_medium,
        utm_campaign: body.utm_campaign,
        utm_content: body.utm_content,
        utm_term: body.utm_term,
        referrer: body.referrer,
        landing_path: body.landing_path,
        user_agent: body.user_agent
      };
      return client.rpc("paizao_quiz_save", { p_id: leadId, p_patch: quizPatch })
        .then(function (res) {
          if (res && res.error) console.warn("[paizao-insta] fallback quiz_save falhou:", res.error.message);
        });
    }

    if (instaRpcOk === false) {
      fallbackQuiz().catch(function (e) { console.warn("[paizao-insta]", e && e.message); });
      return;
    }

    var bodyInsta = Object.assign({}, body, pickCols(body));
    client.rpc("paizao_insta_save", { p_id: leadId, p_patch: bodyInsta })
      .then(function (res) {
        if (res && res.error) {
          instaRpcOk = false;
          console.warn("[paizao-insta] rpc dedicada ausente — usando paizao_quiz_leads (flow=insta):", res.error.message);
          return fallbackQuiz();
        }
        instaRpcOk = true;
      })
      .catch(function (e) {
        instaRpcOk = false;
        console.warn("[paizao-insta]", e && e.message);
        return fallbackQuiz();
      });
  }

  function recordPatch(answers, extra) {
    var body = Object.assign({ answers: answers || {} }, pickCols(answers || {}));
    if (extra) Object.assign(body, extra);
    save(body);
  }

  function recordStep(index, slug, label) {
    save({
      last_step: index,
      last_step_slug: slug || null,
      last_step_label: label || null,
      last_step_at: new Date().toISOString()
    });
  }

  function complete(answers) {
    recordPatch(answers, {
      completed: true,
      completed_at: new Date().toISOString()
    });
  }

  window.PaizaoInstaDB = {
    enabled: !!client,
    leadId: leadId,
    recordPatch: recordPatch,
    recordStep: recordStep,
    complete: complete
  };
})();
