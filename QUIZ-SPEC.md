# QUIZ-SPEC — Quiz do Paizão (Carlão Personal)

Documento de especificação completa do funil de quiz **ativo**.  
Use este arquivo para bifurcar / personalizar o quiz sem reabrir o código inteiro.

| Campo | Valor |
|--------|--------|
| **Produto** | Diagnóstico do Paizão · Carlão Personal |
| **Repo** | `https://github.com/CruzAprc/paizaoquiz` |
| **Workspace** | `/Users/pedrocruz/Carlão - Quiz` |
| **Fonte da verdade (copy/ordem)** | `assets/js/quiz-data.js` |
| **Motor de render** | `assets/js/app.js` |
| **Telas ativas** | **19** (13 perguntas + 3 vídeos + medidas + loading + chart) |
| **Telas desativadas** | Landing + Story Carlão (comentadas no `quiz-data.js`) |
| **Data desta spec** | 2026-07-10 (estado do código no repo) |

---

## 1. Arquivos onde cada coisa vive

### Core do funil

| Path absoluto | Papel |
|---------------|--------|
| `/Users/pedrocruz/Carlão - Quiz/index.html` | Shell HTML: topbar, timerbar, barra de progresso, `#stage`, pixels UTMify, load order dos scripts |
| `/Users/pedrocruz/Carlão - Quiz/assets/js/quiz-data.js` | **Copy, opções, ordem das telas, embeds VTurb, PERSONA** — editar aqui 99% das mudanças de conteúdo |
| `/Users/pedrocruz/Carlão - Quiz/assets/js/app.js` | Motor: rotas/slugs, render por tipo, timer 3 min, progresso fake, sessionStorage, analytics Meta/`dataLayer`, prefetch de vídeo |
| `/Users/pedrocruz/Carlão - Quiz/assets/js/supabase.js` | Persistência de leads (`paizao_quiz_leads` via RPC `paizao_quiz_save`) |
| `/Users/pedrocruz/Carlão - Quiz/assets/css/styles.css` | UI mobile (topbar, timerbar, grids BetterMe, stories, chart, offer reels) |
| `/Users/pedrocruz/Carlão - Quiz/vercel.json` | SPA: rewrite `/(.*)` → `index.html`, cleanUrls, rotas `/pedro` e `/aula-1` |

### Assets de imagem / mídia local

