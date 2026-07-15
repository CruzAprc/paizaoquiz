# Dashboard de Analytics de Quiz (funil) — Spec de replicação

Guia pronto pra **copiar e colar** e recriar, em qualquer quiz, um painel de métricas
(KPIs, retenção por etapa, distribuição de respostas, origem do tráfego, leads recentes)
com **Supabase** (Postgres + Auth) e **front-end estático** (HTML/CSS/JS puro — sem framework).

> Placeholders pra trocar: `YOUR_SUPABASE_URL`, `YOUR_PUBLISHABLE_ANON_KEY`,
> `admin@seudominio.com`. A **anon/publishable key é pública** (pode ficar no front).
> Nunca coloque a `service_role`/PAT no front.

---

## 0. Brief (o que pedir pro dev / pra IA)

> "Quero um painel de analytics pro meu quiz. O quiz é estático (HTML/JS). Cada visita
> grava 1 lead no Supabase e a cada tela/resposta atualiza esse lead (upsert). Um painel
> protegido por login mostra: PageViews, % que iniciaram, % que chegaram na oferta,
> completaram, **funil de retenção por etapa** (com % passo-a-passo e drop), distribuição
> de respostas por pergunta, origem do tráfego (UTM) e uma tabela de leads recentes.
> **Regra crítica:** o painel NÃO baixa as linhas pro navegador — toda métrica é **agregada
> no servidor via RPC** e filtrada por **janela de data** (usa índice de `created_at`),
> pra carregar rápido mesmo com centenas de milhares de leads."

---

## 1. Arquitetura

```
[ Quiz estático ] --(rpc quiz_save)-->  [ Supabase: tabela quiz_leads ]
   grava/atualiza o lead a cada etapa           |
                                                | (rpc quiz_overview: agrega no SQL)
[ Painel /admin ] --login (Supabase Auth)-->  <-+  retorna ~KB de JSON já agregado
   renderiza KPIs / funil / respostas / origem / recentes
```

Princípios:
- **Escrita** (quiz → banco): via função `quiz_save` (SECURITY DEFINER) → o quiz (anon) grava
  sem precisar de SELECT, e os leads ficam **privados**.
- **Leitura** (painel): via função `quiz_overview` (SECURITY DEFINER) que **agrega no banco**
  e devolve JSON pequeno. O painel **nunca** faz `select *` da tabela inteira.
- **Janela de data** obrigatória em toda leitura (all-time em tabela grande estoura o
  `statement_timeout` de ~8s do Supabase).

---

## 2. Banco (Supabase → SQL Editor)

```sql
-- Tabela de leads (1 linha por sessão do quiz)
create table if not exists public.quiz_leads (
  id              uuid primary key,                     -- gerado no cliente (crypto.randomUUID)
  created_at      timestamptz not null default now(),
  session_id      text,
  answers         jsonb not null default '{}'::jsonb,   -- { "q1": "opção escolhida", "q2": "..." }
  last_step       int  not null default 0,              -- índice da tela mais avançada alcançada
  last_step_slug  text,                                 -- slug estável da tela (ex.: "pergunta-3", "oferta")
  last_step_label text,
  last_step_at    timestamptz,
  completed       boolean not null default false,
  completed_at    timestamptz,
  -- atribuição / origem
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  referrer text, landing_path text, user_agent text
);

-- Índices que sustentam a agregação por janela e o funil
create index if not exists idx_quiz_leads_created_at
  on public.quiz_leads (created_at desc);
create index if not exists idx_quiz_leads_last_step_slug
  on public.quiz_leads (last_step_slug);

-- RLS ligada e SEM policy de leitura => leads privados.
-- (o painel lê só via a RPC de agregação, que roda como dono e ignora RLS)
alter table public.quiz_leads enable row level security;
```

---

## 3. RPC de gravação — `quiz_save` (o quiz chama a cada etapa)

Upsert idempotente por `id` (gerado no cliente). Faz *patch parcial*: só sobrescreve o que
vier preenchido, e `last_step` só sobe (GREATEST), então "voltar" não regride o funil.

