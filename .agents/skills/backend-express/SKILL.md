---
name: backend-express
description: Implementar rotas e orquestração Express conforme o contrato HTTP da spec.
---
# Backend Express
Leia `spec.md` §§6–9. Separe routes, controllers, services, providers e repositories. Controllers validam contrato e devolvem JSON `data/status/warnings` ou `error.code/error.message`. Providers isolam chamadas externas com timeout e indisponibilidade parcial. Repositories são a única camada SQL. Não persistir consultas por CEP. Criar health check. Testar caminho feliz via Supertest com dependências externas simuladas.
