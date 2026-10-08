# SPEC.md — Painel Cívico Municipal

**Versão:** 1.0.0  
**Estado:** requisitos funcionais validados; implementação pendente  
**Data:** 2026-10-08  
**Idioma:** pt-BR

## 1. Objetivo

Construir aplicação web local que, a partir de um CEP brasileiro, apresente endereço, UF, município e código IBGE, clima atual e indicadores demográficos oficiais. Usuários autenticados poderão favoritar municípios; somente os favoritos terão snapshots de dados funcionais persistidos no SQLite. Consultas comuns não são persistidas no servidor ou no SQLite; o navegador pode recuperar somente a consulta mais recente por usuário, conforme RF03.

Este é um projeto novo e autônomo: não reutilizar código, requisitos ou decisões de outros projetos.

## 2. Stack e limites

- **Frontend:** React + Vite, JavaScript, consumo de `/api/*` via HTTP.
- **Backend:** Node.js LTS + Express, JavaScript, integração centralizada com serviços externos.
- **Banco:** SQLite local via `better-sqlite3`; arquivo em diretório de dados não versionado.
- **Testes do MVP:** Vitest e Supertest, testes de fluxo principal; testes específicos de segurança e hardening em fase final obrigatória.
- **Execução:** localhost, sem Docker, sem PostgreSQL, sem serviços de autenticação de terceiros.
- **Integrações:** BrasilAPI CEP v2, Open-Meteo, APIs oficiais IBGE (Localidades e fontes oficiais de indicadores, incluindo SIDRA quando aplicável).

## 3. Decisões aprovadas

| ID | Decisão | Regra |
|---|---|---|
| D01 | Cadastro e autenticação | Autocadastro, login e logout por senha |
| D02 | Isolamento | Cada usuário acessa somente seus favoritos |
| D03 | Persistência | Snapshot completo de município, endereço de referência, clima e indicadores ao favoritar |
| D04 | CEP sem coordenadas | Mostrar endereço e indicadores disponíveis; clima indisponível, sem geocodificação alternativa |
| D05 | IBGE | População oficial mais recente disponível e densidade oficial, com fonte e ano independentes |
| D06 | Testes | Somente caminho feliz durante implementação; testes de segurança e ajustes de segurança específicos na fase final |

## 4. Personas e escopo

**Usuário:** cria conta, autentica, pesquisa CEP, consulta dados, favorita municípios, consulta snapshots offline, atualiza ou remove favoritos e encerra sessão.

**Incluído no MVP:** cadastro, login/logout, consulta CEP, consulta clima quando houver coordenadas, indicadores demográficos, favoritos por usuário, snapshots, listagem offline e persistência entre reinícios.

**Fora do MVP:** mapas interativos, notificações, relatórios PDF, gráficos históricos, administração de múltiplas organizações, sincronização em nuvem, localização automática, busca por endereço, importação em massa e edição de dados oficiais.

## 5. Fluxo de usuário

1. Abrir frontend no localhost.
2. Cadastrar conta com identificação básica, e-mail e senha; efetuar login.
3. Digitar CEP com ou sem máscara; frontend normaliza oito dígitos e envia ao backend.
4. Backend consulta BrasilAPI; determina endereço, município e UF e resolve o código IBGE por fonte oficial quando não fornecido diretamente.
5. Backend consulta IBGE por código municipal, devolvendo população e densidade com anos e fontes individuais.
6. Havendo latitude e longitude válidas da BrasilAPI, consultar Open-Meteo e obter temperatura, velocidade do vento, código/descrição da condição e instante de observação. Sem coordenadas, devolver status de clima indisponível.
7. Frontend apresenta resultado unificado, com erros parciais claramente identificados.
8. Somente ao clicar em **Favoritar**, backend grava ou atualiza o snapshot do município para o usuário autenticado.
9. Na lista de favoritos, exibir último snapshot persistido; permitir atualização explícita online e remoção.
10. Reiniciar serviços e comprovar persistência; desligar internet e consultar snapshots previamente gravados, sem alegar atualidade dos dados.

