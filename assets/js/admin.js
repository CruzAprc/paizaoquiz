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
  var ROUTE_BY_QID = {
    q1_idade: "pergunta-1", q2_foco: "pergunta-2", q3_rotina: "pergunta-3",
    q4_porque: "pergunta-4", q5_trava: "pergunta-5", q6_sozinha: "pergunta-6",
    q7_deixou: "pergunta-6", q8_um_ano: "pergunta-7", q9_plano: "pergunta-8",
    q10_cobrando: "pergunta-9", q11_comunidade: "pergunta-10", q12_alimentacao: "pergunta-11",
    q13_primeiro: "pergunta-12", q14_compromisso: "pergunta-13"
  };
  var LABEL_BY_TYPE = {
    landing: "Landing", story: "Vídeo Carlão", testimonial: "Vídeo Liz", letter: "Carta",
    vsl: "Mini VSL 1", measure: "Medidas", loading: "Montando plano",
    chart: "Diagnóstico", offer: "Mini VSL 2 (oferta)"
  };
  var ROUTE_BY_TYPE = {
    landing: "", story: "video-carlao", testimonial: "video-liz", letter: "carta",
    vsl: "mini-vsl-1", measure: "medidas", loading: "montando",
    chart: "diagnostico", offer: "mini-vsl-2"
  };
  function slugFor(i) {
    var s = QUIZ[i]; if (!s) return null;
    if (s.type === "question") return (s.id && ROUTE_BY_QID[s.id] != null) ? ROUTE_BY_QID[s.id] : ("etapa-" + i);
    return (ROUTE_BY_TYPE[s.type] != null) ? ROUTE_BY_TYPE[s.type] : ("etapa-" + i);
  }
  function labelFor(i) {
    var s = QUIZ[i]; if (!s) return "etapa " + i;
    if (s.type === "question") {
      var sl = slugFor(i) || "";
      return "Pergunta " + String(sl).replace("pergunta-", "");
    }
    return LABEL_BY_TYPE[s.type] || s.type;
  }

  // Ordem do funil = ordem real das telas no QUIZ (fluxo atual), chave = URL/slug.
  // Ex.: [pergunta-1, pergunta-3, pergunta-4, …, video-liz, pergunta-2, …, mini-vsl-2]
  var FUNNEL_STEPS = [];
  var SLUG_TO_FLOW = {}; // slug → índice no FUNNEL_STEPS
  QUIZ.forEach(function (s, i) {
    if (!s) return;
    // landing desativada no QUIZ; se voltar, slug "" = root — ainda entra no funil
    var slug = slugFor(i);
    if (slug == null) return;
    // dedupe: se o mesmo slug aparecer 2x (ex. q6/q7), mantém a 1ª ocorrência no fluxo
    if (Object.prototype.hasOwnProperty.call(SLUG_TO_FLOW, slug)) return;
    var step = {
      slug: slug,
      path: slug === "" ? "/" : ("/" + slug),
      label: labelFor(i),
      type: s.type || "",
      quizIndex: i,
      qid: s.id || null
    };
    SLUG_TO_FLOW[slug] = FUNNEL_STEPS.length;
    FUNNEL_STEPS.push(step);
  });
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
  var pct = function (n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; };

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

  async function load(opts) {
    opts = opts || {};
    var w = activeWindow();
    var origin = $("utmFilter").value || null;
    $("dashSub").textContent = "carregando…";
    $("reloadBtn").disabled = true;
    var t0 = performance.now();

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
          var ms = Math.round(performance.now() - t0);
          $("dashSub").textContent = (overview.pageviews || 0) + " pageviews · " + windowLabel() +
            " · servidor " + ms + "ms";
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
      var ms2 = Math.round(performance.now() - t0);
      $("dashSub").textContent = (overview.pageviews || 0) + " pageviews · " + windowLabel() +
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
      $("dashSub").textContent = (overview.pageviews || 0) + " pageviews · " + windowLabel() + " · filtro local";
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
     Entrada = FUNNEL_STEPS[0] = /pergunta-1 = PageView. */
  function reachedFromFunnel(funnel) {
    var n = FUNNEL_STEPS.length;
    var byStep = [];
    var i;
    for (i = 0; i < n; i++) byStep[i] = 0;
    var unknown = 0;

    (funnel || []).forEach(function (f) {
      var slug = f.slug;
      var count = f.n || 0;
      if (!count) return;
      // normaliza aliases
      if (slug == null || slug === "(sem etapa)") {
        unknown += count;
        return;
      }
      if (Object.prototype.hasOwnProperty.call(SLUG_TO_FLOW, slug)) {
        byStep[SLUG_TO_FLOW[slug]] += count;
        return;
      }
      // slug antigo/desconhecido: não some — conta no topo (pageview)
      unknown += count;
    });

    // cumulativo monotônico: quem parou em i também "alcançou" 0..i
    var reached = [];
    var acc = 0;
    for (i = n - 1; i >= 0; i--) {
      acc += byStep[i];
      reached[i] = acc;
    }
    // leads sem slug + desconhecidos entram só no topo (PageView / pergunta-1)
    if (n > 0) {
      reached[0] = (reached[0] || 0) + unknown;
      // se o total de pageviews do overview for maior (linhas criadas), usa como teto do topo
      if (overview && overview.pageviews != null && overview.pageviews > reached[0]) {
        reached[0] = overview.pageviews;
      }
    }
    return reached;
  }

  function render() {
    if (!overview) return;
    var reached = reachedFromFunnel(overview.funnel);
    var pageviews = reached[0] || overview.pageviews || 0;
    // passaram da 1ª URL (saíram de /pergunta-1)
    var pastEntry = reached.length > 1 ? (reached[1] || 0) : pageviews;
    var reachedOffer = reached[OFFER_FLOW] || 0;
    var completed = overview.completed || 0;
    var entryPath = FUNNEL_STEPS[0] ? FUNNEL_STEPS[0].path : "/pergunta-1";

    $("kpis").innerHTML = [
      kpi("PageViews", pageviews, "entrada " + entryPath),
      kpi("Passaram da P1", pastEntry, pct(pastEntry, pageviews) + "% dos pageviews"),
      kpi("Chegaram na oferta", reachedOffer, pct(reachedOffer, pageviews) + "% dos pageviews"),
      kpi("Completaram (flag)", completed, "⚠️ subconta — ver retenção")
    ].join("");

    renderSales(pastEntry);
    renderFunnel(reached);
    renderAnswers(overview.answers || []);
    renderTable(overview.recent || []);
  }

  function renderSales(startedLeads) {
    var s = (overview && overview.sales) || {};
    var approved = s.approved || 0;
    var receita = parseFloat(s.receita) || 0;
    var events = s.events || 0;
    var ticket = approved ? receita / approved : 0;

    $("salesSub").textContent = events + " eventos · " + approved + " aprovadas";
    $("salesKpis").innerHTML = [
      kpi("Compras", approved, "vendas aprovadas"),
      kpi("Receita", money(receita), "soma das aprovadas"),
      kpi("Ticket médio", money(ticket), "por venda"),
      kpi("Conv. de leads", pct(approved, startedLeads || 0) + "%", "compras / começaram")
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

  function renderFunnel(reached) {
    var iOffer = OFFER_FLOW;
    var pv = reached[0] || 1;
    renderRetBars(reached);

    // gargalo = pior retenção step-a-step DEPOIS da entrada (ignora o 100% do pageview)
    var minRet = 2, minIdx = -1, j;
    for (j = 1; j <= iOffer; j++) {
      var pr = reached[j - 1] || 0, r = pr > 0 ? (reached[j] || 0) / pr : 1;
      if (r < minRet) { minRet = r; minIdx = j; }
    }

    var rows = [];
    for (var i = 0; i <= iOffer && i < FUNNEL_STEPS.length; i++) {
      var st = FUNNEL_STEPS[i];
      var cum = pct(reached[i], pv);
      var stepPct = i > 0 ? pct(reached[i], reached[i - 1] || 1) : 100;
      var drop = i > 0 ? Math.max(0, (reached[i - 1] || 0) - (reached[i] || 0)) : 0;
      var vid = isVideoStep(st);
      var name = stepTitle(st, i === 0);
      var cls = "rfn" + (i === minIdx ? " fn--bottleneck" : "") + (vid ? " rfn--vid" : "") + (i === 0 ? " rfn--top" : "");
      rows.push(
        '<div class="' + cls + '" title="' + esc(st.path) + '">' +
          '<div class="fn__lbl">' + (vid ? "🎬 " : "") + esc(name) + '</div>' +
          '<div class="fn__ret">' + stepPct + '%</div>' +
          '<div class="fn__barwrap"><div class="fn__bar" style="width:' + cum + '%"></div></div>' +
          '<div class="fn__num">' + (reached[i] || 0) + ' <span class="muted">(' + cum + '%)</span>' +
          (drop > 0 ? ' <span class="fn__drop">−' + drop + '</span>' : '') + '</div>' +
        '</div>'
      );
    }
    $("funnel").innerHTML = rows.join("") || '<p class="muted">Sem etapas no funil.</p>';
  }

  function renderRetBars(reached) {
    var el = $("retCurve"); if (!el) return;
    var iOffer = OFFER_FLOW;
    var pv = reached[0] || 1;
    var bars = [];
    for (var i = 0; i <= iOffer && i < FUNNEL_STEPS.length; i++) {
      var st = FUNNEL_STEPS[i];
      var frac = (reached[i] || 0) / pv;
      var pctv = Math.round(frac * 1000) / 10;
      var h = Math.max(2, Math.round(frac * 100));
      var vid = isVideoStep(st);
      // barras: nome curto (slug) pra caber; title tem o completo
      var shortName = i === 0 ? "P1 · PV" : (st.type === "question"
        ? ("P" + String(st.slug || "").replace("pergunta-", ""))
        : (st.label || st.slug));
      var fullName = stepTitle(st, i === 0);
      var cls = "rb" + (vid ? " rb--vid" : "") + (i === 0 ? " rb--first" : "");
      bars.push(
        '<div class="' + cls + '" title="' + esc(fullName) + ' · ' + (reached[i] || 0) + ' (' + pctv + '%)">' +
          '<div class="rb__pct">' + pctv + '%</div>' +
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
      out.push('<div class="ans"><div class="ans__q">' + esc(labelFor(i) + " · " + s.question) + '</div>' + bars + '</div>');
    });
    $("answers").innerHTML = out.join("") || '<p class="muted">Sem respostas no filtro atual.</p>';
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
      return "<tr>" +
        "<td>" + esc(when) + "</td>" +
        "<td>" + esc(l.q1_idade || "—") + "</td>" +
        "<td>" + esc(l.q2_foco || "—") + "</td>" +
        "<td>" + esc(l.imc != null ? l.imc : "—") + "</td>" +
        "<td>" + esc(etapa) + "</td>" +
        "<td>" + (l.completed ? '<span class="ok">✓</span>' : '<span class="muted">—</span>') + "</td>" +
        "<td>" + esc(origem(l)) + "</td>" +
        "</tr>";
    }).join("");
    $("leadsBody").innerHTML = rows || '<tr><td colspan="7" class="muted">Nenhum lead no filtro.</td></tr>';
  }

  boot();
})();
