# Painel Cívico Municipal

Aplicação local para consultar endereços brasileiros por CEP, condições meteorológicas e indicadores oficiais do IBGE. Usuários podem guardar snapshots municipais próprios em SQLite e consultá-los novamente sem internet, desde que o backend local esteja ativo.

## Requisitos

- Node.js 22 ou superior (desenvolvimento verificado com Node.js 24)
- npm
- Internet para pesquisas e atualizações de dados externos; favoritos salvos abrem sem internet

## Instalação e execução

No PowerShell, a política de execução desta máquina pode bloquear `npm.ps1`; use `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

Abra **http://localhost:5173**. O frontend Vite encaminha `/api` ao Express em **http://localhost:3001**. O arquivo de dados é criado automaticamente em `backend/data/painel-civico.sqlite`.

Para compilar o frontend e executar os testes:

```powershell
npm.cmd run build
npm.cmd test
```

Para executar somente a API: `npm.cmd run start`. A variável `PORT` altera a porta, `SQLITE_PATH` define outro caminho de banco e `NOMINATIM_REVERSE_URL`/`NOMINATIM_SEARCH_URL` trocam os endpoints de geocodificação. A sessão local usa cookie HttpOnly/SameSite e expira após sete dias. Não é necessário criar `.env` para iniciar em localhost.

## Funcionalidades

- Autocadastro, login e logout; senhas derivadas com scrypt e sal aleatório.
- Consulta de CEP sem persistência no servidor/SQLite nem histórico: o navegador pode guardar apenas o último CEP e resultado, em chave `localStorage` isolada pelo ID do usuário. Senhas e sessão nunca são gravadas no armazenamento do navegador. BrasilAPI CEP v1 e, sem coordenadas, tentativa de v2.
- Código municipal verificado pela API oficial de Localidades do IBGE. As regiões podem ser enriquecidas pelos endpoints de regiões da BrasilAPI.
- Condições atuais Open-Meteo somente com coordenadas válidas obtidas no CEP. Sem coordenadas, o painel explica a indisponibilidade; não usa geocodificação alternativa.
- Mapa Leaflet com tiles do OpenStreetMap encaminhados por rota autenticada do backend. O marcador indica a localização associada ao CEP segundo as coordenadas da BrasilAPI; não confirma número ou trecho exato da rua. O mapa aparece na consulta online e não integra a visualização offline de snapshots.
- Clique no mapa para procurar, via Nominatim, o CEP associado ao objeto mapeado mais próximo; o CEP encontrado preenche o campo e segue pela consulta BrasilAPI existente. O retorno depende da cobertura OSM e não garante menor distância postal oficial. A busca é somente explícita (nunca fallback automático para CEP sem coordenadas), limitada a uma chamada por segundo e usa cache temporário em memória.
- Busca por município e UF para comparar o centro geográfico e, quando identificada nos dados cartográficos, a prefeitura como centro cívico. O mapa mostra o CEP associado a cada referência; esses CEPs não são um CEP geral oficial, e a prefeitura pode não estar mapeada.
- Card da NASA/JPL com pequenos corpos potencialmente observáveis na noite escolhida, horários de observação, magnitude e coordenadas de apontamento, com filtro opcional de objetos próximos da Terra (NEOs). Usa as coordenadas válidas do CEP ou o centro geográfico da busca municipal; estrelas e planetas não fazem parte deste catálogo.
- População mais recente disponível pelo agregado SIDRA 6579, variável 9324; densidade oficial pelo agregado 4714, variável 614. O período mais recente retornado é usado para cada série; os anos e fontes permanecem separados.
- Favoritos únicos por usuário e código IBGE. Favoritar grava o snapshot dos dados disponíveis; abrir o favorito não consulta provedores externos. Atualização e exclusão são ações explícitas.
- Indicadores parciais permanecem visíveis quando outro provedor não responde.

## Rotas HTTP

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/health` | Estado da API e do SQLite |
| POST | `/api/auth/register` | Criar conta |
| POST | `/api/auth/login` | Iniciar sessão |
| GET | `/api/auth/me` | Sessão atual |
| POST | `/api/auth/logout` | Encerrar sessão |
| GET | `/api/locations/cep/:cep` | Consultar CEP e agregar os dados disponíveis (autenticado) |
| GET | `/api/map/tiles/:z/:x/:y.png` | Obter tile cartográfico OpenStreetMap (autenticado) |
| POST | `/api/map/reverse` | Procurar CEP por coordenada selecionada no mapa (autenticado) |
| POST | `/api/map/city-centers` | Procurar centro geográfico e prefeitura por município/UF (autenticado) |
| POST | `/api/astronomy/observability` | Consultar pequenos corpos observáveis por coordenadas/data (autenticado) |
| GET | `/api/favorites` | Listar snapshots do usuário |
| GET | `/api/favorites/:id` | Ler um snapshot salvo |
| POST | `/api/favorites` | Salvar um snapshot consultado |
| PUT | `/api/favorites/:id/refresh` | Consultar provedores e atualizar snapshot explicitamente |
| DELETE | `/api/favorites/:id` | Remover favorito |