| Path absoluto | Uso |
|---------------|-----|
| `/Users/pedrocruz/Carlão - Quiz/assets/img/carlao-landing.webp` | Landing (off) + preload |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/carlao-avatar.jpg` | Avatar topbar |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/idade/idade-18-29.webp` | Card idade (hoje mapeado em **30-39**) |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/idade/idade-30-39.webp` | Card idade (hoje mapeado em **16-29**) |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/idade/idade-40-49.webp` | Card idade 40-49 |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/idade/idade-50plus.webp` | Card idade 50+ |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/foco/foco-emagrecer.webp` | Foco: Emagrecer e secar |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/foco/foco-ganhar-massa.webp` | Foco: Ganhar massa |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/foco/foco-dois-juntos.webp` | Foco: Os dois juntos |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/foco/foco-tonificar.webp` | Legado (não usado no grid ativo) |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/corpo/corpo-definicao.webp` | Corpo: definição |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/corpo/corpo-magrinha.webp` | Corpo: magrinha |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/corpo/corpo-quilinhos.webp` | Corpo: quilinhos a mais |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/corpo/corpo-mudar.webp` | Corpo: bastante pra mudar |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/mockup-dieta.webp` | Decor pergunta plano |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/mockup-treino.webp` | Decor pergunta plano |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/liz-avatar.jpg` | Avatar stories Liz |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/depoimento-liz.mp4` | Fallback local (player ativo é VTurb) |
| `/Users/pedrocruz/Carlão - Quiz/assets/img/story-carlao.mp4` | Fallback local story Carlão (off) |

### Stack

| Camada | Tech |
|--------|------|
| Frontend | HTML + CSS + JS vanilla (sem build) |
| Deploy | Vercel SPA |
| DB | Supabase |
| Vídeo | VTurb / ConverteAI (`vturb-smartplayer`) |
| Tracking | Meta Pixel (`fbq`), UTMify, `dataLayer` |
| Font | Poppins (Google Fonts) |

---

## 2. Chrome fixo (todas as perguntas / medidas / chart)

Definido em `index.html` + `styles.css` + `app.js` (`updateChrome`, `startTimer`).

### Topbar
- **Nome:** Carlão Personal das Estrelas  
- **Handle:** `@oficial_carlaopersonal`  
- **Avatar:** foto Carlão (classe `avatar-photo`)  
- **Selo:** verificado (azul Instagram)  
- **Back:** botão voltar  
- **Contador X/N:** desligado (`qCount` hidden) — a lead não vê quantas faltam  

### Timerbar (urgência)
- **Copy:** `SUA AVALIAÇÃO GRATUITA SE ENCERRA EM` + **`03:00`** (countdown)  
- **Duração:** 3 minutos reais a partir do 1º load  
- **Persistência:** `localStorage` key `quizStart3m`  
- **Últimos 30s:** classe `is-urgent` (brilho + número piscando)  
- **Em 00:00:** para o interval — **não bloqueia** o quiz  

### Barra de progresso
- Fake front-loaded: `eased = 1 - (1 - index/lastIdx)³`  
- Não revela “3/13”  

### Chrome escondido em
`landing` · `loading` · `story` · `screen.story === true` · `screen.reels === true` · `testimonial` com vídeo/embed  

---

## 3. Mapa do funil (ordem exata das 19 telas ativas)

```
[1] Idade
[2] Rotina de treino
[3] Por que ainda não conseguiu
[4] O que mais trava
[5] Foco
[6] Vídeo Liz (depoimento)          ← VÍDEO
[7] Corpo hoje
[8] Daqui 1 ano
[9] Mini VSL 1 (mecanismo)          ← VÍDEO
[10] Plano sob medida
[11] Cobrança do paizão
[12] Comunidade
[13] Alimentação
[14] O que quer primeiro
[15] Medidas (altura/peso)          ← SISTEMA
[16] Compromisso
[17] Loading (montando plano)       ← SISTEMA
[18] Diagnóstico / chart            ← SISTEMA
[19] Mini VSL 2 (oferta / reels)    ← VÍDEO + OFERTA
```

Arquitetura SPIN:
**S** (1–2) → **P** (3–5) → prova social (6) → **I** (7–8) → mecanismo (9) → **N** (10–14) → qualif (15) → pré-pitch (16) → pitch (17–18) → oferta (19)

---

## 4. Telas desativadas (comentadas — NÃO entram no fluxo atual)

### OFF-A · Landing
- **Arquivo:** `quiz-data.js` (objeto `type: "landing"` comentado)  
- **Slug:** `/`  
- **h1:** Descubra por que seu corpo não sai do lugar e como eu vou mudar isso em **4 semaninhas**.  
- **h2:** Me conta 3 coisinhas e o paizão já acha o que tá te travando e monta seu plano sob medida.  
- **image:** `assets/img/carlao-landing.webp`  
- **cta:** Fazer minha avaliação grátis agora  
- **subcta:** ⏱️ Leva 1 minutinho  
- **scarcity:** ⏳ Disponível só hoje · você responde uma vez só  

### OFF-B · Story Carlão (~16s)
- **Tipo:** `story` · **slug:** `/video-carlao`  
- **topName:** Carlão Personal das Estrelas · **topSub:** agora  
- **videoLen:** 16.3s · auto-avança · sem botão  
- **Player:** VTurb `vid-6a31eee31d8db4c8e4a5cc39`  
- **Posição antiga:** entre Rotina e “Por quê”  

> Hoje o quiz **abre direto na tela 1 (Idade)**.

---

## 5. As 19 telas ativas (detalhe completo)

Cada pergunta: escolha **única** (tap → salva resposta → avança).  
IDs em `state.answers` e colunas Supabase.

---

### TELA 1 — Idade  
| | |
|--|--|
| **type** | `question` |
| **id** | `q1_idade` |
| **slug** | `/pergunta-1` |
| **block** | Sobre você |
| **fase** | S — Situação |
| **layout** | grid 2×2 + `optionPrefix: "Idade:"` |
| **arquivo copy** | `assets/js/quiz-data.js` |

**Pergunta (texto exato):**  
> Deixa eu começar te conhecendo. Quantos anos você tem?

**Opções (texto exato + imagem):**

| # | Opção | Label renderizado | Imagem |
|---|--------|-------------------|--------|
| A | `16-29` | Idade: 16-29 | `assets/img/idade/idade-30-39.webp` *(foto invertida com 30-39)* |
| B | `30-39` | Idade: 30-39 | `assets/img/idade/idade-18-29.webp` |
| C | `40-49` | Idade: 40-49 | `assets/img/idade/idade-40-49.webp` |
| D | `50+` | Idade: 50+ | `assets/img/idade/idade-50plus.webp` |

**CTA / botão:** nenhum extra — a opção é o botão (seta → nos cards).

---

### TELA 2 — Rotina de treino  
| | |
|--|--|
| **type** | `question` |
| **id** | `q3_rotina` |
| **slug** | `/pergunta-3` |
| **block** | Sobre você |
| **layout** | lista |

**Pergunta:**  
> Olha só, me conta uma verdade: como tá sua rotina de treino hoje?

**Opções (texto exato):**
1. `Eu treino, mas não vejo resultado`
2. `Já parei e voltei várias vezes`
3. `Nunca consegui manter constância`
4. `Tô começando agora`

**Lógica:** calibra o nível do ponto **“Hoje”** da curva (`PERSONA.start`).

---

### TELA 3 — Por que ainda não conseguiu  
| | |
|--|--|
| **type** | `question` |
| **id** | `q4_porque` |
| **slug** | `/pergunta-4` |
| **block** | O que te trava |
| **fase** | P — Problema |
| **layout** | lista |

**Pergunta:**  
> Agora me fala de coração: por que você acha que ainda não conseguiu o corpo que quer?

**Opções (texto exato):**
1. `Nunca soube treinar do jeito certo`
2. `Falta disciplina, largo na 2ª semana`
3. `Nunca tive um plano feito pra mim`
4. `Me sinto perdida e sozinha na academia`

---

### TELA 4 — O que mais trava  
| | |
|--|--|
| **type** | `question` |
| **id** | `q5_trava` |
| **slug** | `/pergunta-5` |
| **block** | O que te trava |
| **layout** | lista |

**Pergunta:**  
> E o que mais te trava na hora de manter o treino?

**Opções (texto exato):**
1. `Falta de motivação e disciplina`
2. `Não sei o que fazer`
3. `Cansaço, chego sem energia`
4. `Falta de tempo`

**Lógica:** alimenta o card de empatia `{empatia}` no diagnóstico.

---

### TELA 5 — Foco  
| | |
|--|--|
| **type** | `question` |
| **id** | `q2_foco` |
| **slug** | `/pergunta-2` |
| **block** | Sobre você |
| **layout** | grid com foto (3 cards) |

**Pergunta:**  
> E qual é o seu foco agora? O que você mais quer?

**Opções (texto exato + imagem):**

| # | Opção | Imagem |
|---|--------|--------|
| A | `Emagrecer e secar` | `assets/img/foco/foco-emagrecer.webp` |
| B | `Ganhar massa` | `assets/img/foco/foco-ganhar-massa.webp` |
| C | `Os dois juntos` | `assets/img/foco/foco-dois-juntos.webp` |

**Lógica:** token `{foco}` no subtítulo do chart + `foco_resolved` no Supabase.  
**Posição no funil:** logo **antes** do vídeo da Liz.

---

### TELA 6 — Vídeo Liz (depoimento)  ← VÍDEO  
| | |
|--|--|
| **type** | `testimonial` |
| **slug** | `/video-liz` |
| **fase** | Prova social |
| **chrome** | escondido (stories full-screen) |

**Header stories:**
- **topName:** `@lizx.macedo`
- **topSub:** `aluna do paizão`
- **avatar:** `avatar-liz` · **verified:** true

**Copy de pergunta:** nenhuma (só o vídeo).

**Player:**
- **videoLen:** 58s  
- **Comportamento:** autoplay em stories · **auto-avança no fim** · **sem botão de pular/continuar**  
- **VTurb id:** `vid-6a313a5eb2d74681824e0933`  
- **CDN script:** `https://scripts.converteai.net/00d6163e-e250-4c92-8e51-37b324f30ce8/players/6a313a5eb2d74681824e0933/v4/player.js`

