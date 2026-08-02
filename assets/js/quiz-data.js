/* ============================================================================
   QUIZ DO PAIZÃO — CARLÃO PERSONAL
   ----------------------------------------------------------------------------
   Toda a copy do quiz vive aqui. Para editar texto / opções / ordem, mexa
   SÓ neste arquivo. O motor (app.js) não precisa ser tocado.

   Tipos de tela (screen.type):
     landing      -> abertura (H1 + imagem + botão + escassez)
     question     -> pergunta de escolha única (conta na barra de progresso)
     letter       -> carta da voz do Carlão (break, não é pergunta)
     testimonial  -> depoimento de filhota real (break)
     vsl          -> slot de vídeo (com pergunta-gatilho opcional antes)
     loading      -> transição automática (3 batidas + recap das respostas dela)
     chart        -> gráfico/diagnóstico personalizado (curva hoje -> 4 -> 12 semaninhas)
     offer        -> slot da oferta (Mini VSL 2)

   Imagens: troque os caminhos em /assets/img quando subir as fotos do Carlão.
   Vídeos:  cole o embed dentro de screen.embed (iframe/script) quando tiver.
============================================================================ */

const QUIZ = [

  /* ---------------------------------------------------------------- LANDING
     >>> TESTE: CAPA/LANDING DESATIVADA — o quiz abre direto na Pergunta 1.
         Pra reativar, é só descomentar o objeto abaixo (e restaurar a dobra
         estática da landing no index.html). <<< */
  /*
  {
    type: "landing",
    h1: "Descubra por que seu corpo não sai do lugar e como eu vou mudar isso em <span class=\"hl\">4 semaninhas</span>.",
    h2: "Me conta 3 coisinhas e o paizão já acha o que tá te travando e monta seu plano sob medida.",
    image: "assets/img/carlao-landing.webp",
    transparent: true, // figura recortada (sem fundo) -> renderiza sem moldura, integrada ao botão
    imageAlt: "Carlão Personal",
    imageNote: "Carlão apontando pro botão (autoridade do paizão)",
    cta: "Fazer minha avaliação grátis agora",
    subcta: "⏱️ Leva 1 minutinho",
    scarcity: "⏳ Disponível só hoje · você responde uma vez só"
  },
  */

  /* ============================ S — SITUAÇÃO (acumula \"sins\" fáceis) ====== */
  {
    type: "question",
    id: "q1_idade",
    block: "Sobre você",
    question: "Deixa eu começar te conhecendo. Quantos anos você tem?",
    // estilo BetterMe: grade 2x2 de cards com foto + faixa "Idade: X" (ver renderQuestion)
    grid: true,
    optionPrefix: "Idade:",
    options: ["16-29", "30-39", "40-49", "50+"],
    images: [
      "assets/img/idade/idade-30-39.webp", // 16-29 (invertida com a faixa de 30-39)
      "assets/img/idade/idade-18-29.webp", // 30-39
      "assets/img/idade/idade-40-49.webp",
      "assets/img/idade/idade-50plus.webp"
    ]
  },
  /* (a pergunta do FOCO fica logo antes do depoimento Niic — ver abaixo) */
  {
    type: "question",
    id: "q3_rotina",
    block: "Sobre você",
    question: "Olha só, me conta uma verdade: como tá sua rotina de treino hoje?",
    options: [
      "Eu treino, mas não vejo resultado",
      "Já parei e voltei várias vezes",
      "Nunca consegui manter constância",
      "Tô começando agora"
    ]
  },

  /* ---------------------- BREAK 1 — CARTA DE 16 PALAVRAS (formato STORIES) -
     O Carlão fala a carta em ~10s e o stories passa sozinho pro próximo.
     Sem vídeo ainda: o slot fica pronto. Quando tiver, é só preencher
     "video" (caminho do .mp4, autoplay mudo) OU "embed".                    */
  /* >>> TESTE: Vídeo Carlão (story) DESATIVADO temporariamente — pula da q3 direto pra q4.
         Pra reativar, é só descomentar este bloco. <<< */
  /*
  {
    type: "story",
    topName: "Carlão Personal das Estrelas",
    topSub: "agora",
    avatar: "avatar-photo",
    videoLen: 16.3,             // duração real (vturb HLS): 16.28s
    // player vturb (streaming) em stories full-screen
    embed: `<vturb-smartplayer id="vid-6a31eee31d8db4c8e4a5cc39" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31eee31d8db4c8e4a5cc39/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31eee31d8db4c8e4a5cc39/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a31eeca1d57eb0be905e65d/main.m3u8", as: "fetch" }
    ]
  },
  */

  /* ============================ P — PROBLEMA (toca a dor) ================= */
  {
    type: "question",
    id: "q4_porque",
    block: "O que te trava",
    question: "Agora me fala de coração: por que você acha que ainda não conseguiu o corpo que quer?",
    options: [
      "Nunca soube treinar do jeito certo",
      "Falta disciplina, largo na 2ª semana",
      "Nunca tive um plano feito pra mim",
      "Me sinto perdida e sozinha na academia"
    ]
  },
  {
    type: "question",
    id: "q5_trava",
    block: "O que te trava",
    question: "E o que mais te trava na hora de manter o treino?",
    options: [
      "Largo na 2ª semana, sozinha não me cobro",
      "Entro na academia e não sei o que fazer",
      "Chego morta e o treino vira desculpa",
      "Tempo some no dia e o treino fica por último"
    ]
  },

  /* --------------- FOCO (cards estilo BetterMe) — logo ANTES do depoimento Niic.
     Valores das options EXATOS — o PERSONA.foco e o diagnóstico dependem deles. */
  {
    type: "question",
    id: "q2_foco",
    block: "Sobre você",
    // Trilha do plano (secar / massa / os dois) — tom oral do paizão, sem “entregasse UMA coisa”
    question: "Me fala a real o que você mais quer pro seu corpo nessas 4 semaninhas?",
    grid: true,
    options: [
      "Quero me olhar no espelho e secar de verdade",
      "Quero curvas e corpo firme",
      "Quero secar e firmar junto"
    ],
    images: [
      "assets/img/foco/foco-emagrecer.webp",
      "assets/img/foco/foco-ganhar-massa.webp",
      "assets/img/foco/foco-dois-juntos.webp"
    ]
  },

  /* ------------------- BREAK 2 — DEPOIMENTO (100% Niic) -------------------
     HOJE: todo mundo assiste a Niic (@niic.ca), independente do foco.
     Liz desligada — pra reativar a bifurcação, descomente o bloco video-liz
     e devolva o showIf na Niic.                                              */

  // depoimento Niic (stories IG) — TODOS os focos
  {
    type: "testimonial",
    slug: "video-niic",
    label: "Vídeo Niic",
    topName: "@niic.ca",
    topSub: "4,2 mi · aluna do paizão",
    avatar: "avatar-niic",
    verified: true,
    videoLen: 27.2,              // duração real (HLS): ~27.19s
    embed: `<vturb-smartplayer id="vid-6a5799081d54d0d2b4e6933b" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a5799081d54d0d2b4e6933b/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a5799081d54d0d2b4e6933b/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a5798d098a1466b1167c553/main.m3u8", as: "fetch" }
    ]
  },

  /* >>> DESLIGADO: depoimento Liz (antes: focos ≠ secar) <<<
  {
    type: "testimonial",
    slug: "video-liz",
    label: "Vídeo Liz",
    hideIf: { q2_foco: "Quero me olhar no espelho e secar de verdade" },
    topName: "@lizx.macedo",
    topSub: "aluna do paizão",
    avatar: "avatar-liz",
    verified: true,
    videoLen: 58,
    embed: `<vturb-smartplayer id="vid-6a313a5eb2d74681824e0933" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a313a5eb2d74681824e0933/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a313a5eb2d74681824e0933/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a313a0ab33864477f837845/main.m3u8", as: "fetch" }
    ]
  },
  */

  /* ============================ I — IMPLICAÇÃO (o custo) ================= */
  {
    type: "question",
    id: "q7_deixou",
    block: "Seu corpo hoje",
    question: "Onde você tá hoje? Sem julgamento, filhota, é só o ponto de partida.",
    // estilo BetterMe: cards com foto do corpo ATUAL (mantém o id q7_deixou -> coluna já existe no Supabase)
    grid: true,
    options: [
      "No peso, mas falta aquela definição",
      "Magrinha demais, quero formato",
      "Uns quilinhos a mais que nenhuma roupa disfarça",
      "Bastante pra mudar e dessa vez eu vou"
    ],
    images: [
      "assets/img/corpo/corpo-definicao.webp",
      "assets/img/corpo/corpo-magrinha.webp",
      "assets/img/corpo/corpo-quilinhos.webp",
      "assets/img/corpo/corpo-mudar.webp"
    ]
  },
  /* Nostalgia (DanceGo) — INSERIDA entre corpo e “1 ano” (não substitui o 1 ano) */
  {
    type: "question",
    id: "q7b_nostalgia",
    block: "Seu corpo hoje",
    question: "Lembra da última vez que você se olhou no espelho e gostou do que viu?",
    options: [
      "Foi esse ano",
      "Faz uns 2 anos",
      "Faz tanto tempo que quase esqueci",
      "Sinceramente? Não lembro de gostar"
    ]
  },
  {
    type: "question",
    id: "q8_um_ano",
    block: "O custo de não mudar",
    question: "Pensa comigo, sem fugir: se nada mudar, como você se imagina daqui 1 ano?",
    options: [
      "Exatamente onde tô agora",
      "Pior que hoje",
      "Ainda tentando sozinha",
      "Não quero nem pensar"
    ]
  },

  /* --------------------------- MINI VSL 1 (~1min40) --------------------- */
  {
    type: "vsl",
    story: true,            // renderiza em STORIES full-screen (igual Carlão/Liz)
    videoLen: 166.03,       // duração real (vturb HLS): 166.03s — auto-avança no fim, SEM botão
    author: "Carlão Personal das Estrelas",
    handle: "Método do Paizão",
    // player vturb (streaming) — carregado só nesta tela; warm-up algumas telas antes
    embed: `<vturb-smartplayer id="vid-6a43a1d5bee4e20d5948096d" style="display: block; margin: 0 auto; width: 100%; max-width: 400px;"><div class="vturb-player-placeholder" style="position: relative; width: 100%; padding: 177.77777777777777% 0 0; z-index: 0; background-color: black;"></div></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a43a1d5bee4e20d5948096d/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    // assets pra aquecer ANTES da tela (sem pesar na landing)
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a43a1d5bee4e20d5948096d/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a43a1524cbefc3ea7538be3/main.m3u8", as: "fetch" }
    ]
  },

  /* ====== N — NECESSIDADE + QUALIFICAÇÃO + COMUNIDADE =================== */
  {
    type: "question",
    id: "q9_plano",
    block: "O que muda o jogo",
    question: "O que mais te falta hoje pra o treino parar de ser copiado da internet?",
    options: [
      "Um plano feito pro meu corpo e rotina",
      "Alguém me dizendo exato o que fazer",
      "Só disciplina (eu já sei o que fazer)",
      "As duas coisas: plano e cobrança"
    ],
    // mockups do app no espaço vazio abaixo das opções: Dieta à esquerda, Treino à direita
    decor: ["assets/img/mockup-dieta.webp", "assets/img/mockup-treino.webp"]
  },
  {
    type: "question",
    id: "q10_cobrando",
    block: "O que muda o jogo",
    question: "E o quanto faz diferença ter o paizão te cobrando e ajustando seu plano toda semana?",
    options: [
      "Faz toda diferença",
      "Sozinha eu largo",
      "Nunca tive isso",
      "Preciso disso"
    ]
  },
  {
    type: "question",
    id: "q11_comunidade",
    block: "O que muda o jogo",
    question: "Olha só, essa aqui é importante: o quanto mudaria pra você fazer parte de uma <span class=\"hl\">família de mulheres</span> que treina junto, se apoia e não te deixa desistir?",
    options: [
      "Mudaria tudo, sozinha eu largo",
      "Eu ia me sentir motivada todo dia",
      "Nunca tive um grupo assim",
      "É disso que eu preciso"
    ]
  },
  {
    type: "question",
    id: "q12_alimentacao",
    block: "O que muda o jogo",
    question: "E como tá sua alimentação hoje? Sem vergonha, me fala a real.",
    options: [
      "Como de tudo, sem controle",
      "Tento, mas me perco",
      "Já tenho uma dieta",
      "Não sei nem por onde começar"
    ]
  },
  {
    type: "question",
    id: "q13_primeiro",
    block: "O que muda o jogo",
    // {data4semanas} = MESMA data do diagnóstico pós-loading (chart gold dateOffset: 28)
    // fillCopy → <span class="q__date">13 de agosto</span> em vermelho
    // grid 2x2 = mesmo formato da P1 (idade). Imagens em assets/img/primeiro/
    question: "No plano que o paizão vai montar pra você, no dia {data4semanas}, o que você quer notar primeiro no espelho?",
    grid: true,
    options: [
      "Barriga",
      "Bumbum",
      "Coxas",
      "Tudo junto"
    ],
    images: [
      "assets/img/primeiro/primeiro-barriga.webp?v=2",
      "assets/img/primeiro/primeiro-bumbum.webp?v=2",
      "assets/img/primeiro/primeiro-coxas.webp?v=2",
      "assets/img/primeiro/primeiro-tudo.webp?v=2"
    ]
  },

  /* --------------- MEDIDAS (altura + peso -> IMC no diagnóstico) --------- */
  {
    type: "measure",
    block: "Seu ponto de partida",
    question: "Quase lá! Me passa sua altura e seu peso de hoje, pro paizão calcular certinho seu ponto de partida:",
    note: "Fica só entre você e o paizão 🔒 Sem julgamento, é só pra montar seu plano.",
    fields: [
      { id: "altura_cm", label: "Altura", unit: "cm", placeholder: "165", min: 120, max: 230 },
      { id: "peso_kg",   label: "Peso",   unit: "kg", placeholder: "72",  min: 30,  max: 300 }
    ],
    cta: "Continuar"
  },

  /* --------------- PRÉ-PITCH — COMPROMISSO (gancho Cialdini) ------------- */
  {
    type: "question",
    id: "q14_compromisso",
    block: "O compromisso",
    // {primeiro} resolvido em app.js (fillCopy + PERSONA.primeiro)
    question: "Última pergunta e é a mais séria. Você tá comprometida a seguir o plano do paizão por 4 semaninhas pra ver {primeiro} chegando?",
    options: [
      "Tô pronta, paizão 🙏",
      "Sim, mas tenho medo de não conseguir"
    ]
  },

  /* --------------------------- TRANSIÇÃO -------------------------------- */
  {
    type: "loading",
    // 3 batidas — personalizadas em app.js (foco / idade / {primeiro}).
    // Textos abaixo = fallback quando a resposta não bate.
    // Batida 1: PERSONA.loadingIntro[q2_foco] | Batida 2: PERSONA.loadingAge[q1_idade]
    intro: "Calma… o paizão tá montando o seu caminho…",  // batida 1 fallback
    text:  "Tô cruzando tudo que você me contou com o seu perfil…", // batida 2 fallback
    done:  "Pronto, filhota. Cruzei seu foco, sua idade e o que te trava. A gente começa por {primeiro}.", // batida 3
    introHold: 2500,
    // prints reais do app (copy já na foto). 6.5s cada × 3 = 19.5s
    slideMs: 6500,
    duration: 19500, // sobrescrito em app.js por slides.length * slideMs
    frameImages: [
      "assets/img/loading/slide-1.jpg", // Tailane
      "assets/img/loading/slide-2.jpg", // Renata
      "assets/img/loading/slide-3.jpg"  // Luana
    ]
  },
  {
    type: "chart",
    // personalização vai no before/after (fotos + marcos). Sem subtítulo redundante.
    title: "Seu corpo nas próximas semaninhas",
    showImc: true,
    subtitle: "",               // desligado: a personalização já está no bloco de fotos
    lead: "{empatia}",
    startFrom: "q3_rotina",
    // marcos da jornada (antes no gráfico; agora no before/after)
    // gold.dateOffset = FONTE ÚNICA da data do plano (pergunta q13 {data4semanas} + label do diagnóstico)
    points: [
      { label: "Hoje",         level: 0.18, bubble: "você tá aqui" },
      { label: "5 dias",       level: 0.52, bubble: "já desincha e veste melhor", dateOffset: 5 },
      // bubble vazio no gold: app.js preenche com afterBodyLabel (objetivo do FOCO q2),
      // não com {primeiro}/parte do corpo (evita "o bumbum" na legenda da foto).
      { label: "4 semaninhas", level: 0.92, bubble: "", gold: true, dateOffset: 28 }
    ],
    cta: "RECEBER MINHA AVALIAÇÃO"
  },

  /* --------------------------- MINI VSL 2 (oferta) — POST DE REELS -------
     Formato de post do Instagram/Reels: header + vídeo + ações + legenda (H1).
     O BOTÃO/CTA é da própria vturb (dentro do vídeo) — não colocamos botão nosso.

     A/B silencioso (app.js): sticky em localStorage (paizao_ab_vsl2).
     HOJE: force "B" = 100% na VSL nova (vid-6a5798cf…). Pra voltar 50/50, apaga force.
     Forçar no teu teste: ?vsl2=A ou ?vsl2=B.
     Grava answers.ab_vsl2 = "A"|"B" no lead. */
  {
    type: "offer",
    reels: true,
    author: "Carlão Personal das Estrelas",
    handle: "@oficial_carlaopersonal",
    likes: "12.4 mil",
    // H1 = legenda do post (igual nas duas variantes — só o vídeo muda)
    h1: "Seu plano já tá pronto 💛 dá o play que o paizão te conta tudo",
    // fallback = B (VSL nova) — alinhado com force atual
    embed: `<vturb-smartplayer id="vid-6a5798cfdfe1a1353cb9872c" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a5798cfdfe1a1353cb9872c/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a5798cfdfe1a1353cb9872c/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a579710d7c6e4aeca4d423c/main.m3u8", as: "fetch" }
    ],
    abTest: {
      key: "vsl2",
      // TEMP: 100% B (VSL nova). Pra reativar 50/50, delete esta linha.
      force: "B",
      variants: {
        A: {
          label: "controle",
          embed: `<vturb-smartplayer id="vid-6a31dcf23f5844587f036b0d" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31dcf23f5844587f036b0d/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
          preload: [
            { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31dcf23f5844587f036b0d/v4/player.js", as: "script" },
            { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
            { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a31dc326c302b45d80f7367/main.m3u8", as: "fetch" }
          ]
        },
        B: {
          label: "teste",
          embed: `<vturb-smartplayer id="vid-6a5798cfdfe1a1353cb9872c" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a5798cfdfe1a1353cb9872c/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
          preload: [
            { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a5798cfdfe1a1353cb9872c/v4/player.js", as: "script" },
            { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
            { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a579710d7c6e4aeca4d423c/main.m3u8", as: "fetch" }
          ]
        }
      }
    }
  }

];

/* ============================================================================
   PERSONA — tabelas de personalização do diagnóstico.
   O app.js resolve os tokens {foco} e {empatia} (e o nível inicial da curva)
   a partir das respostas reais dela. Pra editar a copy personalizada, mexe SÓ
   aqui. `_default` é o fallback quando a resposta não bate / vem vazia.
============================================================================ */
const PERSONA = {
  // {foco} — q2_foco -> palavra curta destacada no subtítulo da curva
  foco: {
    "Quero me olhar no espelho e secar de verdade": "secar",
    "Emagrecer e secar": "secar", // legado (leads antigos)
    "Tonificar e enrijecer o corpo": "tonificar o corpo",
    "Quero secar e firmar junto": "secar e tonificar",
    "Os dois juntos": "secar e tonificar",
    "Quero curvas e corpo firme": "ganhar massa",
    "Ganhar massa": "ganhar massa",
    _default: "mudar de corpo"
  },
  // {primeiro} — q13_primeiro -> o que ela quer ver primeiro (loading / chart / compromisso)
  primeiro: {
    "Barriga": "a barriga",
    "Bumbum": "o bumbum",
    "Coxas": "as coxas",
    "Tudo junto": "tudo junto",
    // legado (respostas antigas no Supabase / sessão)
    "Barriga mais seca": "a barriga",
    "Corpo mais durinho e tonificado": "o corpo mais durinho",
    "Mais disposição e energia": "mais disposição e energia",
    _default: "o resultado que você quer"
  },
  // Frase única do IMC no card de diagnóstico. {imc} = valor real com vírgula em <strong>.
  // Sem dois pontos (:) — humanização aprovada pelo Pedro.
  imc: {
    abaixo:   "Filhota, seu índice de massa corporal deu {imc}, abaixo da faixa saudável, e seu corpo tem espaço pra construir com saúde. Aperta em RECEBER MINHA AVALIAÇÃO que o paizão vai te firmar do jeito certo.",
    saudavel: "Filhota, seu índice de massa corporal deu {imc} e ele tá dentro da faixa saudável. Agora o jogo é lapidar, deixar tudo durinho e no lugar. Aperta em RECEBER MINHA AVALIAÇÃO que o paizão já sabe por onde começar.",
    acima:    "Filhota, seu índice de massa corporal deu {imc} e você precisa cuidar da sua saúde. Ele já passou da faixa saudável e não dá mais pra aceitar isso, porque cada mês que passa mais difícil fica de voltar. Aperta em RECEBER MINHA AVALIAÇÃO agora que o paizão vira esse jogo com você.",
    alto:     "Filhota, seu índice de massa corporal deu {imc} e sua saúde tem que vir primeiro agora. Ele tá bem acima da faixa saudável e chegou o limite de deixar pra depois. Aperta em RECEBER MINHA AVALIAÇÃO que o paizão começa com você hoje.",
    _default: "Esse é o seu ponto de partida. A partir daqui é só evolução com o paizão."
  },
  // rótulo curto da faixa (chip ao lado do número) — com selo de incentivo
  imcCat: {
    abaixo: "🌱 com saúde",
    saudavel: "✅ faixa saudável",
    acima: "🔥 bora virar o jogo",
    alto: "💪 cuidando de você",
    _default: "✨ ponto de partida"
  },
  // ponto "Hoje" da curva — q3_rotina -> nível inicial (quem já treina arranca mais alto)
  start: {
    "Eu treino, mas não vejo resultado": 0.30,
    "Já parei e voltei várias vezes": 0.22,
    "Nunca consegui manter constância": 0.16,
    "Tô começando agora": 0.10,
    _default: 0.18
  },
  // {empatia} — ligada ao que a trava (q5_trava; fallback q6_sozinha) — voz Carlão, sem travessão
  empatia: {
    "Largo na 2ª semana, sozinha não me cobro": "E dessa vez o paizão te cobra todo dia, viu? Você não larga mais sozinha.",
    "Entro na academia e não sei o que fazer": "E dessa vez você tem um passo a passo feito pra você. O paizão te guia em cada exercício.",
    "Chego morta e o treino vira desculpa": "E esse plano respeita sua energia. No seu ritmo, sem te quebrar.",
    "Tempo some no dia e o treino fica por último": "E ó: esse plano cabe na sua rotina. Sem desculpa, sem peso.",
    // legado
    "Falta de motivação e disciplina": "E dessa vez o paizão te cobra todo dia, viu? Você não larga mais sozinha.",
    "Não sei o que fazer": "E dessa vez você tem um passo a passo feito pra você. O paizão te guia em cada exercício.",
    "Cansaço, chego sem energia": "E esse plano respeita sua energia. No seu ritmo, sem te quebrar.",
    "Falta de tempo": "E ó: esse plano cabe na sua rotina. Sem desculpa, sem peso.",
    _default: "E dessa vez você não vai tá sozinha. O paizão tá com você. 🧡"
  },

  // note extra na tela medidas (q2_foco) — sem _default: se não bater, não mostra linha
  measureNote: {
    "Quero me olhar no espelho e secar de verdade": "É daqui que o paizão calcula quanto você seca nas primeiras 4 semaninhas.",
    "Emagrecer e secar": "É daqui que o paizão calcula quanto você seca nas primeiras 4 semaninhas.",
    "Quero curvas e corpo firme": "É daqui que o paizão calcula onde seu corpo cresce primeiro.",
    "Ganhar massa": "É daqui que o paizão calcula onde seu corpo cresce primeiro.",
    "Quero secar e firmar junto": "É daqui que o paizão calcula por onde começar: secar e firmar juntinho.",
    "Os dois juntos": "É daqui que o paizão calcula por onde começar: secar e firmar juntinho."
  },

  // loading batida 1 — por q2_foco (sem _default: usa intro do screen)
  // copy nova + legado (leads/opções antigas) pra personalização não quebrar
  loadingIntro: {
    "Quero me olhar no espelho e secar de verdade": "Calma… o paizão tá montando o caminho pra você secar de verdade…",
    "Emagrecer e secar": "Calma… o paizão tá montando o caminho pra você secar de verdade…",
    "Quero curvas e corpo firme": "Calma… o paizão tá montando o caminho pra você crescer do jeito certo…",
    "Ganhar massa": "Calma… o paizão tá montando o caminho pra você crescer do jeito certo…",
    "Quero secar e firmar junto": "Calma… o paizão tá montando o caminho pra secar e firmar junto…",
    "Os dois juntos": "Calma… o paizão tá montando o caminho pra secar e firmar junto…"
  },

  // loading batida 2 — por q1_idade (sem _default: usa text do screen)
  loadingAge: {
    "16-29": "Seu corpo responde rápido nessa fase, e a gente vai usar o que você me contou a seu favor…",
    "30-39": "Nos seus 30 o corpo pede estratégia, e o seu plano vai ter isso com o que você me falou…",
    "40-49": "Depois dos 40 o jogo muda, e o paizão sabe exatamente o que muda no seu caso…",
    "50+": "Nos 50+ o segredo é constância inteligente, sem loucura. É assim que o seu plano nasce…"
  },

  // balões da curva (índices 1=5 dias, 2=4 semaninhas) por trilha q2_foco
  // "Emagrecer e secar" / ausência = mantém bubbles do screen.points
  chartBubbles: {
    "Quero curvas e corpo firme": {
      1: "já sente o corpo mais firme",
      2: "curvas no lugar"
    },
    "Ganhar massa": {
      1: "já sente o corpo mais firme",
      // legenda sob a foto: precisa caber em 1 linha no mobile
      2: "curvas no lugar"
    },
    "Quero secar e firmar junto": {
      1: "já desincha e sente firmeza",
      2: "seca e firma junto"
    },
    "Os dois juntos": {
      1: "já desincha e sente firmeza",
      2: "seca e firma junto"
    }
  },

  // foto "depois" (Seu objetivo) no before/after — por trilha q2_foco
  metaImg: {
    "Quero me olhar no espelho e secar de verdade": "assets/img/meta/meta-secar.jpg",
    "Emagrecer e secar": "assets/img/meta/meta-secar.jpg",
    "Quero curvas e corpo firme": "assets/img/meta/meta-massa.jpg",
    "Ganhar massa": "assets/img/meta/meta-massa.jpg",
    "Quero secar e firmar junto": "assets/img/meta/meta-dois.jpg",
    "Os dois juntos": "assets/img/meta/meta-dois.jpg",
    _default: "assets/img/meta/meta-secar.jpg"
  },

  // foto "Agora" no before/after — pelo corpo atual (q7_deixou)
  beforeImg: {
    "No peso, mas falta aquela definição": "assets/img/corpo/corpo-definicao.webp",
    "No peso, mas falta definição": "assets/img/corpo/corpo-definicao.webp",
    "Magrinha demais, quero formato": "assets/img/corpo/corpo-magrinha.webp",
    "Magrinha": "assets/img/corpo/corpo-magrinha.webp",
    "Uns quilinhos a mais que nenhuma roupa disfarça": "assets/img/corpo/corpo-quilinhos.webp",
    "Uns quilinhos a mais": "assets/img/corpo/corpo-quilinhos.webp",
    "Bastante pra mudar e dessa vez eu vou": "assets/img/corpo/corpo-mudar.webp",
    "Bastante pra mudar, e tô decidida": "assets/img/corpo/corpo-mudar.webp",
    _default: "assets/img/corpo/corpo-quilinhos.webp"
  },

  // labels curtos do comparativo (Agora / Seu objetivo)
  beforeBodyLabel: {
    "No peso, mas falta aquela definição": "Falta definição",
    "No peso, mas falta definição": "Falta definição",
    "Magrinha demais, quero formato": "Magrinha",
    "Magrinha": "Magrinha",
    "Uns quilinhos a mais que nenhuma roupa disfarça": "Quilinhos a mais",
    "Uns quilinhos a mais": "Quilinhos a mais",
    "Bastante pra mudar e dessa vez eu vou": "Pra mudar",
    "Bastante pra mudar, e tô decidida": "Pra mudar",
    _default: "Seu corpo hoje"
  },
  afterBodyLabel: {
    "Quero me olhar no espelho e secar de verdade": "Seca e no lugar",
    "Emagrecer e secar": "Seca e no lugar",
    "Quero curvas e corpo firme": "Curvas no lugar",
    "Ganhar massa": "Curvas no lugar",
    "Quero secar e firmar junto": "Seca e firme",
    "Os dois juntos": "Seca e firme",
    _default: "No seu objetivo"
  },
  // nível de treino 0-3 (barrinhas estilo BetterMe) — por q3_rotina
  trainLevelNow: {
    "Eu treino, mas não vejo resultado": 2,
    "Já parei e voltei várias vezes": 1,
    "Nunca consegui manter constância": 1,
    "Tô começando agora": 0,
    _default: 1
  },
  trainLevelGoal: {
    _default: 3
  }
};

// expõe global pro app.js
window.QUIZ = QUIZ;
window.PERSONA = PERSONA;