```sql
create or replace function public.quiz_save(p_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quiz_leads (id) values (p_id)
  on conflict (id) do nothing;

  update public.quiz_leads l set
    answers         = l.answers || coalesce(p_patch->'answers', '{}'::jsonb),
    last_step       = greatest(l.last_step, coalesce((p_patch->>'last_step')::int, l.last_step)),
    last_step_slug  = coalesce(p_patch->>'last_step_slug',  l.last_step_slug),
    last_step_label = coalesce(p_patch->>'last_step_label', l.last_step_label),
    last_step_at    = coalesce((p_patch->>'last_step_at')::timestamptz, l.last_step_at),
    completed       = l.completed or coalesce((p_patch->>'completed')::boolean, false),
    completed_at    = coalesce((p_patch->>'completed_at')::timestamptz, l.completed_at),
    utm_source   = coalesce(l.utm_source,   p_patch->>'utm_source'),
    utm_medium   = coalesce(l.utm_medium,   p_patch->>'utm_medium'),
    utm_campaign = coalesce(l.utm_campaign, p_patch->>'utm_campaign'),
    utm_content  = coalesce(l.utm_content,  p_patch->>'utm_content'),
    utm_term     = coalesce(l.utm_term,     p_patch->>'utm_term'),
    referrer     = coalesce(l.referrer,     p_patch->>'referrer'),
    landing_path = coalesce(l.landing_path, p_patch->>'landing_path'),
    user_agent   = coalesce(l.user_agent,   p_patch->>'user_agent')
  where l.id = p_id;
end $$;

revoke all on function public.quiz_save(uuid, jsonb) from public;
grant execute on function public.quiz_save(uuid, jsonb) to anon, authenticated;
```

---

## 4. RPC de agregação — `quiz_overview` (o painel chama; **o coração da escala**)

Recebe a janela `[p_from, p_to)` e devolve **tudo já agregado** num único JSON pequeno.
Escaneia só a janela (índice de `created_at`), então é rápido independentemente do tamanho
total da tabela. Nada de baixar linhas pro navegador.

```sql
create or replace function public.quiz_overview(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select * from public.quiz_leads
    where created_at >= p_from
      and (p_to is null or created_at < p_to)
  )
  select jsonb_build_object(
    'window',    jsonb_build_object('from', p_from, 'to', p_to),
    'pageviews', (select count(*) from base),
    'started',   (select count(*) from base where last_step >= 1),
    'completed', (select count(*) from base where completed),

    -- distribuição de onde cada lead PAROU (por slug). O cliente calcula o cumulativo.
    'funnel', (
      select coalesce(jsonb_agg(jsonb_build_object('slug', slug, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(last_step_slug,'(sem etapa)') slug, count(*) n
              from base group by 1) f
    ),

    -- distribuição de respostas por pergunta (genérico: itera as chaves do jsonb answers)
    'answers', (
      select coalesce(jsonb_agg(jsonb_build_object('question', q, 'answer', a, 'n', n)), '[]'::jsonb)
      from (select key q, value a, count(*) n
              from base, lateral jsonb_each_text(answers)
             group by key, value) x
    ),

    -- origem do tráfego (cascata simples: utm_source, senão "direto")
    'origins', (
      select coalesce(jsonb_agg(jsonb_build_object('source', src, 'n', n) order by n desc), '[]'::jsonb)
      from (select coalesce(nullif(utm_source,''), 'direto/sem utm') src, count(*) n
              from base group by 1) o
    ),

    -- 200 leads mais recentes (payload pequeno) pra tabela
    'recent', (
      select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
      from (select created_at, last_step_label, completed, utm_source, answers
              from base order by created_at desc limit 200) t
    )
  );
$$;

revoke all on function public.quiz_overview(timestamptz, timestamptz) from public;
grant execute on function public.quiz_overview(timestamptz, timestamptz) to authenticated;
```

---

## 5. Auth do painel (usuário admin)

Supabase Dashboard → **Authentication → Users → Add user** →
email `admin@seudominio.com` + senha, marque **Auto Confirm**. Só usuários autenticados
conseguem executar `quiz_overview`.

---

## 6. Tracking no quiz (arquivo drop-in `quiz-tracking.js`)