**O que faz no funil:** break de prova social real (aluna) entre qualificação de dor/foco e perguntas de corpo/implicação.

---

### TELA 7 — Corpo hoje  
| | |
|--|--|
| **type** | `question` |
| **id** | `q7_deixou` |
| **slug** | `/pergunta-6` |
| **block** | Seu corpo hoje |
| **fase** | I — Implicação |
| **layout** | grid 2×2 com fotos |

**Pergunta:**  
> E o seu corpo hoje, qual imagem parece mais com você?

**Opções (texto exato + imagem):**

| # | Opção | Imagem |
|---|--------|--------|
| A | `No peso, mas falta definição` | `assets/img/corpo/corpo-definicao.webp` |
| B | `Magrinha` | `assets/img/corpo/corpo-magrinha.webp` |
| C | `Uns quilinhos a mais` | `assets/img/corpo/corpo-quilinhos.webp` |
| D | `Bastante pra mudar, e tô decidida` | `assets/img/corpo/corpo-mudar.webp` |

---

### TELA 8 — Daqui 1 ano  
| | |
|--|--|
| **type** | `question` |
| **id** | `q8_um_ano` |
| **slug** | `/pergunta-7` |
| **block** | O custo de não mudar |
| **layout** | lista |

**Pergunta:**  
> Pensa comigo, sem fugir: se nada mudar, como você se imagina daqui 1 ano?