## 6. Requisitos funcionais

### RF01 — Cadastro
- Formulário com nome, e-mail e senha, confirmação de senha.
- E-mail normalizado e único; mensagens de validação amigáveis.
- Senha armazenada exclusivamente como hash com sal, nunca em texto puro.
- Após cadastro, permitir login.

### RF02 — Autenticação
- Login por e-mail e senha, sessão autenticada, logout.
- Rotas de favoritos exigem autenticação.
- Preferência inicial: sessão de servidor com cookie HttpOnly e SameSite, armazenamento persistente da sessão conforme necessidade; não armazenar senha ou token em `localStorage`.
- As proteções básicas indispensáveis fazem parte da implementação funcional; auditoria ofensiva e hardening ficam para a fase final.

### RF03 — CEP
- Aceitar `NNNNNNNN` e `NNNNN-NNN`.
- CEP válido possui oito dígitos; CEP inexistente retorna mensagem específica.
- Usar `https://brasilapi.com.br/api/cep/v2/{cep}`; não presumir que todo campo ou coordenada esteja presente.
- Resolver código IBGE com a fonte de localidades do IBGE usando município/UF, validando correspondência; não fabricar códigos.
- Exibir logradouro, bairro e município conforme disponibilidade; município e UF são indispensáveis para indicadores municipais.
- O frontend pode persistir somente o estado da consulta mais recente (CEP e resultado exibido) no `localStorage`, usando chave com versão e ID interno do usuário autenticado. Isso permite recuperação no mesmo navegador e não é histórico nem cache compartilhado.
- Não colocar senha, cookie, token, identificador de sessão ou outros dados de autenticação no armazenamento do navegador. Consulta e snapshot continuam sem persistência no backend/SQLite fora da ação explícita de favoritar.

### RF04 — Clima
- Somente consultar se houver latitude/longitude numéricas válidas.
- Usar Open-Meteo Forecast API com parâmetros `latitude`, `longitude`, `current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` e `timezone=America/Sao_Paulo` (ou fuso obtido do serviço).
- Mostrar temperatura em °C, vento em km/h, condição traduzida de `weather_code`, instante da medição e origem Open-Meteo.
- Dados meteorológicos são observações/modelagens fornecidas pelo serviço, não leitura direta de estação em tempo real; usar rótulo **Condições atuais**.
- Se faltarem coordenadas, marcar `unavailable_no_coordinates`; se falhar o serviço, `unavailable_provider_error`.

### RF05 — Indicadores IBGE
- Usar código IBGE municipal como identificador.
- População: último dado oficial municipal publicado disponível na fonte escolhida, com valor, unidade, ano, nome da pesquisa/tabela e URL de origem.
- Densidade: último indicador oficial publicado disponível, com valor em hab/km², ano e fonte independentes.
- Não calcular densidade misturando população de um ano com área de outro, salvo se explicitamente identificado como cálculo derivado (fora do MVP).
- Preferir indicadores oficiais consolidados do portal IBGE Cidades; quando necessário, usar API SIDRA documentada. Validar previamente códigos de tabela/variável/período antes da implementação; nunca inventar endpoints ou números.
- Falha de um indicador não deve suprimir os outros dados disponíveis.

### RF06 — Favoritos
- Favoritar por **código IBGE**, não por CEP; um mesmo usuário não pode duplicar o município.
- Salvar snapshot completo disponível no instante da ação: código IBGE, município, UF, CEP/endereço de referência, coordenadas (se presentes), clima (ou indisponibilidade), população, densidade, fontes, anos e timestamps.
- Se algum provedor falhar, permitir favoritar snapshot parcial explicitamente sinalizado.
- Listar favoritos do usuário; abrir detalhe; atualizar explicitamente online; remover com confirmação.
- Não salvar pesquisas, resultados ou histórico de CEP no backend/SQLite fora da ação de favoritar. No navegador, somente a última consulta por usuário pode ser mantida conforme RF03; não manter histórico.

