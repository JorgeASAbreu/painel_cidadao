---
name: auth
description: Criar cadastro, login, sessão e logout com isolamento funcional de usuários.
---
# Autenticação
Leia `spec.md` §§6–8 e 14. Cadastro nome/e-mail/senha/confirmação; e-mail único e normalizado. Hash com sal; nunca armazenar senha em claro. Sessão no servidor e cookie HttpOnly/SameSite; não guardar tokens em localStorage. `auth/me` e logout. Rotas de consulta e favoritos autenticadas; acesso aos favoritos filtrado pelo usuário da sessão. Durante F01, testar caminho feliz; auditoria específica de segurança e hardening ficam para F07. Não omitir garantias funcionais básicas.
