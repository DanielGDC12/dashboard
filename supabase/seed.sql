-- Primeiro(s) usuário(s) da whitelist. Ajuste os e-mails antes de rodar.
insert into public.allowed_users (email, full_name, role)
values
  ('admin@mantiqueirabrasil.com.br', 'Administrador', 'gestao')
on conflict (email) do nothing;