### RF07 — Offline
- Offline significa consultar snapshots já gravados no SQLite local **com backend acessível**; não implica que o frontend funcione sem servidor ou que seja um PWA.
- Não consultar APIs externas ao abrir um favorito, exceto quando usuário solicitar atualização.
- Mostrar selo textual **Dados salvos em DD/MM/AAAA HH:mm**, e identificar clima como **última condição registrada**, não clima atual.
- Cadastro e login local podem funcionar sem internet, desde que backend e banco estejam ativos.

### RF08 — Estados e feedback
- Loading durante consulta; mensagens para CEP inválido, CEP não encontrado, ausência de coordenadas, falha parcial de IBGE/clima, erro de rede e banco indisponível.
- Nenhuma falha parcial deve ser silenciosa ou preenchida com valores fictícios.

## 7. Modelo de dados SQLite

### `users`
- `id INTEGER PRIMARY KEY`
- `name TEXT NOT NULL`
- `email TEXT NOT NULL UNIQUE`
- `password_hash TEXT NOT NULL`
- `created_at TEXT NOT NULL`

### `favorites`
- `id INTEGER PRIMARY KEY`
- `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `ibge_code TEXT NOT NULL`
- `city_name TEXT NOT NULL`
- `state_code TEXT NOT NULL`
- `reference_cep TEXT`
- `snapshot_json TEXT NOT NULL` — JSON validado na aplicação, com clima, demografia, fontes, anos e statuses
- `snapshot_at TEXT NOT NULL`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `UNIQUE(user_id, ibge_code)`
- Índice `favorites(user_id, city_name)`.

### `sessions` (se sessão persistente de servidor)
- Identificador opaco, `user_id`, validade e metadados mínimos; implementação depende da biblioteca de sessão adotada. Nunca guardar senha.

**Persistência:** `backend/data/painel-civico.sqlite`, excluído do Git. Ativar `PRAGMA foreign_keys = ON`; inicialização de schema/migrações idempotente. Não inserir favoritos de demonstração no banco de produção.

## 8. Contrato HTTP proposto

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/register` | Cadastrar usuário |
| POST | `/api/auth/login` | Autenticar |
| POST | `/api/auth/logout` | Encerrar sessão |
| GET | `/api/auth/me` | Retornar usuário autenticado |
| GET | `/api/locations/cep/:cep` | Consultar e agregar dados instantâneos |
| GET | `/api/favorites` | Listar favoritos do usuário |
| GET | `/api/favorites/:id` | Detalhar snapshot |
| POST | `/api/favorites` | Persistir resultado consultado por ação explícita |
| PUT | `/api/favorites/:id/refresh` | Atualizar snapshot por consulta online explícita |
| DELETE | `/api/favorites/:id` | Excluir favorito |
| GET | `/api/health` | Verificar disponibilidade do backend |

**Respostas:** JSON com `data`, `status` e, quando necessário, `warnings`. Erros padronizados com `error.code` e `error.message`; nunca expor stack trace ao cliente. Autenticação exigida nas rotas de favoritos. A rota de consulta CEP também exigirá autenticação para preservar a experiência de painel autenticado.

**Modelo agregado indicativo:**

```json
{
  "data": {
    "location": {"cep": "30130110", "city": "Belo Horizonte", "state": "MG", "ibgeCode": "3106200", "street": null, "district": null, "latitude": null, "longitude": null},
    "weather": {"status": "unavailable_no_coordinates", "temperatureC": null, "windKmh": null, "condition": null, "observedAt": null, "source": "Open-Meteo"},
    "demographics": {
      "population": {"status": "available", "value": null, "year": null, "source": "IBGE", "sourceUrl": null},
      "density": {"status": "available", "value": null, "unit": "hab/km²", "year": null, "source": "IBGE", "sourceUrl": null}
    }
  },
  "status": "partial",
  "warnings": ["Clima indisponível: CEP sem coordenadas"]
}
```

