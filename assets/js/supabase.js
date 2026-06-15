/* ============================================================================
   QUIZ DO PAIZÃO — integração com Supabase (tabela paizao_quiz_leads)
   ----------------------------------------------------------------------------
   Grava 1 lead por sessão do quiz:
     • cria a linha quando ela responde a 1ª pergunta (insert)
     • atualiza a cada resposta seguinte (update por coluna + answers jsonb)
     • marca completed=true + foco_resolved ao chegar no diagnóstico
   Captura UTM / referrer / origem automaticamente.
   Tudo é "fire-and-forget" e protegido por try/catch: se o Supabase falhar,
   o QUIZ CONTINUA NORMALMENTE (nunca trava a experiência da filhota).

   Chave usada: publishable (pública, segura no navegador) — NÃO é segredo.
============================================================================ */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ewnsttmmbcdzchzpxqjb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_mIb6RJkWqC5QESdczkFWng_Oo5O17hi";
  var TABLE = "paizao_quiz_leads";
  var SS_KEY = "paizao_quiz_lead_id";

  // colunas-resposta válidas (espelham os ids das perguntas no quiz-data.js)
  var ANSWER_COLS = [
    "q1_idade", "q2_foco", "q3_rotina", "q4_porque", "q5_trava", "q6_sozinha",
    "q7_deixou", "q8_um_ano", "q9_plano", "q10_cobrando", "q11_comunidade",
    "q12_alimentacao", "q13_primeiro", "q14_compromisso"
  ];

  var client = null;
  try {
    if (window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false }
      });
    }
  } catch (e) {
    console.warn("[paizao-quiz] supabase init falhou:", e && e.message);
  }

  // ---- metadados de origem (capturados 1x na criação do lead) ----
  function meta() {
    var p = new URLSearchParams(location.search);
    var g = function (k) { return p.get(k) || null; };
    return {
      utm_source: g("utm_source"),
      utm_medium: g("utm_medium"),
      utm_campaign: g("utm_campaign"),
      utm_content: g("utm_content"),
      utm_term: g("utm_term"),
      referrer: document.referrer || null,
      landing_path: (location.pathname + location.search) || null,
      user_agent: navigator.userAgent || null
    };
  }

  // só as colunas-resposta que já têm valor
  function pickCols(answers) {
    var out = {};
    for (var i = 0; i < ANSWER_COLS.length; i++) {
      var c = ANSWER_COLS[i];
      if (answers && answers[c] != null) out[c] = answers[c];
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
  var creating = null; // promessa-guarda p/ não criar 2 linhas em cliques rápidos

  // garante que existe a linha do lead; resolve { id, justCreated }
  function ensureLead(answers) {
    if (!client) return Promise.resolve({ id: null, justCreated: false });
    if (leadId) return Promise.resolve({ id: leadId, justCreated: false });
    if (creating) return creating;

    var id = newId();
    var row = Object.assign({ id: id, answers: answers || {} }, pickCols(answers), meta());

    creating = client.from(TABLE).insert(row).then(function (res) {
      if (res && res.error) {
        console.warn("[paizao-quiz] insert lead falhou:", res.error.message);
        creating = null;
        return { id: null, justCreated: false };
      }
      leadId = id;
      try { sessionStorage.setItem(SS_KEY, id); } catch (e) {}
      return { id: id, justCreated: true };
    });
    return creating;
  }

  // chamada a cada resposta selecionada
  function recordAnswer(qid, value, answers) {
    if (!client) return;
    ensureLead(answers).then(function (r) {
      if (!r.id || r.justCreated) return; // já entrou no insert
      var patch = Object.assign({ answers: answers }, pickCols(answers));
      return client.from(TABLE).update(patch).eq("id", r.id);
    }).then(function (res) {
      if (res && res.error) console.warn("[paizao-quiz] update falhou:", res.error.message);
    }).catch(function (e) { console.warn("[paizao-quiz]", e && e.message); });
  }

  // chamada ao chegar no diagnóstico (quiz concluído)
  function complete(answers) {
    if (!client) return;
    ensureLead(answers).then(function (r) {
      if (!r.id) return;
      var foco = null;
      try {
        var t = window.PERSONA && window.PERSONA.foco;
        if (t) foco = (answers.q2_foco in t) ? t[answers.q2_foco] : t._default;
      } catch (e) {}
      var patch = Object.assign({
        answers: answers,
        completed: true,
        completed_at: new Date().toISOString(),
        foco_resolved: foco
      }, pickCols(answers));
      return client.from(TABLE).update(patch).eq("id", r.id);
    }).then(function (res) {
      if (res && res.error) console.warn("[paizao-quiz] complete falhou:", res.error.message);
    }).catch(function (e) { console.warn("[paizao-quiz]", e && e.message); });
  }

  window.PaizaoDB = {
    enabled: !!client,
    recordAnswer: recordAnswer,
    complete: complete
  };
})();
