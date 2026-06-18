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
    if (s.type === "question") return (s.id && ROUTE_BY_QID[s.id] != null) ? ROUTE_BY_QID[s.id] : ("etapa-" + i);
    return (ROUTE_BY_TYPE[s.type] != null) ? ROUTE_BY_TYPE[s.type] : ("etapa-" + i);
  }
  function labelFor(i) {
    const s = QUIZ[i]; if (!s) return "";
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
  function prefetchUpcomingVideo(fromIndex) {
    for (let i = fromIndex + 1; i <= fromIndex + 4 && i < QUIZ.length; i++) {
      const s = QUIZ[i]; if (!s) continue;
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
    const path = pathForIndex(index);
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

  /* --------------------------------------------------------- CRONÔMETRO (15 min REAIS) */
  function startTimer() {
    const TOTAL = 15 * 60; // 15 minutos reais
    const valEl = document.getElementById("timerVal");
    const bar = document.getElementById("timerbar");
    if (!valEl) return;
    // persiste o início pra ser um relógio "de verdade" (sobrevive a refresh)
    let start = parseInt(localStorage.getItem("quizStart3"), 10);
    if (!start || isNaN(start)) { start = Date.now(); localStorage.setItem("quizStart3", String(start)); }
    function tick() {
      const left = Math.max(0, TOTAL - Math.floor((Date.now() - start) / 1000));
      const m = Math.floor(left / 60), s = left % 60;
      valEl.textContent = m + ":" + String(s).padStart(2, "0");
      if (bar) bar.classList.toggle("is-urgent", left <= 120); // pisca nos últimos 2 min
      if (left <= 0 && window.__qTimer) clearInterval(window.__qTimer);
    }
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
    const screen = QUIZ[state.index];
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

    // rastreia a etapa alcançada (drop-off) + dispara o "pageview" da rota
    if (window.PaizaoDB && PaizaoDB.recordStep) PaizaoDB.recordStep(state.index, slugFor(state.index), labelFor(state.index));
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
  function ctaBar(label, onClick) {
    const bar = el('<div class="ctabar"></div>');
    bar.appendChild(ctaButton(label, onClick, false));
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

    const landingCta = ctaButton(s.cta, next);
    landingCta.classList.add("btn--pulse"); // pulso pra chamar a ação (velocidade 2)
    root.appendChild(landingCta);
    if (s.subcta) root.appendChild(el(`<p class="subcta">${s.subcta}</p>`));
    root.appendChild(el(`<p class="scarcity">${s.scarcity}</p>`));
  }

  /* ---- QUESTION ---- */
  function renderQuestion(root, s) {
    // nº da pergunta (estilo campo de anamnese)
    let qNum = 0, seen = 0;
    for (let i = 0; i <= state.index; i++) {
      if (QUIZ[i].type === "question") { seen++; if (i === state.index) qNum = seen; }
    }
    const numStr = String(qNum).padStart(2, "0");
    root.appendChild(el(`
      <div class="q__head">
        <span class="q__num">${numStr}</span>
        ${s.block ? `<span class="q__block">${s.block}</span>` : ""}
      </div>`));
    root.appendChild(el(`<h2 class="q__title">${s.question}</h2>`));
    if (s.image) root.appendChild(mediaBlock(s.image, s.imageAlt, s.imageNote, "wide"));

    const opts = el('<div class="opts"></div>');
    s.options.forEach((text) => {
      const selected = state.answers[s.id] === text;
      const opt = el(`
        <button class="opt ${selected ? "is-selected" : ""}">
          <span class="opt__dot">${ic.check}</span>
          <span class="opt__label">${text}</span>
        </button>`);
      opt.addEventListener("click", () => {
        state.answers[s.id] = text;
        // grava no Supabase (resiliente — nunca trava o quiz)
        if (window.PaizaoDB) PaizaoDB.recordAnswer(s.id, text, state.answers);
        // feedback visual e avança
        opts.querySelectorAll(".opt").forEach(o => o.classList.remove("is-selected"));
        opt.classList.add("is-selected");
        // se a próxima tela for um vídeo, avança JÁ (sem delay) pra o play() com
        // som acontecer ainda dentro do clique — senão o navegador bloqueia o áudio.
        const up = QUIZ[state.index + 1];
        if (up && (up.video || up.embed)) next();
        else setTimeout(next, 240);
      });
      opts.appendChild(opt);
    });
    root.appendChild(opts);
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
            <span class="story__av igring avatar-liz"></span>
            <div class="story__id">
              <b>${s.handle || s.author || "Liz Macedo"}${verified}</b>
              <small>filhota do paizão</small>
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
        <div class="testi__plabel">SLOT VÍDEO · depoimento da ${s.author || "filhota"}</div>
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
    const topSub = s.topSub || (s.handle ? "filhota do paizão" : "agora");
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

  /* ---- LOADING (auto-advance) — 3 batidas de headline (NÃO expõe as respostas) ---- */
  function renderLoading(root, s) {
    root.classList.add("loading");
    const dots = '<span class="loading__dots"><span>.</span><span>.</span><span>.</span></span>';
    const head = el(`<p class="loading__text"></p>`);

    root.appendChild(el('<div class="loader"></div>'));
    root.appendChild(head);

    // headline: começa na batida 1 (intro) se houver, senão já na batida 2 (text)
    const hasIntro = !!s.intro;
    head.innerHTML = `${hasIntro ? s.intro : (s.text || "")} ${dots}`;

    const timers = [];
    const after = (ms, fn) => timers.push(setTimeout(fn, ms));
    screenAbort = () => { timers.forEach(clearTimeout); timers.length = 0; };

    const introHold = hasIntro ? (s.introHold || 1500) : 0;

    // batida 2: troca a headline (sem mostrar as respostas — a lead não vê o que preencheu)
    if (hasIntro && s.text) after(introHold, () => { head.innerHTML = `${s.text} ${dots}`; });
    // batida 3: "Pronto. Já tô montando…"
    if (s.done) after(introHold + 1700, () => { head.innerHTML = `${s.done} ${dots}`; });

    after(s.duration || 3600, () => { cleanupScreen(); next(); });
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
    if (s.note) root.appendChild(el(`<p class="measure__note">${s.note}</p>`));

    const err = el(`<p class="measure__err" hidden>Preenche altura e peso certinho, filhota 🙏</p>`);
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

  /* ---- CHART (curva hoje -> 4 -> 12 semaninhas) ---- */
  function renderChart(root, s) {
    root.classList.add("chart");
    root.appendChild(el(`<h2 class="chart__title">${s.title}</h2>`));
    if (s.subtitle) root.appendChild(el(`<p class="chart__sub">${fillCopy(s.subtitle)}</p>`));

    // card do IMC (calculado a partir da altura/peso dela)
    if (s.showImc) {
      const info = imcInfo();
      if (info) {
        const msg = fillCopy(persoVal("imc", info.cat, ""));
        const catLabel = persoVal("imcCat", info.cat, "ponto de partida");
        const imcStr = String(info.imc).replace(".", ",");
        root.appendChild(el(`
          <div class="imc imc--${info.cat}">
            <div class="imc__row">
              <div class="imc__num"><b>${imcStr}</b><small>Termômetro do Paizão</small></div>
              <span class="imc__cat">${catLabel}</span>
            </div>
            ${msg ? `<p class="imc__msg">${msg}</p>` : ""}
          </div>`));
      }
    }

    // clona os pontos e calibra o "Hoje" pela resposta de rotina dela (não muta s.points)
    const points = s.points.map(p => ({ ...p }));
    if (s.startFrom) {
      points[0].level = persoVal("start", state.answers[s.startFrom], points[0].level);
    }

    const W = 320, H = 180, pad = 14;
    const pts = points.map((p, i) => {
      const x = pad + (i * (W - pad * 2)) / (points.length - 1);
      const y = H - pad - p.level * (H - pad * 2);
      return { x, y, ...p };
    });
    const linePath = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
    const areaPath = `${linePath} L${pts[pts.length-1].x.toFixed(1)} ${H-pad} L${pts[0].x.toFixed(1)} ${H-pad} Z`;

    const box = el('<div class="chart__box"></div>');
    box.innerHTML = `
      <svg class="chart__svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="garea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="rgba(124,58,237,.22)"/><stop offset="100%" stop-color="rgba(124,58,237,0)"/>
          </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#garea)" class="cArea"/>
        <path d="${linePath}" fill="none" stroke="#7c3aed" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="cLine"/>
        ${pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5.5" fill="#fff" stroke="#7c3aed" stroke-width="3"/>`).join("")}
      </svg>
      <div class="chart__legend">${points.map(p => `<span>${p.label}</span>`).join("")}</div>`;
    // selos personalizados na curva ("você tá aqui" / "sua meta 🔥")
    if (s.markStart) box.appendChild(el(`<span class="chart__badge chart__badge--start">${fillCopy(s.markStart)}</span>`));
    if (s.markMid) box.appendChild(el(`<span class="chart__badge chart__badge--mid">${fillCopy(s.markMid)}</span>`));
    if (s.markGoal) box.appendChild(el(`<span class="chart__badge chart__badge--goal">${fillCopy(s.markGoal)}</span>`));
    root.appendChild(box);

    // frase de empatia (card destacado, ligada ao que a trava)
    if (s.lead) {
      const lead = fillCopy(s.lead);
      if (lead && lead.trim()) {
        root.appendChild(el(`<div class="chart__note"><span class="chart__note-ic">🧡</span><p>${lead}</p></div>`));
      }
    }

    // anima a linha
    const line = box.querySelector(".cLine");
    if (line) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      line.style.transition = "stroke-dashoffset 1.2s ease .15s";
      requestAnimationFrame(() => requestAnimationFrame(() => { line.style.strokeDashoffset = 0; }));
      const area = box.querySelector(".cArea");
      if (area){ area.style.opacity = 0; area.style.transition = "opacity .8s ease .9s"; requestAnimationFrame(()=>requestAnimationFrame(()=>area.style.opacity=1)); }
    }

    root.appendChild(ctaBar(s.cta, next));
  }

  /* --------------------------------------------------------- NAVEGAÇÃO */
  function next() {
    if (state.index < QUIZ.length - 1) go(state.index + 1);
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
    state.index = i;
    persist();
    render();
  });
  function finish() {
    // dispara InitiateCheckout (browser pixel) — o checkout dispara o Purchase
    try { if (window.fbq) window.fbq("track", "InitiateCheckout"); } catch (e) {}

    if (CHECKOUT_URL) {
      // encaminha fbclid + UTM pro checkout pra Meta casar a COMPRA com o anúncio
      let url;
      try {
        url = new URL(CHECKOUT_URL);
        ["fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach(function (k) {
          const v = ENTRY_PARAMS.get(k); if (v) url.searchParams.set(k, v);
        });
      } catch (e) { url = null; }
      window.location.href = url ? url.toString() : CHECKOUT_URL;
      return;
    }

    // checkout ainda não configurado
    console.log("RESPOSTAS DO QUIZ:", state.answers);
    alert("✅ Diagnóstico concluído!\n\n(Falta plugar o link do checkout em CHECKOUT_URL no app.js.)");
  }

  backBtn.addEventListener("click", back);

  // boot — resolve a etapa a partir da URL
  (function bootIndex() {
    // preview: ?s=N pula direto pra etapa N (só pra conferência de design)
    const startAt = parseInt(new URLSearchParams(location.search).get("s"), 10);
    if (!isNaN(startAt) && startAt >= 0 && startAt < QUIZ.length) { state.index = startAt; return; }

    const parsed = indexForPath(location.pathname); // null = rota desconhecida
    const saved = loadPersisted();
    if (parsed == null || parsed === 0) {
      state.index = 0; // raiz ou rota inválida -> começa do início
    } else if (saved && typeof saved.index === "number" && saved.index >= parsed) {
      // refresh no meio do funil: retoma a etapa e as respostas
      state.answers = saved.answers || {};
      state.index = parsed;
    } else {
      state.index = 0; // deep-link sem ter chegado lá -> reinicia (integridade do funil)
    }
  })();

  // normaliza a URL pra refletir a etapa real (sem criar entrada no histórico)
  try { history.replaceState({ i: state.index }, "", pathForIndex(state.index)); } catch (e) {}
  topbarAvatarFromImage();
  startTimer();
  render();
})();