O exemplo acima é **ilustrativo** e não representa consulta real; valores e `status` deverão ser coerentes (indicador sem valor real deve ter `status: unavailable`, não `available`). O contrato definitivo será fixado nos testes de integração.

## 9. Arquitetura e estrutura

```text
painel-civico/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── providers/
│   │   ├── repositories/
│   │   ├── database/
│   │   └── app.js
│   ├── tests/
│   ├── data/              # ignorado pelo Git
│   └── package.json
├── .agents/skills/
├── docs/
├── .gitignore
├── AGENTS.md
├── README.md
├── spec.md
└── package.json
```

- `providers/`: adaptadores para BrasilAPI, Open-Meteo e IBGE.
- `services/`: orquestração e transformação para contrato interno.
- `repositories/`: persistência SQLite; nenhum acesso SQL direto a partir de controllers.
- Frontend consome exclusivamente `/api/*`, com proxy Vite para Express em desenvolvimento.
- Portas propostas: Vite `5173`, Express `3001`; configuráveis por variáveis de ambiente.
- Timeout explícito por provedor; falha parcial controlada; não adicionar cache persistente para consultas não favoritadas.

## 10. Telas

1. **Cadastro:** nome, e-mail, senha, confirmação.
2. **Login:** e-mail e senha, navegação para cadastro.
3. **Dashboard:** campo CEP, endereço, município/UF/IBGE, cards de clima e IBGE, botão favoritar.
4. **Favoritos:** lista individual, busca local na lista, abrir snapshot, atualizar e remover.
5. **Detalhe do favorito:** informações salvas, datas, fontes, aviso de dado histórico e ação de atualização.

Interface responsiva em pt-BR, formatação brasileira para números, datas e unidades, estados vazios e mensagens acessíveis.

## 11. Plano de implementação por features

- **F00 — Base:** monorepositório simples, scripts de inicialização, Express, Vite, health check, SQLite e README inicial.
- **F01 — Usuários:** schema, cadastro, login, sessão e logout; caminho feliz de autenticação.
- **F02 — CEP:** formulário e integração BrasilAPI; resolução confiável de município/IBGE.
- **F03 — Clima:** Open-Meteo e tratamento de ausência de coordenadas.
- **F04 — Demografia:** fontes IBGE, anos independentes, dados ausentes e apresentação.
- **F05 — Favoritos:** CRUD por usuário, snapshot completo e persistência após reinício.
- **F06 — Offline e acabamento:** consulta de snapshots sem internet, atualização explícita, estados parciais, UX e README final.
- **F07 — Segurança (obrigatória, somente ao final):** testes de segurança, revisão de autorização, sessão, entradas, dependências e hardening necessário, seguida de regressão funcional.

Não executar `git push` automaticamente; commits/versionamento somente após validação do usuário.

## 12. Caminho feliz — testes e homologação

**Pré-condições:** Node.js instalado, dependências instaladas, backend e frontend em execução, SQLite inicializado, conexão de internet disponível para consulta inicial, CEP real de teste com município resolvível.

| Passo | Ação | Resultado esperado |
|---|---|---|
| 1 | Iniciar backend e frontend | Health OK e tela de login |
| 2 | Cadastrar usuário A | Cadastro concluído |
| 3 | Entrar com usuário A | Dashboard acessível |
| 4 | Consultar CEP válido | Município/UF/código IBGE reais |
| 5 | Visualizar indicadores | População e densidade oficiais com ano/fonte, ou indisponibilidade explícita |
| 6 | Consultar CEP com coordenadas | Clima atual com hora/fonte |
| 7 | Consultar CEP sem coordenadas | Resultado parcial, sem clima e sem coordenadas inventadas |
| 8 | Favoritar município | Favorito salvo no SQLite |
| 9 | Reiniciar serviços | Favorito ainda listado |
| 10 | Desligar acesso à internet, manter localhost | Snapshot do favorito visível com aviso histórico |
| 11 | Restaurar internet e atualizar | Snapshot substituído por dados recém-consultados e timestamp atualizado |
| 12 | Cadastrar usuário B | B não visualiza favoritos de A |
| 13 | Voltar ao usuário A e remover favorito | Município deixa de constar na lista |
| 14 | Logout | Sessão encerrada |

