-- =============================================================================
-- Painel de Entregas · Autenticação
-- Whitelist de usuários, dispositivos confiáveis e trilha de auditoria.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Perfis (Figma "10 · Usuários e auditoria": Gestão, Logística, Atendimento)
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('gestao', 'logistica', 'atendimento');

-- ---------------------------------------------------------------------------
-- 2. Whitelist — só e-mails ativos aqui podem entrar no painel
-- ---------------------------------------------------------------------------
create table public.allowed_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(btrim(email))),
  full_name   text,
  role        public.user_role not null default 'atendimento',
  active      boolean not null default true,
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.allowed_users is
  'Whitelist do Painel de Entregas. Apenas e-mails com active = true podem fazer login.';

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger allowed_users_touch
  before update on public.allowed_users
  for each row execute function public.touch_updated_at();

alter table public.allowed_users enable row level security;

-- Cada usuário logado lê apenas a própria linha (o app usa service role para o resto).
create policy "allowed_users: ler a própria linha"
  on public.allowed_users for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));

-- Helper para políticas RLS das próximas tabelas (áreas, versões, etc.).
create or replace function public.is_allowed_user()
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.allowed_users
    where email = lower(auth.jwt() ->> 'email') and active
  );
$$;

revoke all on function public.is_allowed_user() from public, anon;
grant execute on function public.is_allowed_user() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Auth Hook "Before User Created"
--    Defesa em profundidade: mesmo chamando a API do Supabase diretamente com a
--    publishable key, ninguém fora da whitelist consegue criar conta.
--    Ativar em Dashboard › Authentication › Hooks › Before User Created
--    (Postgres function: public.hook_before_user_created).
-- ---------------------------------------------------------------------------
create or replace function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(event -> 'user' ->> 'email'));
begin
  if v_email is null or not exists (
    select 1 from public.allowed_users where email = v_email and active
  ) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Este e-mail não tem acesso ao Painel de Entregas.'
      )
    );
  end if;
  return '{}'::jsonb;
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Dispositivos confiáveis ("Confiar neste computador por 30 dias")
--    Guarda só o SHA-256 do token; o token vai num cookie httpOnly.
--    Sem políticas: só o servidor (service role) lê/escreve.
-- ---------------------------------------------------------------------------
create table public.trusted_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  token_hash    text not null unique,
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);

create index trusted_devices_user_idx on public.trusted_devices (user_id);
alter table public.trusted_devices enable row level security;

-- ---------------------------------------------------------------------------
-- 5. Trilha de auditoria imutável (eventos de login)
-- ---------------------------------------------------------------------------
create table public.auth_audit_log (
  id          bigint generated always as identity primary key,
  event       text not null,
  email       text,
  user_id     uuid,
  ip          text,
  user_agent  text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index auth_audit_log_email_idx on public.auth_audit_log (email, created_at desc);
alter table public.auth_audit_log enable row level security;

create or replace function public.prevent_audit_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'auth_audit_log é imutável';
end $$;

create trigger auth_audit_log_immutable
  before update or delete on public.auth_audit_log
  for each row execute function public.prevent_audit_mutation();

revoke update, delete, truncate on public.auth_audit_log from public, anon, authenticated, service_role;
