---
name: external-apis
description: Integrar BrasilAPI CEP v2, Open-Meteo e fontes oficiais IBGE com rastreabilidade.
---
# APIs externas
Leia `spec.md` §§5–6 e 16. BrasilAPI `https://brasilapi.com.br/api/cep/v2/{cep}`; não presumir coordenadas ou código IBGE. Resolver município por IBGE Localidades verificando nome e UF. Sem coordenadas, retornar clima `unavailable_no_coordinates` sem fallback geográfico. Open-Meteo: temperatura, vento, código de tempo, instante. IBGE: confirmar endpoints, tabela, variável e ano reais antes de codificar; população e densidade com fontes e anos independentes. Não inventar valores. Testes usam fixtures documentadas, sem rede.