Inclua o SDK do Supabase antes: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`

```js
// quiz-tracking.js — grava/atualiza o lead a cada etapa
(function () {
  "use strict";
  const SUPABASE_URL = "YOUR_SUPABASE_URL";
  const SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_ANON_KEY"; // pública, ok no front
  const SS_KEY = "quiz_lead_id";

  const client = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    : null;

  // snapshot da URL de ENTRADA antes de qualquer limpeza de rota (preserva UTM/fbclid)
  const ENTRY_SEARCH = location.search || "";
  const ENTRY_PATH = location.pathname || "/";

  const newId = () => (crypto.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random()*16|0, v = c==="x"? r : (r&0x3|0x8); return v.toString(16); }));

  let leadId = sessionStorage.getItem(SS_KEY);
  if (!leadId) { leadId = newId(); try { sessionStorage.setItem(SS_KEY, leadId); } catch(e){} }

  let metaSent = false;
  function meta() {
    const p = new URLSearchParams(ENTRY_SEARCH), g = k => p.get(k) || null;
    return { utm_source:g("utm_source"), utm_medium:g("utm_medium"), utm_campaign:g("utm_campaign"),
             utm_content:g("utm_content"), utm_term:g("utm_term"),
             referrer: document.referrer || null,
             landing_path: (ENTRY_PATH + ENTRY_SEARCH) || null,
             user_agent: navigator.userAgent || null };
  }
  function save(patch) {
    if (!client) return;
    const body = Object.assign({}, patch);
    if (!metaSent) { Object.assign(body, meta()); metaSent = true; } // origem 1x
    client.rpc("quiz_save", { p_id: leadId, p_patch: body })
      .then(r => { if (r && r.error) console.warn("[tracking]", r.error.message); })
      .catch(()=>{});
  }

  window.QuizTracking = {
    // chame em TODA tela renderizada (a landing = índice 0 é o PageView)
    step(index, slug, label) {
      save({ last_step:index, last_step_slug:slug, last_step_label:label, last_step_at:new Date().toISOString() });
    },
    // chame a cada resposta; passe o objeto ACUMULADO de respostas { q1:..., q2:... }
    answer(allAnswers) { save({ answers: allAnswers }); },
    // chame ao concluir o quiz
    complete(allAnswers) { save({ answers: allAnswers, completed:true, completed_at:new Date().toISOString() }); },
  };
})();
```

**Como ligar no motor do quiz** (onde você troca de tela / registra resposta):
```js
// ao renderizar a tela i (inclui a landing):
QuizTracking.step(i, slugDaTela(i), rotuloDaTela(i));
// ao escolher uma opção:
answers[perguntaId] = valorEscolhido; QuizTracking.answer(answers);
// ao chegar na tela final:
QuizTracking.complete(answers);
```

---

## 7. Painel admin (`admin.html` + `admin.js`)

### 7.1 `admin.html` (esqueleto)
```html
<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Painel do Quiz</title></head>
<body>
  <div id="login"><form id="loginForm">
    <input id="email" type="email" placeholder="email" required>
    <input id="password" type="password" placeholder="senha" required>
    <button id="loginBtn">Entrar</button><p id="loginErr" hidden></p>
  </form></div>

  <div id="dash" hidden>
    <header>
      <h1>Quiz · Leads</h1><p id="dashSub">carregando…</p>
      <label>De <input id="fromDate" type="date"></label>
      <label>Até <input id="toDate" type="date"></label>
      <button id="reloadBtn">Atualizar</button><button id="logoutBtn">Sair</button>
    </header>
    <section id="kpis"></section>
    <section><h2>Retenção por etapa</h2><div id="funnel"></div></section>
    <section><h2>Respostas por pergunta</h2><div id="answers"></div></section>
    <section><h2>Origem</h2><div id="origins"></div></section>
    <section><h2>Leads recentes</h2><table><tbody id="leadsBody"></tbody></table></section>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="admin.js"></script>
