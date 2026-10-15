# Dashboard Processos — teste de estresse (15/10/2026) e plano

## 1. O que rodou

Pilha local igual à de ontem (build de produção do Next 16 + Postgres 16 + PostgREST), num container de **2 CPUs / 8 GB** — o servidor, o banco, o gerador de carga e os navegadores dividiram as mesmas duas CPUs. Os números absolutos são desta máquina; o que vale para a Vercel + Supabase é a **forma** (quantas idas ao banco cada clique faz, quantos bytes cada tela puxa, como o tempo cresce com gente e com cartões).

Base: **4.000 tarefas** semeadas nas pastas do escritório, trazidas para o fluxo (3.426 partes), **3.604 cartões abertos**, 30 clientes, 30 processos, 40 intimações (13 com perícia marcada).

### 1.1 Anatomia — quanto custa cada clique (sistema ocioso)

| Operação | Idas ao banco | Volta | Observação |
|---|---|---|---|
| Tela da lista (kanban de qualquer time) | **13** | **3,4 MB** | 6× atribuições paginadas, 4× tarefas paginadas, 2× users, 1× DJEN |
| Editar por fora (PATCH) + recarga que a tela faz | **18** | 3,4 MB | a tela recarrega a lista inteira depois de todo PATCH |
| Dashboard `/` | 17 | 23 KB | 7 contagens (HEAD) separadas |
| Claude: `listar_tarefas` | 15 | 3,4 MB | puxa tudo e filtra no servidor |
| Claude: `mover_tarefa` / `trocar_responsaveis` | 15–16 | 17 KB | chave (1 GET + 1 PATCH de "último uso") + 4–5× users |
| Mover / concluir parte / responsáveis / pôr também | 9 | 2 KB | 3× users + 1 HEAD "o fluxo existe?" + 2× atribuições + 2× tarefas + RPC |
| Criar tarefa | 7 | 1,5 KB | |
| Agenda | 7 | 2,4 MB | |
| Abrir tarefa / histórico / processo / cliente | 3–5 | <2 KB | 2× users em TODO pedido (quem sou + quem é do escritório) |
| Telas HTML (`/times/x`, `/agenda`, `/judicial`) | 0 | — | a casca é barata; o peso é o JSON que a tela pede depois |
| Login | 1 + bcrypt | — | ~100–150 ms de CPU por tentativa |

Média: **5,9 idas ao banco por operação**. Na Vercel + Supabase cada ida é uma viagem pela rede (de ~5 ms se as duas estiverem na mesma região a ~120 ms se não).

### 1.2 Tudo ao mesmo tempo — rampa (40 s por nível, 53 tipos de operação misturados)

| Pessoas | ops/s | Clique p50 / p95 | Tela p50 / p95 | Lista p50 | Erros | PG ativas |
|---|---|---|---|---|---|---|
| 16 | 21 | 584 / 1.137 ms | 562 / 1.976 ms | 1,6 s | 0 | 5 |
| 48 | 17 | 2,2 / 3,8 s | 2,6 / 7,8 s | 4,6 s | 0 | 8 |
| 96 | 14 | 4,2 / 7,3 s | 6,1 / 23 s | 9,2 s | 0 | 5 |
| 192 | 12 | 6,3 / 10 s | 11 / 56 s | 15 s | 0 | 6 |
| 384 | 11 | 6,1 / 9,4 s | 27 / 92 s | 54 s | 0 | 5 |

- **Zero erros 5xx em todos os níveis** e **invariantes do banco certas no fim** (status × partes, time do resumo, sem duplicatas, nada some da tela, dúvidas coerentes, nenhuma origem duplicada do DJEN/`chave_externa`).
- O sistema **não quebra: enfileira**. A vazão CAI conforme entra gente (21 → 11 ops/s) e o banco fica ocioso (5–8 conexões ativas de 300): o gargalo é o processo do Next serializando listas de 3,4 MB — cada pessoa que abre a tela custa o mesmo que ~100 cliques.
- Teto de conforto nesta máquina: **~16 pessoas** (clique abaixo de 1 s no p50). A partir de 48, clique > 2 s e tela > 8 s no p95.
- Sem a lista pesada, o mesmo servidor fez 102 ops/s ontem com 48 pessoas (teste de regressão, rerodado hoje: 275 verificações, 0 falhas).

### 1.3 Cliques reais (Playwright, Chromium)

| Cenário | Cartões na tela | Tempo até os cartões aparecerem | Clique → resposta (p50) |
|---|---|---|---|
| 3 navegadores, sem carga, base pequena | 115 | 1,8 s | concluir 356 ms · mover 374 ms · criar 174 ms |
| 2 navegadores, sem carga, base de 4.000 | 280 / 558 / 1.089 | 1,1 s / 2,3 s / 2,9 s | concluir 570 ms · abrir 316 ms |
| 6 navegadores + 24 colegas pela API | 567–1.349 | **9 a 20 s** | concluir 3,8 s · mover 4,9 s · abrir 1,4 s |

