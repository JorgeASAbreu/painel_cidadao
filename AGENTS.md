# AGENTS.md — Painel Cívico Municipal

## Fonte de verdade
Leia `spec.md` antes de qualquer alteração. Projeto novo e independente; não reutilize código ou decisões de outros projetos. Em divergências, peça validação. Não altere as seis decisões aprovadas sem autorização.

## Stack
React + Vite (JavaScript), Node.js LTS + Express, SQLite via better-sqlite3, Vitest + Supertest. Localhost, sem Docker e sem banco remoto. Interface pt-BR.

## Fluxo de trabalho
1. Leia a spec e a skill aplicável em `.agents/skills/`.
2. Declare o escopo da feature e arquivos afetados; implemente apenas o necessário.
3. Preserve contratos `/api/*` e separação routes/controllers/services/providers/repositories.
4. Teste apenas o caminho feliz durante F00–F06, com provedores simulados em testes automatizados.
5. Relate arquivos alterados, comandos executados, resultados e limitações. Aguarde validação do usuário antes da próxima feature.
6. Não faça `git push` automático; não crie commits sem autorização.

## Regras de dados
Consultas por CEP não são persistidas no backend/SQLite nem mantidas como histórico. O frontend pode guardar apenas o estado da consulta mais recente por usuário no `localStorage`, com chave separada pelo ID interno, sem senha, cookie, token ou dados de sessão. Somente ação explícita de favoritar/atualizar persiste snapshot municipal no SQLite. Banco guarda usuários/sessões e favoritos. Offline significa backend local ativo e snapshots históricos; nunca rotular clima salvo como atual.

## Integrações
BrasilAPI CEP v2; IBGE Localidades para identificação municipal; fontes oficiais IBGE para população e densidade com ano e URL separados; Open-Meteo somente se houver coordenadas válidas na BrasilAPI. Sem coordenadas: consulta parcial, não usar geocodificação alternativa. Não inventar códigos, dados, endpoints ou valores.

## Autenticação
Cadastro, login, logout e sessão de servidor com cookie HttpOnly/SameSite; hash de senha com sal; consultas e favoritos exigem autenticação. Favoritos restritos ao usuário proprietário. SQL parametrizado. Essas garantias mínimas são funcionais desde F01.

## Interface
O frontend deve seguir fielmente o arquivo visual de referência fornecido pelo usuário, quando disponível. Antes de implementar telas, inspecione a referência e confirme qualquer detalhe ambíguo; não afirme fidelidade sem acesso ao arquivo. Estados de carregamento, indisponibilidade e offline precisam ser explícitos.

## Política de testes e entrega
F00–F06: caminho feliz automatizado e manual. F07: testes específicos de segurança, correções de hardening e regressão funcional, obrigatórios antes de produção. Não declarar aplicação pronta para produção antes de F07.

## Skills
Use `.agents/skills/frontend-react/SKILL.md`, `backend-express`, `external-apis`, `sqlite-favorites`, `auth`, `happy-path-testing` e `documentation` conforme o escopo.