As rotas funcionais de consulta e favoritos exigem sessão. Cada query SQL utiliza parâmetros e as operações de favoritos são limitadas ao usuário autenticado.

`NOMINATIM_REVERSE_URL` (padrão `https://nominatim.openstreetmap.org/reverse`) e `NOMINATIM_SEARCH_URL` (padrão `https://nominatim.openstreetmap.org/search`) permitem trocar os endpoints Nominatim. As consultas passam pelo backend com identificação da aplicação no `User-Agent`; Search e Reverse compartilham limite máximo de uma solicitação por segundo e cache volátil limitado (256 respostas/24 horas). Os resultados não são persistidos no SQLite nem no `localStorage` como histórico.

## Fontes de dados verificadas

- **BrasilAPI CEP v1/v2:** `https://brasilapi.com.br/api/cep/v1/{cep}` e `https://brasilapi.com.br/api/cep/v2/{cep}`.
- **IBGE Localidades:** `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/{codigo}`.
- **IBGE SIDRA população:** agregado 6579, variável 9324 (estimativa municipal mais recente disponível).
- **IBGE SIDRA densidade:** agregado 4714, variável 614 (indicador censitário disponível mais recente).
- **Open-Meteo Forecast:** temperatura, umidade relativa, vento, código WMO e horário, consultados pelas coordenadas do CEP.
- **OpenStreetMap:** tiles cartográficos requisitados pelo backend em `https://tile.openstreetmap.org`, com atribuição visível no mapa. A posição é associada ao CEP e não assegura precisão de rua/número.
- **Nominatim/OpenStreetMap:** busca reversa por clique explícito e busca municipal com centro geográfico/prefeitura; endpoints Reverse e Search são configuráveis. O limite de uma requisição por segundo é compartilhado e o cache é volátil. CEPs representam feições mapeadas e não são apresentados como CEP geral oficial. Consulte a [política de uso do Nominatim](https://operations.osmfoundation.org/policies/nominatim/).
- **NASA/JPL Small-Body Observability API:** `https://ssd-api.jpl.nasa.gov/sbwobs.api`. Resposta validada pela assinatura versão 1.0. A consulta óptica usa elevação mínima de 30°, exposição mínima de 15 minutos e magnitude V até 25; mostra até 25 alvos ordenados pelos mais brilhantes e oferece filtro `sb-group=neo`. A data escolhida é enviada como instante noturno UT (`23:00:00`); os horários são convertidos na interface para o fuso local estimado a partir das coordenadas/UF. Consulte a [documentação oficial](https://ssd-api.jpl.nasa.gov/doc/sbwobs.html).

O endpoint consultado do INPE/PClima serve à exploração de projeções de mudanças climáticas; não foi validado como fonte de condições meteorológicas atuais equivalentes e, portanto, não é usado como fallback.

## Roteiro manual do caminho feliz

1. Inicie com `npm.cmd run dev` e confira o indicador local na tela de autenticação.
2. Cadastre uma conta, faça login e consulte um CEP real (por exemplo, `01001-000`).
3. Confira endereço, código IBGE, clima quando houver coordenadas e indicadores com fonte/ano ou indisponibilidade clara.
4. Com coordenadas válidas, confira o marcador no mapa e a atribuição OpenStreetMap; sem coordenadas, deve aparecer o aviso de mapa indisponível.
5. Clique em outra área do mapa; confira que o CEP retornado preenche o campo e a consulta normal é executada.
6. Selecione “Por cidade”, informe município e UF; confira os marcadores do centro geográfico e da prefeitura quando encontrada, seus CEPs associados e os avisos de dados aproximados.
7. Confira o card NASA/JPL abaixo do mapa, a lista de alvos, os horários e a opção de filtrar NEOs; troque a data e confirme a atualização.
8. Favorite o município; abra a lista e confira o horário de coleta.
9. Reinicie o processo. O favorito deve continuar no SQLite. Com internet desligada, abra o snapshot sem acionar atualização.
10. Reconecte e atualize o favorito; depois remova-o com confirmação.
11. Cadastre outro usuário e confirme que sua lista é independente; encerre a sessão.

### Regressão de consulta por usuário

1. Entre com o usuário A, consulte `35160-000` e confirme campo e resultado.
2. Faça logout e entre com o usuário B. O campo e os resultados de A devem estar ausentes; sem consulta anterior de B, o campo começa vazio.
3. Consulte um CEP com B, saia e entre novamente com A. A deve recuperar apenas `35160-000` e seu resultado.
4. Recarregue o frontend com A autenticado. O último estado de A deve persistir; as chaves locais devem conter apenas estado de consulta, sem senha ou token.
5. Confirme pela API que B não consegue ler, atualizar nem remover um ID de favorito de A; logout deve invalidar o cookie antigo.

## Limite operacional

Os dados locais protegem o fluxo normal da aplicação. Não há promessa de isolamento contra alguém com acesso administrativo ao sistema operacional, aos arquivos locais ou ao perfil do navegador. Os testes específicos de segurança e o hardening da fase F07 continuam necessários antes de uma eventual publicação em produção.
