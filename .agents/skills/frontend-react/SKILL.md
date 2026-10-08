---
name: frontend-react
description: Construir telas React/Vite conforme a referência visual aprovada, consumindo apenas /api.
---
# Frontend React
Leia `spec.md` §§5, 8, 10 e o arquivo visual de referência. Não invente layout se a referência estiver ausente; solicite o arquivo. Implementar cadastro, login, dashboard CEP, favoritos e detalhe, com estados loading/erro/parcial/offline. Usar pt-BR, acessibilidade básica e layout responsivo. Nunca acessar SQLite ou APIs externas diretamente no frontend; usar `/api/*`. Para estado individual da pesquisa, pode persistir somente a última entrada/resultado no `localStorage`, com chave versionada por ID interno do usuário; nunca persistir histórico, senha, cookie, token ou sessão. Testar caminho feliz e a troca entre usuários.
