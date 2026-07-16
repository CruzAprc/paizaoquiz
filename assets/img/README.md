# Imagens do quiz — onde colocar cada foto

Suba os arquivos com EXATAMENTE estes nomes (ou ajuste os caminhos no `quiz-data.js`).
Enquanto não subir, aparece um placeholder estiloso no lugar.

| Arquivo                | Onde aparece                          | Formato sugerido        |
|------------------------|---------------------------------------|-------------------------|
| `carlao-avatar.jpg`    | Avatar IG (topbar + landing) — **já baixado do @oficial_carlaopersonal** | quadrada, rosto |
| `liz-avatar.jpg`       | Avatar do depoimento (Break 2) — **já baixado do @lizx.macedo** | quadrada, rosto |
| `carlao-landing.png`   | Landing — figura recortada (s/ fundo) | PNG com transparência   |
| `antes-depois-1.jpg`   | Break 1 (carta) — antes/depois filhota| paisagem 16:10          |
| `depoimento-liz.jpg`   | Break 2 — frame de capa do vídeo da Liz (poster) | retrato 4:5    |
| `antes-depois-2.jpg`   | Q14 (compromisso) — "4 semaninhas"    | paisagem 16:10          |

## Cards P12 — “o que quer notar primeiro” (igual grade da P1 idade)

Pasta: `assets/img/primeiro/` — **mesma regra da P1**.

| Arquivo | Label no card |
|---------|----------------|
| `primeiro-barriga.webp` | Barriga |
| `primeiro-bumbum.webp` | Bumbum |
| `primeiro-coxas.webp` | Coxas |
| `primeiro-tudo.webp` | Tudo junto |

### Spec (igual P1 / idade)

| Spec | Valor |
|------|--------|
| **Formato** | **WebP** (preferencial) ou PNG/JPG exportado em WebP |
| **Tamanho px** | **420 × ~320–330** (paisagem ~4:3) — HTML usa `width="420" height="320"` |
| **Enquadramento** | Pessoa / região do corpo **inteira visível**, apoiada na base (como idade: `object-fit: contain`, center bottom) |
| **Fundo** | Claro / lavanda suave (cards já têm gradiente atrás) — ideal **fundo removido ou limpo** |
| **Peso** | Alvo **~6–30 KB** cada (idade está ~5–7 KB; foco ~17–50 KB) |
| **Nomes** | Exatos na tabela acima (senão o grid quebra) |

Hoje tem **placeholder** (cópia de `corpo/*`) até você mandar as 4 finais.

## Vídeos (Mini VSL 1 e 2)
Não vão em `/img`. Quando tiver o vídeo, cole o `<iframe>`/embed direto no campo
`embed:` da tela correspondente em `assets/js/quiz-data.js` (procure por `embed: null`).
