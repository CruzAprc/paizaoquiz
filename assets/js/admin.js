/* ============================================================================
   PAINEL DO PEDRO — /pedro
   Login via Supabase Auth. Lê métricas via RPC paizao_quiz_overview
   (agrega no Postgres e devolve ~KB). Fallback: fetch paralelo por fatias
   de hora se a RPC ainda não existir no projeto.
============================================================================ */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ewnsttmmbcdzchzpxqjb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_mIb6RJkWqC5QESdczkFWng_Oo5O17hi";
  var QUIZ = window.QUIZ || [];

  // ---- mapa de etapas por URL (espelha o roteador do app.js) ----
  // Landing desligada: a entrada do funil é /pergunta-1 (= PageView).
  // Retenção SEMPRE por last_step_slug (URL), na ordem real do QUIZ atual.
  // Espelha app.js ROUTE_BY_QID (inclui q7b_nostalgia + slugs atuais)
  var ROUTE_BY_QID = {
    q1_idade: "pergunta-1", q2_foco: "pergunta-2", q3_rotina: "pergunta-3",
    q4_porque: "pergunta-4", q5_trava: "pergunta-5", q6_sozinha: "pergunta-6",
    q7_deixou: "pergunta-6", q7b_nostalgia: "nostalgia", q8_um_ano: "pergunta-7",
    q9_plano: "pergunta-8",
    q10_cobrando: "pergunta-9", q11_comunidade: "pergunta-10", q12_alimentacao: "pergunta-11",
    q13_primeiro: "pergunta-12", q14_compromisso: "pergunta-13"
  };
  var LABEL_BY_TYPE = {
    landing: "Landing", story: "Vídeo Carlão", testimonial: "Vídeo Liz", letter: "Carta",
    vsl: "Mini VSL 1", measure: "Medidas", loading: "Montando plano",
    chart: "Diagnóstico", offer: "Mini VSL 2 (oferta)"
  };
  // Labels curtos pra etapas com slug fora de pergunta-N (funil atual)
  var LABEL_BY_QID = {
    q1_idade: "Idade",
    q2_foco: "Foco",
    q3_rotina: "Rotina",
    q4_porque: "Por que não conseguiu",
    q5_trava: "O que te trava",
    q7_deixou: "Corpo hoje (P6)",
    q7b_nostalgia: "Nostalgia",
    q8_um_ano: "Daqui 1 ano",
    q9_plano: "Plano / falta",
    q10_cobrando: "Cobrança",
    q11_comunidade: "Comunidade",
    q12_alimentacao: "Alimentação",
    q13_primeiro: "Primeiro no espelho",
    q14_compromisso: "Compromisso"
  };
  var ROUTE_BY_TYPE = {
    landing: "", story: "video-carlao", testimonial: "video-liz", letter: "carta",
    vsl: "mini-vsl-1", measure: "medidas", loading: "montando",
    chart: "diagnostico", offer: "mini-vsl-2"
  };
  function slugFor(i) {
    var s = QUIZ[i]; if (!s) return null;
    // slug explícito (video-niic / video-liz / nostalgia)
    if (s.slug) return s.slug;
    if (s.type === "question") return (s.id && ROUTE_BY_QID[s.id] != null) ? ROUTE_BY_QID[s.id] : ("etapa-" + i);
    return (ROUTE_BY_TYPE[s.type] != null) ? ROUTE_BY_TYPE[s.type] : ("etapa-" + i);
  }
  function stripHtml(html) {
    return String(html == null ? "" : html).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  function labelFor(i) {
    var s = QUIZ[i]; if (!s) return "etapa " + i;
    if (s.label) return s.label;
    if (s.type === "question") {
      if (s.id && LABEL_BY_QID[s.id]) return LABEL_BY_QID[s.id];
      var sl = slugFor(i) || "";
      if (sl.indexOf("pergunta-") === 0) return "Pergunta " + sl.replace("pergunta-", "");
      return sl || ("Q" + i);
    }
    return LABEL_BY_TYPE[s.type] || s.type;
  }

  // Ordem do funil = ordem real das telas no QUIZ (fluxo atual), chave = URL/slug.
  // Depoimentos em bifurcação (showIf/hideIf) compartilham parallelGroup + mesmo depth.
  // Ex.: […, pergunta-2, video-niic || video-liz, pergunta-6, …]
  var FUNNEL_STEPS = [];
  var SLUG_TO_FLOW = {}; // slug → índice no FUNNEL_STEPS
  QUIZ.forEach(function (s, i) {
    if (!s) return;
    // landing desativada no QUIZ; se voltar, slug "" = root — ainda entra no funil
    var slug = slugFor(i);
    if (slug == null) return;
    // dedupe: se o mesmo slug aparecer 2x (ex. q6/q7), mantém a 1ª ocorrência no fluxo
    if (Object.prototype.hasOwnProperty.call(SLUG_TO_FLOW, slug)) return;
    var parallelGroup = null;
    if (s.showIf || s.hideIf) parallelGroup = "branch:" + (s.type || "step");
    // depoimentos video-niic / video-liz sempre no mesmo grupo (mesmo sem showIf no futuro)
    if (slug === "video-niic" || slug === "video-liz") parallelGroup = "branch:depoimento";
    var step = {
      slug: slug,
      path: slug === "" ? "/" : ("/" + slug),
      label: labelFor(i),
      type: s.type || "",
      quizIndex: i,
      qid: s.id || null,
      parallelGroup: parallelGroup,
      handle: s.topName || s.handle || null
    };
    SLUG_TO_FLOW[slug] = FUNNEL_STEPS.length;
    FUNNEL_STEPS.push(step);
  });
  // depth linear; irmãos da bifurcação ficam no MESMO depth (não somam 2 etapas no funil)
  (function assignDepths() {
    var d = 0;
    for (var i = 0; i < FUNNEL_STEPS.length; i++) {
      var st = FUNNEL_STEPS[i];
      var prev = i > 0 ? FUNNEL_STEPS[i - 1] : null;
      if (prev && st.parallelGroup && st.parallelGroup === prev.parallelGroup) {
        st.depth = prev.depth;
      } else {
        st.depth = d;
        d += 1;
      }
    }
  })();
  var ENTRY_SLUG = FUNNEL_STEPS.length ? FUNNEL_STEPS[0].slug : "pergunta-1";
  var OFFER_FLOW = (function () {
    for (var i = 0; i < FUNNEL_STEPS.length; i++) if (FUNNEL_STEPS[i].type === "offer") return i;
    return Math.max(0, FUNNEL_STEPS.length - 1);
  })();

  function stepTitle(step, isFirst) {
    if (!step) return "—";
    var url = step.path || ("/" + (step.slug || ""));
    // Entrada do quiz = PageView (hoje = /pergunta-1)
    if (isFirst) return "PageView · " + url;
    if (step.type === "question") return step.label + " · " + url;
    return step.label + " · " + url;
  }
  function isVideoStep(stepOrLabel) {
    if (stepOrLabel && typeof stepOrLabel === "object") {
      return /story|testimonial|vsl|offer/i.test(stepOrLabel.type || "") ||
        /Vídeo|VSL|Mini/i.test(stepOrLabel.label || "");
    }
    return /Vídeo|VSL|Mini/i.test(String(stepOrLabel || ""));
  }

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  // % inteiro (barras de funil / retenção visual)
  var pct = function (n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; };
  // % fino pra convert rate — 2 casas se <1%, 1 casa se <10%, senão inteiro
  function cvr(n, d) {
    if (!(d > 0)) return "0%";
    var r = (Number(n) || 0) / d * 100;
    if (r <= 0) return "0%";
    if (r < 0.1) return r.toFixed(2).replace(".", ",") + "%";
    if (r < 1) return r.toFixed(2).replace(".", ",") + "%";
    if (r < 10) return r.toFixed(1).replace(".", ",") + "%";
    return Math.round(r) + "%";
  }
  function cvrSub(n, d, label) {
    return cvr(n, d) + " · " + (Number(n) || 0) + " / " + (Number(d) || 0) + (label ? " · " + label : "");
  }

  var client = null;
  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "paizao_admin_auth" }
    });
  } catch (e) { console.error(e); }

  // snapshot agregado da última carga (RPC ou fallback)
  var overview = null;
  var _mode = ""; // "rpc" | "client"
  var _rpcAvailable = null; // null=desconhecido, true/false

  function isApproved(p) { return /approv|aprovad|paid|pago|complete|SALE_APPROVED/i.test(String(p.event || "") + " " + String(p.status || "")); }
  function money(n) { n = parseFloat(n) || 0; return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ----------------------------------------------------------- ORIGEM (cascata) */
  var REF_DOMAINS = [
    { m: "instagram", l: "Instagram" }, { m: "facebook", l: "Facebook" },
    { m: "fb.", l: "Facebook" }, { m: "l.facebook", l: "Facebook" },
    { m: "google", l: "Google (orgânico)" }, { m: "youtube", l: "YouTube" },
    { m: "youtu.be", l: "YouTube" }, { m: "bing", l: "Bing" },
    { m: "tiktok", l: "TikTok" }, { m: "t.co", l: "Twitter/X" },
    { m: "twitter", l: "Twitter/X" }, { m: "x.com", l: "Twitter/X" },
    { m: "pinterest", l: "Pinterest" }, { m: "linkedin", l: "LinkedIn" },
    { m: "whatsapp", l: "WhatsApp" }, { m: "wa.me", l: "WhatsApp" }
  ];
  var UA_APPS = [
    { m: "instagram", l: "Instagram (app)" }, { m: "fban", l: "Facebook (app)" },
    { m: "fbav", l: "Facebook (app)" }, { m: "fb_iab", l: "Facebook (app)" },
    { m: "tiktok", l: "TikTok (app)" }, { m: "musical_ly", l: "TikTok (app)" },
    { m: "pinterest", l: "Pinterest (app)" }, { m: "line/", l: "LINE (app)" }
  ];
  function refDomain(ref) {
    try {
      var host = new URL(ref).hostname.toLowerCase().replace(/^www\./, "");
      for (var i = 0; i < REF_DOMAINS.length; i++) if (host.indexOf(REF_DOMAINS[i].m) >= 0) return REF_DOMAINS[i].l;
      return host || "";
    } catch (e) { return ""; }
  }
  function uaApp(ua) {
    var s = String(ua || "").toLowerCase();
    for (var i = 0; i < UA_APPS.length; i++) if (s.indexOf(UA_APPS[i].m) >= 0) return UA_APPS[i].l;
    return "";
  }
  function origem(l) {
    if (l.origem) return l.origem;
    if (l.utm_source) return l.utm_source;
    var lp = l.landing_path || "";
    var m = lp.match(/[?&]utm_source=([^&]+)/);
    if (m) { try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return m[1]; } }
    if (/[?&]fbclid=/.test(lp)) return "facebook";
    var d = l.referrer ? refDomain(l.referrer) : ""; if (d) return d;
    var a = uaApp(l.user_agent); if (a) return a;
    return "Direto / sem origem";
  }
  function origemP(p) { return p.origem || p.utm_source || (p.fbclid ? "facebook" : "(sem origem)"); }

  /* ----------------------------------------------------------- AUTH */
  function showLogin() { $("login").hidden = false; $("dash").hidden = true; }
  function showDash() { $("login").hidden = true; $("dash").hidden = false; }

  async function boot() {
    if (!client) { document.body.innerHTML = "<p style='padding:24px;font:16px sans-serif'>Falha ao carregar o Supabase.</p>"; return; }
    var s = await client.auth.getSession();
    if (s && s.data && s.data.session) { showDash(); load(); } else { showLogin(); }
  }

  $("loginForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = $("loginBtn"), err = $("loginErr");
    err.hidden = true; btn.disabled = true; btn.textContent = "Entrando…";
    var res = await client.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    btn.disabled = false; btn.textContent = "Entrar";
    if (res.error) { err.textContent = "Login inválido: " + res.error.message; err.hidden = false; return; }
    showDash(); load();
  });

  $("logoutBtn").addEventListener("click", async function () { await client.auth.signOut(); showLogin(); });
  $("reloadBtn").addEventListener("click", function () { load({ force: true }); });

  /* ----------------------------------------------------------- JANELA */
  function activeWindow() {
    var fromISO = $("fromDate").value
      ? new Date($("fromDate").value + "T00:00:00").toISOString()
      : new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    // exclusive end: dia seguinte 00:00 se "Até" preenchido; senão null (= agora)
    var toISO = null;
    if ($("toDate").value) {
      var d = new Date($("toDate").value + "T00:00:00");
      d.setDate(d.getDate() + 1);
      toISO = d.toISOString();
    }
    return { fromISO: fromISO, toISO: toISO };
  }
  function windowLabel() {
    var f = $("fromDate").value, t = $("toDate").value;
    if (!f && !t) return "últimas 24h";
    return "de " + (f || "início") + " até " + (t || "agora");
  }

  /* ----------------------------------------------------------- LOAD (RPC first) */
  async function loadOverviewRpc(fromISO, toISO, origin) {
    var payload = { p_from: fromISO };
    if (toISO) payload.p_to = toISO;
    if (origin) payload.p_origin = origin;
    var res = await client.rpc("paizao_quiz_overview", payload);
    if (res.error) return res;
    return { data: res.data, error: null };
  }

  // Fallback: puxa leads em fatias de 1h em paralelo (bem mais rápido que keyset sequencial)
  var LEAD_COLS = "id,created_at,completed,last_step,last_step_slug,last_step_label," +
    "utm_source,landing_path,referrer,user_agent,imc," +
    "q1_idade,q2_foco,q3_rotina,q4_porque,q5_trava,q6_sozinha,q7_deixou,q8_um_ano," +
    "q9_plano,q10_cobrando,q11_comunidade,q12_alimentacao,q13_primeiro,q14_compromisso";
  var PAGE = 1000;
  var CONCURRENCY = 6;

  function hourSlices(fromISO, toISO) {
    var from = new Date(fromISO).getTime();
    var to = toISO ? new Date(toISO).getTime() : Date.now();
    var slices = [];
    var HOUR = 3600 * 1000;
    // alinha pro início da hora
    var t = Math.floor(from / HOUR) * HOUR;
    for (; t < to; t += HOUR) {
      var a = Math.max(t, from);
      var b = Math.min(t + HOUR, to);
      if (a < b) slices.push({ from: new Date(a).toISOString(), to: new Date(b).toISOString() });
    }
    return slices;
  }

  async function fetchSlice(fromISO, toISO) {
    var rows = [], cursor = toISO;
    for (var guard = 0; guard < 50; guard++) {
      var q = client.from("paizao_quiz_leads").select(LEAD_COLS)
        .gte("created_at", fromISO)
        .lt("created_at", cursor)
        .order("created_at", { ascending: false })
        .limit(PAGE);
      var res = await q;
      if (res.error) return { data: rows, error: res.error };
      var batch = res.data || [];
      rows = rows.concat(batch);
      if (batch.length < PAGE) break;
      cursor = batch[batch.length - 1].created_at;
    }
    return { data: rows, error: null };
  }

  async function fetchLeadsParallel(fromISO, toISO, onProgress) {
    var slices = hourSlices(fromISO, toISO);
    var all = [];
    var i = 0;
    async function worker() {
      while (i < slices.length) {
        var idx = i++;
        var s = slices[idx];
        var r = await fetchSlice(s.from, s.to);
        if (r.error) throw r.error;
        all = all.concat(r.data || []);
        if (onProgress) onProgress(all.length, slices.length, idx + 1);
      }
    }
    var workers = [];
    for (var w = 0; w < Math.min(CONCURRENCY, slices.length); w++) workers.push(worker());
    await Promise.all(workers);
    return all;
  }

  async function fetchPurchasesWindow(fromISO, toISO) {
    var rows = [], offset = 0;
    while (offset < 20000) {
      var q = client.from("paizao_purchases").select("*")
        .gte("created_at", fromISO)
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (toISO) q = q.lt("created_at", toISO);
      var res = await q;
      if (res.error) return { data: rows, error: res.error };
      var batch = res.data || [];
      rows = rows.concat(batch);
      if (batch.length < PAGE) break;
      offset += PAGE;
    }
    return { data: rows, error: null };
  }

  // agrega no cliente a partir de linhas brutas (fallback)
  function aggregateClient(leads, purchases, originFilter) {
    var filtered = leads;
    if (originFilter) {
      filtered = leads.filter(function (l) { return origem(l) === originFilter; });
    }
    var pageviews = filtered.length;
    var started = 0, completed = 0;
    var bySlug = {};
    var originsMap = {};
    var answersMap = {}; // q -> { opt: n }
    var QCOLS = [
      "q1_idade","q2_foco","q3_rotina","q4_porque","q5_trava","q6_sozinha",
      "q7_deixou","q8_um_ano","q9_plano","q10_cobrando","q11_comunidade",
      "q12_alimentacao","q13_primeiro","q14_compromisso"
    ];

    filtered.forEach(function (l) {
      if (l.completed) completed++;
      // "iniciou" = tem slug de URL (chegou em alguma etapa; entrada = /pergunta-1)
      var slug = (l.last_step_slug != null && l.last_step_slug !== "")
        ? l.last_step_slug
        : (l.last_step_slug === "" ? "" : null);
      if (slug != null) started++;
      else slug = "(sem etapa)";
      bySlug[slug] = (bySlug[slug] || 0) + 1;
      var o = origem(l);
      originsMap[o] = (originsMap[o] || 0) + 1;
      QCOLS.forEach(function (c) {
        var v = l[c];
        if (v == null || v === "") return;
        if (!answersMap[c]) answersMap[c] = {};
        answersMap[c][v] = (answersMap[c][v] || 0) + 1;
      });
    });

    var funnel = Object.keys(bySlug).map(function (slug) { return { slug: slug, n: bySlug[slug] }; });
    var origins = Object.keys(originsMap).map(function (source) { return { source: source, n: originsMap[source] }; })
      .sort(function (a, b) { return b.n - a.n; });
    var answers = [];
    Object.keys(answersMap).forEach(function (q) {
      Object.keys(answersMap[q]).forEach(function (a) {
        answers.push({ question: q, answer: a, n: answersMap[q][a] });
      });
    });

    var recent = filtered.slice().sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    }).slice(0, 200).map(function (l) {
      var copy = Object.assign({}, l);
      copy.origem = origem(l);
      return copy;
    });

    // sales
    var ps = purchases || [];
    if (originFilter) ps = ps.filter(function (p) { return origemP(p) === originFilter; });
    var approved = ps.filter(isApproved);
    var receita = approved.reduce(function (a, p) { return a + (parseFloat(p.value) || 0); }, 0);
    var byUtm = {};
    approved.forEach(function (p) {
      var k = origemP(p);
      byUtm[k] = (byUtm[k] || 0) + (parseFloat(p.value) || 0);
    });
    var salesByUtm = Object.keys(byUtm).map(function (source) {
      return { source: source, receita: byUtm[source], n: 0 };
    }).sort(function (a, b) { return b.receita - a.receita; });

    return {
      pageviews: pageviews,
      started: started,
      completed: completed,
      funnel: funnel,
      origins: origins,
      answers: answers,
      recent: recent,
      sales: {
        events: ps.length,
        approved: approved.length,
        receita: receita,
        by_utm: salesByUtm,
        recent: ps.slice(0, 100)
      }
    };
  }

  /* ---- Pós-bifurcação: drop na P6 por trilha (Niic secar × Liz outros) ----
     Contagens exactas via head:count (não baixa todas as rows).
     Trilha secar (copy nova + legado) → Niic; demais focos → Liz. */
  var P6_SLUG = "pergunta-6";
  var FOCO_SECAR = [
    "Quero me olhar no espelho e secar de verdade",
    "Emagrecer e secar" // legado
  ];
  var FOCO_LIZ = [
    "Quero curvas e corpo firme",
    "Quero secar e firmar junto",
    "Ganhar massa",
    "Os dois juntos"
  ];

  function slugsAfterP6() {
    var i6 = SLUG_TO_FLOW[P6_SLUG];
    if (i6 == null) return [];
    var d6 = FUNNEL_STEPS[i6].depth;
    var out = [];
    for (var i = 0; i < FUNNEL_STEPS.length; i++) {
      if (FUNNEL_STEPS[i].depth > d6) out.push(FUNNEL_STEPS[i].slug);
    }
    return out;
  }

  async function countLeads(applyFilters) {
    if (!client) return 0;
    var w = activeWindow();
    var q = client.from("paizao_quiz_leads").select("id", { count: "exact", head: true });
    if (w.fromISO) q = q.gte("created_at", w.fromISO);
    if (w.toISO) q = q.lt("created_at", w.toISO);
    if (applyFilters) q = applyFilters(q);
    var res = await q;
    if (res.error) {
      console.warn("[pedro] countLeads:", res.error.message);
      return null;
    }
    return res.count || 0;
  }

  async function loadAbVsl2Stats() {
    // PostgREST: answers->>'ab_vsl2'
    var aAll = await countLeads(function (q) {
      return q.filter("answers->>ab_vsl2", "eq", "A");
    });
    var bAll = await countLeads(function (q) {
      return q.filter("answers->>ab_vsl2", "eq", "B");
    });
    var aOffer = await countLeads(function (q) {
      return q.filter("answers->>ab_vsl2", "eq", "A").eq("last_step_slug", "mini-vsl-2");
    });
    var bOffer = await countLeads(function (q) {
      return q.filter("answers->>ab_vsl2", "eq", "B").eq("last_step_slug", "mini-vsl-2");
    });
    if (aAll == null || bAll == null) return { error: "sem permissão ou falha ao contar" };
    return {
      A: { tagged: aAll || 0, stoppedOffer: aOffer || 0 },
      B: { tagged: bAll || 0, stoppedOffer: bOffer || 0 }
    };
  }

  function renderAbVsl2(stats) {
    var el = $("abVsl2");
    if (!el) return;
    if (!stats) { el.innerHTML = '<p class="muted">carregando…</p>'; return; }
    if (stats.error) {
      el.innerHTML = '<p class="muted">Não deu pra calcular: ' + esc(stats.error) + "</p>";
      return;
    }
    var a = stats.A.tagged || 0;
    var b = stats.B.tagged || 0;
    var tot = a + b;
    var aShare = tot > 0 ? pct(a, tot) : 0;
    var bShare = tot > 0 ? pct(b, tot) : 0;
    var pageviews = (overview && overview._pageviews) || (overview && overview.pageviews) || 0;
    var reachedOffer = (overview && overview._reachedOffer) || 0;
    // % da oferta que caiu em B (hoje force B ≈ 100%)
    var bOfOffer = cvr(b, reachedOffer || tot || 0);
    var bOfPv = cvr(b, pageviews);

    el.innerHTML =
      '<div class="kpis" style="margin-bottom:12px">' +
        kpi("PageViews (quiz)", pageviews, "entrada do funil na janela") +
        kpi("Oferta · tag B (VSL nova)", b, cvrSub(b, pageviews, "do pageview")) +
        kpi("Oferta · tag A (controle)", a, cvrSub(a, pageviews, "do pageview · deve ≈ 0% com force B")) +
        kpi("Share B na oferta", bShare + "%", b + " de " + tot + " com tag A/B · mode force B") +
      "</div>" +
      '<div class="branchp6__grid">' +
        '<div class="branchp6__card branchp6__card--liz">' +
          '<p class="branchp6__h">A · controle</p>' +
          '<p class="branchp6__sub">VSL antiga (vid-6a31dcf2…) — desligada no force B</p>' +
          '<div class="branchp6__row"><span class="branchp6__k">PageViews da variante (viram A)</span>' +
            '<span class="branchp6__v">' + a + "</span></div>" +
          '<div class="branchp6__row"><span class="branchp6__k">Pararam em /mini-vsl-2 com A</span>' +
            '<span class="branchp6__v">' + (stats.A.stoppedOffer || 0) + "</span></div>" +
          '<div class="branchp6__foot">Share: <b>' + aShare + "%</b> · vs pageview: <b>" + cvr(a, pageviews) + "</b></div>" +
        "</div>" +
        '<div class="branchp6__card branchp6__card--niic">' +
          '<p class="branchp6__h">B · teste (ATIVA)</p>' +
          '<p class="branchp6__sub">VSL nova (vid-6a5798cf…) — 100% do tráfego</p>' +
          '<div class="branchp6__row"><span class="branchp6__k">PageViews da variante (viram B)</span>' +
            '<span class="branchp6__v">' + b + "</span></div>" +
          '<div class="branchp6__row"><span class="branchp6__k">Pararam em /mini-vsl-2 com B</span>' +
            '<span class="branchp6__v">' + (stats.B.stoppedOffer || 0) + "</span></div>" +
          '<div class="branchp6__foot">Share: <b>' + bShare + "%</b> · vs pageview: <b>" + bOfPv +
            "</b> · vs oferta total: <b>" + bOfOffer + "</b></div>" +
        "</div>" +
      "</div>" +
      '<p class="muted" style="font-size:12px;margin:8px 0 0">' +
        "PageView da variante = lead que <b>renderizou</b> a oferta com <code>answers.ab_vsl2</code>. " +
        "CVR de venda fica no bloco Kirvano (compras / pageviews e compras / oferta). " +
        "Com <code>force: \"B\"</code>, A deve ficar perto de zero (só sticky antigo ou <code>?vsl2=A</code>)." +
      "</p>";
  }

  async function loadBranchP6Stats() {

    var after = slugsAfterP6();
    // Niic / secar
    var niicVideo = await countLeads(function (q) {
      return q.in("q2_foco", FOCO_SECAR).eq("last_step_slug", "video-niic");
    });
    var niicP6 = await countLeads(function (q) {
      return q.in("q2_foco", FOCO_SECAR).eq("last_step_slug", P6_SLUG);
    });
    var niicPast = after.length
      ? await countLeads(function (q) {
          return q.in("q2_foco", FOCO_SECAR).in("last_step_slug", after);
        })
      : 0;
    // também conta quem parou no vídeo sem q2_foco gravado (edge) — só slug
    var niicVideoSlugOnly = await countLeads(function (q) {
      return q.eq("last_step_slug", "video-niic").or("q2_foco.is.null,q2_foco.eq.");
    });

    // Liz / outros focos
    var lizVideo = await countLeads(function (q) {
      return q.in("q2_foco", FOCO_LIZ).eq("last_step_slug", "video-liz");
    });
    var lizP6 = await countLeads(function (q) {
      return q.in("q2_foco", FOCO_LIZ).eq("last_step_slug", P6_SLUG);
    });
    var lizPast = after.length
      ? await countLeads(function (q) {
          return q.in("q2_foco", FOCO_LIZ).in("last_step_slug", after);
        })
      : 0;
    // video-liz total stops (incl. secar legado antes da bifurcação)
    var lizVideoAll = await countLeads(function (q) {
      return q.eq("last_step_slug", "video-liz");
    });
    var niicVideoAll = await countLeads(function (q) {
      return q.eq("last_step_slug", "video-niic");
    });
    // P6 total por slug (sem filtro de foco) — referência
    var p6All = await countLeads(function (q) {
      return q.eq("last_step_slug", P6_SLUG);
    });

    // se count falhou (null), aborta
    if (niicP6 == null || lizP6 == null) {
      return { error: "sem permissão ou falha ao contar" };
    }

    return {
      niic: {
        stopVideo: niicVideoAll != null ? niicVideoAll : (niicVideo || 0),
        stopVideoTagged: niicVideo || 0,
        stopP6: niicP6 || 0,
        pastP6: niicPast || 0
      },
      liz: {
        stopVideo: lizVideoAll != null ? lizVideoAll : (lizVideo || 0),
        stopVideoTagged: lizVideo || 0,
        stopP6: lizP6 || 0,
        pastP6: lizPast || 0
      },
      p6All: p6All || 0,
      orphanVideoOnly: niicVideoSlugOnly || 0
    };
  }

  function renderBranchP6(stats) {
    var el = $("branchP6");
    if (!el) return;
    if (!stats) {
      el.innerHTML = '<p class="muted">carregando…</p>';
      return;
    }
    if (stats.error) {
      el.innerHTML = '<p class="muted">Não deu pra calcular: ' + esc(stats.error) + "</p>";
      return;
    }

    function card(kind, title, sub, s) {
      var reachedP6 = (s.stopP6 || 0) + (s.pastP6 || 0);
      var dropP6 = reachedP6 > 0 ? pct(s.stopP6, reachedP6) : 0;
      // de quem chegou no bloco pós-vídeo (parou no vídeo + chegou P6+)
      var afterVideoPool = (s.stopVideo || 0) + reachedP6;
      var leftAtP6OfPool = afterVideoPool > 0 ? pct(s.stopP6, afterVideoPool) : 0;
      return (
        '<div class="branchp6__card branchp6__card--' + kind + '">' +
          '<p class="branchp6__h">' + esc(title) + "</p>" +
          '<p class="branchp6__sub">' + esc(sub) + "</p>" +
          '<div class="branchp6__row"><span class="branchp6__k">Pararam no vídeo</span>' +
            '<span class="branchp6__v">' + s.stopVideo + "</span></div>" +
          '<div class="branchp6__row"><span class="branchp6__k">Pararam na <b>Pergunta 6</b></span>' +
            '<span class="branchp6__v branchp6__v--drop">' + s.stopP6 + "</span></div>" +
          '<div class="branchp6__row"><span class="branchp6__k">Passaram da P6</span>' +
            '<span class="branchp6__v branchp6__v--ok">' + s.pastP6 + "</span></div>" +
          '<div class="branchp6__row"><span class="branchp6__k">Chegaram na P6 (pararam + passaram)</span>' +
            '<span class="branchp6__v">' + reachedP6 + "</span></div>" +
          '<div class="branchp6__foot">' +
            'Das que <b>chegaram na P6</b>, <b class="branchp6__v--drop">' + dropP6 + "%</b> saíram nela" +
            " (" + s.stopP6 + " de " + reachedP6 + "). " +
            "Das que passaram do vídeo (vídeo+P6+), <b>" + leftAtP6OfPool + "%</b> ficaram na P6." +
          "</div>" +
        "</div>"
      );
    }

    el.innerHTML =
      '<div class="branchp6__grid">' +
        card(
          "niic",
          "🎬 Trilha Niic",
          "Foco secar (novo + legado) → /video-niic → P6 corpo → /nostalgia…",
          stats.niic
        ) +
        card(
          "liz",
          "🎬 Trilha Liz",
          "Foco curvas / secar+firmar (novo + legado) → /video-liz → P6 → /nostalgia…",
          stats.liz
        ) +
      "</div>" +
      '<p class="muted" style="font-size:12px;margin:4px 0 0">' +
        "Secar = <code>Quero me olhar no espelho e secar de verdade</code> (legado: Emagrecer e secar). " +
        "Liz = curvas / secar e firmar junto (+ legado Ganhar massa / Os dois juntos). " +
        "Depois da P6 vem <code>/nostalgia</code> (q7b). " +
        "Total pararam na P6: <b>" + stats.p6All + "</b>" +
        " · Niic+Liz taggeados na P6: <b>" +
        ((stats.niic.stopP6 || 0) + (stats.liz.stopP6 || 0)) +
        "</b>." +
      "</p>";
  }

  async function load(opts) {
    opts = opts || {};
    var w = activeWindow();
    var origin = $("utmFilter").value || null;
    $("dashSub").textContent = "carregando…";
    $("reloadBtn").disabled = true;
    var t0 = performance.now();
    if ($("branchP6")) $("branchP6").innerHTML = '<p class="muted">carregando bifurcação…</p>';

    try {
      // 1) tenta RPC (rápido) — a menos que saibamos que não existe
      if (_rpcAvailable !== false) {
        $("dashSub").textContent = "agregando no servidor…";
        var rpc = await loadOverviewRpc(w.fromISO, w.toISO, origin);
        if (!rpc.error && rpc.data) {
          _rpcAvailable = true;
          _mode = "rpc";
          overview = rpc.data;
          // se o filtro de utm já veio no servidor, o select precisa das origins
          // (quando origin está setado, origins só tem 1 item — mantém opções anteriores se vazio)
          buildUtmOptions(overview.origins || []);
          render();
          // bifurcação P6 + A/B VSL2 em paralelo (não bloqueia o resto se falhar)
          loadBranchP6Stats().then(renderBranchP6).catch(function (e) {
            renderBranchP6({ error: (e && e.message) || String(e) });
          });
          loadAbVsl2Stats().then(renderAbVsl2).catch(function (e) {
            renderAbVsl2({ error: (e && e.message) || String(e) });
          });
          var ms = Math.round(performance.now() - t0);
          // render() já montou o resumo (pageviews + oferta + CVR); só anexa o tempo
          $("dashSub").textContent = ($("dashSub").textContent || "") + " · servidor " + ms + "ms";
          $("reloadBtn").disabled = false;
          return;
        }
        // função não existe ainda
        if (rpc.error && /could not find the function|PGRST202|does not exist/i.test(rpc.error.message || "")) {
          _rpcAvailable = false;
          console.warn("[pedro] RPC paizao_quiz_overview ausente — usando fallback client. Rode o SQL em supabase/migrations/20260710_paizao_quiz_overview.sql");
        } else if (rpc.error) {
          // outro erro (timeout/auth) — tenta fallback
          console.warn("[pedro] RPC falhou:", rpc.error.message);
          _rpcAvailable = false;
        }
      }

      // 2) fallback: fetch paralelo por hora + agrega no browser
      $("dashSub").textContent = "carregando leads (modo rápido)…";
      var leads = await fetchLeadsParallel(w.fromISO, w.toISO, function (n, total, done) {
        $("dashSub").textContent = "carregando… " + n + " leads · fatia " + done + "/" + total;
      });
      $("dashSub").textContent = "carregando vendas…";
      var pres = await fetchPurchasesWindow(w.fromISO, w.toISO);
      var purchases = (pres && !pres.error && pres.data) ? pres.data : [];

      _mode = "client";
      overview = aggregateClient(leads, purchases, null);
      buildUtmOptions(overview.origins || []);
      // se há filtro de origem, re-agrega
      if (origin) overview = aggregateClient(leads, purchases, origin);
      // guarda leads brutos só pro re-filtro client-side de utm sem re-fetch
      overview._rawLeads = leads;
      overview._rawPurchases = purchases;

      render();
      loadBranchP6Stats().then(renderBranchP6).catch(function (e) {
        renderBranchP6({ error: (e && e.message) || String(e) });
      });
      loadAbVsl2Stats().then(renderAbVsl2).catch(function (e) {
        renderAbVsl2({ error: (e && e.message) || String(e) });
      });
      var ms2 = Math.round(performance.now() - t0);
      $("dashSub").textContent = ($("dashSub").textContent || "") +
        " · client " + ms2 + "ms" +
        (_rpcAvailable === false ? " · ⚠️ rode o SQL da RPC p/ ficar instantâneo" : "");
    } catch (e) {
      console.error(e);
      $("dashSub").textContent = "Erro: " + (e && e.message ? e.message : e);
    }
    $("reloadBtn").disabled = false;
  }

  function buildUtmOptions(origins) {
    var sel = $("utmFilter");
    var current = sel.value;
    sel.querySelectorAll("option:not([value=''])").forEach(function (o) { o.remove(); });
    (origins || []).forEach(function (o) {
      var src = o.source || o;
      if (!src) return;
      var opt = document.createElement("option");
      opt.value = src;
      opt.textContent = src + (o.n != null ? " (" + o.n + ")" : "");
      sel.appendChild(opt);
    });
    // restaura seleção se ainda existir
    if (current) {
      var found = false;
      for (var i = 0; i < sel.options.length; i++) if (sel.options[i].value === current) found = true;
      if (found) sel.value = current;
    }
  }

  // datas → re-busca; utm → re-busca (RPC) ou re-agrega (client)
  ["fromDate", "toDate"].forEach(function (id) {
    $(id).addEventListener("change", function () { load(); });
  });
  $("utmFilter").addEventListener("change", function () {
    if (_mode === "rpc" || _rpcAvailable === true) {
      load();
      return;
    }
    // client: re-agrega sem re-fetch
    if (overview && overview._rawLeads) {
      var origin = $("utmFilter").value || null;
      var base = aggregateClient(overview._rawLeads, overview._rawPurchases || [], origin);
      base._rawLeads = overview._rawLeads;
      base._rawPurchases = overview._rawPurchases;
      overview = base;
      render();
      $("dashSub").textContent = ($("dashSub").textContent || "") + " · filtro local";
    } else {
      load();
    }
  });
  $("clearFilters").addEventListener("click", function () {
    $("fromDate").value = "";
    $("toDate").value = "";
    $("utmFilter").value = "";
    // default: hoje
    $("fromDate").value = new Date().toLocaleDateString("en-CA");
    load();
  });
  (function initDefaultWindow() {
    var el = $("fromDate");
    if (el && !el.value) el.value = new Date().toLocaleDateString("en-CA");
  })();

  /* ----------------------------------------------------------- RENDER
     Retenção por URL (last_step_slug), ordem = FUNNEL_STEPS (fluxo atual).
     Entrada = FUNNEL_STEPS[0] = /pergunta-1 = PageView.
     Bifurcação (video-niic || video-liz): mesmo depth — quem parou num irmão
     NÃO conta como “alcançou” o outro; quem avançou depois conta nos dois
     como “passou do depoimento” só via depth do passo seguinte. */
  function stopsFromFunnel(funnel) {
    var n = FUNNEL_STEPS.length;
    var byStep = [];
    var i;
    for (i = 0; i < n; i++) byStep[i] = 0;
    var unknown = 0;

    (funnel || []).forEach(function (f) {
      var slug = f.slug;
      var count = f.n || 0;
      if (!count) return;
      if (slug == null || slug === "(sem etapa)") {
        unknown += count;
        return;
      }
      if (Object.prototype.hasOwnProperty.call(SLUG_TO_FLOW, slug)) {
        byStep[SLUG_TO_FLOW[slug]] += count;
        return;
      }
      unknown += count;
    });
    return { byStep: byStep, unknown: unknown };
  }

  function reachedFromFunnel(funnel) {
    var n = FUNNEL_STEPS.length;
    var stops = stopsFromFunnel(funnel);
    var byStep = stops.byStep;
    var unknown = stops.unknown;
    var i;

    // max depth
    var maxD = 0;
    for (i = 0; i < n; i++) if ((FUNNEL_STEPS[i].depth || 0) > maxD) maxD = FUNNEL_STEPS[i].depth;

    // por depth: soma de quem PAROU em qualquer step desse depth
    var byDepth = [];
    for (i = 0; i <= maxD; i++) byDepth[i] = 0;
    for (i = 0; i < n; i++) byDepth[FUNNEL_STEPS[i].depth] += byStep[i] || 0;

    // cumulativo por depth (quem parou em d ou depois)
    var reachedDepth = [];
    var acc = 0;
    for (i = maxD; i >= 0; i--) {
      acc += byDepth[i];
      reachedDepth[i] = acc;
    }

    var reached = [];
    for (i = 0; i < n; i++) {
      var st = FUNNEL_STEPS[i];
      var d = st.depth || 0;
      var hasSibling = false;
      var j;
      for (j = 0; j < n; j++) {
        if (j !== i && FUNNEL_STEPS[j].depth === d && FUNNEL_STEPS[j].parallelGroup) {
          hasSibling = true;
          break;
        }
      }
      if (hasSibling && st.parallelGroup) {
        // irmão da bifurcação: pararam AQUI + todo mundo que PASSOU desse depth
        var after = d < maxD ? (reachedDepth[d + 1] || 0) : 0;
        reached[i] = (byStep[i] || 0) + after;
      } else {
        reached[i] = reachedDepth[d] || 0;
      }
    }

    // leads sem slug + desconhecidos entram só no topo (PageView / pergunta-1)
    if (n > 0) {
      reached[0] = (reached[0] || 0) + unknown;
      if (overview && overview.pageviews != null && overview.pageviews > reached[0]) {
        reached[0] = overview.pageviews;
      }
    }
    // expõe paradas (drop no step) pra UI dos vídeos
    reached._byStep = byStep;
    return reached;
  }

  function render() {
    if (!overview) return;
    var reached = reachedFromFunnel(overview.funnel);
    // PageView = leads que abriram o quiz na janela (1 lead = 1 sessão = 1 pageview de entrada)
    var pageviews = overview.pageviews != null
      ? overview.pageviews
      : (reached[0] || 0);
    if (reached[0] && reached[0] > pageviews) pageviews = reached[0];
    // passaram da 1ª URL (saíram de /pergunta-1)
    var pastEntry = reached.length > 1 ? (reached[1] || 0) : pageviews;
    var reachedOffer = reached[OFFER_FLOW] || 0;
    var approved = ((overview.sales || {}).approved) || 0;
    var entryPath = FUNNEL_STEPS[0] ? FUNNEL_STEPS[0].path : "/pergunta-1";

    // guarda denominadores pra A/B e vendas
    overview._pageviews = pageviews;
    overview._reachedOffer = reachedOffer;
    overview._pastEntry = pastEntry;

    $("dashSub").textContent =
      pageviews + " pageviews · " +
      reachedOffer + " na oferta · " +
      approved + " compras · " +
      "CVR " + cvr(approved, pageviews) + " · " +
      windowLabel();

    $("kpis").innerHTML = [
      kpi("PageViews", pageviews, "pessoas que abriram o quiz · " + entryPath),
      kpi("Chegaram na oferta", reachedOffer, cvrSub(reachedOffer, pageviews, "do pageview")),
      kpi("Compras", approved, "vendas aprovadas (Kirvano)"),
      kpi("CVR PageView → Compra", cvr(approved, pageviews), cvrSub(approved, pageviews, "compras / pageviews"))
    ].join("");

    renderSales(pageviews, reachedOffer);
    renderFunnel(reached);
    renderAnswers(overview.answers || []);
    renderTable(overview.recent || []);
  }

  function renderSales(pageviews, reachedOffer) {
    var s = (overview && overview.sales) || {};
    var approved = s.approved || 0;
    var receita = parseFloat(s.receita) || 0;
    var events = s.events || 0;
    var ticket = approved ? receita / approved : 0;
    var pv = pageviews || 0;
    var offer = reachedOffer || 0;

    $("salesSub").textContent =
      events + " eventos · " + approved + " aprovadas · " +
      "ticket " + money(ticket) + " · " +
      "CVR oferta " + cvr(approved, offer) + " · CVR PV " + cvr(approved, pv);

    $("salesKpis").innerHTML = [
      kpi("Compras", approved, "vendas aprovadas na janela"),
      kpi("Receita", money(receita), "ticket médio " + money(ticket)),
      kpi("CVR Oferta → Compra", cvr(approved, offer), cvrSub(approved, offer, "compras / chegaram na oferta")),
      kpi("CVR PageView → Compra", cvr(approved, pv), cvrSub(approved, pv, "compras / pageviews"))
    ].join("");

    var byUtm = s.by_utm || [];
    var max = byUtm.length ? (parseFloat(byUtm[0].receita) || 1) : 1;
    $("salesByUtm").innerHTML = byUtm.map(function (row) {
      var val = parseFloat(row.receita) || 0;
      var w = Math.round((val / (max || 1)) * 100);
      return '<div class="fn"><div class="fn__lbl">' + esc(row.source) + '</div><div class="fn__barwrap"><div class="fn__bar" style="width:' + w + '%"></div></div><div class="fn__num">' + money(val) + '</div></div>';
    }).join("") || '<p class="muted">Sem vendas no filtro atual.</p>';

    var recent = s.recent || [];
    $("salesBody").innerHTML = recent.map(function (p) {
      var when = p.created_at ? new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
      var st = isApproved(p) ? '<span class="ok">aprovada</span>' : esc(p.status || p.event || "—");
      return "<tr><td>" + esc(when) + "</td><td>" + st + "</td><td>" + money(parseFloat(p.value) || 0) + "</td><td>" + esc(origemP(p)) + "</td><td>" + esc(p.utm_campaign || "—") + "</td><td>" + esc(p.email || "—") + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="muted">Nenhuma venda ainda.</td></tr>';
  }

  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="kpi__v">' + esc(value) + '</div><div class="kpi__l">' + esc(label) + '</div><div class="kpi__s">' + esc(sub) + '</div></div>';
  }

  function prevDistinctDepthIndex(i) {
    var d = FUNNEL_STEPS[i] ? FUNNEL_STEPS[i].depth : null;
    for (var k = i - 1; k >= 0; k--) {
      if (FUNNEL_STEPS[k].depth !== d) return k;
    }
    return -1;
  }

  function renderFunnel(reached) {
    var iOffer = OFFER_FLOW;
    var pv = reached[0] || 1;
    var byStep = reached._byStep || [];
    renderRetBars(reached);

    // gargalo = pior retenção step-a-step DEPOIS da entrada (pula irmãos da bifurcação)
    var minRet = 2, minIdx = -1, j;
    for (j = 1; j <= iOffer; j++) {
      var prevI = prevDistinctDepthIndex(j);
      if (prevI < 0) continue;
      // se é irmão (mesmo depth do anterior na lista), não usa como gargalo linear
      if (FUNNEL_STEPS[j].depth === FUNNEL_STEPS[j - 1].depth) continue;
      var pr = reached[prevI] || 0, r = pr > 0 ? (reached[j] || 0) / pr : 1;
      if (r < minRet) { minRet = r; minIdx = j; }
    }

    var rows = [];
    for (var i = 0; i <= iOffer && i < FUNNEL_STEPS.length; i++) {
      var st = FUNNEL_STEPS[i];
      var cum = pct(reached[i], pv);
      var prevI2 = prevDistinctDepthIndex(i);
      var stepPct = i > 0 && prevI2 >= 0 ? pct(reached[i], reached[prevI2] || 1) : 100;
      var stopped = byStep[i] || 0;
      var isBranch = !!(st.parallelGroup && (
        (i > 0 && FUNNEL_STEPS[i - 1].depth === st.depth) ||
        (i + 1 <= iOffer && FUNNEL_STEPS[i + 1] && FUNNEL_STEPS[i + 1].depth === st.depth)
      ));
      // na bifurcação o "drop" que importa = quem PAROU nesse vídeo
      var drop = isBranch
        ? stopped
        : (i > 0 && prevI2 >= 0 ? Math.max(0, (reached[prevI2] || 0) - (reached[i] || 0)) : 0);
      var vid = isVideoStep(st);
      var name = stepTitle(st, i === 0);
      if (st.handle && vid) name = st.label + " (" + st.handle + ") · " + st.path;
      var cls = "rfn" + (i === minIdx ? " fn--bottleneck" : "") + (vid ? " rfn--vid" : "") +
        (isBranch ? " rfn--branch" : "") + (i === 0 ? " rfn--top" : "");
      var numHtml = (reached[i] || 0) + ' <span class="muted">(' + cum + '%)</span>';
      if (isBranch) {
        numHtml += ' <span class="fn__drop" title="pararam neste vídeo">pararam ' + stopped + '</span>';
      } else if (drop > 0) {
        numHtml += ' <span class="fn__drop">−' + drop + '</span>';
      }
      rows.push(
        '<div class="' + cls + '" title="' + esc(st.path) + (isBranch ? " · bifurcação por foco" : "") + '">' +
          '<div class="fn__lbl">' + (vid ? "🎬 " : "") + (isBranch ? "↳ " : "") + esc(name) + '</div>' +
          '<div class="fn__ret">' + stepPct + '%</div>' +
          '<div class="fn__barwrap"><div class="fn__bar" style="width:' + cum + '%"></div></div>' +
          '<div class="fn__num">' + numHtml + '</div>' +
        '</div>'
      );
    }
    $("funnel").innerHTML = rows.join("") || '<p class="muted">Sem etapas no funil.</p>';
  }

  function renderRetBars(reached) {
    var el = $("retCurve"); if (!el) return;
    var iOffer = OFFER_FLOW;
    var pv = reached[0] || 1;
    var byStep = reached._byStep || [];
    var bars = [];
    for (var i = 0; i <= iOffer && i < FUNNEL_STEPS.length; i++) {
      var st = FUNNEL_STEPS[i];
      var frac = (reached[i] || 0) / pv;
      var pctv = Math.round(frac * 1000) / 10;
      var h = Math.max(2, Math.round(frac * 100));
      var vid = isVideoStep(st);
      var isBranch = !!(st.parallelGroup && (
        (i > 0 && FUNNEL_STEPS[i - 1].depth === st.depth) ||
        (i + 1 <= iOffer && FUNNEL_STEPS[i + 1] && FUNNEL_STEPS[i + 1].depth === st.depth)
      ));
      // barras: nome curto (slug) pra caber; title tem o completo
      var shortName = i === 0 ? "P1 · PV" : (st.type === "question"
        ? ("P" + String(st.slug || "").replace("pergunta-", ""))
        : (st.slug === "video-niic" ? "Niic" : st.slug === "video-liz" ? "Liz" : (st.label || st.slug)));
      var fullName = stepTitle(st, i === 0);
      if (st.handle) fullName = (st.label || "") + " " + st.handle + " · " + st.path;
      var stopped = byStep[i] || 0;
      var tip = fullName + " · alcançaram " + (reached[i] || 0) + " (" + pctv + "%)";
      if (isBranch) tip += " · pararam neste vídeo: " + stopped;
      var cls = "rb" + (vid ? " rb--vid" : "") + (isBranch ? " rb--branch" : "") + (i === 0 ? " rb--first" : "");
      bars.push(
        '<div class="' + cls + '" title="' + esc(tip) + '">' +
          '<div class="rb__pct">' + (isBranch ? stopped + "↓" : pctv + "%") + '</div>' +
          '<div class="rb__col"><div class="rb__fill" style="height:' + h + '%"></div></div>' +
          '<div class="rb__name">' + (vid ? "🎬 " : "") + esc(shortName) + '</div>' +
        '</div>'
      );
    }
    el.innerHTML = '<div class="retbars">' + bars.join("") + '</div>';
  }

  // answers: array [{question, answer, n}] da RPC
  function renderAnswers(answerRows) {
    var byQ = {};
    (answerRows || []).forEach(function (row) {
      var q = row.question;
      if (!byQ[q]) byQ[q] = {};
      byQ[q][row.answer] = (byQ[q][row.answer] || 0) + (row.n || 0);
    });

    var out = [];
    QUIZ.forEach(function (s, i) {
      if (s.type !== "question" || !s.id) return;
      var counts = byQ[s.id] || {};
      var answered = Object.keys(counts).reduce(function (a, k) { return a + counts[k]; }, 0);
      if (answered === 0) return;
      var opts = (s.options || []).slice();
      Object.keys(counts).forEach(function (k) { if (opts.indexOf(k) < 0) opts.push(k); });
      var bars = opts.map(function (opt) {
        var c = counts[opt] || 0, w = pct(c, answered);
        return '<div class="ans__row"><div class="ans__opt">' + esc(opt) + '</div>' +
          '<div class="ans__barwrap"><div class="ans__bar" style="width:' + w + '%"></div></div>' +
          '<div class="ans__num">' + c + ' <span class="muted">' + w + '%</span></div></div>';
      }).join("");
      var qTxt = stripHtml(s.question || "");
      // token de data no título: mostra genérico no painel
      qTxt = qTxt.replace(/\{data4semanas\}/g, "…");
      out.push('<div class="ans"><div class="ans__q">' + esc(labelFor(i) + " · " + qTxt) + '</div>' + bars + '</div>');
    });
    $("answers").innerHTML = out.join("") || '<p class="muted">Sem respostas no filtro atual.</p>';
  }

  function abVsl2Of(l) {
    if (!l) return null;
    if (l.answers && l.answers.ab_vsl2) return String(l.answers.ab_vsl2).toUpperCase();
    // fallback: last_step_label grava "… · A" / "… · B" no offer
    var lab = String(l.last_step_label || "");
    var m = lab.match(/(?:^|[·\s])([AB])\s*$/);
    if (m) return m[1];
    if (/\bA\b/.test(lab) && /VSL 2|oferta|mini-vsl/i.test(lab)) return "A";
    if (/\bB\b/.test(lab) && /VSL 2|oferta|mini-vsl/i.test(lab)) return "B";
    return null;
  }

  function renderTable(leads) {
    $("leadsCount").textContent = "(" + (overview.pageviews || leads.length) + " · mostrando " + Math.min(200, leads.length) + ")";
    var rows = (leads || []).slice(0, 200).map(function (l) {
      var when = l.created_at ? new Date(l.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
      // etapa pela URL (fonte da verdade)
      var etapa;
      if (l.last_step_slug != null && l.last_step_slug !== "") {
        var fi = SLUG_TO_FLOW[l.last_step_slug];
        etapa = (fi != null ? FUNNEL_STEPS[fi].label + " · " : "") + "/" + l.last_step_slug;
      } else if (l.last_step_label) {
        etapa = l.last_step_label;
      } else if (l.last_step != null) {
        etapa = labelFor(l.last_step);
      } else {
        etapa = "—";
      }
      var ab = abVsl2Of(l);
      var abCell = ab
        ? '<span class="ok" title="answers.ab_vsl2">VSL2 · ' + esc(ab) + "</span>"
        : '<span class="muted">—</span>';
      return "<tr>" +
        "<td>" + esc(when) + "</td>" +
        "<td>" + esc(l.q1_idade || "—") + "</td>" +
        "<td>" + esc(l.q2_foco || "—") + "</td>" +
        "<td>" + esc(l.imc != null ? l.imc : "—") + "</td>" +
        "<td>" + abCell + "</td>" +
        "<td>" + esc(etapa) + "</td>" +
        "<td>" + (l.completed ? '<span class="ok">✓</span>' : '<span class="muted">—</span>') + "</td>" +
        "<td>" + esc(origem(l)) + "</td>" +
        "</tr>";
    }).join("");
    $("leadsBody").innerHTML = rows || '<tr><td colspan="8" class="muted">Nenhum lead no filtro.</td></tr>';
  }

  boot();
})();
