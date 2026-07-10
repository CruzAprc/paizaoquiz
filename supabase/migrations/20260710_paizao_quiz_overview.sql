-- ============================================================================
-- PAINEL /pedro — agregação no servidor (1 RPC = ~KB de JSON)
-- Rode UMA VEZ no Supabase → SQL Editor → Run.
-- Depois o admin.js chama: rpc('paizao_quiz_overview', { p_from, p_to, p_origin })
-- ============================================================================

-- Origem derivada (espelha a cascata do admin.js)
create or replace function public.paizao_lead_origem(
  p_utm text,
  p_landing text,
  p_ref text,
  p_ua text
) returns text
language sql
immutable
parallel safe
as $$
  select case
    when nullif(btrim(p_utm), '') is not null then btrim(p_utm)
    when coalesce(p_landing, '') ~* '[?&]utm_source=' then
      coalesce(
        nullif(substring(p_landing from '[?&]utm_source=([^&]+)'), ''),
        'Direto / sem origem'
      )
    when coalesce(p_landing, '') ~* '[?&]fbclid=' then 'facebook'
    when coalesce(p_ref, '') ilike '%instagram%' then 'Instagram'
    when coalesce(p_ref, '') ilike '%facebook%'
      or coalesce(p_ref, '') ilike '%fb.%'
      or coalesce(p_ref, '') ilike '%l.facebook%' then 'Facebook'
    when coalesce(p_ref, '') ilike '%google%' then 'Google (orgânico)'
    when coalesce(p_ref, '') ilike '%youtube%'
      or coalesce(p_ref, '') ilike '%youtu.be%' then 'YouTube'
    when coalesce(p_ref, '') ilike '%tiktok%' then 'TikTok'
    when coalesce(p_ref, '') ilike '%whatsapp%'
      or coalesce(p_ref, '') ilike '%wa.me%' then 'WhatsApp'
    when coalesce(p_ua, '') ilike '%instagram%' then 'Instagram (app)'
    when coalesce(p_ua, '') ilike '%fban%'
      or coalesce(p_ua, '') ilike '%fbav%'
      or coalesce(p_ua, '') ilike '%fb_iab%' then 'Facebook (app)'
    when coalesce(p_ua, '') ilike '%tiktok%'
      or coalesce(p_ua, '') ilike '%musical_ly%' then 'TikTok (app)'
    else 'Direto / sem origem'
  end;
$$;

