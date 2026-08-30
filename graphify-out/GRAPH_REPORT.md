# Graph Report - .  (2026-08-30)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1086 nodes · 2726 edges · 78 communities (38 shown, 40 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.64)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c502f9ae`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- processos/page.tsx
- getCurrentUser
- dependencies
- devDependencies
- compilerOptions
- (dashboard)/page.tsx
- components.json
- cn
- layout.tsx
- seed.ts
- index.ts
- Protocolo administrativo no INSS — fluxo operacional
- validators/index.ts
- README.md
- AGENTS.md
- eslint.config.mjs
- client.ts
- next.config.ts
- postcss.config.mjs
- CLAUDE.md
- [id]/page.tsx
- documentos-cliente.tsx
- header.tsx
- [id]/page.tsx
- cn
- processos/page.tsx
- datajud.ts
- resumo/page.tsx
- protocolo/index.ts
- sincronizar.ts
- ipDaRequisicao
- processar/route.ts
- quadro-judicial.tsx
- Protocolo assistido no Meu INSS — guia de quem protocola
- idsDoEscritorio
- judicial/intimacoes/page.tsx
- ficha/route.ts
- [id]/page.tsx
- localizacao/index.ts
- ensaio-login.ts
- mascarar.ts
- administrativo/route.ts
- intimacoes/route.ts
- supabase-local.mjs
- saude/route.ts
- seed-local.mjs
- vercel.json
- @base-ui/react
- class-variance-authority
- clsx
- effect
- jose
- leaflet
- lucide-react
- next
- next-themes
- pdf-lib
- prisma
- @prisma/client
- react-dom
- recharts
- server-only
- shadcn
- sharp
- @supabase/supabase-js
- tailwind-merge
- tw-animate-css
- @types/leaflet
- zod
- cron-djen.sh
- db-defaults.mjs
- db-ensure.mjs
- db-local.sh
- dev-local.sh
- setup-local.sh
- bcryptjs

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 117 edges
2. `idsDoEscritorio` - 116 edges
3. `cn()` - 71 edges
4. `toCamelCase()` - 65 edges
5. `supabase` - 57 edges
6. `toSnakeCase()` - 22 edges
7. `ipDaRequisicao()` - 20 edges
8. `registrarTratamento()` - 20 edges
9. `Button()` - 17 edges
10. `Card()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `RotinaAutomatica()` --calls--> `cn()`  [EXTRACTED]
  app/(dashboard)/judicial/intimacoes/page.tsx → lib/utils.ts
- `IntimacoesPage()` --indirect_call--> `lista()`  [INFERRED]
  app/(dashboard)/judicial/intimacoes/page.tsx → lib/integracoes/aplicar.ts
- `MapaPage()` --indirect_call--> `chave()`  [INFERRED]
  app/(dashboard)/mapa/page.tsx → lib/seguranca/cofre.ts
- `POST()` --indirect_call--> `texto()`  [INFERRED]
  app/api/documentos/processar/route.ts → lib/integracoes/aplicar.ts
- `Campo()` --calls--> `cn()`  [EXTRACTED]
  components/administrativo/ficha-cliente.tsx → lib/utils.ts

## Import Cycles
- None detected.

## Communities (78 total, 40 thin omitted)

### Community 0 - "processos/page.tsx"
Cohesion: 0.22
Nodes (11): emptyForm, Button(), ButtonProps, Dialog(), DialogClose(), DialogContent(), DialogDescription(), DialogFooter() (+3 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.11
Nodes (38): DELETE(), GET(), PUT(), GET(), POST(), GET(), POST(), GET() (+30 more)

### Community 2 - "dependencies"
Cohesion: 0.29
Nodes (7): @anthropic-ai/sdk, dependencies, @anthropic-ai/sdk, react, tw-animate-css, react, tw-animate-css

### Community 3 - "devDependencies"
Cohesion: 0.05
Nodes (39): embedded-postgres, eslint, eslint-config-next, devDependencies, embedded-postgres, eslint, eslint-config-next, playwright (+31 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "(dashboard)/page.tsx"
Cohesion: 0.16
Nodes (15): POST(), POST(), UserRole, createSession(), decrypt(), deleteSession(), encodedKey, encrypt() (+7 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "cn"
Cohesion: 0.11
Nodes (25): PATCH(), StatusSchema, ProcessosStatusChart(), TOM_POR_STATUS, MetricCardProps, BASE_LEGAL_OPCOES, BaseLegal, Confirmacao (+17 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.05
Nodes (62): GET(), MOTIVO_MENSAGEM, isProcessoStatus(), comoStatus(), derivarAplicacao(), formatarBr(), lista(), moeda() (+54 more)

### Community 11 - "Protocolo administrativo no INSS — fluxo operacional"
Cohesion: 0.08
Nodes (23): 1. Base legal — antes de qualquer documento, 2. Pasta de documentos, 3. Abrir o caso administrativo, 4. Preparar o protocolo, 5. Passe de bastão, 6. Protocolar no portal, 7. Registrar o protocolo, 8. Acompanhar (+15 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.08
Nodes (29): POST(), PreparoProtocolo(), avaliarPreparo(), ClienteParaPreparo, DOCUMENTOS_COMUNS, DOCUMENTOS_POR_ESPECIE, documentosDaEspecie(), Gravidade (+21 more)

### Community 13 - "README.md"
Cohesion: 0.15
Nodes (12): Calendário forense, Deploy on Vercel, Direcionar a intimação para um time, Em produção, Getting Started, Intimações (DJEN), Judicial, Learn More (+4 more)

### Community 21 - "[id]/page.tsx"
Cohesion: 0.08
Nodes (51): ClienteDetalhe(), FilaCategoriaPage(), normalizar(), AdministrativoPage(), BASE_LEGAL_CURTO, ClienteIntegracao, formatarData(), normalizar() (+43 more)

### Community 22 - "documentos-cliente.tsx"
Cohesion: 0.09
Nodes (31): GET(), Analise, Documento, DocumentosCliente(), formatarTamanho(), ProcessoOpcao, resumoTriagem(), ROTULO_INCAPACIDADE (+23 more)

### Community 23 - "header.tsx"
Cohesion: 0.12
Nodes (14): LogoutButton(), Header(), iniciais(), MenuUsuario(), ROTULO_POR_PAPEL, Usuario, ItemNavegacao(), Marca() (+6 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.10
Nodes (20): AgendaPage(), emptyForm, hojeISO(), ClientePreparo, ProcessoPreparo, KanbanBoard(), prazoInfo(), Badge() (+12 more)

### Community 25 - "cn"
Cohesion: 0.15
Nodes (21): CartaoCategoria(), MetricCard(), formatarData(), ProcessoRecente, ProcessTable(), CLASSES_POR_TOM, StatusBadge(), Tom (+13 more)

### Community 26 - "processos/page.tsx"
Cohesion: 0.06
Nodes (64): Acao, Analista, analistaClaude(), DadosDoCaso, DocumentoDoCaso, ESQUEMA, Plano, temCredencial() (+56 more)

### Community 27 - "datajud.ts"
Cohesion: 0.06
Nodes (45): JudicialPage(), normalizar(), CartaoIntimacao(), COR_TIME, diasAte(), formatarData(), hojeISO(), Intimacao (+37 more)

### Community 28 - "resumo/page.tsx"
Cohesion: 0.27
Nodes (7): getResumo(), metadata, ResumoEmbedPage(), compareProcessoStatus(), PROCESSO_STATUS_LABELS, PROCESSO_STATUS_VALUES, ProcessoStatus

### Community 29 - "protocolo/index.ts"
Cohesion: 0.09
Nodes (29): LocalizacaoSchema, PATCH(), GET(), GET(), ConsentimentoBruto, GET(), ImportacaoBruta, AnaliseSchema (+21 more)

### Community 30 - "sincronizar.ts"
Cohesion: 0.07
Nodes (42): executar(), GET(), POST(), usuarioDaRotina(), POST(), TarefaDaIntimacaoSchema, descricaoDaTarefa(), IntimacaoParaTarefa (+34 more)

### Community 31 - "ipDaRequisicao"
Cohesion: 0.16
Nodes (20): POST(), GET(), POST(), DELETE(), PATCH(), GET(), POST(), POST() (+12 more)

### Community 32 - "processar/route.ts"
Cohesion: 0.16
Nodes (19): MOTIVO_IA_MENSAGEM, POST(), TIPOS_ACEITOS, MOTIVO_PARSER_MENSAGEM, POST(), montarPdf(), PaginaTratada, tratarImagem() (+11 more)

### Community 33 - "quadro-judicial.tsx"
Cohesion: 0.13
Nodes (19): CartaoJudicial(), DadosDataJud, formatarCnj(), formatarData(), ItemJudicial, MenuFase(), PainelDataJud(), QuadroJudicial() (+11 more)

### Community 34 - "Protocolo assistido no Meu INSS — guia de quem protocola"
Cohesion: 0.11
Nodes (17): 1. Ele pergunta se pode começar, 2. O login — seu, de um jeito ou de outro, 3. Ele preenche — dizendo o que entendeu e por quê, 4. ⏸ PARE — a conferência é sua, 5. O número do protocolo, Antes de começar, Com login automático, Como rodar (+9 more)

### Community 35 - "idsDoEscritorio"
Cohesion: 0.33
Nodes (11): DELETE(), GET(), PUT(), DELETE(), GET(), PATCH(), idsDoEscritorio, remover() (+3 more)

### Community 36 - "judicial/intimacoes/page.tsx"
Cohesion: 0.23
Nodes (14): alternarAutomatico(), assinarPreferencia(), definirTimePadrao(), emDias(), Filtro, hojeISO(), IntimacoesPage(), normalizar() (+6 more)

### Community 37 - "ficha/route.ts"
Cohesion: 0.23
Nodes (11): FichaSchema, PATCH(), MapaPage(), CENTRO_PADRAO, Grupo, MapaAtendimento(), pinoHtml(), PontoCliente (+3 more)

### Community 38 - "[id]/page.tsx"
Cohesion: 0.24
Nodes (8): MapaAtendimento, OPCOES_DE_CIDADE, SemLocalizacao, EmptyState(), ABAS, AbasJudicial(), Skeleton(), EsferaProcesso

### Community 39 - "localizacao/index.ts"
Cohesion: 0.38
Nodes (8): GET(), INDICE, municipioDoEndereco(), municipioPorCoordenada(), municipioPorNome(), normalizar(), Municipio, MUNICIPIOS

### Community 40 - "ensaio-login.ts"
Cohesion: 0.29
Nodes (7): Cenario, CENARIOS, pagina(), principal(), rodar(), telaCpf(), telaSenha()

### Community 42 - "administrativo/route.ts"
Cohesion: 0.47
Nodes (5): ClienteBruto, fichaDoCliente(), GET(), PAPEIS_COM_SENHA, ProcessoBruto

### Community 43 - "intimacoes/route.ts"
Cohesion: 0.50
Nodes (4): BuscaSchema, GET(), MOTIVO_MENSAGEM, POST()

### Community 44 - "supabase-local.mjs"
Cohesion: 0.60
Nodes (4): handleStorage(), PORT, proxyRest(), readBody()

## Knowledge Gaps
- **326 isolated node(s):** `emptyForm`, `emptyForm`, `ClienteIntegracao`, `BASE_LEGAL_CURTO`, `Filtro` (+321 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **40 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `linha()` connect `index.ts` to `processos/page.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `getCurrentUser` to `processar/route.ts`, `idsDoEscritorio`, `tw-animate-css`, `ficha/route.ts`, `localizacao/index.ts`, `cn`, `administrativo/route.ts`, `intimacoes/route.ts`, `validators/index.ts`, `index.ts`, `[id]/page.tsx`, `documentos-cliente.tsx`, `protocolo/index.ts`, `sincronizar.ts`, `ipDaRequisicao`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `ClienteIntegracao` to the rest of the system?**
  _326 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.11178451178451178 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.06896551724137931 - nodes in this community are weakly interconnected._
- **Should `components.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._