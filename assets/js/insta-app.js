/* ============================================================================
   FUNIL /insta — motor leve (mesma identidade visual do quiz principal)
============================================================================ */
(function () {
  "use strict";

  var QUIZ = window.INSTA_QUIZ || [];
  var stage = document.getElementById("stage");
  var topbar = document.getElementById("topbar");
  var progressBar = document.getElementById("progressBar");
  var backBtn = document.getElementById("backBtn");

  var STATE_KEY = "paizao_insta_state";
  var state = { index: 0, answers: {}, picks: {} };
  // picks = respostas parciais da tela de choices (antes de enviar)

  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = String(html).trim();
    return t.content.firstChild;
  }

  function slugFor(i) {
    var s = QUIZ[i];
    return (s && s.slug) || ("etapa-" + i);
  }

  function pathFor(i) {
    return "/insta/" + slugFor(i);
  }

  function indexForPath(path) {
    var p = String(path || "").replace(/^\/+|\/+$/g, "");
    // aceita /insta, /insta/, /insta/instagram
    if (p === "insta" || p === "insta.html") return 0;
    var parts = p.split("/");
    var slug = parts[parts.length - 1];
    for (var i = 0; i < QUIZ.length; i++) {
      if (slugFor(i) === slug) return i;
    }
    return null;
  }

  function persist() {
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify({
        index: state.index,
        answers: state.answers,
        picks: state.picks
      }));
    } catch (e) {}
  }

  function loadPersisted() {
    try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); } catch (e) { return null; }
  }

  function normalizeHandle(v) {
    v = String(v || "").trim();
    if (!v) return "";
    v = v.replace(/^@+/, "");
    v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
    v = v.replace(/^https?:\/\/(www\.)?tiktok\.com\/@?/i, "");
    v = v.split(/[/?#]/)[0];
    return v ? ("@" + v) : "";
  }

  function updateChrome() {
    var s = QUIZ[state.index];
    var isDone = s && s.type === "done";
    if (topbar) topbar.hidden = !!isDone;
    // progresso só nas 3 telas de pergunta (0..2)
    var total = QUIZ.filter(function (x) { return x.type !== "done"; }).length;
    var step = Math.min(state.index, total - 1);
    var pct = isDone ? 100 : Math.round(((step + 1) / total) * 100);
    if (progressBar) progressBar.style.width = pct + "%";
    if (backBtn) backBtn.disabled = state.index === 0 || isDone;
  }

  function go(i, push) {
    if (i < 0 || i >= QUIZ.length) return;
    state.index = i;
    persist();
    try {
      var url = pathFor(i) + (location.search || "");
      if (push) history.pushState({ i: i }, "", url);
      else history.replaceState({ i: i }, "", url);
    } catch (e) {}
    if (window.PaizaoInstaDB && PaizaoInstaDB.recordStep) {
      PaizaoInstaDB.recordStep(i, slugFor(i), QUIZ[i].title || QUIZ[i].type);
    }
    render();
  }

  function next() {
    if (state.index < QUIZ.length - 1) go(state.index + 1, true);
  }

  function back() {
    if (state.index > 0) history.back();
  }

  function ctaButton(label, onClick) {
    var btn = el('<button class="btn" type="button"></button>');
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function ctaBar(label, onClick) {
    var bar = el('<div class="ctabar"></div>');
    bar.appendChild(ctaButton(label, onClick));
    return bar;
  }

  /* ---- FORM (IG / TikTok) ---- */
  function renderForm(root, s) {
    root.classList.add("measure", "insta-form");
    if (s.block) root.appendChild(el('<div class="q__head"><span class="q__block">' + s.block + "</span></div>"));
    root.appendChild(el('<h2 class="q__title">' + s.title + "</h2>"));
    if (s.subtitle) root.appendChild(el('<p class="insta-sub">' + s.subtitle + "</p>"));

    var form = el('<div class="measure__fields insta-fields"></div>');
    var inputs = {};
    (s.fields || []).forEach(function (f) {
      var isHandle = !!f.prefix;
      var wrap = el(
        '<label class="measure__field insta-field' + (isHandle ? " insta-field--handle" : "") + '">' +
          '<span class="measure__flabel">' + f.label + "</span>" +
          '<span class="measure__inputwrap">' +
            (isHandle ? '<span class="insta-prefix">@</span>' : "") +
            '<input class="measure__input insta-input' + (isHandle ? " insta-input--handle" : "") + '" ' +
              'type="' + (f.type || "text") + '" ' +
              (f.inputmode ? 'inputmode="' + f.inputmode + '" ' : "") +
              'placeholder="' + (f.placeholder || "") + '" ' +
              'autocomplete="' + (f.autocomplete || "off") + '" ' +
              'autocapitalize="' + (f.autocapitalize || "sentences") + '" ' +
              'spellcheck="false" />' +
          "</span>" +
        "</label>"
      );
      var input = wrap.querySelector("input");
      var saved = state.answers[f.id];
      if (saved != null) {
        input.value = isHandle ? String(saved).replace(/^@/, "") : saved;
      }
      inputs[f.id] = { el: input, meta: f };
      form.appendChild(wrap);
    });
    root.appendChild(form);

    var err = el('<p class="measure__err" hidden>Preenche os campos pra continuar 🙏</p>');
    root.appendChild(err);

    var proceed = function () {
      var ok = true;
      var patch = {};
      Object.keys(inputs).forEach(function (id) {
        var item = inputs[id];
        var f = item.meta;
        var raw = item.el.value.trim();
        item.el.classList.remove("is-bad");
        if (f.required && !raw) {
          ok = false;
          item.el.classList.add("is-bad");
          return;
        }
        var val = f.prefix ? normalizeHandle(raw) : raw;
        if (f.prefix && f.required && val === "@") {
          ok = false;
          item.el.classList.add("is-bad");
          return;
        }
        state.answers[id] = val;
        patch[id] = val;
      });
      if (!ok) { err.hidden = false; return; }
      err.hidden = true;
      if (window.PaizaoInstaDB) PaizaoInstaDB.recordPatch(state.answers);
      persist();
      next();
    };

    Object.keys(inputs).forEach(function (id) {
      inputs[id].el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); proceed(); }
      });
    });

    root.appendChild(ctaBar(s.cta || "Continuar", proceed));
  }

  /* ---- CHOICES (2 perguntas na mesma tela) ---- */
  function renderChoices(root, s) {
    root.classList.add("insta-choices");
    if (s.block) root.appendChild(el('<div class="q__head"><span class="q__block">' + s.block + "</span></div>"));
    root.appendChild(el('<h2 class="q__title">' + s.title + "</h2>"));
    if (s.subtitle) root.appendChild(el('<p class="insta-sub">' + s.subtitle + "</p>"));

    var qs = s.questions || [];
    qs.forEach(function (q) {
      var block = el('<div class="insta-qblock"></div>');
      block.appendChild(el('<h3 class="insta-qblock__title">' + q.question + "</h3>"));
      var opts = el('<div class="opts"></div>');
      var selected = state.answers[q.id] || state.picks[q.id] || null;
      (q.options || []).forEach(function (text) {
        var isSel = selected === text;
        var opt = el(
          '<button class="opt' + (isSel ? " is-selected" : "") + '" type="button">' +
            '<span class="opt__dot"></span>' +
            '<span class="opt__label">' + text + "</span>" +
          "</button>"
        );
        opt.addEventListener("click", function () {
          state.picks[q.id] = text;
          state.answers[q.id] = text;
          opts.querySelectorAll(".opt").forEach(function (o) { o.classList.remove("is-selected"); });
          opt.classList.add("is-selected");
          persist();
        });
        opts.appendChild(opt);
      });
      block.appendChild(opts);
      root.appendChild(block);
    });

    var err = el('<p class="measure__err" hidden>Responde as duas perguntas pra enviar 🙏</p>');
    root.appendChild(err);

    root.appendChild(ctaBar(s.cta || "Enviar", function () {
      var missing = false;
      qs.forEach(function (q) {
        if (!state.answers[q.id]) missing = true;
      });
      if (missing) { err.hidden = false; return; }
      err.hidden = true;
      if (window.PaizaoInstaDB) PaizaoInstaDB.complete(state.answers);
      persist();
      next();
    }));
  }

  /* ---- DONE ---- */
  function renderDone(root, s) {
    root.classList.add("insta-done");
    root.appendChild(el('<div class="insta-done__icon" aria-hidden="true">✓</div>'));
    root.appendChild(el('<h2 class="q__title">' + (s.title || "Pronto!") + "</h2>"));
    if (s.text) root.appendChild(el('<p class="insta-done__text">' + s.text + "</p>"));
    if (s.sub) root.appendChild(el('<p class="insta-sub">' + s.sub + "</p>"));
  }

  function render() {
    var s = QUIZ[state.index];
    if (!s) return;
    updateChrome();
    stage.innerHTML = "";
    var root = el('<section class="screen"></section>');
    if (s.type === "form") renderForm(root, s);
    else if (s.type === "choices") renderChoices(root, s);
    else if (s.type === "done") renderDone(root, s);
    else root.appendChild(el("<p>Tela desconhecida</p>"));
    stage.appendChild(root);
    try { window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" }); } catch (e) {}
  }

  // boot
  (function boot() {
    var saved = loadPersisted();
    if (saved && saved.answers) state.answers = saved.answers || {};
    if (saved && saved.picks) state.picks = saved.picks || {};

    var parsed = indexForPath(location.pathname);
    if (parsed == null) {
      state.index = 0;
    } else if (saved && typeof saved.index === "number" && saved.index >= parsed) {
      state.index = parsed;
    } else if (parsed === 0) {
      state.index = 0;
    } else {
      // deep-link no meio sem progresso: recomeça
      state.index = 0;
      state.answers = {};
      state.picks = {};
    }

    try { history.replaceState({ i: state.index }, "", pathFor(state.index) + (location.search || "")); } catch (e) {}
    if (window.PaizaoInstaDB && PaizaoInstaDB.recordStep) {
      PaizaoInstaDB.recordStep(state.index, slugFor(state.index), QUIZ[state.index].title || "");
    }
    render();
  })();

  if (backBtn) backBtn.addEventListener("click", back);
  window.addEventListener("popstate", function () {
    var i = indexForPath(location.pathname);
    if (i == null) i = 0;
    state.index = i;
    persist();
    render();
  });
})();
