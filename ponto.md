# Ponto — Modificações no Quiz do Carlão (handoff p/ outro agent)

Contexto: quiz estático (HTML/CSS/JS puro). Toda a copy do quiz vive em
`assets/js/quiz-data.js`. O motor de render é `assets/js/app.js`.
Servido localmente em `http://localhost:8831` (`python3 -m http.server 8831`).

**Base do git:** estas mudanças foram aplicadas EM CIMA do `origin/main` `c95b747`
(após `git pull`). Ainda **não foram commitadas** — estão só no working tree.

## Objetivo desta rodada
1. **Remover "filhota"/"filhotas"** de TODO o texto visível do quiz.
2. **Remover o travessão (—)** da copy visível.
3. **Trocar "teu/tua"** por "seu/sua" (nada de "tu"). "te" (pronome oblíquo) foi
   MANTIDO de propósito — é coloquial padrão no Brasil mesmo com "você".
4. **Botão da landing** = "Iniciar avaliação gratuita".
5. Reescrever as frases pra manter a gramática natural (não foi só apagar palavra).

> Ocorrências de "filhota"/"—" que ainda existem no código estão **só em comentários
> internos** (`/* */`, `//`) e em comentários de HTML — não aparecem pro usuário.

---

## Mudanças aplicadas

### `assets/js/quiz-data.js`

**Landing**
- `h1`: removido "Filhota," → "Descubra por que seu corpo não sai do lugar e como eu vou mudar isso em 4 semaninhas."
- `cta`: → **"Iniciar avaliação gratuita"**
- `imageAlt`: "Carlão e filhota" → "Carlão Personal"

**Perguntas** — removido o vocativo "filhota":
- q1 idade, q2 foco, q4 porque, q7 deixou, q9 plano, q11 comunidade, q12 alimentação, q14 compromisso, measure (altura/peso).
- q11: "família de filhotas" → **"família de mulheres"**.

**Testimonial / Loading / Chart / Offer**
- `topSub`: "filhota do paizão" → "aluna do paizão"
- loading `intro/text/done`: removido ", filhota"
- chart `subtitle`: removido ", filhota"; `cta`: "...toca aqui, filhota" → "...toca aqui"
- offer `h1`: "Filhota, teu plano..." → "Seu plano já tá pronto 💛 dá o play que o paizão te conta tudo"

**PERSONA.imc** — removido ", filhota" e "Teu"→"Seu":
- abaixo/saudavel/acima/alto/_default ("Teu corpo" → "Seu corpo")

**PERSONA.empatia** — removido ", filhota" em Cansaço / Falta de tempo / _default.

### `assets/js/app.js`
- `<small>filhota do paizão</small>` → "aluna do paizão"
- placeholder slot vídeo: `s.author || "filhota"` → `"aluna"`
- fallback `topSub`: "filhota do paizão" → "aluna do paizão"
- erro measure: "...certinho, filhota 🙏" → "...certinho 🙏"

---

## Decisões de redação
- "filhota do paizão" → **"aluna do paizão"**; "família de filhotas" → **"família de mulheres"**.
- "teu/tua" → "seu/sua". **"te" mantido** (coloquial BR, não é "tu").
- Travessão (—) → ponto/vírgula na copy (a maioria já vinha limpa do remoto).
- Tom "paizão" **mantido**; só o vocativo "filhota" saiu.

## Como testar
1. `cd "Carlão - Quiz" && python3 -m http.server 8831`
2. `http://localhost:8831` (hard refresh Cmd+Shift+R p/ furar o cache `?v=` do JS).

## Pendências / sugestões
- (Opcional) limpar "filhota"/"—" também dos **comentários** do código.
- Cache: JS é versionado por `?v=NN` no `index.html`. Se cache teimar em prod, subir a versão.
- **Commit/push ainda não feitos** — combinar com o Pedro antes de subir.
