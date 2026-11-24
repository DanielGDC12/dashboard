# Painel de Entregas · Mantiqueira em Casa

Backoffice interno para a equipe Mantiqueira definir **onde e quando os ovos chegam**.
Stack: **Next.js 16 (App Router) + Supabase**, deploy na **Vercel**.
Design: Figma *Mantiqueira em Casa* › `NOV/26 · Painel de Entregas` (fileKey `htCQ6ocQEE928Ryv1UmMcJ`).

## Login + MFA (tela `01 · Login + MFA`, node `2868:306`)

Fluxo sem senha, em 3 etapas:

1. **E-mail** → o servidor confere a **whitelist** (`public.allowed_users`, `active = true`).
   Fora da lista: login negado e registrado na auditoria.
2. **Código** → Supabase envia um código de 6 dígitos por e-mail (`signInWithOtp` / `verifyOtp`).
   A whitelist é conferida de novo (caso o usuário tenha sido desativado nesse meio-tempo).
3. **Autenticador (TOTP)** → Google/Microsoft Authenticator via Supabase MFA.
   - Primeiro acesso: QR code para cadastrar o app (enroll).
   - **"Confiar neste computador por 30 dias"**: cria um token aleatório (cookie `httpOnly`;
     só o SHA-256 fica em `public.trusted_devices`). Nos próximos logins desse computador,
     o código por e-mail continua obrigatório, mas o TOTP é pulado.

### Camadas da whitelist

| Camada | Onde | O que bloqueia |
|---|---|---|
| Server Action | `src/app/login/actions.ts` | Não envia código para e-mail fora da lista |
| Auth Hook *Before User Created* | `public.hook_before_user_created` | Criação de conta direto pela API do Supabase |
| Data Access Layer | `src/lib/auth/dal.ts` → `requireUser()` | Toda página/ação: sessão + whitelist ativa + (aal2 **ou** computador confiável) |
| RLS (próximas tabelas) | `public.is_allowed_user()` | Acesso direto ao banco com a publishable key |

Desativar alguém = `update allowed_users set active = false where email = '...'` — o acesso cai na próxima requisição.

### Arquivos principais

```
src/proxy.ts                      refresh da sessão Supabase + redirect para /login
src/lib/auth/dal.ts               getSessionState() / requireUser()
src/lib/auth/whitelist.ts         consulta à whitelist (service role, fail-closed)
src/lib/auth/trusted-device.ts    "Confiar neste computador"
src/lib/auth/audit.ts             trilha de auditoria (append-only)
src/app/login/actions.ts          Server Actions das 3 etapas
src/components/auth/*             UI (stepper, OTP 6 dígitos, painel da marca)
supabase/migrations/*.sql         tabelas, hook e RLS
supabase/templates/magic_link.html  e-mail com o código ({{ .Token }})
```

## Setup

1. `npm install`
2. Crie o projeto no Supabase e copie `.env.example` → `.env.local` com as chaves.
3. Rode a migration `supabase/migrations/20261123000000_auth_whitelist.sql`
   (SQL Editor ou `supabase db push`) e depois `supabase/seed.sql` com os e-mails reais.
4. No Dashboard do Supabase:
   - **Authentication › Hooks** → *Before User Created* → Postgres → `public.hook_before_user_created`.
   - **Authentication › Sign In / Providers › Email** → habilitado; *Email OTP Length* = **6**.
   - **Authentication › Emails › Magic Link** → cole `supabase/templates/magic_link.html`
     (o template precisa usar `{{ .Token }}`, não o link).
   - **Authentication › Multi-Factor** → TOTP habilitado (padrão).
   - Configure um **SMTP próprio** (o SMTP padrão do Supabase tem limite baixo de envio).
5. `npm run dev` → http://localhost:3000/login

Variáveis na Vercel: as mesmas do `.env.example` (use `NEXT_PUBLIC_APP_ENV=hlg` no ambiente de homologação para o badge amarelo).

## Pendências conhecidas

- Logo: `src/components/auth/logo.tsx` é um placeholder — trocar pelo SVG `logo/mantiqueira-em-casa-branco` (Figma Assets `2868:3`).
- "Perdi o acesso ao autenticador": hoje orienta a falar com um admin; o reset do fator entra na tela **10 · Usuários e auditoria**.
- Sessões via "computador confiável" ficam em `aal1` no Supabase. Por isso as políticas RLS
  das próximas tabelas devem usar `is_allowed_user()` (não `aal = 'aal2'`) e o nível MFA é
  garantido pelo `requireUser()` no servidor.