**Opções (texto exato):**
1. `Exatamente onde tô agora`
2. `Pior que hoje`
3. `Ainda tentando sozinha`
4. `Não quero nem pensar`

---

### TELA 9 — Mini VSL 1 (mecanismo / autoridade)  ← VÍDEO  
| | |
|--|--|
| **type** | `vsl` + `story: true` |
| **slug** | `/mini-vsl-1` |
| **fase** | Mecanismo |
| **chrome** | escondido |

**Meta:**
- **author:** Carlão Personal das Estrelas  
- **handle:** Método do Paizão  
- **videoLen:** 166.03s (~2min46)  

**Copy de headline na tela:** nenhuma além do player (stories full-screen).

**Player:**
- **Comportamento:** autoplay · **auto-avança no fim** · **SEM botão**  
- **VTurb id:** `vid-6a43a1d5bee4e20d5948096d`  
- **Script:** `…/players/6a43a1d5bee4e20d5948096d/v4/player.js`  
- Prefetch de script + HLS nas telas anteriores (`preload` no screen)

**O que faz no funil:** Mini VSL de meio de funil — autoridade + mecanismo (por que o método do paizão) antes do bloco de necessidade/oferta implícita.

---

### TELA 10 — Plano sob medida  
| | |
|--|--|
| **type** | `question` |
| **id** | `q9_plano` |
| **slug** | `/pergunta-8` |
| **block** | O que muda o jogo |
| **fase** | N — Necessidade |
| **layout** | lista + decor mockups |

**Pergunta:**  
> Agora me responde: se você tivesse um plano de treino e dieta feito SÓ pra você, isso mudaria o jogo?

**Opções (texto exato):**
1. `Com certeza`
2. `Acho que sim`
3. `Nunca tive isso`
4. `É exatamente o que eu preciso`

**Decor (abaixo das opções):**
- `assets/img/mockup-dieta.webp`
- `assets/img/mockup-treino.webp`

---

### TELA 11 — Cobrança do paizão  
| | |
|--|--|
| **type** | `question` |
| **id** | `q10_cobrando` |
| **slug** | `/pergunta-9` |
| **block** | O que muda o jogo |
| **layout** | lista |

**Pergunta:**  
> E o quanto faz diferença ter o paizão te cobrando e ajustando seu plano toda semana?

**Opções (texto exato):**
1. `Faz toda diferença`
2. `Sozinha eu largo`
3. `Nunca tive isso`
4. `Preciso disso`

---

### TELA 12 — Comunidade / família  
| | |
|--|--|
| **type** | `question` |
| **id** | `q11_comunidade` |
| **slug** | `/pergunta-10` |
| **block** | O que muda o jogo |
| **layout** | lista |

**Pergunta (HTML com highlight):**  
> Olha só, essa aqui é importante: o quanto mudaria pra você fazer parte de uma `<span class="hl">família de mulheres</span>` que treina junto, se apoia e não te deixa desistir?