- Zero erros de console, zero pedidos falhos, zero 4xx/5xx em todas as rodadas.
- O tempo até os cartões cresce com a quantidade de cartões do time (o quadro monta todos; `content-visibility` ajuda a pintar, não a montar).
- **19 pré-carregamentos (`?_rsc=`) por navegação**: cada troca de tela pede ao servidor as 19 rotas do menu lateral, e 95% são cancelados antes de terminar (209 pedidos em 11 navegações; 199 cancelados sob carga). Na Vercel são 19 invocações de função por clique no menu.

### 1.4 Tempestade de login

60 senhas erradas de uma vez: todas 401, **nenhum bloqueio** (não há limite de tentativas), e o bcrypt ocupou o servidor por 5,9 s — a tela da equipe, que respondia em 7 ms, foi a 5,8 s no p95. Na Vercel cada tentativa vive na própria função (não trava os outros), mas continua sem limite e continua custando CPU paga.

## 2. O que quebrou — e a solução (uma só, a melhor)

1. **Tela de Intimações em 500 em produção** desde a migration de ontem: `aviso_tarefa_id` criou a segunda chave `comunicacoes_djen → tarefas` e o PostgREST recusou o embed `tarefa:tarefas(...)` por ambiguidade. **Corrigido e publicado** (`a283d86`): o embed diz a chave (`tarefas!comunicacoes_djen_tarefa_id_fkey`) e já traz o aviso junto. Lição registrada: toda nova FK para a mesma tabela exige nomear a chave nos embeds existentes — entra no `/api/saude`.
2. **Login sem limite de tentativas.** Solução: tabela `tentativas_login(email, ip, quando)` gravada a cada erro; a partir do 5º erro em 15 min, responder **429** com "tente de novo em X min" antes de rodar o bcrypt. Uma migration, 20 linhas na rota. (Não é cache em memória: na Vercel cada função é outra memória.)
3. **Menu do cartão fecha sozinho** se o quadro rola ou recarrega no instante em que ele abre (`components/ui/flutuante.tsx` fecha com qualquer rolagem fora dele; trackpad com inércia reproduz). Solução: ignorar rolagens nos primeiros 300 ms depois de abrir, e só fechar por rolagem do contêiner do quadro, não por re-render.

Fora isso: nada quebrou, nada ficou inconsistente, nenhum 5xx.

## 3. Plano de velocidade (em ordem de ganho; cada item é uma mudança só)

| # | Mudança | Hoje | Depois (estimativa) |
|---|---|---|---|
| **P1** | **Tela em uma ida só e compacta**: RPC `fluxo_tela()` no Postgres devolvendo só o que o cartão usa (id, título, data, hora, prioridade, time, etapa, tipo, processo, deIntimacao, partes abertas) — ~150 bytes/cartão | 13 idas, 3,4 MB, 270 ms ocioso / 1,6 s com 16 pessoas | 1 ida, ~0,5 MB, <80 ms |
| **P2** | **Nunca mais recarregar tudo**: `patch()` e ações recusadas atualizam só aquela tarefa (resposta da API ou `fluxo_tela(desde=…)` com delta) | PATCH = 18 idas / 3,4 MB | 2 idas / 2 KB |
| **P3** | **Quem sou + equipe em cache de 60 s** por instância (`getCurrentUser`, `idsDoEscritorio`, `usuariosDoFluxo`) — revogar alguém passa a valer em até 1 min | 2–3 idas de `users` em TODO pedido | 0 na maioria |
| **P4** | **Conector do Claude**: chave→conta em cache (60 s), "último uso" gravado no máximo 1×/5 min, `fluxoDisponivel` memorizado depois do primeiro sim, `listar_tarefas` filtrando no banco | ação 15 idas; listar 15 idas / 3,4 MB | ação ~5; listar 1 ida / ~50 KB |
| **P5** | **Menu lateral sem prefetch** (`prefetch={false}` nos links; as telas são dinâmicas e a casca leva 15–90 ms) | 19 pedidos por navegação, 95% jogados fora | 0 |
| **P6** | **Mesma região**: conferir a região do projeto Supabase e fixar as funções da Vercel nela (`regions` no `vercel.json`) | cada ida pode valer 120 ms | ~5 ms |
| **P7** | **Dashboard em uma RPC** `painel_resumo()` (contagens, atrasadas por time, agenda do dia) | 17 idas | 2 |
| **P8** | **Janela por coluna** no kanban: 60 cartões mais urgentes + "mostrar mais"; busca e filtros continuam sobre tudo | 1.089 cartões = 2,9 s até aparecer | <1 s |
| **P9** | Dois índices pequenos: `tarefas(status, data) where status in abertos` (agenda) e `comunicacoes_djen(tarefa_id)` | — | — |
| **P10** | `maxDuration`/`memory` das funções e **Speed Insights + alerta de 5xx** (Vercel) para ver isto em produção | cego | medido |