**Automação inicial:** testes unitários de transformação de dados e integração com providers simulados; Supertest para cadastro, login, consulta agregada e CRUD; testes de UI do fluxo feliz quando apropriado. Não fazer testes ofensivos ou de hardening nesta fase.

## 13. Critérios de aceite do MVP

- [ ] React e Express operam juntos em localhost, com comandos documentados.
- [ ] Cadastro, login e logout funcionam; senhas não são armazenadas em claro.
- [ ] CEP válido retorna dados oficiais disponíveis e código IBGE verificado.
- [ ] CEP sem coordenadas apresenta consulta parcial, sem inventar clima.
- [ ] Clima mostra temperatura, vento, condição e timestamp quando disponível.
- [ ] População e densidade exibem valor, ano e fonte próprios.
- [ ] Consultas comuns não criam registros de cidades no SQLite.
- [ ] Favoritar grava snapshot completo disponível, por usuário e município.
- [ ] Favoritos persistem após reiniciar backend e frontend.
- [ ] Favoritos podem ser lidos sem internet, com backend local ativo.
- [ ] Usuário B não acessa favoritos do usuário A pelo fluxo normal.
- [ ] Atualização e exclusão explícitas funcionam.
- [ ] README, `.gitignore`, `AGENTS.md` e skills existem e correspondem à implementação.
- [ ] Caminho feliz automatizado e manual documentado e executado.
- [ ] Fase final de testes de segurança e hardening concluída antes de declarar produção.

## 14. Segurança — fase final obrigatória

A decisão de postergar testes específicos de segurança **não autoriza** implementar senhas em texto puro, SQL concatenado com entrada do usuário, acesso cruzado entre usuários ou credenciais expostas. Esses cuidados são requisitos funcionais mínimos desde F01. Na F07 serão executados testes e correções específicas de segurança, incluindo: autorização por proprietário, sessão e cookies, validação de entrada, SQL injection, XSS/CSRF conforme arquitetura, brute force/rate limiting, headers, dependências, logs e segredos. Reexecutar o caminho feliz após correções. **Não publicar em produção antes de concluir F07.**

## 15. Entregáveis e documentação

- `spec.md`: esta especificação.
- `.gitignore`: `node_modules`, `.env`, banco SQLite e arquivos auxiliares WAL/SHM, logs, builds, cobertura e arquivos temporários.
- `README.md`: requisitos, instalação, variáveis de ambiente, execução simultânea, endpoints, testes e modo offline.
- `AGENTS.md`: regras locais do projeto, escopo, fontes oficiais, processo de validação, testes e proibição de push automático.
- `.agents/skills/`: instruções específicas para `frontend-react`, `backend-express`, `external-apis`, `sqlite-favorites`, `auth`, `happy-path-testing`, `documentation`.

## 16. Pendências técnicas a verificar na implementação

1. Identificar fontes e códigos oficiais atualizados para população e densidade municipal do IBGE, documentando tabela, variável e período efetivamente usados.
2. Verificar a cobertura real de coordenadas da BrasilAPI CEP v2 e do código IBGE, sem supor preenchimento obrigatório.
3. Definir biblioteca de sessão compatível com Express e SQLite e política de expiração.
4. Confirmar versões de Node.js, Vite e bibliotecas no ambiente de desenvolvimento.
5. Registrar URL e horário de obtenção de cada fonte de indicador, sem tratar dados antigos como atuais.

**Controle de mudanças:** qualquer alteração das seis decisões validadas exige aprovação explícita antes de alterar esta especificação.