**Opções (texto exato):**
1. `Mudaria tudo, sozinha eu largo`
2. `Eu ia me sentir motivada todo dia`
3. `Nunca tive um grupo assim`
4. `É disso que eu preciso`

---

### TELA 13 — Alimentação  
| | |
|--|--|
| **type** | `question` |
| **id** | `q12_alimentacao` |
| **slug** | `/pergunta-11` |
| **block** | O que muda o jogo |
| **layout** | lista |

**Pergunta:**  
> E como tá sua alimentação hoje? Sem vergonha, me fala a real.

**Opções (texto exato):**
1. `Como de tudo, sem controle`
2. `Tento, mas me perco`
3. `Já tenho uma dieta`
4. `Não sei nem por onde começar`

---

### TELA 14 — O que quer ver primeiro  
| | |
|--|--|
| **type** | `question` |
| **id** | `q13_primeiro` |
| **slug** | `/pergunta-12` |
| **block** | O que muda o jogo |
| **layout** | lista |

**Pergunta:**  
> Me diz o que você mais quer ver mudando PRIMEIRO:

**Opções (texto exato):**
1. `Barriga mais seca`
2. `Corpo mais durinho e tonificado`
3. `Mais disposição e energia`
4. `Tudo junto`

**Lógica:** token `{primeiro}` no balão dourado da curva (tela 18).

---

### TELA 15 — Medidas (altura + peso)  ← SISTEMA  
| | |
|--|--|
| **type** | `measure` |
| **slug** | `/medidas` |
| **block** | Seu ponto de partida |
| **fase** | Qualificação / IMC |

**Pergunta / headline:**  
> Quase lá! Me passa sua altura e seu peso de hoje, pro paizão calcular certinho seu ponto de partida:

**Note (subtexto):**  
> Fica só entre você e o paizão 🔒 Sem julgamento, é só pra montar seu plano.

**Campos:**

| id | label | unit | placeholder | min | max |
|----|-------|------|-------------|-----|-----|
| `altura_cm` | Altura | cm | 165 | 120 | 230 |
| `peso_kg` | Peso | kg | 72 | 30 | 300 |

**CTA / botão:** `Continuar`

**Lógica:**
- Salva `altura_cm`, `peso_kg` e `imc` em `state.answers` + Supabase  
- `showImc: true` no chart usa esses valores  
- Mensagens de IMC sempre positivas (`PERSONA.imc` / `PERSONA.imcCat`)

---

### TELA 16 — Compromisso (pré-pitch)  
| | |
|--|--|
| **type** | `question` |
| **id** | `q14_compromisso` |
| **slug** | `/pergunta-13` |
| **block** | O compromisso |
| **fase** | Pré-pitch (Cialdini) |
| **layout** | lista (2 opções) |

**Pergunta:**  
> Última pergunta e é a mais séria. Você tá realmente comprometida a seguir o plano do paizão por 4 semaninhas?

**Opções (texto exato + emoji):**
1. `Tô pronta, paizão 🙏`
2. `Sim, mas tenho medo de não conseguir`

---

### TELA 17 — Loading (montando o plano)  ← SISTEMA  
| | |
|--|--|
| **type** | `loading` |
| **slug** | `/montando` |
| **chrome** | escondido |
| **duration** | 4200 ms |
| **introHold** | 1500 ms |

**Copy em 3 batidas (texto exato):**

| Ordem | Campo | Texto |
|-------|--------|--------|
| 1 | `intro` | Calma… o paizão tá montando o seu diagnóstico… |
| 2 | `text` | Tô guardando tudo que você me contou aqui… |
| 3 | `done` | Pronto. Já tô montando o seu plano… |

**Notas:**
- As respostas **NÃO** são exibidas pra lead (só as mensagens do paizão).  
- Auto-avança para o chart ao fim do timer.  
- **Analytics:** `fbq('track', 'Lead', { content_name: 'quiz_completo' })`  
- **DB:** `PaizaoDB.complete(state.answers)` → `completed=true`, `foco_resolved`, etc.

---

### TELA 18 — Diagnóstico / Chart  ← SISTEMA  
| | |
|--|--|
| **type** | `chart` |
| **slug** | `/diagnostico` |
| **fase** | Pitch / resultado |
| **showImc** | `true` |
| **startFrom** | `q3_rotina` |

**title (headline):**  
> Seu corpo nas próximas semaninhas

