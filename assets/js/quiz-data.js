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
    h1: "Filhota, responde rapidinho que o paizão monta um plano só pra você e em <span class=\"hl\">4 semaninhas</span> você já se vê diferente no espelho.",
    image: "assets/img/carlao-landing.webp",
    transparent: true, // figura recortada (sem fundo) -> renderiza sem moldura, integrada ao botão
    imageAlt: "Carlão e filhota",
    imageNote: "Carlão apontando pro botão (autoridade do paizão)",
    cta: "Iniciar meu diagnóstico",
    scarcity: "⏳ Disponível só hoje · você responde uma vez só"
  },

  /* ============================ S — SITUAÇÃO (acumula \"sins\" fáceis) ====== */
  {
    type: "question",
    id: "q1_idade",
    block: "Sobre você",
    question: "Filhota, deixa eu começar te conhecendo. Quantos anos você tem?",
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
    question: "E qual é o seu foco agora, filhota? O que você mais quer?",
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
  {
    type: "story",
    duration: 10000,            // fallback caso o vídeo não carregue
    author: "Carlão Personal das Estrelas",
    handle: "agora",
    video: "assets/img/story-carlao.mp4", // vídeo do Carlão (autoplay, barra segue o vídeo, avança no fim)
    embed: null,                // <- ou cole um embed de vídeo aqui
    poster: "assets/img/story-carlao.jpg", // frame de capa enquanto o vídeo carrega
    // com vídeo, a barra enche pelo tempo do vídeo e avança sozinho ao terminar
    eyebrow: "Filhota, presta atenção.",
    sign: "— Carlão"
  },

  /* ============================ P — PROBLEMA (toca a dor) ================= */
  {
    type: "question",
    id: "q4_porque",
    block: "O que te trava",
    question: "Agora me fala de coração, filhota: por que você acha que ainda não conseguiu o corpo que quer?",
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
    handle: "@lizx.macedo",      // <- @ real da Liz Macedo no Instagram (4,1 mi seguidores)
    author: "Liz Macedo",
    // vídeo nativo da Liz em formato STORIES (barra segue o vídeo, avança no fim, som automático)
    video: "assets/img/depoimento-liz.mp4",
    poster: "assets/img/depoimento-liz.jpg",
    cta: "Continuar"
  },

  /* ============================ I — IMPLICAÇÃO (o custo) ================= */
  {
    type: "question",
    id: "q7_deixou",
    block: "O custo de não mudar",
    question: "Filhota, e esse incômodo com o corpo… o que ele já te fez deixar de fazer?",
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

  /* --------------------------- MINI VSL 1 (~3min) ----------------------- */
  {
    type: "vsl",
    trigger: "Você já ouviu falar do <span class=\"hl\">Método do Paizão</span>? Então olha esse vídeo, filhota.",
    slotLabel: "SLOT MINI VSL 1 · ~3 min",
    slotNote: "Autoridade do Carlão + mecanismo \"plano feito pra VOCÊ\" + a FAMÍLIA de filhotas + filhotas reais. Sem oferta.",
    embed: null, // <- cole o iframe/embed do vídeo aqui quando tiver
    cta: "Já assisti, continuar"
  },

  /* ====== N — NECESSIDADE + QUALIFICAÇÃO + COMUNIDADE =================== */
  {
    type: "question",
    id: "q9_plano",
    block: "O que muda o jogo",
    question: "Agora me responde, filhota: se você tivesse um plano de treino e dieta feito SÓ pra você, isso mudaria o jogo?",
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
    question: "Olha só, filhota, essa aqui é importante: o quanto mudaria pra você fazer parte de uma <span class=\"hl\">família de filhotas</span> que treina junto, se apoia e não te deixa desistir?",
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
    question: "E como tá sua alimentação hoje, filhota? Sem vergonha, me fala a real.",
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
    question: "Quase lá, filhota! Me passa sua altura e seu peso de hoje, pro paizão calcular certinho seu ponto de partida:",
    note: "Fica só entre você e o paizão 🔒 Sem julgamento — é só pra montar seu plano.",
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
    question: "Última pergunta e é a mais séria, filhota. Você tá realmente comprometida a seguir o plano do paizão por 4 semaninhas?",
    image: "assets/img/antes-depois-2.jpg",
    imageNote: "Antes/depois + \"resultado em 4 semaninhas\"",
    options: [
      "Tô pronta, paizão 🙏",
      "Sim, mas tenho medo de não conseguir"
    ]
  },

  /* --------------------------- TRANSIÇÃO -------------------------------- */
  {
    type: "loading",
    // 3 batidas de headline em sequência (o recap pipoca durante a batida 2):
    intro: "Calma, filhota… o paizão tá montando o seu diagnóstico…",  // batida 1 (~1,5s)
    text:  "Tô guardando tudo que você me contou aqui, filhota…",       // batida 2 (1ª pessoa)
    done:  "Pronto. Já tô montando o seu plano, filhota…",              // batida 3
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
    subtitle: "Você me falou que quer <b>{foco}</b> — e ver primeiro <b>{primeiro}</b>. Olha só onde o paizão vai te colocar, filhota 👇",
    lead: "{empatia}",          // frase de empatia (vira card) ligada ao que a trava
    markStart: "você tá aqui",  // selo no ponto "Hoje"
    markGoal: "sua meta 🔥",    // selo no ponto "12 semaninhas"
    startFrom: "q3_rotina",     // calibra o ponto "Hoje" pela rotina atual dela
    points: [
      { label: "Hoje", level: 0.18 },   // level vira fallback (recalculado p/ q3)
      { label: "4 semaninhas", level: 0.58 },
      { label: "12 semaninhas", level: 0.95 }
    ],
    cta: "Pra receber seu plano, toca aqui, filhota"
  },

  /* --------------------------- MINI VSL 2 (oferta 90s) ------------------ */
  {
    type: "offer",
    slotLabel: "SLOT MINI VSL 2 · 90 s · OFERTA",
    slotNote: "Oferta pura (App do Paizão R$288 / 12× R$24 · treino + dieta + feed exclusivo + 1 ano de acompanhamento + desafio top-5) + garantia palavra de pai (4 semaninhas) + urgência (10min). Fecha com \"Bora, filhota. Te amo.\"",
    embed: null, // <- cole o iframe/embed da VSL de oferta aqui
    cta: "QUERO MEU PLANO COM O PAIZÃO"
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
  // IMC no diagnóstico — mensagem por faixa (SEMPRE acolhedora). {foco} é resolvido.
  imc: {
    abaixo:   "Seu IMC tá um pouquinho abaixo do ideal — bora construir corpo com saúde, no seu ritmo, filhota.",
    saudavel: "Seu IMC já tá na faixa saudável! Agora é esculpir e {foco} do jeito certo, sem perder a saúde.",
    acima:    "Seu IMC tá só um pouquinho acima do ideal — e é exatamente aí que o paizão começa a virar o jogo nas primeiras 4 semaninhas.",
    alto:     "Seu IMC mostra que dá pra ganhar MUITA saúde e leveza daqui pra frente — e o paizão vai com você passo a passo, sem pressa e sem julgamento.",
    _default: "Esse é o seu ponto de partida, filhota. A partir daqui é só evolução com o paizão."
  },
  // rótulo curto da faixa (chip ao lado do número)
  imcCat: {
    abaixo: "abaixo do ideal",
    saudavel: "faixa saudável",
    acima: "um pouco acima",
    alto: "bora cuidar disso",
    _default: "ponto de partida"
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
    "Cansaço, chego sem energia": "E esse plano respeita sua energia, filhota. No seu ritmo, sem te quebrar.",
    "Falta de tempo": "E ó: esse plano cabe na sua rotina, filhota. Sem desculpa, sem peso.",
    _default: "E dessa vez você não vai tá sozinha, filhota. O paizão tá com você. 🧡"
  }
};

// expõe global pro app.js
window.QUIZ = QUIZ;
window.PERSONA = PERSONA;