create or replace function public.paizao_quiz_overview(
  p_from timestamptz,
  p_to timestamptz default null,
  p_origin text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result jsonb;
begin
  -- só autenticado (painel) ou service_role
  if auth.role() is distinct from 'authenticated'
     and auth.role() is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;

  -- janelas de 1 dia com dezenas de milhares de leads precisam de mais que 8s
  perform set_config('statement_timeout', '120s', true);

  with
  base0 as (
    select
      l.created_at,
      l.completed,
      l.last_step,
      l.last_step_slug,
      l.last_step_label,
      l.utm_source,
      l.landing_path,
      l.referrer,
      l.user_agent,
      l.imc,
      l.q1_idade, l.q2_foco, l.q3_rotina, l.q4_porque, l.q5_trava,
      l.q6_sozinha, l.q7_deixou, l.q8_um_ano, l.q9_plano, l.q10_cobrando,
      l.q11_comunidade, l.q12_alimentacao, l.q13_primeiro, l.q14_compromisso,
      public.paizao_lead_origem(l.utm_source, l.landing_path, l.referrer, l.user_agent) as origem
    from public.paizao_quiz_leads l
    where l.created_at >= p_from
      and (p_to is null or l.created_at < p_to)
  ),
  base as (
    select * from base0
    where p_origin is null
       or btrim(p_origin) = ''
       or origem = p_origin
  ),
  kpis as (
    select
      count(*)::int as pageviews,
      count(*) filter (where coalesce(last_step, 0) >= 1
                         or nullif(last_step_slug, '') is not null)::int as started,
      count(*) filter (where completed is true)::int as completed
    from base
  ),
  funnel as (
    select coalesce(nullif(last_step_slug, ''), '(sem etapa)') as slug,
           count(*)::int as n
    from base
    group by 1
  ),
  origins as (
    select origem as source, count(*)::int as n
    from base
    group by 1
  ),
  answers as (
    select q, a, count(*)::int as n
    from (
      select 'q1_idade' q, q1_idade::text a from base where q1_idade is not null and q1_idade::text <> ''
      union all select 'q2_foco', q2_foco::text from base where q2_foco is not null and q2_foco::text <> ''
      union all select 'q3_rotina', q3_rotina::text from base where q3_rotina is not null and q3_rotina::text <> ''
      union all select 'q4_porque', q4_porque::text from base where q4_porque is not null and q4_porque::text <> ''
      union all select 'q5_trava', q5_trava::text from base where q5_trava is not null and q5_trava::text <> ''
      union all select 'q6_sozinha', q6_sozinha::text from base where q6_sozinha is not null and q6_sozinha::text <> ''
      union all select 'q7_deixou', q7_deixou::text from base where q7_deixou is not null and q7_deixou::text <> ''
      union all select 'q8_um_ano', q8_um_ano::text from base where q8_um_ano is not null and q8_um_ano::text <> ''
      union all select 'q9_plano', q9_plano::text from base where q9_plano is not null and q9_plano::text <> ''
      union all select 'q10_cobrando', q10_cobrando::text from base where q10_cobrando is not null and q10_cobrando::text <> ''
      union all select 'q11_comunidade', q11_comunidade::text from base where q11_comunidade is not null and q11_comunidade::text <> ''
      union all select 'q12_alimentacao', q12_alimentacao::text from base where q12_alimentacao is not null and q12_alimentacao::text <> ''
      union all select 'q13_primeiro', q13_primeiro::text from base where q13_primeiro is not null and q13_primeiro::text <> ''
      union all select 'q14_compromisso', q14_compromisso::text from base where q14_compromisso is not null and q14_compromisso::text <> ''
    ) x
    group by 1, 2
  ),
  recent as (
    select
      created_at, completed, last_step, last_step_slug, last_step_label,
      utm_source, landing_path, referrer, user_agent, imc, origem,
      q1_idade, q2_foco, q3_rotina, q4_porque, q5_trava, q6_sozinha,
      q7_deixou, q8_um_ano, q9_plano, q10_cobrando, q11_comunidade,
      q12_alimentacao, q13_primeiro, q14_compromisso
    from base
    order by created_at desc
    limit 200
  ),
  purch as (
    select
      p.created_at, p.event, p.status, p.value, p.email,
      p.utm_source, p.utm_campaign, p.fbclid,
      coalesce(nullif(btrim(p.utm_source), ''), case when p.fbclid is not null then 'facebook' else '(sem origem)' end) as origem
    from public.paizao_purchases p
    where p.created_at >= p_from
      and (p_to is null or p.created_at < p_to)
      and (
        p_origin is null or btrim(p_origin) = ''
        or coalesce(nullif(btrim(p.utm_source), ''), case when p.fbclid is not null then 'facebook' else '(sem origem)' end) = p_origin
      )
  ),
  purch_kpis as (
    select
      count(*)::int as events,
      count(*) filter (
        where (coalesce(event,'') || ' ' || coalesce(status,'')) ~* 'approv|aprovad|paid|pago|complete|SALE_APPROVED'
      )::int as approved,
      coalesce(sum(value) filter (
        where (coalesce(event,'') || ' ' || coalesce(status,'')) ~* 'approv|aprovad|paid|pago|complete|SALE_APPROVED'
      ), 0)::numeric as receita
    from purch
  ),
  purch_by_utm as (
    select origem as source,
           coalesce(sum(value), 0)::numeric as receita,
           count(*)::int as n
    from purch
    where (coalesce(event,'') || ' ' || coalesce(status,'')) ~* 'approv|aprovad|paid|pago|complete|SALE_APPROVED'
    group by 1
  ),
  purch_recent as (
    select created_at, event, status, value, email, utm_source, utm_campaign, origem
    from purch
    order by created_at desc
    limit 100
  )
  select jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to, 'origin', p_origin),
    'pageviews', (select pageviews from kpis),
    'started',   (select started from kpis),
    'completed', (select completed from kpis),
    'funnel', coalesce((
      select jsonb_agg(jsonb_build_object('slug', slug, 'n', n) order by n desc)
      from funnel
    ), '[]'::jsonb),
    'origins', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'n', n) order by n desc)
      from origins
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('question', q, 'answer', a, 'n', n))
      from answers
    ), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(to_jsonb(r)) from recent r
    ), '[]'::jsonb),
    'sales', jsonb_build_object(
      'events',   (select events from purch_kpis),
      'approved', (select approved from purch_kpis),
      'receita',  (select receita from purch_kpis),
      'by_utm', coalesce((
        select jsonb_agg(jsonb_build_object('source', source, 'receita', receita, 'n', n) order by receita desc)
        from purch_by_utm
      ), '[]'::jsonb),
      'recent', coalesce((
        select jsonb_agg(to_jsonb(pr)) from purch_recent pr
      ), '[]'::jsonb)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.paizao_lead_origem(text, text, text, text) from public;
revoke all on function public.paizao_quiz_overview(timestamptz, timestamptz, text) from public;

grant execute on function public.paizao_lead_origem(text, text, text, text) to authenticated, service_role;
grant execute on function public.paizao_quiz_overview(timestamptz, timestamptz, text) to authenticated, service_role;

-- índice (se ainda não existir) — acelera a janela de datas
create index if not exists idx_paizao_quiz_leads_created_at
  on public.paizao_quiz_leads (created_at desc);

create index if not exists idx_paizao_purchases_created_at
  on public.paizao_purchases (created_at desc);
