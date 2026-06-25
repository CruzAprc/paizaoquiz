# Notas de teste — alterações temporárias

## 🎬 Vídeo do Paizão (story após a pergunta 3) — DESATIVADO

**O que foi feito:** o "Vídeo Carlão" (tela `type: "story"` que aparecia logo depois
da pergunta 3 / `q3_rotina`) foi **comentado** para testar o funil sem ele. Agora o quiz
pula direto da **pergunta 3** para a **pergunta 4** (`q4_porque`).

**Onde está:** `assets/js/quiz-data.js`, logo após o bloco da pergunta 3.
Procure pelo marcador:

```
/* >>> TESTE: Vídeo Carlão (story) DESATIVADO temporariamente — pula da q3 direto pra q4.
       Pra reativar, é só descomentar este bloco. <<< */
/*
{
  type: "story",
  topName: "Carlão Personal das Estrelas",
  ...
},
*/
```

**Como REATIVAR o vídeo:**
1. Abra `assets/js/quiz-data.js`.
2. Encontre o bloco marcado com `>>> TESTE: Vídeo Carlão ... <<<`.
3. Apague a linha de abertura `/*` (logo abaixo do marcador) e a linha de fechamento `*/`
   (logo após o `},` do objeto `story`). Ou seja: tire o comentário de bloco que envolve
   o objeto `{ type: "story", ... }`.
4. Pode apagar também a linha do marcador `>>> TESTE ... <<<`.
5. Suba o número de versão dos scripts no `index.html` (`?v=NN`) para furar o cache do navegador.

Depois disso o vídeo volta a aparecer entre a pergunta 3 e a pergunta 4, como antes.
