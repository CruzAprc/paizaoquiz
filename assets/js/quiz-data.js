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
     loading      -> transição automática "montando diagnóstico"
     mirror       -> tela-espelho (repete respostas reais dela)
     chart        -> gráfico/diagnóstico (curva hoje -> 4 -> 12 semaninhas)
     offer        -> slot da oferta (Mini VSL 2)

   Imagens: troque os caminhos em /assets/img quando subir as fotos do Carlão.
   Vídeos:  cole o embed dentro de screen.embed (iframe/script) quando tiver.
============================================================================ */

const QUIZ = [

  /* ---------------------------------------------------------------- LANDING */
  {
    type: "landing",
    h1: "Filhota, responde rapidinho e o paizão te mostra como secar em <span class=\"hl\">4 semaninhas</span>",
    image: "assets/img/carlao-landing.png",
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
    question: "E qual é o teu foco agora, filhota? O que você mais quer?",
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
    question: "Olha só, me conta uma verdade: como tá tua rotina de treino hoje?",
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
    duration: 10000,            // ~10s e avança no automático (igual stories)
    author: "Carlão Personal das Estrelas",
    handle: "agora",
    video: null,                // <- caminho do .mp4 do stories (ex: assets/img/story-carta.mp4)
    embed: null,                // <- ou cole um embed de vídeo aqui
    poster: "assets/img/carlao-story.jpg", // frame de capa (opcional) enquanto não há vídeo
    // a carta vira a legenda/roteiro que ele fala no vídeo:
    eyebrow: "Filhota, presta atenção 10 segundos.",
    paragraphs: [
      "Se você já tentou de tudo e o corpo não muda, esse diagnóstico foi feito pra você. O problema nunca foi você — foi nunca ter tido um plano feito PRA você, e uma família de filhotas do teu lado pra não te deixar largar.",
      "Responde até o final que o paizão calibra esse plano pro TEU corpo. Te amo."
    ],
    sign: "— Carlão"
  },

  /* ============================ P — PROBLEMA (toca a dor) ================= */
  {
    type: "question",
    id: "q4_porque",
    block: "O que te trava",
    needsReview: true, // <- copy original veio truncada/garbled; opções reconstruídas conforme o dado plantado. CONFIRMAR.
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
  {
    type: "question",
    id: "q6_sozinha",
    block: "O que te trava",
    question: "Quando você começa uma dieta ou um treino sozinha, o que costuma rolar?",
    options: [
      "Largo quando não vejo resultado rápido",
      "Fico perdida sem ninguém me cobrando",
      "Me sinto sozinha e desanimo",
      "Faço errado e desisto"
    ]
  },

  /* ------------------- BREAK 2 — DEPOIMENTO (filhota real) --------------- */
  {
    type: "testimonial",
    quote: "Eu era a filhota que largava tudo na segunda semana. Hoje sou referência. Não foi mágica — foi o paizão cobrando e a galera do meu lado.",
    author: "Liz",
    authorTag: "filhota do paizão",
    image: "assets/img/depoimento-liz.jpg",
    imageAlt: "Depoimento da Liz",
    imageNote: "Print/vídeo curto de filhota real (Liz ou Sophia)",
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
    question: "E o quanto faz diferença ter o paizão te cobrando e ajustando teu plano toda semana?",
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
    question: "E como tá tua alimentação hoje, filhota? Sem vergonha, me fala a real.",
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
    text: "Calma, filhota… o paizão tá montando o teu diagnóstico…",
    duration: 3600
  },
  {
    type: "mirror",
    title: "Olha o que você me contou:",
    // monta a partir das respostas reais dela
    rows: [
      { label: "idade", from: "q1_idade" },
      { label: "foco em", from: "q2_foco" },
      { label: "alimentação", from: "q12_alimentacao" }
    ],
    footer: "É com base nisso que eu montei o teu plano.",
    cta: "Ver meu diagnóstico"
  },
  {
    type: "chart",
    title: "Teu corpo nas próximas semaninhas",
    subtitle: "Curva real do que o paizão projeta pra você:",
    points: [
      { label: "Hoje", level: 0.18 },
      { label: "4 semaninhas", level: 0.58 },
      { label: "12 semaninhas", level: 0.95 }
    ],
    cta: "Pra receber teu plano, toca aqui, filhota"
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

// expõe global pro app.js
window.QUIZ = QUIZ;
