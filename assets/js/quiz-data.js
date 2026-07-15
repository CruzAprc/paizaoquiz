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
  /* (a pergunta do FOCO desceu pra logo antes do vídeo da Liz — ver abaixo) */
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
      "Falta de motivação e disciplina",
      "Não sei o que fazer",
      "Cansaço, chego sem energia",
      "Falta de tempo"
    ]
  },

  /* --------------- FOCO (cards estilo BetterMe) — logo ANTES do vídeo da Liz.
     Valores das options EXATOS — o PERSONA.foco e o diagnóstico dependem deles. */
  {
    type: "question",
    id: "q2_foco",
    block: "Sobre você",
    question: "E qual é o seu foco agora? O que você mais quer?",
    grid: true,
    options: [
      "Emagrecer e secar",
      "Ganhar massa",
      "Os dois juntos"
    ],
    images: [
      "assets/img/foco/foco-emagrecer.webp",
      "assets/img/foco/foco-ganhar-massa.webp",
      "assets/img/foco/foco-dois-juntos.webp"
    ]
  },

  /* ------------------- BREAK 2 — DEPOIMENTO (bifurcação por q2_foco) -------
     Emagrecer e secar → Niic (@niic.ca). Demais focos → Liz (@lizx.macedo).
     showIf / hideIf resolvidos em app.js (pula a tela invisível).          */

  // trilha SECAR — depoimento Niic (stories IG, mesmo formato da Liz)
  {
    type: "testimonial",
    slug: "video-niic",
    label: "Vídeo Niic",
    showIf: { q2_foco: "Emagrecer e secar" },
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

  // demais focos (massa / os dois) — depoimento Liz
  {
    type: "testimonial",
    slug: "video-liz",
    label: "Vídeo Liz",
    hideIf: { q2_foco: "Emagrecer e secar" },
    topName: "@lizx.macedo",
    topSub: "aluna do paizão",
    avatar: "avatar-liz",
    verified: true,
    videoLen: 58,                // duração real (vturb HLS): 57.99s
    embed: `<vturb-smartplayer id="vid-6a313a5eb2d74681824e0933" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a313a5eb2d74681824e0933/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a313a5eb2d74681824e0933/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a313a0ab33864477f837845/main.m3u8", as: "fetch" }
    ]
  },

  /* ============================ I — IMPLICAÇÃO (o custo) ================= */
  {
    type: "question",
    id: "q7_deixou",
    block: "Seu corpo hoje",
    question: "E o seu corpo hoje, qual imagem parece mais com você?",
    // estilo BetterMe: cards com foto do corpo ATUAL (mantém o id q7_deixou -> coluna já existe no Supabase)
    grid: true,
    options: [
      "No peso, mas falta definição",
      "Magrinha",
      "Uns quilinhos a mais",
      "Bastante pra mudar, e tô decidida"
    ],
    images: [
      "assets/img/corpo/corpo-definicao.webp",
      "assets/img/corpo/corpo-magrinha.webp",
      "assets/img/corpo/corpo-quilinhos.webp",
      "assets/img/corpo/corpo-mudar.webp"
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
    question: "Agora me responde: se você tivesse um plano de treino e dieta feito SÓ pra você, isso mudaria o jogo?",
    options: [
      "Com certeza",
      "Acho que sim",
      "Nunca tive isso",
      "É exatamente o que eu preciso"
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
    question: "Me diz o que você mais quer ver mudando PRIMEIRO:",
    options: [
      "Barriga mais seca",
      "Corpo mais durinho e tonificado",
      "Mais disposição e energia",
      "Tudo junto"
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
    intro: "Calma… o paizão tá montando o seu diagnóstico…",  // batida 1 (~1,5s)
    text:  "Tô guardando tudo que você me contou aqui…",       // batida 2 (1ª pessoa)
    done:  "Pronto, filhota. Já sei por onde a gente começa: {primeiro}.", // batida 3
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
    points: [
      { label: "Hoje",         level: 0.18, bubble: "você tá aqui" },
      { label: "5 dias",       level: 0.52, bubble: "já desincha e veste melhor", dateOffset: 5 },
      { label: "4 semaninhas", level: 0.92, bubble: "{primeiro}", gold: true, dateOffset: 28 }
    ],
    cta: "RECEBER MINHA AVALIAÇÃO"
  },

  /* --------------------------- MINI VSL 2 (oferta) — POST DE REELS -------
     Formato de post do Instagram/Reels: header + vídeo + ações + legenda (H1).
     O BOTÃO/CTA é da própria vturb (dentro do vídeo) — não colocamos botão nosso. */
  {
    type: "offer",
    reels: true,
    author: "Carlão Personal das Estrelas",
    handle: "@oficial_carlaopersonal",
    likes: "12.4 mil",
    // H1 = legenda do post (EDITE este texto à vontade)
    h1: "Seu plano já tá pronto 💛 dá o play que o paizão te conta tudo",
    // player vturb (a VSL já tem o botão de oferta dentro dela)
    embed: `<vturb-smartplayer id="vid-6a31dcf23f5844587f036b0d" style="display:block;width:100%;height:100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31dcf23f5844587f036b0d/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31dcf23f5844587f036b0d/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a31dc326c302b45d80f7367/main.m3u8", as: "fetch" }
    ]
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
    "Emagrecer e secar": "secar",
    "Tonificar e enrijecer o corpo": "tonificar o corpo",
    "Os dois juntos": "secar e tonificar",
    "Ganhar massa": "ganhar massa",
    _default: "mudar de corpo"
  },
  // {primeiro} — q13_primeiro -> o que ela quer ver primeiro
  primeiro: {
    "Barriga mais seca": "a barriga mais seca",
    "Corpo mais durinho e tonificado": "o corpo mais durinho",
    "Mais disposição e energia": "mais disposição e energia",
    "Tudo junto": "tudo de uma vez",
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
    "Falta de motivação e disciplina": "E dessa vez o paizão te cobra todo dia, viu? Você não larga mais sozinha.",
    "Não sei o que fazer": "E dessa vez você tem um passo a passo feito pra você. O paizão te guia em cada exercício.",
    "Cansaço, chego sem energia": "E esse plano respeita sua energia. No seu ritmo, sem te quebrar.",
    "Falta de tempo": "E ó: esse plano cabe na sua rotina. Sem desculpa, sem peso.",
    _default: "E dessa vez você não vai tá sozinha. O paizão tá com você. 🧡"
  },

  // note extra na tela medidas (q2_foco) — sem _default: se não bater, não mostra linha
  measureNote: {
    "Emagrecer e secar": "É daqui que o paizão calcula quanto você seca nas primeiras 4 semaninhas.",
    "Ganhar massa": "É daqui que o paizão calcula onde seu corpo cresce primeiro.",
    "Os dois juntos": "É daqui que o paizão calcula por onde começar: secar e firmar juntinho."
  },

  // loading batida 1 — por q2_foco (sem _default: usa intro do screen)
  loadingIntro: {
    "Emagrecer e secar": "Calma... o paizão tá montando seu diagnóstico pra secar de verdade...",
    "Ganhar massa": "Calma... o paizão tá montando seu diagnóstico pra crescer do jeito certo...",
    "Os dois juntos": "Calma... o paizão tá montando seu diagnóstico pra secar e firmar junto..."
  },

  // loading batida 2 — por q1_idade (sem _default: usa text do screen)
  loadingAge: {
    "16-29": "Seu corpo responde rápido nessa fase, e a gente vai usar isso a seu favor...",
    "30-39": "Nos seus 30 o corpo pede estratégia, e o seu plano vai ter isso...",
    "40-49": "Depois dos 40 o jogo muda, e o paizão sabe exatamente o que muda...",
    "50+": "Nos 50+ o segredo é constância inteligente, sem loucura. É assim que o seu nasce..."
  },

  // balões da curva (índices 1=5 dias, 2=4 semaninhas) por trilha q2_foco
  // "Emagrecer e secar" / ausência = mantém bubbles do screen.points
  chartBubbles: {
    "Ganhar massa": {
      1: "já sente o corpo mais firme",
      // legenda sob a foto: precisa caber em 1 linha no mobile
      2: "curvas no lugar"
    },
    "Os dois juntos": {
      1: "já desincha e sente firmeza",
      2: "seca e firma junto"
    }
  },

  // foto "depois" (Seu objetivo) no before/after — por trilha q2_foco
  metaImg: {
    "Emagrecer e secar": "assets/img/meta/meta-secar.jpg",
    "Ganhar massa": "assets/img/meta/meta-massa.jpg",
    "Os dois juntos": "assets/img/meta/meta-dois.jpg",
    _default: "assets/img/meta/meta-secar.jpg"
  },

  // foto "Agora" no before/after — pelo corpo atual (q7_deixou)
  beforeImg: {
    "No peso, mas falta definição": "assets/img/corpo/corpo-definicao.webp",
    "Magrinha": "assets/img/corpo/corpo-magrinha.webp",
    "Uns quilinhos a mais": "assets/img/corpo/corpo-quilinhos.webp",
    "Bastante pra mudar, e tô decidida": "assets/img/corpo/corpo-mudar.webp",
    _default: "assets/img/corpo/corpo-quilinhos.webp"
  },

  // labels curtos do comparativo (Agora / Seu objetivo)
  beforeBodyLabel: {
    "No peso, mas falta definição": "Falta definição",
    "Magrinha": "Magrinha",
    "Uns quilinhos a mais": "Quilinhos a mais",
    "Bastante pra mudar, e tô decidida": "Pra mudar",
    _default: "Seu corpo hoje"
  },
  afterBodyLabel: {
    "Emagrecer e secar": "Seca e no lugar",
    "Ganhar massa": "Curvas no lugar",
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
