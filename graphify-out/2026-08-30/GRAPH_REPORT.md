# Graph Report - dashboard-processos  (2026-07-27)

## Corpus Check
- 128 files · ~50,789 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 649 nodes · 1532 edges · 30 communities (23 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `75ceab08`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- financeiro/page.tsx
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

## God Nodes (most connected - your core abstractions)
1. `getCurrentUser()` - 88 edges
2. `toCamelCase()` - 66 edges
3. `cn()` - 38 edges
4. `supabase` - 35 edges
5. `toSnakeCase()` - 25 edges
6. `ipDaRequisicao()` - 20 edges
7. `registrarTratamento()` - 20 edges
8. `compilerOptions` - 16 edges
9. `POST()` - 14 edges
10. `Card()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --indirect_call--> `texto()`  [INFERRED]
  app/api/documentos/processar/route.ts → lib/integracoes/aplicar.ts
- `Marca()` --calls--> `cn()`  [EXTRACTED]
  components/layout/sidebar.tsx → lib/utils.ts
- `Navegacao()` --calls--> `cn()`  [EXTRACTED]
  components/layout/sidebar.tsx → lib/utils.ts
- `DELETE()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/andamentos/[id]/route.ts → lib/auth.ts
- `GET()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/api/auth/me/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (30 total, 7 thin omitted)

### Community 0 - "financeiro/page.tsx"
Cohesion: 0.20
Nodes (15): emptyForm, emptyForm, FinanceiroPage(), formatBRL(), EmptyState(), Button(), ButtonProps, Dialog() (+7 more)

### Community 1 - "getCurrentUser"
Cohesion: 0.06
Nodes (83): DELETE(), GET(), PUT(), GET(), POST(), GET(), DELETE(), GET() (+75 more)

### Community 2 - "dependencies"
Cohesion: 0.04
Nodes (47): @anthropic-ai/sdk, @base-ui/react, bcryptjs, class-variance-authority, clsx, effect, jose, lucide-react (+39 more)

### Community 3 - "devDependencies"
Cohesion: 0.06
Nodes (30): eslint, eslint-config-next, devDependencies, eslint, eslint-config-next, playwright, tailwindcss, @tailwindcss/postcss (+22 more)

### Community 4 - "compilerOptions"
Cohesion: 0.07
Nodes (28): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+20 more)

### Community 5 - "(dashboard)/page.tsx"
Cohesion: 0.12
Nodes (17): POST(), POST(), POST(), UserRole, globalForPrisma, createSession(), decrypt(), deleteSession() (+9 more)

### Community 6 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 7 - "cn"
Cohesion: 0.14
Nodes (16): ProcessosStatusChart(), BASE_LEGAL_OPCOES, BaseLegal, Confirmacao, Consentimento, Documento, DOCUMENTO_LABELS, Fonte (+8 more)

### Community 8 - "layout.tsx"
Cohesion: 0.33
Nodes (4): metadata, plexMono, plexSans, ThemeProvider()

### Community 10 - "index.ts"
Cohesion: 0.05
Nodes (59): MOTIVO_IA_MENSAGEM, POST(), TIPOS_ACEITOS, MOTIVO_PARSER_MENSAGEM, POST(), montarPdf(), PaginaTratada, tratarImagem() (+51 more)

### Community 11 - "Protocolo administrativo no INSS — fluxo operacional"
Cohesion: 0.08
Nodes (23): 1. Base legal — antes de qualquer documento, 2. Pasta de documentos, 3. Abrir o caso administrativo, 4. Preparar o protocolo, 5. Passe de bastão, 6. Protocolar no portal, 7. Registrar o protocolo, 8. Acompanhar (+15 more)

### Community 12 - "validators/index.ts"
Cohesion: 0.12
Nodes (16): BaseLegalLGPDEnum, DocumentoINSSEnum, EsferaProcessoEnum, FonteIntegracaoEnum, LancamentoTipoEnum, ProcessoStatusEnum, TarefaPrioridadeEnum, TarefaStatusEnum (+8 more)

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 21 - "[id]/page.tsx"
Cohesion: 0.21
Nodes (13): BASE_LEGAL_CURTO, ClienteIntegracao, formatarData(), InssPage(), Resumo, TOM_POR_STATUS, MetricCardProps, Card() (+5 more)

### Community 22 - "documentos-cliente.tsx"
Cohesion: 0.08
Nodes (32): GET(), ClienteDetalhe(), Analise, Documento, DocumentosCliente(), formatarTamanho(), ProcessoOpcao, resumoTriagem() (+24 more)

### Community 23 - "header.tsx"
Cohesion: 0.12
Nodes (15): LogoutButton(), MetricCard(), ProcessoRecente, Header(), iniciais(), MenuUsuario(), ROTULO_POR_PAPEL, Usuario (+7 more)

### Community 24 - "[id]/page.tsx"
Cohesion: 0.10
Nodes (23): AgendaPage(), emptyForm, hojeISO(), KanbanBoard(), prazoInfo(), Andamento, Auditoria, Cliente (+15 more)

### Community 25 - "cn"
Cohesion: 0.17
Nodes (18): formatarData(), ProcessTable(), CLASSES_POR_TOM, StatusBadge(), Tom, TOM_POR_STATUS, CardAction(), CardFooter() (+10 more)

### Community 26 - "processos/page.tsx"
Cohesion: 0.29
Nodes (11): isProcessoStatus(), comoStatus(), derivarAplicacao(), formatarBr(), lista(), moeda(), numero(), prioridadePorPrazo() (+3 more)

### Community 27 - "datajud.ts"
Cohesion: 0.31
Nodes (8): GET(), MOTIVO_MENSAGEM, consultarProcessoDataJud(), DataJudResultado, detectarEndpoint(), limparNumero(), normalizarData(), TRF_ENDPOINTS

### Community 28 - "resumo/page.tsx"
Cohesion: 0.27
Nodes (7): getResumo(), metadata, ResumoEmbedPage(), compareProcessoStatus(), PROCESSO_STATUS_LABELS, PROCESSO_STATUS_VALUES, ProcessoStatus

### Community 29 - "protocolo/index.ts"
Cohesion: 0.19
Nodes (15): POST(), ClientePreparo, PreparoProtocolo(), ProcessoPreparo, avaliarPreparo(), ClienteParaPreparo, DOCUMENTOS_COMUNS, DOCUMENTOS_POR_ESPECIE (+7 more)

## Knowledge Gaps
- **220 isolated node(s):** `emptyForm`, `emptyForm`, `emptyForm`, `ClienteIntegracao`, `Resumo` (+215 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getCurrentUser()` connect `getCurrentUser` to `index.ts`, `documentos-cliente.tsx`, `header.tsx`, `datajud.ts`, `protocolo/index.ts`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `toCamelCase()` connect `getCurrentUser` to `index.ts`, `protocolo/index.ts`, `header.tsx`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `financeiro/page.tsx`, `getCurrentUser`, `[id]/page.tsx`, `header.tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `emptyForm`, `emptyForm`, `emptyForm` to the rest of the system?**
  _220 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `getCurrentUser` be split into smaller, more focused modules?**
  _Cohesion score 0.06330580906852093 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._