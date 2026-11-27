-- =============================================================================
-- Painel de Entregas · Login só por MFA após o primeiro acesso
--
-- Primeiro acesso: e-mail → código por e-mail → cadastro do app autenticador.
-- Acessos seguintes: e-mail → código do app autenticador (TOTP), sem e-mail.
--
-- O servidor precisa saber, antes de qualquer sessão, se o e-mail já tem um
-- autenticador verificado. Esta função lê auth.users/auth.mfa_factors e só pode
-- ser chamada com a service role (nunca pelo navegador).
-- =============================================================================
create or replace function public.auth_login_status(p_email text)
returns table (user_id uuid, totp_factor_id uuid)
language sql stable security definer set search_path = '' as $$
  select u.id, f.id
  from auth.users u
  left join auth.mfa_factors f
    on f.user_id = u.id
   and f.factor_type = 'totp'
   and f.status = 'verified'
  where u.email = lower(btrim(p_email))
    and u.deleted_at is null
  order by f.created_at desc nulls last
  limit 1;
$$;

revoke all on function public.auth_login_status(text) from public, anon, authenticated;
grant execute on function public.auth_login_status(text) to service_role;

comment on function public.auth_login_status(text) is
  'Login do painel: devolve o usuário e o fator TOTP verificado (se houver) de um e-mail. Só service role.';

-- Contagem rápida de falhas recentes de MFA por e-mail (bloqueio de tentativas).
create index if not exists auth_audit_log_event_email_idx
  on public.auth_audit_log (event, email, created_at desc);
