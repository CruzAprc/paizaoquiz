/* ============================================================================
   PAINEL DO PEDRO — /pedro
   Login via Supabase Auth (email/senha). Lê paizao_quiz_leads (RLS: só autenticado).
   KPIs, funil de drop-off (last_step), distribuição de respostas e tabela de leads.
============================================================================ */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ewnsttmmbcdzchzpxqjb.supabase.co";
  var SUPABASE_KEY = "sb_publishable_mIb6RJkWqC5QESdczkFWng_Oo5O17hi";
  var QUIZ = window.QUIZ || [];

  // ---- mapa de etapas (espelha o roteador do app.js) p/ rotular o funil ----
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
  // slug (= URL da etapa) por tipo — espelha o ROUTE_BY_TYPE do app.js
  var ROUTE_BY_TYPE = {
    landing: "", story: "video-carlao", testimonial: "video-liz", letter: "carta",
    vsl: "mini-vsl-1", measure: "medidas", loading: "montando",
    chart: "diagnostico", offer: "mini-vsl-2"
  };
  function labelFor(i) {
    var s = QUIZ[i]; if (!s) return "etapa " + i;
    if (s.type === "question") { var sl = ROUTE_BY_QID[s.id] || ("etapa-" + i); return "Pergunta " + String(sl).replace("pergunta-", ""); }
    return LABEL_BY_TYPE[s.type] || s.type;
  }
  // slug da etapa i (mesma regra do app.js) -> usado p/ contar o funil pela URL salva
  function slugFor(i) {
    var s = QUIZ[i]; if (!s) return null;
    if (s.type === "question") return (s.id && ROUTE_BY_QID[s.id] != null) ? ROUTE_BY_QID[s.id] : ("etapa-" + i);
    return (ROUTE_BY_TYPE[s.type] != null) ? ROUTE_BY_TYPE[s.type] : ("etapa-" + i);
  }
  // mapa slug(URL) -> índice na etapa ATUAL do quiz. Re-alinha dados antigos cujo
  // last_step numérico ficou defasado por mudanças no array de telas.
  var SLUG_TO_INDEX = {};
  QUIZ.forEach(function (_, i) { SLUG_TO_INDEX[slugFor(i)] = i; });

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var pct = function (n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; };

  var client = null;
  try {
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "paizao_admin_auth" }
    });
  } catch (e) { console.error(e); }

  var allLeads = [];
  var allPurchases = [];
  function isApproved(p) { return /approv|aprovad|paid|pago|complete|SALE_APPROVED/i.test(String(p.event || "") + " " + String(p.status || "")); }
  function money(n) { n = parseFloat(n) || 0; return "R$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ----------------------------------------------------------- ORIGEM (cascata)
     Sem UTM, o navegador não entrega de onde veio o tráfego — mas o referrer e o
     user_agent (já salvos pelo quiz) recuperam a maioria dos casos. Cascata:
     utm_source → domínio do referrer → app do user_agent → "Direto". */
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
    if (l.utm_source) return l.utm_source;
    // recupera da URL de entrada (landing_path): utm_source no parâmetro, ou fbclid (= anúncio Meta)
    var lp = l.landing_path || "";
    var m = lp.match(/[?&]utm_source=([^&]+)/);
    if (m) { try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (e) { return m[1]; } }
    if (/[?&]fbclid=/.test(lp)) return "facebook";
    var d = l.referrer ? refDomain(l.referrer) : ""; if (d) return d;
    var a = uaApp(l.user_agent); if (a) return a;
    return "Direto / sem origem";
  }
  // origem de uma compra (Kirvano): utm_source, senão fbclid -> facebook
  function origemP(p) { return p.utm_source || (p.fbclid ? "facebook" : "(sem origem)"); }

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
  $("reloadBtn").addEventListener("click", function () { load(); });

  /* ----------------------------------------------------------- DADOS
     Pagina via .range() porque o PostgREST corta cada resposta em 1000 linhas
     (config "Max Rows" do projeto). Sem isso, o painel travava em 1000 sessões. */
  var PAGE = 1000, SAFETY_MAX = 100000;
  async function fetchAll(table, onProgress) {
    var rows = [], offset = 0;
    while (offset < SAFETY_MAX) {
      var res = await client.from(table).select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (res.error) return { data: rows, error: res.error };
      var batch = res.data || [];
      rows = rows.concat(batch);
      if (onProgress) onProgress(rows.length);
      if (batch.length < PAGE) break; // última página
      offset += PAGE;
    }
    return { data: rows, error: null };
  }

  async function load() {
    $("dashSub").textContent = "carregando…";
    var res = await fetchAll("paizao_quiz_leads", function (n) { $("dashSub").textContent = "carregando… " + n; });
    if (res.error) { $("dashSub").textContent = "Erro ao ler leads: " + res.error.message; return; }
    allLeads = res.data || [];
    var pres = await fetchAll("paizao_purchases");
    allPurchases = (pres && !pres.error && pres.data) ? pres.data : [];
    buildUtmOptions();
    render();
  }

  function buildUtmOptions() {
    var sel = $("utmFilter"), seen = {};
    sel.querySelectorAll("option:not([value=''])").forEach(function (o) { o.remove(); });
    allLeads.forEach(function (l) { var o = origem(l); if (o) seen[o] = 1; });
    Object.keys(seen).sort().forEach(function (u) {
      var o = document.createElement("option"); o.value = u; o.textContent = u; sel.appendChild(o);
    });
  }

  function applyFilters() {
    var from = $("fromDate").value ? new Date($("fromDate").value + "T00:00:00") : null;
    var to = $("toDate").value ? new Date($("toDate").value + "T23:59:59") : null;
    var utm = $("utmFilter").value;
    return allLeads.filter(function (l) {
      var t = l.created_at ? new Date(l.created_at) : null;
      if (from && t && t < from) return false;
      if (to && t && t > to) return false;
      if (utm && origem(l) !== utm) return false;
      return true;
    });
  }

  ["fromDate", "toDate", "utmFilter"].forEach(function (id) { $(id).addEventListener("change", render); });
  $("clearFilters").addEventListener("click", function () { $("fromDate").value = ""; $("toDate").value = ""; $("utmFilter").value = ""; render(); });

  /* ----------------------------------------------------------- RENDER */
  function render() {
    var leads = applyFilters();
    var total = leads.length;
    var reached = reachedCounts(leads);     // reached[i] = nº com last_step >= i (cumulativo)
    var iOffer = offerIdx();
    var pageviews = total;                   // todos abriram a landing (last_step >= 0)
    var started = reached[1] || 0;           // passaram da landing -> 1ª pergunta
    var reachedOffer = reached[iOffer] || 0; // chegaram na oferta (fundo de funil confiável)
    var completed = leads.filter(function (l) { return l.completed === true; }).length;

    $("dashSub").textContent = pageviews + " pageviews · atualizado agora";

    // KPIs — PageView x Inicialização explícitos
    $("kpis").innerHTML = [
      kpi("PageViews", pageviews, "abriram a landing"),
      kpi("Inicializaram", started, pct(started, pageviews) + "% dos pageviews"),
      kpi("Chegaram na oferta", reachedOffer, pct(reachedOffer, started) + "% dos que iniciaram"),
      kpi("Completaram (flag)", completed, "⚠️ subconta — ver retenção")
    ].join("");

    renderSales(started);
    renderFunnel(reached);
    renderAnswers(leads);
    renderTable(leads);
  }

  function renderSales(startedLeads) {
    var from = $("fromDate").value ? new Date($("fromDate").value + "T00:00:00") : null;
    var to = $("toDate").value ? new Date($("toDate").value + "T23:59:59") : null;
    var utm = $("utmFilter").value;
    var ps = allPurchases.filter(function (p) {
      var t = p.created_at ? new Date(p.created_at) : null;
      if (from && t && t < from) return false;
      if (to && t && t > to) return false;
      if (utm && origemP(p) !== utm) return false;
      return true;
    });
    var approved = ps.filter(isApproved);
    var receita = approved.reduce(function (a, p) { return a + (parseFloat(p.value) || 0); }, 0);
    var ticket = approved.length ? receita / approved.length : 0;

    $("salesSub").textContent = ps.length + " eventos · " + approved.length + " aprovadas";
    $("salesKpis").innerHTML = [
      kpi("Compras", approved.length, "vendas aprovadas"),
      kpi("Receita", money(receita), "soma das aprovadas"),
      kpi("Ticket médio", money(ticket), "por venda"),
      kpi("Conv. de leads", pct(approved.length, startedLeads || 0) + "%", "compras / começaram")
    ].join("");

    var byUtm = {};
    approved.forEach(function (p) { var k = origemP(p); byUtm[k] = (byUtm[k] || 0) + (parseFloat(p.value) || 0); });
    var keys = Object.keys(byUtm).sort(function (a, b) { return byUtm[b] - byUtm[a]; });
    var max = keys.length ? byUtm[keys[0]] : 1;
    $("salesByUtm").innerHTML = keys.map(function (k) {
      var w = Math.round((byUtm[k] / (max || 1)) * 100);
      return '<div class="fn"><div class="fn__lbl">' + esc(k) + '</div><div class="fn__barwrap"><div class="fn__bar" style="width:' + w + '%"></div></div><div class="fn__num">' + money(byUtm[k]) + '</div></div>';
    }).join("") || '<p class="muted">Sem vendas no filtro atual.</p>';

    $("salesBody").innerHTML = ps.slice(0, 100).map(function (p) {
      var when = p.created_at ? new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
      var st = isApproved(p) ? '<span class="ok">aprovada</span>' : esc(p.status || p.event || "—");
      return "<tr><td>" + esc(when) + "</td><td>" + st + "</td><td>" + money(parseFloat(p.value) || 0) + "</td><td>" + esc(origemP(p)) + "</td><td>" + esc(p.utm_campaign || "—") + "</td><td>" + esc(p.email || "—") + "</td></tr>";
    }).join("") || '<tr><td colspan="6" class="muted">Nenhuma venda ainda.</td></tr>';
  }

  function kpi(label, value, sub) {
    return '<div class="kpi"><div class="kpi__v">' + esc(value) + '</div><div class="kpi__l">' + esc(label) + '</div><div class="kpi__s">' + esc(sub) + '</div></div>';
  }

  // índice da tela de oferta (fim do funil)
  var _iOffer = null;
  function offerIdx() {
    if (_iOffer == null) { _iOffer = QUIZ.findIndex(function (s) { return s.type === "offer"; }); if (_iOffer < 0) _iOffer = QUIZ.length - 1; }
    return _iOffer;
  }
  // reached[i] = quantos leads alcançaram pelo menos a etapa i (cumulativo, monotônico)
  // A etapa de cada lead é resolvida pela URL/slug salva (last_step_slug), que é estável
  // mesmo quando telas são add/removidas. Só cai no last_step numérico se faltar o slug.
  function reachedCounts(leads) {
    var n = QUIZ.length, byStep = [], i;
    for (i = 0; i <= n; i++) byStep[i] = 0;
    leads.forEach(function (l) {
      var s = (l.last_step_slug != null && SLUG_TO_INDEX[l.last_step_slug] != null)
        ? SLUG_TO_INDEX[l.last_step_slug]            // re-alinha pela URL (estável)
        : parseInt(l.last_step, 10);                 // fallback: dado antigo sem slug
      if (isNaN(s) || s < 0) s = 0; if (s >= n) s = n - 1;
      byStep[s]++;
    });
    var reached = [], acc = 0;
    for (i = n - 1; i >= 0; i--) { acc += byStep[i]; reached[i] = acc; }
    return reached;
  }
  function isVideoStep(label) { return /Vídeo|VSL|Mini/.test(label); }

  function renderFunnel(reached) {
    var iOffer = offerIdx();
    var pv = reached[0] || 1;                // PageView = 100%
    renderRetBars(reached);

    // gargalo = pior retenção step-a-step DENTRO do quiz (ignora a queda da landing)
    var minRet = 2, minIdx = -1, j;
    for (j = 2; j <= iOffer; j++) {
      var pr = reached[j - 1] || 0, r = pr > 0 ? reached[j] / pr : 1;
      if (r < minRet) { minRet = r; minIdx = j; }
    }

    // detalhe por etapa: % step-a-step (chip) + % acumulado vs pageview (barra)
    var rows = [];
    for (var i = 0; i <= iOffer; i++) {
      var cum = pct(reached[i], pv);
      var step = i > 0 ? pct(reached[i], reached[i - 1] || 1) : 100;
      var drop = i > 0 ? Math.max(0, (reached[i - 1] || 0) - reached[i]) : 0;
      var vid = isVideoStep(labelFor(i));
      var name = i === 0 ? "PageView" : labelFor(i);
      var cls = "rfn" + (i === minIdx ? " fn--bottleneck" : "") + (vid ? " rfn--vid" : "") + (i === 0 ? " rfn--top" : "");
      rows.push(
        '<div class="' + cls + '">' +
          '<div class="fn__lbl">' + (vid ? "🎬 " : "") + esc(name) + '</div>' +
          '<div class="fn__ret">' + step + '%</div>' +
          '<div class="fn__barwrap"><div class="fn__bar" style="width:' + cum + '%"></div></div>' +
          '<div class="fn__num">' + reached[i] + ' <span class="muted">(' + cum + '%)</span>' +
          (drop > 0 ? ' <span class="fn__drop">−' + drop + '</span>' : '') + '</div>' +
        '</div>'
      );
    }
    $("funnel").innerHTML = rows.join("");
  }

  // GRÁFICO DE COLUNAS de retenção — cada etapa uma barra (PageView=100%),
  // com o % em cima e o NOME da etapa embaixo.
  function renderRetBars(reached) {
    var el = $("retCurve"); if (!el) return;
    var iOffer = offerIdx();
    var pv = reached[0] || 1;                 // PageView = 100%
    var bars = [];
    for (var i = 0; i <= iOffer; i++) {
      var frac = (reached[i] || 0) / pv;
      var pctv = Math.round(frac * 1000) / 10;       // 1 casa decimal
      var h = Math.max(2, Math.round(frac * 100));   // altura da coluna (%)
      var vid = isVideoStep(labelFor(i));
      var name = i === 0 ? "PageView" : labelFor(i);
      var cls = "rb" + (vid ? " rb--vid" : "") + (i === 0 ? " rb--first" : "");
      bars.push(
        '<div class="' + cls + '" title="' + esc(name) + ' · ' + reached[i] + ' (' + pctv + '%)">' +
          '<div class="rb__pct">' + pctv + '%</div>' +
          '<div class="rb__col"><div class="rb__fill" style="height:' + h + '%"></div></div>' +
          '<div class="rb__name">' + (vid ? "🎬 " : "") + esc(name) + '</div>' +
        '</div>'
      );
    }
    el.innerHTML = '<div class="retbars">' + bars.join("") + '</div>';
  }

  function renderAnswers(leads) {
    var out = [];
    QUIZ.forEach(function (s, i) {
      if (s.type !== "question" || !s.id) return;
      var counts = {}, answered = 0;
      leads.forEach(function (l) { var v = l[s.id]; if (v != null && v !== "") { counts[v] = (counts[v] || 0) + 1; answered++; } });
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
    $("leadsCount").textContent = "(" + leads.length + ")";
    var rows = leads.slice(0, 200).map(function (l) {
      var when = l.created_at ? new Date(l.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
      var etapa = l.last_step_label || (l.last_step != null ? labelFor(l.last_step) : "—");
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
