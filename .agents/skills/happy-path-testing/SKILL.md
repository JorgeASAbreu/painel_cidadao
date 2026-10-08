---
name: happy-path-testing
description: Executar e documentar o caminho feliz F00–F06 sem antecipar a auditoria F07.
---
# Testes de caminho feliz
Leia `spec.md` §§11–14. Use Vitest e Supertest. Simule provedores externos para estabilidade. Cobrir cadastro, login, CEP válido, indicadores, clima com coordenadas, parcial sem coordenadas, favoritar, reinício de conexão, leitura offline, atualização, isolamento entre A/B no fluxo normal, exclusão e logout. Fornecer roteiro manual com pré-condições e resultados esperados. Registrar o que foi realmente executado; não alegar testes executados quando não ocorreram. Testes de segurança e hardening somente na F07 obrigatória.