**subtitle (com tokens):**  
> Você me falou que quer **{foco}** e ver primeiro **{primeiro}**. Então olha só onde o paizão vai te colocar 👇

**lead (card de empatia):**  
> `{empatia}` — resolvido por `q5_trava` (ver §6)

**Pontos da curva:**

| label | level base | bubble | gold | dateOffset |
|-------|------------|--------|------|------------|
| Hoje | 0.18 *(recalibra por q3_rotina)* | `você tá aqui` | — | — |
| 5 dias | 0.52 | `já desincha e veste melhor` | — | +5 dias (data real SP) |
| 4 semaninhas | 0.92 | `{primeiro} 🔥` | **sim** | +28 dias |

**CTA / botão:**  
> Pra receber seu plano, toca aqui

**→** avança para Mini VSL 2 (oferta).

---

### TELA 19 — Mini VSL 2 (oferta)  ← VÍDEO + OFERTA  
| | |
|--|--|
| **type** | `offer` + `reels: true` |
| **slug** | `/mini-vsl-2` |
| **fase** | Oferta / checkout |
| **chrome** | escondido (formato reels) |

**Formato:** post Instagram/Reels (header + vídeo + ações + legenda).

| Campo | Valor |
|--------|--------|
| **author** | Carlão Personal das Estrelas |
| **handle** | `@oficial_carlaopersonal` |
| **likes** | `12.4 mil` |
| **h1 (legenda / headline)** | Seu plano já tá pronto 💛 dá o play que o paizão te conta tudo |

**Player:**
- **VTurb id:** `vid-6a31dcf23f5844587f036b0d`  
- **Script:** `…/players/6a31dcf23f5844587f036b0d/v4/player.js`  
- **CTA de compra:** **dentro do player VTurb** — **não há botão HTML próprio no quiz**  
- `CHECKOUT_URL` em `app.js` está **vazio** (`""`)

**Analytics:** `fbq('track', 'ViewContent', { content_name: 'oferta' })`

**O que faz no funil:** fechamento — plano “pronto” + pitch de oferta na VSL. Fim do funil front.

---

## 6. PERSONA — personalização (copy dinâmica)

Arquivo: `assets/js/quiz-data.js` → objeto `PERSONA`  
Motor: `app.js` resolve tokens no chart.

### 6.1 `{foco}` ← resposta `q2_foco`

| Resposta exata | Token injetado |
|----------------|----------------|
| Emagrecer e secar | secar |
| Tonificar e enrijecer o corpo | tonificar o corpo *(legado, opção fora do grid ativo)* |
| Os dois juntos | secar e tonificar |
| Ganhar massa | ganhar massa |
| _(fallback)_ | mudar de corpo |

### 6.2 `{primeiro}` ← resposta `q13_primeiro`

| Resposta exata | Token injetado |
|----------------|----------------|
| Barriga mais seca | a barriga mais seca |
| Corpo mais durinho e tonificado | o corpo mais durinho |
| Mais disposição e energia | mais disposição e energia |
| Tudo junto | tudo de uma vez |
| _(fallback)_ | o resultado que você quer |

### 6.3 `{empatia}` ← resposta `q5_trava`

| Resposta exata | Copy do card |
|----------------|--------------|
| Falta de motivação e disciplina | E dessa vez o paizão te cobra todo dia, viu? Você não larga mais sozinha. |
| Não sei o que fazer | E dessa vez você tem um passo a passo feito pra você. O paizão te guia em cada exercício. |
| Cansaço, chego sem energia | E esse plano respeita sua energia. No seu ritmo, sem te quebrar. |
| Falta de tempo | E ó: esse plano cabe na sua rotina. Sem desculpa, sem peso. |
| _(fallback)_ | E dessa vez você não vai tá sozinha. O paizão tá com você. 🧡 |

### 6.4 Nível “Hoje” da curva ← `q3_rotina`

| Resposta exata | level |
|----------------|-------|
| Eu treino, mas não vejo resultado | 0.30 |
| Já parei e voltei várias vezes | 0.22 |
| Nunca consegui manter constância | 0.16 |
| Tô começando agora | 0.10 |
| _(fallback)_ | 0.18 |

### 6.5 IMC (termômetro — sempre positivo)

