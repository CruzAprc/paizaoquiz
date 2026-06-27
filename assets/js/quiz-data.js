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

  /* ---------------------------------------------------------------- LANDING */
  {
    type: "landing",
    h1: "Descubra por que seu corpo não sai do lugar e como eu vou mudar isso em <span class=\"hl\">4 semaninhas</span>.",
    h2: "Me conta 3 coisinhas e o paizão já acha o que tá te travando e monta seu plano sob medida.",
    image: "assets/img/carlao-landing.webp",
    transparent: true, // figura recortada (sem fundo) -> renderiza sem moldura, integrada ao botão
    imageAlt: "Carlão Personal",
    imageNote: "Carlão apontando pro botão (autoridade do paizão)",
    cta: "Iniciar avaliação gratuita",
    subcta: "⏱️ Leva 1 minutinho",
    scarcity: "⏳ Disponível só hoje · você responde uma vez só"
  },

  /* ============================ S — SITUAÇÃO (acumula \"sins\" fáceis) ====== */
  {
    type: "question",
    id: "q1_idade",
    block: "Sobre você",
    question: "Deixa eu começar te conhecendo. Quantos anos você tem?",
    options: [
      "14 a 17",
      "18 a 21",
      "22 a 24",
      "25 a 29",
      "30 ou mais"
    ]
  },
  {
    type: "question",
    id: "q2_foco",
    block: "Sobre você",
    question: "E qual é o seu foco agora? O que você mais quer?",
    options: [
      "Emagrecer e secar",
      "Tonificar e enrijecer o corpo",
      "Os dois juntos",
      "Ganhar massa"
    ]
  },
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

  /* ------------------- BREAK 2 — DEPOIMENTO EM VÍDEO (filhota real) ------
     Só o @ dela no insta em cima + o vídeo dela falando embaixo. Sem copy.
     Quando tiver o vídeo, é só preencher "video" (caminho do .mp4).         */
  {
    type: "testimonial",
    topName: "@lizx.macedo",     // @ real da Liz no topo do stories
    topSub: "aluna do paizão",
    avatar: "avatar-liz",
    verified: true,
    videoLen: 58,                // duração real (vturb HLS): 57.99s
    // player vturb (streaming) em stories full-screen
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
    block: "O custo de não mudar",
    question: "E esse incômodo com o corpo… o que ele já te fez deixar de fazer?",
    options: [
      "Evito aparecer em foto",
      "Não uso a roupa que eu queria",
      "Invento desculpa pra não ir na praia/festa",
      "Me sinto mal quando me olho no espelho"
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
    videoLen: 100.2,        // duração real (vturb HLS): 100.17s — auto-avança no fim, SEM botão
    author: "Carlão Personal das Estrelas",
    handle: "Método do Paizão",
    // player vturb (streaming) — carregado só nesta tela; warm-up algumas telas antes
    embed: `<vturb-smartplayer id="vid-6a31dddf6c302b45d80f7443" style="display: block; margin: 0 auto; width: 100%; height: 100%;"></vturb-smartplayer> <script type="text/javascript"> var s=document.createElement("script"); s.src="https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31dddf6c302b45d80f7443/v4/player.js", s.async=!0,document.head.appendChild(s); <\/script>`,
    // assets pra aquecer ANTES da tela (sem pesar na landing)
    preload: [
      { href: "https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a31dddf6c302b45d80f7443/v4/player.js", as: "script" },
      { href: "https://scripts.converteai.net/lib/js/smartplayer-wc/v4/smartplayer.js", as: "script" },
      { href: "https://cdn.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/6a31dcf439cf80d3ff09dccd/main.m3u8", as: "fetch" }
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
    ]
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
    question: "Última pergunta e é a mais séria. Você tá realmente comprometida a seguir o plano do paizão por 4 semaninhas?",
    options: [
      "Tô pronta, paizão 🙏",
      "Sim, mas tenho medo de não conseguir"
    ]
  },

  /* --------------------------- TRANSIÇÃO -------------------------------- */
  {
    type: "loading",
    // 3 batidas de headline em sequência (o recap pipoca durante a batida 2):
    intro: "Calma… o paizão tá montando o seu diagnóstico…",  // batida 1 (~1,5s)
    text:  "Tô guardando tudo que você me contou aqui…",       // batida 2 (1ª pessoa)
    done:  "Pronto. Já tô montando o seu plano…",              // batida 3
    introHold: 1500,
    // (as respostas NÃO são exibidas pra lead — só as mensagens do paizão.
    //  Os dados continuam sendo salvos no Supabase em silêncio.)
    duration: 4200
  },
  {
    type: "chart",
    // tokens {foco} e {primeiro} são resolvidos a partir das respostas reais dela (ver PERSONA)
    title: "Seu corpo nas próximas semaninhas",
    showImc: true,              // calcula e mostra o IMC dela (altura/peso da tela measure)
    subtitle: "Você me falou que quer <b>{foco}</b> e ver primeiro <b>{primeiro}</b>. Então olha só onde o paizão vai te colocar 👇",
    lead: "{empatia}",          // frase de empatia (vira card) ligada ao que a trava
    startFrom: "q3_rotina",     // calibra o ponto "Hoje" pela rotina atual dela
    // Cada ponto vira um BALÃOZINHO de marco sobre a curva (estilo linha do tempo).
    //   bubble     -> texto curto do marco (aceita {tokens} personalizados; EDITE à vontade)
    //   gold       -> ponto-meta destacado (linha tracejada + glow dourado) = a promessa
    //   dateOffset -> rótulo do eixo vira DATA REAL (fuso SP) = hoje + N dias (calculado na hora)
    points: [
      { label: "Hoje",         level: 0.18, bubble: "você tá aqui" },                          // recalibrado p/ q3
      { label: "5 dias",       level: 0.52, bubble: "já desincha e veste melhor", dateOffset: 5 },
      { label: "4 semaninhas", level: 0.92, bubble: "{primeiro} 🔥", gold: true, dateOffset: 28 } // a promessa
    ],
    cta: "Pra receber seu plano, toca aqui"
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
  // Termômetro do Paizão — mensagem por faixa (SEMPRE positiva, sem medo). {foco} é resolvido.
  imc: {
    abaixo:   "Tá tudo certo! Seu corpo tem espaço pra construir com saúde, no seu ritmo. O paizão vai te deixar tudo no lugar e durinha.",
    saudavel: "Olha que beleza! Seu corpo já tá na faixa saudável. Agora é o paizão te deixar tudo durinho e no lugar.",
    acima:    "Tá tudo certo! Seu corpo já tá pertinho da faixa ideal. E é exatamente aí que o paizão vira o jogo nas primeiras 4 semaninhas.",
    alto:     "Tá tudo certo! Daqui pra frente é só ganho de saúde e leveza. E o paizão vai com você passo a passo, sem pressa e sem julgamento.",
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
  }
};

// expõe global pro app.js
window.QUIZ = QUIZ;
window.PERSONA = PERSONA;
