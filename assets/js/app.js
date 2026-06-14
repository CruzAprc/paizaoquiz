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

  const state = {
    index: 0,
    answers: {}, // { questionId: optionText }
  };

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

  /* --------------------------------------------------------- CRONÔMETRO (15 min) */
  function startTimer() {
    const TOTAL = 15 * 60; // segundos
    const valEl = document.getElementById("timerVal");
    const bar = document.getElementById("timerbar");
    if (!valEl) return;
    // persiste o início pra ser um relógio "de verdade" (sobrevive a refresh)
    let start = parseInt(localStorage.getItem("quizStart"), 10);
    if (!start || isNaN(start)) { start = Date.now(); localStorage.setItem("quizStart", String(start)); }
    function tick() {
      const left = Math.max(0, TOTAL - Math.floor((Date.now() - start) / 1000));
      const m = Math.floor(left / 60), s = left % 60;
      valEl.textContent = m + ":" + String(s).padStart(2, "0");
      if (bar) bar.classList.toggle("is-urgent", left <= 120);
      if (left <= 0 && window.__qTimer) clearInterval(window.__qTimer);
    }
    tick();
    window.__qTimer = setInterval(tick, 1000);
  }

  /* --------------------------------------------------------- CHROME (topbar/progresso) */
  function updateChrome(screen) {
    const isQuestion = screen.type === "question";
    const hideChrome = screen.type === "landing" || screen.type === "loading" || screen.type === "story";

    topbar.hidden = hideChrome;
    progressWrap.hidden = hideChrome;

    // posição da pergunta atual entre as perguntas
    let qIndex = 0, seen = 0;
    for (let i = 0; i <= state.index; i++) {
      if (QUIZ[i].type === "question") { seen++; if (i === state.index) qIndex = seen; }
    }
    if (isQuestion) {
      qCount.textContent = `${qIndex}/${TOTAL_Q}`;
      qCount.hidden = false;
    } else {
      qCount.hidden = true;
    }

    // barra: progresso baseado em perguntas respondidas até aqui
    let answeredish = 0;
    for (let i = 0; i < state.index; i++) if (QUIZ[i].type === "question") answeredish++;
    if (isQuestion) answeredish += 0.5;
    const pct = Math.min(100, (answeredish / TOTAL_Q) * 100);
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
      mirror: renderMirror,
      chart: renderChart,
    };
    (map[screen.type] || (() => {}))(root, screen);

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

    if (s.transparent) {
      // figura recortada (PNG sem fundo): sem moldura, com brilho atrás,
      // visualmente "em pé" sobre o botão (sincronizada com o CTA)
      const fig = el(`
        <div class="figure">
          <div class="figure__glow"></div>
          <img class="figure__img" src="${s.image}" alt="${s.imageAlt || ""}" />
        </div>`);
      root.appendChild(fig);
    } else {
      root.appendChild(mediaBlock(s.image, s.imageAlt, s.imageNote, "portrait"));
    }

    root.appendChild(ctaButton(s.cta, next));
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
        // feedback visual e avança
        opts.querySelectorAll(".opt").forEach(o => o.classList.remove("is-selected"));
        opt.classList.add("is-selected");
        setTimeout(next, 240);
      });
      opts.appendChild(opt);
    });
    root.appendChild(opts);

    if (s.needsReview) {
      root.appendChild(el(`<p class="reviewflag">⚠️ Q4: a copy original veio truncada — estas 4 opções foram reconstruídas conforme o dado plantado. Me confirma o texto certo.</p>`));
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

  /* ---- STORY (Break 1 em formato stories: ~10s e passa sozinho) ---- */
  function renderStory(root, s) {
    root.classList.add("story");
    const dur = s.duration || 10000;

    // mídia: vídeo se houver, senão placeholder pronto
    let mediaInner;
    if (s.video) {
      mediaInner = `<video class="story__video" src="${s.video}" autoplay muted playsinline ${s.poster ? `poster="${s.poster}"` : ""}></video>`;
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
        <div class="story__caption">
          ${s.eyebrow ? `<p class="story__kicker">${s.eyebrow}</p>` : ""}
          ${(s.paragraphs || []).map(p => `<p>${p}</p>`).join("")}
          ${s.sign ? `<p class="story__sign">${s.sign}</p>` : ""}
        </div>
        <div class="story__hint">toque pra avançar · segure pra pausar</div>
      </div>`);
    root.appendChild(frame);

    // ---- timeline do stories (setTimeout + transição CSS, com pausa) ----
    const fill = frame.querySelector("#storyFill");
    let remaining = dur, startBase = 0, timer = null, done = false;

    function schedule(ms) {
      startBase = performance.now();
      if (fill) {
        fill.style.transition = "none";
        // largura atual já está aplicada; agora anima até 100% no tempo restante
        requestAnimationFrame(() => {
          fill.style.transition = "width " + ms + "ms linear";
          fill.style.width = "100%";
        });
      }
      timer = setTimeout(advance, ms);
    }
    function advance() { if (done) return; done = true; cleanupScreen(); next(); }
    function pauseTL() {
      if (done || timer == null) return;
      clearTimeout(timer); timer = null;
      remaining = Math.max(0, remaining - (performance.now() - startBase));
      if (fill) { const w = getComputedStyle(fill).width; fill.style.transition = "none"; fill.style.width = w; }
    }
    function resumeTL() { if (!done && timer == null) schedule(remaining); }

    schedule(remaining);
    // cancela ao sair da tela
    screenAbort = () => { if (timer) { clearTimeout(timer); timer = null; } };

    // ---- interação estilo stories: tap avança/volta, segurar pausa ----
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

  /* ---- TESTIMONIAL ---- */
  function renderTestimonial(root, s) {
    root.classList.add("testi");
    root.appendChild(mediaBlock(s.image, s.imageAlt, s.imageNote, "portrait"));
    root.appendChild(el(`<p class="testi__quote">${s.quote}</p>`));
    const author = el(`
      <div class="testi__author">
        <span class="av">${(s.author||"?")[0]}</span>
        <div><b>${s.author}</b><small>${s.authorTag||""}</small></div>
      </div>`);
    root.appendChild(author);
    root.appendChild(ctaBar(s.cta, next));
  }

  /* ---- VSL / OFFER ---- */
  function renderVsl(root, s) {
    root.classList.add("vsl");
    if (s.trigger) root.appendChild(el(`<p class="vsl__trigger">${s.trigger}</p>`));

    const box = el('<div class="vslbox"></div>');
    if (s.embed) {
      box.innerHTML = s.embed;
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

  /* ---- LOADING (auto-advance) ---- */
  function renderLoading(root, s) {
    root.classList.add("loading");
    root.appendChild(el('<div class="loader"></div>'));
    root.appendChild(el(`<p class="loading__text">${s.text} <span class="loading__dots"><span>.</span><span>.</span><span>.</span></span></p>`));
    setTimeout(next, s.duration || 3200);
  }

  /* ---- MIRROR (repete respostas reais) ---- */
  function renderMirror(root, s) {
    root.classList.add("mirror");
    root.appendChild(el(`<h2 class="mirror__title">${s.title}</h2>`));
    const rowsWrap = el('<div class="mirror__rows"></div>');
    const icons = { "idade": ic.age, "foco em": ic.target, "alimentação": ic.food };
    s.rows.forEach(r => {
      const val = state.answers[r.from] || "—";
      rowsWrap.appendChild(el(`
        <div class="mirror__row">
          <span class="mirror__icon">${icons[r.label] || ic.target}</span>
          <div><small>${r.label}</small><b>${val}</b></div>
        </div>`));
    });
    root.appendChild(rowsWrap);
    root.appendChild(el(`<p class="mirror__footer">${s.footer}</p>`));
    root.appendChild(ctaBar(s.cta, next));
  }

  /* ---- CHART (curva hoje -> 4 -> 12 semaninhas) ---- */
  function renderChart(root, s) {
    root.classList.add("chart");
    root.appendChild(el(`<h2 class="chart__title">${s.title}</h2>`));
    if (s.subtitle) root.appendChild(el(`<p class="chart__sub">${s.subtitle}</p>`));

    const W = 320, H = 180, pad = 14;
    const pts = s.points.map((p, i) => {
      const x = pad + (i * (W - pad * 2)) / (s.points.length - 1);
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
      <div class="chart__legend">${s.points.map(p => `<span>${p.label}</span>`).join("")}</div>`;
    root.appendChild(box);

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
    if (state.index < QUIZ.length - 1) {
      state.index++;
      render();
    }
  }
  function back() {
    if (state.index > 0) {
      state.index--;
      // pula loading ao voltar (não faz sentido re-rodar)
      if (QUIZ[state.index] && QUIZ[state.index].type === "loading" && state.index > 0) state.index--;
      render();
    }
  }
  function finish() {
    // ponto de integração: enviar respostas / redirecionar pro checkout
    console.log("RESPOSTAS DO QUIZ:", state.answers);
    alert("✅ Diagnóstico concluído!\n\n(Aqui entra o redirecionamento pro checkout / app do paizão.)\n\nRespostas capturadas no console.");
  }

  backBtn.addEventListener("click", back);

  // boot
  // preview: abrir ?s=N pula direto pra etapa N (só pra conferência de design)
  const startAt = parseInt(new URLSearchParams(location.search).get("s"), 10);
  if (!isNaN(startAt) && startAt >= 0 && startAt < QUIZ.length) state.index = startAt;
  topbarAvatarFromImage();
  startTimer();
  render();
})();