| Faixa | Chip (`imcCat`) | Mensagem (`imc`) |
|-------|-----------------|------------------|
| abaixo | 🌱 com saúde | Tá tudo certo! Seu corpo tem espaço pra construir com saúde, no seu ritmo. O paizão vai te deixar tudo no lugar e durinha. |
| saudavel | ✅ faixa saudável | Olha que beleza! Seu corpo já tá na faixa saudável. Agora é o paizão te deixar tudo durinho e no lugar. |
| acima | 🔥 bora virar o jogo | Tá tudo certo! Seu corpo já tá pertinho da faixa ideal. E é exatamente aí que o paizão vira o jogo nas primeiras 4 semaninhas. |
| alto | 💪 cuidando de você | Tá tudo certo! Daqui pra frente é só ganho de saúde e leveza. E o paizão vai com você passo a passo, sem pressa e sem julgamento. |
| _(fallback)_ | ✨ ponto de partida | Esse é o seu ponto de partida. A partir daqui é só evolução com o paizão. |

---

## 7. Lógica de fluxo / redirecionamento

Arquivo principal: `assets/js/app.js`

### 7.1 Avanço de tela

| Trigger | Comportamento |
|---------|----------------|
| Tap em opção (`question`) | salva `state.answers[id] = optionText` → `next()` |
| CTA medidas | valida min/max → salva altura/peso/imc → `next()` |
| Fim de vídeo stories/testimonial/vsl | auto-avança (`videoLen` / evento player) |
| Loading | timeout `duration` (4200ms) → chart |
| CTA chart | `next()` → offer |
| Offer | permanece; checkout na VTurb |

### 7.2 Voltar
- Botão topbar `backBtn`  
- History API do browser  
- Drop-off no Supabase usa `GREATEST(last_step)` — voltar **não regride** o máximo alcançado  

### 7.3 Mapa de slugs (URL limpa)

| Identidade | Slug URL |
|------------|----------|
| q1_idade | `/pergunta-1` |
| q2_foco | `/pergunta-2` |
| q3_rotina | `/pergunta-3` |
| q4_porque | `/pergunta-4` |
| q5_trava | `/pergunta-5` |
| q7_deixou | `/pergunta-6` |
| q8_um_ano | `/pergunta-7` |
| q9_plano | `/pergunta-8` |
| q10_cobrando | `/pergunta-9` |
| q11_comunidade | `/pergunta-10` |
| q12_alimentacao | `/pergunta-11` |
| q13_primeiro | `/pergunta-12` |
| q14_compromisso | `/pergunta-13` |
| testimonial (Liz) | `/video-liz` |
| vsl (Mini VSL 1) | `/mini-vsl-1` |
| measure | `/medidas` |
| loading | `/montando` |
| chart | `/diagnostico` |
| offer (Mini VSL 2) | `/mini-vsl-2` |
| story Carlão (off) | `/video-carlao` |
| landing (off) | `/` |

**UTMs / fbclid:** capturados no load (`ENTRY_SEARCH`) e **reanexados** em todo `history.pushState` / `replaceState` para não sumirem da barra.

### 7.4 Sessão e deep-link

| Mecanismo | Detalhe |
|-----------|---------|
| `sessionStorage` `paizao_quiz_state` | `{ index, answers }` — refresh retoma |
| Deep-link sem ter alcançado a etapa | reinicia no índice 0 |
| `?s=N` | preview de design: pula direto pra etapa N |
| SPA rewrite | `vercel.json` → tudo cai em `index.html` |

### 7.5 Analytics por etapa

| Momento | Evento |
|---------|--------|
| Toda tela | `fbq trackCustom QuizStep` + `dataLayer quiz_step` |
| `loading` | `fbq Lead` · `content_name: quiz_completo` |
| `offer` | `fbq ViewContent` · `content_name: oferta` |

### 7.6 Supabase (leads)

Arquivo: `assets/js/supabase.js`  
Tabela: `paizao_quiz_leads` · RPC: `paizao_quiz_save`

| Quando | O que grava |
|--------|-------------|
| Cada resposta | colunas `q*` + jsonb `answers` |
| Medidas | `altura_cm`, `peso_kg`, `imc` |
| Cada render | `last_step`, `last_step_slug`, `last_step_label`, `last_step_at` |
| Loading (complete) | `completed`, `completed_at`, `foco_resolved` |
| 1ª gravação | UTMs, referrer, landing_path, user_agent |