Com P1–P5 a conta de um clique cai de ~9 para ~3 idas e a da tela de 13 para 1; com 16 pessoas a mesma máquina deve sair de 584 ms para a casa de 100–150 ms por clique (estimativa pela anatomia). Ordem sugerida: P1+P2 juntos (uma entrega), depois P3+P4+P5 (meio dia), P6 (5 min, depende de conferir a região), P7–P10.

## 4. O que falta para um sistema previdenciário de alto nível

### Motor previdenciário (o que hoje é conhecimento da IA vira regra do sistema)
- **Carência, qualidade de segurado e período de graça por DER**, calculados do CNIS importado (vínculos, contribuições, GPS em atraso, 12/24/36 meses de graça, baixa renda). Hoje só existe como texto na base da IA e na página de maternidade; é a regra que o Zeca mais aplica nas análises.
- **Tempo de contribuição e regras de transição (EC 103)**, tempo especial (PPP/LTCAT) e conversão; simulador "qual benefício cabe hoje" por cliente.
- **Cálculo de RMI, atrasados e valor da causa**: DIB → DIP com correção (IPCA-E / SELIC), teto de 60 SM do JEF, honorários contratuais e sucumbenciais. A carta de concessão faz isso à mão hoje.
- **Prazos de verdade**: contagem em dias úteis com feriados forenses (TRF1/SJDF, recesso 20/12–20/1), prazo do INSS (30/45 dias) e do segurado, alertas D-5/D-1. A semente (`lib/domain/prazo`) existe; a leitura por regex do DJEN e os `prazo_estimado` precisam desaguar nela.

### Processo
- **Andamentos judiciais automáticos** (DataJud já está nos enums; PJe/eproc consulta pública) e **administrativos** (Meu INSS: exigência, perícia marcada, concluído) — hoje o Ryan copia à mão.
- **Perícia de ponta a ponta**: perito, quesitos padrão por benefício, laudo lido pela IA (favorável/desfavorável), impugnação (art. 480 / 477 §2º) como próximo passo sugerido.
- **RPV/precatório e cumprimento de sentença**: expedido → pago → alvará → repasse ao cliente, com a cobrança do rosa ligada nisso.
- **Peças geradas de dentro do sistema** (visual law) a partir do processo e do cliente; contrato/procuração/hipossuficiência via ZapSign com o status de assinatura alimentando "Aguardando assinatura" sozinho.

### Cliente
- **WhatsApp como canal do CRM**: histórico por cliente dentro do sistema, modelos de mensagem, resposta do cliente vira tarefa (Questões de clientes) — o aviso de perícia é o primeiro passo; falta a volta.
- **Portal do cliente** (link sem senha): situação do caso, documentos pendentes, upload de laudos/exames, data da perícia.
- **Documentos pendentes por benefício** com checklist e cobrança automática.

### Escritório
- **Indicadores**: tempo médio por etapa, WIP por coluna (gargalo), atrasadas por pessoa, êxito por benefício/vara/juiz, SLA de resposta ao cliente, produtividade do Claude × equipe.
- **Parceiros e multi-escritório**: hoje "escritório" = todos os usuários; advogados parceiros (rede de mentoria) precisam ver só os casos deles.
- **Busca global** por nome/CPF/NB/processo em todas as telas.
- **Celular**: PWA com notificação push de prazo e perícia (a barra inferior já foi decidida).

### Segurança e operação
- Limite de tentativas no login (item 2.2), **2FA** para admins, sessão com expiração curta e renovação.
- **RLS de verdade** no Supabase (hoje o servidor usa a chave de serviço e filtra por `user_id` no código) e revisão de segredos.
- **Backups testados** (restore mensal) e **observabilidade** (Sentry/Vercel logs com alerta; `/api/saude` virando página de status com os crons).
- LGPD: retenção e portabilidade já existem; falta trilha de acesso a dados do cliente (quem abriu o quê).

## 5. Como repetir
```
# pilha local (ver 14/10) + gateway com /__contagem
npx tsx scripts/teste-fluxo/escala.ts   3000 10000 24          # regressão do fluxo
npx tsx scripts/teste-fluxo/estresse.ts 4000 40 16,48,96,192,384
CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx tsx scripts/teste-fluxo/cliques.ts 6 60 24
```
Commits: `a283d86` (correção das Intimações), `fddafcc` (roteiros do estresse).
