-- ============================================================================
-- FUNIL /insta — tabela de criadoras + RPC de save (security definer)
-- Rode UMA VEZ no Supabase → SQL Editor → Run.
-- ============================================================================

create table if not exists public.paizao_insta_leads (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- redes
  instagram_handle text,
  instagram_followers text,
  tiktok_handle text,
  tiktok_followers text,

  -- perguntas finais
  ja_fez_publi text,
  conhece_app_paizao text,

  -- dump completo
  answers jsonb not null default '{}'::jsonb,

  -- drop-off
  last_step int,
  last_step_slug text,
  last_step_label text,
  last_step_at timestamptz,

  completed boolean not null default false,
  completed_at timestamptz,

  -- atribuição
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  landing_path text,
  user_agent text
);

create index if not exists paizao_insta_leads_created_at_idx
  on public.paizao_insta_leads (created_at desc);

create index if not exists paizao_insta_leads_completed_idx
  on public.paizao_insta_leads (completed, created_at desc);

alter table public.paizao_insta_leads enable row level security;

-- anon NÃO lê nem escreve direto; escrita só via RPC security definer
revoke all on public.paizao_insta_leads from anon;
grant select on public.paizao_insta_leads to authenticated;

create or replace function public.paizao_insta_save(
  p_id uuid,
  p_patch jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.paizao_insta_leads as t (id)
  values (p_id)
  on conflict (id) do nothing;

  update public.paizao_insta_leads as t
  set
    updated_at = now(),
    instagram_handle     = coalesce(p_patch->>'instagram_handle', t.instagram_handle),
    instagram_followers  = coalesce(p_patch->>'instagram_followers', t.instagram_followers),
    tiktok_handle        = coalesce(p_patch->>'tiktok_handle', t.tiktok_handle),
    tiktok_followers     = coalesce(p_patch->>'tiktok_followers', t.tiktok_followers),
    ja_fez_publi         = coalesce(p_patch->>'ja_fez_publi', t.ja_fez_publi),
    conhece_app_paizao   = coalesce(p_patch->>'conhece_app_paizao', t.conhece_app_paizao),
    answers              = case
                             when p_patch ? 'answers' then coalesce(t.answers, '{}'::jsonb) || (p_patch->'answers')
                             else t.answers
                           end,
    last_step            = case
                             when (p_patch->>'last_step') ~ '^[0-9]+$'
                               then greatest(coalesce(t.last_step, 0), (p_patch->>'last_step')::int)
                             else t.last_step
                           end,
    last_step_slug       = coalesce(p_patch->>'last_step_slug', t.last_step_slug),
    last_step_label      = coalesce(p_patch->>'last_step_label', t.last_step_label),
    last_step_at         = coalesce((p_patch->>'last_step_at')::timestamptz, t.last_step_at),
    completed            = case
                             when p_patch ? 'completed' then coalesce((p_patch->>'completed')::boolean, t.completed)
                             else t.completed
                           end,
    completed_at         = coalesce((p_patch->>'completed_at')::timestamptz, t.completed_at),
    utm_source           = coalesce(p_patch->>'utm_source', t.utm_source),
    utm_medium           = coalesce(p_patch->>'utm_medium', t.utm_medium),
    utm_campaign         = coalesce(p_patch->>'utm_campaign', t.utm_campaign),
    utm_content          = coalesce(p_patch->>'utm_content', t.utm_content),
    utm_term             = coalesce(p_patch->>'utm_term', t.utm_term),
    referrer             = coalesce(p_patch->>'referrer', t.referrer),
    landing_path         = coalesce(p_patch->>'landing_path', t.landing_path),
    user_agent           = coalesce(p_patch->>'user_agent', t.user_agent)
  where t.id = p_id;
end;
$$;

-- permite chamada anônima da publishable key (só essa RPC de save)
revoke all on function public.paizao_insta_save(uuid, jsonb) from public;
grant execute on function public.paizao_insta_save(uuid, jsonb) to anon, authenticated;

-- leitura pro painel (/pedroinstagram) — usuário autenticado (mesmo login do /pedro)
drop policy if exists "painel autenticado pode ler insta" on public.paizao_insta_leads;
drop policy if exists paizao_insta_leads_auth_select on public.paizao_insta_leads;
create policy "painel autenticado pode ler insta"
  on public.paizao_insta_leads
  for select
  to authenticated
  using (true);

-- RPC de listagem (security definer) — preferida pelo painel
create or replace function public.paizao_insta_list(
  p_limit int default 1000
)
returns setof public.paizao_insta_leads
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.role() is distinct from 'authenticated'
     and auth.role() is distinct from 'service_role' then
    raise exception 'not allowed';
  end if;
  return query
    select *
    from public.paizao_insta_leads
    order by created_at desc
    limit greatest(1, least(coalesce(p_limit, 1000), 5000));
end;
$$;

revoke all on function public.paizao_insta_list(int) from public;
grant execute on function public.paizao_insta_list(int) to authenticated, service_role;

comment on table public.paizao_insta_leads is
  'Leads do funil /insta (criadoras). Separado de paizao_quiz_leads.';