**Regra de ouro:** falha de rede/DB **nunca** trava o quiz (fire-and-forget).

---

## 8. Tipos de tela suportados pelo motor

| `screen.type` | Render | Conta na barra? | Uso no funil ativo |
|---------------|--------|-----------------|--------------------|
| `landing` | H1 + img + CTA | não | OFF |
| `question` | opções / grid | **sim** | 13 telas |
| `story` | stories full-screen | não | OFF (Carlão) |
| `testimonial` | stories depoimento | não | Liz |
| `vsl` | vídeo (story se flag) | não | Mini VSL 1 |
| `measure` | inputs + CTA | não | medidas |
| `loading` | 3 batidas | não | transição |
| `chart` | curva + IMC + CTA | não | diagnóstico |
| `offer` | reels + VTurb | não | Mini VSL 2 |
| `letter` | carta (suportado) | não | não usado |

---

## 9. Resumo dos 3 vídeos

| # | Tela | Slug | Duração | Papel | CTA |
|---|------|------|---------|-------|-----|
| 6 | Liz (testimonial) | `/video-liz` | ~58s | Prova social aluna | auto-avança |
| 9 | Mini VSL 1 | `/mini-vsl-1` | ~166s | Autoridade + mecanismo | auto-avança |
| 19 | Mini VSL 2 | `/mini-vsl-2` | (na VTurb) | Oferta / pitch final | **botão dentro da VTurb** |

Players VTurb (account ConverteAI `00d6163e-e250-4c92-8e51-37b324f30ce8`):
- Liz: `6a313a5eb2d74681824e0933`
- Mini VSL 1: `6a43a1d5bee4e20d5948096d`
- Mini VSL 2: `6a31dcf23f5844587f036b0d`
- Story Carlão (off): `6a31eee31d8db4c8e4a5cc39`

---

## 10. Meta / SEO / pixels (`index.html`)

| Campo | Valor |
|--------|--------|
| **title** | Diagnóstico do Paizão · Carlão Personal |
| **description** | Descubra em 2 minutos por que você ainda não secou — e o plano que o paizão faria pra VOCÊ. |
| **theme-color** | `#0a0a0f` |
| **UTMify pixelId** | `6a341d1cb65aeb643445acc3` |
| **Supabase URL** | `https://ewnsttmmbcdzchzpxqjb.supabase.co` (em `supabase.js`) |

Cache bust (query strings no HTML no momento desta spec):
- `styles.css?v=84`
- `quiz-data.js?v=80`
- `supabase.js?v=79`
- `app.js?v=83`

---

## 11. Como bifurcar (checklist rápido)

1. Clonar o repo / criar branch.  
2. **Copy + ordem + opções + PERSONA:** editar só  
   `/Users/pedrocruz/Carlão - Quiz/assets/js/quiz-data.js`  
3. **Timer / rotas / analytics / chrome:**  
   `/Users/pedrocruz/Carlão - Quiz/assets/js/app.js`  
4. **Visual:**  
   `/Users/pedrocruz/Carlão - Quiz/assets/css/styles.css`  
5. **Brand fixa no header / timer copy HTML:**  
   `/Users/pedrocruz/Carlão - Quiz/index.html`  
6. Trocar imagens em `/Users/pedrocruz/Carlão - Quiz/assets/img/…`  
7. Trocar embeds VTurb nos screens `testimonial` / `vsl` / `offer`.  
8. Se mudar `id` de perguntas, alinhar `ANSWER_COLS` em `supabase.js` + migration.  
9. Bump `?v=` no `index.html` após deploy.

---

## 12. Contagem final

| Item | Qtd |
|------|-----|
| Telas ativas | **19** |
| Perguntas (`type: question`) | **13** |
| Vídeos | **3** (Liz, Mini VSL 1, Mini VSL 2) |
| Telas de sistema | **3** (medidas, loading, chart) |
| Telas desativadas | **2** (landing, story Carlão) |
| Checkout hardcode no app | vazio (CTA na VTurb da oferta) |

---

*Fim da spec. Fonte: `quiz-data.js`, `app.js`, `index.html`, `supabase.js`, `styles.css`, `vercel.json` no workspace Carlão - Quiz.*
