/* ============================================================================
   QUIZ DO PAIZÃO — motor de renderização
   Lê window.QUIZ (quiz-data.js) e renderiza tela a tela.
============================================================================ */
(function () {
  "use strict";

  const QUIZ = window.QUIZ || [];
  const stage = document.getElementById("stage");
  const topbar = document.getElementById("topbar");
  const progressWrap = document.getElementById("progress");
  const progressBar = document.getElementById("progressBar");
  const backBtn = document.getElementById("backBtn");
  const qCount = document.getElementById("qCount");

  // total de perguntas (só conta type === "question") p/ a barra de progresso
  const TOTAL_Q = QUIZ.filter(s => s.type === "question").length;

  // snapshot dos parâmetros de entrada (fbclid/utm) — capturado ANTES do roteador
  // limpar a URL, pra encaminhar a atribuição da Meta até o checkout.
  const ENTRY_PARAMS = new URLSearchParams(location.search);
  // querystring de entrada (UTMs/fbclid/gclid/ttclid…) crua. O roteador a re-anexa
  // em TODA escrita de histórico, pra ela NUNCA sumir da barra de endereço.
  const ENTRY_SEARCH = location.search || "";
  // link do checkout (Hotmart/Kiwify). Vazio = mantém o placeholder no final.
  const CHECKOUT_URL = "";

  const state = {
    index: 0,
    answers: {}, // { questionId: optionText }
  };

  /* ========================================================== ROTEADOR (URL limpa)
     Cada tela do funil tem um slug -> URL. A URL acompanha o passo (analytics/pixel,
     botão voltar do navegador, drop-off). Mapa por IDENTIDADE da tela (id da pergunta
     ou type), robusto a reordenação. Hospedagem com SPA fallback (vercel.json). */
  const ROUTE_BY_QID = {
    q1_idade: "pergunta-1", q2_foco: "pergunta-2", q3_rotina: "pergunta-3",
    q4_porque: "pergunta-4", q5_trava: "pergunta-5", q6_sozinha: "pergunta-6",
    q7_deixou: "pergunta-6", q8_um_ano: "pergunta-7", q9_plano: "pergunta-8",
    q10_cobrando: "pergunta-9", q11_comunidade: "pergunta-10", q12_alimentacao: "pergunta-11",
    q13_primeiro: "pergunta-12", q14_compromisso: "pergunta-13",
  };
  const ROUTE_BY_TYPE = {
    landing: "", story: "video-carlao", testimonial: "video-liz", letter: "carta",
    vsl: "mini-vsl-1", measure: "medidas", loading: "montando",
    chart: "diagnostico", offer: "mini-vsl-2",
  };
  const LABEL_BY_TYPE = {
    landing: "Landing", story: "Vídeo Carlão", testimonial: "Vídeo Liz", letter: "Carta",
    vsl: "Mini VSL 1", measure: "Medidas", loading: "Montando plano",
    chart: "Diagnóstico", offer: "Mini VSL 2 (oferta)",
  };
  function slugFor(i) {
    const s = QUIZ[i]; if (!s) return null;
    // slug explícito (ex.: video-niic / video-liz na bifurcação)
    if (s.slug) return s.slug;
    if (s.type === "question") return (s.id && ROUTE_BY_QID[s.id] != null) ? ROUTE_BY_QID[s.id] : ("etapa-" + i);
    return (ROUTE_BY_TYPE[s.type] != null) ? ROUTE_BY_TYPE[s.type] : ("etapa-" + i);
  }
  function labelFor(i) {
    const s = QUIZ[i]; if (!s) return "";
    if (s.label) return s.label;
    if (s.type === "question") { const sl = slugFor(i); return "Pergunta " + String(sl).replace("pergunta-", ""); }
    return LABEL_BY_TYPE[s.type] || s.type;
  }
  const SLUG_TO_INDEX = {};
  QUIZ.forEach((_, i) => { SLUG_TO_INDEX[slugFor(i)] = i; });
  function pathForIndex(i) { return "/" + (slugFor(i) || ""); }
  function indexForPath(path) {
    let p = String(path || "/").replace(/^\/+|\/+$/g, "");
    if (p === "") return 0;
    return Object.prototype.hasOwnProperty.call(SLUG_TO_INDEX, p) ? SLUG_TO_INDEX[p] : null;
  }

  /* Bifurcação de telas: showIf / hideIf batem nas respostas (ex.: q2_foco). */
  function isScreenVisible(s) {
    if (!s) return false;
    if (s.showIf) {
      const keys = Object.keys(s.showIf);
      for (let k = 0; k < keys.length; k++) {
        if (state.answers[keys[k]] !== s.showIf[keys[k]]) return false;
      }
    }
    if (s.hideIf) {
      const keys = Object.keys(s.hideIf);
      for (let k = 0; k < keys.length; k++) {
        if (state.answers[keys[k]] === s.hideIf[keys[k]]) return false;
      }
    }
    return true;
  }
  function nextVisibleIndex(from) {
    let i = from + 1;
    while (i < QUIZ.length && !isScreenVisible(QUIZ[i])) i++;
    return i;
  }
  function prevVisibleIndex(from) {
    let i = from - 1;
    while (i >= 0 && !isScreenVisible(QUIZ[i])) i--;
    return i;
  }
  // se a rota cair numa tela da branch errada, desvia pra irmã visível (mesmo type) ou pula
  function resolveVisibleIndex(i) {
    if (i == null || i < 0) return 0;
    if (i >= QUIZ.length) return QUIZ.length - 1;
    if (isScreenVisible(QUIZ[i])) return i;
    const t = QUIZ[i].type;
    for (let j = 0; j < QUIZ.length; j++) {
      if (QUIZ[j].type === t && isScreenVisible(QUIZ[j])) return j;
    }
    const fwd = nextVisibleIndex(i - 1);
    if (fwd < QUIZ.length) return fwd;
    const back = prevVisibleIndex(i + 1);
    return back >= 0 ? back : 0;
  }

  // persistência da sessão (refresh retoma a etapa; deep-link não-alcançado reinicia)
  const STATE_KEY = "paizao_quiz_state";
  function persist() {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ index: state.index, answers: state.answers })); } catch (e) {}
  }
  function loadPersisted() {
    try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); } catch (e) { return null; }
  }

  // hook de analytics — dispara um "pageview" por etapa (pronto pra pixel/GA)
  function trackRoute(i) {
    const path = pathForIndex(i), label = labelFor(i), s = QUIZ[i];
    try {
      if (window.fbq) {
        window.fbq("trackCustom", "QuizStep", { step: i, slug: slugFor(i), label: label });
        // eventos padrão do funil (browser): completou o quiz e chegou na oferta
        if (s && s.type === "loading") window.fbq("track", "Lead", { content_name: "quiz_completo" });
        else if (s && s.type === "offer") window.fbq("track", "ViewContent", { content_name: "oferta" });
      }
    } catch (e) {}
    try { (window.dataLayer = window.dataLayer || []).push({ event: "quiz_step", step: i, path: path, label: label }); } catch (e) {}
  }

  // prefetch de assets (vídeo da próxima tela) — baixa em baixa prioridade e cacheia,
  // pra o vídeo já estar pronto quando a filhota chegar na tela dele.
  const _prefetched = {};
  function prefetch(url) {
    if (!url || _prefetched[url]) return;
    _prefetched[url] = true;
    try {
      const l = document.createElement("link");
      l.rel = "prefetch"; l.href = url; l.as = "video";
      document.head.appendChild(l);
    } catch (e) {}
  }
  function prefetchUrl(url, as) {
    if (!url || _prefetched[url]) return;
    _prefetched[url] = true;
    try {
      const l = document.createElement("link");
      l.rel = "prefetch"; l.href = url; if (as) l.as = as;
      document.head.appendChild(l);
    } catch (e) {}
  }
  // olha as próximas ~4 telas e adianta o download do vídeo nativo OU dos assets
  // do player (vturb) que vierem — sem pesar na landing/perguntas iniciais.
  /* ---- A/B silencioso (ex.: Mini VSL 2) ---------------------------------
     Sorteio 50/50 sticky em localStorage. A lead nunca vê o nome da variante.
     Forçar no teu teste: ?vsl2=A ou ?vsl2=B (key do abTest).
     abTest.force = "B" manda 100% pra B (ignora sticky) — útil pra rodar só o teste. */
  function pickAbVariant(test) {
    if (!test || !test.variants) return null;
    const key = test.key || "ab";
    const storageKey = "paizao_ab_" + key;
    const variants = test.variants;
    const ids = Object.keys(variants);
    if (!ids.length) return null;

    // 1) querystring (?vsl2=A) — sempre vence (QA / preview)
    try {
      const forced = String(ENTRY_PARAMS.get(key) || ENTRY_PARAMS.get("ab_" + key) || "").toUpperCase();
      if (forced && variants[forced]) {
        try { localStorage.setItem(storageKey, forced); } catch (e) {}
        return forced;
      }
    } catch (e) {}

    // 2) force no config (ex.: 100% B no ar) — sobrescreve sticky antigo
    if (test.force) {
      const forcedId = String(test.force).toUpperCase();
      if (variants[forcedId]) {
        try { localStorage.setItem(storageKey, forcedId); } catch (e) {}
        return forcedId;
      }
    }

    try {
      const cur = localStorage.getItem(storageKey);
      if (cur && variants[cur]) return cur;
    } catch (e) {}

    // 50/50 se A/B; uniforme se tiver mais variantes
    const finalPick = ids.length === 2
      ? (Math.random() < 0.5 ? ids[0] : ids[1])
      : ids[Math.floor(Math.random() * ids.length)];
    try { localStorage.setItem(storageKey, finalPick); } catch (e) {}
    return finalPick;
  }

  function resolveScreen(raw) {
    if (!raw) return raw;
    if (!raw.abTest || !raw.abTest.variants) return raw;
    const id = pickAbVariant(raw.abTest);
    if (!id || !raw.abTest.variants[id]) return raw;
    const conf = raw.abTest.variants[id];
    return Object.assign({}, raw, conf, {
      abKey: raw.abTest.key || "ab",
      abVariant: id,
      abLabel: conf.label || id
    });
  }

  function prefetchUpcomingVideo(fromIndex) {
    let seen = 0;
    for (let i = fromIndex + 1; i < QUIZ.length && seen < 4; i++) {
      const raw = QUIZ[i]; if (!raw || !isScreenVisible(raw)) continue;
      const s = resolveScreen(raw);
      seen++;
      if (s.video) { prefetch(s.video); break; }
      if (s.preload && s.preload.length) { s.preload.forEach(p => prefetchUrl(p.href, p.as)); break; }
    }
  }

  // navegação central: troca a tela, atualiza URL/histórico e persiste
  function go(index, opts) {
    opts = opts || {};
    if (index < 0 || index >= QUIZ.length) return;
    state.index = index;
    persist();
    const path = pathForIndex(index) + ENTRY_SEARCH;
    try {
      if (opts.replace) history.replaceState({ i: index }, "", path);
      else history.pushState({ i: index }, "", path);
    } catch (e) {}
    render();
  }

  /* --------------------------------------------------------- ÍCONES (svg) */
  const ic = {
    check: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" style="vertical-align:-3px"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
    img: '<svg viewBox="0 0 24 24" width="30" height="30" fill="none"><rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="9.5" r="1.8" fill="currentColor"/><path d="M5 18l5-5 4 4 2-2 3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    age: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" stroke="currentColor" stroke-width="1.8"/></svg>',
    food: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3v8M9 3v8M6 11h3M7.5 11v10M16 3c-2 0-3 2-3 5s1 5 3 5m0-10v18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  };

  /* --------------------------------------------------------- HELPERS */
  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* Injeta um embed de terceiros (ex: player VSL/vturb) executando os <script>.
     innerHTML não roda scripts; aqui recriamos cada <script> pra ele executar. */
  function injectEmbed(container, html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    container.appendChild(t.content);
    container.querySelectorAll("script").forEach((old) => {
      const sc = document.createElement("script");
      if (old.src) sc.src = old.src; else sc.textContent = old.textContent;
      if (old.type) sc.type = old.type;
      sc.async = old.async;
      old.replaceWith(sc);
    });
  }

  /* PERSONALIZAÇÃO — resolve as tabelas de PERSONA a partir das respostas dela */
  function persoVal(group, key, fallback) {
    const tbl = (window.PERSONA && window.PERSONA[group]) || {};
    if (key != null && key in tbl) return tbl[key];
    return ("_default" in tbl) ? tbl._default : fallback;
  }
  // troca {foco}, {empatia} e {qID} genérico dentro de qualquer copy
  function fillCopy(str) {
    if (!str) return str;
    return str
      .replace("{foco}", persoVal("foco", state.answers.q2_foco, "mudar de corpo"))
      .replace("{primeiro}", persoVal("primeiro", state.answers.q13_primeiro, "o resultado que você quer"))
      .replace("{empatia}", persoVal("empatia", state.answers.q5_trava || state.answers.q6_sozinha, ""))
      .replace(/\{(q\d+_[a-z]+)\}/g, (_, id) => state.answers[id] || "");
  }

  // calcula IMC + faixa a partir da altura/peso que ela informou (null se faltar dado)
  function imcInfo() {
    const h = parseFloat(state.answers.altura_cm);
    const w = parseFloat(state.answers.peso_kg);
    if (!h || !w || h < 80 || w < 20) return null;
    const m = h / 100;
    const imc = w / (m * m);
    let cat = "saudavel";
    if (imc < 18.5) cat = "abaixo";
    else if (imc < 25) cat = "saudavel";
    else if (imc < 30) cat = "acima";
    else cat = "alto";
    return { imc: Math.round(imc * 10) / 10, cat };
  }

  // bloco de imagem: mostra <img> se carregar, senão placeholder estiloso
  function mediaBlock(src, alt, note, variant) {
    const v = variant || "portrait";
    const wrap = el(`<div class="media media--${v}"></div>`);
    const ph = el(`
      <div class="media__placeholder">
        ${ic.img}
        <span><b>📷 Foto aqui</b>${note ? note : "Suba a imagem em /assets/img"}</span>
      </div>`);
    wrap.appendChild(ph);
    if (src) {
      const img = new Image();
      img.alt = alt || "";
      img.onload = () => { ph.remove(); wrap.appendChild(img); };
      img.src = src;
    }
    return wrap;
  }

  function topbarAvatarFromImage() {
    const av = document.getElementById("brandAvatar");
    if (av) av.classList.add("avatar-photo");
  }

  /* --------------------------------------------------------- CRONÔMETRO 3 MIN
     "SUA AVALIAÇÃO GRATUITA SE ENCERRA EM 03:00" — contagem regressiva real.
     Só visual (não bloqueia o quiz quando chega a zero). */
  function startTimer() {
    const TOTAL = 3 * 60; // 3 minutos
    const valEl = document.getElementById("timerVal");
    const bar = document.getElementById("timerbar");
    if (!valEl) return;
    try { localStorage.removeItem("quizStart6"); } catch (e) {}
    // chave nova: invalida sessão antiga e recomeça os 3 min
    let start = parseInt(localStorage.getItem("quizStart3m"), 10);
    if (!start || isNaN(start)) {
      start = Date.now();
      try { localStorage.setItem("quizStart3m", String(start)); } catch (e) {}
    }
    function paint(left) {
      const m = Math.floor(left / 60), s = left % 60;
      valEl.textContent = String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
      if (bar) bar.classList.toggle("is-urgent", left > 0 && left <= 30);
    }
    function tick() {
      const left = Math.max(0, TOTAL - Math.floor((Date.now() - start) / 1000));
      paint(left);
      if (left <= 0 && window.__qTimer) {
        clearInterval(window.__qTimer);
        window.__qTimer = null;
      }
    }
    if (window.__qTimer) clearInterval(window.__qTimer);
    tick();
    window.__qTimer = setInterval(tick, 1000);
  }

  /* --------------------------------------------------------- CHROME (topbar/progresso) */
  function updateChrome(screen) {
    const isQuestion = screen.type === "question";
    const hideChrome = screen.type === "landing" || screen.type === "loading" || screen.type === "story"
      || screen.story === true || screen.reels === true
      || (screen.type === "testimonial" && (!!screen.embed || !!screen.video));

    topbar.hidden = hideChrome;
    progressWrap.hidden = hideChrome;

    // contador "X/14" REMOVIDO — a lead não deve saber quantas perguntas faltam
    if (qCount) qCount.hidden = true;

    // barra de progresso "fake": enche rápido e parece quase cheia boa parte
    // do tempo (curva front-loaded sobre a posição geral) — NÃO revela 1/14.
    const lastIdx = Math.max(1, QUIZ.length - 1);
    const p = Math.min(1, state.index / lastIdx);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out forte: sensação de progresso veloz
    const pct = Math.round(eased * 100);
    progressBar.style.width = (screen.type === "landing" ? 0 : pct) + "%";

    backBtn.disabled = state.index === 0;
  }

  /* --------------------------------------------------------- RENDER POR TIPO */
  // cancela qualquer timer/animação da tela anterior (ex: stories) ao trocar
  let screenAbort = null;
  function cleanupScreen() { if (screenAbort) { try { screenAbort(); } catch (e) {} screenAbort = null; } }

  function render() {
    cleanupScreen();
    const screen = resolveScreen(QUIZ[state.index]);
    if (!screen) return;
    updateChrome(screen);

    stage.innerHTML = "";
    const root = el('<section class="screen"></section>');

    const map = {
      landing: renderLanding,
      question: renderQuestion,
      letter: renderLetter,
      story: renderStory,
      testimonial: renderTestimonial,
      vsl: renderVsl,
      offer: renderVsl,
      loading: renderLoading,
      measure: renderMeasure,
      chart: renderChart,
    };
    (map[screen.type] || (() => {}))(root, screen);

    // A/B: grava variante no lead (answers.ab_vsl2) — invisível pra filhota
    if (screen.abVariant) {
      const abField = "ab_" + (screen.abKey || "ab");
      state.answers[abField] = screen.abVariant;
      try {
        if (window.PaizaoDB && PaizaoDB.recordAnswer) {
          PaizaoDB.recordAnswer(abField, screen.abVariant, state.answers);
        }
      } catch (e) {}
      try {
        (window.dataLayer = window.dataLayer || []).push({
          event: "quiz_ab",
          ab_key: screen.abKey,
          ab_variant: screen.abVariant,
          step: state.index,
          slug: slugFor(state.index)
        });
      } catch (e) {}
    }

    // rastreia a etapa alcançada (drop-off) + dispara o "pageview" da rota
    // label do offer inclui a variante só no banco (ex.: "Mini VSL 2 (oferta) · A") — não aparece na UI
    const stepLabel = screen.abVariant
      ? (labelFor(state.index) + " · " + screen.abVariant)
      : labelFor(state.index);
    if (window.PaizaoDB && PaizaoDB.recordStep) {
      PaizaoDB.recordStep(state.index, slugFor(state.index), stepLabel);
    }
    trackRoute(state.index);
    // adianta o download do próximo vídeo (Carlão/Liz) pra não travar na hora
    prefetchUpcomingVideo(state.index);

    // quiz concluído: ao chegar no diagnóstico, marca o lead como completed
    if (screen.type === "loading" && window.PaizaoDB) PaizaoDB.complete(state.answers);

    stage.appendChild(root);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function ctaButton(label, onClick, block) {
    const btn = el(`<button class="btn ${block ? "btn--block" : ""}">${label}<span class="arrow">${ic.arrow}</span></button>`);
    btn.addEventListener("click", onClick);
    return btn;
  }

  // CTA flutuante (sticky no rodapé) — acompanha o scroll nas telas de conteúdo alto
  // opts.pulse = "soft" | true → botão com pulso leve de atenção
  function ctaBar(label, onClick, opts) {
    const bar = el('<div class="ctabar"></div>');
    const btn = ctaButton(label, onClick, false);
    if (opts && opts.pulse) {
      btn.classList.add(opts.pulse === "soft" ? "btn--pulse-soft" : "btn--pulse");
    }
    bar.appendChild(btn);
    return bar;
  }

  /* ---- LANDING ---- */
  function renderLanding(root, s) {
    root.classList.add("landing");
    root.appendChild(el(`
      <div class="igprofile">
        <span class="igprofile__av igring avatar-photo" id="landingAv">C</span>
        <div class="igprofile__meta">
          <div class="igprofile__namerow">
            <b>Carlão Personal das Estrelas</b>
            <svg class="verified" viewBox="0 0 24 24" width="17" height="17" aria-label="verificado"><path fill="#3897f0" d="M12 1.5l2.4 1.8 3 .2 1 2.8 2.3 1.9-.9 2.9.9 2.9-2.3 1.9-1 2.8-3 .2L12 22.5l-2.4-1.8-3-.2-1-2.8L3.3 15.8l.9-2.9-.9-2.9 2.3-1.9 1-2.8 3-.2z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.3-3.3 1.1 1.1z"/></svg>
          </div>
          <span class="igprofile__sub"><b>2,1 mi</b> seguidores · @oficial_carlaopersonal</span>
        </div>
      </div>`));
    // avatar landing (foto declarativa via classe)
    root.querySelector("#landingAv").classList.add("avatar-photo");

    root.appendChild(el(`<h1>${s.h1}</h1>`));
    if (s.h2) root.appendChild(el(`<h2 class="landing__h2">${s.h2}</h2>`));

    if (s.transparent) {
      // figura recortada (PNG sem fundo): sem moldura, com brilho atrás,
      // visualmente "em pé" sobre o botão (sincronizada com o CTA)
      const fig = el(`
        <div class="figure">
          <div class="figure__glow"></div>
          <img class="figure__img" src="${s.image}" alt="${s.imageAlt || ""}" width="750" height="1141" fetchpriority="high" decoding="async" />
        </div>`);
      root.appendChild(fig);
    } else {
      root.appendChild(mediaBlock(s.image, s.imageAlt, s.imageNote, "portrait"));
    }

    // CTA flutuante FIXO no rodapé (só na landing): garante o botão SEMPRE na dobra,
    // mesmo no in-app browser do Instagram. Espelha 1:1 a dobra estática do index.html.
    const bar = el('<div class="landing-cta"></div>');
    const landingCta = ctaButton(s.cta, next);
    landingCta.classList.add("btn--pulse"); // pulso pra chamar a ação (velocidade 2)
    const arrowEl = landingCta.querySelector(".arrow");
    if (arrowEl) arrowEl.remove(); // landing: sem seta (botão numa linha só, mais fino)
    bar.appendChild(landingCta);
    if (s.subcta) bar.appendChild(el(`<p class="subcta">${s.subcta}</p>`));
    bar.appendChild(el(`<p class="scarcity">${s.scarcity}</p>`));
    root.appendChild(bar);
  }

  /* ---- QUESTION ---- */
  function renderQuestion(root, s) {
    // (cabeçalho "01 · Sobre você" removido — a pergunta abre direto no título)
    // fillCopy resolve tokens tipo {primeiro} (ex.: q14_compromisso)
    root.appendChild(el(`<h2 class="q__title">${fillCopy(s.question)}</h2>`));
    if (s.image) root.appendChild(mediaBlock(s.image, s.imageAlt, s.imageNote, "wide"));

    // resposta escolhida -> grava + avança (mesmo fluxo pros dois formatos)
    function pick(text, container, btn) {
      state.answers[s.id] = text;
      if (window.PaizaoDB) PaizaoDB.recordAnswer(s.id, text, state.answers);
      container.querySelectorAll(".is-selected").forEach(o => o.classList.remove("is-selected"));
      btn.classList.add("is-selected");
      const up = QUIZ[state.index + 1];
      if (up && (up.video || up.embed)) next();
      else setTimeout(next, 240);
    }

    // formato GRADE (estilo BetterMe): cards 2x2 com foto + faixa de rótulo
    if (s.grid && s.images && s.images.length === s.options.length) {
      const grid = el('<div class="qgrid"></div>');
      s.options.forEach((text, i) => {
        const selected = state.answers[s.id] === text;
        // P1 (e grids): 1ª imagem = LCP (high); demais lazy se não forem as 2 primeiras
        // (idade/foco cabem na dobra — eager nas 2 de cima, lazy nas de baixo).
        const load = i < 2 ? "eager" : "lazy";
        const prio = i === 0 ? ' fetchpriority="high"' : "";
        const card = el(`
          <button type="button" class="qcard ${selected ? "is-selected" : ""}">
            <span class="qcard__imgwrap"><img class="qcard__img" src="${s.images[i]}" alt="${text}" width="420" height="320" loading="${load}" decoding="async"${prio} /></span>
            <span class="qcard__bar">${s.optionPrefix ? s.optionPrefix + " " : ""}${text}<span class="qcard__arrow">${ic.arrow}</span></span>
          </button>`);
        card.addEventListener("click", () => pick(text, grid, card));
        grid.appendChild(card);
      });
      root.appendChild(grid);
      return;
    }

    const opts = el('<div class="opts"></div>');
    s.options.forEach((text) => {
      const selected = state.answers[s.id] === text;
      const opt = el(`
        <button class="opt ${selected ? "is-selected" : ""}">
          <span class="opt__dot">${ic.check}</span>
          <span class="opt__label">${text}</span>
        </button>`);
      opt.addEventListener("click", () => pick(text, opts, opt));
      opts.appendChild(opt);
    });
    root.appendChild(opts);

    // mockups decorativos no espaço vazio abaixo das opções (ex.: telas do app);
    // string = um à esquerda; array = distribui esquerda → direita
    if (s.decor) {
      const srcs = Array.isArray(s.decor) ? s.decor : [s.decor];
      const imgs = srcs.map((src) => `<img src="${src}" alt="" loading="lazy" decoding="async" />`).join("");
      root.appendChild(el(`<div class="q__decor">${imgs}</div>`));
    }
  }

  /* ---- LETTER ---- */
  function renderLetter(root, s) {
    root.classList.add("letter");
    if (s.eyebrow) root.appendChild(el(`<div class="eyebrow">${s.eyebrow}</div>`));
    const card = el('<div class="letter__card"></div>');
    s.paragraphs.forEach(p => card.appendChild(el(`<p>${p}</p>`)));
    if (s.sign) card.appendChild(el(`<div class="letter__sign">${s.sign}</div>`));
    root.appendChild(card);
    if (s.image) root.appendChild(mediaBlock(s.image, s.imageAlt, s.imageNote, "wide"));
    root.appendChild(ctaBar(s.cta, next));
  }

  /* ---- STORY (Break 1 em formato stories: barra enche e passa sozinho) ---- */
  function renderStory(root, s) {
    // player vturb (streaming) em stories full-screen, com auto-avanço no fim
    if (s.embed) { renderEmbedStory(root, s); return; }

    root.classList.add("story");
    const dur = s.duration || 10000;

    // mídia: vídeo se houver, senão placeholder pronto
    let mediaInner;
    if (s.video) {
      mediaInner = `<video id="storyVid" class="story__video" src="${s.video}" autoplay playsinline preload="auto" ${s.poster ? `poster="${s.poster}"` : ""}></video>`;
    } else if (s.embed) {
      mediaInner = s.embed;
    } else {
      mediaInner = `
        <div class="story__placeholder">
          <div class="story__play">${ic.play}</div>
          <div class="story__plabel">SLOT STORIES · vídeo do Carlão (~10s)</div>
          <div class="story__pnote">Solte o .mp4 em <b>video</b> no quiz-data — autoplay mudo, passa sozinho.</div>
        </div>`;
    }

    const frame = el(`
      <div class="story__frame">
        <div class="story__bars"><span class="story__bar"><i id="storyFill"></i></span></div>
        <div class="story__top">
          <span class="story__av igring avatar-photo"></span>
          <div class="story__id"><b>${s.author || "Carlão Personal das Estrelas"}</b><small>${s.handle || "agora"}</small></div>
          <span class="story__skip" aria-hidden="true">${ic.arrow}</span>
        </div>
        <div class="story__media">${mediaInner}</div>
        ${s.video ? "" : `<div class="story__caption">
          ${s.eyebrow ? `<p class="story__kicker">${s.eyebrow}</p>` : ""}
          ${(s.paragraphs || []).map(p => `<p>${p}</p>`).join("")}
          ${s.sign ? `<p class="story__sign">${s.sign}</p>` : ""}
        </div>`}
        ${s.video ? `<button class="story__soundbtn" id="storySound" hidden>
          <span class="story__soundic">🔊</span>
          <span class="story__soundtx">Toque para ativar o som</span>
        </button>` : ""}
        ${s.video ? "" : `<div class="story__hint">toque pra avançar · segure pra pausar</div>`}
      </div>`);
    root.appendChild(frame);

    const fill = frame.querySelector("#storyFill");
    let done = false;
    function advance() { if (done) return; done = true; cleanupScreen(); next(); }

    // ============ STORIES COM VÍDEO: toca com SOM, barra segue o vídeo, avança no fim ============
    if (s.video) {
      const vid = frame.querySelector("#storyVid");
      const sound = frame.querySelector("#storySound");
      if (fill) fill.style.transition = "width .2s linear";

      // toca COM som direto (a lead já interagiu com a página clicando nas respostas);
      // se o navegador bloquear (iOS), toca mudo e mostra o botão central de som.
      vid.muted = false;
      const pp = vid.play();
      if (pp && pp.catch) pp.catch(() => {
        vid.muted = true; vid.play().catch(() => {});
        if (sound) sound.hidden = false;
      });
      if (sound) sound.addEventListener("click", (e) => {
        e.stopPropagation();
        vid.muted = false; vid.play().catch(() => {});
        sound.hidden = true;
      });

      function onTime() {
        if (!vid.duration || !isFinite(vid.duration) || vid.duration <= 0) return;
        if (fill) fill.style.width = (Math.min(1, vid.currentTime / vid.duration) * 100) + "%";
      }
      vid.addEventListener("timeupdate", onTime);
      vid.addEventListener("ended", advance); // 100% automático: acabou -> próxima

      screenAbort = () => { done = true; try { vid.pause(); } catch (e) {} };
      return;
    }

    // ============ SEM VÍDEO: timeline por tempo (comportamento original) ============
    let remaining = dur, startBase = 0, timer = null;
    function schedule(ms) {
      startBase = performance.now();
      if (fill) {
        fill.style.transition = "none";
        requestAnimationFrame(() => {
          fill.style.transition = "width " + ms + "ms linear";
          fill.style.width = "100%";
        });
      }
      timer = setTimeout(advance, ms);
    }
    function pauseTL() {
      if (done || timer == null) return;
      clearTimeout(timer); timer = null;
      remaining = Math.max(0, remaining - (performance.now() - startBase));
      if (fill) { const w = getComputedStyle(fill).width; fill.style.transition = "none"; fill.style.width = w; }
    }
    function resumeTL() { if (!done && timer == null) schedule(remaining); }

    schedule(remaining);
    screenAbort = () => { if (timer) { clearTimeout(timer); timer = null; } };

    let downAt = 0;
    frame.addEventListener("pointerdown", () => { downAt = performance.now(); pauseTL(); });
    frame.addEventListener("pointerup", (e) => {
      if (done) return;
      const dt = performance.now() - downAt;
      if (downAt && dt < 220) {
        const rect = frame.getBoundingClientRect();
        const x = (e.clientX || rect.left + rect.width) - rect.left;
        done = true; cleanupScreen();
        if (x < rect.width * 0.32) back(); else next();
      } else {
        resumeTL();
      }
      downAt = 0;
    });
    frame.addEventListener("pointercancel", () => { resumeTL(); downAt = 0; });
  }

  /* ---- TESTIMONIAL (depoimento da filhota em formato STORIES) ---- */
  function renderTestimonial(root, s) {
    // player vturb (streaming) em stories full-screen, com auto-avanço no fim
    if (s.embed) { renderEmbedStory(root, s); return; }

    root.classList.add("testi");

    // formato STORIES: frame escuro full + @ no topo + vídeo nativo da filhota.
    // A barra de cima enche com o vídeo, toca com som e, ao ACABAR, avança sozinho.
    if (s.video) {
      root.classList.add("testi--story");
      const verified = `<svg class="verified" viewBox="0 0 24 24" width="15" height="15" aria-label="verificado"><path fill="#3897f0" d="M12 1.5l2.4 1.8 3 .2 1 2.8 2.3 1.9-.9 2.9.9 2.9-2.3 1.9-1 2.8-3 .2L12 22.5l-2.4-1.8-3-.2-1-2.8L3.3 15.8l.9-2.9-.9-2.9 2.3-1.9 1-2.8 3-.2z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.3-3.3 1.1 1.1z"/></svg>`;
      const frame = el(`
        <div class="story__frame testi__frame">
          <div class="story__media">
            <video id="testiVid" class="story__video" src="${s.video}" autoplay playsinline preload="auto" ${s.poster ? `poster="${s.poster}"` : ""}></video>
          </div>
          <div class="story__bars"><span class="story__bar"><i id="testiFill"></i></span></div>
          <div class="story__top">
            <span class="story__av igring ${s.avatar || "avatar-liz"}"></span>
            <div class="story__id">
              <b>${s.handle || s.topName || s.author || "aluna"}${verified}</b>
              <small>${s.topSub || "aluna do paizão"}</small>
            </div>
          </div>
          <button class="story__soundbtn" id="testiSound" hidden>
            <span class="story__soundic">🔊</span>
            <span class="story__soundtx">Toque para ativar o som</span>
          </button>
        </div>`);
      root.appendChild(frame);

      const fill = frame.querySelector("#testiFill");
      const vid = frame.querySelector("#testiVid");
      const sound = frame.querySelector("#testiSound");
      let done = false;
      function advance() { if (done) return; done = true; cleanupScreen(); next(); }
      if (fill) fill.style.transition = "width .2s linear";

      // toca COM som direto (a lead já interagiu clicando nas respostas); se o
      // navegador bloquear (iOS), toca mudo e mostra o botão central de som.
      vid.muted = false;
      const pp = vid.play();
      if (pp && pp.catch) pp.catch(() => {
        vid.muted = true; vid.play().catch(() => {});
        if (sound) sound.hidden = false;
      });
      if (sound) sound.addEventListener("click", (e) => {
        e.stopPropagation();
        vid.muted = false; vid.play().catch(() => {});
        sound.hidden = true;
      });

      function onTime() {
        if (!vid.duration || !isFinite(vid.duration) || vid.duration <= 0) return;
        if (fill) fill.style.width = (Math.min(1, vid.currentTime / vid.duration) * 100) + "%";
        if (vid.currentTime > 0 && vid.currentTime >= vid.duration - 0.4) advance();
      }
      vid.addEventListener("timeupdate", onTime);
      vid.addEventListener("ended", advance); // acabou -> próxima pergunta

      screenAbort = () => { done = true; try { vid.pause(); } catch (e) {} };
      return;
    }

    // sem vídeo: slot/placeholder
    if (s.handle) {
      root.appendChild(el(`
        <div class="testi__handle">
          <span class="testi__hav igring avatar-liz"></span>
          <span class="testi__hname">${s.handle}
            <svg class="verified" viewBox="0 0 24 24" width="15" height="15" aria-label="verificado"><path fill="#3897f0" d="M12 1.5l2.4 1.8 3 .2 1 2.8 2.3 1.9-.9 2.9.9 2.9-2.3 1.9-1 2.8-3 .2L12 22.5l-2.4-1.8-3-.2-1-2.8L3.3 15.8l.9-2.9-.9-2.9 2.3-1.9 1-2.8 3-.2z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.3-3.3 1.1 1.1z"/></svg>
          </span>
        </div>`));
    }
    const vbox = el('<div class="testi__video"></div>');
    vbox.appendChild(el(`
      <div class="testi__placeholder">
        <div class="testi__play">${ic.play}</div>
        <div class="testi__plabel">SLOT VÍDEO · depoimento da ${s.author || "aluna"}</div>
        <div class="testi__pnote">Solte o .mp4 dela falando em <b>video</b> no quiz-data.</div>
      </div>`));
    root.appendChild(vbox);
    root.appendChild(ctaBar(s.cta, next));
  }

  /* ---- VSL / OFFER ---- */
  function renderVsl(root, s) {
    // formato POST DE REELS (oferta) — CTA é da própria vturb, sem botão nosso.
    if (s.reels && s.embed) { renderReelsPost(root, s); return; }
    // formato STORIES full-screen (player vturb), SEM botão: avança no fim do vídeo.
    if (s.story && s.embed) { renderEmbedStory(root, s); return; }

    root.classList.add("vsl");
    if (s.trigger) root.appendChild(el(`<p class="vsl__trigger">${s.trigger}</p>`));

    const box = el('<div class="vslbox"></div>');
    if (s.embed) {
      injectEmbed(box, s.embed);
    } else {
      box.appendChild(el(`
        <div class="vslbox__placeholder">
          <div class="vslbox__play">${ic.play}</div>
          <div class="vslbox__label">${s.slotLabel || "VÍDEO"}</div>
          <div class="vslbox__note">${s.slotNote || "Cole o embed do vídeo em screen.embed"}</div>
        </div>`));
    }
    root.appendChild(box);

    const isLast = state.index === QUIZ.length - 1;
    root.appendChild(ctaBar(s.cta, isLast ? finish : next));
  }

  /* ---- POST DE REELS (oferta) — header + vídeo vturb + ações + legenda(H1) ---- */
  function renderReelsPost(root, s) {
    root.classList.add("reels");
    const verified = `<svg class="verified" viewBox="0 0 24 24" width="14" height="14" aria-label="verificado"><path fill="#3897f0" d="M12 1.5l2.4 1.8 3 .2 1 2.8 2.3 1.9-.9 2.9.9 2.9-2.3 1.9-1 2.8-3 .2L12 22.5l-2.4-1.8-3-.2-1-2.8L3.3 15.8l.9-2.9-.9-2.9 2.3-1.9 1-2.8 3-.2z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.3-3.3 1.1 1.1z"/></svg>`;
    const post = el(`
      <article class="reelspost">
        <header class="reelspost__top">
          <span class="reelspost__av igring avatar-photo"></span>
          <div class="reelspost__id"><b>${s.handle || "@oficial_carlaopersonal"} ${verified}</b><small>Patrocinado</small></div>
          <span class="reelspost__more">•••</span>
        </header>
        ${s.h1 ? `<h1 class="reelspost__h1">${s.h1}</h1>` : ""}
        <div class="reelspost__media" id="reelsPlayer"></div>
      </article>`);
    injectEmbed(post.querySelector("#reelsPlayer"), s.embed);
    root.appendChild(post);
    // H1 visível acima; ABAIXO do vídeo fica livre pro botão/CTA da própria vturb.
    // Sem CTA nosso e sem auto-avanço.
  }

  /* ---- STORIES full-screen com player vturb (Liz, Mini VSL 1…), SEM botão.
     Avança NO FIM DE VERDADE do vídeo (sem corte seco):
       1) no TARGET = duração-0.4s (quando a duração é conhecida)
       2) OU quando o currentTime estaciona (vídeo acabou) — fallback que cobre
          duração levemente diferente e nunca deixa travar. ---- */
  function renderEmbedStory(root, s) {
    root.classList.add("testi", "testi--story");
    const avatar = s.avatar || "avatar-photo";
    const topName = s.topName || s.handle || s.author || "Carlão Personal das Estrelas";
    const topSub = s.topSub || (s.handle ? "aluna do paizão" : "agora");
    const verified = s.verified ? `<svg class="verified" viewBox="0 0 24 24" width="14" height="14" aria-label="verificado"><path fill="#3897f0" d="M12 1.5l2.4 1.8 3 .2 1 2.8 2.3 1.9-.9 2.9.9 2.9-2.3 1.9-1 2.8-3 .2L12 22.5l-2.4-1.8-3-.2-1-2.8L3.3 15.8l.9-2.9-.9-2.9 2.3-1.9 1-2.8 3-.2z"/><path fill="#fff" d="M10.6 14.6l-2.2-2.2 1.1-1.1 1.1 1.1 3.3-3.3 1.1 1.1z"/></svg>` : "";
    const frame = el(`
      <div class="story__frame testi__frame">
        <div class="story__media" id="vslPlayer"></div>
        <div class="story__bars"><span class="story__bar"><i id="vslFill"></i></span></div>
        <div class="story__top">
          <span class="story__av igring ${avatar}"></span>
          <div class="story__id"><b>${topName}${verified}</b><small>${topSub}</small></div>
        </div>
      </div>`);
    // snapshot do nº de players ANTES de injetar: o NOSSO é o que será criado agora.
    // (as instâncias da vturb não têm id, então não dá pra casar por id — pegamos a NOVA.)
    const baseCount = (window.smartplayer && window.smartplayer.instances) ? window.smartplayer.instances.length : 0;
    injectEmbed(frame.querySelector("#vslPlayer"), s.embed);
    root.appendChild(frame);

    const fill = frame.querySelector("#vslFill");
    if (fill) fill.style.transition = "width .25s linear";
    const LEN = (typeof s.videoLen === "number" && s.videoLen > 0) ? s.videoLen : null;
    const TARGET = LEN ? Math.max(1, LEN - 0.4) : null; // avança no FIM (sem corte seco)
    let done = false, poll = null, inst = null, maxT = 0, stuck = 0, subscribed = false, seenStart = false;

    function advance() { if (done) return; done = true; cleanupScreen(); next(); }
    // a instância DESTE screen é a recém-adicionada (a última, depois do baseCount)
    function pickInstance() {
      const sp = window.smartplayer;
      if (!sp || !sp.instances || sp.instances.length <= baseCount) return null;
      return sp.instances[sp.instances.length - 1];
    }
    function getCurrent() {
      if (!inst) inst = pickInstance();
      return (inst && inst.video && typeof inst.video.currentTime === "number") ? inst.video.currentTime : null;
    }
    function tick() {
      if (done) return;
      if (!inst) inst = pickInstance();
      if (inst && inst.on && !subscribed) {
        subscribed = true;
        ["ended", "end", "complete", "completed", "finish", "finished", "video_complete"].forEach(ev => { try { inst.on(ev, advance); } catch (e) {} });
      }
      const cur = getCurrent();
      if (cur == null) return;
      if (fill && LEN) fill.style.width = (Math.min(1, cur / LEN) * 100) + "%";
      // só confia na lógica de avanço DEPOIS que o vídeo começou do início (anti-skip)
      if (!seenStart) { if (cur < 2) seenStart = true; else return; }
      if (TARGET && cur >= TARGET) { advance(); return; }
      // fim real por "estacionou" (cobre duração um tico diferente OU desconhecida)
      if (cur > maxT + 0.05) { maxT = cur; stuck = 0; }
      else if (maxT > 5) { stuck++; if (stuck >= 7) advance(); }
    }
    poll = setInterval(tick, 250);
    screenAbort = () => { done = true; if (poll) { clearInterval(poll); poll = null; } };
  }

  /* ---- LOADING — H1 em cima + fotos grandes (5s cada) ---- */
  function renderLoading(root, s) {
    root.classList.add("loading");
    const dots = '<span class="loading__dots"><span>.</span><span>.</span><span>.</span></span>';

    // H1 acima da foto (copy do paizão em batidas)
    const head = el(`<h1 class="loading__h1"></h1>`);
    root.appendChild(head);

    const slides = Array.isArray(s.frameImages) && s.frameImages.length
      ? s.frameImages.slice()
      : ["assets/img/loading/slide-1.jpg"];
    const slideMs = Math.max(1000, parseInt(s.slideMs, 10) || 5000);

    const wrap = el(`
      <div class="loadslide" aria-label="Resultados reais">
        <img class="loadslide__img" src="${slides[0]}" alt="Resultado real de aluna" loading="eager" decoding="async" />
        <div class="loadslide__dots" aria-hidden="true">${
          slides.map((_, i) => `<span class="loadslide__dot${i === 0 ? " is-on" : ""}"></span>`).join("")
        }</div>
      </div>`);
    root.appendChild(wrap);

    const imgEl = wrap.querySelector(".loadslide__img");
    const dotsEl = wrap.querySelectorAll(".loadslide__dot");
    let imgIdx = 0;
    let imgTimer = null;
    if (slides.length > 1 && imgEl) {
      imgTimer = setInterval(() => {
        imgIdx = (imgIdx + 1) % slides.length;
        imgEl.style.opacity = "0";
        setTimeout(() => {
          imgEl.src = slides[imgIdx];
          imgEl.style.opacity = "1";
          dotsEl.forEach((d, i) => d.classList.toggle("is-on", i === imgIdx));
        }, 140);
      }, slideMs);
    }

    const introTxt = persoVal("loadingIntro", state.answers.q2_foco, null) || s.intro || "";
    const textTxt  = persoVal("loadingAge", state.answers.q1_idade, null) || s.text || "";
    const doneTxt  = fillCopy(s.done || "");

    const hasIntro = !!introTxt;
    head.innerHTML = `${hasIntro ? introTxt : textTxt} ${dots}`;

    const timers = [];
    const after = (ms, fn) => timers.push(setTimeout(fn, ms));
    screenAbort = () => {
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (imgTimer) { clearInterval(imgTimer); imgTimer = null; }
    };

    const totalMs = Math.max(s.duration || 0, slides.length * slideMs);
    const introHold = hasIntro ? Math.min(s.introHold || 2500, Math.floor(totalMs / 3)) : 0;
    if (hasIntro && textTxt) after(introHold, () => { head.innerHTML = `${textTxt} ${dots}`; });
    if (doneTxt) after(introHold + Math.floor(totalMs / 3), () => { head.innerHTML = `${doneTxt} ${dots}`; });

    after(totalMs, () => { cleanupScreen(); next(); });
  }

  /* ---- MEASURE (altura + peso -> IMC) ---- */
  function renderMeasure(root, s) {
    root.classList.add("measure");
    if (s.block) root.appendChild(el(`<div class="q__head"><span class="q__block">${s.block}</span></div>`));
    root.appendChild(el(`<h2 class="q__title">${s.question}</h2>`));

    const form = el('<div class="measure__fields"></div>');
    const inputs = {};
    (s.fields || []).forEach(f => {
      const wrap = el(`
        <label class="measure__field">
          <span class="measure__flabel">${f.label}</span>
          <span class="measure__inputwrap">
            <input class="measure__input" type="number" inputmode="numeric" enterkeyhint="next"
                   placeholder="${f.placeholder || ""}" min="${f.min || 0}" max="${f.max || 999}" />
            <span class="measure__unit">${f.unit || ""}</span>
          </span>
        </label>`);
      const input = wrap.querySelector("input");
      if (state.answers[f.id] != null) input.value = state.answers[f.id];
      inputs[f.id] = input;
      form.appendChild(wrap);
    });
    root.appendChild(form);
    if (s.note) {
      // linha extra por trilha de foco (q2_foco) — só se houver match em PERSONA.measureNote
      const extra = persoVal("measureNote", state.answers.q2_foco, null);
      if (extra) {
        root.appendChild(el(`<p class="measure__note">${s.note}<br>${extra}</p>`));
      } else {
        root.appendChild(el(`<p class="measure__note">${s.note}</p>`));
      }
    }

    const err = el(`<p class="measure__err" hidden>Preenche altura e peso certinho 🙏</p>`);
    root.appendChild(err);

    const proceed = () => {
      let ok = true;
      (s.fields || []).forEach(f => {
        const v = parseFloat(inputs[f.id].value);
        if (isNaN(v) || v < (f.min || 0) || v > (f.max || 999)) {
          ok = false; inputs[f.id].classList.add("is-bad");
        } else {
          inputs[f.id].classList.remove("is-bad"); state.answers[f.id] = v;
        }
      });
      if (!ok) { err.hidden = false; return; }
      err.hidden = true;
      const info = imcInfo();
      if (info) state.answers.imc = info.imc;
      if (window.PaizaoDB) PaizaoDB.recordMeasure(state.answers);
      next();
    };

    // Enter no último campo confirma
    Object.values(inputs).forEach(inp => inp.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); proceed(); }
    }));

    root.appendChild(ctaBar(s.cta || "Continuar", proceed));
  }

  /* ---- CHART / DIAGNÓSTICO — before/after BetterMe (IMC dentro do card, sem emoji de meta) ---- */
  function renderChart(root, s) {
    root.classList.add("chart");
    if (s.title) root.appendChild(el(`<h2 class="chart__title">${s.title}</h2>`));

    // marcos da jornada (ex-curva) → copy no before/after
    const points = (s.points || []).map(p => ({ ...p }));
    const trailBubbles = persoVal("chartBubbles", state.answers.q2_foco, null);
    if (trailBubbles && typeof trailBubbles === "object") {
      Object.keys(trailBubbles).forEach((k) => {
        const idx = parseInt(k, 10);
        if (!isNaN(idx) && points[idx] && trailBubbles[k]) points[idx].bubble = trailBubbles[k];
      });
    }
    function spDateLabel(offsetDays) {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const ymd = parts.split("-").map(Number);
      const base = new Date(Date.UTC(ymd[0], ymd[1] - 1, ymd[2]));
      base.setUTCDate(base.getUTCDate() + offsetDays);
      const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      return base.getUTCDate() + " de " + meses[base.getUTCMonth()];
    }
    // tira emoji residual de balões (ex.: 🔥 legado)
    const stripEmoji = (t) => String(t || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "").replace(/\s{2,}/g, " ").trim();
    const p0 = points[0] || {};
    const pGoal = points.find(p => p.gold) || points[points.length - 1] || {};
    const labelNow = "Hoje";
    const labelGoal = pGoal.dateOffset != null ? spDateLabel(pGoal.dateOffset) : (pGoal.label || "4 semaninhas");
    const bubbleNow = stripEmoji(fillCopy(p0.bubble || "você tá aqui"));
    const bubbleGoal = stripEmoji(fillCopy(pGoal.bubble || "{primeiro}"));

    // IMC: frase única dentro do card (sem número solto, sem chip, sem quadro de 5 dias)
    let imcBlock = "";
    if (s.showImc) {
      const info = imcInfo();
      if (info) {
        const imcStr = String(info.imc).replace(".", ",");
        const tpl = persoVal("imc", info.cat, "") || "";
        const msg = tpl.replace(/\{imc\}/g, `<strong>${imcStr}</strong>`);
        if (msg) {
          imcBlock = `
            <div class="ba__imc ba__imc--${info.cat}">
              <p class="ba__imc-phrase">${msg}</p>
            </div>`;
        }
      }
    }

    const beforeSrc = persoVal("beforeImg", state.answers.q7_deixou, "assets/img/corpo/corpo-quilinhos.webp");
    const afterSrc = persoVal("metaImg", state.answers.q2_foco, "assets/img/meta/meta-secar.jpg");
    if (beforeSrc && afterSrc) {
      const bodyNow = persoVal("beforeBodyLabel", state.answers.q7_deixou, "Seu corpo hoje");
      const bodyGoal = persoVal("afterBodyLabel", state.answers.q2_foco, "No seu objetivo");
      const lvlNow = Math.max(0, Math.min(3, parseInt(persoVal("trainLevelNow", state.answers.q3_rotina, 1), 10) || 0));
      const lvlGoal = Math.max(0, Math.min(3, parseInt(persoVal("trainLevelGoal", state.answers.q3_rotina, 3), 10) || 3));
      const bars = (n) => [0, 1, 2].map(i =>
        `<span class="ba__bar${i < n ? " is-on" : ""}"></span>`
      ).join("");
      const arrowSvg = `
        <svg width="18" height="32" viewBox="0 0 27 48" fill="none" aria-hidden="true">
          <path d="M5.3 1L26 22.2c.25.25.42.53.52.83.1.3.16.61.16.95s-.05.65-.16.95c-.1.3-.27.57-.52.82L5.3 47.1C4.72 47.7 4 48 3.14 48c-.86 0-1.6-.32-2.22-.95C.3 46.42 0 45.68 0 44.83c0-.84.31-1.58.92-2.21L19 24 .92 5.38C.35 4.79.06 4.06.06 3.2.06 2.33.37 1.58.99.95 1.6.32 2.32 0 3.14 0c.82 0 1.54.32 2.16.95z" fill="currentColor"/>
        </svg>`;
      root.appendChild(el(`
        <div class="ba" data-test="beforeAfter">
          <div class="ba__labels">
            <div class="ba__labwrap">
              <span class="ba__lab ba__lab--now">Agora</span>
              <span class="ba__date">${labelNow}</span>
            </div>
            <span class="ba__divider" aria-hidden="true"></span>
            <div class="ba__labwrap ba__labwrap--goal">
              <span class="ba__lab ba__lab--goal">Seu objetivo</span>
              <span class="ba__date ba__date--goal">${labelGoal}</span>
            </div>
          </div>
          <div class="ba__photos">
            <div class="ba__shot">
              <img class="ba__img ba__img--before" src="${beforeSrc}" alt="Agora" loading="eager" decoding="async" />
              <p class="ba__cap">${bubbleNow}</p>
            </div>
            <div class="ba__mid" aria-hidden="true">
              <div class="ba__arrows">
                <span class="ba__arrow ba__arrow--1">${arrowSvg}</span>
                <span class="ba__arrow ba__arrow--2">${arrowSvg}</span>
                <span class="ba__arrow ba__arrow--3">${arrowSvg}</span>
              </div>
            </div>
            <div class="ba__shot">
              <img class="ba__img ba__img--after" src="${afterSrc}" alt="Seu objetivo" loading="eager" decoding="async" />
              <p class="ba__cap ba__cap--goal">${bubbleGoal}</p>
            </div>
          </div>
          ${imcBlock}
          <div class="ba__info">
            <div class="ba__row">
              <div class="ba__col">
                <p class="ba__title">Seu corpo</p>
                <p class="ba__value">${bodyNow}</p>
              </div>
              <div class="ba__vdiv" aria-hidden="true"></div>
              <div class="ba__col">
                <p class="ba__title">Seu corpo</p>
                <p class="ba__value ba__value--goal">${bodyGoal}</p>
              </div>
            </div>
            <div class="ba__hr" aria-hidden="true"></div>
            <div class="ba__row">
              <div class="ba__col">
                <p class="ba__title">Nível de treino</p>
                <div class="ba__bars">${bars(lvlNow)}</div>
              </div>
              <div class="ba__vdiv" aria-hidden="true"></div>
              <div class="ba__col">
                <p class="ba__title">Nível de treino</p>
                <div class="ba__bars">${bars(lvlGoal)}</div>
              </div>
            </div>
          </div>
        </div>`));
    } else if (imcBlock) {
      // fallback raro: sem fotos, ainda mostra o termômetro
      root.appendChild(el(`<div class="ba">${imcBlock}</div>`));
    }

    if (s.lead) {
      const lead = fillCopy(s.lead);
      if (lead && lead.trim()) {
        root.appendChild(el(`<div class="chart__note"><span class="chart__note-ic">🧡</span><p>${lead}</p></div>`));
      }
    }

    root.appendChild(ctaBar(s.cta || "RECEBER MINHA AVALIAÇÃO", next, { pulse: "soft" }));
  }

  /* --------------------------------------------------------- NAVEGAÇÃO */
  function next() {
    const i = nextVisibleIndex(state.index);
    if (i < QUIZ.length) go(i);
  }
  // voltar delega pro histórico do navegador (popstate sincroniza a tela pela URL)
  function back() {
    if (state.index > 0) history.back();
  }
  // botão voltar/avançar do navegador -> sincroniza a tela a partir da URL
  window.addEventListener("popstate", function () {
    let i = indexForPath(location.pathname);
    if (i == null) i = 0;
    // loading é transitório: ao cair nele pelo histórico, pula pro diagnóstico
    if (QUIZ[i] && QUIZ[i].type === "loading") i = Math.min(QUIZ.length - 1, i + 1);
    i = resolveVisibleIndex(i);
    state.index = i;
    persist();
    render();
  });
  function finish() {
    // dispara InitiateCheckout (browser pixel) — o checkout dispara o Purchase
    try { if (window.fbq) window.fbq("track", "InitiateCheckout"); } catch (e) {}

    if (CHECKOUT_URL) {
      // preserva as UTMs no redirect pro checkout (trata o "?" já existente no destino)
      var currentParams = window.location.search;
      if (!currentParams) window.location.href = CHECKOUT_URL;
      else if (CHECKOUT_URL.indexOf("?") !== -1) window.location.href = CHECKOUT_URL + "&" + currentParams.substring(1);
      else window.location.href = CHECKOUT_URL + currentParams;
      return;
    }

    // checkout ainda não configurado
    console.log("RESPOSTAS DO QUIZ:", state.answers);
    alert("✅ Diagnóstico concluído!\n\n(Falta plugar o link do checkout em CHECKOUT_URL no app.js.)");
  }

  backBtn.addEventListener("click", back);

  // boot — resolve a etapa a partir da URL
  (function bootIndex() {
    // preview: ?s=N pula direto pra etapa N (só pra conferência de design).
    // Se houver sessão salva, reaproveita as respostas (pra testar personalização).
    const startAt = parseInt(new URLSearchParams(location.search).get("s"), 10);
    if (!isNaN(startAt) && startAt >= 0 && startAt < QUIZ.length) {
      state.index = startAt;
      const savedPrev = loadPersisted();
      if (savedPrev && savedPrev.answers) state.answers = savedPrev.answers;
      return;
    }

    const parsed = indexForPath(location.pathname); // null = rota desconhecida
    const saved = loadPersisted();
    if (parsed == null || parsed === 0) {
      state.index = 0; // raiz ou rota inválida -> começa do início
    } else if (saved && typeof saved.index === "number" && saved.index >= parsed) {
      // refresh no meio do funil: retoma a etapa e as respostas
      state.answers = saved.answers || {};
      state.index = resolveVisibleIndex(parsed);
    } else {
      state.index = 0; // deep-link sem ter chegado lá -> reinicia (integridade do funil)
    }
  })();

  // normaliza a URL pra refletir a etapa real (sem criar entrada no histórico)
  try { history.replaceState({ i: state.index }, "", pathForIndex(state.index) + ENTRY_SEARCH); } catch (e) {}
  topbarAvatarFromImage();
  startTimer();
  render();
})();
