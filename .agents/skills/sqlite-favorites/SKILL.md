---
name: sqlite-favorites
description: Persistir somente snapshots explícitos de favoritos por usuário em better-sqlite3.
---
# SQLite e favoritos
Leia `spec.md` §§6–7. Tabelas `users`, `favorites` e `sessions` se necessário. Ative foreign_keys; schema/migrações idempotentes. Favoritos únicos por `(user_id, ibge_code)`; snapshot JSON com status, fontes, anos e horários. Não persistir consultas comuns. Listar, detalhar, atualizar explicitamente e excluir somente registros do usuário autenticado. Banco em `backend/data/` ignorado pelo Git. Testar persistência após reabrir conexão e leitura offline com backend ativo.
