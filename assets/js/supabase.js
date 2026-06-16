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

  // SNAPSHOT da URL de entrada — capturado AGORA, no load do script, ANTES do
  // app.js "limpar" a URL com o roteador (replaceState). Garante que os UTMs do
  // anúncio (?utm_source=facebook&...) sejam gravados mesmo com a URL limpa depois.
  var ENTRY_SEARCH = location.search || "";
  var ENTRY_PATH = location.pathname || "/";

  // colunas-resposta válidas (espelham os ids das perguntas no quiz-data.js)
  // + altura/peso/imc (tela "measure"). Tudo que vier em state.answers e estiver
  // nesta lista vira coluna; o resto fica no jsonb "answers".
  var ANSWER_COLS = [
    "q1_idade", "q2_foco", "q3_rotina", "q4_porque", "q5_trava", "q6_sozinha",
    "q7_deixou", "q8_um_ano", "q9_plano", "q10_cobrando", "q11_comunidade",
    "q12_alimentacao", "q13_primeiro", "q14_compromisso",
    "altura_cm", "peso_kg", "imc"
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
  // Usa o SNAPSHOT da entrada (ENTRY_SEARCH) p/ não perder UTM quando a rota limpa a URL.
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

  // id do lead gerado no cliente (sobrevive a refresh dentro da mesma aba)
  var leadId = null;
  try { leadId = sessionStorage.getItem(SS_KEY) || null; } catch (e) {}
  if (!leadId) { leadId = newId(); try { sessionStorage.setItem(SS_KEY, leadId); } catch (e) {} }
  var metaSent = false;

  // grava via RPC paizao_quiz_save (roda como dono no servidor -> ignora RLS,
  // não depende de SELECT, e os leads continuam privados). Patch parcial: o
  // servidor faz coalesce, então só sobrescreve o que vier preenchido.
  function save(patch) {
    if (!client) return;
    var body = Object.assign({}, patch);
    if (!metaSent) { Object.assign(body, meta()); metaSent = true; } // utm/origem 1x
    client.rpc("paizao_quiz_save", { p_id: leadId, p_patch: body })
      .then(function (res) {
        if (res && res.error) console.warn("[paizao-quiz] save falhou:", res.error.message);
      })
      .catch(function (e) { console.warn("[paizao-quiz]", e && e.message); });
  }

  // chamada a cada resposta selecionada
  function recordAnswer(qid, value, answers) {
    save(Object.assign({ answers: answers }, pickCols(answers)));
  }

  // tela "measure": salva altura/peso/imc (já estão em state.answers + ANSWER_COLS)
  function recordMeasure(answers) {
    save(Object.assign({ answers: answers }, pickCols(answers)));
  }

  // chamada a cada tela renderizada — registra a etapa máxima alcançada (drop-off).
  // O servidor guarda o MAIOR last_step (GREATEST), então o "voltar" não regride.
  function recordStep(index, slug, label) {
    save({
      last_step: index,
      last_step_slug: slug || null,
      last_step_label: label || null,
      last_step_at: new Date().toISOString()
    });
  }

  // chamada ao chegar no diagnóstico (quiz concluído)
  function complete(answers) {
    var foco = null;
    try {
      var t = window.PERSONA && window.PERSONA.foco;
      if (t) foco = (answers.q2_foco in t) ? t[answers.q2_foco] : t._default;
    } catch (e) {}
    save(Object.assign({
      answers: answers,
      completed: true,
      completed_at: new Date().toISOString(),
      foco_resolved: foco
    }, pickCols(answers)));
  }

  window.PaizaoDB = {
    enabled: !!client,
    recordAnswer: recordAnswer,
    recordMeasure: recordMeasure,
    recordStep: recordStep,
    complete: complete
  };
})();