</body></html>
```

### 7.2 `admin.js`
```js
(function () {
  "use strict";
  const SUPABASE_URL = "YOUR_SUPABASE_URL";
  const SUPABASE_ANON_KEY = "YOUR_PUBLISHABLE_ANON_KEY";

  // ORDEM das telas do seu quiz (slugs iguais aos que o tracking grava em last_step_slug).
  // Define como o funil é montado. Ajuste pro seu quiz:
  const STEP_ORDER = ["", "pergunta-1","pergunta-2","pergunta-3","pergunta-4",
                      "pergunta-5","video","pergunta-6","medidas","diagnostico","oferta"];
  const LABELS = { "":"PageView", "video":"Vídeo", "medidas":"Medidas",
                   "diagnostico":"Diagnóstico", "oferta":"Oferta" };
  const OFFER_SLUG = "oferta";

  const $ = id => document.getElementById(id);
  const pct = (n,d) => d>0 ? Math.round(n/d*100) : 0;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY,
    { auth: { persistSession:true, autoRefreshToken:true, storageKey:"quiz_admin_auth" } });

  // ---- Auth ----
  async function boot(){
    const s = await client.auth.getSession();
    if (s.data.session) { show(true); load(); } else show(false);
  }
  function show(dash){ $("login").hidden = dash; $("dash").hidden = !dash; }
  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault(); $("loginErr").hidden = true;
    const r = await client.auth.signInWithPassword({ email:$("email").value.trim(), password:$("password").value });
    if (r.error){ $("loginErr").textContent = "Login inválido: "+r.error.message; $("loginErr").hidden = false; return; }
    show(true); load();
  });
  $("logoutBtn").onclick = async () => { await client.auth.signOut(); show(false); };
  $("reloadBtn").onclick = () => load();
  ["fromDate","toDate"].forEach(id => $(id).addEventListener("change", load));

  // janela ativa: usa os inputs; se "De" vazio, cai pras últimas 24h
  function activeWindow(){
    const from = $("fromDate").value ? new Date($("fromDate").value+"T00:00:00").toISOString()
                                     : new Date(Date.now()-24*3600*1000).toISOString();
    const to = $("toDate").value ? new Date($("toDate").value+"T23:59:59").toISOString() : null;
    return { from, to };
  }

  // ---- Dados: UMA chamada agregada ----
  async function load(){
    $("dashSub").textContent = "carregando…";
    const w = activeWindow();
    const { data, error } = await client.rpc("quiz_overview", { p_from:w.from, p_to:w.to });
    if (error){ $("dashSub").textContent = "Erro: "+error.message; return; }
    render(data);
  }

  // ---- Render ----
  function render(d){
    // reached[i] = quantos alcançaram PELO MENOS a etapa i (cumulativo, a partir do "onde parou")
    const stopAt = {}; (d.funnel||[]).forEach(f => stopAt[f.slug] = f.n);
    const reached = STEP_ORDER.map(()=>0);
    for (let i=STEP_ORDER.length-1, acc=0; i>=0; i--){ acc += stopAt[STEP_ORDER[i]]||0; reached[i]=acc; }

    const pageviews = d.pageviews||0;
    const started   = reached[1]||0;
    const offerIdx  = Math.max(0, STEP_ORDER.indexOf(OFFER_SLUG));
    const reachedOffer = reached[offerIdx]||0;

    $("dashSub").textContent = pageviews + " pageviews · janela selecionada";
    $("kpis").innerHTML = [
      kpi("PageViews", pageviews, "abriram a landing"),
      kpi("Iniciaram", started, pct(started,pageviews)+"% dos pageviews"),
      kpi("Chegaram na oferta", reachedOffer, pct(reachedOffer,started)+"% dos que iniciaram"),
      kpi("Completaram", d.completed||0, ""),
    ].join("");

    // funil: retenção passo-a-passo + drop
    $("funnel").innerHTML = STEP_ORDER.slice(0, offerIdx+1).map((slug,i) => {
      const name = LABELS[slug] || ("Pergunta "+String(slug).replace("pergunta-",""));
      const cum  = pct(reached[i], reached[0]||1);
      const step = i>0 ? pct(reached[i], reached[i-1]||1) : 100;
      const drop = i>0 ? Math.max(0,(reached[i-1]||0)-reached[i]) : 0;
      return `<div class="fn"><b>${name}</b> — ${reached[i]} (${cum}%) · retenção ${step}%${drop?` · −${drop}`:""}</div>`;
    }).join("");

    // respostas por pergunta
    const byQ = {}; (d.answers||[]).forEach(a => (byQ[a.question] = byQ[a.question]||[]).push(a));
    $("answers").innerHTML = Object.keys(byQ).map(q => {
      const rows = byQ[q].sort((a,b)=>b.n-a.n), tot = rows.reduce((s,r)=>s+r.n,0);
      return `<div class="q"><b>${q}</b>` + rows.map(r =>
        `<div>${esc(r.answer)} — ${r.n} (${pct(r.n,tot)}%)</div>`).join("") + `</div>`;
    }).join("");

    // origem
    $("origins").innerHTML = (d.origins||[]).map(o =>
      `<div>${esc(o.source)} — ${o.n}</div>`).join("");

    // leads recentes
    $("leadsBody").innerHTML = (d.recent||[]).map(l =>
      `<tr><td>${new Date(l.created_at).toLocaleString()}</td>
           <td>${esc(l.last_step_label||"—")}</td>
           <td>${l.completed?"✓":"—"}</td>
           <td>${esc(l.utm_source||"—")}</td></tr>`).join("");
  }
  const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const kpi = (l,v,s) => `<div class="kpi"><b>${v}</b><span>${l}</span><small>${s}</small></div>`;

  boot();
})();
```

---

## 8. Definições das métricas

- **PageView** = 1 linha por carregamento da landing (o `step(0,...)` cria o lead). Baseline = 100%.
- **Iniciaram** = passaram da landing pra 1ª pergunta (`last_step >= 1`).
- **Chegaram na oferta** = alcançaram a etapa `OFFER_SLUG` (fundo de funil confiável).
- **Completaram** = flag `completed=true` (marcada na última tela). Pode subcontar se a tela
  final for pulada em reload — prefira "Chegaram na oferta" como fundo de funil.
- **Retenção por etapa** = `reached[i]/reached[i-1]` (passo-a-passo) e `reached[i]/PageView` (acumulado).
- **Drop** = quantos se perderam de uma etapa pra próxima.

`reached[i]` é cumulativo: soma de quem **parou em i ou depois**. Por isso o funil é montado
a partir da distribuição de `last_step_slug` + a ordem `STEP_ORDER` (definida no cliente,
estável a reordenações de tela).

---

## 9. Regras de ouro (o que faz escalar / não quebrar)

1. **Agregue no servidor, sempre.** Nunca faça `select *` da tabela no painel. Em quiz com
   tráfego pago é fácil passar de dezenas de milhares de leads/dia; baixar isso pro navegador
   trava (dezenas de MB + dezenas de round-trips). A RPC devolve ~KB.
2. **Sempre com janela de data.** All-time em tabela grande faz seq scan e estoura o
   `statement_timeout` (~8s no Supabase). O painel abre no dia de hoje por padrão.
3. **Índice em `created_at`.** É o que torna a agregação por janela rápida.
4. **`last_step` só sobe (GREATEST)** — "voltar" não deve regredir o funil.
5. **Slug estável por tela** (não índice numérico) — sobrevive a adicionar/remover telas.
6. **Snapshot dos UTMs na entrada**, antes de qualquer `history.replaceState` que limpe a URL.
7. **Leads privados**: RLS ligada, sem policy de SELECT; escreve via `quiz_save`, lê via
   `quiz_overview` (ambas SECURITY DEFINER). Só a **anon key** (pública) vai no front.
8. **Cache-busting**: versione os assets (`admin.js?v=2`) pra o navegador pegar updates.
9. **Tráfego de bot infla PageViews** (rows criadas no load da landing por prefetch/bots).
   Use "Iniciaram" (passou da landing) como denominador "real" quando fizer sentido.
10. **All-time de verdade?** Se algum dia precisar, use uma **tabela-resumo** (materialized
    view / cron que agrega por dia), não uma varredura ao vivo.

---

## 10. Checklist de implantação

- [ ] Rodar o SQL da seção 2 (tabela + índices + RLS).
- [ ] Rodar `quiz_save` (seção 3) e `quiz_overview` (seção 4) + os grants.
- [ ] Criar o usuário admin (seção 5).
- [ ] Incluir o SDK do Supabase + `quiz-tracking.js` no quiz; chamar `step/answer/complete`.
- [ ] Ajustar `STEP_ORDER`, `LABELS`, `OFFER_SLUG` no `admin.js` pra bater com as telas do quiz.
- [ ] Trocar `YOUR_SUPABASE_URL` / `YOUR_PUBLISHABLE_ANON_KEY` nos dois arquivos.
- [ ] Publicar `admin.html` numa rota protegida (ex.: `/admin`) com `noindex`.
- [ ] Testar: abrir o quiz gera 1 lead; responder atualiza; o painel carrega em ~2-3s.

---

Pronto pra colar. Qualquer campo extra (ex.: altura/peso, vídeo, vendas) é só adicionar
uma coluna/chave no `answers` e um bloco no `quiz_overview` + no render.
